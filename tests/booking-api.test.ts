import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BOOKING_TIMEOUTS, HONEYPOT_FIELD } from "../api/_lib/booking.ts";
import {
  BOOKING_LOG,
  bookingConfigStatus,
  handleBookingHttp,
  processBookingSubmission,
  UNREADABLE_BODY,
  type BookingDeps,
} from "../api/_lib/bookingApi.ts";
import type { EmailContext, SendResult } from "../api/_lib/bookingEmail.ts";
import { BookingConfigError } from "../api/_lib/bookingServer.ts";
import { captureLogs, legacyPayload, validPayload } from "./fixtures.ts";

type StoreBehaviour = "ok" | "throws" | "missing-config" | "hangs";

// Fake pipeline dependencies that record what was called, in order.
const fakeDeps = (store: StoreBehaviour, internal: SendResult, client: SendResult = "sent") => {
  const calls: string[] = [];
  const contexts: Record<string, EmailContext> = {};
  const logs = captureLogs();
  const deps: Partial<BookingDeps> = {
    logger: logs.logger,
    storeTimeoutMs: 20,
    store: async () => {
      calls.push("store");
      if (store === "throws") throw Object.assign(new Error("db down"), { code: "57P01" });
      if (store === "missing-config") throw new BookingConfigError("no db");
      if (store === "hangs") return new Promise(() => {});
      return { id: "6c1e7b8a-0000-4000-8000-000000000001" };
    },
    sendInternal: async (_form, context) => {
      calls.push("internal");
      contexts.internal = context;
      return internal;
    },
    sendClient: async (_form, context) => {
      calls.push("client");
      contexts.client = context;
      return client;
    },
  };
  return { deps, calls, contexts, logs };
};

describe("processBookingSubmission outcome matrix", () => {
  const cases: Array<{
    name: string;
    store: StoreBehaviour;
    internal: SendResult;
    status: number;
    leadId: boolean;
    clientCalled: boolean;
    storeOutcome: EmailContext["storeOutcome"];
  }> = [
    { name: "store ok + internal sent", store: "ok", internal: "sent", status: 200, leadId: true, clientCalled: true, storeOutcome: "saved" },
    { name: "store ok + internal failed", store: "ok", internal: "failed", status: 200, leadId: true, clientCalled: true, storeOutcome: "saved" },
    { name: "store ok + internal skipped", store: "ok", internal: "skipped", status: 200, leadId: true, clientCalled: true, storeOutcome: "saved" },
    { name: "store failed + internal sent", store: "throws", internal: "sent", status: 200, leadId: false, clientCalled: true, storeOutcome: "failed" },
    { name: "store failed + internal failed", store: "throws", internal: "failed", status: 500, leadId: false, clientCalled: false, storeOutcome: "failed" },
    { name: "store failed + internal skipped", store: "throws", internal: "skipped", status: 500, leadId: false, clientCalled: false, storeOutcome: "failed" },
    { name: "store timeout + internal sent", store: "hangs", internal: "sent", status: 200, leadId: false, clientCalled: true, storeOutcome: "unconfirmed" },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const { deps, calls, contexts } = fakeDeps(c.store, c.internal);
      const result = await processBookingSubmission(validPayload(), deps);

      assert.equal(result.status, c.status);
      assert.equal(result.body.ok, c.status === 200);
      assert.equal("leadId" in result.body && Boolean(result.body.leadId), c.leadId);
      assert.equal(calls.includes("client"), c.clientCalled);
      assert.equal(contexts.internal.storeOutcome, c.storeOutcome);
      if (c.store !== "ok" && c.clientCalled) {
        // On the fallback path the team is emailed before the client.
        assert.deepEqual(calls.slice(-2), ["internal", "client"]);
      }
    });
  }

  it("logs the store failure cause and pg code", async () => {
    const { deps, logs } = fakeDeps("throws", "sent");
    await processBookingSubmission(validPayload(), deps);
    assert.ok(logs.error.includes(`${BOOKING_LOG.storeFailed} cause=db_error code=57P01`));
    assert.ok(logs.warn.includes(BOOKING_LOG.savedByEmailOnly));
  });

  it("distinguishes a missing database config from an outage", async () => {
    const { deps, logs } = fakeDeps("missing-config", "failed");
    const result = await processBookingSubmission(validPayload(), deps);
    assert.equal(result.status, 500);
    assert.ok(logs.error.includes(`${BOOKING_LOG.storeFailed} cause=missing_config code=none`));
    assert.ok(logs.error.includes(BOOKING_LOG.bothFailed));
  });

  it("logs a store timeout as unconfirmed", async () => {
    const { deps, logs } = fakeDeps("hangs", "sent");
    await processBookingSubmission(validPayload(), deps);
    assert.ok(logs.error.includes(`${BOOKING_LOG.storeFailed} cause=timeout code=none`));
  });

  it("never writes the submitter's details to the logs", async () => {
    const { deps, logs } = fakeDeps("throws", "failed");
    await processBookingSubmission(validPayload(), deps);
    const all = [...logs.warn, ...logs.error].join("\n").toLowerCase();
    for (const secret of ["jordan", "rivera", "northwind", "example.com"]) {
      assert.ok(!all.includes(secret), `log leaked ${secret}`);
    }
  });
});

