import {
  authenticate,
  requestCode,
  signOut,
  verifyCode,
  type AuthDeps,
  type StaffUser,
} from "./auth.js";
import { displayReference } from "./booking.js";
import type { Db } from "./db.js";
import { API_HEADERS, apiError, dispatch, ok, type ApiRequest, type ApiResponse, type Route } from "./http.js";
import {
  clientStageFor,
  isOpenStatus,
  isRequestStatus,
  isStale,
  NOTE_KINDS,
  REQUEST_STATUSES,
  STATUS_LABELS,
  type RequestStatus,
} from "./requestStatus.js";
import {
  addCandidate,
  getStaffShortlist,
  publishShortlist,
  removeCandidate,
  reorderCandidates,
  resendShortlist,
  updateCandidate,
  withdrawCandidate,
  type ShortlistDeps,
} from "./shortlist.js";

/*
 * The staff inbox API, served at /api/admin/* (api/admin.ts in production,
 * the Vite dev plugin locally). Every route except the two sign-in steps
 * requires a signed-in staff member; tests pin the public list.
 */

export const ADMIN_LOG = {
  statusChanged: "Admin status changed",
  clientEmail: "Admin client update email",
  internal: "Admin request failed",
} as const;

export type ClientEmailResult = "sent" | "failed" | "skipped";

export interface ClientUpdate {
  to: string;
  clientFirstName: string;
  author: StaffUser;
  body: string;
  role: string;
  reference: string | null;
  stage: string | null;
}

export interface AdminDeps extends AuthDeps, ShortlistDeps {
  db: Db;
  sendClientUpdate: (update: ClientUpdate) => Promise<ClientEmailResult>;
  now?: () => Date;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NOTE_LENGTH = 5000;
// The inbox loads at most this many requests. Plenty for today's volume;
// paginate before it's reached.
export const INBOX_LIMIT = 1000;

const notFound = () => apiError(404, "not_found", "We couldn't find that request.");

const toIso = (value: unknown): string | null =>
  value === null || value === undefined ? null : new Date(value as string).toISOString();

interface LeadRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  role: string;
  headcount: string | null;
  status: RequestStatus;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  created_at: string;
  last_activity_at: string;
}

const LIST_SQL = `
SELECT l.id, l.first_name, l.last_name, l.email, l.company, l.role, l.headcount, l.status,
       l.owner_user_id, o.name AS owner_name, o.email AS owner_email, l.created_at,
       GREATEST(l.created_at, COALESCE(MAX(e.created_at), l.created_at)) AS last_activity_at
FROM booking_leads l
LEFT JOIN users o ON o.id = l.owner_user_id
LEFT JOIN request_events e ON e.request_id = l.id
GROUP BY l.id, o.id
ORDER BY l.created_at DESC
LIMIT ${INBOX_LIMIT}`;

const ownerOf = (row: { owner_user_id: string | null; owner_name: string | null; owner_email: string | null }) =>
  row.owner_user_id ? { id: row.owner_user_id, name: row.owner_name ?? row.owner_email ?? "Staff" } : null;

