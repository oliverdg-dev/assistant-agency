import { hashToken, newToken, type StaffUser } from "./auth.js";
import { displayReference } from "./booking.js";
import type { Db } from "./db.js";
import { apiError, ok, type ApiRequest, type ApiResponse } from "./http.js";
import {
  ENGLISH_LEVELS,
  MAX_SHORTLIST,
  SHORTLIST_LINK_DAYS,
  SHORTLIST_RESPOND_DAYS,
  STATUS_LABELS,
  type RequestStatus,
} from "./requestStatus.js";

/*
 * Shortlists: staff build one per request, publish it, and the client gets a
 * private link by email.
 *
 *   staff add candidates (consent ticked) ─▶ publish ─▶ status Shortlist ready
 *        ─▶ new link (older links revoked) ─▶ email from the owner
 *   client: /shortlist#t=… ─▶ Continue ─▶ cards ─▶ interview / pass ─▶ send choices
 *
 * This file holds what staff do and the shared pieces; the client's side is
 * in shortlistApi.ts.
 */

export const SHORTLIST_LOG = {
  linkEmail: "Shortlist link email",
  published: "Shortlist published",
  choices: "Shortlist choices received",
} as const;

export type EmailResult = "sent" | "failed" | "skipped";

export interface ShortlistLinkMessage {
  to: string;
  clientFirstName: string;
  // Who it comes from. Null: the team's general sender.
  sender: StaffUser | null;
  role: string;
  company: string;
  count: number;
  url: string;
  respondBy: string;
  reference: string | null;
}

export interface ShortlistChoicesMessage {
  to: string;
  ownerName: string | null;
  clientName: string;
  clientEmail: string;
  company: string;
  role: string;
  requestUrl: string | null;
  choices: Array<{ name: string; decision: "interview" | "pass"; reason: string | null }>;
  allPassed: boolean;
}

export interface ShortlistDeps {
  db: Db;
  sendShortlistLink: (message: ShortlistLinkMessage) => Promise<EmailResult>;
  sendShortlistChoices: (message: ShortlistChoicesMessage) => Promise<EmailResult>;
  // The site's own address for links in emails. Never taken from request
  // headers in production (see siteUrlFromEnv).
  siteUrl: (req: ApiRequest) => string | null;
  logger?: { info: (message: string) => void; warn: (message: string) => void };
}

export const siteUrlFromEnv = (env = process.env): string | null => {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/+$/, "");
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  // Preview deploys link to themselves, never to production.
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return null;
};

// The token goes in the fragment so it never reaches server logs or Referer headers.
export const shortlistUrl = (siteUrl: string, token: string) => `${siteUrl}/shortlist#t=${token}`;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const toIso = (value: unknown): string | null =>
  value === null || value === undefined ? null : new Date(value as string).toISOString();

// Postgres `date` arrives as a string (Neon) or a Date at UTC midnight (PGlite).
export const toDateOnly = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

// "m•••@company.com"
export const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  return domain ? `${name.charAt(0)}•••@${domain}` : "•••";
};

// One statement: revoke the request's earlier links and create a new one.
export const createLink = async (db: Db, requestId: string, sentTo: string, createdBy: string | null) => {
  const token = newToken();
  const [row] = await db.query<{ id: string; respond_by: unknown; expires_at: unknown }>(
    `WITH revoked AS (
       UPDATE shortlist_links SET revoked_at = now() WHERE request_id = $1 AND revoked_at IS NULL
     )
     INSERT INTO shortlist_links (request_id, token_hash, sent_to, respond_by, expires_at, created_by)
     VALUES ($1, $2, $3, current_date + $4::int, now() + make_interval(days => $5), $6)
     RETURNING id, respond_by, expires_at`,
    [requestId, hashToken(token), sentTo, SHORTLIST_RESPOND_DAYS, SHORTLIST_LINK_DAYS, createdBy],
  );
  return { token, linkId: row.id, respondBy: toDateOnly(row.respond_by) ?? "", expiresAt: toIso(row.expires_at) };
};

// Candidates the client can currently see on a request's shortlist.
export const VISIBLE_COUNT_SQL = `SELECT count(*)::int AS n FROM request_candidates
  WHERE request_id = $1 AND published_at IS NOT NULL AND withdrawn_at IS NULL`;

interface LeadForShortlist {
  id: string;
  status: RequestStatus;
  email: string;
  first_name: string;
  company: string;
  role: string;
  owner_user_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
}

