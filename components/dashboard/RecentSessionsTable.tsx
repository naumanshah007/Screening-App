import Link from "next/link";

import { SOURCE_LABELS } from "@/lib/decisions/completed-decisions";
import type { CommandCentreMetrics } from "@/lib/decisions/dashboard-metrics";
import { formatDateTime } from "@/lib/utils";

type Session = CommandCentreMetrics["recentIntakeSessions"][number];

/** Recent intake sessions, each linking to its own run detail. */
export function RecentSessionsTable({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No intake sessions recorded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Session
            </th>
            <th scope="col" className="pb-2 pr-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cases
            </th>
            <th scope="col" className="pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Source
            </th>
            <th scope="col" className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Received
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {sessions.map((session) => (
            <tr key={session.id} className="group">
              <td className="py-2 pr-3">
                <Link
                  href={`/batch/runs/${session.id}`}
                  className="font-mono text-xs text-brand-700 hover:underline dark:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {session.id.slice(0, 12)}
                </Link>
                {session.pendingCount > 0 && (
                  <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    {session.pendingCount} pending
                  </span>
                )}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                {session.totalCases}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">
                {session.sourceSystem ?? SOURCE_LABELS[session.source] ?? session.source}
              </td>
              <td className="py-2 text-right text-xs text-muted-foreground">
                {formatDateTime(session.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
