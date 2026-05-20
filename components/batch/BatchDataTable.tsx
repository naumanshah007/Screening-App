"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, RiskBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, ArrowUpRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BatchCaseResult } from "@/lib/batch/types";

interface BatchDataTableProps {
  results: BatchCaseResult[];
  onViewDetail: (result: BatchCaseResult) => void;
}

export function BatchDataTable({ results, onViewDetail }: BatchDataTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Processing Results
        </CardTitle>
        <span className="text-xs text-muted-foreground">{results.length} rows</span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Patient ID</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Label</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Figure</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Risk</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Recommendation</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Next Action</th>
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
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {isError ? (
                        <span className="text-red-600 dark:text-red-400">Error</span>
                      ) : (
                        r.decision.figure?.replace(/_/g, " ") ?? "—"
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
      </CardContent>
    </Card>
  );
}
