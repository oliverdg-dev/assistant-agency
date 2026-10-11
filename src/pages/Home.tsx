import { ArrowRight, BadgeCheck, Check } from "lucide-react";
import { Fragment } from "react";
import { roleGroups } from "../../api/_lib/booking.js";
import { CASE_STUDIES } from "../content/caseStudies";
import { PROCESS_STEPS } from "../content/process";
import { Link } from "../components/Link";
import { ButtonLink, Container, Eyebrow, Section, TextLink } from "../components/ui";

// Stock placeholder. Replace with a photo of a real placed professional
// (see TODOS.md, "Real photography").
const HERO_PHOTO = {
  src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=900",
  alt: "Professional working at a laptop",
};

// The checks every candidate passes, shown as a card over the hero photo.
const VETTING_CHECKS = ["Skills assessment", "English interview", "Background check"];

// Illustrative only: shows what a shortlist looks like, not real people.
const EXAMPLE_SHORTLIST = [
  { initials: "C1", meta: "6 years · QuickBooks, Xero" },
  { initials: "C2", meta: "4 years · QuickBooks" },
  { initials: "C3", meta: "8 years · Xero, NetSuite" },
];

const LEGWORK = ["Sourcing", "Interviews", "Skills tests", "Background checks", "Onboarding"];

// Who does each step in PROCESS_STEPS: the client only acts on two of them.
const STEP_OWNER: Array<"you" | "us"> = ["you", "us", "us", "you", "us"];

const WHY_PHILIPPINES = [
  { title: "English is an official language", body: "Used across business and education." },
  { title: "A deep professional services industry", body: "Support, operations, finance and creative." },
  { title: "Used to international clients", body: "Familiar with North American tools and expectations." },
];