export const listRequests = async (deps: AdminDeps, user: StaffUser, query: URLSearchParams) => {
  const now = deps.now?.() ?? new Date();
  const rows = await deps.db.query<LeadRow>(LIST_SQL);
  const items = rows.map((row) => {
    const lastActivityAt = new Date(row.last_activity_at);
    return {
      id: row.id,
      reference: displayReference(row.id),
      name: `${row.first_name} ${row.last_name}`.trim(),
      company: row.company,
      role: row.role,
      headcount: row.headcount,
      status: row.status,
      owner: ownerOf(row),
      createdAt: toIso(row.created_at),
      lastActivityAt: lastActivityAt.toISOString(),
      stale: isStale(row.status, lastActivityAt, now),
    };
  });

  const counts: Record<string, number> = { open: 0, stale: 0, unassigned: 0, all: items.length };
  for (const status of REQUEST_STATUSES) counts[status] = 0;
  for (const item of items) {
    counts[item.status] += 1;
    if (isOpenStatus(item.status)) {
      counts.open += 1;
      if (!item.owner) counts.unassigned += 1;
    }
    if (item.stale) counts.stale += 1;
  }

  // status: "open" (default), "all" or one status. owner: "any" (default),
  // "me", "none" or a user id. stale: "1" for stale only.
  const status = query.get("status") ?? "open";
  const owner = query.get("owner") ?? "any";
  const staleOnly = query.get("stale") === "1";
  const filtered = items.filter((item) => {
    if (status === "open" && !isOpenStatus(item.status)) return false;
    if (status !== "open" && status !== "all" && item.status !== status) return false;
    if (owner === "me" && item.owner?.id !== user.id) return false;
    if (owner === "none" && item.owner) return false;
    if (owner !== "any" && owner !== "me" && owner !== "none" && item.owner?.id !== owner) return false;
    if (staleOnly && !item.stale) return false;
    return true;
  });

  return { items: filtered, counts, truncated: rows.length >= INBOX_LIMIT };
};

const DETAIL_SQL = `
SELECT l.*, o.name AS owner_name, o.email AS owner_email
FROM booking_leads l LEFT JOIN users o ON o.id = l.owner_user_id
WHERE l.id = $1`;

const EVENTS_SQL = `
SELECT e.id, e.kind, e.from_status, e.to_status, e.body, e.visibility, e.email_status, e.email_sent_at,
       e.created_at, e.actor_user_id, u.name AS actor_name, u.email AS actor_email
FROM request_events e LEFT JOIN users u ON u.id = e.actor_user_id
WHERE e.request_id = $1
ORDER BY e.created_at DESC, e.id`;

interface EventRow {
  id: string;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  body: string | null;
  visibility: "internal" | "client";
  email_status: string | null;
  email_sent_at: string | null;
  created_at: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
}

const eventOut = (row: EventRow) => ({
  id: row.id,
  kind: row.kind,
  fromStatus: row.from_status,
  toStatus: row.to_status,
  body: row.body,
  visibility: row.visibility,
  emailStatus: row.email_status,
  emailSentAt: toIso(row.email_sent_at),
  createdAt: toIso(row.created_at),
  actor: row.actor_user_id ? { id: row.actor_user_id, name: row.actor_name ?? row.actor_email ?? "Staff" } : null,
});

export const getRequest = async (deps: AdminDeps, id: string) => {
  if (!UUID_RE.test(id)) return null;
  const [row] = await deps.db.query<Record<string, unknown> & LeadRow>(DETAIL_SQL, [id]);
  if (!row) return null;
  const events = await deps.db.query<EventRow>(EVENTS_SQL, [id]);
  const lastActivity = new Date(
    Math.max(new Date(row.created_at).getTime(), ...events.map((e) => new Date(e.created_at).getTime())),
  );
  const text = (key: string) => (row[key] === null || row[key] === undefined ? null : String(row[key]));
  return {
    id: row.id,
    reference: displayReference(row.id),
    status: row.status,
    clientStage: clientStageFor(row.status),
    owner: ownerOf(row),
    stale: isStale(row.status, lastActivity, deps.now?.() ?? new Date()),
    createdAt: toIso(row.created_at),
    lastActivityAt: lastActivity.toISOString(),
    contact: {
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      company: row.company,
      website: text("website"),
      country: text("country"),
      timeZone: text("client_time_zone"),
    },
    role: {
      role: row.role,
      headcount: text("headcount"),
      engagementType: text("engagement_type"),
      startTimeframe: text("start_timeframe"),
      sector: text("sector"),
      budget: text("budget"),
      message: text("message"),
    },
    source: {
      landingPath: text("landing_path"),
      referrer: text("referrer"),
      utmSource: text("utm_source"),
      utmMedium: text("utm_medium"),
      utmCampaign: text("utm_campaign"),
    },
    internalNotifiedAt: toIso(row.internal_notified_at),
    events: events.map(eventOut),
  };
};

