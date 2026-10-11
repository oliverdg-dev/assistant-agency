# Market research: remote staffing and client experience

Researched 8 October 2026 from public websites, pricing pages, help centres,
job listings and review sites (Trustpilot, Clutch, Glassdoor). Prices are what
the pages said that day. Several competitors publish figures that disagree
between their own pages; where that happens both numbers are shown.
"(inferred)" marks a reading of the evidence rather than something a page
states. Comparison blogs written by rival agencies are marked as such and
treated as weak evidence.

Not reachable during research: Time Etc (connection refused, so its section
relies on search snippets and reviews), Staff Domain (maintenance page). Wing
Assistant's pages render with JavaScript and could only be read through search
snippets and third-party reviews.

Companion documents: [ROLE-RESEARCH.md](ROLE-RESEARCH.md),
[PORTAL-ARCHITECTURE.md](PORTAL-ARCHITECTURE.md).

---

## 1. Summary

- **The market has split into three price tiers.** DIY marketplaces at about
  $70 to $100 a month plus the worker's salary; itemised managed staffing at
  roughly $1,500 to $2,000 a month for an entry role; all-in premium managed
  placement at $2,000 to $3,600 a month. US-based assistants (BELAY, Time Etc)
  sit above that per hour.
- **Everyone sells a named human.** Account manager, success manager,
  engagement manager, partnership manager. It is table stakes, not a
  differentiator.
