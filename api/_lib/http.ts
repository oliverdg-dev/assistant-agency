import type { IncomingMessage, ServerResponse } from "node:http";

/*
 * A small route table for the JSON APIs behind signed-in areas (today: the
 * staff inbox). The booking form keeps its own handler (api/_lib/bookingApi.ts).
 *
 *   request ─▶ match method + path ─▶ auth check (route.auth is required)
 *                 │404                    │401 / 403
 *                 ▼                       ▼
 *             handler(ctx) ─▶ { status, body, headers, cookies }
 *
 * Every response is JSON, never cached, never indexed. Errors use one shape:
 * { error: { code, message, ...details } }.
 */

export interface ApiRequest {
  method: string;
  // Path inside the API area, always starting with "/", e.g. "/requests/abc".
  path: string;
  query: URLSearchParams;
  // Lower-case header names.
  headers: Record<string, string | undefined>;
  body: unknown;
  ip: string;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  cookies?: string[];
}

// "staff": a signed-in staff member. "link": someone who opened a private
// shortlist link (api/_lib/shortlistApi.ts).
export type RouteAuth = "public" | "staff" | "link";

export interface RouteContext<User> {
  req: ApiRequest;
  params: Record<string, string>;
  user: User | null;
}

export interface Route<User> {
  method: "GET" | "POST";
  // Segments starting with ":" are parameters, e.g. "/requests/:id".
  path: string;
  // Required on purpose: a public route is always an explicit choice.
  auth: RouteAuth;
  handler: (ctx: RouteContext<User>) => Promise<ApiResponse>;
}

export const apiError = (
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
  headers?: Record<string, string>,
): ApiResponse => ({ status, body: { error: { code, message, ...details } }, headers });

export const ok = (body: unknown, extra: Partial<ApiResponse> = {}): ApiResponse => ({ status: 200, body, ...extra });

const matchPath = (pattern: string, path: string): Record<string, string> | null => {
  const want = pattern.split("/").filter(Boolean);
  const got = path.split("/").filter(Boolean);
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i += 1) {
    if (want[i].startsWith(":")) {
      params[want[i].slice(1)] = decodeURIComponent(got[i]);
    } else if (want[i] !== got[i]) {
      return null;
    }
  }
  return params;
};

// Cross-site form posts can't forge a JSON request with a matching Origin, and
// the session cookie is SameSite=Lax; this check closes the remaining gap.
const sameOrigin = (req: ApiRequest): boolean => {
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

export const API_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  "Content-Security-Policy": "frame-ancestors 'none'",
};

export const dispatch = async <User>(
  routes: Route<User>[],
  req: ApiRequest,
  authenticate: (req: ApiRequest) => Promise<User | null>,
  unauthorized: () => ApiResponse = () => apiError(401, "auth_required", "Please sign in."),
): Promise<ApiResponse> => {
  const result = await (async () => {
    const candidates = routes
      .map((route) => ({ route, params: matchPath(route.path, req.path) }))
      .filter((entry) => entry.params !== null);
    if (candidates.length === 0) return apiError(404, "not_found", "Not found.");
    const match = candidates.find((entry) => entry.route.method === req.method);
    if (!match) {
      return apiError(405, "method_not_allowed", "Method not allowed.", {}, {
        Allow: candidates.map((entry) => entry.route.method).join(", "),
      });
    }
    if (req.method !== "GET" && !sameOrigin(req)) {
      return apiError(403, "forbidden", "This request must come from the site itself.");
    }
    let user: User | null = null;
    if (match.route.auth !== "public") {
      user = await authenticate(req);
      if (!user) return unauthorized();
    }
    return match.route.handler({ req, params: match.params ?? {}, user });
  })();
  return { ...result, headers: { ...API_HEADERS, ...result.headers } };
};

// ---------------------------------------------------------------------------
// Node adapter, shared by the Vercel function and the Vite dev server.
// ---------------------------------------------------------------------------

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

const MAX_BODY_BYTES = 64 * 1024;

// `pathFrom: "query"` reads the path from ?path= (Vercel rewrites
// /api/admin/x/y to /api/admin?path=x/y); "url" uses the URL after the
// mount point (Vite's middleware strips it).
export const toApiRequest = async (
  req: IncomingMessage,
  pathFrom: "query" | "url",
): Promise<ApiRequest | ApiResponse> => {
  const url = new URL(req.url ?? "/", "http://local");
  const query = new URLSearchParams(url.search);
  let path = url.pathname;
  if (pathFrom === "query") {
    path = `/${query.get("path") ?? ""}`;
    query.delete("path");
  }
  const headers: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    headers[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }
  let body: unknown = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const text = await readBody(req);
    if (text.length > MAX_BODY_BYTES) return apiError(413, "validation", "Request too large.");
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        return apiError(400, "validation", "We couldn't read that request.");
      }
    }
  }
  const ip = headers["x-real-ip"] ?? headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? "unknown";
  return { method: req.method ?? "GET", path: path.replace(/\/+$/, "") || "/", query, headers, body, ip };
};

export const writeApiResponse = (res: ServerResponse, result: ApiResponse) => {
  res.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, value);
  if (result.cookies?.length) res.setHeader("Set-Cookie", result.cookies);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(result.body ?? {}));
};

export const parseCookies = (header: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (name) cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
};