// The client-visible email for a note, then the result is recorded on the event.
const emailClient = async (deps: AdminDeps, user: StaffUser, requestId: string, eventId: string, body: string) => {
  const [lead] = await deps.db.query<{ email: string; first_name: string; role: string; status: RequestStatus }>(
    "SELECT email, first_name, role, status FROM booking_leads WHERE id = $1",
    [requestId],
  );
  if (!lead) return "failed" as ClientEmailResult;
  const result = await deps.sendClientUpdate({
    to: lead.email,
    clientFirstName: lead.first_name,
    author: user,
    body,
    role: lead.role,
    reference: displayReference(requestId),
    stage: clientStageFor(lead.status),
  });
  await deps.db.query(
    `UPDATE request_events SET email_status = $2, email_sent_at = CASE WHEN $2 = 'sent' THEN now() END WHERE id = $1`,
    [eventId, result],
  );
  if (result !== "sent") {
    (deps.logger ?? console).warn(`${ADMIN_LOG.clientEmail} ${result} request=${requestId} event=${eventId}`);
  }
  return result;
};

const readVisibility = (value: unknown) => (value === "client" ? "client" : "internal");

const noteBody = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const changeStatus = async (deps: AdminDeps, user: StaffUser, id: string, body: Record<string, unknown>): Promise<ApiResponse> => {
  if (!UUID_RE.test(id)) return notFound();
  const from = String(body.from ?? "");
  const to = String(body.to ?? "");
  if (!isRequestStatus(from) || !isRequestStatus(to)) {
    return apiError(400, "validation", "Choose a status.", { fields: { status: "Choose a status." } });
  }
  if (from === to) return apiError(400, "validation", "That's already the status.");
  const note = noteBody(body.note);
  if (note.length > MAX_NOTE_LENGTH) {
    return apiError(400, "validation", `Keep the note under ${MAX_NOTE_LENGTH} characters.`, { fields: { note: "Too long." } });
  }
  const visibility = note ? readVisibility(body.visibility) : "internal";

  // Compare-and-set and the timeline entry in one statement: the change only
  // happens if the status is still what this person saw.
  const [result] = await deps.db.query<{ event_id: string | null }>(
    `WITH updated AS (
       UPDATE booking_leads SET status = $2, updated_at = now()
       WHERE id = $1 AND status = $3
       RETURNING id
     ), event AS (
       INSERT INTO request_events (request_id, actor_user_id, kind, from_status, to_status, body, visibility)
       SELECT id, $4, 'status_change', $3, $2, $5, $6 FROM updated
       RETURNING id
     )
     SELECT (SELECT id FROM event) AS event_id`,
    [id, to, from, user.id, note || null, visibility],
  );

  if (!result?.event_id) {
    const [current] = await deps.db.query<{ status: RequestStatus; by: string | null; at: string | null }>(
      `SELECT l.status,
              (SELECT COALESCE(u.name, u.email) FROM request_events e LEFT JOIN users u ON u.id = e.actor_user_id
                WHERE e.request_id = l.id AND e.kind = 'status_change' ORDER BY e.created_at DESC LIMIT 1) AS by,
              (SELECT e.created_at FROM request_events e
                WHERE e.request_id = l.id AND e.kind = 'status_change' ORDER BY e.created_at DESC LIMIT 1) AS at
       FROM booking_leads l WHERE l.id = $1`,
      [id],
    );
    if (!current) return notFound();
    const label = STATUS_LABELS[current.status];
    return apiError(
      409,
      "stale_status",
      `Status was changed to ${label}${current.by ? ` by ${current.by}` : ""}. Reload to see the latest.`,
      { current: { status: current.status, by: current.by, at: toIso(current.at) } },
    );
  }

  (deps.logger ?? console).info(`${ADMIN_LOG.statusChanged} request=${id} from=${from} to=${to}`);
  let emailStatus: ClientEmailResult | null = null;
  if (visibility === "client") emailStatus = await emailClient(deps, user, id, result.event_id, note);
  return ok({ ok: true, eventId: result.event_id, emailStatus });
};