- **Modern premium agencies show no client portal.** Pearl Talent, Hire
  Overseas, Penbrothers, Somewhere, MyOutDesk, BELAY and Prialto show nothing a
  client logs into to follow a hire. The tools that do exist are either
  monitoring suites (Cloudstaff, Remote Staff, OnlineJobs' Timeproof) or task
  apps for an assistant already in place (Wing Workspace, Time Etc dashboard).
  Nobody shows the hiring stage itself: request status, shortlist, interviews,
  onboarding.
- **Trust problems cluster around billing, turnover and slow replies,** not
  around a lack of features.
- **Guarantees, month-to-month terms and starts within one to two weeks are
  now expected.** Lock-ins, setup fees and buyout fees read as dated.
- **Role pages are mostly shallow tiles.** The few agencies with deep role pages
  that include tasks and salary bands (Somewhere, Penbrothers, VirtualStaff's pay
  guide) win search traffic.

What this means for us: the portal is a real gap, but it will not win a client
on its own. Clients choose on trust, price clarity, speed and the guarantee.
The portal's job is to make those promises visible: show the hire moving, show
what the client is paying for, and make the after-hire care something they can
see. Section 6 turns this into a positioning recommendation.

---

## 2. Competitor comparison

### At a glance

| Company | Model | Talent | Published price | How a client starts | Client chooses the hire? | Client-facing product | Guarantee and terms |
|---|---|---|---|---|---|---|---|
| **MyOutDesk** | Managed, dedicated full-time | PH (plus Peru, Morocco signals) | From $1,988/mo; specialised from $2,500 | Book a strategy call | Yes, interviews with 3 | None shown; internal monitoring | Free rematch; terms not stated |
| **Wing Assistant** | Managed, dedicated part- or full-time | PH mainly | $699 PT / $999 FT (third parties report $899 / $1,599, demo-gated) | 15-min call | No, assigned | **Wing Workspace**: tasks, workflows, chat, screen-recorded SOPs | 24h or 30-day replacement; month-to-month |
| **Athena** | Managed EA plus coaching | PH, now Kenya | $3,000/mo (12-month) or $3,600/mo (90-day min) | Long intake questionnaire, then call | No, algorithmic match | "Client portal" link, contents private; playbook library | Rematch "rare"; buyout up to $24k reported |
| **BELAY** | Fractional US assistants and finance | US | Not published (third parties: ~$42 to $50/hr) | 4-step lead form, then call | Matched by consultant | None shown | Right-Fit rematch; buyout up to $20k reported |
| **Prialto** | Managed units of 55 hrs, primary plus 2 backups | PH, Kenya, Guatemala | $1,600 per unit (FAQ says $1,500); FT from $3,600 | Survey and call | No, assigned | Process system for backups; no dashboard shown | 90-day minimum, $250 setup fee |
| **Time Etc** | Fractional US assistants, hour blocks | US | $390 (10 h) to $2,160 (60 h) | Consultation | Can talk to the assistant first | **Dashboard**: tasks, logged time, billing | No contract; hours roll over |
| **Cloudstaff** | Large managed offshore teams, near-BPO | PH core, Colombia, India, Kenya | Not published (calculator shows savings only) | Discovery call | Picks from pre-vetted | **8+ separate apps**: staff dashboard, timesheets, leave calendar, tasks, messaging, screenshots | One monthly rate; 15 to 25 days to start |
| **Remote Staff** | Managed PH contractors, hourly | PH | Not published ("from $4/hr" on a third-party listing) | Job and behavioural assessment, then call | Yes, client picks who to interview | Proof-of-hours platform: attendance, usage, screenshots | Billed only for proven hours |
| **VirtualStaff.ph** | "Seat" platform: client picks and pays salary, platform runs payroll | PH | **$99/mo per seat + salary** ($500 to $1,200 typical) | Self-serve seat purchase | Yes | Attendance, contracts, payments | 30-day refund (another page says 14) |
| **OnlineJobs.ph** | DIY job board | PH | $69 or $99/mo | Self-serve | Yes, entirely DIY | Job board plus Timeproof (screenshots) and EasyPay | Money back if no hire |
| **Pearl Talent** | Premium managed, AI-trained hires | PH, Brazil, Mexico | From $3,000/mo | Call; profiles shown fast | Yes | None shown | 30-day replacement (also "unlimited"); no lock-in |
| **Hire Overseas** | Managed all-in, also direct hire and EOR | PH, LatAm, South Africa and more | From $2,000/mo all-in; EA example $2,400 | 30-min call | Yes, about 3 candidates | None shown | 14-day money back plus "forever replacement"; $0 setup, termination and role-change fees |
| **Penbrothers** | Managed PH teams, itemised | PH | Example: $1,000 salary + $463 benefits + **$500 fee** = $1,963/mo | Discovery call | Yes | None shown | Free replacement; **"Hypercare"** 180-day after-hire programme |
| **Somewhere** | Direct hire, managed, EOR | 18+ countries incl. PH | Role bands on role pages (e.g. $1,190 to $2,680/mo) | Call plus refundable deposit | Yes | None shown | 6-month guarantee |
| **Magic** | Co-managed assistants plus on-demand pool | Not named | ~$13.50/hr (other pages say $10 to $15) | **Self-serve sign-up** | Assigned | Real client product: vault for credentials and SOPs, meeting automation, backup pool | Rapid replacement; weekly billing |
| **Outsourced Doers** | Pre-trained marketing and admin VAs | PH (Davao) | Not published | Qualification call | Matched | Client login plus a project tool, undescribed | **3-month lock-in** |

### Company notes

Short notes on what each one teaches us. Full research notes with source URLs
were gathered during Phase 0 and can be regenerated; key sources are listed at
the end of this document.

**MyOutDesk.** The closest large comparable for a PH managed agency selling to
North American SMBs. Publishes a starting price, promises a hire in about 7
days, lets the client interview three candidates, and leans into verticals
(real estate, healthcare, mortgage) with compliance claims (SOC 2 Type I, HIPAA
BAA-ready). The only way in is "Book a free strategy call", and nothing shows a
client portal. *Lesson:* published price plus candidate choice plus vertical
depth is a proven formula; the gap is what happens between the call and the
start date.

**Wing Assistant.** Lowest published price in the managed tier and the clearest
example of a client app (Workspace: tasks, recurring routines, process videos,
chat). Clients cannot choose their assistant, and a hands-on review found the
"48 hours" start took one to two weeks, alongside billing-reply and turnover
complaints. *Lesson:* a task app is becoming normal for "managed", but cheap
plus fast plus assigned produces churn. Compete on quality, not price.

**Athena.** Proves executives will pay $3,000+ a month for a PH assistant when
it is sold as a delegation partnership with coaching, playbooks and security
(company laptops, SOC 2 Type II). The intake questionnaire educates while it
qualifies. Downsides: 12-month lock-in or 90-day minimum, no candidate choice,
a slow ramp, a reported buyout fee. *Lesson:* premium framing and delegation
education work; the long commitments are the opening.

**BELAY.** The high-touch US model North American SMBs already trust: a Client
Success Consultant who matches by hand and stays as the contact. Its lead form
captures role and revenue band before the call. No published price, no portal,
a reported buyout fee. *Lesson:* our existing three-step form already does
what BELAY's does. Matching by people, with one named consultant, is the
expected standard.

**Prialto.** Turns continuity into a product: every client gets a primary
assistant, two backups and an engagement manager who documents the client's
processes so a backup can step in. Clear unit pricing, but a 90-day minimum, a
setup fee and no candidate choice. *Lesson:* backup coverage and documented
SOPs are a differentiator a small agency can offer and show.

**Time Etc.** The most portal-like product among assistant services: clients
see tasks, logged time and billing in one dashboard, and can talk to an
assistant before committing. Strong reviews (4.8 from 281 on Trustpilot) with
turnover as the repeated complaint. US-only and capped at 60 hours. *Lesson:*
visible time and billing build trust; this is the closest model for our
post-hire portal.

**Cloudstaff.** The most tooling in the PH segment, split across eight or more
apps (staff dashboard, timesheets, leave calendar, skill browser, messaging,
tasks, rewards) with screenshot monitoring in the older app. Pricing is hidden
behind a savings calculator. Its few Trustpilot reviews include one alleging
billing for hours not worked. *Lesson:* clients of offshore teams do want
timesheets, leave and one invoice, but in one place and without surveillance.

**Remote Staff.** Long-running (since 2007), AU-SME heavy, now targeting the US.
Bills hourly with proof of hours (attendance, computer usage, screenshots) and
credits hours not worked. No published price, three domains with mixed
audiences. *Lesson:* proof of hours is what this segment expects; it can come
from approved timesheets instead of screenshots.

**VirtualStaff.ph.** The clearest pricing in the PH segment: $99 a month per
seat plus the salary, both shown separately, with typical salary bands per
role. The client still chooses and manages. *Lesson:* "fee plus salary, shown
separately" is now an accepted way to talk about price here.

**OnlineJobs.ph.** The DIY end: job board, free time tracker with screenshots,
and a payments ledger. Trustpilot 3.4 from 289 reviews, with VA ghosting, weak
vetting and copy-paste support as the main complaints. *Lesson:* employers who
were burned hiring directly are a natural audience for a managed agency that
takes on the hiring risk.

**Pearl Talent.** The closest analogue to a premium small agency: from $3,000 a
month, profiles shown quickly, placement "as early as 4 days", 30-day
replacement, 30-60-90 day check-ins, and "AI+" training for hires. No visible
portal. *Lesson:* AI-ready talent and a named after-hire rhythm are the current
premium selling points.

**Hire Overseas.** The best pricing page in the set: "from $2,000 a month, all
in", an itemised list of $0 fees (recruiting, setup, termination, role
change), a 14-day money-back and a "forever replacement" guarantee, roughly
three candidates per shortlist and a 3 to 5 day typical start. *Lesson:* the
risk-reversal block is easy to copy and directly answers buyer anxiety.

