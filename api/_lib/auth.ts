import { createHash, randomBytes, randomInt } from "node:crypto";
import type { Db } from "./db.js";
import { apiError, ok, parseCookies, type ApiRequest, type ApiResponse } from "./http.js";

/*
 * Staff sign-in with emailed one-time codes. No passwords.
 *
 *   email ─▶ request-code ─▶ (staff on an allowed domain?) ─▶ 6-digit code by email
 *                               └─ anyone else: same answer, nothing sent
 *   code  ─▶ verify ─▶ session cookie (httpOnly, 7 days) ─▶ /api/admin/*
 *
 * Codes: 15 minutes, 5 tries, single use, a new code cancels older ones.
 * Only hashes of codes and session tokens are stored.
 */

export interface StaffUser {
  id: string;
  email: string;
  name: string | null;
}

export const SESSION_COOKIE = "staff_session";
export const CODE_TTL_MINUTES = 15;
export const CODE_MAX_ATTEMPTS = 5;
export const SESSION_DAYS = 7;

// Fixed-window limits. Counted per key in the rate_limits table.
export const RATE_LIMITS = {
  codePerEmail: { max: 5, windowSeconds: 15 * 60 },
  codePerIp: { max: 20, windowSeconds: 15 * 60 },
  verifyPerIp: { max: 30, windowSeconds: 15 * 60 },
} as const;

export const AUTH_LOG = {
  codeSent: "Staff sign-in code sent",
  codeEmailFailed: "Staff sign-in code email failed",
  signedIn: "Staff signed in",
  rateLimited: "Staff sign-in rate limited",
} as const;

export interface AuthDeps {
  db: Db;
  // Delivers the code. Returns false when the email could not be sent.
  sendCode: (user: StaffUser, code: string) => Promise<boolean>;
  staffDomains: string[];
  secureCookies: boolean;
  logger?: { info: (message: string) => void; warn: (message: string) => void };
}

export const DEFAULT_STAFF_DOMAINS = ["hendersonassociates.ca"];

