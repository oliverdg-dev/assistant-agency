# Agency website

Marketing site and job request form for an agency that places remote
professionals from the Philippines with North American businesses.

It is a **Vite + React single-page app** with one **Vercel serverless
function** (`api/booking.ts`) that receives job requests, saves them to **Neon
Postgres** and emails the team and the client through **Resend**. It is not a
Next.js app.

## Getting started

Requires Node 22 or 24 (`.nvmrc` says 22).

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without any keys, the dev server uses an
in-memory store and prints emails to the terminal, so you can submit the form
end to end straight away.

For a real database on your machine (no account needed), stop the dev server
and run:

```bash
npm run db:setup
```

This creates an embedded Postgres in `.data/pglite` (ignored by git) and
applies the migrations; `npm run dev` then saves requests there. Delete
`.data/` to start again. To use the real services locally:

```bash
cp .env.example .env.local
```

…then fill in the values (see the table below).

### Staff area (request inbox)

The team's inbox lives at `/admin/requests`. Locally, with the dev server
stopped:

```bash
npm run db:setup
npm run db:make-staff -- you@hendersonassociates.ca --name "Your Name"
npm run db:seed        # optional: 8 sample requests, and 3 candidates on one of them
npm run dev
```

Open http://localhost:3000/admin, enter that email, and copy the 6-digit code
from the `npm run dev` terminal. Without a database the staff pages say so
instead of failing. On production the area stays switched off until
`FEATURE_ADMIN=1` is set (docs/RUNBOOK.md, "Staff area").

**Shortlists.** On a request's page, add candidates in the Shortlist section,
tick consent, and press Publish. The client's email (with the private link)
prints in the `npm run dev` terminal; open that link to see what the client
sees. The seeded Harbor & Pine request (Social Media Manager) has three
candidates ready to publish.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000, including `POST /api/booking` and `/api/admin/*` |
| `npm test` | Unit tests (`node:test` via `tsx`) and the import-rules check |
| `npm run typecheck` | `tsc --noEmit` (`npm run lint` is the same) |
| `npm run build` | Production build into `dist/` |
| `npm run db:setup` | Create or update the local database (`.data/pglite`) |
| `npm run db:status` | Show applied and pending migrations (local database) |
| `npm run db:migrate` | Apply pending migrations to the local database. `-- --url <postgres-url>` targets another database; production also needs `--production` (see docs/RUNBOOK.md) |
| `npm run db:make-staff -- <email> [--name "Name"] [--remove]` | Make someone staff in the local database (or remove them and end their sessions). Local only. |
| `npm run db:seed` | Add sample requests to the local database. Local only; safe to run twice. |

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_URL` (or `DATABASE_URL`) | Production | Neon connection string. Missing locally: the local database if `npm run db:setup` has created it, otherwise an in-memory store. The migration tool never reads it by itself. |
| `RESEND_API_KEY` | Production | Resend API key. Missing locally: emails print to the terminal. |
| `BOOKING_FROM_EMAIL` | Production | Sender address on a domain verified in Resend. |
| `BOOKING_INTERNAL_TO` | No | Where new requests go. Default `lai@hendersonassociates.ca`; Vercel preview deploys default to `edrine.e@hendersonassociates.ca`. |
| `VITE_BOOKING_CALENDAR_URL` | No | `https://` booking link shown after submitting and in the client email. Baked in at build time, so redeploy after changing it. |
| `BOOKING_DEV_FAKES` | No | Set to `0` to turn off the local in-memory store and console email. |
| `ALLOW_PLACEHOLDER_BRAND` | No | Set to `1` to allow a production build with the placeholder brand. |
| `PRODUCTION_DB_HOST` | No | Host name of the production database. `npm run db:migrate` refuses that host unless run interactively with `--production`. |
| `FEATURE_SHORTLIST` | No | Set to `1` to switch on client shortlist links on Vercel (off by default on production and previews; on locally). |
| `SITE_URL` | No | The site's address for links in emails, e.g. `https://agency.com`. Default: Vercel's production domain on production, the deploy's own URL on previews. |
| `FEATURE_ADMIN` | No | Set to `1` to switch on the staff area on Vercel (off by default on production and previews; on locally, `0` turns it off). |
| `STAFF_EMAIL_DOMAINS` | No | Comma-separated email domains allowed to sign in to the staff area. Default `hendersonassociates.ca`. |

