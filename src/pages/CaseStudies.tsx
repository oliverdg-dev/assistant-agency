import { ArrowRight } from "lucide-react";
import { CASE_STUDIES } from "../content/caseStudies";
import { ButtonLink, PageHeader, Section } from "../components/ui";

export default function CaseStudiesPage() {
  const plural = CASE_STUDIES.length > 1;

  return (
    <>
      <PageHeader
        title={plural ? "Case studies" : "Case study"}
        intro="How businesses have grown their teams with professionals from the Philippines."
      />

      <Section aria-label="Client case studies">
        <div className="space-y-16 md:space-y-20">
          {CASE_STUDIES.map((study) => (
            <article key={study.client} className="grid gap-8 border-t border-line pt-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-5">
                <p className="text-sm text-ink-subtle">{study.industry}</p>
                <h2 className="mt-2 text-[1.75rem] leading-tight md:text-[2.25rem]">{study.client}</h2>
                <p className="mt-3 text-lg text-ink-muted">{study.subtitle}</p>

                <dl className="mt-8 grid grid-cols-3 gap-3">
                  {study.results.map((result) => (
                    <div key={result.label} className="rounded-lg border border-line bg-paper p-4">
                      <dt className="sr-only">{result.label}</dt>
                      <dd>
                        <span className="block font-serif text-2xl font-semibold text-ink">{result.metric}</span>
                        <span className="mt-1 block text-xs leading-snug text-ink-muted">{result.label}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="space-y-6 lg:col-span-7">
                <div>
                  <h3 className="font-sans text-sm font-semibold text-ink">The challenge</h3>
                  <p className="mt-2 leading-relaxed text-ink-muted">{study.challenge}</p>
                </div>
                <div>
                  <h3 className="font-sans text-sm font-semibold text-ink">What we did</h3>
                  <p className="mt-2 leading-relaxed text-ink-muted">{study.solution}</p>
                </div>
                <figure className="border-l-2 border-ink pl-5">
                  <blockquote className="font-serif text-xl leading-relaxed text-ink">
                    “{study.quote}”
                  </blockquote>
                  <figcaption className="mt-3 text-sm text-ink-muted">{study.author}</figcaption>
                </figure>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section tone="ink" aria-labelledby="cs-cta">
        <div className="max-w-2xl">
          <h2 id="cs-cta" className="text-[2rem] leading-tight text-white md:text-[2.5rem]">
            Tell us about the role you need to fill.
          </h2>
          <p className="mt-4 text-lg text-inverse-muted">
            It takes about three minutes and there's no commitment.
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
