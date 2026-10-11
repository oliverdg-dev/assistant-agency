// Shared job-request model: option lists, form shape, sanitizing, validation and
// the text stored in booking_leads.message. Imported by the browser form, the
// Vercel function and the Vite dev middleware, so it must stay free of Node or
// network code (no Neon, no Resend, no process.env).

export const roleGroups = [
  {
    label: "Administrative & Virtual Support",
    roles: [
      "Virtual Assistant",
      "Executive Assistant",
      "Administrative Assistant",
      "Data Entry Specialist",
    ],
  },
  {
    label: "Customer Support & Success",
    roles: [
      "Customer Support Representative",
      "Customer Success Manager",
      "Technical Support Specialist",
      "Helpdesk Support",
    ],
  },
  {
    label: "Sales & Lead Generation",
    roles: [
      "Sales Representative",
      "Sales Development Representative (SDR)",
      "Lead Generation Specialist",
      "Appointment Setter",
    ],
  },
  {
    label: "Software Development & IT",
    roles: [
      "Software Developer",
      "Web Developer",
      "Full Stack Developer",
      "IT Support Specialist",
    ],
  },
  {
    label: "Marketing & Digital",
    roles: [
      "Marketing Specialist",
      "Digital Marketing Manager",
      "Social Media Manager",
      "SEO Specialist",
    ],
  },
  {
    label: "E-commerce Operations",
    roles: [
      "E-commerce Specialist",
      "Shopify Support Specialist",
      "Amazon Operations Specialist",
    ],
  },
  {
    label: "Finance & Accounting",
    roles: [
      "Bookkeeper",
      "Accountant",
      "Accounts Payable / Receivable Specialist",
    ],
  },
  {
    label: "Creative & Design",
    roles: ["Graphic Designer", "Video Editor", "UI/UX Designer", "Content Writer"],
  },
] as const;

export const roles: readonly string[] = roleGroups.flatMap((group) => group.roles);

export const budgets = [
  "Under $1,000/mo",
  "$1,000 – $2,500/mo",
  "$2,500 – $5,000/mo",
  "$5,000 – $10,000/mo",
  "$10,000+/mo",
  "Not sure yet",
] as const;

export const headcounts = ["1", "2-3", "4-10", "11+"] as const;

export const engagementTypes = ["Full-time", "Part-time", "Project-based"] as const;

export const startTimeframes = [
  "As soon as possible",
  "Within a month",
  "In 1-3 months",
  "Just exploring",
] as const;

export const countries = ["United States", "Canada", "Other"] as const;

// Stored when an older cached version of the form submits without the newer
// fields, so a deploy never turns a real request into an unrecoverable error.
export const NOT_SPECIFIED = "Not specified";

// Name of the hidden anti-spam field. Real visitors never see or fill it.
export const HONEYPOT_FIELD = "hp_contact_ref";

// Time budgets shared by the server pipeline and the browser form.
// Server worst case: store 8s + two emails x (3s + 1s wait + 3s) = 22s,
// which stays under the 30s function limit in vercel.json. The browser waits
// a little longer than that before giving up.
export const BOOKING_TIMEOUTS = {
  storeMs: 8_000,
  emailAttemptMs: 3_000,
  emailRetryDelayMaxMs: 1_000,
  functionMaxMs: 30_000,
  clientAbortMs: 28_000,
  clientSlowNoticeMs: 6_000,
} as const;

export interface BookingFormData {
  role: string;
  headcount: string;
  engagementType: string;
  startTimeframe: string;
  sector: string;
  message: string;
  budget: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  website: string;
  country: string;
  submissionId: string;
  // Where the request came from. Filled in by the browser (src/lib/attribution.ts),
  // never typed by the visitor, and optional: older form versions don't send them.
  landingPath: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  timeZone: string;
}

// Fields the browser fills in by itself; they never show an error to the visitor.
export const SOURCE_FIELDS = [
  "landingPath",
  "referrer",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "timeZone",
] as const;

export type BookingField = Exclude<keyof BookingFormData, "submissionId" | (typeof SOURCE_FIELDS)[number]>;
export type BookingFieldErrors = Partial<Record<BookingField, string>>;

export interface BookingApiSuccess {
  ok: true;
  message: string;
  // Present when the request was saved to the database. Absent when it reached
  // the team by email only, or for a dropped spam submission.
  leadId?: string;
}

export interface BookingApiError {
  ok: false;
  message: string;
  fieldErrors?: BookingFieldErrors;
}

export type BookingApiResponse = BookingApiSuccess | BookingApiError;

const MAX_LENGTHS: Record<keyof BookingFormData, number> = {
  role: 120,
  headcount: 20,
  engagementType: 40,
  startTimeframe: 40,
  sector: 120,
  message: 2000,
  budget: 80,
  firstName: 80,
  lastName: 80,
  email: 160,
  company: 160,
  website: 200,
  country: 40,
  submissionId: 64,
  landingPath: 300,
  referrer: 300,
  utmSource: 100,
  utmMedium: 100,
  utmCampaign: 100,
  timeZone: 64,
};

