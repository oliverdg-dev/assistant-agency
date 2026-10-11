import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "../../api/_lib/brand.js";
import { Button, controlClass } from "../components/ui";

/*
 * /shortlist#t=<token>, opened from the shortlist email.
 *
 *   token in the URL ─▶ "Continue" (nothing happens until it's pressed, so
 *   email scanners can't use the link) ─▶ cookie ─▶ token removed from the
 *   address bar ─▶ cards ─▶ interview / pass, saved one by one ─▶ send
 *
 * Coming back later in the same day works without the token (the cookie).
 */

interface Candidate {
  id: string;
  name: string;
  headline: string;
  yearsExperience: number | null;
  skills: string[];
  englishLevel: string | null;
  availability: string | null;
  monthlyRateUsd: number | null;
  whyPicked: string | null;
  withdrawn: boolean;
  decision: "interview" | "pass" | null;
  passReason: string | null;
}

interface Shortlist {
  role: string;
  company: string;
  clientFirstName: string;
  reference: string | null;
  owner: { name: string } | null;
  respondBy: string | null;
  expiresAt: string | null;
  open: boolean;
  status: string;
  submittedAt: string | null;
  candidates: Candidate[];
}

interface Failure {
  status: number;
  code: string;
  message: string;
  sentTo?: string;
}

