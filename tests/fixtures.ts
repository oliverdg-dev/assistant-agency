import type { BookingFormData } from "../api/_lib/booking.ts";

// A complete, valid job request as the current form sends it.
export const validPayload = (): Record<string, unknown> & BookingFormData => ({
  role: "Executive Assistant",
  headcount: "2-3",
  engagementType: "Full-time",
  startTimeframe: "Within a month",
  sector: "Logistics",
  message: "Inbox and calendar management.\nHubSpot experience preferred.",
  budget: "$2,500 – $5,000/mo",
  firstName: "Jordan",
  lastName: "Rivera",
  email: "Jordan.Rivera@Example.com",
  company: "Northwind Freight",
  website: "northwind.example",
  country: "Canada",
  submissionId: "3f1c2b9e-1111-4c4c-9d9d-123456789abc",
  landingPath: "/how-it-works",
  referrer: "https://www.google.com/",
  utmSource: "linkedin",
  utmMedium: "paid",
  utmCampaign: "fall-launch",
  timeZone: "America/Toronto",
});

// Shape sent by the previous single-page form (cached bundles during deploy).
export const legacyPayload = (): Record<string, unknown> => ({
  firstName: "Sam",
  lastName: "Lee",
  email: "sam@example.com",
  company: "Acme",
  sector: "SaaS",
  role: "Virtual Assistant",
  budget: "Under $1,000/mo",
  startDate: "",
  timeSlot: "",
  message: "",
});

export interface CapturedLogs {
  warn: string[];
  error: string[];
  logger: { warn: (m: string) => void; error: (m: string) => void };
}

export const captureLogs = (): CapturedLogs => {
  const warn: string[] = [];
  const error: string[] = [];
  return {
    warn,
    error,
    logger: {
      warn: (m) => warn.push(m),
      error: (m) => error.push(m),
    },
  };
};
