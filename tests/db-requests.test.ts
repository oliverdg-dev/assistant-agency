import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { sanitizeBookingFormData, type BookingFormData } from "../api/_lib/booking.ts";
import { processBookingSubmission, type BookingDeps } from "../api/_lib/bookingApi.ts";
import type { EmailContext, SendResult } from "../api/_lib/bookingEmail.ts";
import { createBookingStore } from "../api/_lib/bookingServer.ts";
import type { TransactionalDb } from "../api/_lib/db.ts";
import { openLocalDb } from "../api/_lib/dbLocal.ts";
import {
  applyMigrations,
  checkMigrationTarget,
  loadMigrations,
  MigrationError,
  migrationStatus,
  type Migration,
} from "../api/_lib/migrate.ts";
import { REQUEST_STATUSES } from "../api/_lib/requestStatus.ts";
import { attributionFrom } from "../src/lib/attribution.ts";
import { captureLogs, validPayload } from "./fixtures.ts";

// These tests run real SQL against an in-process Postgres (PGlite), one fresh
// database per test. PGlite has a single connection, so "concurrent" calls
// here run one after another; true races need npm run test:db (not yet).

const migrations = loadMigrations();

const freshDb = async (upTo = migrations.length) => {
  const local = await openLocalDb();
  await applyMigrations(local.db, migrations.slice(0, upTo));
  return local;
};

type LeadRow = Record<string, unknown>;
const leads = (db: TransactionalDb) => db.query<LeadRow>("SELECT * FROM booking_leads ORDER BY created_at");

const pipeline = (db: TransactionalDb, internal: SendResult = "sent") => {
  const sent: Array<{ to: "internal" | "client"; context: EmailContext }> = [];
  const logs = captureLogs();
  const { store, markNotified } = createBookingStore(db);
  const deps: Partial<BookingDeps> = {
    store,
    markNotified,
    logger: logs.logger,
    storeTimeoutMs: 5_000,
    sendInternal: async (_form, context) => {
      sent.push({ to: "internal", context });
      return internal;
    },
    sendClient: async (_form, context) => {
      sent.push({ to: "client", context });
      return "sent";
    },
  };
  return { deps, sent, logs };
};

const form = (overrides: Partial<BookingFormData> = {}): BookingFormData => ({
  ...sanitizeBookingFormData(validPayload()),
  ...overrides,
});

describe("migrations", () => {
  it("applies every file once and records it", async () => {
    const { db, close } = await openLocalDb();
    assert.deepEqual(await applyMigrations(db, migrations), migrations.map((m) => m.name));
    assert.deepEqual(await applyMigrations(db, migrations), []);
    const status = await migrationStatus(db, migrations);
    assert.equal(status.pending.length, 0);
    assert.deepEqual(status.changed, []);
    await close();
  });

  it("refuses to run when an applied file was edited", async () => {
    const { db, close } = await freshDb();
    const edited: Migration[] = migrations.map((m, i) => (i === 0 ? { ...m, checksum: "edited" } : m));
    await assert.rejects(applyMigrations(db, edited), MigrationError);
    await close();
  });

  it("rolls back a failing file and leaves it pending", async () => {
    const { db, close } = await freshDb();
    const broken: Migration = {
      name: "9999_broken.sql",
      sql: "CREATE TABLE half_done (id int); SELECT * FROM table_that_does_not_exist;",
      checksum: "x",
    };
    await assert.rejects(applyMigrations(db, [...migrations, broken]), /9999_broken\.sql failed/);
    const tables = await db.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'half_done'");
    assert.equal(tables.length, 0);
    const status = await migrationStatus(db, [...migrations, broken]);
    assert.deepEqual(status.pending.map((m) => m.name), ["9999_broken.sql"]);
    await close();
  });

  it("gives requests stored before the migration a status and no events", async () => {
    const { db, close } = await freshDb(1);
    await db.query(
      `INSERT INTO booking_leads (first_name, last_name, email, company, role, budget, message)
       VALUES ('Old', 'Lead', 'old@example.com', 'Oldco', 'Bookkeeper', 'Not sure yet', 'Business sector: Retail')`,
    );
    await applyMigrations(db, migrations);
    const [row] = await leads(db);
    assert.equal(row.status, "received");
    assert.equal(row.submission_id, null);
    const events = await db.query("SELECT 1 FROM request_events");
    assert.equal(events.length, 0);
    await close();
  });

  it("keeps the status CHECK constraint in step with REQUEST_STATUSES", () => {
    const sql = readFileSync("db/migrations/0001_request_columns.sql", "utf8");
    const list = sql.match(/booking_leads_status_check CHECK \(status IN \(([^)]*)\)/s)?.[1] ?? "";
    const inSql = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    assert.deepEqual(inSql, [...REQUEST_STATUSES]);
  });
});

