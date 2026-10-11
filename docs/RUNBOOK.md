# Job request runbook

How job requests reach the team, how to check the pipeline is healthy, and
what to do when something goes wrong.

## Where requests go

1. Saved as a row in the Neon table `booking_leads`. Once the Phase 2
   migration has run, every form field has its own column, plus `status`
   (starts at `received`) and where the request came from (landing page,
   referrer, UTM tags, time zone). The labelled `message` text is still
   written as well.
2. Emailed to the team inbox (`BOOKING_INTERNAL_TO`, default
   `lai@hendersonassociates.ca`). **Reply to that email to answer the client
   directly**; reply-to is set to the client's address.
3. The client gets a short confirmation email. Their replies go to the team
   inbox.

`booking_leads` is the source of truth. An email can fail while the row is
saved; the reverse is covered below.

## Before merging (one-time checks)

- [ ] Replace the placeholder brand in `api/_lib/brand.ts` (name, contact and
      privacy mailboxes). Production builds stop until this is done.
- [ ] Run any pending migrations on production **before** merging the code
      that uses them (see "Migrations" below).
- [ ] In Vercel, check `POSTGRES_URL`, `RESEND_API_KEY` and
      `BOOKING_FROM_EMAIL` are set for Production. The build log warns if not.
- [ ] Recommended: add a Vercel Firewall rate-limit rule on
      `POST /api/booking` (for example 5 requests per minute per IP) to slow
      down form spam.

## After every deploy (smoke test, 3 minutes)

1. Open the live site, refresh on `/how-it-works` (should load, not 404).
2. Submit one real request through `/get-started` with your own email.
3. Confirm:
   - a new row in `booking_leads`;
   - the team email arrived, and replying goes to the address you entered;
   - the confirmation email arrived;
   - in Resend, the sending domain shows as verified.
4. Delete the test row if you like.

## Weekly check (2 minutes)

Compare the number of requests saved with the number of team emails received:

```sql
SELECT count(*) FROM booking_leads WHERE created_at > now() - interval '7 days';
```

If the database has more requests than the inbox, emails are failing; search
the logs below.

## Log lines

Vercel → Project → Logs, filter on the function `api/booking`. Log lines never
contain the client's name, email, company or notes, only a reference id.

| Log line starts with | Meaning | What to do |
|---|---|---|
| `Booking config: missing …` | An env var is missing (names listed). | Set it in Vercel and redeploy. |
| `Booking submission failed: store cause=db_error code=…` | Neon rejected the insert. | Check Neon status and the pg code; the team still got a `[NOT SAVED]` email if Resend worked. |
| `Booking submission failed: store cause=timeout` | Neon didn't answer within 8 seconds. | The row may or may not exist; see `[SAVE UNCONFIRMED]` below. |
| `Booking submission failed: store cause=missing_config` | No database URL. | Set `POSTGRES_URL`. |
| `Booking submission saved by email only` | Database failed but the team email went out. | Enter the request manually from the email. |
| `Booking submission failed: store and internal email` | Neither worked. The client saw "please try again". | Fix the database or email first; the client may resubmit. |
| `Booking email internal failed lead=… status=…` | Team email failed (after one retry). | Find the lead in `booking_leads` by id. Check Resend status/quota. |
| `Booking email internal skipped …` | Resend key or sender missing. | Set `RESEND_API_KEY` / `BOOKING_FROM_EMAIL`. |
| `Booking email client failed/skipped …` | Client confirmation didn't send. | Optional: email the client yourself. |
| `Booking honeypot hit` | A bot filled the hidden field; nothing was stored. | Nothing. Many in a row means spam; add the rate-limit rule. |
| `Booking duplicate submission lead=…` | The same submission arrived again (a retry or double click). It was matched to the existing row; no new emails. | Nothing. |
| `Booking notified flag not saved lead=…` | The team email went out but the database didn't record it. A retry of this submission in the next 10 minutes stays quiet; after that it could email the team once more. | Nothing, unless the database is also failing other writes. |
| `Staff sign-in code sent user=…` / `Staff signed in user=…` | Normal staff sign-in (function `api/admin`). | Nothing. |
| `Staff sign-in code email failed user=…` | A staff member asked for a code and the email didn't send. | Check Resend; they can press "Send a new code". |
| `Staff sign-in rate limited step=… by=…` | Too many code requests or tries from one address or IP in 15 minutes. | Nothing, unless it repeats: then someone may be guessing. |
| `Booking email client-update failed/skipped user=… ` and `Admin client update email failed request=…` | A message to a client from the inbox didn't send. The request page shows "Not sent, Retry". | Press Retry, or check Resend. |
| `Admin status changed request=… from=… to=…` | A status change from the inbox. | Nothing. |
| `Admin request failed path=… cause=…` | The staff API hit an unexpected error (usually the database). | Check Neon; staff see "Something went wrong". |
| `Shortlist published request=… added=…` | Staff published candidates; the client was emailed a link. | Nothing. |
| `Shortlist link email failed/skipped request=…` | The shortlist email didn't send. The Shortlist section and timeline say "Not sent". | Press "Send a fresh link". |
| `Shortlist choices received request=… interview=… pass=…` | The client sent their choices; the owner was emailed. | Book the interviews. |
| `Shortlist request failed path=… cause=…` | The client's shortlist page hit an unexpected error. | Check Neon. |
| `Admin config: missing POSTGRES_URL` | The staff area is on but has no database. | Set `POSTGRES_URL`. |
| `Booking submission failed: store cause=db_error code=42703` (or `42P10`) | The code expects columns or an index that don't exist: it was deployed before its migration. | Run the migration (below). Requests in between arrived as `[NOT SAVED]` emails; enter them manually. |

