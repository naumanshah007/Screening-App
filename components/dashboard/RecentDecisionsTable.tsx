import Link from "next/link";

import type { CompletedDecisionRecord } from "@/lib/decisions/completed-decisions";
import { formatDisposition, isUrgentClinicalPriority } from "@/lib/decisions/package-generator";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const DISPOSITION_TONE: Record<string, string> = {
  ACCEPTED: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/40 dark:text-brand-300",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/30",
  NEEDS_INFO: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300",
};

/**
 * Recently confirmed reviewer decisions.
 *
 * Shows the reviewer's disposition — the operative clinical outcome — never a
 * canonical shadow result.
 */
export function RecentDecisionsTable({ decisions }: { decisions: CompletedDecisionRecord[] }) {
  if (decisions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No decisions confirmed yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Case
            </th>
            <th scope="col" className="pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Decision
            </th>
            <th scope="col" className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Confirmed
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {decisions.map((decision) => {
            const urgent = isUrgentClinicalPriority({
              riskLevel: decision.riskLevel,
              referralPriority: decision.referralPriority,
            });
            return (
              <tr key={decision.id}>
                <td className="py-2 pr-3">
                  <Link
                    href={`/batch/runs/${decision.batchRunId}`}
                    className="font-mono text-xs text-brand-700 hover:underline dark:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {decision.nhi ?? decision.externalPatientId ?? `Row ${decision.rowNumber}`}
                  </Link>
                  {urgent && (
                    <span className="ml-2 rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                      Urgent
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={cn(
                      "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      DISPOSITION_TONE[decision.disposition] ?? "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {formatDisposition(decision.disposition)}
                  </span>
                </td>
                <td className="py-2 text-right text-xs text-muted-foreground">
                  {decision.reviewedAt ? formatDateTime(decision.reviewedAt) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
