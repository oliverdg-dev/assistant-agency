import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  adminEnabled,
  adminRoutes,
  handleAdminRequest,
  type AdminDeps,
  type ClientEmailResult,
  type ClientUpdate,
} from "../api/_lib/adminApi.ts";
import { buildClientUpdateEmail, senderFor } from "../api/_lib/adminServer.ts";
import { CODE_REQUESTED_MESSAGE, SESSION_COOKIE, type StaffUser } from "../api/_lib/auth.ts";
import { sanitizeBookingFormData } from "../api/_lib/booking.ts";
import { createBookingStore } from "../api/_lib/bookingServer.ts";
import type { TransactionalDb } from "../api/_lib/db.ts";
import { openLocalDb } from "../api/_lib/dbLocal.ts";
import type { ApiRequest, ApiResponse } from "../api/_lib/http.ts";
import { applyMigrations, loadMigrations } from "../api/_lib/migrate.ts";
import { businessDaysBetween, isStale, REQUEST_EVENT_KINDS } from "../api/_lib/requestStatus.ts";
import { validPayload } from "./fixtures.ts";

const migrations = loadMigrations();
const HOST = "localhost:3000";

interface Harness {
  db: TransactionalDb;
  deps: AdminDeps;
  codes: Array<{ email: string; code: string }>;
  updates: ClientUpdate[];
  setEmailResult: (result: ClientEmailResult) => void;
  call: (method: string, path: string, options?: { body?: unknown; cookie?: string; origin?: string | null; ip?: string }) => Promise<ApiResponse>;
  signIn: (email: string) => Promise<string>;
  addStaff: (email: string, name?: string) => Promise<StaffUser>;
  addRequest: (overrides?: Record<string, string>) => Promise<string>;
  close: () => Promise<void>;
}

const harness = async (now?: Date): Promise<Harness> => {
  const local = await openLocalDb();
  await applyMigrations(local.db, migrations);
  const codes: Harness["codes"] = [];
  const updates: ClientUpdate[] = [];
  let emailResult: ClientEmailResult = "sent";
  const deps: AdminDeps = {
    db: local.db,
    staffDomains: ["hendersonassociates.ca"],
    secureCookies: true,
    sendCode: async (user, code) => {
      codes.push({ email: user.email, code });
      return true;
    },
    sendClientUpdate: async (update) => {
      updates.push(update);
      return emailResult;
    },
    sendShortlistLink: async () => "sent",
    sendShortlistChoices: async () => "sent",
    siteUrl: () => "http://localhost:3000",
    logger: { info: () => {}, warn: () => {} },
    now: now ? () => now : undefined,
  };

  const call: Harness["call"] = async (method, path, options = {}) => {
    const url = new URL(path, "http://local");
    const req: ApiRequest = {
      method,
      path: url.pathname,
      query: url.searchParams,
      headers: {
        host: HOST,
        origin: options.origin === null ? undefined : (options.origin ?? `http://${HOST}`),
        cookie: options.cookie,
      },
      body: options.body,
      ip: options.ip ?? "203.0.113.1",
    };
    return handleAdminRequest(req, deps);
  };

  const signIn = async (email: string) => {
    await call("POST", "/auth/request-code", { body: { email } });
    const code = codes.filter((c) => c.email === email).at(-1)?.code;
    assert.ok(code, `no code was sent to ${email}`);
    const res = await call("POST", "/auth/verify", { body: { email, code } });
    assert.equal(res.status, 200);
    const cookie = res.cookies?.[0] ?? "";
    return cookie.split(";")[0];
  };

  const addStaff = async (email: string, name?: string) => {
    const [user] = await local.db.query<StaffUser>(
      "INSERT INTO users (email, name, is_staff) VALUES ($1, $2, true) RETURNING id, email, name",
      [email, name ?? null],
    );
    return user;
  };

  const addRequest = async (overrides: Record<string, string> = {}) => {
    const form = sanitizeBookingFormData({ ...validPayload(), submissionId: globalThis.crypto.randomUUID(), ...overrides });
    return (await createBookingStore(local.db).store(form)).id;
  };

  return {
    db: local.db,
    deps,
    codes,
    updates,
    setEmailResult: (result) => {
      emailResult = result;
    },
    call,
    signIn,
    addStaff,
    addRequest,
    close: local.close,
  };
};

