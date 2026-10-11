import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeBookingFormData } from "../api/_lib/booking.ts";
import {
  buildClientEmail,
  buildInternalEmail,
  httpsUrlOrNull,
  readEmailConfig,
  sendInternalEmail,
  type EmailConfig,
} from "../api/_lib/bookingEmail.ts";
import { BOOKING_LOG } from "../api/_lib/bookingLog.ts";
import { captureLogs, validPayload } from "./fixtures.ts";

const config: EmailConfig = {
  apiKey: "re_test",
  from: "requests@agency.example",
  internalTo: "team@agency.example",
  calendarUrl: null,
};

const form = () => sanitizeBookingFormData(validPayload());
const saved = { leadId: "6c1e7b8a-0000-4000-8000-000000000001", storeOutcome: "saved" as const };

describe("internal email", () => {
  it("includes every field, replies to the submitter and names the role", () => {
    const email = buildInternalEmail(form(), saved, config);
    assert.equal(email.subject, "New job request: Executive Assistant at Northwind Freight");
    assert.deepEqual(email.to, ["team@agency.example"]);
    assert.equal(email.replyTo, "jordan.rivera@example.com");
    for (const value of ["Logistics", "2-3", "Full-time", "Within a month", "Canada", "northwind.example", "Reference ID"]) {
      assert.ok(email.text.includes(value), `missing ${value}`);
    }
  });

  it("flags a request that was not saved, without a reference", () => {
    const email = buildInternalEmail(form(), { leadId: null, storeOutcome: "failed" }, config);
    assert.ok(email.subject.startsWith("[NOT SAVED] "));
    assert.ok(email.text.includes("NOT saved to the database"));
    assert.ok(!email.text.includes("Reference ID"));
  });

  it("flags an unconfirmed save and tells the team what to check", () => {
    const email = buildInternalEmail(form(), { leadId: null, storeOutcome: "unconfirmed" }, config);
    assert.ok(email.subject.startsWith("[SAVE UNCONFIRMED] "));
    assert.ok(email.text.includes("Check booking_leads for jordan.rivera@example.com"));
  });

  it("escapes HTML in every submitted field and never links the website", () => {
    const hostile = sanitizeBookingFormData({
      ...validPayload(),
      company: "<script>x</script>",
      role: "<b>Boss</b>",
      sector: "\"quoted\"",
      website: "javascript:alert(1)",
      message: "<img src=x onerror=alert(1)>",
    });
    const { html } = buildInternalEmail(hostile, saved, config);
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<b>Boss"));
    assert.ok(!html.includes("<img"));
    assert.ok(!html.includes('href="javascript'));
    assert.ok(html.includes("&lt;script&gt;"));
  });
});

