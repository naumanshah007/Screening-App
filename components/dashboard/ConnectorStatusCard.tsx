import Link from "next/link";

import type { ConnectorActivity } from "@/lib/decisions/dashboard-insights";
import { SOURCE_LABELS } from "@/lib/decisions/completed-decisions";
import { cn } from "@/lib/utils";

/**
 * Intake source activity.
 *
 * IMPORTANT: this is NOT a live health probe. No hospital system is connected in
 * this environment, so a green dot here would be actively misleading in a
 * demonstration. Status is derived only from how recently each source produced
 * real intake, and every row is labelled as a simulated source.
 */

const STATUS_LABEL: Record<ConnectorActivity["status"], string> = {
  ACTIVE: "Recent intake",
  IDLE: "No recent intake",
  STALE: "Dormant",
};

const STATUS_TONE: Record<ConnectorActivity["status"], string> = {
  ACTIVE: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/40 dark:text-brand-300",
  IDLE: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300",
  STALE: "bg-muted text-muted-foreground border-border",
};

const STATUS_DOT: Record<ConnectorActivity["status"], string> = {
  ACTIVE: "bg-brand-500",
  IDLE: "bg-amber-500",
  STALE: "bg-muted-foreground/50",
};

function relativeTime(date: Date | null) {
  if (!date) return "never";
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ConnectorStatusCard({ connectors }: { connectors: ConnectorActivity[] }) {
  if (connectors.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No intake source has been used yet.
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {connectors.slice(0, 5).map((connector) => (
          <li
            key={`${connector.source}-${connector.sourceSystem ?? ""}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn("h-2 w-2 flex-shrink-0 rounded-full", STATUS_DOT[connector.status])}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {connector.sourceSystem ?? SOURCE_LABELS[connector.source] ?? connector.source}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  Simulated source · {connector.sessions} session
                  {connector.sessions === 1 ? "" : "s"} · {connector.cases} case
                  {connector.cases === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  STATUS_TONE[connector.status]
                )}
              >
                {STATUS_LABEL[connector.status]}
              </span>
              <span className="w-14 text-right text-[11px] tabular-nums text-muted-foreground">
                {relativeTime(connector.lastSeenAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        No live hospital system is connected. Status reflects recency of simulated intake only.
      </p>
      <Link
        href="/batch"
        className="mt-2 inline-flex items-center text-xs font-medium text-brand-700 hover:underline dark:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        View intake sources →
      </Link>
    </div>
  );
}