export const LEAD_FOR_SHORTLIST_SQL = `
SELECT l.id, l.status, l.email, l.first_name, l.company, l.role, l.owner_user_id,
       o.email AS owner_email, o.name AS owner_name
FROM booking_leads l LEFT JOIN users o ON o.id = l.owner_user_id AND o.is_staff
WHERE l.id = $1`;

export const loadLead = async (db: Db, id: string) =>
  (await db.query<LeadForShortlist>(LEAD_FOR_SHORTLIST_SQL, [id]))[0] ?? null;

const ownerOf = (lead: LeadForShortlist): StaffUser | null =>
  lead.owner_user_id && lead.owner_email ? { id: lead.owner_user_id, email: lead.owner_email, name: lead.owner_name } : null;

// Creates a link, emails it to the request's stored contact address, and
// records it on the timeline. Shared by publish, staff resend and the client's
// "send me a fresh link".
export const sendLink = async (
  deps: ShortlistDeps,
  lead: LeadForShortlist,
  siteUrl: string,
  options: { actor: StaffUser | null; kind: "shortlist_published" | "link"; note: string },
) => {
  const link = await createLink(deps.db, lead.id, lead.email, options.actor?.id ?? null);
  const [{ n }] = await deps.db.query<{ n: number }>(VISIBLE_COUNT_SQL, [lead.id]);
  const result = await deps.sendShortlistLink({
    to: lead.email,
    clientFirstName: lead.first_name,
    sender: ownerOf(lead) ?? options.actor,
    role: lead.role,
    company: lead.company,
    count: Number(n),
    url: shortlistUrl(siteUrl, link.token),
    respondBy: link.respondBy,
    reference: displayReference(lead.id),
  });
  await deps.db.query(
    `INSERT INTO request_events (request_id, actor_user_id, kind, body, visibility, email_status, email_sent_at)
     VALUES ($1, $2, $3, $4, 'client', $5, CASE WHEN $5 = 'sent' THEN now() END)`,
    [lead.id, options.actor?.id ?? null, options.kind, options.note, result],
  );
  if (result !== "sent") (deps.logger ?? console).warn(`${SHORTLIST_LOG.linkEmail} ${result} request=${lead.id}`);
  return { ...link, emailStatus: result };
};

// ---------------------------------------------------------------------------
// Staff: build and publish
// ---------------------------------------------------------------------------

interface CandidateInput {
  firstName: string;
  lastName: string;
  headline: string;
  yearsExperience: number | null;
  skills: string;
  englishLevel: string;
  availability: string;
  monthlyRateUsd: number | null;
  whyPicked: string;
  consent: boolean;
  deleteAfter: string | null;
}

const LIMITS = { firstName: 60, lastName: 60, headline: 120, skills: 500, availability: 120, whyPicked: 1000 };

const text = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "");

const wholeNumber = (value: unknown, max: number): number | null | "invalid" => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : "invalid";
};

export const readCandidateInput = (body: Record<string, unknown>): { input?: CandidateInput; fields?: Record<string, string> } => {
  const fields: Record<string, string> = {};
  const years = wholeNumber(body.yearsExperience, 60);
  const rate = wholeNumber(body.monthlyRateUsd, 100000);
  const input: CandidateInput = {
    firstName: text(body.firstName, LIMITS.firstName),
    lastName: text(body.lastName, LIMITS.lastName),
    headline: text(body.headline, LIMITS.headline),
    yearsExperience: years === "invalid" ? null : years,
    skills: text(body.skills, LIMITS.skills),
    englishLevel: text(body.englishLevel, 40),
    availability: text(body.availability, LIMITS.availability),
    monthlyRateUsd: rate === "invalid" ? null : rate,
    whyPicked: text(body.whyPicked, LIMITS.whyPicked),
    consent: body.consent === true,
    deleteAfter: typeof body.deleteAfter === "string" && body.deleteAfter ? body.deleteAfter : null,
  };
  if (!input.firstName) fields.firstName = "Enter a first name.";
  if (!input.lastName) fields.lastName = "Enter a last name.";
  if (!input.headline) fields.headline = "Add a one-line headline.";
  if (years === "invalid") fields.yearsExperience = "Use a whole number of years.";
  if (rate === "invalid") fields.monthlyRateUsd = "Use a whole number of US dollars.";
  if (input.englishLevel && !(ENGLISH_LEVELS as readonly string[]).includes(input.englishLevel)) fields.englishLevel = "Choose a level.";
  if (input.deleteAfter && (!/^\d{4}-\d{2}-\d{2}$/.test(input.deleteAfter) || Number.isNaN(Date.parse(input.deleteAfter)))) {
    fields.deleteAfter = "Use a date.";
  }
  return Object.keys(fields).length ? { fields } : { input };
};

