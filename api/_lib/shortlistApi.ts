import { hashToken, hitRateLimit, newToken } from "./auth.js";
import { displayReference } from "./booking.js";
import { API_HEADERS, apiError, dispatch, ok, parseCookies, type ApiRequest, type ApiResponse, type Route } from "./http.js";
import { displayName, shortlistOpenFor, type RequestStatus } from "./requestStatus.js";
import {
  loadLead,
  maskEmail,
  sendLink,
  SHORTLIST_LOG,
  toDateOnly,
  toIso,
  UUID_RE,
  type ShortlistDeps,
} from "./shortlist.js";

/*
 * The client's side of a shortlist, served at /api/shortlist/*.
 *
 *   POST /open     { token }  ─▶ cookie for this shortlist (12 h), view counted
 *   GET  /                    ─▶ the shortlist
 *   POST /decision            ─▶ interview / pass for one candidate, saved at once
 *   POST /submit              ─▶ tells the owner; all passed ─▶ back to Sourcing
 *   POST /refresh  { token }  ─▶ a fresh link to the address on file
 *
 * Nothing is verified when the page loads: the page asks the person to press
 * Continue, so email scanners that open every link can't count views.
 */

export const SHORTLIST_COOKIE = "shortlist_session";
const SESSION_HOURS = 12;
const MAX_REASON = 500;

export interface ShortlistAccess {
  linkId: string;
  requestId: string;
}

export interface ShortlistApiDeps extends ShortlistDeps {
  secureCookies: boolean;
}