export const staffDomainsFromEnv = (env = process.env): string[] => {
  const list = (env.STAFF_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_STAFF_DOMAINS;
};

export const normalizeEmail = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onStaffDomain = (email: string, domains: string[]): boolean => {
  const domain = email.split("@")[1] ?? "";
  return domains.includes(domain);
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// The email is part of the hash so a code only works for the address it was sent to.
export const hashCode = (email: string, code: string) => sha256(`${email}:${code}`);
export const hashToken = (token: string) => sha256(token);
// 32 random bytes, URL-safe. Used for sessions and private links.
export const newToken = () => randomBytes(32).toString("base64url");

// Returns true while the key is within its limit.
export const hitRateLimit = async (
  db: Db,
  key: string,
  limit: { max: number; windowSeconds: number },
): Promise<boolean> => {
  const [row] = await db.query<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES ($1, to_timestamp(floor(extract(epoch FROM now()) / $2) * $2), 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [key, limit.windowSeconds],
  );
  return Number(row?.count ?? 0) <= limit.max;
};

const rateLimited = () =>
  apiError(429, "rate_limited", "Too many attempts. Wait a few minutes and try again.", {}, { "Retry-After": "900" });

const sessionCookie = (token: string, secure: boolean, maxAgeSeconds: number) =>
  [
    `${SESSION_COOKIE}=${token}`,
    "Path=/api/admin",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

// The same answer whether or not the address belongs to staff, so the form
// can't be used to find out who works here.
export const CODE_REQUESTED_MESSAGE =
  "If that address belongs to our team, a sign-in code is on its way. It works for 15 minutes.";

export const requestCode = async (req: ApiRequest, deps: AuthDeps): Promise<ApiResponse> => {
  const email = normalizeEmail((req.body as { email?: unknown } | undefined)?.email);
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return apiError(400, "validation", "Enter your work email address.", { fields: { email: "Enter your work email address." } });
  }

  const logger = deps.logger ?? console;
  const withinIp = await hitRateLimit(deps.db, `code:ip:${req.ip}`, RATE_LIMITS.codePerIp);
  const withinEmail = await hitRateLimit(deps.db, `code:email:${email}`, RATE_LIMITS.codePerEmail);
  if (!withinIp || !withinEmail) {
    logger.warn(`${AUTH_LOG.rateLimited} step=request-code by=${withinIp ? "email" : "ip"}`);
    return rateLimited();
  }

  // Clear out finished rate-limit windows now and then.
  await deps.db.query("DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'");

  const answer = ok({ ok: true, message: CODE_REQUESTED_MESSAGE });
  if (!onStaffDomain(email, deps.staffDomains)) return answer;

  const [user] = await deps.db.query<StaffUser>(
    "SELECT id, email, name FROM users WHERE email = $1 AND is_staff",
    [email],
  );
  if (!user) return answer;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // One statement: cancel any earlier unused codes, then store the new one.
  await deps.db.query(
    `WITH cancelled AS (
       UPDATE sign_in_codes SET expires_at = now()
       WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()
     )
     INSERT INTO sign_in_codes (user_id, code_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [user.id, hashCode(email, code), CODE_TTL_MINUTES],
  );

  const sent = await deps.sendCode(user, code);
  logger.info(`${sent ? AUTH_LOG.codeSent : AUTH_LOG.codeEmailFailed} user=${user.id}`);
  return answer;
};

export const verifyCode = async (req: ApiRequest, deps: AuthDeps): Promise<ApiResponse> => {
  const body = (req.body ?? {}) as { email?: unknown; code?: unknown };
  const email = normalizeEmail(body.email);
  const code = typeof body.code === "string" ? body.code.replace(/\s+/g, "") : "";
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
    return apiError(400, "validation", "Enter the 6-digit code from the email.", { fields: { code: "Enter the 6-digit code from the email." } });
  }

  const logger = deps.logger ?? console;
  if (!(await hitRateLimit(deps.db, `verify:ip:${req.ip}`, RATE_LIMITS.verifyPerIp))) {
    logger.warn(`${AUTH_LOG.rateLimited} step=verify by=ip`);
    return rateLimited();
  }

  // One statement: count this try against the newest live code, and use the
  // code up if it matches. A code with no tries left is never matched.
  const [attempt] = await deps.db.query<{ user_id: string; matched: boolean; attempts: number }>(
    `WITH target AS (
       SELECT c.id
       FROM sign_in_codes c JOIN users u ON u.id = c.user_id
       WHERE u.email = $1 AND u.is_staff AND c.used_at IS NULL AND c.expires_at > now()
       ORDER BY c.created_at DESC
       LIMIT 1
       FOR UPDATE OF c
     )
     UPDATE sign_in_codes c
     SET attempts = c.attempts + 1,
         used_at = CASE WHEN c.code_hash = $2 AND c.attempts < $3 THEN now() END
     FROM target
     WHERE c.id = target.id
     RETURNING c.user_id, (c.used_at IS NOT NULL) AS matched, c.attempts`,
    [email, hashCode(email, code), CODE_MAX_ATTEMPTS],
  );

  if (!attempt || attempt.attempts > CODE_MAX_ATTEMPTS) {
    return apiError(400, "code_expired", "That code has expired or was already used. Request a new one.");
  }
  if (!attempt.matched) {
    return attempt.attempts >= CODE_MAX_ATTEMPTS
      ? apiError(400, "code_expired", "Too many wrong tries. Request a new code.")
      : apiError(400, "invalid_code", "That code didn't match. Check the latest email and try again.");
  }
  if (!onStaffDomain(email, deps.staffDomains)) {
    return apiError(403, "forbidden", "This address can't sign in here.");
  }

  const token = newToken();
  await deps.db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), attempt.user_id, SESSION_DAYS],
  );
  logger.info(`${AUTH_LOG.signedIn} user=${attempt.user_id}`);

  const user = await userForToken(deps, token);
  return ok({ user }, { cookies: [sessionCookie(token, deps.secureCookies, SESSION_DAYS * 24 * 60 * 60)] });
};

const userForToken = async (deps: Pick<AuthDeps, "db" | "staffDomains">, token: string): Promise<StaffUser | null> => {
  const [user] = await deps.db.query<StaffUser>(
    `SELECT u.id, u.email, u.name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_staff`,
    [hashToken(token)],
  );
  // Re-checked on every request, so removing a domain or a staff flag takes
  // effect immediately.
  return user && onStaffDomain(user.email, deps.staffDomains) ? user : null;
};

export const authenticate = async (
  req: ApiRequest,
  deps: Pick<AuthDeps, "db" | "staffDomains">,
): Promise<StaffUser | null> => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token || token.length > 100) return null;
  return userForToken(deps, token);
};

export const signOut = async (req: ApiRequest, deps: AuthDeps): Promise<ApiResponse> => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) await deps.db.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  return ok({ ok: true }, { cookies: [sessionCookie("", deps.secureCookies, 0)] });
};

// The sign-in email: fixed wording, nothing the requester typed.
export const buildCodeEmail = (user: StaffUser, code: string) => {
  const text = [
    `Your sign-in code is ${code}`,
    "",
    `It works for ${CODE_TTL_MINUTES} minutes. If you didn't ask for it, ignore this email.`,
  ].join("\n");
  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#0f1f3a">
    <p style="margin:0 0 12px">Your sign-in code is</p>
    <p style="margin:0 0 16px;font-size:28px;letter-spacing:6px;font-weight:600">${code}</p>
    <p style="margin:0;color:#4a5568">It works for ${CODE_TTL_MINUTES} minutes. If you didn't ask for it, ignore this email.</p>
  </div>`;
  return { to: [user.email], subject: `Your sign-in code: ${code}`, text, html };
};
