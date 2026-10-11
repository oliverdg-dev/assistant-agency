// Local-development stand-ins for Neon and Resend, used only by the Vite dev
// middleware (never by api/booking.ts). They let a developer submit the form
// and see the result without any accounts. Set BOOKING_DEV_FAKES=0 to use the
// real services, or to see the real failure path when they aren't configured.
//
// Storage, in order: POSTGRES_URL if set; otherwise the local database at
// .data/pglite once `npm run db:setup` has created it; otherwise memory.
import type { BookingFormData } from "./booking.js";
import type { BookingDeps } from "./bookingApi.js";
import { createBookingStore } from "./bookingServer.js";
import { LOCAL_DB_DIR, localDbExists, sharedLocalDb } from "./dbLocal.js";
import {
  buildClientEmail,
  buildInternalEmail,
  readEmailConfig,
  type EmailContext,
  type SendResult,
} from "./bookingEmail.js";

export const devBookingDeps = (env = process.env): Partial<BookingDeps> => {
  if (env.BOOKING_DEV_FAKES === "0") return {};

  const deps: Partial<BookingDeps> = {};
  const noDatabaseUrl = !env.POSTGRES_URL && !env.DATABASE_URL;
  const usingLocalDb = noDatabaseUrl && localDbExists();
  const usingFakeStore = noDatabaseUrl && !usingLocalDb;
  const usingFakeEmail = !env.RESEND_API_KEY || !env.BOOKING_FROM_EMAIL;

  if (usingLocalDb) {
    // Opened on first use and kept open; only one process can use it at a time.
    let local: ReturnType<typeof createBookingStore> | undefined;
    const store = async () => (local ??= createBookingStore(await sharedLocalDb()));
    deps.store = async (form) => (await store()).store(form);
    deps.markNotified = async (id) => (await store()).markNotified(id);
  } else if (usingFakeStore) {
    let next = 1;
    deps.store = async () => ({ id: `dev-${next++}` });
  }

  if (usingFakeEmail) {
    const config = { ...readEmailConfig(env), apiKey: "dev", from: "dev@localhost" };
    const print =
      (build: typeof buildInternalEmail) =>
      async (form: BookingFormData, context: EmailContext): Promise<SendResult> => {
        const email = build(form, context, config);
        console.info(
          [
            "",
            "──── Booking email (dev, not sent) ────",
            `To: ${email.to.join(", ")}`,
            `Reply-To: ${email.replyTo}`,
            `Subject: ${email.subject}`,
            "",
            email.text,
            "───────────────────────────────────────",
          ].join("\n"),
        );
        return "sent";
      };
    deps.sendInternal = print(buildInternalEmail);
    deps.sendClient = print(buildClientEmail);
  }

  const storeLabel = usingLocalDb ? `local database (${LOCAL_DB_DIR})` : usingFakeStore ? "in-memory store" : "Neon";
  if (usingFakeStore || usingLocalDb || usingFakeEmail) {
    console.info(
      `Booking API (dev): ${storeLabel} + ${usingFakeEmail ? "console email" : "Resend"}. ` +
        (usingFakeStore ? "Run npm run db:setup for a local database. " : "") +
        "Set BOOKING_DEV_FAKES=0 to see the real failure path.",
    );
  }

  return deps;
};
