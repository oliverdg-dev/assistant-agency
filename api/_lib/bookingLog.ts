// Exact log prefixes for the job-request pipeline. docs/RUNBOOK.md tells the
// team to search Vercel logs for these strings, and tests assert them, so
// change them in both places together. Log lines never include the
// submitter's name, email, company or notes.
export const BOOKING_LOG = {
  config: "Booking config: missing",
  honeypot: "Booking honeypot hit",
  storeFailed: "Booking submission failed: store",
  savedByEmailOnly: "Booking submission saved by email only",
  bothFailed: "Booking submission failed: store and internal email",
  email: "Booking email",
  duplicate: "Booking duplicate submission",
  notifyMarkFailed: "Booking notified flag not saved",
} as const;

export interface BookingLogger {
  warn: (message: string) => void;
  error: (message: string) => void;
}
