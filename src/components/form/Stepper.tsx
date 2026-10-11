import { Check } from "lucide-react";
import { STEP_LABELS, type FormStep } from "../../lib/bookingForm";

// Progress indicator for the job request form. Not clickable: moving between
// steps happens through the form's own buttons so each step is validated.
export function Stepper({ current }: { current: FormStep }) {
  const steps: FormStep[] = [1, 2, 3];
  return (
    <nav aria-label="Form progress" className="mb-8">
      <p className="text-sm font-medium text-ink-muted sm:hidden">
        Step {current} of 3: {STEP_LABELS[current]}
      </p>
      <ol className="hidden items-center gap-3 sm:flex">
        {steps.map((step, index) => {
          const done = step < current;
          const isCurrent = step === current;
          return (
            <li key={step} className="flex items-center gap-3" aria-current={isCurrent ? "step" : undefined}>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  isCurrent
                    ? "bg-brand text-white"
                    : done
                      ? "bg-success-tint text-success"
                      : "border border-line-strong text-ink-subtle"
                }`}
              >
                {done ? <Check size={15} aria-hidden="true" /> : step}
              </span>
              <span className={`text-sm ${isCurrent ? "font-semibold text-ink" : "text-ink-muted"}`}>
                {STEP_LABELS[step]}
                {done && <span className="sr-only"> (completed)</span>}
              </span>
              {index < steps.length - 1 && <span aria-hidden="true" className="h-px w-10 bg-line-strong" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
