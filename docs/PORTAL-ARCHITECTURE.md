# Portal architecture (proposal)

Status: **Phase 0 proposal, 8 October 2026. Nothing here is built.** Each phase
is approved and built on its own, and the guest job request flow keeps working
through all of them.

This document says what we intend to build and why, at the level needed to make
good decisions now. Each phase gets its own implementation plan and review when
it starts. The detailed requirements each phase must meet are collected in the
[appendix](#appendix-phase-acceptance-notes).

Companion documents: [MARKET-RESEARCH.md](MARKET-RESEARCH.md) (why this order)
and [ROLE-RESEARCH.md](ROLE-RESEARCH.md) (the role catalog Phase 1 builds).

Contents: [1 Where we are](#1-where-we-are-today) ·
[2 Decisions log](#2-decisions-log) · [3 Roadmap](#3-roadmap) ·
[4 Data model](#4-data-model) · [5 API routes and errors](#5-api-routes-and-errors) ·
[6 Auth and links](#6-auth-and-links) · [7 Emails](#7-emails) ·
[8 Statuses and labels](#8-statuses-and-labels) ·
[9 Local development, tests and migrations](#9-local-development-tests-and-migrations) ·
[10 Runbook links](#10-runbook-links) · [11 Open gates](#11-open-gates) ·
[Appendix](#appendix-phase-acceptance-notes)

---

## 1. Where we are today

```
Browser (Vite + React SPA, custom history router: src/lib/router.ts)
  │
  │  /get-started  (3-step form, src/pages/Booking.tsx)
  ▼
POST /api/booking ──▶ api/booking.ts (Vercel function, 30s)
                        └─ api/_lib/bookingApi.ts  handleBookingHttp()
                             ├─ sanitize + validate   (api/_lib/booking.ts, shared with the browser)
                             ├─ INSERT booking_leads  (Neon HTTP driver, 8s budget)
                             └─ Resend: team email + client confirmation
                                (DB down → "[NOT SAVED]" team email still goes out)

Local dev: vite.config.ts serves /api/booking through the same handler, with an
in-memory store and console email when no keys are set (api/_lib/bookingDev.ts).
```

Baseline at the start of Phase 0 (branch `edrine`): 81 tests pass,
`tsc --noEmit` is clean, `vite build` succeeds. A new developer goes from clone
to a working form in two commands and about two minutes, with no accounts.

**Patterns to keep for every new endpoint:** one pure handler with its
dependencies injected (so tests use fakes and the dev server reuses it), shared
browser-safe validation (`tests/api-imports.test.mjs` enforces the boundary),
"no lead is lost" fallbacks, stable log prefixes and a runbook entry.

### Gaps that matter for the portal

| Gap | Where | Why it matters |
|---|---|---|
| Roles listed in two places, shallow | `roleGroups` in `api/_lib/booking.ts`; `SERVICES` in `src/pages/Services.tsx` | No role pages, no slugs for requests to link to |
| Form role is free text | `validateBookingFormData` | Requests can't be grouped by role |
| Most form fields stored inside `message` | `composeMessage()`; migration waiting in `TODOS.md` | Nothing to filter or show |
| No status, no duplicate protection | `booking_leads` | Nothing to track; retries duplicate |
| Team works from email and the Neon console | no internal UI | Nobody can set a status a client would see |
| Router has no path params, layouts or guards | `src/lib/router.ts` | `/roles/:slug` and signed-in areas need them |
| Dev server knows one endpoint | `vite.config.ts` | Every new endpoint would need its own wiring |
| Schema is inferred, no migration tooling | `db/schema.sql` says "confirm against production" | New tables reference columns whose real types are unknown |
| Storage uses the Neon HTTP driver | `api/_lib/bookingServer.ts` (`neon()`) | One statement per call; multi-step writes need a transaction path |
| The site promises visibility it can't deliver | "Visibility into where each candidate stands" on How it works | The portal is how that promise becomes true |

Housekeeping debt (from `TODOS.md`), to land before Phase 1: tracked `.next/`
and `next-env.d.ts`, a tracked `.claude/worktrees/…` gitlink, unused
dependencies (`@google/genai`, `express`, `dotenv`, `motion`), package name
`react-example`, hidden `src/pages/Talent.tsx`, stale `GAP_CLOSURE_PLAN.md`.
The placeholder brand still blocks production builds.

---

## 2. Decisions log

| # | Decision | Status | Why |
|---|---|---|---|
| D1 | One Vite SPA with three areas: marketing (eager), `/admin/*` and `/portal/*` (lazy-loaded). Keep and extend the custom router. | Proposed | A second app doubles routing, deploys and design work. The router is 257 tested lines; params, areas and a guard are small additions. Revisit a router library if those additions pass ~150 lines. |
| D2 | One plain function file per audience: `api/booking.ts` (unchanged path and contract), `api/admin.ts`, `api/portal.ts`, `api/auth.ts`, later `api/stripe-webhook.ts`, reached through `vercel.json` rewrites (`/api/portal/(.*)` → `/api/portal?path=$1`). | Proposed | Auth checks live in one place per audience. Catch-all `[...path].ts` files outside Next.js have reported 404 problems on deeper paths; rewrites are explicit. Each function gets a `functions` entry in `vercel.json`. |
| D3 | Requests stay in `booking_leads`, extended in place. | Proposed | It is already the source of truth, the runbook queries it, and the column migration is written. No second table, backfill or dual-write. |
| D4 | Plain SQL migrations with a small runner. Additive changes only. Start by introspecting production. | Proposed | No ORM needed. The schema file is inferred, so the real column types must be read before any foreign key is written. |
| D5 | One query module (`api/_lib/db.ts`) with `query()` and `transaction()`. | Proposed | The HTTP driver can't run multi-statement transactions. Transactions use the Neon WebSocket pool in production and an in-process Postgres (PGlite) in tests. |
| D6 | Passwordless sign-in, **email one-time code only**. | **Decided 9 Oct 2026: built in** (`api/_lib/auth.ts`, tables in our database) instead of Better Auth, for staff in Phase 3. Revisit for client accounts (Phase 7). | Clients sign in rarely. One code mechanism is scanner-safe and works in email apps' built-in browsers. See [section 6](#6-auth-and-links). |
| D7 | Shortlists reach clients by **private link before accounts exist**. | Proposed (taste call, see roadmap) | The shortlist is the moment clients value most; it should not wait for account and claim logic. |
| D8 | Calendar: reuse the existing Cal.com/Calendly link; store meetings; no scheduling engine, no two-way sync. | Proposed | Scheduling here is time-zone coordination, not a calendar product. |
| D9 | Billing link-first: Stripe hosted invoices and Customer Portal; mirror invoices only when the portal must show their status. | Proposed | Fewer moving parts until there is real billing volume. |
| D10 | The portal is proof in the sales story, not the moat. | Proposed | Clients choose on trust, price, speed and guarantees ([MARKET-RESEARCH.md](MARKET-RESEARCH.md)). |
| D11 | Vercel Pro for the production project. | Needs owner | Hobby is non-commercial and caps a deployment at 12 functions. |
| D12 | Build vs integrate (ATS/CRM with a client portal) for the request pipeline and candidates. | **Decided 9 Oct 2026: build our own inbox** (Phase 3) | If an ATS wins, Phases 3-6 shrink to pushing intake into it and linking its records. |

---

## 3. Roadmap

Each phase is independently useful, keeps the guest flow working, and stops for
owner review. Research and four plan reviews changed the suggested order; the
changes are listed after the table.

| Phase | What ships | Useful because | Needs before starting |
|---|---|---|---|
| **1. Role catalog and discovery** *(scaled back: the existing Roles page now describes every role; separate role pages not built)* | One role catalog module; `/roles` (canonical, `/services` redirects) and `/roles/<slug>` pages, prerendered so links preview correctly; "Request this role" deep link with task chips; form suggestions from the catalog; old role names still work. No database change. | Buyers see what a hire would actually do; requests arrive with a known role. | Housekeeping PR; owner review of the launch role list and "typical week" content. |
| **2. Request data foundation** | Production introspection and baseline; migration runner; form fields in their own columns; status; source fields (landing page, referrer, UTM, time zone); duplicate protection; `request_events`. No UI. **Built and tested locally (9 Oct 2026); not yet run on production.** `role_slug`, `company_id` and `submitted_by` wait for the phases that need them. | Requests become queryable; retries stop duplicating. | Someone with production database access. |
| **3. Staff sign-in and request inbox** *(only if D12 says build)* | Staff-only sign-in; `/admin/requests` list and detail; status changes with notes; request owner; stale flag; funnel counts; client-visible updates sent by email. | The team stops working from the inbox and the Neon console; clients hear from a named person. **Built and tested locally (9 Oct 2026); not on production. Off on Vercel until `FEATURE_ADMIN=1`.** | D11 (Vercel plan) still open; the deployment now has 2 functions. |
| **4. Shortlist review by private link** | Consented candidate profiles; staff publish 3-5; the client opens a private link from email, decides "interview" or "pass, because…" per candidate. No accounts. | The value moment becomes visible and fast. **Built and tested locally (9 Oct 2026) with placeholder consent and retention rules; not on production. Off on Vercel until `FEATURE_SHORTLIST=1`.** | Candidate consent and retention rules (gate G3) still needed before launch. |
| **5. Interview scheduling** | "Book interviews" opens the owner's calendar link prefilled; meetings recorded; emails show client time and Manila time. | Interviews stop getting lost across time zones. | Nothing new |
| **6. Hire, onboarding and after-hire care** | Placement record; onboarding checklist; named account manager; 30/60/90-day check-ins; replacement request. Reached by email and private links. | Retention: the part competitors sell but don't show. | Nothing new |
| **7. Client accounts and tracking** *(evidence-gated)* | Companies, memberships, passwordless sign-in, claiming requests by verified email, portal home with requests, shortlists, placements and timeline. | One signed-in place for clients with several hires. | Gate G1 evidence. |
| **8. Admin client management** | Clients list and detail, invites, linking unclaimed requests. | Staff manage companies, not just requests. | Phase 7. |
| **9. Ongoing client experience** | Team view, check-in history, documents. | Long-term account management. | Nothing new |
| **10. Billing** | Stripe customers, hosted invoices and Customer Portal links; invoice mirror only when needed. | Clients see what they pay for. | Real placements and a confirmed price model. |
| Later, only with evidence | Time tracking integration, candidate portal, talent browsing, reporting. | | |

**Changes from the brief's suggested order, and why**

1. **Staff tools before the client view of the same data** (admin request
   management moves from 8 to 3). A status a client sees is only worth something
   if staff can set it in seconds.
2. **Roles connect to requests in Phases 1-2**, not Phase 9. It is a slug and a
   column; doing it with the catalog avoids a second pass.
3. **The shortlist comes before client accounts** (by private link). It is the
   moment clients value most, and shipping it without accounts avoids building
   claim and sign-in logic before there is evidence clients want to log in.
4. **After-hire care comes before accounts.** Retention and replacement are
   where trust is won or lost.
5. **Client accounts wait for evidence** (gate G1).
6. **Scheduling reuses the existing calendar tool**, and **billing starts
   link-only.**

These are recommendations. The original order (accounts at Phase 3-4, calendar
before shortlists) remains a valid choice; the trade-off is building account,
claim and sign-in logic earlier, before the shortlist experience exists.

```
CURRENT                         PHASES 1-6                          12-MONTH IDEAL
marketing site + guest form ->  role pages tied to requests,    ->  client sees request, shortlist,
email + Neon console ops        staff inbox, shortlist links,       interviews, hire, check-ins and
roles listed twice, shallow     calendar booking, after-hire        invoices in one place; staff run
no status, no accounts          care, all by email + links          the pipeline from /admin
```

---

## 4. Data model

Introduced gradually. Fields listed are the ones that drive decisions.

| Entity | Key fields | Phase |
|---|---|---|
| `booking_leads` (requests) | existing columns + form columns, `status` (named CHECK), `role_slug`, source fields, `client_time_zone`, `submission_id` (unique), notification claim/sent times, `owner_staff_id`, `company_id` (null), `submitted_by` (null), `updated_at` | 2-3 |
| `request_events` | `request_id`, `actor_user_id`, `kind` (status_change, note, status_inquiry, discovery_call, link, shortlist_viewed, …), `from_status`, `to_status`, `body`, `visibility` (internal / client), `email_status`, `email_sent_at` | 2 |
| `rate_limits` | `key`, `window_start` (unique together), `count` | 3 |
| `link_tokens` | `token_hash`, `purpose`, `request_id`, `email`, `expires_at`, `revoked_at`, `last_used_at` | 4 |
| `users` + auth tables | `email` (lowercased), `is_staff`; sessions and codes owned by Better Auth | 3 |
| `candidates` | `display_name` (first name + last initial), `headline`, `role_slugs`, `years_experience`, `skills`, `assessment_summary`, `consent_at`, `status` | 4 |
| `request_candidates` (shortlist) | `request_id`, `candidate_id`, `rank`, `why_picked`, `stage`, `client_decision`, `pass_reason`, `published_at` | 4 |
| `meetings` | `request_id`, `candidate_id`, `kind`, `starts_at` (timestamptz), `join_url`, `status` | 5 |
| `placements` | `request_id`, `candidate_id`, `start_date`, `hours_per_week`, `client_rate`, `currency`, `status`, `account_manager_id` | 6 |
| `onboarding_tasks`, `check_ins` | `placement_id`, `label` / `due_at`, `owner`, `done_at`, `notes` | 6 |
| `companies`, `company_members` | `name`, `website`, `country`, `stripe_customer_id`; `role` (owner / member) | 7 |
| `invoices` (mirror, optional) | `stripe_invoice_id`, `status`, `amount_due`, `hosted_invoice_url` | 10 |

**Rules.** Columns are the source of truth from Phase 2; `message` is rendered
from them. Every new foreign key uses the id type found by the Phase 2
introspection. Multi-step writes (status + event, first sign-in, claims) run in
one transaction or one statement. Indexes ship with the tables that need them.

**Ownership.** Guest requests have no company. When a person proves an email
address by signing in (Phase 7), unclaimed requests from that exact address
(lowercased, trimmed) attach to their company. Requests are never matched by
company name. Staff can link or move a request. Staff users never claim.
A company is created only for a user with no membership.

---

## 5. API routes and errors

| Function | Who calls it | Guard |
|---|---|---|
| `api/booking.ts` | anyone (guest form) | honeypot, rate-limit rule; contract unchanged |
| `api/auth.ts` | sign-in pages | Better Auth; staff domains only in Phase 3 |
| `api/admin.ts` | staff | `requireStaff` on every route (re-checks `is_staff` and domain) |
| `api/portal.ts` | clients and private-link holders | `requireClient` on every route, except routes explicitly marked `public` |
| `api/stripe-webhook.ts` | Stripe (Phase 10) | signature check, idempotent by event id |

**Route entries** are `{ method, path, auth, body, handler }`. `auth` is required
(`public`, `client`, `staff`); `body` is `json`, `raw` (Better Auth, Stripe) or
`none`. A test pins the exact set of public routes. The Vite dev plugin serves
the same route tables, so local development matches production. Areas not yet
signed off are switched off by server env flags (`FEATURE_ADMIN`,
`FEATURE_PORTAL`, `FEATURE_SHORTLIST`) and return 404.

**Error shape for new routes** (`/api/booking` keeps its current shape):
`{ error: { code, message, hint?, retryAfter? } }`.

| Code | HTTP | What the user sees |
|---|---|---|
| `auth_required` | 401 | Sign-in page, then back to where they were |
| `forbidden` / `not_found` | 404 | Generic "not found"; another company's records always look like 404 |
| `stale_status` | 409 | "Status was changed to X by Y. Reload" (draft kept) |
| `link_expired` | 410 | "This link has expired. Send a fresh link to m•••@company.com" |
| `link_invalid` | 404 | "This link isn't valid" with the team's contact |
| `rate_limited` | 429 + `Retry-After` | "Too many requests, try again in N minutes" |
| `validation` | 400 | Field errors next to the fields |
| `internal` | 500 | "Something went wrong" with retry; logged with a stable prefix |

Admin, portal and shortlist responses send `X-Robots-Tag: noindex`,
`frame-ancestors 'none'` and `Cache-Control: no-store`.

---

## 6. Auth and links

**Phase 3 outcome:** staff sign-in is built in (`api/_lib/auth.ts`): codes and
session tokens are stored only as hashes, rate limits live in Postgres, and the
session cookie is scoped to `/api/admin`. The sign-in email carries the code
only, with no button link yet. The comparison below was the Phase 0
recommendation; revisit it before client accounts (Phase 7).

**Phase 0 recommendation: Better Auth, self-hosted, email one-time code only.**

| Option | Cost | Effort | Lock-in | Where user data lives |
|---|---|---|---|---|
| **Better Auth (self-hosted)** | free (library) | medium: we host the handler | low | our Neon database |
| Clerk | per active user above a free tier | low | high: hosted users and UI | Clerk |
| Neon Auth (managed Better Auth) | bundled with Neon | low | medium | Neon-managed |
| Custom tokens | free | high, security-critical code we own forever | none | our database |

Prices and tiers to be checked in the Phase 3 spike before committing.

How it works:

- The sign-in email contains a 6-digit code and a button to
  `/sign-in#code=…`. The page shows one **Continue** button that submits the
  code. Nothing is verified on page load, so email security scanners that open
  every link can't burn the code, and it works in email apps' built-in browsers.
- Sessions use an `httpOnly`, `Secure`, `SameSite=Lax` cookie. State-changing
  requests are POST/PATCH with JSON and an `Origin` check.
- Staff: `users.is_staff` is set only by SQL or a guarded script, never by
  sign-up. In Phase 3 the auth endpoint refuses, before sending any email, any
  address outside the staff email domains. Removing staff clears the flag and
  deletes their sessions.
- Preview deploys build links from the preview URL, never production.
- Sign-in and link endpoints are rate-limited per email and per IP, in Postgres.

**Private links** (shortlists, after-hire check-ins):

- Stored as hashed tokens with an expiry (14 days for shortlists) and a revoked
  time. Changing a request's contact email, unlinking it, or resending a link
  revokes earlier links.
- Sent only to the request's stored contact email. The token travels in the URL
  fragment (`#t=…`), never in the path or query, so it doesn't reach server logs
  or `Referer` headers.
- Opening the link shows a **Continue** page. Continue exchanges the token for a
  short-lived cookie scoped to that one shortlist; only then are views counted and
  decisions allowed.
- Profiles show first name and last initial, headline, experience, skills and an
  assessment summary, never contact details, and only for candidates who
  consented. No photos by default.

---

## 7. Emails

All emails reuse the existing Resend sender (`bookingEmail.ts`): HTML plus plain
text, one primary button with a plain link underneath, the request owner's name
as sender name and a monitored reply-to. Client-visible emails record whether
they were sent; staff see "not sent, Retry" when Resend fails.

| Template | Trigger | Phase |
|---|---|---|
| Confirmation (saved) | request stored | today |
| Confirmation (not saved) | store failed; no tracking link | today |
| Client-visible update | staff note or status marked "client" | 3 |
| Shortlist ready | staff publish a shortlist | 4 |
| Fresh shortlist link | client asks after expiry | 4 |
| Interview booked | meeting recorded; client time and Manila time | 5 |
| Onboarding checklist, 30/60/90 check-in, replacement acknowledged | placement events | 6 |
| Sign-in code | sign-in requested | 3 (staff), 7 (clients) |

---

## 8. Statuses and labels

Internal statuses, defined once in a shared module that the database CHECK
constraint is tested against:

```
received ─▶ clarifying ─▶ sourcing ─▶ shortlist_ready ─▶ interviewing ─▶ filled
    │            │             │              │                │
    └────────────┴─────────────┴──────────────┴────────────────┴─▶ on_hold / closed
```

"Open" means every status except `filled` and `closed`. Status changes are
compare-and-set: if someone else changed it first, the second change gets a 409.

What the client sees, in emails, the shortlist page and later the portal:

| Client stage | Internal statuses |
|---|---|
| Received | received |
| Finding candidates | sourcing (and clarifying, shown as an action card: "Your account manager needs: …") |
| Shortlist ready | shortlist_ready |
| Interviews | interviewing |
| Hired | filled |
| (note shown instead of a stage) | on_hold, closed |

Every open request has a named staff owner and is updated, or noted to the
client, at least every 3 business days (Manila calendar, Philippine holidays).
The inbox flags requests that go quiet. Client views show "last updated" with a
date.

---

## 9. Local development, tests and migrations

**Local development keeps today's two-step start.** `npm install` and
`npm run dev` with no keys still run the whole marketing site and booking flow.
The admin and portal areas show "This area needs a database: set POSTGRES_URL to a
dev database and run `npm run db:setup`" instead of failing. Targets, checked at
the end of every phase from a fresh clone: working form in 2 steps and about 2
minutes; signed-in staff inbox in 4 steps and under 5 minutes, without
production credentials.

| Command | Does |
|---|---|
| `npm run db:setup` | migrate + seed a dev database |
| `npm run db:seed` / `db:make-staff <email>` | sample data / promote a dev user; both refuse production |
| `npm run db:migrate` | apply pending migrations in transactions; prints the target; refuses the production host from scripts or previews unless `--yes --production` |
| `npm run db:status` | applied vs pending, with checksums |
| `npm test` | keyless; SQL logic tested against an in-process Postgres |
| `npm run test:db` | real-Postgres concurrency tests against a Neon branch; skips with a message if `TEST_DATABASE_URL` is unset |

In development the sign-in code prints to the terminal, the same way booking
emails do today. Migrations run on production **before** the code that uses them
is merged; if the order slips, the existing "[NOT SAVED]" email path catches
requests. Each phase that adds env vars updates `.env.example`, the README table
and the production build warning. Each phase's first pull request includes one
example of its new pattern (a migration, a route, an email, a catalog role) and
the README gains an "Adding a …" section.

---

## 10. Runbook links

[docs/RUNBOOK.md](RUNBOOK.md) gains, phase by phase: migrating production for a
pull request; a failed or half-applied migration; a slipped deploy order
(re-entering leads from "[NOT SAVED]" emails); sign-in email outage; rotating the
link-signing secret; removing a staff member; a stuck Stripe webhook (Phase 10).

---

## 11. Open gates

| Gate | Decision needed | Owner | Evidence | Before |
|---|---|---|---|---|
| G0 | Brand, sending domain and Vercel Pro (D11) | Owner | Vercel dashboard, brand decision | Phase 1 reaches production |
| G2 | Build vs integrate an ATS/CRM for the pipeline and candidates (D12): where do requests and candidates live today, and what would the team actually use? | Owner + team | Current tools, cost, client-portal features | Phase 3 |
| G3 | Candidate consent and data retention (Philippine Data Privacy Act; PIPEDA for Canadian clients); whether consented intro clips are allowed | Owner + counsel | Written policy | Phase 4 |
| G1 | Client accounts: do clients want to sign in? | Owner | Answers from recent clients; at least half of clients opening shortlist links without a reminder over the first 10 shortlists; funnel numbers from the inbox | Phase 7 |
| G4 | Price model per placement (monthly, hourly, placement fee) | Owner | Current contracts | Phase 10 |

---

## Appendix: phase acceptance notes

The plan reviews (strategy, design, developer experience, engineering) agreed
these requirements. Each phase's own plan starts from its list.

**Phase 1 (roles)**
- Catalog lives beside `api/_lib/booking.ts`, is browser-safe and explicitly
  allowed in `tests/api-imports.test.mjs`. No public pay field until the owner
  confirms rates.
- Router gains path params as a typed page union with `href()`/`parse()`
  round-trip tests, including `/services` → `/roles`.
- Role page order: role and "who hires this" with the main button; typical week;
  task chips (toggle buttons that update the link); tools; levels; "How pricing
  works" pointing to the discovery call; repeat button. `/roles` is a grouped
  list, not a card grid.
- Task chips travel as `?role=<slug>&tasks=<ids>`, validated exactly like today's
  deep links; they appear as removable chips above the notes field and prefill
  once.
- Pages prerendered with their own title, description and canonical link;
  unknown slugs return a real 404.

**Phase 2 (data)**
- Introspect production first; commit a baseline; migrations transactional and
  checksummed; production guard.
- Duplicate submissions handled in one statement; team notification claimed
  atomically so concurrent duplicates send one email pair; a duplicate after a
  failed first attempt still notifies once.
- Existing rows backfilled to `received` with no events. Non-UUID submission ids
  replaced server-side. Existing booking tests pass unchanged.

**Phase 3 (staff inbox)**
- Inbox columns: owner, role, company/email, status, age, last event; stale
  first; filters for status, owner, stale; funnel strip (requests, discovery
  calls, shortlists, placements; median time-to-shortlist).
- Note composer defaults to internal; "client-visible" is visually distinct, with
  a preview and a "Send to client" button.
- Admin can edit a contact email (revokes links), resend links, relink a company,
  and preview what the client sees.

**Phase 4 (shortlist link)**
- Page: header (role, reference, owner, respond-by date, stage), 3-5 cards in
  staff order with identical fields and "why we picked them", per-card decision
  saved immediately and changeable until staff act, sticky summary, "Book
  interviews".
- States: not yet published, expired, invalid, all passed (request returns to
  sourcing), candidate withdrawn, save failed (retry, choice kept).
- Mobile-first, 44px controls, decisions announced to screen readers, stages
  labelled in text.

**Phase 7 (accounts)**
- Portal home: "Needs your action" first, then open requests with stage, owner
  and last updated, then placements. Empty state with "Start a request".
- First sign-in creates one company even if two tabs race; claims are idempotent;
  claimed requests show "submitted with your email on <date>".
- "Track this request" takes only a submission id, sends a fresh code to the
  stored address, answers identically for unknown ids, and is rate-limited.
  Requests that weren't saved get no tracking link.
