"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, RiskBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, ArrowUpRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BatchCaseResult } from "@/lib/batch/types";
import { formatFigureLabel, getGuidelineCitation } from "@/lib/batch/guideline-citations";

interface BatchDataTableProps {
  results: BatchCaseResult[];
  onViewDetail: (result: BatchCaseResult) => void;
}

export function BatchDataTable({ results, onViewDetail }: BatchDataTableProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Provisional Recommendations
        </CardTitle>
        <span className="text-xs text-muted-foreground">{results.length} row{results.length !== 1 ? "s" : ""} · pending reviewer confirmation</span>
      </CardHeader>
      <CardContent className="p-0">
        {/* ── Desktop / tablet: full table (md+) ── */}
        <div className="hidden max-w-full overflow-x-auto overscroll-x-contain md:block">
          <table className="min-w-[1040px] w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Patient ID</th>
                <th className="min-w-[170px] px-3 py-2.5 text-xs font-semibold text-muted-foreground">Label</th>
                <th className="min-w-[120px] px-3 py-2.5 text-xs font-semibold text-muted-foreground">Figure</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Risk</th>
                <th className="min-w-[260px] px-3 py-2.5 text-xs font-semibold text-muted-foreground">Recommendation</th>
                <th className="min-w-[170px] px-3 py-2.5 text-xs font-semibold text-muted-foreground">Next Action</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Referral</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-20"></th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const isError = r.status === "error";
                return (
                  <tr
                    key={r.case.caseId}
                    className={cn(
                      "border-b border-border/50 transition-colors hover:bg-muted/30",
                      isError && "bg-red-50/30 dark:bg-red-950/10"
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs font-semibold text-foreground tracking-wide">
                        {r.case.source.externalPatientId ?? `ROW-${String(r.case.source.rowNumber).padStart(3, "0")}`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground max-w-[180px] truncate">
                      {r.case.label || r.case.source.externalPatientId || `Row ${r.case.source.rowNumber}`}
                    </td>
                    <td className="px-3 py-2.5">
                      {isError ? (
                        <span className="text-red-600 dark:text-red-400">Error</span>
                      ) : (
                        <span
                          className="text-xs font-medium text-foreground"
                          title={getGuidelineCitation(r.decision.figure)?.title}
                        >
                          {formatFigureLabel(r.decision.figure)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {isError ? (
                        <Badge variant="urgent" size="sm">Error</Badge>
                      ) : (
                        <RiskBadge risk={r.decision.riskLevel} size="sm" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 max-w-[220px]">
                      {isError ? (
                        <span className="text-red-600 dark:text-red-400 text-xs">{r.error}</span>
                      ) : (
                        <span className="text-foreground text-xs leading-relaxed line-clamp-2">
                          {r.decision.recommendation ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">
                      {isError ? "—" : r.decision.nextAction ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {!isError && r.decision.referralRequired ? (
                        <Badge variant="high" size="sm">
                          <ArrowUpRight className="h-3 w-3" />
                          {r.decision.referralType?.replace(/_/g, " ") ?? "Yes"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => onViewDetail(r)}
                        icon={<Eye className="h-3.5 w-3.5" />}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile: stacked, tappable cards (< md) ── */}
        <div className="md:hidden divide-y divide-border">
          {results.map((r) => {
            const isError = r.status === "error";
            const patientId = r.case.source.externalPatientId ?? `ROW-${String(r.case.source.rowNumber).padStart(3, "0")}`;
            return (
              <button
                key={r.case.caseId}
                type="button"
                onClick={() => onViewDetail(r)}
                className={cn(
                  "w-full p-4 text-left transition-colors hover:bg-muted/30",
                  isError && "bg-red-50/30 dark:bg-red-950/10"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold tracking-wide text-foreground">{patientId}</span>
                    <p className="truncate text-sm font-medium text-foreground">
                      {r.case.label || r.case.source.externalPatientId || `Row ${r.case.source.rowNumber}`}
                    </p>
                  </div>
                  {isError
                    ? <Badge variant="urgent" size="sm">Error</Badge>
                    : <RiskBadge risk={r.decision.riskLevel} size="sm" />}
                </div>

                {isError ? (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{r.error}</p>
                ) : (
                  <>
                    <p className="mt-2 text-xs leading-relaxed text-foreground line-clamp-2">
                      {r.decision.recommendation ?? "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                      <span><span className="text-muted-foreground/70">Figure:</span> {formatFigureLabel(r.decision.figure)}</span>
                      {r.decision.nextAction && (
                        <span className="truncate"><span className="text-muted-foreground/70">Next:</span> {r.decision.nextAction}</span>
                      )}
                      {r.decision.referralRequired && (
                        <Badge variant="high" size="sm">
                          <ArrowUpRight className="h-3 w-3" />
                          {r.decision.referralType?.replace(/_/g, " ") ?? "Referral"}
                        </Badge>
                      )}
                    </div>
                  </>
                )}

                <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-accent-color">
                  <Eye className="h-3.5 w-3.5" /> View detail
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
