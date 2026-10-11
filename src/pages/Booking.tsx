import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import {
  BOOKING_TIMEOUTS,
  budgets,
  countries,
  displayReference,
  emptyBookingForm,
  engagementTypes,
  headcounts,
  HONEYPOT_FIELD,
  startTimeframes,
  type BookingApiResponse,
  type BookingField,
  type BookingFieldErrors,
  type BookingFormData,
} from "../../api/_lib/booking.js";
import { BRAND } from "../../api/_lib/brand.js";
import { PROCESS_STEPS } from "../content/process";
import { RoleCombobox } from "../components/form/RoleCombobox";
import { SegmentedControl } from "../components/form/SegmentedControl";
import { Stepper } from "../components/form/Stepper";
import { Link } from "../components/Link";
import { Button, Container, controlClass, describedBy, Field, PageHeader } from "../components/ui";
import {
  clampStep,
  parseFormDeepLink,
  STEP_FIELDS,
  STEP_TITLES,
  stepForFieldErrors,
  validateStep,
  type FormStep,
} from "../lib/bookingForm";
import { readAttribution } from "../lib/attribution";
import { navigate, setBeforeLeave, useRoute } from "../lib/router";
import type { MockMode } from "../lib/devMocks";

type Status = "editing" | "submitting" | "success";

const HEADCOUNT_LABELS: Record<string, string> = { "1": "1", "2-3": "2–3", "4-10": "4–10", "11+": "11+" };
const LEAVE_MESSAGE = "Leave this page? Your answers will be lost.";

