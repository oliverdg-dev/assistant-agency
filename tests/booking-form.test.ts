import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyBookingForm, type BookingFormData } from "../api/_lib/booking.ts";
import {
  clampStep,
  filterRoleGroups,
  firstIncompleteStep,
  isExactRole,
  parseFormDeepLink,
  STEP_FIELDS,
  stepForFieldErrors,
  validateStep,
} from "../src/lib/bookingForm.ts";

const stepOneDone = (): BookingFormData => ({
  ...emptyBookingForm(),
  role: "Bookkeeper",
  headcount: "1",
  engagementType: "Part-time",
});

const stepTwoDone = (): BookingFormData => ({
  ...stepOneDone(),
  sector: "Retail",
  budget: "Not sure yet",
});

describe("step ownership", () => {
  it("assigns every validated field to exactly one step", () => {
    const owned = [...STEP_FIELDS[1], ...STEP_FIELDS[2], ...STEP_FIELDS[3]];
    assert.equal(new Set(owned).size, owned.length);
    const errorsOnEmpty = Object.keys(validateStep(1, emptyBookingForm()))
      .concat(Object.keys(validateStep(2, emptyBookingForm())))
      .concat(Object.keys(validateStep(3, emptyBookingForm())));
    for (const field of errorsOnEmpty) assert.ok(owned.includes(field as never));
  });

  it("only reports the current step's errors", () => {
    assert.deepEqual(Object.keys(validateStep(1, emptyBookingForm())).sort(), ["engagementType", "role"]);
    assert.deepEqual(Object.keys(validateStep(2, stepOneDone())).sort(), ["budget", "sector"]);
  });

  it("finds the earliest step that owns a server error", () => {
    assert.equal(stepForFieldErrors({ email: "x", sector: "y" }), 2);
    assert.equal(stepForFieldErrors({ role: "x" }), 1);
    assert.equal(stepForFieldErrors({}), null);
  });
});

describe("clampStep", () => {
  it("never shows a step past the first incomplete one", () => {
    assert.equal(clampStep("3", emptyBookingForm()), 1);
    assert.equal(clampStep("3", stepOneDone()), 2);
    assert.equal(clampStep("3", stepTwoDone()), 3);
  });

  it("treats missing or odd values as step 1", () => {
    assert.equal(clampStep(null, stepTwoDone()), 1);
    assert.equal(clampStep("7", stepTwoDone()), 1);
    assert.equal(clampStep("abc", stepTwoDone()), 1);
  });

  it("allows going back to an earlier step", () => {
    assert.equal(clampStep("1", stepTwoDone()), 1);
    assert.equal(firstIncompleteStep(stepTwoDone()), 3);
  });
});

describe("parseFormDeepLink", () => {
  it("accepts exact role, category and headcount values", () => {
    assert.deepEqual(
      parseFormDeepLink("?role=Bookkeeper&category=Finance+%26+Accounting&headcount=4-10"),
      { role: "Bookkeeper", category: "Finance & Accounting", headcount: "4-10" },
    );
  });

  it("ignores anything that isn't an exact match", () => {
    assert.deepEqual(parseFormDeepLink("?role=bookkeeper&category=Spam&headcount=99"), {});
    assert.deepEqual(parseFormDeepLink("?role=%3Cscript%3E"), {});
  });
});

describe("role suggestions", () => {
  it("filters by text across all groups", () => {
    const groups = filterRoleGroups("support");
    const all = groups.flatMap((group) => group.roles);
    assert.ok(all.includes("Shopify Support Specialist"));
    assert.ok(all.includes("IT Support Specialist"));
    assert.ok(all.every((role) => role.toLowerCase().includes("support")));
  });

  it("shows one category when opened from a category link", () => {
    const groups = filterRoleGroups("", "Creative & Design");
    assert.deepEqual(groups.map((group) => group.label), ["Creative & Design"]);
  });

  it("recognises exact roles only", () => {
    assert.equal(isExactRole("Video Editor"), true);
    assert.equal(isExactRole("Video"), false);
  });
});