const errorCode = (res: ApiResponse) => (res.body as { error?: { code?: string } }).error?.code;

describe("admin routes", () => {
  it("only the two sign-in steps are public", async () => {
    const h = await harness();
    const publicRoutes = adminRoutes(h.deps)
      .filter((route) => route.auth === "public")
      .map((route) => `${route.method} ${route.path}`);
    assert.deepEqual(publicRoutes, ["POST /auth/request-code", "POST /auth/verify"]);
    await h.close();
  });

  it("asks for sign-in on every staff route", async () => {
    const h = await harness();
    for (const route of adminRoutes(h.deps).filter((r) => r.auth === "staff")) {
      const path = route.path.replace(":id", globalThis.crypto.randomUUID()).replace(":eventId", globalThis.crypto.randomUUID());
      const res = await h.call(route.method, path, { body: {} });
      assert.equal(res.status, 401, `${route.method} ${route.path}`);
    }
    await h.close();
  });

  it("refuses changes from another site", async () => {
    const h = await harness();
    const res = await h.call("POST", "/auth/request-code", { body: { email: "a@hendersonassociates.ca" }, origin: "https://evil.example" });
    assert.equal(res.status, 403);
    const missing = await h.call("POST", "/auth/request-code", { body: { email: "a@hendersonassociates.ca" }, origin: null });
    assert.equal(missing.status, 403);
    await h.close();
  });

  it("never caches or indexes responses, errors included", async () => {
    const h = await harness();
    const res = await h.call("GET", "/nope");
    assert.equal(res.status, 404);
    assert.equal(res.headers?.["Cache-Control"], "no-store");
    assert.equal(res.headers?.["X-Robots-Tag"], "noindex");
    await h.close();
  });

  it("is off in production unless FEATURE_ADMIN=1", () => {
    assert.equal(adminEnabled({ VERCEL_ENV: "production" }), false);
    assert.equal(adminEnabled({ VERCEL_ENV: "preview" }), false);
    assert.equal(adminEnabled({ VERCEL_ENV: "production", FEATURE_ADMIN: "1" }), true);
    assert.equal(adminEnabled({ NODE_ENV: "development" }), true);
  });

  it("never bundles local-only code into the deployed functions", () => {
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const source = readFileSync(file, "utf8");
      for (const [, spec] of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
        walk(path.join(path.dirname(file), spec).replace(/\.js$/, ".ts"));
      }
    };
    walk("api/admin.ts");
    walk("api/booking.ts");
    walk("api/shortlist.ts");
    const localOnly = [...seen].filter((file) => /dbLocal|adminDev|bookingDev/.test(file));
    assert.deepEqual(localOnly, []);
  });

  it("is deployed as one function with a rewrite ahead of the page fallback", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    assert.ok(config.functions["api/admin.ts"]);
    assert.deepEqual(config.rewrites[0], { source: "/api/admin/:path*", destination: "/api/admin?path=:path*" });
    assert.ok(config.functions["api/shortlist.ts"]);
    assert.deepEqual(config.rewrites[1], { source: "/api/shortlist/:path*", destination: "/api/shortlist?path=:path*" });
  });
});

