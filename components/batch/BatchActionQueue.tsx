"use client";

/**
 * Hot list shown at the top of results: provisional high-priority cases
 * flagged for reviewer attention.
 *
 * For the coordinator and CMO, this answers the only question that matters
 * the moment a batch finishes: *which cases should the reviewer look at first?*
 *
 * All output is decision-support only — reviewer confirmation is required
 * before any clinical action.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge, RiskBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Siren, Eye, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BatchCaseResult } from "@/lib/batch/types";
import { formatFigureLabel } from "@/lib/batch/guideline-citations";

interface BatchActionQueueProps {
  results: BatchCaseResult[];
  onViewDetail: (result: BatchCaseResult) => void;
}

export function BatchActionQueue({ results, onViewDetail }: BatchActionQueueProps) {
  // Urgent = riskLevel URGENT or HIGH, OR referralRequired
  const urgent = results.filter(
    (r) =>
      r.status === "success" &&
      (r.decision.riskLevel === "URGENT" ||
       r.decision.riskLevel === "HIGH" ||
       r.decision.referralRequired)
  );

  if (urgent.length === 0) {
    return (
      <Card className="border-l-4 border-l-emerald-500">
        <CardContent className="py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <Siren className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              No high-priority cases flagged
            </div>
            <div className="text-xs text-muted-foreground">
              Provisional output: all processed cases routed to routine recall or surveillance pathways. Reviewer confirmation still required.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-950/10">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center animate-pulse">
              <Siren className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-red-700 dark:text-red-400">
                {urgent.length} case{urgent.length !== 1 ? "s" : ""} flagged as provisional priority for reviewer
              </div>
              <div className="text-xs text-red-700/80 dark:text-red-400/80">
                High-risk findings or referral suggested — reviewer confirmation required before action
              </div>
            </div>
          </div>
          <Badge variant="urgent" size="sm">
            Pending reviewer
          </Badge>
        </div>

        <ul className="space-y-1 divide-y divide-red-200/50 dark:divide-red-900/30">
          {urgent.map((r) => {
            const patientId =
              r.case.source.externalPatientId ??
              `ROW-${String(r.case.source.rowNumber).padStart(3, "0")}`;
            return (
              <li key={r.case.caseId} className="flex flex-col gap-1.5 py-2 first:pt-0 sm:flex-row sm:items-center sm:gap-3 sm:py-0 sm:pt-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-foreground tracking-wide sm:w-32 sm:flex-shrink-0">
                    {patientId}
                  </span>
                  <RiskBadge risk={r.decision.riskLevel} size="sm" />
                  <span className="text-xs text-muted-foreground hidden sm:inline-block w-20 flex-shrink-0">
                    {formatFigureLabel(r.decision.figure)}
                  </span>
                </div>
                <span className="text-xs text-foreground flex-1 truncate">
                  {r.decision.recommendation}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.decision.referralRequired && (
                    <Badge variant="high" size="sm" className="flex-shrink-0">
                      <ArrowUpRight className="h-3 w-3" />
                      {r.decision.referralType?.replace(/_/g, " ") ?? "Refer"}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onViewDetail(r)}
                    icon={<Eye className="h-3 w-3" />}
                    className={cn("flex-shrink-0")}
                  >
                    View
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
