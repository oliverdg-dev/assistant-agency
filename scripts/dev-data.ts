// npm run db:make-staff -- <email> [--name "Full Name"] [--remove]
// npm run db:seed
//
// Local database only (.data/pglite). There is no --url option on purpose:
// staff on production are added by SQL (docs/RUNBOOK.md), and sample data
// never goes there.
import { normalizeEmail, onStaffDomain, staffDomainsFromEnv } from "../api/_lib/auth.js";
import type { TransactionalDb } from "../api/_lib/db.js";
import { LOCAL_DB_DIR, localDbExists, openLocalDb } from "../api/_lib/dbLocal.js";
import { loadMigrations, migrationStatus } from "../api/_lib/migrate.js";

const args = process.argv.slice(2);
const command = args[0];
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

async function makeStaff(db: TransactionalDb) {
  const email = normalizeEmail(args[1]);
  if (!email.includes("@")) {
    console.error('Usage: npm run db:make-staff -- you@hendersonassociates.ca [--name "Your Name"] [--remove]');
    process.exit(2);
  }
  if (args.includes("--remove")) {
    // Clears the flag and signs them out everywhere.
    const rows = await db.query<{ id: string }>("UPDATE users SET is_staff = false WHERE email = $1 RETURNING id", [email]);
    if (rows[0]) await db.query("DELETE FROM sessions WHERE user_id = $1", [rows[0].id]);
    console.log(rows[0] ? `${email} is no longer staff, and their sessions are ended.` : `${email} isn't a user.`);
    return;
  }
  const domains = staffDomainsFromEnv();
  if (!onStaffDomain(email, domains)) {
    console.warn(`Note: ${email} isn't on a staff domain (${domains.join(", ")}), so it can't sign in. Set STAFF_EMAIL_DOMAINS to allow it.`);
  }
  const name = option("--name") ?? null;
  await db.query(
    `INSERT INTO users (email, name, is_staff) VALUES ($1, $2, true)
     ON CONFLICT (email) DO UPDATE SET is_staff = true, name = COALESCE($2, users.name)`,
    [email, name],
  );
  console.log(`${email} is staff. Sign in at http://localhost:3000/admin/sign-in (the code prints in the npm run dev terminal).`);
}

// Sample requests in different states, so the inbox has something to show.
const SAMPLES = [
  { first: "Dana", last: "Whitfield", company: "Northwind Freight", role: "Executive Assistant", status: "received", daysAgo: 0 },
  { first: "Marco", last: "Ruiz", company: "Brightleaf Dental", role: "Customer Support Representative", status: "received", daysAgo: 6 },
  { first: "Priya", last: "Nair", company: "Lumen Analytics", role: "Bookkeeper", status: "clarifying", daysAgo: 9 },
  { first: "Tom", last: "Becker", company: "Harbor & Pine", role: "Social Media Manager", status: "sourcing", daysAgo: 12 },
  { first: "Aisha", last: "Bello", company: "Crestline Realty", role: "Sales Development Representative (SDR)", status: "shortlist_ready", daysAgo: 15 },
  { first: "Kenji", last: "Mori", company: "Fieldnote Studio", role: "Graphic Designer", status: "interviewing", daysAgo: 20 },
  { first: "Laura", last: "Chen", company: "Oakridge Clinics", role: "Virtual Assistant", status: "filled", daysAgo: 40 },
  { first: "Sam", last: "Okafor", company: "Tidewater Supply", role: "Shopify Support Specialist", status: "on_hold", daysAgo: 25 },
] as const;