const calendarUrl = (() => {
  const raw = import.meta.env.VITE_BOOKING_CALENDAR_URL as string | undefined;
  try {
    return raw && new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
})();

const newSubmissionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export default function BookingPage() {
  const route = useRoute();
  const deepLink = useMemo(() => parseFormDeepLink(route.search), []); // read once on arrival

  const [form, setForm] = useState<BookingFormData>(() => ({
    ...emptyBookingForm(),
    role: deepLink.role ?? "",
    headcount: deepLink.headcount ?? "1",
    submissionId: newSubmissionId(),
  }));
  const [honeypot, setHoneypot] = useState("");
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});
  const [stepNotice, setStepNotice] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [status, setStatus] = useState<Status>("editing");
  const [slow, setSlow] = useState(false);
  const [leadId, setLeadId] = useState<string | undefined>();
  const [returnToReview, setReturnToReview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const submittingRef = useRef(false);
  const errorBannerRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  const mockMode = useMemo<MockMode | null>(() => {
    if (!import.meta.env.DEV) return null;
    const mode = new URLSearchParams(route.search).get("mock");
    return (mode as MockMode) || null;
  }, []);

  const requestedStep = new URLSearchParams(route.search).get("step");
  const step = clampStep(requestedStep, form);

  // Keep the URL honest if someone lands on (or goes back to) a step they
  // can't be on yet.
  useEffect(() => {
    if (status !== "editing") return;
    if (requestedStep && Number(requestedStep) !== step) {
      goToStep(step, { replace: true });
    }
  }, [requestedStep, step, status]);

  // Move focus to the new step's heading so keyboard and screen reader users
  // land in the right place. Skipped on first render.
  const lastStep = useRef(step);
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    stepHeadingRef.current?.focus({ preventScroll: true });
    formCardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  // Warn before losing typed answers: browser close/reload, and in-app links.
  useEffect(() => {
    const unsaved = dirty && status !== "success";
    if (!unsaved) {
      setBeforeLeave(null);
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    setBeforeLeave((_next, { samePage }) => samePage || window.confirm(LEAVE_MESSAGE));
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      setBeforeLeave(null);
    };
  }, [dirty, status]);

  useEffect(() => {
    if (status === "success") successHeadingRef.current?.focus();
  }, [status]);

  const update = (field: BookingField, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setDirty(true);
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setSubmitError("");
  };

  function goToStep(target: FormStep, options: { replace?: boolean } = {}) {
    setStepNotice("");
    navigate("booking", target === 1 ? undefined : { step: String(target) }, options);
  }

  const focusFirstError = (errors: BookingFieldErrors, target: FormStep) => {
    const field = STEP_FIELDS[target].find((name) => errors[name]);
    if (!field) return;
    // Wait for the step to render before focusing.
    window.setTimeout(() => document.getElementById(`field-${field}`)?.focus(), 50);
  };

  const continueFrom = (current: FormStep) => {
    const errors = validateStep(current, form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusFirstError(errors, current);
      return;
    }
    setFieldErrors({});
    if (returnToReview) {
      setReturnToReview(false);
      goToStep(3);
    } else {
      goToStep((current + 1) as FormStep);
    }
  };

  const editStep = (target: FormStep) => {
    setReturnToReview(true);
    goToStep(target);
  };

  const showSubmitError = (message: string) => setSubmitError(message);

  // Move focus to the error so it's announced and visible on small screens.
  useEffect(() => {
    if (submitError) errorBannerRef.current?.focus();
  }, [submitError]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (step !== 3) {
      continueFrom(step);
      return;
    }
    if (submittingRef.current) return;

    // Re-check every step: the visitor may have edited an earlier one.
    for (const target of [1, 2, 3] as FormStep[]) {
      const errors = validateStep(target, form);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        if (target !== 3) {
          setStepNotice("Please check the highlighted field.");
          navigate("booking", target === 1 ? undefined : { step: String(target) });
        }
        focusFirstError(errors, target);
        return;
      }
    }

    submittingRef.current = true;
    setStatus("submitting");
    setSubmitError("");
    setSlow(false);
    const slowTimer = window.setTimeout(() => setSlow(true), BOOKING_TIMEOUTS.clientSlowNoticeMs);
    const controller = new AbortController();
    const abortTimer = window.setTimeout(() => controller.abort(), BOOKING_TIMEOUTS.clientAbortMs);

    try {
      const response = await postRequest(
        { ...form, ...readAttribution(), [HONEYPOT_FIELD]: honeypot },
        controller.signal,
        mockMode,
      );

      if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
        throw new Error("non-json");
      }
      const payload = (await response.json()) as BookingApiResponse;

      if (response.ok && payload.ok) {
        setLeadId(payload.leadId);
        setStatus("success");
        setDirty(false);
        // Drop ?step= so Back from the confirmation leaves the form.
        navigate("booking", undefined, { replace: true });
        return;
      }

      setStatus("editing");
      const errors = "fieldErrors" in payload ? (payload.fieldErrors ?? {}) : {};
      const target = stepForFieldErrors(errors);
      if (target) {
        setFieldErrors(errors);
        if (target !== 3) {
          setStepNotice("Please check the highlighted field.");
          navigate("booking", target === 1 ? undefined : { step: String(target) });
        }
        focusFirstError(errors, target);
        return;
      }
      showSubmitError(payload.message);
    } catch (error) {
      setStatus("editing");
      if (error instanceof DOMException && error.name === "AbortError") {
        showSubmitError("This is taking longer than it should. Please try again.");
      } else if (error instanceof Error && error.message === "non-json") {
        showSubmitError("Something went wrong on our side. Please try again.");
      } else {
        showSubmitError("We couldn't reach our server. Check your connection and try again.");
      }
    } finally {
      window.clearTimeout(slowTimer);
      window.clearTimeout(abortTimer);
      submittingRef.current = false;
      setSlow(false);
    }
  };

  const startOver = () => {
    setForm({ ...emptyBookingForm(), submissionId: newSubmissionId() });
    setFieldErrors({});
    setSubmitError("");
    setLeadId(undefined);
    setDirty(false);
    setStatus("editing");
    window.scrollTo({ top: 0 });
  };

  if (status === "success") {
    return (
      <SuccessScreen
        form={form}
        leadId={leadId}
        headingRef={successHeadingRef}
        onStartOver={startOver}
      />
    );
  }

  const submitting = status === "submitting";
  const fieldProps = (field: BookingField, hint?: string) => ({
    id: `field-${field}`,
    error: fieldErrors[field],
    hint,
  });
  const inputProps = (field: BookingField, hint?: string) => ({
    id: `field-${field}`,
    name: field,
    value: form[field],
    "aria-invalid": fieldErrors[field] ? true : undefined,
    "aria-describedby": describedBy(`field-${field}`, { hint, error: fieldErrors[field] }),
    className: controlClass(Boolean(fieldErrors[field])),
  });

  return (
    <>
      <PageHeader
        title="Tell us what you need"
        intro="Describe the role you're hiring for and our team will take it from there. It takes about three minutes and there's no commitment."
      />

      <section className="py-10 md:py-14">
        <Container className="grid gap-8 lg:grid-cols-3 lg:gap-12">
          <div ref={formCardRef} className="min-w-0 scroll-mt-24 lg:col-span-2">
            <div className="rounded-xl border border-line bg-paper p-5 xs:p-6 md:p-10">
              <Stepper current={step} />

              <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
                <h2
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="text-2xl leading-snug md:text-[1.75rem]"
                >
                  {STEP_TITLES[step]}
                </h2>
                <p className="mb-6 mt-2 text-sm text-ink-subtle">
                  All fields are required unless marked optional.
                </p>

                {stepNotice && (
                  <p className="mb-6 flex items-center gap-2 rounded-lg bg-error-tint px-4 py-3 text-sm text-error">
                    <AlertCircle size={16} aria-hidden="true" />
                    {stepNotice}
                  </p>
                )}

                {step === 1 && (
                  <div className="space-y-7">
                    <RoleCombobox
                      id="field-role"
                      value={form.role}
                      onChange={(value) => update("role", value)}
                      error={fieldErrors.role}
                      initialCategory={deepLink.category}
                      autoFocus={Boolean(deepLink.category)}
                    />
                    <SegmentedControl
                      id="field-headcount"
                      name="headcount"
                      legend="How many people do you need?"
                      options={headcounts.map((value) => ({ value, label: HEADCOUNT_LABELS[value] }))}
                      value={form.headcount}
                      onChange={(value) => update("headcount", value)}
                      error={fieldErrors.headcount}
                      columns="sm:grid-cols-4"
                    />
                    <SegmentedControl
                      id="field-engagementType"
                      name="engagementType"
                      legend="What kind of engagement?"
                      options={engagementTypes.map((value) => ({ value, label: value }))}
                      value={form.engagementType}
                      onChange={(value) => update("engagementType", value)}
                      error={fieldErrors.engagementType}
                    />
                    <Field {...fieldProps("startTimeframe")} label="When would you like them to start?" optional>
                      <select {...inputProps("startTimeframe")} onChange={(e) => update("startTimeframe", e.target.value)}>
                        <option value="">Choose a timeframe</option>
                        {startTimeframes.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-7">
                    <Field {...fieldProps("sector", "For example: logistics, SaaS, healthcare, e-commerce.")} label="What industry is your business in?">
                      <input
                        {...inputProps("sector", "For example: logistics, SaaS, healthcare, e-commerce.")}
                        type="text"
                        aria-required="true"
                        onChange={(e) => update("sector", e.target.value)}
                      />
                    </Field>
                    <Field
                      {...fieldProps("message", "What they'll do day to day, plus any skills, experience or tools they need.")}
                      label="Responsibilities, skills and tools"
                      optional
                    >
                      <textarea
                        {...inputProps("message", "What they'll do day to day, plus any skills, experience or tools they need.")}
                        rows={5}
                        maxLength={2000}
                        placeholder="e.g. Manage the CEO's inbox and calendar, keep HubSpot up to date. Comfortable with Google Workspace."
                        onChange={(e) => update("message", e.target.value)}
                      />
                    </Field>
                    <Field {...fieldProps("budget")} label="Monthly budget (USD)">
                      <select
                        {...inputProps("budget")}
                        aria-required="true"
                        onChange={(e) => update("budget", e.target.value)}
                      >
                        <option value="">Choose a range</option>
                        {budgets.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-7">
                    <RequestSummary form={form} onEdit={editStep} />
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field {...fieldProps("firstName")} label="First name">
                        <input {...inputProps("firstName")} type="text" autoComplete="given-name" aria-required="true" onChange={(e) => update("firstName", e.target.value)} />
                      </Field>
                      <Field {...fieldProps("lastName")} label="Last name">
                        <input {...inputProps("lastName")} type="text" autoComplete="family-name" aria-required="true" onChange={(e) => update("lastName", e.target.value)} />
                      </Field>
                    </div>
                    <Field {...fieldProps("email")} label="Work email">
                      <input
                        {...inputProps("email")}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        aria-required="true"
                        placeholder="name@company.com"
                        onChange={(e) => update("email", e.target.value)}
                      />
                    </Field>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field {...fieldProps("company")} label="Company name">
                        <input {...inputProps("company")} type="text" autoComplete="organization" aria-required="true" onChange={(e) => update("company", e.target.value)} />
                      </Field>
                      <Field {...fieldProps("website")} label="Company website" optional>
                        <input
                          {...inputProps("website")}
                          type="text"
                          inputMode="url"
                          autoComplete="url"
                          placeholder="company.com"
                          onChange={(e) => update("website", e.target.value)}
                        />
                      </Field>
                    </div>
                    <Field {...fieldProps("country")} label="Where is your business based?" optional>
                      <select {...inputProps("country")} onChange={(e) => update("country", e.target.value)}>
                        <option value="">Choose a country</option>
                        {countries.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </Field>
                    {/* Spam trap: hidden from people and assistive tech. */}
                    <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
                      <label htmlFor={HONEYPOT_FIELD}>Leave this field empty</label>
                      <input
                        id={HONEYPOT_FIELD}
                        name={HONEYPOT_FIELD}
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {submitError && (
                  <div
                    ref={errorBannerRef}
                    role="alert"
                    tabIndex={-1}
                    className="mt-8 flex gap-3 rounded-lg border border-error/30 bg-error-tint px-4 py-3.5 text-[0.9375rem] text-ink"
                  >
                    <AlertCircle size={20} className="mt-0.5 flex-none text-error" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-error">{submitError}</p>
                      <p className="mt-1 text-ink-muted">
                        Your answers are still here. If it keeps happening, email{" "}
                        <a className="font-medium text-brand underline" href={`mailto:${BRAND.contactEmail}`}>
                          {BRAND.contactEmail}
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                  {step > 1 ? (
                    <Button variant="secondary" onClick={() => goToStep((step - 1) as FormStep)} disabled={submitting}>
                      <ArrowLeft size={18} aria-hidden="true" />
                      Back
                    </Button>
                  ) : (
                    <span className="hidden sm:block" />
                  )}

                  {step < 3 ? (
                    <Button type="submit" size="lg">
                      {returnToReview ? "Save and return to review" : "Continue"}
                      {!returnToReview && <ArrowRight size={18} aria-hidden="true" />}
                    </Button>
                  ) : (
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                      <Button type="submit" size="lg" disabled={submitting}>
                        {submitting ? (
                          <>
                            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                            Sending your request…
                          </>
                        ) : (
                          "Send my request"
                        )}
                      </Button>
                      <p aria-live="polite" className="text-sm text-ink-subtle sm:text-right">
                        {slow ? "Still sending. Please keep this page open." : ""}
                      </p>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>

          <aside className="min-w-0 lg:pt-2" aria-labelledby="next-steps-heading">
            <NextSteps headingId="next-steps-heading" />
            <p className="mt-6 border-t border-line pt-6 text-sm leading-relaxed text-ink-muted">
              Prefer email? Write to{" "}
              <a className="font-medium text-brand underline" href={`mailto:${BRAND.contactEmail}`}>
                {BRAND.contactEmail}
              </a>
              .
            </p>
          </aside>
        </Container>
      </section>
    </>
  );
}

function postRequest(body: Record<string, unknown>, signal: AbortSignal, mockMode: MockMode | null) {
  if (import.meta.env.DEV && mockMode) {
    return import("../lib/devMocks").then(({ mockBookingResponse }) => mockBookingResponse(mockMode));
  }
  return fetch("/api/booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

function NextSteps({ headingId }: { headingId: string }) {
  return (
    <div>
      <h2 id={headingId} className="text-xl">
        What happens next
      </h2>
      <ol className="mt-5 space-y-5">
        {PROCESS_STEPS.slice(1).map((item, index) => (
          <li key={item.title} className="flex gap-4">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-line-strong text-sm font-semibold text-ink-muted">
              {index + 2}
            </span>
            <div>
              <p className="font-medium text-ink">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{item.short}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RequestSummary({ form, onEdit }: { form: BookingFormData; onEdit: (step: FormStep) => void }) {
  const rows: Array<{ step: FormStep; label: string; items: Array<[string, string]> }> = [
    {
      step: 1,
      label: "Edit role details",
      items: [
        ["Role", form.role],
        ["People", HEADCOUNT_LABELS[form.headcount] ?? form.headcount],
        ["Engagement", form.engagementType],
        ["Start", form.startTimeframe || "Not specified"],
      ],
    },
    {
      step: 2,
      label: "Edit requirements",
      items: [
        ["Industry", form.sector],
        ["Budget", form.budget],
      ],
    },
  ];

  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p className="mb-3 text-sm font-semibold text-ink">Your request</p>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.step} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <dl className="grid flex-1 grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 text-sm">
              {row.items.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-subtle">{label}</dt>
                  <dd className="break-words text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => onEdit(row.step)}
              className="self-start text-sm font-semibold text-brand underline-offset-4 hover:underline"
            >
              {row.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessScreen({
  form,
  leadId,
  headingRef,
  onStartOver,
}: {
  form: BookingFormData;
  leadId?: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onStartOver: () => void;
}) {
  const reference = displayReference(leadId);
  const summary: Array<[string, string]> = [
    ["Role", form.role],
    ["People", HEADCOUNT_LABELS[form.headcount] ?? form.headcount],
    ["Engagement", form.engagementType],
    ["Company", form.company],
    ["We'll reply to", form.email],
  ];

  return (
    <section className="py-12 md:py-20">
      <Container className="max-w-3xl">
        <div className="rounded-xl border border-line bg-paper p-6 md:p-10">
          <CheckCircle2 size={36} className="text-success" aria-hidden="true" />
          <h1 ref={headingRef} tabIndex={-1} className="mt-5 text-[2rem] leading-tight md:text-[2.5rem]">
            Thanks, we've received your requirements.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            Our team will review them and get back to you shortly. A confirmation is on its way to{" "}
            <span className="font-medium text-ink">{form.email}</span>.
          </p>

          <div className="mt-10">
            <NextSteps headingId="success-next-steps" />
          </div>

          <div className="mt-10 rounded-lg border border-line bg-surface p-5">
            {reference && (
              <p className="mb-4 text-sm">
                <span className="text-ink-subtle">Reference ID: </span>
                <span className="font-mono text-ink">{reference}</span>
              </p>
            )}
            <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              {summary.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-subtle">{label}</dt>
                  <dd className="break-words text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {calendarUrl && (
            <p className="mt-8">
              <a href={calendarUrl} className="font-semibold text-brand underline-offset-4 hover:underline">
                Prefer to talk now? Book a call
              </a>
            </p>
          )}

          <p className="mt-8 text-[0.9375rem] text-ink-muted">
            Questions in the meantime? Email{" "}
            <a className="font-medium text-brand underline" href={`mailto:${BRAND.contactEmail}`}>
              {BRAND.contactEmail}
            </a>
            .
          </p>

          <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Link to="home" className="font-semibold text-brand underline-offset-4 hover:underline">
              Back to the homepage
            </Link>
            <button
              type="button"
              onClick={onStartOver}
              className="self-start text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
            >
              Submit another request
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}