**Penbrothers.** The most honest price breakdown (salary, benefits, management
fee on separate lines) and a named after-hire programme, "Hypercare": 180 days,
three phases, bi-weekly check-ins, KPIs set in month one. *Lesson:* packaging
the first six months as a named service is a strong pattern; showing it in a
portal would be new.

**Somewhere** (formerly Support Shepherd). Large and SEO-driven, with hundreds of
role pages that each carry a salary band and a 6-month guarantee. *Lesson:* deep
role pages are how this market is searched.

**Magic.** The most product-like client experience: self-serve sign-up, a vault
for credentials and SOPs, meeting automation, and an on-demand backup pool.
Pricing pages conflict with each other. *Lesson:* a secure place for SOPs and
logins is a real client need once a hire starts.

**Outsourced Doers.** Specialised (marketing operations), pre-trained, supervised
by team leaders. Opaque pricing and a 3-month lock-in. *Lesson:* specialisation
sells; lock-ins look dated.

---

## 3. Features across the market

How the market handles each part of the client journey, and where the gap is.

| Area | What competitors do | Gap or opening |
|---|---|---|
| **Onboarding and account creation** | Almost everyone requires a call. Athena and BELAY put a qualifying form in front of it. Only marketplaces and Magic offer real self-serve sign-up. Nobody creates an account at the point of request. | Let the request itself become the account: submit the form, then follow it. Keep the call, which buyers of a $2,000+ a month hire expect, but show progress before and after it. |
| **Job requests** | Lead forms (BELAY, MOD) or questionnaires (Athena). Remote Staff uses job and behavioural assessments. | Our three-step form is already lighter than most. The opening is what the client sees after submitting. |
| **Role selection** | Mostly shallow tiles. Wing and Somewhere run hundreds of SEO role pages. A few publish salary bands. | Role pages that say what the person does day to day, with tools and seniority, linked straight into the form. |
| **Talent matching** | Split between "we assign" (Wing, Prialto, Athena) and "you interview a small shortlist" (MOD, Hire Overseas, Pearl, Time Etc). Reviewers criticise assignment without choice. | Keep client choice. Show the shortlist in the portal instead of a PDF in an email. |
| **Scheduling** | Done by email and calendar links. Nobody shows interview scheduling as a product. | Time-zone-aware interview scheduling attached to the shortlist. |
| **Candidate management** | Bullhorn-style ATS portals let clients approve or reject submitted candidates; no PH agency shows this publicly. | Shortlist cards with "interview" or "pass, because..." captured as data. |
| **Support and communication** | Universal named contact. Prialto adds backups; Athena adds coaching and playbooks; Penbrothers and Pearl run check-in programmes. | Make the account manager, the check-in schedule and the notes visible. |
| **Billing and subscriptions** | One monthly invoice everywhere. Remote Staff bills proven hours only. Self-serve billing exists only at marketplaces and Magic. Billing disputes and slow billing replies are recurring complaints. | Invoices in the portal that line up with placements, hours and leave. Stripe-hosted payment, no card handling. |
| **Workforce management** | Legacy players monitor (screenshots, usage, attendance). Modern premium players don't advertise monitoring. Time Etc shows logged time. Cloudstaff shows leave calendars. | Approved timesheets and a leave calendar with Philippine holidays, without surveillance. Integrate a time tracker rather than build one. |