The production build prints a warning if the first three are missing.

## Brand

The business name and public email addresses live in one place:
`api/_lib/brand.ts`. They are placeholders ("Your Agency", `example.com`) and a
production build on Vercel stops until they're replaced (override with
`ALLOW_PLACEHOLDER_BRAND=1`). `index.html` gets them through a small Vite
plugin, so there's nothing else to edit.

## How the job request works

```
form (src/pages/Booking.tsx) ─POST /api/booking─▶ handleBookingHttp ─▶ processBookingSubmission
                                                     api/_lib/bookingApi.ts
   store in Neon ── ok ──▶ email team + client ─▶ 200 with reference id
        └─ fails ─▶ email team "[NOT SAVED]" first ─▶ then client ─▶ 200
                     └─ team email fails too ─▶ 500, form shows a retry message
```

Details, log lines and what to do when something goes wrong:
[docs/RUNBOOK.md](docs/RUNBOOK.md). Table definition: [db/schema.sql](db/schema.sql)
(inferred from the code, confirm against production).

## Deep links into the form

| Link | Effect |
|---|---|
| `/get-started?role=Bookkeeper` | Prefills the role (exact name from the role list only) |
| `/get-started?category=Finance%20%26%20Accounting` | Opens role suggestions for that category |
| `/get-started?headcount=4-10` | Preselects the team size (`1`, `2-3`, `4-10`, `11+`) |
| `/get-started?mock=success` | **Dev only.** Fakes the API: `success`, `success-no-id`, `field-error`, `500`, `504` |

Build links in code with `formLink()` from `src/lib/router.ts`.

## How to…

**Add a form field**
1. Add it to `BookingFormData`, `MAX_LENGTHS`, `emptyBookingForm` and (if it has options) validation in `api/_lib/booking.ts`.
2. Add it to `STEP_FIELDS` in `src/lib/bookingForm.ts`, render it in `src/pages/Booking.tsx`, and include it in `composeMessage` and the internal email (`api/_lib/bookingEmail.ts`).
3. Add a column in a new migration (`db/migrations/NNNN_name.sql`) and write it in `UPSERT_LEAD` (`api/_lib/bookingServer.ts`).
4. Add test cases in `tests/booking-validation.test.ts`, `tests/booking-email.test.ts` and `tests/db-requests.test.ts`.

**Add a migration**
1. Create `db/migrations/NNNN_short_name.sql` with the next number. Make it additive (new nullable or defaulted columns, new tables); never edit a file that has already run.
2. `npm run db:migrate` applies it locally; `tests/db-requests.test.ts` applies every migration to a fresh database.
3. Before merging, run it on production (docs/RUNBOOK.md, "Migrations").

**Add a page**
1. Add the page id to `Page` and a row to `ROUTES` in `src/lib/router.ts` (path, title, description).
2. Create the component in `src/pages/` using the primitives in `src/components/ui.tsx`, and add it to `renderPage` in `src/App.tsx`.
3. Link to it with `<Link to="…">`; `tests/router.test.ts` checks every route.

**Change the brand**
Edit `api/_lib/brand.ts`. That's it.

## Project layout

```
api/booking.ts            Vercel function for the job request form (thin shim)
api/admin.ts              Vercel function for /api/admin/* (staff sign-in and inbox)
api/shortlist.ts          Vercel function for /api/shortlist/* (client shortlist links)
api/_lib/                 shared booking logic, emails, database, migrations, brand,
                          staff auth (auth.ts), inbox API (adminApi.ts), route table (http.ts),
                          shortlists (shortlist.ts staff side, shortlistApi.ts client side)
db/migrations/            SQL migrations, applied in order (npm run db:migrate)
scripts/db.ts             migration command line
scripts/dev-data.ts       db:make-staff and db:seed (local database only)
src/App.tsx               page shell and routing
src/lib/router.ts         routes, titles, deep links
src/components/ui.tsx     buttons, sections, fields (see DESIGN.md)
src/pages/                one file per page
src/admin/                staff area (sign-in, inbox, request page), loaded only on /admin/*
src/shortlist/            the client's shortlist page, loaded only on /shortlist
src/content/              process steps and case studies
tests/                    node:test suites
```

Design tokens and component rules: [DESIGN.md](DESIGN.md). Open work: [TODOS.md](TODOS.md).