describe("staff sign-in", () => {
  it("sends a code to staff only, with the same answer for everyone", async () => {
    const h = await harness();
    await h.addStaff("maria@hendersonassociates.ca");
    await h.db.query("INSERT INTO users (email, is_staff) VALUES ('client@hendersonassociates.ca', false)");
    await h.db.query("INSERT INTO users (email, is_staff) VALUES ('outside@gmail.com', true)");

    const answers = [];
    for (const email of ["maria@hendersonassociates.ca", "nobody@hendersonassociates.ca", "client@hendersonassociates.ca", "outside@gmail.com"]) {
      const res = await h.call("POST", "/auth/request-code", { body: { email } });
      answers.push(JSON.stringify([res.status, res.body]));
    }
    assert.equal(new Set(answers).size, 1);
    assert.match(answers[0], new RegExp(CODE_REQUESTED_MESSAGE.slice(0, 30)));
    assert.deepEqual(h.codes.map((c) => c.email), ["maria@hendersonassociates.ca"]);
    await h.close();
  });

  it("accepts the right code once and sets a secure session cookie", async () => {
    const h = await harness();
    await h.addStaff("maria@hendersonassociates.ca", "Maria Santos");
    await h.call("POST", "/auth/request-code", { body: { email: " Maria@HendersonAssociates.ca " } });
    const { code } = h.codes[0];
    const res = await h.call("POST", "/auth/verify", { body: { email: "maria@hendersonassociates.ca", code } });
    assert.equal(res.status, 200);
    const cookie = res.cookies?.[0] ?? "";
    assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=`));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /Path=\/api\/admin/);

    const me = await h.call("GET", "/me", { cookie: cookie.split(";")[0] });
    assert.equal((me.body as { user: StaffUser }).user.name, "Maria Santos");

    const again = await h.call("POST", "/auth/verify", { body: { email: "maria@hendersonassociates.ca", code } });
    assert.equal(errorCode(again), "code_expired");

    const stored = await h.db.query<{ code_hash: string }>("SELECT code_hash FROM sign_in_codes");
    assert.ok(stored.every((row) => row.code_hash !== code));
    await h.close();
  });

  it("stops after five wrong tries", async () => {
    const h = await harness();
    await h.addStaff("maria@hendersonassociates.ca");
    await h.call("POST", "/auth/request-code", { body: { email: "maria@hendersonassociates.ca" } });
    const { code } = h.codes[0];
    const wrong = code === "000000" ? "111111" : "000000";
    const results = [];
    for (let i = 0; i < 5; i += 1) {
      results.push(errorCode(await h.call("POST", "/auth/verify", { body: { email: "maria@hendersonassociates.ca", code: wrong } })));
    }
    assert.deepEqual(results, ["invalid_code", "invalid_code", "invalid_code", "invalid_code", "code_expired"]);
    const right = await h.call("POST", "/auth/verify", { body: { email: "maria@hendersonassociates.ca", code } });
    assert.equal(errorCode(right), "code_expired");
    await h.close();
  });

  it("cancels the earlier code when a new one is sent", async () => {
    const h = await harness();
    await h.addStaff("maria@hendersonassociates.ca");
    await h.call("POST", "/auth/request-code", { body: { email: "maria@hendersonassociates.ca" } });
    await h.call("POST", "/auth/request-code", { body: { email: "maria@hendersonassociates.ca" } });
    const [first, second] = h.codes;
    if (first.code !== second.code) {
      const old = await h.call("POST", "/auth/verify", { body: { email: first.email, code: first.code } });
      assert.equal(errorCode(old), "invalid_code");
    }
    const res = await h.call("POST", "/auth/verify", { body: { email: second.email, code: second.code } });
    assert.equal(res.status, 200);
    await h.close();
  });

  it("rejects an expired code", async () => {
    const h = await harness();
    await h.addStaff("maria@hendersonassociates.ca");
    await h.call("POST", "/auth/request-code", { body: { email: "maria@hendersonassociates.ca" } });
    await h.db.query("UPDATE sign_in_codes SET expires_at = now() - interval '1 second'");
    const res = await h.call("POST", "/auth/verify", { body: { email: "maria@hendersonassociates.ca", code: h.codes[0].code } });
    assert.equal(errorCode(res), "code_expired");
    await h.close();
  });

  it("rate-limits code requests per email", async () => {
    const h = await harness();
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await h.call("POST", "/auth/request-code", { body: { email: "x@hendersonassociates.ca" }, ip: `198.51.100.${i}` })).status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
    await h.close();
  });

  it("rate-limits code requests per IP", async () => {
    const h = await harness();
    let last = 0;
    for (let i = 0; i < 21; i += 1) {
      last = (await h.call("POST", "/auth/request-code", { body: { email: `p${i}@hendersonassociates.ca` } })).status;
    }
    assert.equal(last, 429);
    await h.close();
  });

  it("signs out, and removing staff ends access at once", async () => {
    const h = await harness();
    await h.addStaff("maria@hendersonassociates.ca");
    await h.addStaff("jo@hendersonassociates.ca");
    const maria = await h.signIn("maria@hendersonassociates.ca");
    const jo = await h.signIn("jo@hendersonassociates.ca");

    await h.call("POST", "/auth/sign-out", { cookie: maria });
    assert.equal((await h.call("GET", "/me", { cookie: maria })).status, 401);

    await h.db.query("UPDATE users SET is_staff = false WHERE email = 'jo@hendersonassociates.ca'");
    assert.equal((await h.call("GET", "/me", { cookie: jo })).status, 401);
    await h.close();
  });

  it("ends access when the staff domain is removed", async () => {
    const h = await harness();
    await h.addStaff("maria@hendersonassociates.ca");
    const cookie = await h.signIn("maria@hendersonassociates.ca");
    h.deps.staffDomains = ["other.example"];
    assert.equal((await h.call("GET", "/me", { cookie })).status, 401);
    await h.close();
  });
});

describe("request inbox", () => {
  const signedIn = async (now?: Date) => {
    const h = await harness(now);
    const user = await h.addStaff("maria@hendersonassociates.ca", "Maria Santos");
    const cookie = await h.signIn(user.email);
    return { h, user, cookie };
  };

  it("changes status and records it on the timeline", async () => {
    const { h, cookie } = await signedIn();
    const id = await h.addRequest();
    const res = await h.call("POST", `/requests/${id}/status`, { cookie, body: { from: "received", to: "sourcing", note: "Brief confirmed." } });
    assert.equal(res.status, 200);
    const detail = (await h.call("GET", `/requests/${id}`, { cookie })).body as { request: { status: string; events: Array<Record<string, unknown>> } };
    assert.equal(detail.request.status, "sourcing");
    assert.equal(detail.request.events[0].kind, "status_change");
    assert.equal(detail.request.events[0].toStatus, "sourcing");
    assert.equal((detail.request.events[0].actor as { name: string }).name, "Maria Santos");
    assert.equal(h.updates.length, 0);
    await h.close();
  });

  it("refuses a status change based on an old status, and says who changed it", async () => {
    const { h, cookie } = await signedIn();
    const id = await h.addRequest();
    await h.call("POST", `/requests/${id}/status`, { cookie, body: { from: "received", to: "clarifying" } });
    const res = await h.call("POST", `/requests/${id}/status`, { cookie, body: { from: "received", to: "closed" } });
    assert.equal(res.status, 409);
    const error = (res.body as { error: { code: string; message: string; current: { status: string; by: string } } }).error;
    assert.equal(error.code, "stale_status");
    assert.equal(error.current.status, "clarifying");
    assert.equal(error.current.by, "Maria Santos");
    const events = await h.db.query("SELECT 1 FROM request_events WHERE request_id = $1", [id]);
    assert.equal(events.length, 1);
    await h.close();
  });

  it("keeps internal notes internal and emails client-visible ones", async () => {
    const { h, cookie, user } = await signedIn();
    const id = await h.addRequest();
    await h.call("POST", `/requests/${id}/notes`, { cookie, body: { kind: "note", body: "Budget looks tight.", visibility: "internal" } });
    assert.equal(h.updates.length, 0);

    const res = await h.call("POST", `/requests/${id}/notes`, { cookie, body: { kind: "note", body: "We have three strong candidates.", visibility: "client" } });
    assert.equal((res.body as { emailStatus: string }).emailStatus, "sent");
    assert.equal(h.updates.length, 1);
    assert.equal(h.updates[0].to, validPayload().email.toLowerCase());
    assert.equal(h.updates[0].author.id, user.id);
    const [event] = await h.db.query<{ email_status: string; email_sent_at: string | null }>(
      "SELECT email_status, email_sent_at FROM request_events WHERE visibility = 'client'",
    );
    assert.equal(event.email_status, "sent");
    assert.ok(event.email_sent_at);
    await h.close();
  });

  it("records a failed client email and can send it again", async () => {
    const { h, cookie } = await signedIn();
    const id = await h.addRequest();
    h.setEmailResult("failed");
    const res = await h.call("POST", `/requests/${id}/notes`, { cookie, body: { body: "Update for you.", visibility: "client" } });
    const { eventId, emailStatus } = res.body as { eventId: string; emailStatus: string };
    assert.equal(emailStatus, "failed");

    h.setEmailResult("sent");
    const retry = await h.call("POST", `/requests/${id}/events/${eventId}/resend`, { cookie });
    assert.equal((retry.body as { emailStatus: string }).emailStatus, "sent");
    const twice = await h.call("POST", `/requests/${id}/events/${eventId}/resend`, { cookie });
    assert.equal(twice.status, 400);
    assert.equal(h.updates.length, 2);
    await h.close();
  });

  it("validates notes", async () => {
    const { h, cookie } = await signedIn();
    const id = await h.addRequest();
    assert.equal((await h.call("POST", `/requests/${id}/notes`, { cookie, body: { body: "  " } })).status, 400);
    assert.equal((await h.call("POST", `/requests/${id}/notes`, { cookie, body: { body: "x".repeat(5001) } })).status, 400);
    assert.equal((await h.call("POST", `/requests/${id}/notes`, { cookie, body: { kind: "status_change", body: "x" } })).status, 400);
    await h.close();
  });

  it("assigns an owner once per change", async () => {
    const { h, cookie, user } = await signedIn();
    const id = await h.addRequest();
    await h.call("POST", `/requests/${id}/owner`, { cookie, body: { ownerId: user.id } });
    await h.call("POST", `/requests/${id}/owner`, { cookie, body: { ownerId: user.id } });
    const events = await h.db.query<{ body: string }>("SELECT body FROM request_events WHERE kind = 'owner_change'");
    assert.deepEqual(events.map((e) => e.body), ["Maria Santos"]);

    const [client] = await h.db.query<{ id: string }>("INSERT INTO users (email) VALUES ('c@client.example') RETURNING id");
    assert.equal((await h.call("POST", `/requests/${id}/owner`, { cookie, body: { ownerId: client.id } })).status, 400);

    await h.call("POST", `/requests/${id}/owner`, { cookie, body: { ownerId: null } });
    const [lead] = await h.db.query<{ owner_user_id: string | null }>("SELECT owner_user_id FROM booking_leads");
    assert.equal(lead.owner_user_id, null);
    await h.close();
  });

  it("answers 404 for unknown or malformed ids", async () => {
    const { h, cookie } = await signedIn();
    assert.equal((await h.call("GET", `/requests/${globalThis.crypto.randomUUID()}`, { cookie })).status, 404);
    assert.equal((await h.call("GET", "/requests/not-a-uuid", { cookie })).status, 404);
    assert.equal(
      (await h.call("POST", `/requests/${globalThis.crypto.randomUUID()}/status`, { cookie, body: { from: "received", to: "closed" } })).status,
      404,
    );
    await h.close();
  });

  it("filters by status, owner and staleness, with counts", async () => {
    // Friday 10 October 2026, noon in Manila.
    const now = new Date("2026-10-10T04:00:00Z");
    const { h, cookie, user } = await signedIn(now);
    const fresh = await h.addRequest();
    const old = await h.addRequest();
    const done = await h.addRequest();
    await h.db.query("UPDATE booking_leads SET created_at = $2 WHERE id = $1", [old, "2026-10-01T04:00:00Z"]);
    await h.db.query("UPDATE booking_leads SET status = 'filled', created_at = $2 WHERE id = $1", [done, "2026-09-01T04:00:00Z"]);
    await h.call("POST", `/requests/${fresh}/owner`, { cookie, body: { ownerId: user.id } });

    const list = async (query: string) =>
      (await h.call("GET", `/requests${query}`, { cookie })).body as {
        items: Array<{ id: string; stale: boolean }>;
        counts: Record<string, number>;
      };

    const open = await list("");
    assert.deepEqual(open.items.map((i) => i.id).sort(), [fresh, old].sort());
    assert.equal(open.counts.open, 2);
    assert.equal(open.counts.filled, 1);
    assert.equal(open.counts.stale, 1);
    assert.equal(open.counts.unassigned, 1);
    assert.deepEqual((await list("?stale=1")).items.map((i) => i.id), [old]);
    assert.deepEqual((await list("?owner=me")).items.map((i) => i.id), [fresh]);
    assert.deepEqual((await list("?owner=none")).items.map((i) => i.id), [old]);
    assert.deepEqual((await list("?status=filled")).items.map((i) => i.id), [done]);
    assert.equal((await list("?status=all")).items.length, 3);
    await h.close();
  });

  it("summarises the funnel", async () => {
    const now = new Date();
    const { h, cookie } = await signedIn(now);
    const id = await h.addRequest();
    await h.db.query("UPDATE booking_leads SET created_at = now() - interval '2 days' WHERE id = $1", [id]);
    await h.call("POST", `/requests/${id}/status`, { cookie, body: { from: "received", to: "shortlist_ready" } });
    const res = (await h.call("GET", "/summary", { cookie })).body as {
      last7: { received: number; shortlisted: number };
      medianHoursToShortlist: number;
    };
    assert.equal(res.last7.received, 1);
    assert.equal(res.last7.shortlisted, 1);
    assert.ok(res.medianHoursToShortlist >= 47 && res.medianHoursToShortlist <= 49);
    await h.close();
  });
});

describe("stale rule", () => {
  it("counts Manila business days", () => {
    // Friday evening in Manila to the next Wednesday morning: Mon, Tue, Wed.
    assert.equal(businessDaysBetween(new Date("2026-10-09T10:00:00Z"), new Date("2026-10-14T01:00:00Z")), 3);
    // Over a weekend only.
    assert.equal(businessDaysBetween(new Date("2026-10-09T10:00:00Z"), new Date("2026-10-11T10:00:00Z")), 0);
    // 23:30 UTC Sunday is already Monday in Manila.
    assert.equal(businessDaysBetween(new Date("2026-10-09T10:00:00Z"), new Date("2026-10-11T23:30:00Z")), 1);
  });

  it("never flags finished requests", () => {
    const longAgo = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-10-09T00:00:00Z");
    assert.equal(isStale("filled", longAgo, now), false);
    assert.equal(isStale("closed", longAgo, now), false);
    assert.equal(isStale("on_hold", longAgo, now), true);
  });

  it("keeps the event kind CHECK constraint in step with REQUEST_EVENT_KINDS", () => {
    // The newest migration that redefines the constraint is the one that counts.
    const sql = readFileSync("db/migrations/0003_shortlists.sql", "utf8");
    const list = sql.match(/request_events_kind_check\s+CHECK \(kind IN \(([^)]*)\)/s)?.[1] ?? "";
    assert.deepEqual([...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]), [...REQUEST_EVENT_KINDS]);
  });
});

describe("client update email", () => {
  const author = { id: "u1", email: "maria@hendersonassociates.ca", name: "Maria Santos" };
  const update: ClientUpdate = {
    to: "client@example.com",
    clientFirstName: "Jordan",
    author,
    body: "First paragraph <b>here</b>.\n\nSecond paragraph.",
    role: "Bookkeeper",
    reference: "abc",
    stage: "Finding candidates",
  };

  it("comes from the named staff member and replies go to them", () => {
    const email = buildClientUpdateEmail(update);
    assert.equal(email.replyTo, author.email);
    assert.equal(senderFor(author, "Agency <requests@agency.example>"), "Maria Santos at Your Agency <requests@agency.example>");
    assert.equal(senderFor({ ...author, name: 'Evil" <x@y>' }, "requests@agency.example"), "Evil x@y at Your Agency <requests@agency.example>");
  });

  it("escapes what staff typed", () => {
    const email = buildClientUpdateEmail(update);
    assert.match(email.html, /&lt;b&gt;here&lt;\/b&gt;/);
    assert.match(email.text, /Second paragraph\./);
    assert.match(email.text, /Stage: Finding candidates/);
  });
});
