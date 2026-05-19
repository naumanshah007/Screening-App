"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanonicalBatchCase } from "@/lib/batch/types";

interface BatchValidationPreviewProps {
  cases: CanonicalBatchCase[];
  validCount: number;
  warningCount: number;
  invalidCount: number;
  onProcess: (selectedCaseIds: string[]) => void;
  processing?: boolean;
}

const statusIcon = {
  valid: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
  warnings: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
  invalid: <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />,
} as const;

const statusLabel = {
  valid: "Valid",
  warnings: "Warnings",
  invalid: "Invalid",
} as const;

const statusBadgeVariant = {
  valid: "low" as const,
  warnings: "high" as const,
  invalid: "urgent" as const,
};

export function BatchValidationPreview({
  cases,
  validCount,
  warningCount,
  invalidCount,
  onProcess,
  processing = false,
}: BatchValidationPreviewProps) {
  // All processable (valid + warnings) are selected by default
  const processableIds = useMemo(
    () => cases.filter((c) => c.validationStatus !== "invalid").map((c) => c.caseId),
    [cases]
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(processableIds));

  const allSelected = selected.size === processableIds.length && processableIds.length > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(processableIds));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>Validation Preview</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="low" size="sm">{validCount} valid</Badge>
            {warningCount > 0 && <Badge variant="high" size="sm">{warningCount} warnings</Badge>}
            {invalidCount > 0 && <Badge variant="urgent" size="sm">{invalidCount} invalid</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {selected.size} of {processableIds.length} selected
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onProcess(Array.from(selected))}
            disabled={selected.size === 0 || processing}
            loading={processing}
          >
            Process {selected.size} Row{selected.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-border"
                    aria-label="Select all processable rows"
                  />
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Row</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Label</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">HPV</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Cytology</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Key Flags</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Issues</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const isInvalid = c.validationStatus === "invalid";
                const isSelected = selected.has(c.caseId);
                const issues = [...c.validationErrors, ...c.validationWarnings];
                const flags: string[] = [];
                if (c.immunocompromised) flags.push("Immunocompromised");
                if (c.isPostHysterectomy) flags.push("Post-hysterectomy");
                if (c.isFirstTimeHPVTransition) flags.push("HPV Transition");
                if (c.isPregnant) flags.push("Pregnant");
                if (c.hasAbnormalVaginalBleeding) flags.push("Abn. Bleeding");
                if (c.isTestOfCure) flags.push("Test of Cure");

                return (
                  <tr
                    key={c.caseId}
                    className={cn(
                      "border-b border-border/50 transition-colors",
                      isInvalid && "bg-red-50/30 dark:bg-red-950/10",
                      !isInvalid && isSelected && "bg-brand-50/20 dark:bg-brand-950/10"
                    )}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isInvalid}
                        onChange={() => toggleOne(c.caseId)}
                        className="rounded border-border disabled:opacity-40"
                        aria-label={`Select row ${c.source.rowNumber}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{c.source.rowNumber}</td>
                    <td className="px-3 py-2 font-medium text-foreground max-w-[200px] truncate">
                      {c.label || c.source.externalPatientId || `Row ${c.source.rowNumber}`}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusBadgeVariant[c.validationStatus]} size="sm">
                        <span className="flex items-center gap-1">
                          {statusIcon[c.validationStatus]}
                          {statusLabel[c.validationStatus]}
                        </span>
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {c.hpvResult?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {c.cytologyResult?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {flags.length > 0
                          ? flags.map((f) => (
                              <span key={f} className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                {f}
                              </span>
                            ))
                          : <span className="text-muted-foreground">&mdash;</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {issues.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "text-xs font-medium",
                            c.validationErrors.length > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400"
                          )}>
                            {issues.length} issue{issues.length !== 1 ? "s" : ""}
                          </span>
                          <button
                            type="button"
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                            title={issues.map((i) => `[${i.severity}] ${i.field}: ${i.message}`).join("\n")}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">&mdash;</span>
                      )}
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