async function call<T>(path: string, body?: unknown): Promise<{ data?: T; error?: Failure }> {
  try {
    const res = await fetch(`/api/shortlist${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    const payload = await res.json().catch(() => ({}));
    if (res.ok) return { data: payload as T };
    const error = payload.error ?? {};
    return { error: { status: res.status, code: error.code ?? "internal", message: error.message ?? "Something went wrong.", sentTo: error.sentTo } };
  } catch {
    return { error: { status: 0, code: "network", message: "Couldn't reach us. Check your connection and try again." } };
  }
}

type View =
  | { name: "continue" }
  | { name: "loading" }
  | { name: "problem"; error: Failure }
  | { name: "shortlist"; shortlist: Shortlist };

const readToken = () => new URLSearchParams(window.location.hash.slice(1)).get("t");

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

const respondByLabel = (date: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

export default function ShortlistPage() {
  const token = useRef(readToken());
  const [view, setView] = useState<View>(token.current ? { name: "continue" } : { name: "loading" });

  const load = useCallback(async () => {
    const result = await call<{ shortlist: Shortlist }>("/");
    setView(result.data ? { name: "shortlist", shortlist: result.data.shortlist } : { name: "problem", error: result.error! });
  }, []);

  useEffect(() => {
    if (!token.current) load();
  }, [load]);

  const proceed = async () => {
    setView({ name: "loading" });
    const result = await call("/open", { token: token.current });
    if (result.error) {
      setView({ name: "problem", error: result.error });
      return;
    }
    // The cookie carries on from here; don't leave the token in the address bar or history.
    window.history.replaceState(null, "", window.location.pathname);
    await load();
  };

  return (
    <div className="min-h-screen bg-surface pb-32">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <p className="font-serif text-lg font-semibold text-ink">{BRAND.name}</p>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        {view.name === "continue" && (
          <div className="max-w-md">
            <h1 className="text-3xl">Your shortlist is ready</h1>
            <p className="mt-3 text-ink-muted">Press Continue to see the candidates we picked for you.</p>
            <Button className="mt-6" size="lg" onClick={proceed}>
              Continue
            </Button>
          </div>
        )}
        {view.name === "loading" && (
          <p role="status" className="text-ink-muted">
            Loading your shortlist…
          </p>
        )}
        {view.name === "problem" && <Problem error={view.error} token={token.current} onRetry={token.current ? proceed : load} />}
        {view.name === "shortlist" && <ShortlistView shortlist={view.shortlist} onReload={load} />}
      </main>
    </div>
  );
}

function Problem({ error, token, onRetry }: { error: Failure; token: string | null; onRetry: () => void }) {
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    const result = await call<{ message: string }>("/refresh", { token });
    setBusy(false);
    setSent(result.data?.message ?? result.error!.message);
  };

  if (error.code === "link_expired") {
    return (
      <div className="max-w-md">
        <h1 className="text-3xl">This link has expired</h1>
        <p className="mt-3 text-ink-muted">{error.message}</p>
        {sent ? (
          <p role="status" className="mt-6 rounded-lg bg-success-tint px-4 py-3 text-success">
            {sent}
          </p>
        ) : (
          <>
            <p className="mt-3 text-ink-muted">We can send a fresh link to {error.sentTo ?? "the address we have on file"}.</p>
            <Button className="mt-6" onClick={refresh} disabled={busy}>
              {busy ? "Sending…" : "Email me a fresh link"}
            </Button>
          </>
        )}
      </div>
    );
  }
  if (error.code === "link_required") {
    return (
      <div className="max-w-md">
        <h1 className="text-3xl">Open the link from your email</h1>
        <p className="mt-3 text-ink-muted">
          For your privacy, the shortlist only opens from the link we emailed you. Use the "Review the shortlist" button in that email.
        </p>
      </div>
    );
  }
  if (error.code === "link_invalid") {
    return (
      <div className="max-w-md">
        <h1 className="text-3xl">This link isn't valid</h1>
        <p className="mt-3 text-ink-muted">{error.message}</p>
        <p className="mt-3 text-ink-muted">
          You can also write to{" "}
          <a className="font-semibold text-brand hover:underline" href={`mailto:${BRAND.contactEmail}`}>
            {BRAND.contactEmail}
          </a>
          .
        </p>
      </div>
    );
  }
  return (
    <div role="alert" className="max-w-md">
      <h1 className="text-3xl">Something went wrong</h1>
      <p className="mt-3 text-ink-muted">{error.message}</p>
      <Button className="mt-6" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The shortlist
// ---------------------------------------------------------------------------

type SaveState = "idle" | "saving" | "saved" | "failed";

function ShortlistView({ shortlist, onReload }: { shortlist: Shortlist; onReload: () => void }) {
  const [candidates, setCandidates] = useState(shortlist.candidates);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [closedMessage, setClosedMessage] = useState<string | null>(shortlist.open ? null : "The team has your choices and is working on the next step.");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [result, setResult] = useState<{ allPassed: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => setCandidates(shortlist.candidates), [shortlist]);

  const open = shortlist.open && !closedMessage;
  const owner = shortlist.owner?.name ?? "your account manager";
  const available = candidates.filter((c) => !c.withdrawn);
  const counts = {
    interview: available.filter((c) => c.decision === "interview").length,
    pass: available.filter((c) => c.decision === "pass").length,
    left: available.filter((c) => !c.decision).length,
  };

  const save = async (candidate: Candidate, decision: Candidate["decision"], reason: string | null) => {
    // The choice shows straight away and stays if the save fails, with Retry.
    setCandidates((list) => list.map((c) => (c.id === candidate.id ? { ...c, decision, passReason: reason } : c)));
    setSaveState((s) => ({ ...s, [candidate.id]: "saving" }));
    setResult(null);
    const response = await call("/decision", { candidateId: candidate.id, decision, reason });
    if (response.error) {
      setSaveState((s) => ({ ...s, [candidate.id]: "failed" }));
      if (response.error.code === "shortlist_closed") setClosedMessage(response.error.message);
      if (response.error.code === "candidate_unavailable") onReload();
      setAnnouncement(`${candidate.name}: not saved. ${response.error.message}`);
      return;
    }
    setSaveState((s) => ({ ...s, [candidate.id]: "saved" }));
    setAnnouncement(`${candidate.name}: ${decision === "interview" ? "interview" : decision === "pass" ? "pass" : "choice cleared"}, saved.`);
  };

  const send = async () => {
    setSending(true);
    setSendError(null);
    const response = await call<{ allPassed: boolean }>("/submit", {});
    setSending(false);
    if (response.error) {
      setSendError(response.error.message);
      if (response.error.code === "shortlist_closed") setClosedMessage(response.error.message);
      return;
    }
    setResult(response.data!);
    if (response.data!.allPassed) setClosedMessage(null);
  };

  return (
    <div>
      <p className="text-sm font-medium text-ink-muted">
        Shortlist for {shortlist.company}
        {shortlist.reference ? ` · Ref ${shortlist.reference.slice(0, 8)}` : ""}
      </p>
      <h1 className="mt-2 text-3xl md:text-4xl">{shortlist.role}</h1>
      <p className="mt-3 text-lg text-ink-muted">
        Hi {shortlist.clientFirstName.split(/\s+/)[0]}, here are the people {shortlist.owner ? `${owner} picked` : "we picked"} for you.
        {open && " For each one, choose Interview or Pass. Your choices save as you go."}
      </p>
      {open && shortlist.respondBy && (
        <p className="mt-2 text-[0.9375rem] text-ink">
          Please reply by <strong>{respondByLabel(shortlist.respondBy)}</strong> so we can book interviews while everyone is available.
        </p>
      )}
      {closedMessage && (
        <p role="status" className="mt-4 rounded-lg border border-line bg-paper px-4 py-3 text-[0.9375rem]">
          {closedMessage}
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <ol className="mt-8 space-y-5">
        {candidates.map((candidate, index) =>
          candidateCard({ candidate, index, open, state: saveState[candidate.id] ?? "idle", onSave: save }),
        )}
      </ol>

      {result && (
        <div role="status" className="mt-8 rounded-xl border border-success/30 bg-success-tint px-5 py-4 text-success">
          {result.allPassed ? (
            <p>
              <strong>Thanks, that helps.</strong> We'll keep looking and {owner} will send new candidates.
            </p>
          ) : (
            <p>
              <strong>Sent to {owner}.</strong> They'll be in touch to book the interviews. You can still change your choices here until then.
            </p>
          )}
        </div>
      )}

      {open && available.length > 0 && !result?.allPassed && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm">
              <strong>{counts.interview}</strong> to interview · <strong>{counts.pass}</strong> pass
              {counts.left > 0 && (
                <>
                  {" "}
                  · <strong>{counts.left}</strong> still to choose
                </>
              )}
            </p>
            <div className="flex flex-col items-end">
              <Button onClick={send} disabled={sending || counts.left > 0}>
                {sending ? "Sending…" : result ? "Send updated choices" : `Send my choices to ${owner.split(" ")[0]}`}
              </Button>
              {sendError && (
                <p role="alert" className="mt-1 text-sm text-error">
                  {sendError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// A plain function (not a component) so the list key sits on the <li>.
function candidateCard({
  candidate,
  index,
  open,
  state,
  onSave,
}: {
  candidate: Candidate;
  index: number;
  open: boolean;
  state: SaveState;
  onSave: (candidate: Candidate, decision: Candidate["decision"], reason: string | null) => void;
}) {
  if (candidate.withdrawn) {
    return (
      <li key={candidate.id} className="rounded-xl border border-dashed border-line-strong bg-paper px-5 py-4 text-ink-muted">
        <p className="font-semibold">{candidate.name}</p>
        <p className="text-sm">No longer available. They've accepted another role or withdrawn.</p>
      </li>
    );
  }
  const facts = [
    candidate.yearsExperience !== null ? ["Experience", `${candidate.yearsExperience} year${candidate.yearsExperience === 1 ? "" : "s"}`] : null,
    candidate.englishLevel ? ["English", candidate.englishLevel] : null,
    candidate.availability ? ["Availability", candidate.availability] : null,
  ].filter((fact): fact is [string, string] => Boolean(fact));

  return (
    <li
      key={candidate.id}
      aria-labelledby={`cand-${candidate.id}-name`}
      className={cx(
        "rounded-xl border bg-paper p-5 transition-colors",
        candidate.decision === "interview" ? "border-success" : candidate.decision === "pass" ? "border-line" : "border-line-strong",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-ink-subtle">Candidate {index + 1}</p>
          <h2 id={`cand-${candidate.id}-name`} className="text-2xl">
            {candidate.name}
          </h2>
          <p className="mt-1 text-ink-muted">{candidate.headline}</p>
        </div>
        {candidate.monthlyRateUsd !== null && (
          <p className="text-right">
            <span className="block font-serif text-2xl font-semibold text-ink">{money(candidate.monthlyRateUsd)}</span>
            <span className="text-xs text-ink-muted">per month</span>
          </p>
        )}
      </div>

      {facts.length > 0 && (
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-[0.9375rem] sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-subtle">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {candidate.skills.length > 0 && (
        <ul aria-label="Skills and tools" className="mt-4 flex flex-wrap gap-1.5">
          {candidate.skills.map((skill) => (
            <li key={skill} className="rounded-full bg-surface-2 px-2.5 py-1 text-sm">
              {skill}
            </li>
          ))}
        </ul>
      )}

      {candidate.whyPicked && (
        <div className="mt-4 rounded-lg bg-brand-tint px-4 py-3">
          <p className="text-xs font-semibold text-brand">Why we picked them</p>
          <p className="mt-1 whitespace-pre-wrap text-[0.9375rem]">{candidate.whyPicked}</p>
        </div>
      )}

      <Decision candidate={candidate} open={open} state={state} onSave={onSave} />
    </li>
  );
}

function Decision({
  candidate,
  open,
  state,
  onSave,
}: {
  candidate: Candidate;
  open: boolean;
  state: SaveState;
  onSave: (candidate: Candidate, decision: Candidate["decision"], reason: string | null) => void;
}) {
  const [reason, setReason] = useState(candidate.passReason ?? "");
  const savedReason = candidate.passReason ?? "";

  if (!open) {
    return (
      <p className="mt-5 border-t border-line pt-4 text-sm">
        Your choice: <strong>{candidate.decision === "interview" ? "Interview" : candidate.decision === "pass" ? "Pass" : "None"}</strong>
        {candidate.decision === "pass" && candidate.passReason ? `, "${candidate.passReason}"` : ""}
      </p>
    );
  }

  const choice = (value: "interview" | "pass", label: string) => (
    <button
      type="button"
      aria-pressed={candidate.decision === value}
      onClick={() => onSave(candidate, candidate.decision === value ? null : value, value === "pass" ? reason.trim() || null : null)}
      className={cx(
        "min-h-11 flex-1 rounded-lg border px-4 text-[0.9375rem] font-semibold transition-colors sm:flex-none",
        candidate.decision === value
          ? value === "interview"
            ? "border-success bg-success text-white"
            : "border-ink bg-ink text-white"
          : "border-line-strong bg-paper text-ink hover:border-ink",
      )}
    >
      {candidate.decision === value ? "✓ " : ""}
      {label}
    </button>
  );

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div role="group" aria-label={`Your choice for ${candidate.name}`} className="flex gap-2">
        {choice("interview", "Interview")}
        {choice("pass", "Pass")}
      </div>

      {candidate.decision === "pass" && (
        <div className="mt-3">
          <label htmlFor={`reason-${candidate.id}`} className="block text-sm font-medium">
            What's missing? <span className="font-normal text-ink-subtle">(optional, helps us find a better match)</span>
          </label>
          <textarea
            id={`reason-${candidate.id}`}
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => reason.trim() !== savedReason && onSave(candidate, "pass", reason.trim() || null)}
            className={controlClass(false, "mt-1 text-[0.9375rem]")}
          />
        </div>
      )}

      <p className="mt-2 min-h-5 text-sm">
        {state === "saving" && <span className="text-ink-muted">Saving…</span>}
        {state === "saved" && <span className="text-success">Saved</span>}
        {state === "failed" && (
          <span className="text-error">
            Not saved.{" "}
            <button type="button" className="font-semibold underline" onClick={() => onSave(candidate, candidate.decision, candidate.decision === "pass" ? reason.trim() || null : null)}>
              Retry
            </button>
          </span>
        )}
      </p>
    </div>
  );
}