const cookie = (token: string, secure: boolean, maxAge: number) =>
  [`${SHORTLIST_COOKIE}=${token}`, "Path=/api/shortlist", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`, secure ? "Secure" : ""]
    .filter(Boolean)
    .join("; ");

const linkInvalid = () =>
  apiError(404, "link_invalid", "This link isn't valid. Check you used the whole link from the email, or reply to that email and we'll help.");

const readToken = (body: unknown) => {
  const token = (body as { token?: unknown } | undefined)?.token;
  return typeof token === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : null;
};

const openLink = async (req: ApiRequest, deps: ShortlistApiDeps): Promise<ApiResponse> => {
  const token = readToken(req.body);
  if (!(await hitRateLimit(deps.db, `shortlist:open:ip:${req.ip}`, { max: 60, windowSeconds: 15 * 60 }))) {
    return apiError(429, "rate_limited", "Too many attempts. Wait a few minutes and try again.", {}, { "Retry-After": "900" });
  }
  if (!token) return linkInvalid();
  const [link] = await deps.db.query<{ id: string; request_id: string; sent_to: string; expired: boolean; revoked: boolean; first_viewed_at: string | null }>(
    `SELECT id, request_id, sent_to, expires_at < now() AS expired, revoked_at IS NOT NULL AS revoked, first_viewed_at
     FROM shortlist_links WHERE token_hash = $1`,
    [hashToken(token)],
  );
  if (!link) return linkInvalid();
  if (link.expired || link.revoked) {
    return apiError(
      410,
      "link_expired",
      link.revoked ? "A newer link replaced this one. Use the latest email, or get a fresh link." : "This link has expired.",
      { sentTo: maskEmail(link.sent_to) },
    );
  }

  const session = newToken();
  await deps.db.query(
    `INSERT INTO shortlist_sessions (link_id, token_hash, expires_at)
     VALUES ($1, $2, LEAST(now() + make_interval(hours => $3), (SELECT expires_at FROM shortlist_links WHERE id = $1)))`,
    [link.id, hashToken(session), SESSION_HOURS],
  );
  await deps.db.query(
    `UPDATE shortlist_links SET view_count = view_count + 1, last_viewed_at = now(),
       first_viewed_at = COALESCE(first_viewed_at, now()) WHERE id = $1`,
    [link.id],
  );
  if (!link.first_viewed_at) {
    await deps.db.query("INSERT INTO request_events (request_id, kind, body) VALUES ($1, 'shortlist_viewed', 'The client opened the shortlist.')", [
      link.request_id,
    ]);
  }
  return ok({ ok: true }, { cookies: [cookie(session, deps.secureCookies, SESSION_HOURS * 60 * 60)] });
};

// The same answer whatever the token, so it can't be used to probe links.
export const REFRESH_MESSAGE = "If that link was ours, a fresh one is on its way to the email address we have for this request.";

const refreshLink = async (req: ApiRequest, deps: ShortlistApiDeps): Promise<ApiResponse> => {
  const answer = ok({ ok: true, message: REFRESH_MESSAGE });
  if (!(await hitRateLimit(deps.db, `shortlist:refresh:ip:${req.ip}`, { max: 10, windowSeconds: 15 * 60 }))) {
    return apiError(429, "rate_limited", "Too many attempts. Wait a few minutes and try again.", {}, { "Retry-After": "900" });
  }
  const token = readToken(req.body);
  if (!token) return answer;
  const [link] = await deps.db.query<{ request_id: string }>("SELECT request_id FROM shortlist_links WHERE token_hash = $1", [hashToken(token)]);
  if (!link) return answer;
  // At most three fresh links per request per day, however many old links exist.
  if (!(await hitRateLimit(deps.db, `shortlist:refresh:request:${link.request_id}`, { max: 3, windowSeconds: 24 * 60 * 60 }))) return answer;
  const lead = await loadLead(deps.db, link.request_id);
  const siteUrl = deps.siteUrl(req);
  if (!lead || !siteUrl || !shortlistOpenFor(lead.status)) return answer;
  await sendLink(deps, lead, siteUrl, { actor: null, kind: "link", note: "The client asked for a fresh link; earlier links stop working." });
  return answer;
};

export const authenticateLink = async (req: ApiRequest, deps: ShortlistApiDeps): Promise<ShortlistAccess | null> => {
  const token = parseCookies(req.headers.cookie)[SHORTLIST_COOKIE];
  if (!token || token.length > 100) return null;
  const [row] = await deps.db.query<{ link_id: string; request_id: string }>(
    `SELECT s.link_id, l.request_id
     FROM shortlist_sessions s JOIN shortlist_links l ON l.id = s.link_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND l.revoked_at IS NULL AND l.expires_at > now()`,
    [hashToken(token)],
  );
  return row ? { linkId: row.link_id, requestId: row.request_id } : null;
};

interface ClientCandidateRow {
  id: string;
  first_name: string;
  last_name: string;
  headline: string;
  years_experience: number | null;
  skills: string | null;
  english_level: string | null;
  availability: string | null;
  monthly_rate_usd: number | null;
  why_picked: string | null;
  withdrawn_at: string | null;
  client_decision: "interview" | "pass" | null;
  pass_reason: string | null;
}

// What the client sees. Never the last name, contact details, consent records
// or retention dates.
const CLIENT_CANDIDATES_SQL = `
SELECT rc.id, c.first_name, c.last_name, c.headline, c.years_experience, c.skills, c.english_level,
       c.availability, c.monthly_rate_usd, rc.why_picked, rc.withdrawn_at, rc.client_decision, rc.pass_reason
FROM request_candidates rc JOIN candidates c ON c.id = rc.candidate_id
WHERE rc.request_id = $1 AND rc.published_at IS NOT NULL
ORDER BY rc.rank, rc.created_at`;

export const getClientShortlist = async (deps: ShortlistApiDeps, access: ShortlistAccess) => {
  const lead = await loadLead(deps.db, access.requestId);
  if (!lead) return null;
  const [link] = await deps.db.query<{ respond_by: unknown; expires_at: unknown }>(
    "SELECT respond_by, expires_at FROM shortlist_links WHERE id = $1",
    [access.linkId],
  );
  const [submitted] = await deps.db.query<{ created_at: string }>(
    "SELECT created_at FROM request_events WHERE request_id = $1 AND kind = 'client_choices' ORDER BY created_at DESC LIMIT 1",
    [access.requestId],
  );
  const rows = await deps.db.query<ClientCandidateRow>(CLIENT_CANDIDATES_SQL, [access.requestId]);
  return {
    role: lead.role,
    company: lead.company,
    clientFirstName: lead.first_name,
    reference: displayReference(lead.id),
    owner: lead.owner_user_id ? { name: lead.owner_name ?? lead.owner_email ?? "Your account manager" } : null,
    respondBy: toDateOnly(link?.respond_by),
    expiresAt: toIso(link?.expires_at),
    open: shortlistOpenFor(lead.status),
    status: lead.status,
    submittedAt: toIso(submitted?.created_at),
    candidates: rows.map((row) => ({
      id: row.id,
      name: displayName(row.first_name, row.last_name),
      headline: row.headline,
      yearsExperience: row.years_experience,
      skills: (row.skills ?? "")
        .split(/[,\n]/)
        .map((skill) => skill.trim())
        .filter(Boolean),
      englishLevel: row.english_level,
      availability: row.availability,
      monthlyRateUsd: row.monthly_rate_usd,
      whyPicked: row.why_picked,
      withdrawn: Boolean(row.withdrawn_at),
      decision: row.withdrawn_at ? null : row.client_decision,
      passReason: row.withdrawn_at ? null : row.pass_reason,
    })),
  };
};

const closedMessage = (status: RequestStatus) =>
  status === "interviewing" || status === "filled"
    ? "The team has already moved on to interviews, so choices can't be changed here. Reply to their email to change anything."
    : "This shortlist is closed for changes. Reply to the team's email if you'd like to change anything.";

const decide = async (req: ApiRequest, deps: ShortlistApiDeps, access: ShortlistAccess): Promise<ApiResponse> => {
  const body = (req.body ?? {}) as { candidateId?: unknown; decision?: unknown; reason?: unknown };
  const candidateId = typeof body.candidateId === "string" && UUID_RE.test(body.candidateId) ? body.candidateId : null;
  const decision = body.decision === "interview" || body.decision === "pass" ? body.decision : body.decision === null ? null : undefined;
  if (!candidateId || decision === undefined) return apiError(400, "validation", "Choose Interview or Pass.");
  const reason = decision === "pass" && typeof body.reason === "string" ? body.reason.trim().slice(0, MAX_REASON) : "";

  // Saved only while the shortlist is open, for a candidate on it.
  const rows = await deps.db.query(
    `UPDATE request_candidates rc SET client_decision = $3, pass_reason = $4, decided_at = CASE WHEN $3::text IS NULL THEN NULL ELSE now() END
     FROM booking_leads l
     WHERE rc.id = $1 AND rc.request_id = $2 AND l.id = rc.request_id AND l.status = 'shortlist_ready'
       AND rc.published_at IS NOT NULL AND rc.withdrawn_at IS NULL
     RETURNING rc.id`,
    [candidateId, access.requestId, decision, reason || null],
  );
  if (rows.length) return ok({ ok: true });

  const lead = await loadLead(deps.db, access.requestId);
  if (lead && !shortlistOpenFor(lead.status)) return apiError(409, "shortlist_closed", closedMessage(lead.status));
  return apiError(409, "candidate_unavailable", "This candidate is no longer available.");
};

const submit = async (req: ApiRequest, deps: ShortlistApiDeps, access: ShortlistAccess): Promise<ApiResponse> => {
  const lead = await loadLead(deps.db, access.requestId);
  if (!lead) return apiError(404, "link_invalid", "This link isn't valid.");
  if (!shortlistOpenFor(lead.status)) return apiError(409, "shortlist_closed", closedMessage(lead.status));
  const rows = (await deps.db.query<ClientCandidateRow>(CLIENT_CANDIDATES_SQL, [access.requestId])).filter((row) => !row.withdrawn_at);
  if (rows.length === 0) return apiError(409, "candidate_unavailable", "There's no one on this shortlist right now.");
  const undecided = rows.filter((row) => !row.client_decision);
  if (undecided.length) {
    return apiError(400, "validation", `Choose Interview or Pass for ${undecided.length === 1 ? "the last candidate" : `the ${undecided.length} remaining candidates`} first.`);
  }

  const choices = rows.map((row) => ({
    name: displayName(row.first_name, row.last_name),
    decision: row.client_decision!,
    reason: row.pass_reason,
  }));
  const allPassed = choices.every((choice) => choice.decision === "pass");
  const summary = choices
    .map((choice) => `${choice.name}: ${choice.decision === "interview" ? "interview" : `pass${choice.reason ? ` (${choice.reason})` : ""}`}`)
    .join("\n");

  // Everyone passed: the request goes back to Sourcing (compare-and-set, so a
  // staff change made meanwhile wins).
  if (allPassed) {
    await deps.db.query(
      `WITH updated AS (
         UPDATE booking_leads SET status = 'sourcing', updated_at = now() WHERE id = $1 AND status = 'shortlist_ready' RETURNING id
       )
       INSERT INTO request_events (request_id, kind, from_status, to_status, body)
       SELECT id, 'status_change', 'shortlist_ready', 'sourcing', 'The client passed on every candidate.' FROM updated`,
      [access.requestId],
    );
  }

  const siteUrl = deps.siteUrl(req);
  const result = await deps.sendShortlistChoices({
    to: lead.owner_email ?? "",
    ownerName: lead.owner_name,
    clientName: lead.first_name,
    clientEmail: lead.email,
    company: lead.company,
    role: lead.role,
    requestUrl: siteUrl ? `${siteUrl}/admin/requests/${lead.id}` : null,
    choices,
    allPassed,
  });
  await deps.db.query(
    `INSERT INTO request_events (request_id, kind, body, email_status, email_sent_at)
     VALUES ($1, 'client_choices', $2, $3, CASE WHEN $3 = 'sent' THEN now() END)`,
    [access.requestId, summary, result],
  );
  (deps.logger ?? console).info(`${SHORTLIST_LOG.choices} request=${access.requestId} interview=${choices.filter((c) => c.decision === "interview").length} pass=${choices.filter((c) => c.decision === "pass").length}`);
  return ok({ ok: true, allPassed });
};

export const shortlistRoutes = (deps: ShortlistApiDeps): Route<ShortlistAccess>[] => [
  { method: "POST", path: "/open", auth: "public", handler: ({ req }) => openLink(req, deps) },
  { method: "POST", path: "/refresh", auth: "public", handler: ({ req }) => refreshLink(req, deps) },
  {
    method: "GET",
    path: "/",
    auth: "link",
    handler: async ({ user }) => {
      const shortlist = await getClientShortlist(deps, user!);
      return shortlist ? ok({ shortlist }) : linkInvalid();
    },
  },
  { method: "POST", path: "/decision", auth: "link", handler: ({ req, user }) => decide(req, deps, user!) },
  { method: "POST", path: "/submit", auth: "link", handler: ({ req, user }) => submit(req, deps, user!) },
];

// Off unless FEATURE_SHORTLIST=1, except in local development.
export const shortlistEnabled = (env = process.env): boolean =>
  env.FEATURE_SHORTLIST === "1" || (env.NODE_ENV !== "production" && !env.VERCEL_ENV);

export const handleShortlistRequest = async (req: ApiRequest, deps: ShortlistApiDeps): Promise<ApiResponse> => {
  try {
    return await dispatch(shortlistRoutes(deps), req, (r) => authenticateLink(r, deps), () =>
      apiError(401, "link_required", "Open the shortlist link from your email again."),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    (deps.logger ?? console).warn(`Shortlist request failed path=${req.path} cause=${reason}`);
    return apiError(500, "internal", "Something went wrong. Try again in a moment.", {}, API_HEADERS);
  }
};
