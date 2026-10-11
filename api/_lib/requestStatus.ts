// The one list of job request statuses. The database CHECK constraint in
// db/migrations/0001_request_columns.sql must match REQUEST_STATUSES (a test
// checks this). Browser-safe: no Node or network code.
//
//   received ─▶ clarifying ─▶ sourcing ─▶ shortlist_ready ─▶ interviewing ─▶ filled
//       │            │             │              │                │
//       └────────────┴─────────────┴──────────────┴────────────────┴─▶ on_hold / closed

export const REQUEST_STATUSES = [
  "received",
  "clarifying",
  "sourcing",
  "shortlist_ready",
  "interviewing",
  "filled",
  "on_hold",
  "closed",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

// Staff-facing names, in the order the inbox shows them.
export const STATUS_LABELS: Record<RequestStatus, string> = {
  received: "Received",
  clarifying: "Clarifying",
  sourcing: "Sourcing",
  shortlist_ready: "Shortlist ready",
  interviewing: "Interviewing",
  filled: "Filled",
  on_hold: "On hold",
  closed: "Closed",
};

export const isRequestStatus = (value: string): value is RequestStatus =>
  (REQUEST_STATUSES as readonly string[]).includes(value);

// "Open" means still being worked on.
export const isOpenStatus = (status: RequestStatus): boolean =>
  status !== "filled" && status !== "closed";

// What a client sees. Clarifying, on hold and closed show a note from the
// team instead of a stage (see docs/PORTAL-ARCHITECTURE.md, section 8).
export const CLIENT_STAGES = [
  "Received",
  "Finding candidates",
  "Shortlist ready",
  "Interviews",
  "Hired",
] as const;

export type ClientStage = (typeof CLIENT_STAGES)[number];

export const clientStageFor = (status: RequestStatus): ClientStage | null => {
  switch (status) {
    case "received":
      return "Received";
    case "clarifying":
    case "sourcing":
      return "Finding candidates";
    case "shortlist_ready":
      return "Shortlist ready";
    case "interviewing":
      return "Interviews";
    case "filled":
      return "Hired";
    default:
      return null;
  }
};

export const REQUEST_EVENT_KINDS = [
  "status_change",
  "note",
  "status_inquiry",
  "discovery_call",
  "link",
  "owner_change",
  "shortlist_published",
  "shortlist_viewed",
  "client_choices",
] as const;

export type RequestEventKind = (typeof REQUEST_EVENT_KINDS)[number];

// Kinds staff can add by hand from the request page (status changes go
// through their own action).
export const NOTE_KINDS = ["note", "discovery_call", "status_inquiry"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  note: "Note",
  discovery_call: "Discovery call",
  status_inquiry: "Client asked for an update",
};

// A request is stale when it's open and nobody has touched it for this many
// business days (Monday to Friday on the Manila calendar, where the team
// works). Philippine public holidays are not counted yet.
export const STALE_BUSINESS_DAYS = 3;

// Manila is UTC+8 all year (no daylight saving).
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// Whole business days from `from` to `to`: weekdays after `from`'s Manila date,
// up to and including `to`'s.
export const businessDaysBetween = (from: Date, to: Date): number => {
  const day = 24 * 60 * 60 * 1000;
  const manilaDate = (date: Date) => {
    const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  };
  const start = manilaDate(from);
  const end = manilaDate(to);
  let count = 0;
  for (let t = start + day; t <= end; t += day) {
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
};

export const isStale = (status: RequestStatus, lastActivity: Date, now: Date): boolean =>
  isOpenStatus(status) && businessDaysBetween(lastActivity, now) >= STALE_BUSINESS_DAYS;

// Shortlists (Phase 4).
export const ENGLISH_LEVELS = ["Conversational", "Professional", "Fluent", "Near-native"] as const;

export const MAX_SHORTLIST = 5;
export const SHORTLIST_LINK_DAYS = 14;
// "Please reply by": this many calendar days after the link is sent.
export const SHORTLIST_RESPOND_DAYS = 5;

// The client's choices can change until staff move the request on.
export const shortlistOpenFor = (status: RequestStatus): boolean => status === "shortlist_ready";

// "Maria S.": what clients see of a candidate's name.
export const displayName = (firstName: string, lastName: string): string => {
  const initial = lastName.trim().charAt(0).toUpperCase();
  return initial ? `${firstName.trim()} ${initial}.` : firstName.trim();
};
