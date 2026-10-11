# Gap Closure Plan

## Goal

Turn the current project from a polished marketing prototype into a production-ready agency website that:

- has real page URLs
- captures leads reliably
- uses manageable content and data
- supports SEO and analytics
- is stable to deploy and maintain

## Current State Summary

The site already has:

- a strong visual frontend
- clear service positioning
- core marketing pages
- a booking form UI
- talent, case studies, and legal content

The main gaps are:

- no real routing
- no backend or submission flow
- no persistence for leads or content
- hardcoded business data
- limited SEO
- no analytics or operational tooling
- leftover template dependencies and config

## Recommended Delivery Order

Work in this order:

1. Stabilize the app structure
2. Make the lead flow real
3. Move content out of hardcoded UI
4. Improve SEO, analytics, and trust
5. Harden for launch and maintenance

---

## Phase 1: Stabilize The App Structure

### Step 1. Add real routing

Why:

- pages should have real URLs
- users should be able to refresh without losing their place
- legal pages should be directly shareable
- SEO improves when pages are individually addressable

What to do:

- add a router such as `react-router-dom`
- convert the current state-based navigation into route-based navigation
- create routes for:
  - `/`
  - `/services`
  - `/how-it-works`
  - `/talent`
  - `/booking`
  - `/case-studies`
  - `/privacy`
  - `/terms`
  - `/cookies`
- update navbar and footer navigation to use links instead of state changes

Definition of done:

- every page has its own URL
- refreshing on any page keeps you on that page
- browser back/forward buttons work normally

### Step 2. Refactor layout structure

Why:

- the app is currently centralized in `src/App.tsx`
- separating layout from page content makes future work much easier

What to do:

- create shared layout components:
  - `Navbar`
  - `Footer`
  - `PageLayout`
- move homepage sections into dedicated components
- keep page files focused on their own content

Definition of done:

- `App.tsx` becomes a lightweight route shell
- layout components are reusable and easier to maintain

### Step 3. Clean unused dependencies and template leftovers

Why:

- the project still carries AI Studio / Gemini starter remnants
- this creates confusion for future development

What to do:

- remove unused packages if they are truly not needed:
  - `@google/genai`
  - `express`
  - `dotenv`
- remove unused config references like `GEMINI_API_KEY` if the site does not use them
- update `README.md` to match the actual project
- rename the package if needed from `react-example` to a real project name

Definition of done:

- the repo setup reflects the actual website
- onboarding a new developer is straightforward

---

## Phase 2: Make The Lead Flow Real

### Step 4. Decide the submission destination

Why:

- the booking form currently only pretends to submit
- this is the biggest functional gap

Pick one of these first:

1. Send leads to email
2. Send leads to a CRM
3. Save leads to a database and notify the team

Recommended first version:

- submit to a lightweight backend endpoint
- store leads in a database
- send notification email or Slack message

Suggested stack options:

- Vercel + serverless function + Resend + Supabase
- Netlify Forms for a fast MVP
- custom backend if you already have one

Definition of done:

- a real form submission creates a usable business record
- the team receives the lead without manual copy-paste

### Step 5. Implement backend form handling

What to do:

- create an API endpoint for booking requests
- validate fields server-side
- sanitize inputs
- return success and error states properly
- connect the frontend form to the endpoint

Add:

- loading state
- error messages
- duplicate-submission protection
- basic anti-spam protection

Definition of done:

- submitting the booking form creates a real lead
- failures show meaningful user feedback

### Step 6. Add CRM or follow-up workflow

Why:

- capturing a lead is not enough if follow-up is manual and inconsistent

What to do:

- connect submissions to:
  - HubSpot
  - Airtable
  - Notion
  - Google Sheets
  - or your internal CRM
- map fields clearly:
  - name
  - email
  - company
  - role requested
  - budget
  - preferred start date
  - message
- trigger a confirmation email

Definition of done:

- every new inquiry enters the same workflow automatically

---

## Phase 3: Move Content Out Of Hardcoded UI

### Step 7. Externalize business content

Why:

- talent profiles, testimonials, stats, and case studies are hardcoded in components
- updating them currently requires code edits

What to do:

- move static content into structured files first:
  - `src/content/talent.ts`
  - `src/content/case-studies.ts`
  - `src/content/testimonials.ts`
  - `src/content/site.ts`
- later, if needed, move to a CMS

Definition of done:

- content updates are separated from layout code

