import { useEffect, useState, type ReactNode } from "react";
import { REQUEST_STATUSES } from "../../api/_lib/requestStatus.js";
import { Link } from "../components/Link";
import { Button } from "../components/ui";
import { navigate } from "../lib/router";
import { adminApi, type InboxResponse, type StaffUser, type SummaryResponse } from "./api";
import { formatDate, StaleBadge, statusLabel, StatusBadge, timeAgo } from "./format";

/*
 * /admin/requests: funnel numbers, filters (kept in the URL so a filtered view
 * can be bookmarked or shared with a colleague) and the list.
 */

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const selectClass =
  "min-h-10 rounded-lg border border-line-strong bg-paper px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export default function InboxPage({ search }: { search: string }) {
  const query = new URLSearchParams(search);
  const status = query.get("status") ?? "open";
  const owner = query.get("owner") ?? "any";
  const stale = query.get("stale") === "1";

  const [inbox, setInbox] = useState<InboxResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    adminApi<InboxResponse>(`/requests${search}`).then((result) => {
      if (cancelled) return;
      if (result.ok) setInbox(result.data);
      else setError(result.error.message);
    });
    return () => {
      cancelled = true;
    };
  }, [search, reload]);

  useEffect(() => {
    adminApi<SummaryResponse>("/summary").then((result) => result.ok && setSummary(result.data));
    adminApi<{ staff: StaffUser[] }>("/staff").then((result) => result.ok && setStaff(result.data.staff));
  }, []);

  const setFilter = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    navigate("admin-requests", Object.fromEntries(next), { replace: true });
  };

  const counts = inbox?.counts ?? {};

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Requests</h1>
          <p className="mt-1 text-ink-muted">
            {counts.open ?? 0} open · {counts.unassigned ?? 0} without an owner
          </p>
        </div>
      </div>

      <section aria-label="Last 30 days" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="New, last 7 days" value={summary?.last7.received} detail={summary ? `${summary.last30.received} in 30 days` : undefined} />
        <Stat label="Shortlists sent, 7 days" value={summary?.last7.shortlisted} detail={summary ? `${summary.last30.shortlisted} in 30 days` : undefined} />
        <Stat label="Filled, 7 days" value={summary?.last7.filled} detail={summary ? `${summary.last30.filled} in 30 days` : undefined} />
        <Stat
          label="Typical time to shortlist"
          value={summary?.medianHoursToShortlist == null ? "-" : formatHours(summary.medianHoursToShortlist)}
          detail="Median, last 30 days"
        />
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <QuickFilter active={status === "open" && !stale && owner === "any"} onClick={() => setFilter({ status: null, stale: null, owner: null })}>
          Open <Count n={counts.open} />
        </QuickFilter>
        <QuickFilter active={stale} onClick={() => setFilter({ stale: stale ? null : "1", status: null })}>
          Needs an update <Count n={counts.stale} tone={counts.stale ? "error" : undefined} />
        </QuickFilter>
        <QuickFilter active={owner === "me"} onClick={() => setFilter({ owner: owner === "me" ? null : "me" })}>
          Mine
        </QuickFilter>
        <QuickFilter active={owner === "none"} onClick={() => setFilter({ owner: owner === "none" ? null : "none" })}>
          No owner <Count n={counts.unassigned} />
        </QuickFilter>

        <div className="ml-auto flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="filter-status">
            Status
          </label>
          <select id="filter-status" className={selectClass} value={status} onChange={(e) => setFilter({ status: e.target.value === "open" ? null : e.target.value })}>
            <option value="open">All open</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)} ({counts[s] ?? 0})
              </option>
            ))}
            <option value="all">Everything ({counts.all ?? 0})</option>
          </select>
          <label className="sr-only" htmlFor="filter-owner">
            Owner
          </label>
          <select id="filter-owner" className={selectClass} value={owner} onChange={(e) => setFilter({ owner: e.target.value === "any" ? null : e.target.value })}>
            <option value="any">Any owner</option>
            <option value="me">Me</option>
            <option value="none">No owner</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name ?? person.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-error/30 bg-error-tint px-4 py-3 text-error">
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={() => setReload((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}

      {!inbox && !error && (
        <p role="status" className="mt-10 text-ink-muted">
          Loading requests…
        </p>
      )}

      {inbox && inbox.items.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-line-strong bg-paper px-6 py-12 text-center">
          <p className="font-semibold">Nothing here.</p>
          <p className="mt-1 text-ink-muted">
            {stale ? "Every open request has been updated in the last 3 business days." : "No requests match these filters."}
          </p>
        </div>
      )}

      {inbox && inbox.items.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-paper">
          <table className="w-full text-left text-sm">
            <thead className="hidden border-b border-line bg-surface text-xs uppercase tracking-wide text-ink-muted md:table-header-group">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Request</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Owner</th>
                <th scope="col" className="px-4 py-3 font-semibold">Last update</th>
                <th scope="col" className="px-4 py-3 font-semibold">Received</th>
              </tr>
            </thead>
            <tbody>
              {inbox.items.map((item) => (
                <tr key={item.id} className="block border-b border-line last:border-b-0 hover:bg-surface md:table-row">
                  <td className="block px-4 pt-4 md:table-cell md:py-3">
                    <Link to="admin-request" params={{ id: item.id }} className="font-semibold text-ink hover:text-brand hover:underline">
                      {item.role}
                      {item.headcount && item.headcount !== "1" && item.headcount !== "Not specified" ? ` × ${item.headcount}` : ""}
                    </Link>
                    <div className="text-ink-muted">
                      {item.company} · {item.name}
                    </div>
                  </td>
                  <td className="block px-4 pt-2 md:table-cell md:py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={item.status} />
                      {item.stale && <StaleBadge />}
                    </div>
                  </td>
                  <td className={cx("block px-4 pt-2 md:table-cell md:py-3", !item.owner && "text-ink-subtle")}>
                    <span className="md:hidden text-ink-subtle">Owner: </span>
                    {item.owner?.name ?? "Nobody yet"}
                  </td>
                  <td className="block px-4 pt-1 text-ink-muted md:table-cell md:py-3">
                    <span className="md:hidden">Updated </span>
                    <time dateTime={item.lastActivityAt}>{timeAgo(item.lastActivityAt)}</time>
                  </td>
                  <td className="block px-4 pb-4 pt-1 text-ink-muted md:table-cell md:py-3">
                    <span className="md:hidden">Received </span>
                    <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {inbox?.truncated && <p className="mt-3 text-sm text-ink-muted">Showing the most recent 1,000 requests.</p>}
    </div>
  );
}

const formatHours = (hours: number) => (hours < 48 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} days`);

function Stat({ label, value, detail }: { label: string; value: number | string | undefined; detail?: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-ink">{value ?? "–"}</p>
      {detail && <p className="text-xs text-ink-subtle">{detail}</p>}
    </div>
  );
}

function QuickFilter({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
        active ? "border-ink bg-ink text-white" : "border-line-strong bg-paper text-ink hover:border-ink",
      )}
    >
      {children}
    </button>
  );
}

function Count({ n, tone }: { n: number | undefined; tone?: "error" }) {
  if (n === undefined) return null;
  return (
    <span className={cx("rounded-full px-1.5 text-xs", tone === "error" ? "bg-error text-white" : "bg-surface-2 text-ink")}>{n}</span>
  );
}
