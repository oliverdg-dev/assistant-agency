import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ENGLISH_LEVELS, MAX_SHORTLIST } from "../../api/_lib/requestStatus.js";
import { Button, controlClass } from "../components/ui";
import { adminApi, type RequestDetail, type StaffCandidate, type StaffShortlist } from "./api";
import { formatDate, formatDateTime } from "./format";

/*
 * The shortlist for one request: add candidates, record consent, order them,
 * publish (emails the client a private link), resend the link, and see what
 * the client chose.
 */

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function ShortlistPanel({ request, onChanged }: { request: RequestDetail; onChanged: () => void }) {
  const [shortlist, setShortlist] = useState<StaffShortlist | null>(null);
  const [editing, setEditing] = useState<StaffCandidate | "new" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const result = await adminApi<StaffShortlist>(`/requests/${request.id}/shortlist`);
    if (result.ok) setShortlist(result.data!);
  }, [request.id]);

  useEffect(() => {
    load();
  }, [load, request.status]);

  const after = async (result: { ok: boolean; error?: { message: string } }, success?: string) => {
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error!.message });
      return false;
    }
    setMessage(success ? { tone: "ok", text: success } : null);
    await load();
    onChanged();
    return true;
  };

  if (!shortlist) {
    return (
      <Panel>
        <p className="text-sm text-ink-muted">Loading shortlist…</p>
      </Panel>
    );
  }

  const candidates = shortlist.candidates;
  const ready = candidates.filter((c) => !c.publishedAt && c.consentAt && !c.withdrawnAt);
  const published = candidates.filter((c) => c.publishedAt && !c.withdrawnAt);
  const link = shortlist.link;

  const move = async (index: number, by: -1 | 1) => {
    const order = candidates.map((c) => c.id);
    const [moved] = order.splice(index, 1);
    order.splice(index + by, 0, moved);
    await after(await adminApi(`/requests/${request.id}/shortlist/order`, { method: "POST", body: { order } }));
  };

  const publish = async () => {
    setBusy(true);
    const result = await adminApi<{ emailStatus: string }>(`/requests/${request.id}/shortlist/publish`, {
      method: "POST",
      body: { from: request.status },
    });
    setBusy(false);
    setConfirming(false);
    await after(
      result,
      result.ok && result.data!.emailStatus !== "sent"
        ? "Published, but the email didn't send. Use Send a fresh link to try again."
        : `Published. ${request.contact.firstName} has been emailed a private link.`,
    );
  };

  const resend = async () => {
    setBusy(true);
    const result = await adminApi<{ emailStatus: string }>(`/requests/${request.id}/shortlist/resend`, { method: "POST" });
    setBusy(false);
    await after(result, result.ok && result.data!.emailStatus === "sent" ? "Fresh link sent. Earlier links no longer work." : "The email didn't send. Try again.");
  };

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-sans text-base font-semibold">Shortlist</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {published.length} shown to the client · up to {MAX_SHORTLIST} at a time
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {published.length > 0 && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={resend}>
              Send a fresh link
            </Button>
          )}
          {ready.length > 0 && !confirming && (
            <Button size="sm" disabled={busy} onClick={() => setConfirming(true)}>
              Publish {ready.length} {published.length ? "more" : ""}
            </Button>
          )}
        </div>
      </div>

      {link && <LinkStatus link={link} />}

      {confirming && (
        <div className="mt-4 rounded-lg border border-brand bg-brand-tint p-4 text-sm">
          <p>
            <strong>{request.contact.email}</strong> will get an email from{" "}
            <strong>{request.owner?.name ?? "you"}</strong> with a private link to {published.length + ready.length}{" "}
            candidate{published.length + ready.length === 1 ? "" : "s"}. The link works for 14 days.
            {request.status !== "shortlist_ready" && " The status moves to Shortlist ready."}
          </p>
          {published.length + ready.length < 3 && (
            <p className="mt-2 text-ink-muted">Shortlists usually have 3 to 5 people. You can add more later.</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={busy} onClick={publish}>
              {busy ? "Sending…" : "Publish and email client"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={cx("mt-3 text-sm", message.tone === "error" ? "text-error" : "text-success")}>
          {message.text}
        </p>
      )}

      {candidates.length === 0 && editing !== "new" && (
        <p className="mt-4 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">
          No candidates yet. Add the people you'd put forward for this role.
        </p>
      )}

      <ol className="mt-4 space-y-3">
        {candidates.map((candidate, index) =>
          editing !== "new" && editing?.id === candidate.id ? (
            <li key={candidate.id}>
              <CandidateForm
                request={request}
                candidate={candidate}
                onCancel={() => setEditing(null)}
                onSaved={async () => {
                  setEditing(null);
                  await load();
                }}
              />
            </li>
          ) : (
            candidateRow({
              candidate,
              first: index === 0,
              last: index === candidates.length - 1,
              onMove: (by) => move(index, by),
              onEdit: () => setEditing(candidate),
              onWithdraw: async (restore) =>
                after(await adminApi(`/requests/${request.id}/candidates/${candidate.id}/withdraw`, { method: "POST", body: { restore } })),
              onRemove: async () => after(await adminApi(`/requests/${request.id}/candidates/${candidate.id}/remove`, { method: "POST" })),
            })
          ),
        )}
      </ol>

      {editing === "new" ? (
        <div className="mt-3">
          <CandidateForm
            request={request}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await load();
            }}
          />
        </div>
      ) : (
        <Button className="mt-3" size="sm" variant="secondary" onClick={() => setEditing("new")}>
          Add a candidate
        </Button>
      )}
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border border-line bg-paper p-5">{children}</section>;
}