---

## 4. Client experience observations

1. **The experience goes dark after the form.** Across the market, the client
   submits a form, has a call, and then waits for emails. "Regular status
   updates" and "visibility" are promised in copy (our own How it works page
   promises both) but delivered by inbox.
2. **Clients want to choose.** The loudest complaints about assigned assistants
   are about fit and turnover. A small shortlist and a real interview are
   valued.
3. **Speed promises are often missed.** Wing's 48 hours became one to two weeks
   in a hands-on review; Athena's full ramp is reported at three to four months.
   A realistic promise that is kept beats a fast one that is broken. Showing the
   stage a request is in is the honest way to manage this.
4. **Continuity worries buyers.** What happens when the assistant is sick,
   leaves, or isn't working out? Prialto's backups and everyone's replacement
   guarantee exist because of this.
5. **Billing is where trust breaks.** The negative reviews that are not about
   turnover are about invoices: hours charged that weren't worked, credits not
   applied, billing questions answered after 18 days.
6. **Buyers check reviews and see very few.** Most competitors have tens of
   independent reviews, not hundreds. A small agency is not at a large
   disadvantage here if it collects reviews from the start.
7. **Pricing is moving into the open.** The old "book a call to learn the price"
   is now the minority among modern players, and the ones that publish do best
   when they itemise and list what is free.

---

## 5. Opportunities for our platform

In rough order of value to a small agency, with whether it needs software.

| # | Opportunity | Software? | Where it lands |
|---|---|---|---|
| 1 | **Make the hire visible.** Request status, shortlist, interviews and onboarding in one place the client can check instead of emailing. Nobody in the premium managed tier shows this. | Yes | Portal phases 4, 5, 7, 8, 9 |
| 2 | **Role clarity.** Deep role pages: what the person does each week, tools, seniority levels, who hires it, linked straight into the form. Search traffic and better-qualified requests. | Yes, light | Phase 1 |
| 3 | **Transparent pricing and risk reversal.** Starting price per role band, itemised (salary, benefits, fee), plus a "what's free" and guarantee block. | Content first | Owner decision; can ship with Phase 1 |
| 4 | **Named after-hire programme, visible.** A 90-day check-in rhythm with notes and the next date shown in the portal. Penbrothers and Pearl sell this; nobody shows it. | Yes, later | Phase 10 |
| 5 | **Billing you can reconcile.** Invoice lines that match placements, hours and leave. Answers the most common complaint in the segment. | Yes, later | Phases 9 and 11 |
| 6 | **Continuity.** A named backup or a documented SOP handover per client. | Service first, portal later | Later |
| 7 | **No surveillance.** Approved timesheets and outcome summaries, not screenshots. A positioning choice as much as a feature. | Integration later | Later |

What we should **not** compete on: lowest price (Wing, VirtualStaff and the
marketplaces own that), breadth of countries (Hire Overseas, Somewhere), or an
eight-app tooling suite (Cloudstaff).

---

## 6. Recommended positioning

### Checking the brief's assumptions

