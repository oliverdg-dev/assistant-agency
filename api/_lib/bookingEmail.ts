import {
  BOOKING_TIMEOUTS,
  displayReference,
  roles,
  type BookingFormData,
} from "./booking.js";
import { BOOKING_LOG, type BookingLogger } from "./bookingLog.js";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_INTERNAL_TO = "lai@hendersonassociates.ca";
// Vercel preview deploys (demos, branch testing) email this inbox instead, so
// test requests never reach the production inbox.
const PREVIEW_INTERNAL_TO = "edrine.e@hendersonassociates.ca";

export type SendResult = "sent" | "failed" | "skipped";

// What happened to the database write before this email was sent.
export type StoreOutcome = "saved" | "failed" | "unconfirmed";

export interface EmailContext {
  leadId: string | null;
  storeOutcome: StoreOutcome;
}

export interface OutgoingEmail {
  to: string[];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailConfig {
  apiKey: string;
  from: string;
  internalTo: string;
  calendarUrl: string | null;
}

export interface SendOptions {
  config?: EmailConfig;
  fetch?: typeof fetch;
  logger?: BookingLogger;
  attemptTimeoutMs?: number;
  retryDelayMaxMs?: number;
}

export const readEmailConfig = (env = process.env): EmailConfig => ({
  apiKey: env.RESEND_API_KEY ?? "",
  from: env.BOOKING_FROM_EMAIL ?? "",
  internalTo:
    env.BOOKING_INTERNAL_TO ||
    (env.VERCEL_ENV === "preview" ? PREVIEW_INTERNAL_TO : DEFAULT_INTERNAL_TO),
  calendarUrl: httpsUrlOrNull(env.VITE_BOOKING_CALENDAR_URL),
});

export const httpsUrlOrNull = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Internal notification: everything the team needs, reply goes to the client.
// ---------------------------------------------------------------------------

const SUBJECT_PREFIX: Record<StoreOutcome, string> = {
  saved: "",
  failed: "[NOT SAVED] ",
  unconfirmed: "[SAVE UNCONFIRMED] ",
};

export const buildInternalEmail = (
  form: BookingFormData,
  context: EmailContext,
  config: EmailConfig,
): OutgoingEmail => {
  const subject = `${SUBJECT_PREFIX[context.storeOutcome]}New job request: ${form.role} at ${form.company}`;
  const reference = displayReference(context.leadId);

  const warning =
    context.storeOutcome === "failed"
      ? "This request was NOT saved to the database. Enter it manually."
      : context.storeOutcome === "unconfirmed"
        ? `The database did not confirm this save. Check booking_leads for ${form.email} before entering it manually.`
        : "";

  const rows: Array<[string, string]> = [
    ["Name", `${form.firstName} ${form.lastName}`],
    ["Email", form.email],
    ["Company", form.company],
    ["Website", form.website || "-"],
    ["Country", form.country || "-"],
    ["Role", form.role],
    ["Headcount", form.headcount],
    ["Engagement", form.engagementType],
    ["Start", form.startTimeframe || "-"],
    ["Industry", form.sector],
    ["Monthly budget", form.budget],
  ];
  if (reference) rows.unshift(["Reference ID", reference]);
  if (form.submissionId) rows.push(["Submission ID", form.submissionId]);

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#0f1f3a">
    ${warning ? `<p style="margin:0 0 16px;padding:12px;border:1px solid #b42318;border-radius:8px;color:#b42318"><strong>${escapeHtml(warning)}</strong></p>` : ""}
    <h2 style="margin:0 0 12px">New job request</h2>
    <table style="border-collapse:collapse;width:100%;max-width:640px">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:6px 12px 6px 0;color:#4a5568;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}
    </table>
    <h3 style="margin:20px 0 8px">Responsibilities, skills and tools</h3>
    <p style="margin:0;white-space:pre-wrap">${escapeHtml(form.message || "-")}</p>
    <p style="margin:20px 0 0;color:#4a5568">Reply to this email to answer ${escapeHtml(form.firstName)} directly.</p>
  </div>`;

  const text = [
    warning,
    "New job request",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Responsibilities, skills and tools:",
    form.message || "-",
  ]
    .filter((line, index) => index !== 0 || line)
    .join("\n");

  return {
    to: [config.internalTo],
    replyTo: form.email,
    subject,
    html,
    text,
  };
};

// ---------------------------------------------------------------------------
// Client confirmation: fixed wording. It never repeats free text the submitter
// typed (company, notes, website), so the form can't be used to send arbitrary
// messages from our domain to someone else's inbox.
// ---------------------------------------------------------------------------

const knownValue = (list: readonly string[], value: string) =>
  list.includes(value) ? value : null;

export const buildClientEmail = (
  form: BookingFormData,
  context: EmailContext,
  config: EmailConfig,
): OutgoingEmail => {
  const role = knownValue(roles, form.role) ?? "the role you described";
  const reference = displayReference(context.leadId);
  const details = [
    `Role: ${role}`,
    form.headcount && form.headcount !== "Not specified"
      ? `Number of people: ${form.headcount}`
      : null,
    form.engagementType && form.engagementType !== "Not specified"
      ? `Engagement: ${form.engagementType}`
      : null,
    reference ? `Reference ID: ${reference}` : null,
  ].filter((line): line is string => Boolean(line));

  const greeting = `Hi ${firstWord(form.firstName)},`;
  const intro =
    "Thanks, we've received your requirements. Our team will review them and get back to you shortly.";
  const replyLine = "If you'd like to add details, just reply to this email.";
  const calendarLine = config.calendarUrl
    ? `Prefer to talk now? Book a call: ${config.calendarUrl}`
    : null;

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#0f1f3a">
    <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px">${escapeHtml(intro)}</p>
    <div style="padding:16px;border:1px solid #e4e2dc;border-radius:8px;background:#fafaf8">
      ${details.map((line) => `<p style="margin:0 0 6px">${escapeHtml(line)}</p>`).join("")}
    </div>
    <p style="margin:16px 0 0">${escapeHtml(replyLine)}</p>
    ${calendarLine && config.calendarUrl ? `<p style="margin:12px 0 0"><a href="${escapeHtml(config.calendarUrl)}">Prefer to talk now? Book a call</a></p>` : ""}
  </div>`;

  const text = [greeting, "", intro, "", ...details, "", replyLine, calendarLine]
    .filter((line): line is string => line !== null)
    .join("\n");

  return {
    to: [form.email],
    replyTo: config.internalTo,
    subject: "We received your job request",
    html,
    text,
  };
};

// ---------------------------------------------------------------------------
// Senders. Each returns sent / failed / skipped and never throws; failures and
// skips are logged with the lead id and provider status only.
// ---------------------------------------------------------------------------

export const sendInternalEmail = (
  form: BookingFormData,
  context: EmailContext,
  options: SendOptions = {},
): Promise<SendResult> => {
  const config = options.config ?? readEmailConfig();
  return deliver("internal", buildInternalEmail(form, context, config), context, config, options);
};

export const sendClientEmail = (
  form: BookingFormData,
  context: EmailContext,
  options: SendOptions = {},
): Promise<SendResult> => {
  const config = options.config ?? readEmailConfig();
  return deliver("client", buildClientEmail(form, context, config), context, config, options);
};

const deliver = (
  kind: "internal" | "client",
  email: OutgoingEmail,
  context: EmailContext,
  config: EmailConfig,
  options: SendOptions,
): Promise<SendResult> => sendEmail(email, kind, `lead=${context.leadId ?? "unsaved"}`, { ...options, config });

// Sends any email through Resend with the same retry and logging as the job
// request emails. `kind` and `ref` go into the log line (for example
// "sign-in-code" and "user=<id>"); they must never include personal details.
export const sendEmail = async (
  email: OutgoingEmail,
  kind: string,
  ref: string,
  options: SendOptions = {},
): Promise<SendResult> => {
  const logger = options.logger ?? console;
  const config = options.config ?? readEmailConfig();

  if (!config.apiKey || !config.from) {
    logger.error(`${BOOKING_LOG.email} ${kind} skipped ${ref} status=none`);
    return "skipped";
  }

  const status = await postWithRetry(email, config, options);
  if (status !== null && status >= 200 && status < 300) {
    return "sent";
  }

  logger.error(`${BOOKING_LOG.email} ${kind} failed ${ref} status=${status ?? "none"}`);
  return "failed";
};

// One retry for rate limits (429) and provider errors (5xx), waiting at most
// a second, so a burst of submissions doesn't silently drop notifications.
// Returns the final HTTP status, or null when the request never completed.
const postWithRetry = async (
  email: OutgoingEmail,
  config: EmailConfig,
  options: SendOptions,
): Promise<number | null> => {
  const doFetch = options.fetch ?? fetch;
  const attemptTimeoutMs = options.attemptTimeoutMs ?? BOOKING_TIMEOUTS.emailAttemptMs;
  const retryDelayMaxMs = options.retryDelayMaxMs ?? BOOKING_TIMEOUTS.emailRetryDelayMaxMs;

  let status: number | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let retryAfterMs = retryDelayMaxMs;
    try {
      const res = await doFetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: email.to,
          reply_to: email.replyTo,
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
        signal: AbortSignal.timeout(attemptTimeoutMs),
      });
      status = res.status;
      if (res.ok) return status;
      if (status !== 429 && status < 500) return status;
      const header = Number(res.headers.get("retry-after"));
      if (Number.isFinite(header) && header >= 0) retryAfterMs = header * 1000;
    } catch {
      status = null;
    }

    if (attempt === 0) {
      await sleep(Math.min(retryAfterMs, retryDelayMaxMs));
    }
  }

  return status;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const firstWord = (value: string) => value.trim().split(/\s+/)[0] || "there";

export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
