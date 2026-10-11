import { STATUS_LABELS, type RequestStatus } from "../../api/_lib/requestStatus.js";

export const statusLabel = (status: string) => STATUS_LABELS[status as RequestStatus] ?? status;

// Colour carries meaning only alongside the label text.
const STATUS_TONE: Record<string, string> = {
  received: "bg-brand-tint text-brand",
  clarifying: "bg-[#fdf3e1] text-[#8a5300]",
  sourcing: "bg-surface-2 text-ink",
  shortlist_ready: "bg-[#efe9fb] text-[#5b3aa8]",
  interviewing: "bg-[#efe9fb] text-[#5b3aa8]",
  filled: "bg-success-tint text-success",
  on_hold: "bg-surface-2 text-ink-muted",
  closed: "bg-surface-2 text-ink-muted",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status] ?? "bg-surface-2"}`}>
      {statusLabel(status)}
    </span>
  );
}

export function StaleBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-error-tint px-2.5 py-0.5 text-xs font-semibold text-error">
      <span aria-hidden="true">●</span> No update in 3+ days
    </span>
  );
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const formatDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : "-");
export const formatDateTime = (iso: string | null) => (iso ? dateTimeFormat.format(new Date(iso)) : "-");

// "3 days ago", "just now".
export const timeAgo = (iso: string, now = Date.now()) => {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
};
