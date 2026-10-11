import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleAdminRequest, type AdminDeps } from "../api/_lib/adminApi.ts";
import type { StaffUser } from "../api/_lib/auth.ts";
import { sanitizeBookingFormData } from "../api/_lib/booking.ts";
import { createBookingStore } from "../api/_lib/bookingServer.ts";
import { openLocalDb } from "../api/_lib/dbLocal.ts";
import type { ApiRequest, ApiResponse } from "../api/_lib/http.ts";
import { applyMigrations, loadMigrations } from "../api/_lib/migrate.ts";
import { purgeExpiredCandidates, siteUrlFromEnv, type ShortlistChoicesMessage, type ShortlistLinkMessage } from "../api/_lib/shortlist.ts";
import { handleShortlistRequest, REFRESH_MESSAGE, shortlistEnabled, shortlistRoutes } from "../api/_lib/shortlistApi.ts";
import { buildShortlistChoicesEmail, buildShortlistLinkEmail, formatRespondBy } from "../api/_lib/shortlistEmail.ts";
import { validPayload } from "./fixtures.ts";

const migrations = loadMigrations();
const HOST = "localhost:3000";

const setup = async () => {
  const local = await openLocalDb();
  await applyMigrations(local.db, migrations);
  const links: ShortlistLinkMessage[] = [];
  const choices: ShortlistChoicesMessage[] = [];
  const codes: string[] = [];
  const deps: AdminDeps & { secureCookies: boolean } = {
    db: local.db,
    staffDomains: ["hendersonassociates.ca"],
    secureCookies: true,
    sendCode: async (_user, code) => {
      codes.push(code);
      return true;
    },
    sendClientUpdate: async () => "sent",
    sendShortlistLink: async (message) => {
      links.push(message);
      return "sent";
    },
    sendShortlistChoices: async (message) => {
      choices.push(message);
      return "sent";
    },
    siteUrl: () => "http://localhost:3000",
    logger: { info: () => {}, warn: () => {} },
  };

  const request = (method: string, path: string, body?: unknown, cookie?: string, ip = "203.0.113.9"): ApiRequest => {
    const url = new URL(path, "http://local");
    return { method, path: url.pathname, query: url.searchParams, headers: { host: HOST, origin: `http://${HOST}`, cookie }, body, ip };
  };

  // Staff side, signed in as Maria.
  const [maria] = await local.db.query<StaffUser>(
    "INSERT INTO users (email, name, is_staff) VALUES ('maria@hendersonassociates.ca', 'Maria Santos', true) RETURNING id, email, name",
  );
  await handleAdminRequest(request("POST", "/auth/request-code", { email: maria.email }), deps);
  const verified = await handleAdminRequest(request("POST", "/auth/verify", { email: maria.email, code: codes[0] }), deps);
  const staffCookie = verified.cookies![0].split(";")[0];
  const staff = (method: string, path: string, body?: unknown) => handleAdminRequest(request(method, path, body, staffCookie), deps);

  // Client side, with whatever cookie the last /open gave them.
  let clientCookie: string | undefined;
  const client = async (method: string, path: string, body?: unknown, ip?: string) => {
    const res = await handleShortlistRequest(request(method, path, body, clientCookie, ip), deps);
    if (res.cookies?.[0]) clientCookie = res.cookies[0].split(";")[0];
    return res;
  };

  const form = sanitizeBookingFormData({ ...validPayload(), submissionId: globalThis.crypto.randomUUID() });
  const requestId = (await createBookingStore(local.db).store(form)).id;

  const addCandidate = async (overrides: Record<string, unknown> = {}) => {
    const res = await staff("POST", `/requests/${requestId}/candidates`, {
      firstName: "Ana",
      lastName: "Reyes",
      headline: "Customer support lead, 6 years in SaaS",
      yearsExperience: 6,
      skills: "Zendesk, Intercom, Shopify",
      englishLevel: "Fluent",
      availability: "Can start in 2 weeks",
      monthlyRateUsd: 1400,
      whyPicked: "Ran a 12-person support team for a Toronto SaaS company.",
      consent: true,
      ...overrides,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return (res.body as { id: string }).id;
  };

  const publish = (from = "received") => staff("POST", `/requests/${requestId}/shortlist/publish`, { from });
  const tokenOf = (message: ShortlistLinkMessage) => message.url.split("#t=")[1];

  return { db: local.db, deps, links, choices, maria, staff, client, requestId, addCandidate, publish, tokenOf, close: local.close, setClientCookie: (c?: string) => (clientCookie = c) };
};

const code = (res: ApiResponse) => (res.body as { error?: { code?: string } }).error?.code;
const shortlistOf = (res: ApiResponse) =>
  (res.body as { shortlist: { candidates: Array<Record<string, unknown>>; open: boolean; owner: { name: string } | null } }).shortlist;

describe("publishing a shortlist", () => {
  it("needs a consented candidate", async () => {
    const t = await setup();
    await t.addCandidate({ consent: false });
    const res = await t.publish();
    assert.equal(res.status, 400);
    assert.equal(t.links.length, 0);
    await t.close();
  });

  it("validates candidate fields", async () => {
    const t = await setup();
    const res = await t.staff("POST", `/requests/${t.requestId}/candidates`, { firstName: "", lastName: "X", headline: "", yearsExperience: "lots", englishLevel: "Klingon" });
    assert.equal(res.status, 400);
    const fields = (res.body as { error: { fields: Record<string, string> } }).error.fields;
    assert.deepEqual(Object.keys(fields).sort(), ["englishLevel", "firstName", "headline", "yearsExperience"]);
    await t.close();
  });

  it("publishes, moves the status, makes the publisher the owner and emails a private link", async () => {
    const t = await setup();
    await t.addCandidate();
    const res = await t.publish();
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [lead] = await t.db.query<{ status: string; owner_user_id: string }>("SELECT status, owner_user_id FROM booking_leads");
    assert.equal(lead.status, "shortlist_ready");
    assert.equal(lead.owner_user_id, t.maria.id);
    assert.equal(t.links.length, 1);
    assert.match(t.links[0].url, /^http:\/\/localhost:3000\/shortlist#t=[A-Za-z0-9_-]{40,}$/);
    assert.equal(t.links[0].to, validPayload().email.toLowerCase());
    assert.equal(t.links[0].sender?.id, t.maria.id);
    const stored = await t.db.query<{ token_hash: string }>("SELECT token_hash FROM shortlist_links");
    assert.notEqual(stored[0].token_hash, t.tokenOf(t.links[0]));
    const kinds = (await t.db.query<{ kind: string }>("SELECT kind FROM request_events ORDER BY created_at")).map((e) => e.kind);
    assert.deepEqual(kinds, ["status_change", "shortlist_published"]);
    await t.close();
  });

  it("refuses when the status changed meanwhile", async () => {
    const t = await setup();
    await t.addCandidate();
    await t.staff("POST", `/requests/${t.requestId}/status`, { from: "received", to: "clarifying" });
    const res = await t.publish("received");
    assert.equal(res.status, 409);
    const [row] = await t.db.query<{ published: number }>("SELECT count(*)::int AS published FROM request_candidates WHERE published_at IS NOT NULL");
    assert.equal(row.published, 0);
    await t.close();
  });

  it("shows at most five open candidates", async () => {
    const t = await setup();
    for (let i = 0; i < 6; i += 1) await t.addCandidate({ firstName: `C${i}` });
    assert.equal((await t.publish()).status, 400);
    await t.close();
  });

  it("only removes candidates the client hasn't seen", async () => {
    const t = await setup();
    const seen = await t.addCandidate();
    await t.publish();
    const unseen = await t.addCandidate({ firstName: "Ben" });
    assert.equal((await t.staff("POST", `/requests/${t.requestId}/candidates/${seen}/remove`)).status, 400);
    assert.equal((await t.staff("POST", `/requests/${t.requestId}/candidates/${unseen}/remove`)).status, 200);
    const [{ n }] = await t.db.query<{ n: number }>("SELECT count(*)::int AS n FROM candidates");
    assert.equal(n, 1);
    await t.close();
  });

  it("reorders", async () => {
    const t = await setup();
    const a = await t.addCandidate({ firstName: "A" });
    const b = await t.addCandidate({ firstName: "B" });
    await t.staff("POST", `/requests/${t.requestId}/shortlist/order`, { order: [b, a] });
    const list = (await t.staff("GET", `/requests/${t.requestId}/shortlist`)).body as { candidates: Array<{ firstName: string }> };
    assert.deepEqual(list.candidates.map((c) => c.firstName), ["B", "A"]);
    await t.close();
  });
});

describe("the client's shortlist page", () => {
  const published = async () => {
    const t = await setup();
    const ana = await t.addCandidate();
    const ben = await t.addCandidate({ firstName: "Ben", lastName: "Cruz", monthlyRateUsd: 1200 });
    await t.publish();
    return { ...t, ana, ben, token: t.tokenOf(t.links[0]) };
  };

  it("has exactly two public routes", async () => {
    const t = await setup();
    const open = shortlistRoutes({ ...t.deps }).filter((r) => r.auth === "public").map((r) => `${r.method} ${r.path}`);
    assert.deepEqual(open, ["POST /open", "POST /refresh"]);
    assert.equal(shortlistEnabled({ VERCEL_ENV: "production" }), false);
    assert.equal(shortlistEnabled({ VERCEL_ENV: "production", FEATURE_SHORTLIST: "1" }), true);
    await t.close();
  });

  it("needs Continue first, then shows first names and last initials only", async () => {
    const t = await published();
    assert.equal(code(await t.client("GET", "/")), "link_required");
    const opened = await t.client("POST", "/open", { token: t.token });
    assert.equal(opened.status, 200);
    assert.match(opened.cookies![0], /HttpOnly/);
    assert.match(opened.cookies![0], /Path=\/api\/shortlist/);
    const res = await t.client("GET", "/");
    const shortlist = shortlistOf(res);
    assert.deepEqual(shortlist.candidates.map((c) => c.name), ["Ana R.", "Ben C."]);
    assert.equal(shortlist.candidates[0].monthlyRateUsd, 1400);
    assert.deepEqual(shortlist.candidates[0].skills, ["Zendesk", "Intercom", "Shopify"]);
    assert.equal(shortlist.owner?.name, "Maria Santos");
    const json = JSON.stringify(res.body);
    for (const secret of ["Reyes", "Cruz", "consent", "deleteAfter", "delete_after"]) assert.ok(!json.includes(secret), secret);
    await t.close();
  });

  it("counts the first view once on the timeline", async () => {
    const t = await published();
    await t.client("POST", "/open", { token: t.token });
    await t.client("POST", "/open", { token: t.token });
    const views = await t.db.query("SELECT 1 FROM request_events WHERE kind = 'shortlist_viewed'");
    assert.equal(views.length, 1);
    const [link] = await t.db.query<{ view_count: number }>("SELECT view_count FROM shortlist_links");
    assert.equal(link.view_count, 2);
    await t.close();
  });

  it("rejects unknown links and explains expired ones", async () => {
    const t = await published();
    assert.equal(code(await t.client("POST", "/open", { token: "x".repeat(43) })), "link_invalid");
    await t.db.query("UPDATE shortlist_links SET expires_at = now() - interval '1 minute'");
    const expired = await t.client("POST", "/open", { token: t.token });
    assert.equal(expired.status, 410);
    assert.equal((expired.body as { error: { sentTo: string } }).error.sentTo, "j•••@example.com");
    await t.close();
  });

  it("stops older links and sessions when a fresh link is sent", async () => {
    const t = await published();
    await t.client("POST", "/open", { token: t.token });
    assert.equal((await t.client("GET", "/")).status, 200);
    await t.staff("POST", `/requests/${t.requestId}/shortlist/resend`);
    assert.equal((await t.client("GET", "/")).status, 401);
    assert.equal((await t.client("POST", "/open", { token: t.token })).status, 410);
    assert.equal((await t.client("POST", "/open", { token: t.tokenOf(t.links[1]) })).status, 200);
    await t.close();
  });

  it("sends a fresh link on request, with the same answer for unknown links", async () => {
    const t = await published();
    await t.db.query("UPDATE shortlist_links SET expires_at = now() - interval '1 minute'");
    const known = await t.client("POST", "/refresh", { token: t.token });
    const unknown = await t.client("POST", "/refresh", { token: "y".repeat(43) });
    assert.deepEqual(known.body, unknown.body);
    assert.equal((known.body as { message: string }).message, REFRESH_MESSAGE);
    assert.equal(t.links.length, 2);
    assert.equal(t.links[1].to, t.links[0].to);
    for (let i = 0; i < 4; i += 1) await t.client("POST", "/refresh", { token: t.token }, `198.51.100.${i}`);
    assert.equal(t.links.length, 4, "at most three fresh links per request per day");
    await t.close();
  });

  it("saves each choice at once and sends them to the owner", async () => {
    const t = await published();
    await t.client("POST", "/open", { token: t.token });
    assert.equal((await t.client("POST", "/decision", { candidateId: t.ana, decision: "interview" })).status, 200);
    assert.equal((await t.client("POST", "/submit")).status, 400, "Ben is undecided");
    await t.client("POST", "/decision", { candidateId: t.ben, decision: "pass", reason: "Needs more Shopify" });
    const res = await t.client("POST", "/submit");
    assert.equal(res.status, 200);
    assert.equal((res.body as { allPassed: boolean }).allPassed, false);
    assert.equal(t.choices.length, 1);
    assert.equal(t.choices[0].to, "maria@hendersonassociates.ca");
    assert.deepEqual(t.choices[0].choices.map((c) => [c.name, c.decision, c.reason]), [
      ["Ana R.", "interview", null],
      ["Ben C.", "pass", "Needs more Shopify"],
    ]);
    const [lead] = await t.db.query<{ status: string }>("SELECT status FROM booking_leads");
    assert.equal(lead.status, "shortlist_ready");
    await t.close();
  });

  it("sends the request back to Sourcing when every candidate is passed", async () => {
    const t = await published();
    await t.client("POST", "/open", { token: t.token });
    await t.client("POST", "/decision", { candidateId: t.ana, decision: "pass" });
    await t.client("POST", "/decision", { candidateId: t.ben, decision: "pass" });
    const res = await t.client("POST", "/submit");
    assert.equal((res.body as { allPassed: boolean }).allPassed, true);
    const [lead] = await t.db.query<{ status: string }>("SELECT status FROM booking_leads");
    assert.equal(lead.status, "sourcing");
    await t.close();
  });

  it("locks choices once staff move the request on", async () => {
    const t = await published();
    await t.client("POST", "/open", { token: t.token });
    await t.staff("POST", `/requests/${t.requestId}/status`, { from: "shortlist_ready", to: "interviewing" });
    const res = await t.client("POST", "/decision", { candidateId: t.ana, decision: "pass" });
    assert.equal(code(res), "shortlist_closed");
    assert.equal(shortlistOf(await t.client("GET", "/")).open, false);
    await t.close();
  });

  it("shows a withdrawn candidate as unavailable and refuses choices for them", async () => {
    const t = await published();
    await t.client("POST", "/open", { token: t.token });
    await t.staff("POST", `/requests/${t.requestId}/candidates/${t.ben}/withdraw`, {});
    const shortlist = shortlistOf(await t.client("GET", "/"));
    assert.equal(shortlist.candidates[1].withdrawn, true);
    assert.equal(code(await t.client("POST", "/decision", { candidateId: t.ben, decision: "interview" })), "candidate_unavailable");
    await t.client("POST", "/decision", { candidateId: t.ana, decision: "interview" });
    assert.equal((await t.client("POST", "/submit")).status, 200, "withdrawn candidates don't block sending");
    await t.close();
  });

  it("never shows a candidate to a request they weren't published for", async () => {
    const t = await published();
    const other = sanitizeBookingFormData({ ...validPayload(), submissionId: globalThis.crypto.randomUUID(), company: "Other Co" });
    const otherId = (await createBookingStore(t.db).store(other)).id;
    await t.client("POST", "/open", { token: t.token });
    const [entry] = await t.db.query<{ id: string }>(
      "INSERT INTO request_candidates (request_id, candidate_id, published_at, consent_at) SELECT $1, candidate_id, now(), now() FROM request_candidates LIMIT 1 RETURNING id",
      [otherId],
    );
    assert.equal(code(await t.client("POST", "/decision", { candidateId: entry.id, decision: "pass" })), "candidate_unavailable");
    await t.close();
  });
});

describe("retention and emails", () => {
  it("purges candidates past their delete-after date", async () => {
    const t = await setup();
    await t.addCandidate({ deleteAfter: "2020-01-01" });
    await t.addCandidate({ firstName: "Keep" });
    assert.equal(await purgeExpiredCandidates(t.db), 1);
    const left = await t.db.query<{ first_name: string }>("SELECT first_name FROM candidates");
    assert.deepEqual(left.map((r) => r.first_name), ["Keep"]);
    await t.close();
  });

  it("builds links only from configured addresses", () => {
    assert.equal(siteUrlFromEnv({ SITE_URL: "https://agency.example/" }), "https://agency.example");
    assert.equal(siteUrlFromEnv({ VERCEL_ENV: "preview", VERCEL_URL: "x-git-y.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "agency.example" }), "https://x-git-y.vercel.app");
    assert.equal(siteUrlFromEnv({ VERCEL_ENV: "production", VERCEL_URL: "x.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "agency.example" }), "https://agency.example");
    assert.equal(siteUrlFromEnv({}), null);
  });

  it("writes the link email with one button and the plain link", () => {
    const email = buildShortlistLinkEmail({
      to: "jordan@example.com",
      clientFirstName: "Jordan",
      sender: { id: "u", email: "maria@hendersonassociates.ca", name: "Maria Santos" },
      role: "Bookkeeper",
      company: "Northwind <b>",
      count: 3,
      url: "http://localhost:3000/shortlist#t=abc",
      respondBy: "2026-10-14",
      reference: "ref",
    });
    assert.equal(email.subject, "Your shortlist for Bookkeeper is ready");
    assert.equal(email.replyTo, "maria@hendersonassociates.ca");
    assert.equal(email.html.match(/Review the shortlist/g)?.length, 1);
    assert.match(email.text, /3 candidates/);
    assert.match(email.text, /http:\/\/localhost:3000\/shortlist#t=abc/);
    assert.match(email.text, /Wednesday, October 14/);
    assert.equal(formatRespondBy("2026-10-14"), "Wednesday, October 14");
  });

  it("tells the owner what the client chose", () => {
    const email = buildShortlistChoicesEmail({
      to: "maria@hendersonassociates.ca",
      ownerName: "Maria",
      clientName: "Jordan",
      clientEmail: "jordan@example.com",
      company: "Northwind",
      role: "Bookkeeper",
      requestUrl: null,
      choices: [{ name: "Ana R.", decision: "pass", reason: "<script>" }],
      allPassed: true,
    });
    assert.equal(email.subject, "Northwind passed on every candidate (Bookkeeper)");
    assert.equal(email.replyTo, "jordan@example.com");
    assert.ok(!email.html.includes("<script>"));
  });
});