### Step 8. Decide whether the talent roster is real or illustrative

Why:

- the current talent list looks real, but it is static demo data
- this can create trust issues if not handled carefully

Choose one:

1. Keep it as illustrative sample content and label it clearly
2. Replace it with real candidate snapshots from your actual pipeline
3. Remove names and show role categories instead

Recommended:

- if this is not connected to live candidate operations yet, label it clearly as representative talent examples

Definition of done:

- no ambiguity about whether the roster is real-time inventory

### Step 9. Add a CMS if non-developers will update content

Use this only if the business needs regular content edits.

Options:

- Sanity
- Contentful
- Strapi
- Notion-backed workflows

Use a CMS for:

- case studies
- testimonials
- open talent highlights
- legal copy
- homepage copy experiments

Definition of done:

- marketing content can be updated without touching source code

---

## Phase 4: Improve SEO, Analytics, And Trust

### Step 10. Add SEO foundations

What to do:

- add page-specific titles and meta descriptions
- add Open Graph tags
- add canonical URLs
- create `robots.txt`
- create `sitemap.xml`
- use real route URLs

Optional next step:

- consider SSR or prerendering if SEO becomes a major acquisition channel

Definition of done:

- each page has meaningful metadata and can be indexed correctly

### Step 11. Add analytics and conversion tracking

Why:

- you need to know which pages convert

What to do:

- install analytics:
  - Google Analytics
  - Plausible
  - PostHog
- track key events:
  - page view
  - booking form started
  - booking form submitted
  - CTA clicked
  - talent card interaction

Definition of done:

- you can answer where leads come from and which pages perform best

### Step 12. Add trust and compliance elements

What to do:

- add a cookie consent banner if you use analytics or ad pixels
- make legal content reflect real operations
- verify contact information and company details
- replace placeholder social links
- add privacy and data handling details that match actual systems

Definition of done:

- legal and trust signals align with how the business truly operates

---

## Phase 5: Harden For Launch And Maintenance

### Step 13. Improve UX and accessibility

What to do:

- test mobile navigation thoroughly
- improve keyboard navigation
- check color contrast
- add visible focus states where needed
- ensure form labels and validation are accessible
- optimize image usage and loading performance

Definition of done:

- the site works well across devices and is easier to use for all visitors

### Step 14. Add testing

Minimum recommended:

- component smoke tests
- form submission flow tests
- route rendering tests

Suggested tools:

- Vitest
- React Testing Library
- Playwright for end-to-end testing

Definition of done:

- key flows are protected against regression

### Step 15. Add deployment and environment discipline

What to do:

- define environments:
  - local
  - preview
  - production
- document required environment variables
- set up CI checks:
  - typecheck
  - build
  - tests
- choose deployment target:
  - Vercel
  - Netlify
  - Cloudflare Pages

Definition of done:

- every change can be validated and deployed consistently

### Step 16. Add monitoring and error handling

What to do:

- install error monitoring such as Sentry
- log API failures
- alert on broken lead submission flow

Definition of done:

- failures are visible before they cost you leads

---

## Suggested Milestones

### Milestone 1: Minimum Production Ready

Target outcome:

- real routing
- real booking form submission
- proper success and error handling
- cleaned config and dependencies
- working deployment

This is the minimum version that can support real business use.

### Milestone 2: Marketing Ready

Target outcome:

- analytics
- SEO metadata
- better trust signals
- cleaned content model
- accurate legal and contact details

This is the version that can be promoted confidently.

### Milestone 3: Scalable Operations

Target outcome:

- CMS or admin workflow
- CRM integration
- automated notifications
- testing and monitoring

This is the version that supports ongoing growth without fragile manual work.

---

## Practical Next 5 Tasks

If you want the fastest path forward, do these next:

1. Replace state-based page switching with real routing
2. Implement a real booking form submission endpoint
3. Connect submissions to email or CRM
4. Move hardcoded business content into content modules
5. Clean the starter-template config and README

## Recommended Ownership Split

If multiple people are working on this, split it like this:

- Frontend: routing, page structure, SEO metadata, accessibility
- Backend: form endpoint, validation, notifications, storage
- Marketing/Ops: real copy, testimonials, legal review, CRM workflow

## Final Note

This project already does the hardest early marketing job well: it clearly communicates the offer and looks credible. The remaining work is mostly about making the business flows real, reliable, and maintainable.

3. test bugs (account problem)
