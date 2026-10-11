# TODOs

Open work deferred from the `edrine` polish pass, with what unblocks each.

## Before launch (blockers)

- **Set the real brand.** `api/_lib/brand.ts` holds a placeholder ("Your
  Agency", `hello@example.com`, `privacy@example.com`). The previous name,
  "Pearl Talent", belongs to an established staffing company
  (pearltalent.com). *Unblock:* the owner chooses the name and mailboxes.
- **Confirm case study #1.** "Henderson Consulting & Associates" appears to be
  the operator's own company. Disclose the relationship or remove it; it is
  kept off the homepage (`featured: false` in `src/content/caseStudies.ts`).
  *Unblock:* owner decision.
- **Confirm the remaining claims.** The case study figures (40%, 60%, 2 weeks,
  45%, Day 5), the 90-day replacement guarantee and the "AI-ready" wording
  ("comfortable working with the AI and automation tools your team already
  uses"). *Unblock:* owner confirms each.
- **Legal review.** The Cookie Policy mentions Google Analytics, LinkedIn
  Insight Tag, Meta Pixel and a consent banner, none of which are on the site.
  Terms name Philippine law and Manila arbitration. Dates say January 2024.
  *Unblock:* the owner's counsel.
- **Check the `booking_leads` column types** before running migrations on
  production (docs/RUNBOOK.md, "Migrations", step 1).

## Content the owner needs to supply

- **"Who we are" block and footer contact**: founder or team name, where the
  business is based, legal entity, phone or email. The biggest trust gap on
  the site. *Unblock:* owner content.
- **FAQ** (cost, contracts, hours, payment). *Unblock:* owner answers.
- **Price guidance** per role band. *Unblock:* owner ranges.
- **Real photography** to replace the stock hero photo. *Unblock:* photos.
- **Removed claims**: if any of these are real, restore them with a source:
  "top 1%", "200+ companies", "97% retention", "2,400+ talent",
  "48-hour profiles", "14-day placement", "$12M+ generated", "4.9 rating",
  industry counts, and the testimonials from "Sarah K.", "Rachel B.",
  "Tom S." and "Anna P.".

## Engineering

- **Run the Phase 2 migrations on production** (form fields in columns,
  status, duplicate detection, request source, `request_events`). Built and
  tested locally only. Follow docs/RUNBOOK.md, "Migrations", including the
  column-type check first, *before* deploying the Phase 2 code.
  *Unblock:* someone with production database access.
- **Turn on the staff inbox on production** (Phase 3). Run
  `0002_staff_auth.sql` with the other migrations, add the team with SQL, then
  set `FEATURE_ADMIN=1` (docs/RUNBOOK.md, "Staff area"). Built and tested
  locally only. *Unblock:* production database access and owner go-ahead.
- **Shortlists: consent and retention policy** (gate G3). The checkbox
  wording and the 12-month delete-after default are placeholders. Once the
  policy is written, update the wording in `src/admin/ShortlistPanel.tsx`
  and the default in `db/migrations/0003_shortlists.sql` (via a new
  migration), and schedule `purgeExpiredCandidates` (`api/_lib/shortlist.ts`).
  *Unblock:* owner and counsel.
- **Turn on shortlist links on production**: run `0003_shortlists.sql`, set
  `FEATURE_SHORTLIST=1` and check `SITE_URL` (docs/RUNBOOK.md, "Shortlists").
  *Unblock:* production database access and the policy above.
- **Staff inbox follow-ups**: skip Philippine public holidays in the
  "needs an update" rule; a "Sign in" button in the code email (needs a fixed
  site URL setting); pagination once there are more than 1,000 requests; a
  real-Postgres concurrency test (`npm run test:db`). *Unblock:* need shows up.
- **Bot protection**: Cloudflare Turnstile or Vercel BotID on the form.
  *Unblock:* spam observed, or owner approval.
- **Daily lead digest** (cron or Neon scheduled query emailing the last 24
  hours) so an email outage can't go unnoticed. *Unblock:* owner approval.
- **Funnel analytics** (which form step people leave at), e.g. Vercel Web
  Analytics. *Unblock:* owner approval.
- **robots.txt and sitemap.xml.** *Unblock:* production domain.
- **Per-page link previews**: generate static HTML per route at build time so
  LinkedIn/Slack show the right title. *Unblock:* priority call.
- **Clean-up**: `.next/`, `next-env.d.ts` and unused dependencies are gone.
  Still open: decide whether the hidden `src/pages/Talent.tsx` stays (it is
  the only user of the `motion` package) and whether `GAP_CLOSURE_PLAN.md` is
  still needed. *Unblock:* owner decision.