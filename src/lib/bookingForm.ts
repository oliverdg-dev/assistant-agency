import {
  headcounts,
  roleGroups,
  roles,
  validateBookingFormData,
  type BookingField,
  type BookingFieldErrors,
  type BookingFormData,
} from "../../api/_lib/booking.js";

/*
 * Pure logic for the three-step job request form (kept out of the component
 * so it can be unit-tested).
 *
 *   step 1 ──Continue──▶ step 2 ──Continue──▶ step 3 ──Send──▶ submitting ─┬─▶ success
 *     ▲                    │ ▲                  │                          └─▶ error (stays on 3,
 *     └───────Back─────────┘ └───────Back───────┘                              or jumps to the
 *                                                                              step with the error)
 * A step can't be entered (by URL or browser history) until every earlier
 * step is valid; clampStep enforces that.
 */

export type FormStep = 1 | 2 | 3;

export const STEP_FIELDS: Record<FormStep, BookingField[]> = {
  1: ["role", "headcount", "engagementType", "startTimeframe"],
  2: ["sector", "message", "budget"],
  3: ["firstName", "lastName", "email", "company", "website", "country"],
};

export const STEP_TITLES: Record<FormStep, string> = {
  1: "What kind of talent do you need?",
  2: "Tell us about the role",
  3: "How can our team reach you?",
};

export const STEP_LABELS: Record<FormStep, string> = {
  1: "Role",
  2: "Details",
  3: "Contact",
};

const STEPS: FormStep[] = [1, 2, 3];

export const validateStep = (step: FormStep, form: BookingFormData): BookingFieldErrors => {
  const all = validateBookingFormData(form);
  const errors: BookingFieldErrors = {};
  for (const field of STEP_FIELDS[step]) {
    if (all[field]) errors[field] = all[field];
  }
  return errors;
};

export const firstIncompleteStep = (form: BookingFormData): FormStep =>
  STEPS.find((step) => Object.keys(validateStep(step, form)).length > 0) ?? 3;

// The step to show for a requested step number (from ?step=), never past the
// first step that still has errors.
export const clampStep = (requested: unknown, form: BookingFormData): FormStep => {
  const parsed = Number(requested);
  const wanted: FormStep = parsed === 2 || parsed === 3 ? parsed : 1;
  return Math.min(wanted, firstIncompleteStep(form)) as FormStep;
};

// The earliest step that owns one of the server's field errors.
export const stepForFieldErrors = (errors: BookingFieldErrors): FormStep | null =>
  STEPS.find((step) => STEP_FIELDS[step].some((field) => errors[field])) ?? null;

export interface FormDeepLink {
  role?: string;
  category?: string;
  headcount?: string;
}

// Reads ?role=, ?category= and ?headcount=; only exact matches are used so a
// hand-edited URL can't put arbitrary text into the form.
export const parseFormDeepLink = (search: string): FormDeepLink => {
  const params = new URLSearchParams(search);
  const link: FormDeepLink = {};

  const role = params.get("role");
  if (role && roles.includes(role)) link.role = role;

  const category = params.get("category");
  if (category && roleGroups.some((group) => group.label === category)) link.category = category;

  const headcount = params.get("headcount");
  if (headcount && (headcounts as readonly string[]).includes(headcount)) link.headcount = headcount;

  return link;
};

export const isExactRole = (value: string) => roles.includes(value.trim());

// Role suggestions grouped by category, filtered by what the visitor typed.
export const filterRoleGroups = (query: string, category?: string) => {
  const q = query.trim().toLowerCase();
  return roleGroups
    .filter((group) => (q ? true : !category || group.label === category))
    .map((group) => ({
      label: group.label,
      roles: group.roles.filter((role) => !q || role.toLowerCase().includes(q)),
    }))
    .filter((group) => group.roles.length > 0);
};