describe("client email", () => {
  it("uses fixed wording and never echoes free text", () => {
    const custom = sanitizeBookingFormData({
      ...validPayload(),
      role: "Buy cheap watches at spam.example",
      company: "Visit spam.example",
      message: "Click here spam.example",
      website: "spam.example",
    });
    const email = buildClientEmail(custom, saved, config);
    assert.ok(!email.text.includes("spam.example"));
    assert.ok(!email.html.includes("spam.example"));
    assert.ok(email.text.includes("the role you described"));
  });

  it("confirms known values and replies to the team", () => {
    const email = buildClientEmail(form(), saved, config);
    assert.deepEqual(email.to, ["jordan.rivera@example.com"]);
    assert.equal(email.replyTo, "team@agency.example");
    assert.ok(email.text.startsWith("Hi Jordan,"));
    assert.ok(email.text.includes("Role: Executive Assistant"));
    assert.ok(email.text.includes("Reference ID: 6c1e7b8a"));
  });

  it("hides numeric ids and missing references", () => {
    assert.ok(!buildClientEmail(form(), { leadId: "17", storeOutcome: "saved" }, config).text.includes("Reference ID"));
    assert.ok(!buildClientEmail(form(), { leadId: null, storeOutcome: "failed" }, config).text.includes("Reference ID"));
  });

  it("adds the call link only for an https URL", () => {
    const withLink = buildClientEmail(form(), saved, { ...config, calendarUrl: "https://cal.example/intro" });
    assert.ok(withLink.text.includes("Book a call: https://cal.example/intro"));
    assert.equal(httpsUrlOrNull("javascript:alert(1)"), null);
    assert.equal(httpsUrlOrNull("http://cal.example"), null);
    assert.equal(readEmailConfig({ VITE_BOOKING_CALENDAR_URL: "nope" }).calendarUrl, null);
  });

  it("sends preview deploys to the preview inbox, never production's", () => {
    assert.equal(readEmailConfig({ VERCEL_ENV: "production" }).internalTo, "lai@hendersonassociates.ca");
    assert.equal(readEmailConfig({}).internalTo, "lai@hendersonassociates.ca");
    assert.equal(readEmailConfig({ VERCEL_ENV: "preview" }).internalTo, "edrine.e@hendersonassociates.ca");
    assert.equal(
      readEmailConfig({ VERCEL_ENV: "preview", BOOKING_INTERNAL_TO: "team@agency.example" }).internalTo,
      "team@agency.example",
    );
  });
});

describe("sending", () => {
  const response = (status: number, headers: Record<string, string> = {}) =>
    new Response("{}", { status, headers });

  const options = (responses: Array<Response | Error>) => {
    const logs = captureLogs();
    let calls = 0;
    const bodies: unknown[] = [];
    return {
      logs,
      get calls() {
        return calls;
      },
      bodies,
      opts: {
        config,
        logger: logs.logger,
        retryDelayMaxMs: 1,
        fetch: (async (_url: unknown, init?: RequestInit) => {
          bodies.push(JSON.parse(String(init?.body)));
          const next = responses[calls++];
          if (next instanceof Error) throw next;
          return next;
        }) as typeof fetch,
      },
    };
  };

  it("sends once on success with reply_to set", async () => {
    const o = options([response(200)]);
    assert.equal(await sendInternalEmail(form(), saved, o.opts), "sent");
    assert.equal(o.calls, 1);
    assert.equal((o.bodies[0] as { reply_to: string }).reply_to, "jordan.rivera@example.com");
  });

  it("retries once after a rate limit", async () => {
    const o = options([response(429, { "retry-after": "0" }), response(200)]);
    assert.equal(await sendInternalEmail(form(), saved, o.opts), "sent");
    assert.equal(o.calls, 2);
    assert.deepEqual(o.logs.error, []);
  });

  it("fails after two provider errors and logs the status", async () => {
    const o = options([response(500), response(503)]);
    assert.equal(await sendInternalEmail(form(), saved, o.opts), "failed");
    assert.deepEqual(o.logs.error, [`${BOOKING_LOG.email} internal failed lead=${saved.leadId} status=503`]);
  });

  it("does not retry a client error", async () => {
    const o = options([response(422)]);
    assert.equal(await sendInternalEmail(form(), saved, o.opts), "failed");
    assert.equal(o.calls, 1);
  });

  it("treats network errors as failed", async () => {
    const o = options([new Error("offline"), new Error("offline")]);
    assert.equal(await sendInternalEmail(form(), { leadId: null, storeOutcome: "failed" }, o.opts), "failed");
    assert.deepEqual(o.logs.error, [`${BOOKING_LOG.email} internal failed lead=unsaved status=none`]);
  });

  it("skips without credentials and says so", async () => {
    const o = options([]);
    const result = await sendInternalEmail(form(), saved, { ...o.opts, config: { ...config, apiKey: "" } });
    assert.equal(result, "skipped");
    assert.equal(o.calls, 0);
    assert.deepEqual(o.logs.error, [`${BOOKING_LOG.email} internal skipped lead=${saved.leadId} status=none`]);
  });
});