## Special email subjects

- **`[NOT SAVED] New job request: …`**: the database rejected the request.
  It exists only in this email. Enter it manually.
- **`[SAVE UNCONFIRMED] New job request: …`**: the database timed out, so the
  row may or may not exist. Search `booking_leads` for the client's email
  before entering it manually, to avoid a duplicate.

Each request carries a **Submission ID** (in the email, in `message` and,
after the Phase 2 migration, in its own column). A retry with the same
Submission ID is matched to the existing row instead of creating a new one.

## Known limits

- Link previews (LinkedIn, Slack, iMessage) show the homepage title and
  description for every page, because the site renders in the browser.
- Duplicate detection needs the Phase 2 migration on production.
- Form spam protection is a hidden field only; see TODOS.md for Turnstile.

## Staff area

The inbox at `/admin/requests` (sign-in at `/admin`). Staff sign in with a
6-digit code emailed to them; there are no passwords. Only addresses on
`STAFF_EMAIL_DOMAINS` (default `hendersonassociates.ca`) that are marked as
staff in the database get a code. Anyone else sees the same "a code is on its
way" message, and nothing is sent.

**Switching it on** (once, after the `0002_staff_auth.sql` migration has run on
production, see "Migrations"):

1. Add the team (each person once), in the Neon SQL editor:
   ```sql
   INSERT INTO users (email, name, is_staff)
   VALUES ('name@hendersonassociates.ca', 'Full Name', true)
   ON CONFLICT (email) DO UPDATE SET is_staff = true, name = EXCLUDED.name;
   ```
   Emails must be lower case.
2. In Vercel, set `FEATURE_ADMIN=1` for Production and redeploy. Until then
   every `/api/admin/*` URL answers 404.
3. Open `/admin`, sign in, and check the inbox lists recent requests.

**Removing someone** (takes effect on their next click):
```sql
UPDATE users SET is_staff = false WHERE email = 'name@hendersonassociates.ca';
DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'name@hendersonassociates.ca');
```

**Turning the area off**: set `FEATURE_ADMIN` to anything but `1` (or delete
it) and redeploy. Nothing is lost.