const invalid = (fields: Record<string, string>) => apiError(400, "validation", "Check the highlighted fields.", { fields });

interface StaffCandidateRow {
  id: string;
  candidate_id: string;
  first_name: string;
  last_name: string;
  headline: string;
  years_experience: number | null;
  skills: string | null;
  english_level: string | null;
  availability: string | null;
  monthly_rate_usd: number | null;
  delete_after: unknown;
  why_picked: string | null;
  rank: number;
  consent_at: string | null;
  consent_by_name: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
  client_decision: "interview" | "pass" | null;
  pass_reason: string | null;
  decided_at: string | null;
}

export const getStaffShortlist = async (db: Db, requestId: string) => {
  const rows = await db.query<StaffCandidateRow>(
    `SELECT rc.id, rc.candidate_id, c.first_name, c.last_name, c.headline, c.years_experience, c.skills,
            c.english_level, c.availability, c.monthly_rate_usd, c.delete_after, rc.why_picked, rc.rank,
            rc.consent_at, COALESCE(u.name, u.email) AS consent_by_name, rc.published_at, rc.withdrawn_at,
            rc.client_decision, rc.pass_reason, rc.decided_at
     FROM request_candidates rc
     JOIN candidates c ON c.id = rc.candidate_id
     LEFT JOIN users u ON u.id = rc.consent_by
     WHERE rc.request_id = $1
     ORDER BY rc.rank, rc.created_at`,
    [requestId],
  );
  const [link] = await db.query<Record<string, unknown>>(
    `SELECT sent_to, created_at, respond_by, expires_at, revoked_at, first_viewed_at, last_viewed_at, view_count
     FROM shortlist_links WHERE request_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [requestId],
  );
  return {
    candidates: rows.map((row) => ({
      id: row.id,
      candidateId: row.candidate_id,
      firstName: row.first_name,
      lastName: row.last_name,
      headline: row.headline,
      yearsExperience: row.years_experience,
      skills: row.skills,
      englishLevel: row.english_level,
      availability: row.availability,
      monthlyRateUsd: row.monthly_rate_usd,
      deleteAfter: toDateOnly(row.delete_after),
      whyPicked: row.why_picked,
      rank: row.rank,
      consentAt: toIso(row.consent_at),
      consentBy: row.consent_by_name,
      publishedAt: toIso(row.published_at),
      withdrawnAt: toIso(row.withdrawn_at),
      clientDecision: row.client_decision,
      passReason: row.pass_reason,
      decidedAt: toIso(row.decided_at),
    })),
    link: link
      ? {
          sentTo: String(link.sent_to),
          sentAt: toIso(link.created_at),
          respondBy: toDateOnly(link.respond_by),
          expiresAt: toIso(link.expires_at),
          expired: new Date(String(link.expires_at)).getTime() < Date.now() || Boolean(link.revoked_at),
          firstViewedAt: toIso(link.first_viewed_at),
          lastViewedAt: toIso(link.last_viewed_at),
          viewCount: Number(link.view_count ?? 0),
        }
      : null,
  };
};

export const addCandidate = async (db: Db, user: StaffUser, requestId: string, body: Record<string, unknown>): Promise<ApiResponse> => {
  const { input, fields } = readCandidateInput(body);
  if (!input) return invalid(fields!);
  const [row] = await db.query<{ id: string }>(
    `WITH lead AS (SELECT id FROM booking_leads WHERE id = $1),
     candidate AS (
       INSERT INTO candidates (first_name, last_name, headline, years_experience, skills, english_level,
                               availability, monthly_rate_usd, delete_after, created_by)
       SELECT $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::date, current_date + 365), $11 FROM lead
       RETURNING id
     )
     INSERT INTO request_candidates (request_id, candidate_id, rank, why_picked, consent_at, consent_by)
     SELECT $1, candidate.id,
            COALESCE((SELECT max(rank) + 1 FROM request_candidates WHERE request_id = $1), 0),
            $12, CASE WHEN $13 THEN now() END, CASE WHEN $13 THEN $11::uuid END
     FROM candidate
     RETURNING id`,
    [
      requestId,
      input.firstName,
      input.lastName,
      input.headline,
      input.yearsExperience,
      input.skills || null,
      input.englishLevel || null,
      input.availability || null,
      input.monthlyRateUsd,
      input.deleteAfter,
      user.id,
      input.whyPicked || null,
      input.consent,
    ],
  );
  return row ? ok({ ok: true, id: row.id }) : apiError(404, "not_found", "We couldn't find that request.");
};

export const updateCandidate = async (
  db: Db,
  user: StaffUser,
  requestId: string,
  entryId: string,
  body: Record<string, unknown>,
): Promise<ApiResponse> => {
  const { input, fields } = readCandidateInput(body);
  if (!input) return invalid(fields!);
  const [entry] = await db.query<{ candidate_id: string; published_at: string | null; consent_at: string | null }>(
    "SELECT candidate_id, published_at, consent_at FROM request_candidates WHERE id = $1 AND request_id = $2",
    [entryId, requestId],
  );
  if (!entry) return apiError(404, "not_found", "We couldn't find that candidate.");
  if (entry.published_at && !input.consent) {
    return invalid({ consent: "This candidate is already on the client's shortlist. Withdraw them instead." });
  }
  await db.query(
    `UPDATE candidates SET first_name = $2, last_name = $3, headline = $4, years_experience = $5, skills = $6,
       english_level = $7, availability = $8, monthly_rate_usd = $9,
       delete_after = COALESCE($10::date, delete_after), updated_at = now()
     WHERE id = $1`,
    [
      entry.candidate_id,
      input.firstName,
      input.lastName,
      input.headline,
      input.yearsExperience,
      input.skills || null,
      input.englishLevel || null,
      input.availability || null,
      input.monthlyRateUsd,
      input.deleteAfter,
    ],
  );
  // Consent keeps its first date and who recorded it; unticking clears it.
  await db.query(
    `UPDATE request_candidates SET why_picked = $2,
       consent_at = CASE WHEN $3 THEN COALESCE(consent_at, now()) END,
       consent_by = CASE WHEN $3 THEN COALESCE(consent_by, $4::uuid) END
     WHERE id = $1`,
    [entryId, input.whyPicked || null, input.consent, user.id],
  );
  return ok({ ok: true });
};

export const reorderCandidates = async (db: Db, requestId: string, body: Record<string, unknown>): Promise<ApiResponse> => {
  const order = Array.isArray(body.order) ? body.order.filter((id): id is string => typeof id === "string" && UUID_RE.test(id)) : [];
  if (order.length === 0) return apiError(400, "validation", "Nothing to reorder.");
  await db.query(
    `UPDATE request_candidates rc SET rank = o.position
     FROM unnest($2::uuid[]) WITH ORDINALITY AS o(id, position)
     WHERE rc.id = o.id AND rc.request_id = $1`,
    [requestId, order],
  );
  return ok({ ok: true });
};

// The client sees "no longer available" in place of a withdrawn candidate.
export const withdrawCandidate = async (db: Db, requestId: string, entryId: string, body: Record<string, unknown>): Promise<ApiResponse> => {
  const restore = body.restore === true;
  const rows = await db.query(
    `UPDATE request_candidates SET withdrawn_at = CASE WHEN $3 THEN NULL ELSE now() END
     WHERE id = $1 AND request_id = $2 RETURNING id`,
    [entryId, requestId, restore],
  );
  return rows.length ? ok({ ok: true }) : apiError(404, "not_found", "We couldn't find that candidate.");
};

// Candidates may be removed outright only before the client has seen them.
export const removeCandidate = async (db: Db, requestId: string, entryId: string): Promise<ApiResponse> => {
  const rows = await db.query<{ candidate_id: string }>(
    "DELETE FROM request_candidates WHERE id = $1 AND request_id = $2 AND published_at IS NULL RETURNING candidate_id",
    [entryId, requestId],
  );
  if (!rows.length) return apiError(400, "validation", "Only candidates the client hasn't seen can be removed. Withdraw them instead.");
  // The profile goes too unless another request uses it.
  await db.query(
    "DELETE FROM candidates c WHERE c.id = $1 AND NOT EXISTS (SELECT 1 FROM request_candidates WHERE candidate_id = c.id)",
    [rows[0].candidate_id],
  );
  return ok({ ok: true });
};

const PUBLISHABLE_FROM: RequestStatus[] = ["received", "clarifying", "sourcing", "shortlist_ready"];

export const publishShortlist = async (
  deps: ShortlistDeps,
  user: StaffUser,
  req: ApiRequest,
  requestId: string,
  body: Record<string, unknown>,
): Promise<ApiResponse> => {
  const siteUrl = deps.siteUrl(req);
  if (!siteUrl) return apiError(503, "internal", "Set SITE_URL so shortlist emails can link to the site.");
  const lead = await loadLead(deps.db, requestId);
  if (!lead) return apiError(404, "not_found", "We couldn't find that request.");
  const from = String(body.from ?? "");
  if (from !== lead.status) {
    return apiError(409, "stale_status", `Status was changed to ${STATUS_LABELS[lead.status]}. Reload to see the latest.`, {
      current: { status: lead.status },
    });
  }
  if (!PUBLISHABLE_FROM.includes(lead.status)) {
    return apiError(400, "validation", `Move the request back to Sourcing before publishing (it's ${STATUS_LABELS[lead.status]}).`);
  }

  const [counts] = await deps.db.query<{ ready: number; showing: number }>(
    `SELECT count(*) FILTER (WHERE published_at IS NULL AND consent_at IS NOT NULL AND withdrawn_at IS NULL)::int AS ready,
            count(*) FILTER (WHERE published_at IS NOT NULL AND withdrawn_at IS NULL
                             AND client_decision IS DISTINCT FROM 'pass')::int AS showing
     FROM request_candidates WHERE request_id = $1`,
    [requestId],
  );
  const ready = Number(counts.ready);
  const showing = Number(counts.showing);
  if (ready === 0) {
    return apiError(400, "validation", "Add a candidate and record their consent first. To send the same shortlist again, use Send a fresh link.");
  }
  if (ready + showing > MAX_SHORTLIST) {
    return apiError(400, "validation", `A shortlist shows at most ${MAX_SHORTLIST} open candidates. Withdraw some or publish fewer.`);
  }

  // Status first, as a compare-and-set, so a conflicting change stops
  // everything before the client sees anything.
  if (lead.status !== "shortlist_ready") {
    const moved = await deps.db.query(
      `WITH updated AS (
         UPDATE booking_leads SET status = 'shortlist_ready', updated_at = now() WHERE id = $1 AND status = $2 RETURNING id
       )
       INSERT INTO request_events (request_id, actor_user_id, kind, from_status, to_status, body)
       SELECT id, $3, 'status_change', $2, 'shortlist_ready', 'Shortlist published.' FROM updated
       RETURNING id`,
      [requestId, lead.status, user.id],
    );
    if (!moved.length) return apiError(409, "stale_status", "Status was just changed by someone else. Reload to see the latest.");
  }

  await deps.db.query(
    `UPDATE request_candidates SET published_at = now()
     WHERE request_id = $1 AND published_at IS NULL AND consent_at IS NOT NULL AND withdrawn_at IS NULL`,
    [requestId],
  );
  // Whoever publishes becomes the owner if there wasn't one, so the client
  // hears from a named person.
  if (!lead.owner_user_id) {
    await deps.db.query("UPDATE booking_leads SET owner_user_id = $2 WHERE id = $1 AND owner_user_id IS NULL", [requestId, user.id]);
    lead.owner_user_id = user.id;
    lead.owner_email = user.email;
    lead.owner_name = user.name;
  }

  const sent = await sendLink(deps, { ...lead, status: "shortlist_ready" }, siteUrl, {
    actor: user,
    kind: "shortlist_published",
    note: `${ready} candidate${ready === 1 ? "" : "s"} published.`,
  });
  (deps.logger ?? console).info(`${SHORTLIST_LOG.published} request=${requestId} added=${ready}`);
  return ok({ ok: true, emailStatus: sent.emailStatus, expiresAt: sent.expiresAt });
};

export const resendShortlist = async (deps: ShortlistDeps, user: StaffUser, req: ApiRequest, requestId: string): Promise<ApiResponse> => {
  const siteUrl = deps.siteUrl(req);
  if (!siteUrl) return apiError(503, "internal", "Set SITE_URL so shortlist emails can link to the site.");
  const lead = await loadLead(deps.db, requestId);
  if (!lead) return apiError(404, "not_found", "We couldn't find that request.");
  const [{ n }] = await deps.db.query<{ n: number }>(VISIBLE_COUNT_SQL, [requestId]);
  if (Number(n) === 0) return apiError(400, "validation", "Publish the shortlist first.");
  const sent = await sendLink(deps, lead, siteUrl, { actor: user, kind: "link", note: "Fresh shortlist link sent; earlier links stop working." });
  return ok({ ok: true, emailStatus: sent.emailStatus, expiresAt: sent.expiresAt });
};

// Deletes candidate profiles whose delete_after date has passed (placeholder
// retention rule, see the migration). Run on a schedule once the policy is set.
export const purgeExpiredCandidates = async (db: Db): Promise<number> =>
  (await db.query("DELETE FROM candidates WHERE delete_after < current_date RETURNING id")).length;
