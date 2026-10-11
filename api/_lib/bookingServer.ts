import { composeMessage, type BookingFormData } from "./booking.js";
import { databaseUrlFromEnv, neonHttpDb, type Db } from "./db.js";

export interface StoredLead {
  id: string;
  // True when this submission should email the team: a new request, or a
  // retry of one whose team email never went out. False for a duplicate the
  // team has already been told about (or is being told about right now).
  // Absent from stores that don't track notification (tests, dev fakes).
  notify?: boolean;
  // True when the submission id already existed.
  duplicate?: boolean;
}

// Thrown when no database is configured, so logs can tell a missing env var
// apart from a database outage.
export class BookingConfigError extends Error {}

// A retry may take over the team email if the first attempt claimed it this
// long ago and never confirmed it was sent.
export const NOTIFY_CLAIM_STALE_MINUTES = 10;

const blankToNull = (value: string) => (value ? value : null);

/*
 * One statement, so it works on Neon's HTTP driver and is atomic:
 *
 *   INSERT new row (claims the team email with this attempt's random token)
 *     └─ submission_id already exists ─▶ keep the row; take over the claim only
 *        if the team was never emailed and the old claim is stale
 *   RETURNING id, whether it was inserted, whether this attempt's token holds the claim
 *
 * Two concurrent duplicates: the second waits on the row lock, then sees the
 * first's fresh claim and returns notify = false.
 */
const UPSERT_LEAD = `
INSERT INTO booking_leads (
  first_name, last_name, email, company, role, budget, start_date, time_slot, message,
  headcount, engagement_type, start_timeframe, sector, website, country, submission_id,
  landing_path, referrer, utm_source, utm_medium, utm_campaign, client_time_zone,
  internal_notify_claim, internal_notify_claimed_at
) VALUES (
  $1, $2, $3, $4, $5, $6, NULL, NULL, $7,
  $8, $9, $10, $11, $12, $13, $14,
  $15, $16, $17, $18, $19, $20,
  $21, now()
)
ON CONFLICT (submission_id) DO UPDATE SET
  (internal_notify_claim, internal_notify_claimed_at) = (
    SELECT CASE WHEN takeover THEN $21::uuid ELSE booking_leads.internal_notify_claim END,
           CASE WHEN takeover THEN now() ELSE booking_leads.internal_notify_claimed_at END
    FROM (SELECT booking_leads.internal_notified_at IS NULL
             AND (booking_leads.internal_notify_claimed_at IS NULL
                  OR booking_leads.internal_notify_claimed_at < now() - interval '${NOTIFY_CLAIM_STALE_MINUTES} minutes')
           AS takeover) AS claim
  ),
  updated_at = now()
RETURNING
  id,
  (xmax = 0) AS inserted,
  (internal_notify_claim = $21::uuid) AS notify`;

export const createBookingStore = (db: Db) => ({
  store: async (form: BookingFormData): Promise<StoredLead> => {
    const rows = await db.query<{ id?: string | number; inserted: boolean; notify: boolean }>(UPSERT_LEAD, [
      form.firstName,
      form.lastName,
      form.email,
      form.company,
      form.role,
      form.budget,
      composeMessage(form),
      form.headcount,
      form.engagementType,
      blankToNull(form.startTimeframe),
      form.sector,
      blankToNull(form.website),
      blankToNull(form.country),
      form.submissionId,
      blankToNull(form.landingPath),
      blankToNull(form.referrer),
      blankToNull(form.utmSource),
      blankToNull(form.utmMedium),
      blankToNull(form.utmCampaign),
      blankToNull(form.timeZone),
      globalThis.crypto.randomUUID(),
    ]);
    const [lead] = rows;
    if (lead?.id === undefined || lead.id === null) {
      throw new Error("Lead insert did not return an id.");
    }
    return { id: String(lead.id), duplicate: !lead.inserted, notify: Boolean(lead.notify) };
  },

  // Records that the team email went out, so later retries stay quiet.
  markNotified: async (id: string): Promise<void> => {
    await db.query("UPDATE booking_leads SET internal_notified_at = now(), updated_at = now() WHERE id = $1", [id]);
  },
});

const productionStore = () => {
  const connectionString = databaseUrlFromEnv();
  if (!connectionString) {
    throw new BookingConfigError("Missing Postgres connection string.");
  }
  return createBookingStore(neonHttpDb(connectionString));
};

export const storeBookingLead = (form: BookingFormData): Promise<StoredLead> =>
  productionStore().store(form);

export const markLeadNotified = (id: string): Promise<void> => productionStore().markNotified(id);
