import { ArrowRight, Check } from "lucide-react";
import { Link } from "../components/Link";
import { ButtonLink, PageHeader, Section, SectionHeader } from "../components/ui";
import { ROLE_GROUPS, type RoleEntry } from "../content/roles";

const ENGAGEMENTS = [
  {
    title: "Part-time",
    detail: "About 20 hours a week",
    description: "Dedicated support without a full-time commitment.",
  },
  {
    title: "Full-time",
    detail: "About 40 hours a week",
    description: "A dedicated professional who owns the role and works your business hours.",
  },
  {
    title: "Team build",
    detail: "Several hires at once",
    description: "From a small pod to a full department. Choose 4–10 or 11+ people in the form.",
    link: { label: "Start a team request", params: { headcount: "4-10" } },
  },
];

function roleItem(role: RoleEntry) {
  return (
    <li key={role.name} className="py-8 first:pt-0 last:pb-0">
      <h3 className="text-xl md:text-[1.375rem]">{role.name}</h3>
      <p className="mt-2 leading-relaxed text-ink-muted">{role.does}</p>
      <p className="mt-4 text-sm font-medium text-ink">Typical tasks</p>
      <ul className="mt-2 space-y-2">
        {role.tasks.map((task) => (
          <li key={task} className="flex items-start gap-2.5 text-ink">
            <Check size={18} className="mt-0.5 flex-none text-success" aria-hidden="true" />
            {task}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-ink-subtle">
        <span className="font-medium text-ink-muted">Tools:</span> {role.tools}
      </p>
      <Link
        to="booking"
        params={{ role: role.name }}
        aria-label={`Request this role: ${role.name}`}
        className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-brand underline-offset-4 hover:underline"
      >
        Request this role <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Roles we place"
        intro="Each role below says what the person does day to day, so you can see what you'd hand over. Don't see your role? Tell us about it anyway."
      />

      <nav aria-label="Role groups" className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-4 md:px-6">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[0.9375rem]">
            {ROLE_GROUPS.map((group) => (
              <li key={group.id}>
                <a
                  href={`#${group.id}`}
                  className="inline-flex min-h-11 items-center text-ink-muted underline-offset-4 hover:text-brand hover:underline"
                >
                  {group.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <Section aria-label="Roles">
        <div className="divide-y divide-line-strong border-y border-line-strong">
          {ROLE_GROUPS.map((group) => (
            <section
              key={group.id}
              id={group.id}
              aria-labelledby={`${group.id}-heading`}
              className="grid scroll-mt-24 gap-8 py-12 md:grid-cols-12 md:gap-10 md:py-16"
            >
              <div className="md:col-span-4">
                <div className="md:sticky md:top-28">
                  <h2 id={`${group.id}-heading`} className="text-2xl md:text-[1.75rem]">
                    {group.title}
                  </h2>
                  <p className="mt-3 leading-relaxed text-ink-muted">{group.intro}</p>
                </div>
              </div>
              <ul className="divide-y divide-line md:col-span-8">
                {group.roles.map(roleItem)}
              </ul>
            </section>
          ))}
        </div>
      </Section>

      <Section tone="muted" aria-labelledby="engagements-heading">
        <SectionHeader
          id="engagements-heading"
          title="Ways to work with us"
          intro="Start with one person or build a team. You can tell us which suits you in the form."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {ENGAGEMENTS.map((item) => (
            <div key={item.title} className="rounded-xl border border-line bg-paper p-6">
              <p className="text-sm text-ink-subtle">{item.detail}</p>
              <h3 className="mt-1 text-xl">{item.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-muted">{item.description}</p>
              {item.link && (
                <Link
                  to="booking"
                  params={item.link.params}
                  className="mt-4 inline-flex items-center gap-2 font-semibold text-brand underline-offset-4 hover:underline"
                >
                  {item.link.label} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section tone="ink" aria-labelledby="services-cta">
        <div className="max-w-2xl">
          <h2 id="services-cta" className="text-[2rem] leading-tight text-white md:text-[2.5rem]">
            Know the role you need?
          </h2>
          <p className="mt-4 text-lg text-inverse-muted">
            Tell us about it and we'll find and vet professionals who fit.
          </p>
          <ButtonLink to="booking" size="lg" variant="inverse" className="mt-8">
            Tell us what you need
            <ArrowRight size={18} aria-hidden="true" />
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
