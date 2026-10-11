import { ArrowRight, Check } from "lucide-react";
import { PROCESS_STEPS } from "../content/process";
import { Link } from "../components/Link";
import { ButtonLink, PageHeader, Section, SectionHeader } from "../components/ui";

const NOT_YOUR_JOB = [
  "Source candidates manually",
  "Screen resumes or portfolios",
  "Run first-round interviews",
  "Coordinate hiring logistics",
  "Manage onboarding paperwork",
];

const VETTING = [
  {
    title: "Application review",
    body: "Candidates submit a detailed profile, and we review their background and experience.",
  },
  {
    title: "Skills assessment",
    body: "Candidates complete role-specific skills tests. Those who perform well move on to an interview.",
  },
  {
    title: "Structured interview",
    body: "An interview with our team covering skills, communication and working style.",
  },
  {
    title: "Background verification",
    body: "We verify employment history and credentials before a candidate is put forward.",
  },
];

const TRANSPARENCY = [
  "Defined stages with clear deliverables",
  "Regular status updates",
  "Visibility into where each candidate stands",
  "Direct access to our team",
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        title="How it works"
        intro="A managed hiring process that connects you with pre-vetted Filipino professionals. You stay informed at every stage while our team does the work."
      />

      <Section aria-labelledby="steps-heading">
        <SectionHeader id="steps-heading" title="Hiring in five steps" />
        <ol className="space-y-0 border-y border-line">
          {PROCESS_STEPS.map((step, index) => (
            <li key={step.title} className="grid gap-4 border-b border-line py-8 last:border-0 md:grid-cols-12 md:gap-10">
              <div className="flex items-center gap-4 md:col-span-4">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ink font-serif text-lg font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="text-xl">{step.title}</h3>
              </div>
              <p className="leading-relaxed text-ink-muted md:col-span-8 md:pt-1.5">{step.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="muted" aria-labelledby="handled-heading">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 id="handled-heading" className="text-[2rem] leading-tight md:text-[2.5rem]">
              Leave the hiring work to us
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-muted">
              From sourcing to onboarding, our team manages the process so you can keep running
              your business.
            </p>
            <ButtonLink to="booking" className="mt-8">
              Tell us what you need
              <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
          </div>
          <div className="rounded-xl border border-line bg-paper p-6 md:p-8">
            <p className="font-semibold text-ink">You don't need to:</p>
            <ul className="mt-4 space-y-3">
              {NOT_YOUR_JOB.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-ink-muted">
                  <Check size={18} className="mt-0.5 flex-none text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section aria-labelledby="vetting-heading">
        <SectionHeader
          id="vetting-heading"
          title="How we vet candidates"
          intro="Every professional passes four stages before we introduce them to you."
        />
        <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {VETTING.map((stage, index) => (
            <li key={stage.title} className="border-t border-line-strong pt-5">
              <p className="text-sm font-medium text-ink-subtle">Stage {index + 1}</p>
              <h3 className="mt-1 font-sans text-base font-semibold">{stage.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-muted">{stage.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="paper" className="border-y border-line" aria-labelledby="visibility-heading">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 id="visibility-heading" className="text-[2rem] leading-tight md:text-[2.5rem]">
              A clear process you can follow
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-muted">
              You get consistent updates, defined timelines and visibility into candidate progress
              and decision points.
            </p>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {TRANSPARENCY.map((item) => (
              <li key={item} className="flex items-start gap-2.5 py-4 text-ink">
                <Check size={18} className="mt-0.5 flex-none text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section aria-labelledby="guarantee-heading">
        <div className="max-w-3xl">
          <h2 id="guarantee-heading" className="text-[2rem] leading-tight md:text-[2.5rem]">
            90-day replacement guarantee
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            If your hire doesn't work out within the first 90 days through no fault of your own,
            we'll find a replacement at no additional placement fee. See our{" "}
            <Link to="terms" className="font-medium text-brand underline">
              Terms of Service
            </Link>{" "}
            for details.
          </p>
          <ul className="mt-6 space-y-3">
            {["Replacement at no additional placement fee", "We handle the off-boarding"].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-ink">
                <Check size={18} className="mt-0.5 flex-none text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="ink" aria-labelledby="hiw-cta">
        <div className="max-w-2xl">
          <h2 id="hiw-cta" className="text-[2rem] leading-tight text-white md:text-[2.5rem]">
            Start with the role you need.
          </h2>
          <p className="mt-4 text-lg text-inverse-muted">
            Tell us about it in about three minutes. No commitment.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="booking" size="lg" variant="inverse">
              Tell us what you need
              <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink to="services" size="lg" variant="inverse-outline">
              Explore roles
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