export default function HomePage() {
  const featured = CASE_STUDIES.filter((study) => study.featured);

  return (
    <>
      <Hero />
      <WhatsDifferent />
      <Roles />
      <Process />
      <WhyPhilippines />
      {featured.map((study) => (
        <Fragment key={study.client}>
          <ClientStory study={study} />
        </Fragment>
      ))}

      <Section tone="ink" aria-labelledby="cta-heading">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <h2 id="cta-heading" className="max-w-xl text-[2rem] leading-tight text-white md:text-[2.5rem]">
            Tell us what kind of talent you're looking for.
          </h2>
          <ButtonLink to="booking" size="lg" variant="inverse" className="flex-none">
            Tell us what you need
            <ArrowRight size={18} aria-hidden="true" />
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}

function Hero() {
  return (
    <section className="bg-surface pb-20 pt-12 md:pb-28 md:pt-20">
      <Container className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7 lg:pr-6">
          <Eyebrow>Philippine talent for North American teams</Eyebrow>
          <h1 className="text-[2.125rem] leading-[1.1] xs:text-[2.5rem] md:text-5xl lg:text-[3.5rem]">
            Skilled, AI-ready professionals to grow your team.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-muted">
            We find, vet and place remote professionals from the Philippines with North American
            businesses.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <ButtonLink to="booking" size="lg">
              Tell us what you need
              <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
            <p className="text-sm text-ink-subtle">About three minutes. No commitment.</p>
          </div>
        </div>
        <div className="relative lg:col-span-5">
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-2 md:aspect-[16/9] lg:aspect-[4/5]">
            <img
              src={HERO_PHOTO.src}
              alt={HERO_PHOTO.alt}
              className="h-full w-full object-cover"
              loading="eager"
              fetchPriority="high"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="relative mx-4 -mt-10 rounded-xl border border-line bg-paper p-5 shadow-[0_8px_30px_rgba(15,31,58,0.10)] sm:absolute sm:-bottom-8 sm:right-6 sm:mx-0 sm:mt-0 sm:w-72 lg:-left-12 lg:right-auto">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <BadgeCheck size={18} className="text-brand" aria-hidden="true" />
              Every candidate you meet has passed
            </p>
            <ul className="mt-3 space-y-2">
              {VETTING_CHECKS.map((check) => (
                <li key={check} className="flex items-center justify-between text-sm text-ink-muted">
                  {check}
                  <Check size={16} strokeWidth={2.5} className="text-success" aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

// One bento: the shortlist preview leads, two supporting tiles follow.
function WhatsDifferent() {
  return (
    <Section tone="muted" aria-labelledby="different-heading">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="pb-4 lg:col-span-5 lg:self-end lg:pb-8">
          <h2 id="different-heading" className="text-[2rem] leading-tight md:text-[2.5rem]">
            Hiring, handled.
          </h2>
          <p className="mt-3 text-lg text-ink-muted">You describe the role. We do the rest.</p>
        </div>

        <article className="rounded-xl border border-line bg-paper p-6 md:p-8 lg:col-span-7 lg:row-span-2">
          <h3 className="text-2xl md:text-[1.75rem]">A shortlist, not a pile of CVs</h3>
          <p className="mt-2 text-ink-muted">Only people who fit the role and passed every check.</p>
          <figure className="mt-6 overflow-hidden rounded-lg border border-line" aria-label="Example shortlist">
            <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
              <p className="text-sm font-semibold text-ink">Shortlist · Bookkeeper</p>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-subtle">Example</p>
            </div>
            <ul className="divide-y divide-line">
              {EXAMPLE_SHORTLIST.map((candidate) => (
                <li key={candidate.initials} className="flex items-center gap-4 px-4 py-3.5">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-tint text-xs font-semibold text-brand"
                  >
                    {candidate.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-medium text-ink">Bookkeeper</span>
                    <span className="block truncate text-sm text-ink-muted">{candidate.meta}</span>
                  </span>
                  <span className="flex flex-none items-center gap-1.5 text-sm font-medium text-success">
                    <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                    <span className="hidden sm:inline">Vetted</span>
                  </span>
                </li>
              ))}
            </ul>
          </figure>
        </article>

        <article className="rounded-xl border border-line bg-paper p-6 md:p-8 lg:col-span-5">
          <h3 className="font-sans text-lg font-semibold">AI-ready</h3>
          <p className="mt-1 text-ink-muted">Comfortable with the AI and automation tools you use.</p>
          <ol className="mt-6 flex flex-wrap items-center gap-2 text-sm font-medium text-ink" aria-label="How they work">
            {["Brief", "AI tools", "Finished work"].map((stage, index) => (
              <li key={stage} className="flex items-center gap-2">
                {index > 0 && <ArrowRight size={14} className="flex-none text-ink-subtle" aria-hidden="true" />}
                <span
                  className={
                    index === 1
                      ? "rounded-md bg-ink px-2.5 py-2 text-white sm:px-3"
                      : "rounded-md border border-line-strong px-2.5 py-2 sm:px-3"
                  }
                >
                  {stage}
                </span>
              </li>
            ))}
          </ol>
        </article>

        <article className="rounded-xl bg-ink p-6 text-white md:p-8 lg:col-span-12">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-4">
              <h3 className="font-sans text-lg font-semibold text-white">We do the legwork</h3>
              <p className="mt-1 text-inverse-muted">You make the final call.</p>
            </div>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:col-span-8 lg:flex lg:justify-between">
              {LEGWORK.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[0.9375rem]">
                  <Check size={16} strokeWidth={2.5} className="flex-none text-inverse-link" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>
    </Section>
  );
}

// An index, not a card grid: each row starts a request for that area.
function Roles() {
  return (
    <Section aria-labelledby="roles-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <h2 id="roles-heading" className="text-[2rem] leading-tight md:text-[2.5rem]">
              Roles we place
            </h2>
            <p className="mt-3 text-lg text-ink-muted">Pick an area to start a request.</p>
            <TextLink to="services" className="mt-6 inline-flex items-center gap-2">
              Roles and engagement options <ArrowRight size={16} aria-hidden="true" />
            </TextLink>
          </div>
        </div>
        <ul className="border-t border-line-strong lg:col-span-8">
          {roleGroups.map((group, index) => (
            <li key={group.label} className="border-b border-line">
              <Link
                to="booking"
                params={{ category: group.label }}
                className="group grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-4 py-5 md:grid-cols-[2.5rem_1fr_auto]"
              >
                <span className="text-sm tabular-nums text-ink-subtle">{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block font-serif text-xl font-semibold text-ink transition-colors group-hover:text-brand md:text-2xl">
                    {group.label}
                  </span>
                  <span className="mt-1 hidden text-sm text-ink-muted sm:block">{group.roles.join(" · ")}</span>
                </span>
                <ArrowRight
                  size={20}
                  className="self-center text-ink-subtle transition-[color,transform] group-hover:translate-x-1 group-hover:text-brand"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
          <li>
            <Link
              to="booking"
              className="group grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-4 py-5 md:grid-cols-[2.5rem_1fr_auto]"
            >
              <span aria-hidden="true" />
              <span className="font-medium text-brand group-hover:underline">
                Something else? Tell us about the role.
              </span>
              <ArrowRight size={20} className="self-center text-brand" aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </div>
    </Section>
  );
}

// Two swimlanes so it's obvious the client only acts on two steps.
function Process() {
  const lanes = [
    { owner: "you" as const, label: "You" },
    { owner: "us" as const, label: "Us" },
  ];

  return (
    <Section tone="paper" aria-labelledby="process-heading" className="border-y border-line">
      <div className="mb-10 flex flex-col gap-3 md:mb-14 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="process-heading" className="text-[2rem] leading-tight md:text-[2.5rem]">
            How it works
          </h2>
          <p className="mt-3 text-lg text-ink-muted">Five steps. You're needed for two.</p>
        </div>
        <TextLink to="how-it-works" className="inline-flex items-center gap-2">
          More about our process <ArrowRight size={16} aria-hidden="true" />
        </TextLink>
      </div>

      {/* Desktop: swimlanes (decorative; the list below carries the content) */}
      <div className="hidden md:block" aria-hidden="true">
        {lanes.map((lane) => (
          <div key={lane.owner} className="grid grid-cols-[4rem_repeat(5,1fr)] items-start">
            <p className="pt-2 text-sm font-semibold uppercase tracking-wider text-ink-subtle">{lane.label}</p>
            {PROCESS_STEPS.map((step, index) => {
              const here = STEP_OWNER[index] === lane.owner;
              return (
                <div key={step.title} className="relative min-h-28 pr-4">
                  <span className="absolute left-0 right-0 top-[1.125rem] h-px bg-line" />
                  {here && (
                    <div className="relative">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full font-serif text-base font-semibold text-white ${
                          lane.owner === "you" ? "bg-brand" : "bg-ink"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <p className="mt-3 max-w-[12rem] font-medium leading-snug text-ink">{step.title}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Mobile list; screen readers get it at every size */}
      <ol className="space-y-5 md:sr-only">
        {PROCESS_STEPS.map((step, index) => (
          <li key={step.title} className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 flex-none items-center justify-center rounded-full font-serif text-base font-semibold text-white ${
                STEP_OWNER[index] === "you" ? "bg-brand" : "bg-ink"
              }`}
            >
              {index + 1}
            </span>
            <span className="flex-1 font-medium text-ink">{step.title}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              {STEP_OWNER[index] === "you" ? "You" : "Us"}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function WhyPhilippines() {
  return (
    <Section aria-labelledby="why-heading">
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <h2 id="why-heading" className="text-[2rem] leading-tight md:text-[2.5rem]">
            Why the Philippines
          </h2>
          <dl className="mt-8 divide-y divide-line border-y border-line">
            {WHY_PHILIPPINES.map((item) => (
              <div key={item.title} className="py-4">
                <dt className="font-semibold text-ink">{item.title}</dt>
                <dd className="mt-0.5 text-[0.9375rem] text-ink-muted">{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="lg:col-span-7">
          <HoursOverlap />
        </div>
      </div>
    </Section>
  );
}

// A 24-hour strip in each time zone. The 9-to-5 bar sits in the same place on
// both, which is the point: their working day is your working day.
function HoursOverlap() {
  const start = 9 / 24;
  const width = 8 / 24;
  const rows = [
    { label: "Your team", zone: "Eastern Time", hours: "9 AM – 5 PM", ticks: ["12 AM", "6 AM", "12 PM", "6 PM"] },
    { label: "Your hire", zone: "Manila", hours: "9 PM – 5 AM", ticks: ["12 PM", "6 PM", "12 AM", "6 AM"] },
  ];

  return (
    <figure className="rounded-xl bg-ink p-6 text-white md:p-10">
      <p className="font-serif text-2xl leading-snug md:text-[1.75rem]">Your hours are their hours.</p>
      <p className="mt-2 text-inverse-muted">Many work North American business hours from Manila.</p>
      <div className="mt-8 space-y-7">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-2 flex items-baseline justify-between gap-4 text-sm">
              <span className="font-semibold text-white">
                {row.label} <span className="font-normal text-inverse-muted">· {row.zone}</span>
              </span>
              <span className="tabular-nums text-inverse-muted">{row.hours}</span>
            </div>
            <div className="relative h-3 rounded-sm bg-white/10">
              <span
                className="absolute inset-y-0 rounded-sm bg-inverse-link"
                style={{ left: `${start * 100}%`, width: `${width * 100}%` }}
              />
            </div>
            <div className="mt-1.5 grid grid-cols-4 text-xs tabular-nums text-inverse-muted" aria-hidden="true">
              {row.ticks.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-6 text-xs text-inverse-muted">
        Manila is 12 hours ahead of Eastern Daylight Time (13 in winter).
      </figcaption>
    </figure>
  );
}

function ClientStory({ study }: { study: (typeof CASE_STUDIES)[number] }) {
  return (
    <Section tone="muted" aria-labelledby="story-heading">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <figure className="lg:col-span-7">
          <h2 id="story-heading" className="font-sans text-sm font-medium text-ink-subtle">
            Client story · {study.industry}
          </h2>
          <blockquote className="mt-5 font-serif text-2xl leading-snug text-ink md:text-[2rem]">
            “{study.quote}”
          </blockquote>
          <figcaption className="mt-5 text-ink-muted">
            {study.author}, <span className="font-semibold text-ink">{study.client}</span>
          </figcaption>
          <TextLink to="case-studies" className="mt-8 inline-flex items-center gap-2">
            Read the case study <ArrowRight size={16} aria-hidden="true" />
          </TextLink>
        </figure>
        <dl className="grid content-start gap-6 border-t border-line-strong pt-6 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          {study.results.map((result) => (
            <div key={result.label} className="flex flex-col-reverse">
              <dt className="mt-1 text-sm text-ink-muted">{result.label}</dt>
              <dd className="font-serif text-4xl font-semibold text-ink md:text-5xl">{result.metric}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