const addNote = async (deps: AdminDeps, user: StaffUser, id: string, body: Record<string, unknown>): Promise<ApiResponse> => {
  if (!UUID_RE.test(id)) return notFound();
  const kind = String(body.kind ?? "note");
  if (!(NOTE_KINDS as readonly string[]).includes(kind)) {
    return apiError(400, "validation", "Choose what kind of entry this is.");
  }
  const text = noteBody(body.body);
  if (!text) return apiError(400, "validation", "Write the note first.", { fields: { body: "Write the note first." } });
  if (text.length > MAX_NOTE_LENGTH) {
    return apiError(400, "validation", `Keep the note under ${MAX_NOTE_LENGTH} characters.`, { fields: { body: "Too long." } });
  }
  const visibility = readVisibility(body.visibility);

  const [event] = await deps.db.query<{ id: string }>(
    `INSERT INTO request_events (request_id, actor_user_id, kind, body, visibility)
     SELECT id, $2, $3, $4, $5 FROM booking_leads WHERE id = $1
     RETURNING id`,
    [id, user.id, kind, text, visibility],
  );
  if (!event) return notFound();

  let emailStatus: ClientEmailResult | null = null;
  if (visibility === "client") emailStatus = await emailClient(deps, user, id, event.id, text);
  return ok({ ok: true, eventId: event.id, emailStatus });
};

// Sends a client-visible entry again after its email failed.
const resendEmail = async (deps: AdminDeps, user: StaffUser, id: string, eventId: string): Promise<ApiResponse> => {
  if (!UUID_RE.test(id) || !UUID_RE.test(eventId)) return notFound();
  const [event] = await deps.db.query<{ body: string | null; email_status: string | null }>(
    // Notes and status notes only; shortlist links are resent from the shortlist.
    "SELECT body, email_status FROM request_events WHERE id = $1 AND request_id = $2 AND visibility = 'client' AND kind IN ('note', 'status_change')",
    [eventId, id],
  );
  if (!event?.body) return notFound();
  if (event.email_status === "sent") return apiError(400, "validation", "That update was already emailed.");
  const emailStatus = await emailClient(deps, user, id, eventId, event.body);
  return ok({ ok: true, eventId, emailStatus });
};

const setOwner = async (deps: AdminDeps, user: StaffUser, id: string, body: Record<string, unknown>): Promise<ApiResponse> => {
  if (!UUID_RE.test(id)) return notFound();
  const ownerId = body.ownerId === null || body.ownerId === "" ? null : String(body.ownerId ?? "");
  if (ownerId !== null) {
    const [staff] = UUID_RE.test(ownerId)
      ? await deps.db.query("SELECT 1 FROM users WHERE id = $1 AND is_staff", [ownerId])
      : [];
    if (!staff) return apiError(400, "validation", "Choose someone on the team.");
  }

  // Owner and timeline entry in one statement; nothing is recorded if the
  // owner didn't change.
  const [result] = await deps.db.query<{ found: boolean; event_id: string | null }>(
    `WITH lead AS (
       SELECT id, owner_user_id FROM booking_leads WHERE id = $1 FOR UPDATE
     ), updated AS (
       UPDATE booking_leads l SET owner_user_id = $2, updated_at = now()
       FROM lead WHERE l.id = lead.id AND lead.owner_user_id IS DISTINCT FROM $2::uuid
       RETURNING l.id
     ), event AS (
       INSERT INTO request_events (request_id, actor_user_id, kind, body)
       SELECT updated.id, $3, 'owner_change',
              COALESCE((SELECT COALESCE(name, email) FROM users WHERE id = $2::uuid), 'Nobody')
       FROM updated
       RETURNING id
     )
     SELECT EXISTS (SELECT 1 FROM lead) AS found, (SELECT id FROM event) AS event_id`,
    [id, ownerId, user.id],
  );
  if (!result?.found) return notFound();
  return ok({ ok: true, eventId: result.event_id });
};

