import {
  applyLegacyDefaults,
  BOOKING_TIMEOUTS,
  HONEYPOT_FIELD,
  sanitizeBookingFormData,
  validateBookingFormData,
  type BookingApiResponse,
  type BookingFormData,
} from "./booking.js";
import {
  sendClientEmail,
  sendInternalEmail,
  type EmailContext,
  type SendResult,
} from "./bookingEmail.js";
import { BOOKING_LOG, type BookingLogger } from "./bookingLog.js";
import {
  BookingConfigError,
  markLeadNotified,
  storeBookingLead,
  type StoredLead,
} from "./bookingServer.js";

export { BOOKING_LOG } from "./bookingLog.js";

/*
 * Request pipeline (both the Vercel function and the Vite dev server go
 * through handleBookingHttp):
 *
 *   method check ─▶ body parse ─▶ honeypot ─▶ sanitize + validate
 *        │405           │400          │200 (dropped)   │400 field errors
 *        ▼              ▼             ▼                ▼
 *   store in Neon (8s budget; a retry with the same submission id finds the same row)
 *     ├─ saved, team already emailed ─▶ 200 + leadId, no emails (duplicate)
 *     ├─ saved ───────────▶ internal + client email in parallel ─▶ mark team notified ─▶ 200 + leadId
 *     └─ failed/timeout ──▶ internal email first ("[NOT SAVED]" / "[SAVE UNCONFIRMED]")
 *                              ├─ sent ─────▶ client email ─▶ 200 (no leadId)
 *                              └─ not sent ─▶ 500, no client email
 */

export interface BookingDeps {
  store: (form: BookingFormData) => Promise<StoredLead>;
  // Called after the team email went out for a stored lead that holds the
  // notification claim, so retries of the same submission stay quiet.
  markNotified: (id: string) => Promise<void>;
  sendInternal: (form: BookingFormData, context: EmailContext) => Promise<SendResult>;
  sendClient: (form: BookingFormData, context: EmailContext) => Promise<SendResult>;
  logger: BookingLogger;
  storeTimeoutMs: number;
}

export const defaultBookingDeps = (): BookingDeps => ({
  store: storeBookingLead,
  markNotified: markLeadNotified,
  sendInternal: (form, context) => sendInternalEmail(form, context),
  sendClient: (form, context) => sendClientEmail(form, context),
  logger: console,
  storeTimeoutMs: BOOKING_TIMEOUTS.storeMs,
});

export interface BookingApiResult {
  status: number;
  body: BookingApiResponse;
  headers?: Record<string, string>;
}

// Passed by the Vercel shim when reading req.body itself threw (Vercel parses
// JSON lazily and throws on malformed input).
export const UNREADABLE_BODY = Symbol("unreadable-body");

const RECEIVED_MESSAGE = "Thanks, we've received your requirements.";
const RETRY_MESSAGE =
  "We couldn't submit your request right now. Please try again in a moment.";
const UNREADABLE_MESSAGE = "We couldn't read your request. Please try again.";

export const handleBookingHttp = async (
  request: { method?: string; body: unknown },
  deps: Partial<BookingDeps> = {},
): Promise<BookingApiResult> => {
  if (request.method !== "POST") {
    return {
      status: 405,
      headers: { Allow: "POST" },
      body: { ok: false, message: "Method not allowed." },
    };
  }

  const payload = parseBody(request.body);
  if (payload === null) {
    return { status: 400, body: { ok: false, message: UNREADABLE_MESSAGE } };
  }

  return processBookingSubmission(payload, deps);
};

