import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { NOTE_KIND_LABELS, NOTE_KINDS, REQUEST_STATUSES, type NoteKind } from "../../api/_lib/requestStatus.js";
import { Link } from "../components/Link";
import { Button, controlClass } from "../components/ui";
import { adminApi, type RequestDetail, type StaffUser, type TimelineEvent } from "./api";
import { formatDate, formatDateTime, StaleBadge, statusLabel, StatusBadge } from "./format";
import ShortlistPanel from "./ShortlistPanel";

/*
 * /admin/requests/:id. Details on the left; on the right, the actions
 * (status, owner, notes) above the timeline.
 *
 * Status changes send the status the page last saw. If someone else changed
 * it first the server answers 409; the banner says who, and the draft stays.
 */

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const selectClass = controlClass(false, "min-h-11 py-2 text-[0.9375rem]");

export default function RequestPage({ id, user }: { id: string; user: StaffUser }) {
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);

  const load = useCallback(async () => {
    const result = await adminApi<{ request: RequestDetail }>(`/requests/${encodeURIComponent(id)}`);
    if (result.ok) {
      setRequest(result.data.request);
      setLoadError(null);
    } else {
      setLoadError({ status: result.error.status, message: result.error.message });
    }
  }, [id]);

  useEffect(() => {
    load();
    adminApi<{ staff: StaffUser[] }>("/staff").then((result) => result.ok && setStaff(result.data.staff));
  }, [load]);

  if (loadError) {
    return (
      <div className="max-w-xl">
        <BackLink />
        <h1 className="mt-4 text-3xl">{loadError.status === 404 ? "Request not found" : "Couldn't load this request"}</h1>
        <p className="mt-2 text-ink-muted">{loadError.message}</p>
        {loadError.status !== 404 && (
          <Button className="mt-6" variant="secondary" onClick={load}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (!request) {
    return (
      <p role="status" className="text-ink-muted">
        Loading request…
      </p>
    );
  }

  const { contact, role } = request;
  const headcount = role.headcount && role.headcount !== "1" && role.headcount !== "Not specified" ? ` × ${role.headcount}` : "";

  return (
    <div>
      <BackLink />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl">
            {role.role}
            {headcount}
          </h1>
          <p className="mt-1 text-lg text-ink-muted">
            {contact.company} · {contact.firstName} {contact.lastName}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} />
            {request.stale && <StaleBadge />}
            <span className="text-sm text-ink-subtle">
              Client sees: {request.clientStage ?? "a note from the team"} · Received {formatDate(request.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6">
          <Panel title="Contact">
            <Facts
              rows={[
                ["Name", `${contact.firstName} ${contact.lastName}`],
                ["Email", <a key="e" className="text-brand hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a>],
                ["Company", contact.company],
                ["Website", contact.website],
                ["Country", contact.country],
                ["Time zone", contact.timeZone],
              ]}
            />
          </Panel>
          <Panel title="The role">
            <Facts
              rows={[
                ["Role", role.role],
                ["People", role.headcount],
                ["Engagement", role.engagementType],
                ["Start", role.startTimeframe],
                ["Industry", role.sector],
                ["Monthly budget", role.budget],
              ]}
            />
            {role.message && (
              <div className="mt-4 border-t border-line pt-4">
                <h3 className="font-sans text-sm font-semibold text-ink-muted">What they wrote</h3>
                <p className="mt-2 whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{role.message}</p>
              </div>
            )}
          </Panel>
          <Panel title="Where they came from">
            <Facts
              rows={[
                ["First page", request.source.landingPath],
                ["Referrer", request.source.referrer],
                ["Campaign", [request.source.utmSource, request.source.utmMedium, request.source.utmCampaign].filter(Boolean).join(" / ") || null],
                ["Reference ID", request.reference],
                ["Team emailed", request.internalNotifiedAt ? formatDateTime(request.internalNotifiedAt) : null],
              ]}
            />
          </Panel>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatusControl request={request} onChanged={load} />
            <OwnerControl request={request} staff={staff} user={user} onChanged={load} />
          </div>
          <ShortlistPanel request={request} onChanged={load} />
          <Composer request={request} user={user} onAdded={load} />
          <Timeline request={request} onChanged={load} />
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="admin-requests" className="text-sm font-semibold text-brand hover:underline">
      ← All requests
    </Link>
  );
}

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-line bg-paper p-5", className)}>
      <h2 className="font-sans text-base font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-[0.9375rem]">
      {rows.map(([label, value]) => [
        <dt key={`${label}-t`} className="text-ink-muted">
          {label}
        </dt>,
        <dd key={`${label}-d`} className="break-words">
          {value === null || value === undefined || value === "" ? <span className="text-ink-subtle">-</span> : value}
        </dd>,
      ])}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function StatusControl({ request, onChanged }: { request: RequestDetail; onChanged: () => void }) {
  const [to, setTo] = useState(request.status);
  const [note, setNote] = useState("");
  const [tellClient, setTellClient] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; stale: boolean } | null>(null);

  // The choice follows the status, except right after a 409 and Reload: then
  // the person's choice and note stay, to submit against the new status.
  const keepDraft = useRef(false);
  useEffect(() => {
    if (keepDraft.current) {
      keepDraft.current = false;
      return;
    }
    setTo(request.status);
  }, [request.status]);
  const changed = to !== request.status;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await adminApi<{ emailStatus: string | null }>(`/requests/${request.id}/status`, {
      method: "POST",
      body: { from: request.status, to, note, visibility: tellClient && note.trim() ? "client" : "internal" },
    });
    setBusy(false);
    if (!result.ok) {
      setError({ message: result.error.message, stale: result.error.code === "stale_status" });
      return;
    }
    setNote("");
    setTellClient(false);
    onChanged();
  };

  return (
    <form onSubmit={submit} className={cx("rounded-xl border bg-paper p-4", changed ? "border-brand" : "border-line")}>
      <label htmlFor="status-select" className="text-sm font-semibold">
        Status
      </label>
      <select id="status-select" className={cx(selectClass, "mt-1.5")} value={to} onChange={(e) => setTo(e.target.value)}>
        {REQUEST_STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </select>

      {changed && (
        <div className="mt-3 space-y-3">
          <label htmlFor="status-note" className="sr-only">
            Note about this change (optional)
          </label>
          <textarea
            id="status-note"
            rows={2}
            placeholder="Why? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={controlClass(false, "text-[0.9375rem]")}
          />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={tellClient} disabled={!note.trim()} onChange={(e) => setTellClient(e.target.checked)} />
            <span>
              Email this note to {request.contact.firstName}
              {!note.trim() && <span className="text-ink-subtle"> (write a note first)</span>}
            </span>
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : tellClient && note.trim() ? "Update and email client" : `Move to ${statusLabel(to)}`}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setTo(request.status)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-lg bg-error-tint px-3 py-2 text-sm text-error">
          <p>{error.message}</p>
          {error.stale && (
            <button
              type="button"
              className="mt-1 font-semibold underline"
              onClick={() => {
                keepDraft.current = true;
                setError(null);
                onChanged();
              }}
            >
              Reload (your note is kept)
            </button>
          )}
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Owner
// ---------------------------------------------------------------------------

function OwnerControl({ request, staff, user, onChanged }: { request: RequestDetail; staff: StaffUser[]; user: StaffUser; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOwner = async (ownerId: string | null) => {
    setBusy(true);
    setError(null);
    const result = await adminApi(`/requests/${request.id}/owner`, { method: "POST", body: { ownerId } });
    setBusy(false);
    if (!result.ok) setError(result.error.message);
    else onChanged();
  };

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <label htmlFor="owner-select" className="text-sm font-semibold">
        Owner
      </label>
      <select
        id="owner-select"
        className={cx(selectClass, "mt-1.5")}
        value={request.owner?.id ?? ""}
        disabled={busy}
        onChange={(e) => setOwner(e.target.value || null)}
      >
        <option value="">Nobody yet</option>
        {staff.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name ?? person.email}
            {person.id === user.id ? " (you)" : ""}
          </option>
        ))}
      </select>
      {!request.owner && (
        <button type="button" className="mt-2 text-sm font-semibold text-brand hover:underline" disabled={busy} onClick={() => setOwner(user.id)}>
          Take it
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes: internal by default; "Message to client" is a separate, clearly
// marked mode that emails the client from you.
// ---------------------------------------------------------------------------

function Composer({ request, user, onAdded }: { request: RequestDetail; user: StaffUser; onAdded: () => void }) {
  const [mode, setMode] = useState<"internal" | "client">("internal");
  const [kind, setKind] = useState<NoteKind>("note");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (next: "internal" | "client") => {
    setMode(next);
    setPreview(false);
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "client" && !preview) {
      setPreview(true);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await adminApi<{ emailStatus: string | null }>(`/requests/${request.id}/notes`, {
      method: "POST",
      body: { kind: mode === "client" ? "note" : kind, body, visibility: mode },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setBody("");
    setPreview(false);
    setNotice(
      mode === "client"
        ? result.data.emailStatus === "sent"
          ? `Emailed to ${request.contact.email}.`
          : "Saved, but the email didn't send. Use Retry on the timeline."
        : "Note added.",
    );
    onAdded();
  };

  const isClient = mode === "client";

  return (
    <form onSubmit={submit} className={cx("rounded-xl border bg-paper", isClient ? "border-brand" : "border-line")}>
      <div role="tablist" aria-label="Who sees this" className="flex border-b border-line">
        <ModeTab active={!isClient} onClick={() => switchMode("internal")}>
          Internal note
        </ModeTab>
        <ModeTab active={isClient} onClick={() => switchMode("client")}>
          Message to client
        </ModeTab>
      </div>

      <div className="space-y-3 p-4">
        {isClient ? (
          <p className="rounded-lg bg-brand-tint px-3 py-2 text-sm text-ink">
            Emails <strong>{request.contact.email}</strong> from <strong>{user.name ?? user.email}</strong>. Replies come to you.
          </p>
        ) : (
          <div>
            <label htmlFor="note-kind" className="sr-only">
              Kind of entry
            </label>
            <select id="note-kind" className={cx(selectClass, "max-w-xs")} value={kind} onChange={(e) => setKind(e.target.value as NoteKind)}>
              {NOTE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {NOTE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        )}

        {preview ? (
          <div className="rounded-lg border border-line bg-surface p-4 text-[0.9375rem]">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Preview</p>
            <p className="mt-2">Hi {request.contact.firstName.split(/\s+/)[0]},</p>
            <p className="mt-2 whitespace-pre-wrap">{body.trim()}</p>
            <p className="mt-3">{user.name ?? user.email}</p>
          </div>
        ) : (
          <>
            <label htmlFor="note-body" className="sr-only">
              {isClient ? "Message to the client" : "Note for the team"}
            </label>
            <textarea
              id="note-body"
              rows={4}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setNotice(null);
              }}
              placeholder={isClient ? "Write the update the client will receive…" : "Only the team sees this."}
              className={controlClass(Boolean(error), "text-[0.9375rem]")}
            />
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        {notice && !error && (
          <p role="status" className="text-sm text-success">
            {notice}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={busy || !body.trim()}>
            {busy ? "Saving…" : isClient ? (preview ? "Send to client" : "Preview email") : "Add note"}
          </Button>
          {preview && (
            <Button size="sm" variant="secondary" onClick={() => setPreview(false)}>
              Edit
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        "-mb-px flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
        active ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const describe = (event: TimelineEvent) => {
  // No actor: something the client did, or that followed from it (the
  // entry's body says why).
  const who = event.actor?.name ?? "The client";
  switch (event.kind) {
    case "status_change":
      return event.actor
        ? `${who} moved it from ${statusLabel(event.fromStatus ?? "")} to ${statusLabel(event.toStatus ?? "")}`
        : `Moved from ${statusLabel(event.fromStatus ?? "")} to ${statusLabel(event.toStatus ?? "")}`;
    case "shortlist_published":
      return `${who} published the shortlist and emailed the client`;
    case "shortlist_viewed":
      return "The client opened the shortlist";
    case "client_choices":
      return "The client sent their choices";
    case "link":
      return event.actor ? `${who} sent a fresh shortlist link` : "The client asked for a fresh shortlist link";
    case "owner_change":
      return `${who} set the owner to ${event.body ?? "nobody"}`;
    case "discovery_call":
      return `${who} logged a discovery call`;
    case "status_inquiry":
      return `${who} noted the client asked for an update`;
    default:
      return event.visibility === "client" ? `${who} messaged the client` : `${who} added a note`;
  }
};

function Timeline({ request, onChanged }: { request: RequestDetail; onChanged: () => void }) {
  return (
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="font-sans text-base font-semibold">
        Timeline
      </h2>
      <ol className="mt-3 space-y-0 border-l border-line pl-5">
        {request.events.map((event) => timelineItem(event, request.id, onChanged))}
        <li className="relative pb-2">
          <Dot />
          <p className="text-sm font-semibold">Request received from the website</p>
          <p className="text-xs text-ink-subtle">{formatDateTime(request.createdAt)}</p>
        </li>
      </ol>
    </section>
  );
}

function Dot({ tone }: { tone?: "client" }) {
  return (
    <span
      aria-hidden="true"
      className={cx("absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface", tone === "client" ? "bg-brand" : "bg-line-strong")}
    />
  );
}

// A plain function (not a component) so the list keys sit on the <li>.
function timelineItem(event: TimelineEvent, requestId: string, onChanged: () => void) {
  const showBody = event.body && event.kind !== "owner_change" && event.kind !== "shortlist_viewed";
  const isClient = event.visibility === "client";
  return (
    <li key={event.id} className="relative pb-5">
      <Dot tone={isClient ? "client" : undefined} />
      <p className="text-sm font-semibold">{describe(event)}</p>
      <p className="text-xs text-ink-subtle">
        {formatDateTime(event.createdAt)}
        {isClient && " · visible to client"}
      </p>
      {showBody && (
        <p className={cx("mt-2 whitespace-pre-wrap rounded-lg px-3 py-2 text-[0.9375rem]", isClient ? "bg-brand-tint" : "bg-paper border border-line")}>
          {event.body}
        </p>
      )}
      {isClient && <EmailState event={event} requestId={requestId} onChanged={onChanged} />}
    </li>
  );
}

function EmailState({ event, requestId, onChanged }: { event: TimelineEvent; requestId: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (event.emailStatus === "sent") {
    return <p className="mt-1 text-xs text-success">Emailed {formatDateTime(event.emailSentAt)}</p>;
  }
  if (event.kind === "link" || event.kind === "shortlist_published") {
    return <p className="mt-1 text-xs text-error">Not sent. Use Send a fresh link in the Shortlist section.</p>;
  }
  const retry = async () => {
    setBusy(true);
    setError(null);
    const result = await adminApi(`/requests/${requestId}/events/${event.id}/resend`, { method: "POST" });
    setBusy(false);
    if (!result.ok) setError(result.error.message);
    else onChanged();
  };
  return (
    <p className="mt-1 text-xs text-error">
      Not sent.{" "}
      <button type="button" className="font-semibold underline" disabled={busy} onClick={retry}>
        {busy ? "Sending…" : "Retry"}
      </button>
      {error && <span className="ml-2">{error}</span>}
    </p>
  );
}