// Requests received, shortlisted and filled over the last 7 and 30 days, and
// the median time from request to shortlist.
export const summary = async (deps: AdminDeps) => {
  const now = deps.now?.() ?? new Date();
  const [row] = await deps.db.query<Record<string, string | number | null>>(
    `WITH firsts AS (
       SELECT l.id, l.created_at,
              MIN(e.created_at) FILTER (WHERE e.to_status = 'shortlist_ready') AS shortlisted_at,
              MIN(e.created_at) FILTER (WHERE e.to_status = 'filled') AS filled_at
       FROM booking_leads l LEFT JOIN request_events e ON e.request_id = l.id AND e.kind = 'status_change'
       GROUP BY l.id
     )
     SELECT
       COUNT(*) FILTER (WHERE created_at > $1::timestamptz - interval '7 days') AS received_7,
       COUNT(*) FILTER (WHERE created_at > $1::timestamptz - interval '30 days') AS received_30,
       COUNT(*) FILTER (WHERE shortlisted_at > $1::timestamptz - interval '7 days') AS shortlisted_7,
       COUNT(*) FILTER (WHERE shortlisted_at > $1::timestamptz - interval '30 days') AS shortlisted_30,
       COUNT(*) FILTER (WHERE filled_at > $1::timestamptz - interval '7 days') AS filled_7,
       COUNT(*) FILTER (WHERE filled_at > $1::timestamptz - interval '30 days') AS filled_30,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM shortlisted_at - created_at))
         FILTER (WHERE shortlisted_at > $1::timestamptz - interval '30 days') AS median_shortlist_seconds
     FROM firsts`,
    [now.toISOString()],
  );
  const n = (key: string) => Number(row?.[key] ?? 0);
  const median = row?.median_shortlist_seconds;
  return {
    last7: { received: n("received_7"), shortlisted: n("shortlisted_7"), filled: n("filled_7") },
    last30: { received: n("received_30"), shortlisted: n("shortlisted_30"), filled: n("filled_30") },
    medianHoursToShortlist: median === null || median === undefined ? null : Math.round(Number(median) / 360) / 10,
  };
};

const staffList = async (deps: AdminDeps) =>
  deps.db.query<StaffUser>("SELECT id, email, name FROM users WHERE is_staff ORDER BY COALESCE(name, email)");

const ids = (params: Record<string, string>) => UUID_RE.test(params.id) && UUID_RE.test(params.entryId);

const bodyOf = (req: ApiRequest): Record<string, unknown> =>
  req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};