describe("storing a request", () => {
  it("writes every form field to its own column and keeps the message text", async () => {
    const { db, close } = await freshDb();
    await createBookingStore(db).store(form());
    const [row] = await leads(db);
    assert.equal(row.headcount, "2-3");
    assert.equal(row.engagement_type, "Full-time");
    assert.equal(row.start_timeframe, "Within a month");
    assert.equal(row.sector, "Logistics");
    assert.equal(row.website, "northwind.example");
    assert.equal(row.country, "Canada");
    assert.equal(row.landing_path, "/how-it-works");
    assert.equal(row.utm_campaign, "fall-launch");
    assert.equal(row.client_time_zone, "America/Toronto");
    assert.equal(row.status, "received");
    assert.match(String(row.message), /Business sector: Logistics/);
    await close();
  });

  it("stores blank optional fields as NULL", async () => {
    const { db, close } = await freshDb();
    await createBookingStore(db).store(form({ website: "", country: "", startTimeframe: "", referrer: "" }));
    const [row] = await leads(db);
    assert.equal(row.website, null);
    assert.equal(row.country, null);
    assert.equal(row.start_timeframe, null);
    assert.equal(row.referrer, null);
    await close();
  });

  it("returns the same request for a repeated submission id", async () => {
    const { db, close } = await freshDb();
    const { store } = createBookingStore(db);
    const first = await store(form());
    const second = await store(form());
    assert.equal(second.id, first.id);
    assert.equal(first.notify, true);
    assert.equal(second.notify, false);
    assert.equal(second.duplicate, true);
    assert.equal((await leads(db)).length, 1);
    await close();
  });
});