function LinkStatus({ link }: { link: StaffShortlist["link"] & object }) {
  return (
    <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-ink-muted">
      Link sent to {link.sentTo} on {formatDateTime(link.sentAt)}.{" "}
      {link.expired ? (
        <span className="font-semibold text-error">Expired or replaced.</span>
      ) : (
        <>Works until {formatDate(link.expiresAt)}.</>
      )}{" "}
      {link.firstViewedAt ? (
        <span className="text-ink">
          Opened {link.viewCount} time{link.viewCount === 1 ? "" : "s"}, last {formatDateTime(link.lastViewedAt)}.
        </span>
      ) : (
        "Not opened yet."
      )}
    </p>
  );
}

function Tag({ tone, children }: { tone: "ok" | "warn" | "muted" | "brand"; children: ReactNode }) {
  const tones = {
    ok: "bg-success-tint text-success",
    warn: "bg-[#fdf3e1] text-[#8a5300]",
    muted: "bg-surface-2 text-ink-muted",
    brand: "bg-brand-tint text-brand",
  };
  return <span className={cx("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

// A plain function (not a component) so the list key sits on the <li>.
function candidateRow({
  candidate,
  first,
  last,
  onMove,
  onEdit,
  onWithdraw,
  onRemove,
}: {
  candidate: StaffCandidate;
  first: boolean;
  last: boolean;
  onMove: (by: -1 | 1) => void;
  onEdit: () => void;
  onWithdraw: (restore: boolean) => void;
  onRemove: () => void;
}) {
  const facts = [
    candidate.yearsExperience !== null ? `${candidate.yearsExperience} yrs` : null,
    candidate.englishLevel ? `English: ${candidate.englishLevel}` : null,
    candidate.monthlyRateUsd !== null ? `${money(candidate.monthlyRateUsd)}/mo` : null,
  ].filter(Boolean);
  return (
    <li key={candidate.id} className={cx("rounded-lg border border-line p-3", candidate.withdrawnAt && "opacity-60")}>
      <div className="flex gap-3">
        <div className="flex flex-col gap-1">
          <button type="button" aria-label={`Move ${candidate.firstName} up`} disabled={first} onClick={() => onMove(-1)} className="h-7 w-7 rounded border border-line text-ink-muted hover:text-ink disabled:opacity-30">
            ↑
          </button>
          <button type="button" aria-label={`Move ${candidate.firstName} down`} disabled={last} onClick={() => onMove(1)} className="h-7 w-7 rounded border border-line text-ink-muted hover:text-ink disabled:opacity-30">
            ↓
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {candidate.firstName} {candidate.lastName}
          </p>
          <p className="text-sm text-ink-muted">{candidate.headline}</p>
          {facts.length > 0 && <p className="mt-0.5 text-xs text-ink-subtle">{facts.join(" · ")}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {candidate.withdrawnAt ? (
              <Tag tone="muted">Withdrawn</Tag>
            ) : candidate.publishedAt ? (
              <Tag tone="brand">Shown to client</Tag>
            ) : (
              <Tag tone="muted">Draft</Tag>
            )}
            {candidate.consentAt ? (
              <Tag tone="ok">
                Consent recorded{candidate.consentBy ? ` by ${candidate.consentBy}` : ""}, {formatDate(candidate.consentAt)}
              </Tag>
            ) : (
              <Tag tone="warn">No consent yet: can't be shown</Tag>
            )}
            {candidate.clientDecision === "interview" && <Tag tone="ok">Client: interview</Tag>}
            {candidate.clientDecision === "pass" && <Tag tone="muted">Client: pass{candidate.passReason ? `, "${candidate.passReason}"` : ""}</Tag>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <button type="button" className="font-semibold text-brand hover:underline" onClick={onEdit}>
            Edit
          </button>
          {candidate.publishedAt ? (
            <button type="button" className="font-semibold text-ink-muted hover:underline" onClick={() => onWithdraw(Boolean(candidate.withdrawnAt))}>
              {candidate.withdrawnAt ? "Restore" : "Withdraw"}
            </button>
          ) : (
            <button type="button" className="font-semibold text-ink-muted hover:underline" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Add / edit
// ---------------------------------------------------------------------------

const inputClass = (error?: string) => controlClass(Boolean(error), "py-2 text-[0.9375rem]");

function CandidateForm({
  request,
  candidate,
  onCancel,
  onSaved,
}: {
  request: RequestDetail;
  candidate?: StaffCandidate;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState({
    firstName: candidate?.firstName ?? "",
    lastName: candidate?.lastName ?? "",
    headline: candidate?.headline ?? "",
    yearsExperience: candidate?.yearsExperience?.toString() ?? "",
    englishLevel: candidate?.englishLevel ?? "",
    availability: candidate?.availability ?? "",
    monthlyRateUsd: candidate?.monthlyRateUsd?.toString() ?? "",
    skills: candidate?.skills ?? "",
    whyPicked: candidate?.whyPicked ?? "",
    deleteAfter: candidate?.deleteAfter ?? "",
    consent: Boolean(candidate?.consentAt),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    const path = candidate ? `/requests/${request.id}/candidates/${candidate.id}` : `/requests/${request.id}/candidates`;
    const result = await adminApi(path, { method: "POST", body: { ...values, deleteAfter: values.deleteAfter || null } });
    setBusy(false);
    if (!result.ok) {
      setErrors((result.error!.details.fields as Record<string, string>) ?? {});
      setFormError(result.error!.message);
      return;
    }
    onSaved();
  };

  const field = (key: string & keyof typeof values, label: string, input: ReactNode, className?: string) => (
    <div className={className}>
      <label htmlFor={`cand-${key}`} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {input}
      {errors[key] && (
        <p id={`cand-${key}-error`} className="mt-1 text-sm text-error">
          {errors[key]}
        </p>
      )}
    </div>
  );
  const text = (key: string & keyof typeof values, extra: Record<string, unknown> = {}) => (
    <input
      id={`cand-${key}`}
      value={values[key] as string}
      onChange={set(key)}
      className={inputClass(errors[key])}
      aria-invalid={Boolean(errors[key])}
      aria-describedby={errors[key] ? `cand-${key}-error` : undefined}
      {...extra}
    />
  );

  return (
    <form onSubmit={submit} className="rounded-lg border border-brand bg-surface p-4" noValidate>
      <p className="mb-3 text-sm font-semibold">{candidate ? `Edit ${candidate.firstName}` : "Add a candidate"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("firstName", "First name", text("firstName", { autoComplete: "off" }))}
        {field("lastName", "Last name (the client sees the initial only)", text("lastName", { autoComplete: "off" }))}
        {field("headline", "One-line headline", text("headline", { placeholder: "Bookkeeper, 6 years with US e-commerce clients" }), "sm:col-span-2")}
        {field("yearsExperience", "Years of experience", text("yearsExperience", { inputMode: "numeric" }))}
        {field(
          "englishLevel",
          "English",
          <select id="cand-englishLevel" value={values.englishLevel} onChange={set("englishLevel")} className={inputClass(errors.englishLevel)}>
            <option value="">Not stated</option>
            {ENGLISH_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>,
        )}
        {field("availability", "Availability", text("availability", { placeholder: "Can start in 2 weeks" }))}
        {field("monthlyRateUsd", "Monthly rate to the client (USD)", text("monthlyRateUsd", { inputMode: "numeric", placeholder: "1400" }))}
        {field("skills", "Skills and tools (comma-separated)", text("skills", { placeholder: "QuickBooks, Xero, Excel" }), "sm:col-span-2")}
        {field(
          "whyPicked",
          "Why we picked them (the client sees this)",
          <textarea id="cand-whyPicked" rows={3} value={values.whyPicked} onChange={set("whyPicked")} className={inputClass(errors.whyPicked)} />,
          "sm:col-span-2",
        )}
        {field(
          "deleteAfter",
          "Delete profile after",
          text("deleteAfter", { type: "date" }),
        )}
        <p className="self-end pb-2 text-xs text-ink-subtle">Blank: 12 months from today. Placeholder until the retention policy is agreed.</p>
      </div>

      <label className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-paper p-3 text-sm">
        <input type="checkbox" className="mt-1" checked={values.consent} onChange={(e) => setValues((v) => ({ ...v, consent: e.target.checked }))} />
        <span>
          <strong>{values.firstName || "The candidate"}</strong> agreed to share this profile with {request.contact.company}.
          <span className="block text-xs text-ink-subtle">Required before they can be shown. Placeholder wording until the consent policy is final.</span>
          {errors.consent && <span className="block text-error">{errors.consent}</span>}
        </span>
      </label>

      {formError && (
        <p role="alert" className="mt-3 text-sm text-error">
          {formError}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : candidate ? "Save" : "Add candidate"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