| Assumed positioning | Verdict | Evidence |
|---|---|---|
| Philippine remote talent | **Keep.** | The Philippines is the default base for this segment and for North American buyers. Some rivals are adding Kenya and Latin America; staying focused lets us be specific about time zones, holidays and culture. |
| Managed staffing | **Keep.** | The DIY end has the worst reviews (ghosting, weak vetting). Managed buyers pay for someone to absorb hiring risk. |
| Human support | **Keep, but it is not a differentiator.** | Every competitor sells a named human. Necessary, not distinctive. |
| Modern technology | **Reframe.** | "Technology" is not what buyers ask for. Visibility is. Lead with what the client can see, not with the software. |
| Better client visibility | **Strongest opening.** | No premium managed competitor shows the hiring pipeline or after-hire care to the client. Our own site already promises it. |
| Better role clarity | **Keep.** | Most role pages are tiles. Deep role pages are how this market is searched. |
| Simple onboarding | **Keep, carefully.** | Removing the call isn't the goal: buyers of a $2,000+ hire expect one. The goal is no long questionnaires, no lock-ins, and a request that becomes something you can follow. |
| Premium client experience | **Keep, with a price decision.** | The premium managed tier is $2,000 to $3,600 a month. The owner needs to place us in it (likely the lower half, against Hire Overseas and MyOutDesk rather than Athena). |

### Recommended position

> **Vetted Philippine professionals for North American businesses, placed and
> supported by a named team, with every step visible: from the request, to the
> shortlist, to the hire, to the first 90 days.**

In practice:

- **Promise:** you always know where your hire is, who is looking after you, and
  what you are paying for.
- **Proof points to build** (each needs owner confirmation before it appears on
  the site): a realistic time-to-shortlist, a small shortlist you interview, a
  replacement guarantee, month-to-month terms with no setup or buyout fee,
  itemised pricing, a named 90-day check-in programme.
- **Product that backs it up:** role pages that explain the job; a request
  tracker; shortlist review; interview scheduling across time zones;
  onboarding checklist; then team, check-ins and invoices.
- **Avoid:** "AI-powered" claims we can't show, unconfirmed statistics (see
  `TODOS.md`), surveillance features, long commitments.

---

## 7. What this changes in the roadmap

Details in [PORTAL-ARCHITECTURE.md](PORTAL-ARCHITECTURE.md), section 10.

1. **Roles first (Phase 1)** stays. It is the cheapest visible win, helps search
   and improves request quality. Connect roles to the form at the same time
   rather than in a later phase.
2. **Staff tools before client tracking.** Visibility is only real if the team
   can update a request in seconds. Admin request management moves up to
   Phase 3.
3. **Shortlists before the calendar.** The interview is the scheduling event
   that matters, and shortlist review is the most visible gap in competitors'
   client experience.
4. **Billing stays last.** It depends on placements and rates, and the trust
   problem is solved by showing reconcilable invoices, which needs real
   placement data first.

Non-software work that matters as much as Phase 1 and needs the owner: the
brand, a price range per role band, the guarantee terms, a realistic
time-to-shortlist, and a "who we are" block (all already listed in
`TODOS.md`).

---

## Key sources

First-party pages read on 8 October 2026 unless noted.

- MyOutDesk: myoutdesk.com/pricing, /signup, /services; Clutch profile
- Wing Assistant: wingassistant.com/workspace, /how-it-works (search snippets);
  pricingsaas.com/companies/wingassistant; hackceleration.com review
- Athena: athena.com/pricing, /how-it-works, /signup-match; jobs.athena.com
- BELAY: belaysolutions.com/get-started, /services/assistant/virtual;
  Trustpilot; Glassdoor
- Prialto: prialto.com/pricing, /faq; Trustpilot
- Time Etc: search snippets of timeetc.com/pricing and /teams; Trustpilot
- Cloudstaff: cloudstaff.com/teambuilder, /why-cloudstaff/cloudstaff-technology,
  MyStaff blog post (2020); Trustpilot
- Remote Staff: remotestaff.com/recruitment, /after-hire-support;
  remotestaff.com.au/pricing
- VirtualStaff.ph: virtualstaff.ph/subscription-pricing, /how-it-works-employer
- OnlineJobs.ph: onlinejobs.ph/pricing, /timeproof, /easypay; Trustpilot
- Pearl Talent: pearltalent.com/pricing; Trustpilot
- Hire Overseas: hireoverseas.com/pricing; Trustpilot
- Penbrothers: penbrothers.com, /hypercare, /how-it-works
- Somewhere: somewhere.com
- Magic: getmagic.com and help-centre pricing articles
- Outsourced Doers: outsourceddoers.com
- Client portal patterns: Remote (remote.com HR Core), Bullhorn marketplace
  and G2, Deel API docs, BambooHR × Remote