// Composed text is capped so it always fits the message column.
export const MAX_COMPOSED_MESSAGE_LENGTH = 4000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emptyBookingForm = (): BookingFormData => ({
  role: "",
  headcount: "1",
  engagementType: "",
  startTimeframe: "",
  sector: "",
  message: "",
  budget: "",
  firstName: "",
  lastName: "",
  email: "",
  company: "",
  website: "",
  country: "",
  submissionId: "",
  landingPath: "",
  referrer: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  timeZone: "",
});

export const sanitizeBookingFormData = (
  input: Partial<Record<string, unknown>>,
): BookingFormData => {
  const read = (field: keyof BookingFormData) =>
    sanitizeText(input[field], MAX_LENGTHS[field]);

  return {
    role: read("role"),
    headcount: read("headcount"),
    engagementType: read("engagementType"),
    startTimeframe: read("startTimeframe"),
    sector: read("sector"),
    message: sanitizeMultiline(input.message, MAX_LENGTHS.message),
    budget: read("budget"),
    firstName: read("firstName"),
    lastName: read("lastName"),
    email: read("email").toLowerCase(),
    company: read("company"),
    website: read("website"),
    country: read("country"),
    submissionId: read("submissionId"),
    landingPath: read("landingPath"),
    referrer: read("referrer"),
    utmSource: read("utmSource"),
    utmMedium: read("utmMedium"),
    utmCampaign: read("utmCampaign"),
    timeZone: read("timeZone"),
  };
};

// Server-side only: fill the fields that older form versions never sent.
export const applyLegacyDefaults = (form: BookingFormData): BookingFormData => ({
  ...form,
  headcount: form.headcount || NOT_SPECIFIED,
  engagementType: form.engagementType || NOT_SPECIFIED,
});

const isOneOf = (list: readonly string[], value: string) => list.includes(value);

export const validateBookingFormData = (
  form: BookingFormData,
): BookingFieldErrors => {
  const errors: BookingFieldErrors = {};

  if (!form.role) errors.role = "Tell us which role you need.";

  if (!form.headcount) {
    errors.headcount = "Choose how many people you need.";
  } else if (!isOneOf([...headcounts, NOT_SPECIFIED], form.headcount)) {
    errors.headcount = "Choose one of the listed team sizes.";
  }

  if (!form.engagementType) {
    errors.engagementType = "Choose full-time, part-time or project-based.";
  } else if (!isOneOf([...engagementTypes, NOT_SPECIFIED], form.engagementType)) {
    errors.engagementType = "Choose one of the listed options.";
  }

  if (form.startTimeframe && !isOneOf(startTimeframes, form.startTimeframe)) {
    errors.startTimeframe = "Choose one of the listed start times.";
  }

  if (!form.sector) errors.sector = "Tell us your industry.";

  if (!form.budget) {
    errors.budget = "Choose a budget range, or \"Not sure yet\".";
  } else if (!isOneOf(budgets, form.budget)) {
    errors.budget = "Choose one of the listed budget ranges.";
  }

  if (!form.firstName) errors.firstName = "Enter your first name.";
  if (!form.lastName) errors.lastName = "Enter your last name.";

  if (!form.email) {
    errors.email = "Enter your work email.";
  } else if (!EMAIL_RE.test(form.email)) {
    errors.email = "Enter an email address like name@company.com.";
  }

  if (!form.company) errors.company = "Enter your company name.";

  if (form.country && !isOneOf(countries, form.country)) {
    errors.country = "Choose one of the listed countries.";
  }

  return errors;
};

// The labelled text saved in booking_leads.message. The table has no columns
// for these fields yet (see TODOS.md), so the team reads them here. Free-text
// notes always sit below the delimiter so they can't imitate the labels.
export const composeMessage = (form: BookingFormData): string => {
  const lines = [
    `Business sector: ${form.sector}`,
    `Headcount: ${form.headcount}`,
    `Engagement: ${form.engagementType}`,
  ];
  if (form.startTimeframe) lines.push(`Start: ${form.startTimeframe}`);
  if (form.website) lines.push(`Website: ${form.website}`);
  if (form.country) lines.push(`Country: ${form.country}`);
  if (form.submissionId) lines.push(`Submission ID: ${form.submissionId}`);

  const notes = form.message.trim();
  const composed = notes
    ? `${lines.join("\n")}\n\n--- Notes ---\n${notes}`
    : lines.join("\n");

  return composed.slice(0, MAX_COMPOSED_MESSAGE_LENGTH);
};

// Sequential numeric ids would tell a visitor how many requests came before
// theirs, so only opaque ids (uuids) are shown as a reference.
export const displayReference = (leadId: string | undefined | null): string | null =>
  leadId && !/^\d+$/.test(leadId) ? leadId : null;

const sanitizeText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
};

// Like sanitizeText, but keeps line breaks so notes stay readable.
const sanitizeMultiline = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
};
