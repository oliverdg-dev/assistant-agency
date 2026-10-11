# Design system

The site sells people and business outcomes to North American decision-makers,
so the look is restrained and established: a professional-services firm, not a
software startup. Clean over flashy.

## Tokens (`src/index.css`)

| Token | Value | Use |
|---|---|---|
| `ink` | `#0f1f3a` | Headings, body text, dark sections |
| `ink-muted` | `#4a5568` | Secondary text |
| `ink-subtle` | `#5f6878` | Hints, captions, meta |
| `brand` / `brand-hover` | `#0047b3` / `#003a94` | Primary buttons, links, focus ring |
| `brand-tint` | `#eaf0fa` | Selected segment, active suggestion |
| `surface` | `#fafaf8` | Page background |
| `surface-2` | `#f3f2ee` | Alternate section background |
| `paper` | `#ffffff` | Cards, header, footer, form |
| `line` / `line-strong` | `#e4e2dc` / `#c9c5ba` | Hairlines / input borders |
| `success`, `error` (+ `-tint`) | `#1a7f4b`, `#b42318` | Status only, always with an icon and text |
| `inverse-muted`, `inverse-link` | `#c3cad6`, `#9cc0ff` | Text and links on `ink` sections |

All text pairs meet WCAG AA (4.5:1).

**Type.** Headings: Source Serif 4, 600. Body and UI: Inter 400/500/600.
h1 34px below 375px, 40px from 375px, 48px from 768px, up to 56px on the
homepage. h2 32/40px. Body 16–18px; never below 14px.

**Shape.** Buttons and inputs 8px radius (`rounded-lg`), cards 12px
(`rounded-xl`). Borders instead of shadows; shadows only on the dropdown.

**Spacing.** Sections `py-16 md:py-24`; content width `max-w-6xl` with 16/24px
side padding (`Container`).

**Breakpoints.** Tailwind defaults plus `xs` = 375px.

## Primitives (`src/components/ui.tsx`)

```tsx
<Section tone="muted" aria-labelledby="roles-heading">     // plain | muted | paper | ink
  <SectionHeader id="roles-heading" title="Roles we place" intro="…" />
</Section>

<ButtonLink to="booking" size="lg">Tell us what you need</ButtonLink>
<Button variant="secondary">Back</Button>                  // primary | secondary | ghost | inverse | inverse-outline
<TextLink to="how-it-works">More about our process</TextLink>

<Field id="field-sector" label="What industry is your business in?" hint="…" error={errors.sector}>
  <input id="field-sector" className={controlClass(Boolean(errors.sector))} … />
</Field>

<PageHeader title="How it works" intro="…" />               // top of every inner page
```

Use `Link` (not `<button onClick>`) for navigation so links can be opened in a
new tab and copied.

## Rules

- One primary action everywhere: **Tell us what you need** → `/get-started`.
- At most one eyebrow label per page, in the hero only.
- No gradients, glows, blobs, floating shapes, rotated images or
  scale-on-hover.
- Icons sparingly: checks, status and link arrows. No icon-per-card rows.
- Show, don't tell: a short heading and at most one line of support. When an
  idea can be a small diagram or UI preview (shortlist, swimlane process,
  time-zone strip), draw it instead of writing a paragraph.
- Every homepage section has its own composition. Only one bento on the page;
  everything else uses hairline lists, split layouts or full-width bands.
  Rounded containers are for bento tiles, UI previews and photos only.
- No new stock photography. Real photos replace `HERO_PHOTO` in
  `src/pages/Home.tsx` when the owner supplies them (TODOS.md).
- No statistics, testimonials, client names or guarantees unless the team has
  confirmed them (see TODOS.md).
- Motion: a 200ms fade between pages only; nothing under
  `prefers-reduced-motion`.
- Every interactive element is at least 44px tall and shows the brand focus
  ring.
