import { navigate } from "../lib/router";

/*
 * Calls to /api/admin/*. Every call resolves (never throws) to either data or
 * an error with a code and a message to show. A 401 anywhere sends the person
 * to sign in and back to where they were afterwards.
 */

export interface ApiFailure {
  code: string;
  message: string;
  status: number;
  details: Record<string, unknown>;
}

// One flat shape: the tsconfig isn't strict, so a union wouldn't narrow.
// `data` is set when ok is true, `error` when it is false.
export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: ApiFailure;
}

export async function adminApi<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/admin${path}`, {
      method: options.method ?? "GET",
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, error: { code: "network", message: "Couldn't reach the server. Check your connection and try again.", status: 0, details: {} } };
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await res.json();
  } catch {
    // Not JSON (a proxy error page, for example).
  }

  if (res.ok) return { ok: true, data: payload as T };

  const error = (payload.error ?? {}) as Record<string, unknown>;
  const failure: ApiFailure = {
    code: typeof error.code === "string" ? error.code : "internal",
    message: typeof error.message === "string" ? error.message : "Something went wrong. Try again in a moment.",
    status: res.status,
    details: error,
  };
  if (res.status === 401 && !path.startsWith("/auth/") && !window.location.pathname.startsWith("/admin/sign-in")) {
    const here = `${window.location.pathname}${window.location.search}`;
    navigate("admin-sign-in", { next: here }, { replace: true });
  }
  return { ok: false, error: failure };
}

// Response shapes (mirrors api/_lib/adminApi.ts).
export interface StaffUser {
  id: string;
  email: string;
  name: string | null;
}

export interface Owner {
  id: string;
  name: string;
}

export interface InboxItem {
  id: string;
  reference: string | null;
  name: string;
  company: string;
  role: string;
  headcount: string | null;
  status: string;
  owner: Owner | null;
  createdAt: string;
  lastActivityAt: string;
  stale: boolean;
}

export interface InboxResponse {
  items: InboxItem[];
  counts: Record<string, number>;
  truncated: boolean;
}

export interface FunnelWindow {
  received: number;
  shortlisted: number;
  filled: number;
}

export interface SummaryResponse {
  last7: FunnelWindow;
  last30: FunnelWindow;
  medianHoursToShortlist: number | null;
}

export interface TimelineEvent {
  id: string;
  kind: string;
  fromStatus: string | null;
  toStatus: string | null;
  body: string | null;
  visibility: "internal" | "client";
  emailStatus: string | null;
  emailSentAt: string | null;
  createdAt: string;
  actor: Owner | null;
}

export interface RequestDetail {
  id: string;
  reference: string | null;
  status: string;
  clientStage: string | null;
  owner: Owner | null;
  stale: boolean;
  createdAt: string;
  lastActivityAt: string;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    website: string | null;
    country: string | null;
    timeZone: string | null;
  };
  role: {
    role: string;
    headcount: string | null;
    engagementType: string | null;
    startTimeframe: string | null;
    sector: string | null;
    budget: string | null;
    message: string | null;
  };
  source: {
    landingPath: string | null;
    referrer: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
  };
  internalNotifiedAt: string | null;
  events: TimelineEvent[];
}

export interface StaffCandidate {
  id: string;
  candidateId: string;
  firstName: string;
  lastName: string;
  headline: string;
  yearsExperience: number | null;
  skills: string | null;
  englishLevel: string | null;
  availability: string | null;
  monthlyRateUsd: number | null;
  deleteAfter: string | null;
  whyPicked: string | null;
  rank: number;
  consentAt: string | null;
  consentBy: string | null;
  publishedAt: string | null;
  withdrawnAt: string | null;
  clientDecision: "interview" | "pass" | null;
  passReason: string | null;
  decidedAt: string | null;
}

export interface ShortlistLinkInfo {
  sentTo: string;
  sentAt: string;
  respondBy: string | null;
  expiresAt: string;
  expired: boolean;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
}

export interface StaffShortlist {
  candidates: StaffCandidate[];
  link: ShortlistLinkInfo | null;
}