**What staff can do**: see every request with its details and where it came
from; change its status (if someone else changed it first, they're told who
and asked to reload); set an owner; add internal notes, discovery calls and
"client asked for an update" entries; and send a message to the client. That
message is emailed from "Name at Brand" with replies going to the staff
member, and the request page shows whether it was sent, with a Retry button.

**"Needs an update"** marks open requests (anything but Filled and Closed)
with no timeline entry for 3 business days, Monday to Friday on Manila time.
Philippine public holidays are not skipped yet.

Sign-in codes last 15 minutes and allow 5 tries; a new code cancels the old
one. Sessions last 7 days. Limits: 5 code requests per email and 20 per IP
every 15 minutes, and 30 code checks per IP.

## Shortlists

Staff build a shortlist on the request page (Shortlist section): add each
candidate, tick that they agreed to share their profile with this client, put
them in order and press **Publish**. The client gets an email from the request
owner with a private link (works 14 days; "please reply by" is 5 days out). On
the page they choose Interview or Pass for each person and press Send; the
owner gets an email with their choices. If they pass on everyone, the request
goes back to Sourcing. Choices can change until staff move the request on from
Shortlist ready.

- **Send a fresh link** emails a new link; older links stop working at once.
- A client with an expired link can ask for a fresh one on the page; it goes
  only to the email address on the request, at most 3 a day.
- **Withdraw** hides a candidate behind "no longer available"; **Remove**
  works only before the client has seen them.
- Clients see first name and last initial, headline, experience, English,
  availability, monthly rate, skills and "why we picked them". Never contact
  details, last names, consent records or retention dates.

**Switching it on** (after `0003_shortlists.sql` has run on production): set
`FEATURE_SHORTLIST=1` in Vercel and redeploy. Check that links in the email
point at the real domain; set `SITE_URL` if they don't.

**Consent and retention are placeholders** until the owner and counsel agree
the written policy (gate G3 in docs/PORTAL-ARCHITECTURE.md): the consent
wording on the checkbox, and deleting a profile after its "delete after" date
(default 12 months). Nothing deletes profiles automatically yet; to do it by
hand:
```sql
DELETE FROM candidates WHERE delete_after < current_date;
```

## Migrations

Schema changes live in `db/migrations/NNNN_name.sql` and are applied in order,
each in its own transaction, by `npm run db:migrate`. Applied files are
recorded with a checksum in `schema_migrations`; editing one that has already
run stops the tool. Add a new file instead.

**Locally** (no account needed): `npm run db:setup`, then `npm run db:status`.
The local database lives in `.data/pglite`; stop `npm run dev` first, because
only one process can open it.

**On production**, in this order, from your own terminal:

1. Check the real table matches what the migrations expect (the baseline
   assumes `id` is a `uuid`; `request_events` links to it):
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'booking_leads'
   ORDER BY ordinal_position;
   ```
   If `id` is not `uuid`, stop and fix the migration before going further.
2. Set `PRODUCTION_DB_HOST` to the production host name (it makes the tool
   refuse that host unless you're explicit).
3. See what would run:
   `npm run db:status -- --url "$PRODUCTION_URL"`
4. Apply it (asks you to type the host to confirm):
   `npm run db:migrate -- --url "$PRODUCTION_URL" --production`
5. `npm run db:status -- --url "$PRODUCTION_URL"` should show `Pending: none`.
6. Merge and deploy the code. Then run the smoke test above and check the new
   row has its columns filled:
   ```sql
   SELECT status, headcount, engagement_type, submission_id, landing_path, internal_notified_at
   FROM booking_leads ORDER BY created_at DESC LIMIT 1;
   ```

The tool never reads `POSTGRES_URL` on its own, refuses the production host
from a non-interactive run or a preview build, and never runs during
`npm run build`.

**If a migration fails** it is rolled back on its own and the tool stops;
earlier files stay applied. Fix the file (it never ran, so editing it is
fine) and run the command again.

**If the code was deployed before the migration**, new requests fail to save
(`code=42703` in the logs) and arrive as `[NOT SAVED]` emails. Run the
migration, then enter those requests from the emails.