describe("processBookingSubmission input handling", () => {
  it("returns field errors without touching the store", async () => {
    const { deps, calls } = fakeDeps("ok", "sent");
    const result = await processBookingSubmission({ ...validPayload(), email: "nope" }, deps);
    assert.equal(result.status, 400);
    assert.ok("fieldErrors" in result.body && result.body.fieldErrors?.email);
    assert.deepEqual(calls, []);
  });

  it("accepts a payload from the previous form version", async () => {
    const { deps, calls } = fakeDeps("ok", "sent");
    const result = await processBookingSubmission(legacyPayload(), deps);
    assert.equal(result.status, 200);
    assert.deepEqual(calls.sort(), ["client", "internal", "store"]);
  });

  it("drops honeypot submissions without storing or emailing", async () => {
    const { deps, calls, logs } = fakeDeps("ok", "sent");
    const result = await processBookingSubmission(
      { ...validPayload(), [HONEYPOT_FIELD]: "http://spam.example" },
      deps,
    );
    assert.equal(result.status, 200);
    assert.ok(result.body.ok && !result.body.leadId);
    assert.deepEqual(calls, []);
    assert.deepEqual(logs.warn, [BOOKING_LOG.honeypot]);
  });

  it("ignores a whitespace-only honeypot value", async () => {
    const { deps, calls } = fakeDeps("ok", "sent");
    await processBookingSubmission({ ...validPayload(), [HONEYPOT_FIELD]: "   " }, deps);
    assert.ok(calls.includes("store"));
  });
});

describe("handleBookingHttp", () => {
  const ok = () => fakeDeps("ok", "sent").deps;

  it("rejects other methods with 405 and an Allow header", async () => {
    const result = await handleBookingHttp({ method: "GET", body: undefined }, ok());
    assert.equal(result.status, 405);
    assert.equal(result.headers?.Allow, "POST");
  });

  it("accepts an already-parsed object body", async () => {
    const result = await handleBookingHttp({ method: "POST", body: validPayload() }, ok());
    assert.equal(result.status, 200);
  });

  it("parses a JSON string body", async () => {
    const result = await handleBookingHttp(
      { method: "POST", body: JSON.stringify(validPayload()) },
      ok(),
    );
    assert.equal(result.status, 200);
  });

  for (const body of ["{not json", "", "   ", "[]", "null", "42", '"text"', UNREADABLE_BODY]) {
    it(`answers 400 for an unreadable body (${String(body)})`, async () => {
      const result = await handleBookingHttp({ method: "POST", body }, ok());
      assert.equal(result.status, 400);
      assert.equal(result.body.ok, false);
    });
  }

  it("treats a missing body as an empty submission (field errors)", async () => {
    const result = await handleBookingHttp({ method: "POST", body: undefined }, ok());
    assert.equal(result.status, 400);
    assert.ok("fieldErrors" in result.body && result.body.fieldErrors);
  });
});

describe("configuration and budgets", () => {
  it("names missing env vars without their values", () => {
    assert.deepEqual(bookingConfigStatus({}), [
      "POSTGRES_URL",
      "RESEND_API_KEY",
      "BOOKING_FROM_EMAIL",
    ]);
    assert.deepEqual(
      bookingConfigStatus({ DATABASE_URL: "x", RESEND_API_KEY: "y", BOOKING_FROM_EMAIL: "z" }),
      [],
    );
  });

  it("keeps the worst-case server time inside the function limit", () => {
    const perEmail = BOOKING_TIMEOUTS.emailAttemptMs * 2 + BOOKING_TIMEOUTS.emailRetryDelayMaxMs;
    const worst = BOOKING_TIMEOUTS.storeMs + perEmail * 2;
    assert.ok(worst < BOOKING_TIMEOUTS.functionMaxMs);
    assert.ok(BOOKING_TIMEOUTS.clientAbortMs > worst);
    assert.ok(BOOKING_TIMEOUTS.clientAbortMs < BOOKING_TIMEOUTS.functionMaxMs);
  });
});