describe("intake pipeline with a real database", () => {
  it("emails once, then treats a retry as a duplicate", async () => {
    const { db, close } = await freshDb();
    const { deps, sent, logs } = pipeline(db);
    const first = await processBookingSubmission(validPayload(), deps);
    const second = await processBookingSubmission(validPayload(), deps);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.ok(first.body.ok && second.body.ok && first.body.leadId === second.body.leadId);
    assert.deepEqual(sent.map((s) => s.to).sort(), ["client", "internal"]);
    const [row] = await leads(db);
    assert.ok(row.internal_notified_at);
    assert.ok(logs.warn.some((line) => line.startsWith("Booking duplicate submission")));
    await close();
  });

  it("sends once when two identical submissions arrive together", async () => {
    const { db, close } = await freshDb();
    const { deps, sent } = pipeline(db);
    await Promise.all([processBookingSubmission(validPayload(), deps), processBookingSubmission(validPayload(), deps)]);
    assert.equal(sent.filter((s) => s.to === "internal").length, 1);
    await close();
  });

  it("lets a later retry email the team if the first team email failed", async () => {
    const { db, close } = await freshDb();
    const failing = pipeline(db, "failed");
    await processBookingSubmission(validPayload(), failing.deps);
    const [row] = await leads(db);
    assert.equal(row.internal_notified_at, null);

    // A quick retry stays quiet: the first attempt still holds the claim.
    const quick = pipeline(db);
    await processBookingSubmission(validPayload(), quick.deps);
    assert.equal(quick.sent.length, 0);

    // After the claim goes stale, a retry takes it over and notifies.
    await db.query("UPDATE booking_leads SET internal_notify_claimed_at = now() - interval '11 minutes'");
    const later = pipeline(db);
    await processBookingSubmission(validPayload(), later.deps);
    assert.equal(later.sent.filter((s) => s.to === "internal").length, 1);
    const [after] = await leads(db);
    assert.ok(after.internal_notified_at);
    await close();
  });

  it("falls back to the team email when the new columns are missing (deploy before migrate)", async () => {
    const { db, close } = await freshDb(1);
    const { deps, sent, logs } = pipeline(db);
    const result = await processBookingSubmission(validPayload(), deps);
    assert.equal(result.status, 200);
    assert.ok(result.body.ok && !result.body.leadId);
    assert.equal(sent[0].context.storeOutcome, "failed");
    assert.ok(logs.error.some((line) => line.startsWith("Booking submission failed: store cause=db_error")));
    await close();
  });

  it("replaces a submission id that isn't a UUID", async () => {
    const { db, close } = await freshDb();
    const { deps } = pipeline(db);
    await processBookingSubmission({ ...validPayload(), submissionId: "lx9k2-abc123" }, deps);
    const [row] = await leads(db);
    assert.notEqual(row.submission_id, "lx9k2-abc123");
    assert.match(String(row.submission_id), /^[0-9a-f-]{36}$/);
    await close();
  });
});

describe("migration target guard", () => {
  const prod = { host: "ep-prod.neon.tech", productionHost: "ep-prod.neon.tech" };

  it("allows local and non-production databases", () => {
    assert.equal(checkMigrationTarget({ host: "ep-dev.neon.tech", productionHost: prod.host, interactive: false, production: false }).ok, true);
    assert.equal(checkMigrationTarget({ host: "localhost", interactive: false, production: false }).ok, true);
  });

  it("refuses production without --production", () => {
    assert.equal(checkMigrationTarget({ ...prod, interactive: true, production: false }).ok, false);
  });

  it("refuses production from a non-interactive run", () => {
    assert.equal(checkMigrationTarget({ ...prod, interactive: false, production: true }).ok, false);
  });

  it("refuses production from a preview build", () => {
    assert.equal(checkMigrationTarget({ ...prod, interactive: true, production: true, vercelEnv: "preview" }).ok, false);
  });

  it("allows production only when asked for explicitly, interactively", () => {
    assert.equal(checkMigrationTarget({ ...prod, interactive: true, production: true }).ok, true);
  });
});

describe("request source", () => {
  const location = { pathname: "/how-it-works", search: "?utm_source=linkedin&utm_medium=paid&utm_campaign=fall", origin: "https://agency.example" };

  it("keeps the landing path and UTM tags", () => {
    assert.deepEqual(attributionFrom(location, ""), {
      landingPath: "/how-it-works",
      referrer: "",
      utmSource: "linkedin",
      utmMedium: "paid",
      utmCampaign: "fall",
    });
  });

  it("keeps an outside referrer without its query string", () => {
    assert.equal(attributionFrom(location, "https://www.google.com/search?q=private").referrer, "https://www.google.com/search");
  });

  it("ignores our own site as a referrer", () => {
    assert.equal(attributionFrom(location, "https://agency.example/roles").referrer, "");
  });

  it("caps source fields at their maximum length", () => {
    const sanitized = sanitizeBookingFormData({ ...validPayload(), utmCampaign: "x".repeat(500), referrer: "y".repeat(500) });
    assert.equal(sanitized.utmCampaign.length, 100);
    assert.equal(sanitized.referrer.length, 300);
  });
});