export const adminRoutes = (deps: AdminDeps): Route<StaffUser>[] => [
  { method: "POST", path: "/auth/request-code", auth: "public", handler: ({ req }) => requestCode(req, deps) },
  { method: "POST", path: "/auth/verify", auth: "public", handler: ({ req }) => verifyCode(req, deps) },
  { method: "POST", path: "/auth/sign-out", auth: "staff", handler: ({ req }) => signOut(req, deps) },
  { method: "GET", path: "/me", auth: "staff", handler: async ({ user }) => ok({ user }) },
  { method: "GET", path: "/staff", auth: "staff", handler: async () => ok({ staff: await staffList(deps) }) },
  { method: "GET", path: "/summary", auth: "staff", handler: async () => ok(await summary(deps)) },
  {
    method: "GET",
    path: "/requests",
    auth: "staff",
    handler: async ({ req, user }) => ok(await listRequests(deps, user!, req.query)),
  },
  {
    method: "GET",
    path: "/requests/:id",
    auth: "staff",
    handler: async ({ params }) => {
      const request = await getRequest(deps, params.id);
      return request ? ok({ request }) : notFound();
    },
  },
  {
    method: "POST",
    path: "/requests/:id/status",
    auth: "staff",
    handler: ({ req, user, params }) => changeStatus(deps, user!, params.id, bodyOf(req)),
  },
  {
    method: "POST",
    path: "/requests/:id/notes",
    auth: "staff",
    handler: ({ req, user, params }) => addNote(deps, user!, params.id, bodyOf(req)),
  },
  {
    method: "POST",
    path: "/requests/:id/owner",
    auth: "staff",
    handler: ({ req, user, params }) => setOwner(deps, user!, params.id, bodyOf(req)),
  },
  // Shortlist (Phase 4). Ids are checked before they reach SQL.
  {
    method: "GET",
    path: "/requests/:id/shortlist",
    auth: "staff",
    handler: async ({ params }) => (UUID_RE.test(params.id) ? ok(await getStaffShortlist(deps.db, params.id)) : notFound()),
  },
  {
    method: "POST",
    path: "/requests/:id/candidates",
    auth: "staff",
    handler: ({ req, user, params }) => (UUID_RE.test(params.id) ? addCandidate(deps.db, user!, params.id, bodyOf(req)) : Promise.resolve(notFound())),
  },
  {
    method: "POST",
    path: "/requests/:id/candidates/:entryId",
    auth: "staff",
    handler: ({ req, user, params }) =>
      ids(params) ? updateCandidate(deps.db, user!, params.id, params.entryId, bodyOf(req)) : Promise.resolve(notFound()),
  },
  {
    method: "POST",
    path: "/requests/:id/candidates/:entryId/withdraw",
    auth: "staff",
    handler: ({ req, params }) => (ids(params) ? withdrawCandidate(deps.db, params.id, params.entryId, bodyOf(req)) : Promise.resolve(notFound())),
  },
  {
    method: "POST",
    path: "/requests/:id/candidates/:entryId/remove",
    auth: "staff",
    handler: ({ params }) => (ids(params) ? removeCandidate(deps.db, params.id, params.entryId) : Promise.resolve(notFound())),
  },
  {
    method: "POST",
    path: "/requests/:id/shortlist/order",
    auth: "staff",
    handler: ({ req, params }) => (UUID_RE.test(params.id) ? reorderCandidates(deps.db, params.id, bodyOf(req)) : Promise.resolve(notFound())),
  },
  {
    method: "POST",
    path: "/requests/:id/shortlist/publish",
    auth: "staff",
    handler: ({ req, user, params }) =>
      UUID_RE.test(params.id) ? publishShortlist(deps, user!, req, params.id, bodyOf(req)) : Promise.resolve(notFound()),
  },
  {
    method: "POST",
    path: "/requests/:id/shortlist/resend",
    auth: "staff",
    handler: ({ req, user, params }) => (UUID_RE.test(params.id) ? resendShortlist(deps, user!, req, params.id) : Promise.resolve(notFound())),
  },
  {
    method: "POST",
    path: "/requests/:id/events/:eventId/resend",
    auth: "staff",
    handler: ({ user, params }) => resendEmail(deps, user!, params.id, params.eventId),
  },
];

// The whole area is off unless FEATURE_ADMIN=1, except in local development.
export const adminEnabled = (env = process.env): boolean =>
  env.FEATURE_ADMIN === "1" || (env.NODE_ENV !== "production" && !env.VERCEL_ENV);

export const handleAdminRequest = async (req: ApiRequest, deps: AdminDeps): Promise<ApiResponse> => {
  try {
    return await dispatch(adminRoutes(deps), req, (r) => authenticate(r, deps));
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    (deps.logger ?? console).warn(`${ADMIN_LOG.internal} path=${req.path} cause=${reason}`);
    return apiError(500, "internal", "Something went wrong. Try again in a moment.", {}, API_HEADERS);
  }
};