// Returns the payload object, or null when the body can't be a submission.
const parseBody = (body: unknown): Record<string, unknown> | null => {
  if (body === UNREADABLE_BODY) return null;
  if (body === undefined) return {};

  let value = body;
  if (typeof body === "string") {
    if (!body.trim()) return null;
    try {
      value = JSON.parse(body);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const isHoneypotFilled = (payload: Record<string, unknown>): boolean => {
  const value = payload[HONEYPOT_FIELD];
  return typeof value === "string" && value.trim().length > 0;
};

export const processBookingSubmission = async (
  payload: Record<string, unknown>,
  overrides: Partial<BookingDeps> = {},
): Promise<BookingApiResult> => {
  const deps = { ...defaultBookingDeps(), ...overrides };

  if (isHoneypotFilled(payload)) {
    deps.logger.warn(BOOKING_LOG.honeypot);
    return { status: 200, body: { ok: true, message: RECEIVED_MESSAGE } };
  }

  const form = withServerSubmissionId(applyLegacyDefaults(sanitizeBookingFormData(payload)));
  const fieldErrors = validateBookingFormData(form);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: 400,
      body: {
        ok: false,
        message: "Please check the highlighted fields and try again.",
        fieldErrors,
      },
    };
  }

  const stored = await storeWithTimeout(form, deps);

  if (stored.ok) {
    if (stored.notify === false) {
      // A retry of a request the team has already been (or is being) told about.
      deps.logger.warn(`${BOOKING_LOG.duplicate} lead=${stored.id}`);
      return { status: 200, body: { ok: true, message: RECEIVED_MESSAGE, leadId: stored.id } };
    }
    const context: EmailContext = { leadId: stored.id, storeOutcome: "saved" };
    // The lead is in the database, so the request succeeded even if an email
    // fails; failures are logged inside the senders.
    const [internal] = await Promise.all([
      deps.sendInternal(form, context),
      deps.sendClient(form, context),
    ]);
    if (stored.notify === true && internal === "sent") {
      await deps.markNotified(stored.id).catch(() => {
        deps.logger.error(`${BOOKING_LOG.notifyMarkFailed} lead=${stored.id}`);
      });
    }
    return {
      status: 200,
      body: { ok: true, message: RECEIVED_MESSAGE, leadId: stored.id },
    };
  }

  // This tsconfig is not strict, so the union doesn't narrow on `ok`.
  const failure = stored as StoreFailure;
  deps.logger.error(
    `${BOOKING_LOG.storeFailed} cause=${failure.cause} code=${failure.code ?? "none"}`,
  );
  return deliverWithoutStore(form, failure.cause === "timeout" ? "unconfirmed" : "failed", deps);
};

// The database didn't take the lead. Email the team the full request first;
// only tell the client it worked if the team actually received it.
const deliverWithoutStore = async (
  form: BookingFormData,
  storeOutcome: "failed" | "unconfirmed",
  deps: BookingDeps,
): Promise<BookingApiResult> => {
  const context: EmailContext = { leadId: null, storeOutcome };
  const internal = await deps.sendInternal(form, context);

  if (internal !== "sent") {
    deps.logger.error(BOOKING_LOG.bothFailed);
    return { status: 500, body: { ok: false, message: RETRY_MESSAGE } };
  }

  deps.logger.warn(BOOKING_LOG.savedByEmailOnly);
  await deps.sendClient(form, context);
  return { status: 200, body: { ok: true, message: RECEIVED_MESSAGE } };
};

type StoreFailure = {
  ok: false;
  cause: "timeout" | "missing_config" | "db_error";
  code?: string;
};
type StoreAttempt = { ok: true; id: string; notify?: boolean } | StoreFailure;

const storeWithTimeout = async (
  form: BookingFormData,
  deps: BookingDeps,
): Promise<StoreAttempt> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<StoreAttempt>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, cause: "timeout" }), deps.storeTimeoutMs);
  });

  const attempt = deps
    .store(form)
    .then((lead): StoreAttempt => ({ ok: true, id: lead.id, notify: lead.notify }))
    .catch((error: unknown): StoreAttempt => {
      if (error instanceof BookingConfigError) {
        return { ok: false, cause: "missing_config" };
      }
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : undefined;
      return { ok: false, cause: "db_error", code };
    });

  try {
    return await Promise.race([attempt, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The browser normally sends a random UUID. Anything else (an old browser's
// fallback id, a hand-made request) is replaced, so a guessable id is never
// stored.
const withServerSubmissionId = (form: BookingFormData): BookingFormData =>
  UUID_RE.test(form.submissionId) ? form : { ...form, submissionId: globalThis.crypto.randomUUID() };

// Names (never values) of the env vars the pipeline needs but can't find.
export const bookingConfigStatus = (env = process.env): string[] => {
  const missing: string[] = [];
  if (!env.POSTGRES_URL && !env.DATABASE_URL) missing.push("POSTGRES_URL");
  if (!env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!env.BOOKING_FROM_EMAIL) missing.push("BOOKING_FROM_EMAIL");
  return missing;
};

let configLogged = false;

// Called once per cold start so a missing env var shows up in the logs as a
// configuration problem, not as an outage.
export const logBookingConfigOnce = (logger: BookingLogger = console) => {
  if (configLogged) return;
  configLogged = true;
  const missing = bookingConfigStatus();
  if (missing.length > 0) {
    logger.error(`${BOOKING_LOG.config} ${missing.join(", ")}`);
  }
};
