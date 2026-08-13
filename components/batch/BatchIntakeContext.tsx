import { Database, FileCheck2, GitBranch, ShieldCheck } from "lucide-react";

import { Panel, StatusBadge } from "@/components/system";
import { cn } from "@/lib/utils";

/**
 * Intake context for the Case Intake screen.
 *
 * Replaces the flat four-column engine strip, which led with
 * `business-figures-table1-v1` under the heading "Engine Version" — presenting
 * the router as though it were the recommendation engine. The clinician-facing
 * emphasis is now the current governed ruleset; the router is retained as a
 * subordinate technical line, because it is still genuinely what performs
 * pathway selection.
 */

function ContextItem({
  icon,
  label,
  value,
  detail,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{value}</span>
          {trailing}
        </div>
        {detail && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
        )}
      </div>
    </div>
  );
}

export function BatchIntakeContext({
  sourceName,
  sourceProtocol,
  pulledCount,
  validCount,
  blockedCount,
  currentRuleset,
  routingService,
  className,
}: {
  sourceName?: string | null;
  sourceProtocol?: string | null;
  pulledCount?: number;
  validCount?: number;
  blockedCount?: number;
  /** Null when no governed ruleset is active — reported, never assumed. */
  currentRuleset: { displayVersion: string; status: string } | null;
  routingService: string;
  className?: string;
}) {
  const hasRecords = typeof pulledCount === "number";

  return (
    <Panel className={cn("px-4 py-3.5", className)}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ContextItem
          icon={<Database className="h-4 w-4" />}
          label="Source"
          value={sourceName ?? "No source selected"}
          detail={sourceProtocol ?? undefined}
        />

        <ContextItem
          icon={<FileCheck2 className="h-4 w-4" />}
          label="Records"
          value={hasRecords ? `${pulledCount} pulled` : "—"}
          detail={
            hasRecords ? (
              <>
                {validCount} valid
                {blockedCount ? ` · ${blockedCount} need attention` : ""}
              </>
            ) : undefined
          }
        />

        <ContextItem
          icon={<GitBranch className="h-4 w-4" />}
          label="Routing"
          value="Figures 1–10 + Table 1"
          // The router is genuinely what selects the pathway, so it stays
          // visible — but as a technical detail, not as the headline engine.
          detail={
            <span className="font-mono text-[0.6875rem]">
              Routing service: {routingService}
            </span>
          }
        />

        <ContextItem
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Current rules"
          value={currentRuleset?.displayVersion ?? "Not configured"}
          trailing={
            currentRuleset ? (
              <StatusBadge tone="brand" size="sm">
                {currentRuleset.status}
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral" size="sm">
                Unavailable
              </StatusBadge>
            )
          }
          detail="Current governed rules"
        />
      </div>
    </Panel>
  );
}