async function seed(db: TransactionalDb) {
  let added = 0;
  for (const [index, s] of SAMPLES.entries()) {
    const submissionId = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const rows = await db.query<{ id: string }>(
      `INSERT INTO booking_leads (
         first_name, last_name, email, company, role, budget, message, headcount, engagement_type,
         start_timeframe, sector, website, country, submission_id, status, created_at, internal_notified_at
       ) VALUES ($1, $2, $3, $4, $5, 'Not sure yet', $6, '1', 'Full-time', 'Within a month', 'Professional services',
         $7, 'Canada', $8, $9, now() - make_interval(days => $10), now() - make_interval(days => $10))
       ON CONFLICT (submission_id) DO NOTHING
       RETURNING id`,
      [
        s.first,
        s.last,
        `${s.first.toLowerCase()}@${s.company.toLowerCase().replace(/[^a-z]+/g, "")}.example`,
        s.company,
        s.role,
        `Sample request. Looking for a ${s.role.toLowerCase()} to take day-to-day work off the team.`,
        `${s.company.toLowerCase().replace(/[^a-z]+/g, "")}.example`,
        submissionId,
        s.status,
        s.daysAgo,
      ],
    );
    const id = rows[0]?.id;
    if (!id) continue;
    added += 1;
    if (s.status !== "received") {
      await db.query(
        `INSERT INTO request_events (request_id, kind, from_status, to_status, body, created_at)
         VALUES ($1, 'status_change', 'received', $2, 'Sample history.', now() - make_interval(days => $3))`,
        [id, s.status, Math.max(s.daysAgo - 2, 0)],
      );
    }
  }
  console.log(added ? `Added ${added} sample requests.` : "Sample requests are already there.");
  await seedCandidates(db);
}

// Three consented, unpublished candidates on the Harbor & Pine request
// (Sourcing), so "Publish" can be tried from the inbox straight away.
const SAMPLE_CANDIDATES = [
  {
    first: "Ana", last: "Reyes", headline: "Social media manager, 5 years with North American DTC brands", years: 5,
    skills: "Meta Business Suite, TikTok, Canva, Later, Google Analytics", english: "Fluent", availability: "Can start in 2 weeks", rate: 1500,
    why: "Grew a Toronto skincare brand's Instagram from 8k to 60k followers and ran their paid social calendar.",
  },
  {
    first: "Paolo", last: "Santos", headline: "Content and community manager for B2B SaaS", years: 4,
    skills: "LinkedIn, HubSpot, Figma, Notion", english: "Professional", availability: "Available now", rate: 1250,
    why: "Strong writer. Has run LinkedIn for two SaaS founders and reports weekly on what worked.",
  },
  {
    first: "Liza", last: "Mendoza", headline: "Social media and short-form video specialist", years: 3,
    skills: "TikTok, Reels, CapCut, Premiere Pro", english: "Fluent", availability: "Can start in 1 month", rate: 1100,
    why: "Edits her own video, which saves you a separate editor. Portfolio shows retail and food clients.",
  },
] as const;

async function seedCandidates(db: TransactionalDb) {
  const [lead] = await db.query<{ id: string }>("SELECT id FROM booking_leads WHERE submission_id = '00000000-0000-4000-8000-000000000004'");
  if (!lead) return;
  const [existing] = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM request_candidates WHERE request_id = $1", [lead.id]);
  if (Number(existing.n) > 0) return;
  for (const [rank, c] of SAMPLE_CANDIDATES.entries()) {
    await db.query(
      `WITH candidate AS (
         INSERT INTO candidates (first_name, last_name, headline, years_experience, skills, english_level, availability, monthly_rate_usd)
         VALUES ($2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
       )
       INSERT INTO request_candidates (request_id, candidate_id, rank, why_picked, consent_at)
       SELECT $1, id, $10, $11, now() FROM candidate`,
      [lead.id, c.first, c.last, c.headline, c.years, c.skills, c.english, c.availability, c.rate, rank, c.why],
    );
  }
  console.log("Added 3 sample candidates to the Harbor & Pine request (Social Media Manager). Publish them from its page.");
}

async function main() {
  if (command !== "make-staff" && command !== "seed") {
    console.error("Usage: npm run db:make-staff -- <email> | npm run db:seed");
    process.exit(2);
  }
  if (!localDbExists()) {
    console.error("No local database yet. Run npm run db:setup first.");
    process.exit(1);
  }
  const { db, close } = await openLocalDb(LOCAL_DB_DIR);
  try {
    const status = await migrationStatus(db, loadMigrations());
    if (status.pending.length) {
      console.error("The local database is missing updates. Run npm run db:migrate first.");
      process.exit(1);
    }
    await (command === "seed" ? seed(db) : makeStaff(db));
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
