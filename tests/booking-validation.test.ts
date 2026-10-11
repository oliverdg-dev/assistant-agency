import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyLegacyDefaults,
  composeMessage,
  displayReference,
  emptyBookingForm,
  MAX_COMPOSED_MESSAGE_LENGTH,
  NOT_SPECIFIED,
  sanitizeBookingFormData,
  validateBookingFormData,
} from "../api/_lib/booking.ts";
import { legacyPayload, validPayload } from "./fixtures.ts";

describe("sanitizeBookingFormData", () => {
  it("trims, collapses whitespace and lowercases the email", () => {
    const form = sanitizeBookingFormData({
      ...validPayload(),
      firstName: "  Jordan   Lee ",
      email: "  Jordan@Example.COM ",
    });
    assert.equal(form.firstName, "Jordan Lee");
    assert.equal(form.email, "jordan@example.com");
  });

  it("keeps line breaks in notes but drops extra blank lines", () => {
    const form = sanitizeBookingFormData({
      ...validPayload(),
      message: "Line one  \r\n\r\n\r\n\r\n   Line two",
    });
    assert.equal(form.message, "Line one\n\nLine two");
  });

  it("truncates to the field limits", () => {
    const form = sanitizeBookingFormData({
      ...validPayload(),
      role: "x".repeat(500),
      message: "y".repeat(5000),
    });
    assert.equal(form.role.length, 120);
    assert.equal(form.message.length, 2000);
  });

  it("treats non-string values as empty", () => {
    const form = sanitizeBookingFormData({ firstName: 42, role: { a: 1 } });
    assert.equal(form.firstName, "");
    assert.equal(form.role, "");
  });
});

describe("validateBookingFormData", () => {
  it("accepts a complete request", () => {
    const form = sanitizeBookingFormData(validPayload());
    assert.deepEqual(validateBookingFormData(form), {});
  });

  it("reports every required field on an empty form", () => {
    const errors = validateBookingFormData({ ...emptyBookingForm(), headcount: "" });
    assert.deepEqual(Object.keys(errors).sort(), [
      "budget",
      "company",
      "email",
      "engagementType",
      "firstName",
      "headcount",
      "lastName",
      "role",
      "sector",
    ]);
  });

  it("accepts a free-text role that is not in the suggestion list", () => {
    const form = sanitizeBookingFormData({ ...validPayload(), role: "Logistics Coordinator" });
    assert.equal(validateBookingFormData(form).role, undefined);
  });

  it("rejects values outside the option lists", () => {
    const form = sanitizeBookingFormData({
      ...validPayload(),
      headcount: "500",
      engagementType: "Freelance",
      startTimeframe: "Yesterday",
      budget: "$1",
      country: "Mars",
    });
    const errors = validateBookingFormData(form);
    assert.ok(errors.headcount);
    assert.ok(errors.engagementType);
    assert.ok(errors.startTimeframe);
    assert.ok(errors.budget);
    assert.ok(errors.country);
  });

  it("rejects a malformed email", () => {
    const form = sanitizeBookingFormData({ ...validPayload(), email: "jordan@" });
    assert.ok(validateBookingFormData(form).email);
  });

  it("accepts an old-form payload once legacy defaults are applied", () => {
    const form = applyLegacyDefaults(sanitizeBookingFormData(legacyPayload()));
    assert.equal(form.headcount, NOT_SPECIFIED);
    assert.equal(form.engagementType, NOT_SPECIFIED);
    assert.deepEqual(validateBookingFormData(form), {});
  });
});

describe("composeMessage", () => {
  it("writes labelled lines in a fixed order, then the notes", () => {
    const form = sanitizeBookingFormData(validPayload());
    assert.equal(
      composeMessage(form),
      [
        "Business sector: Logistics",
        "Headcount: 2-3",
        "Engagement: Full-time",
        "Start: Within a month",
        "Website: northwind.example",
        "Country: Canada",
        "Submission ID: 3f1c2b9e-1111-4c4c-9d9d-123456789abc",
        "",
        "--- Notes ---",
        "Inbox and calendar management.",
        "HubSpot experience preferred.",
      ].join("\n"),
    );
  });

  it("omits empty optional lines and the notes section", () => {
    const form = sanitizeBookingFormData({
      ...validPayload(),
      startTimeframe: "",
      website: "",
      country: "",
      submissionId: "",
      message: "",
    });
    assert.equal(
      composeMessage(form),
      "Business sector: Logistics\nHeadcount: 2-3\nEngagement: Full-time",
    );
  });

  it("keeps notes that imitate labels below the delimiter", () => {
    const form = sanitizeBookingFormData({ ...validPayload(), message: "Headcount: 11+" });
    const [header, notes] = composeMessage(form).split("--- Notes ---");
    assert.match(header, /^Headcount: 2-3$/m);
    assert.equal(notes.trim(), "Headcount: 11+");
  });

  it("caps the composed text", () => {
    const form = { ...sanitizeBookingFormData(validPayload()), message: "z".repeat(10_000) };
    assert.equal(composeMessage(form).length, MAX_COMPOSED_MESSAGE_LENGTH);
  });
});

describe("displayReference", () => {
  it("shows opaque ids and hides sequential numbers", () => {
    assert.equal(displayReference("3f1c2b9e-aaaa"), "3f1c2b9e-aaaa");
    assert.equal(displayReference("42"), null);
    assert.equal(displayReference(undefined), null);
  });
});
