"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, AlertTriangle, XCircle, Info, Database,
  Plus, Pencil, Copy, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanonicalBatchCase } from "@/lib/batch/types";

interface BatchValidationPreviewProps {
  cases: CanonicalBatchCase[];
  validCount: number;
  warningCount: number;
  invalidCount: number;
  onProcess: (selectedCaseIds: string[]) => void;
  processing?: boolean;
  /** Called when user clicks "Add Test Case Manually" */
  onAddManual?: () => void;
  /** Called when user clicks Edit on a row */
  onEditCase?: (batchCase: CanonicalBatchCase) => void;
  /** Called when user clicks Duplicate on a row */
  onDuplicateCase?: (batchCase: CanonicalBatchCase) => void;
  /** Called when user clicks Delete on a row */
  onDeleteCase?: (caseId: string) => void;
}

const statusIcon = {
  valid:    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
  warnings: <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />,
  invalid:  <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />,
} as const;

const statusLabel = { valid: "Valid", warnings: "Warnings", invalid: "Invalid" } as const;
const statusBadgeVariant = { valid: "low" as const, warnings: "high" as const, invalid: "urgent" as const };

function hpvLabel(v?: string) {
  if (!v) return null;
  const map: Record<string, string> = {
    NOT_DETECTED: "Not Detected",
    HPV_16_18: "HPV 16/18",
    HPV_OTHER: "HPV Other",
    INADEQUATE: "Inadequate",
  };
  return map[v] ?? v.replace(/_/g, " ");
}

export function BatchValidationPreview({
  cases,
  validCount,
  warningCount,
  invalidCount,
  onProcess,
  processing = false,
  onAddManual,
  onEditCase,
  onDuplicateCase,
  onDeleteCase,
}: BatchValidationPreviewProps) {
  const processableIds = useMemo(
    () => cases.filter((c) => c.validationStatus !== "invalid").map((c) => c.caseId),
    [cases]
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(processableIds));
  const allSelected = selected.size === processableIds.length && processableIds.length > 0;

  function toggleAll() { setSelected(allSelected ? new Set() : new Set(processableIds)); }
  function toggleOne(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const sourceSystem = cases[0]?.source?.sourceSystem ?? "Unknown source";
  const sourceType   = cases[0]?.source?.sourceType   ?? "demo";

  const hasRowActions = !!(onEditCase || onDuplicateCase || onDeleteCase);

  return (
    <Card>
      <CardHeader>
        {/* Title + source info */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <CardTitle>Input Dataset</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cases.length} record{cases.length !== 1 ? "s" : ""} · source:{" "}
                <strong>{sourceSystem}</strong>{" "}
                <span className="font-mono text-muted-foreground/60">({sourceType})</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="low"    size="sm">{validCount} valid</Badge>
            {warningCount > 0 && <Badge variant="high"   size="sm">{warningCount} warning{warningCount !== 1 ? "s" : ""}</Badge>}
            {invalidCount > 0 && <Badge variant="urgent" size="sm">{invalidCount} invalid</Badge>}
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between gap-3 mt-1 flex-wrap">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Select records to process through the decision engine. Invalid rows cannot be processed.
            </p>
            {onAddManual && (
              <Button
                variant="outline"
                size="xs"
                onClick={onAddManual}
                icon={<Plus className="h-3 w-3" />}
              >
                Add Test Case
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
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
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="px-4 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-border"
                    aria-label="Select all processable rows"
                  />
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Patient ID</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Age</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">HPV Result</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Cytology</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Sample</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Clinical Flags</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Source</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Issues</th>
                {hasRowActions && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap w-28">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const isInvalid  = c.validationStatus === "invalid";
                const isSelected = selected.has(c.caseId);
                const issues     = [...c.validationErrors, ...c.validationWarnings];
                const isManual   = c.source.sourceType === "manual";

                const flags: string[] = [];
                if (c.immunocompromised)          flags.push("Immunocompromised");
                if (c.isPostHysterectomy)         flags.push("Post-hysterectomy");
                if (c.isFirstTimeHPVTransition)   flags.push("HPV Transition");
                if (c.isPregnant)                 flags.push("Pregnant");
                if (c.hasAbnormalVaginalBleeding) flags.push("Abn. Bleeding");
                if (c.hasCancerSymptoms)          flags.push("Cancer Sx");
                if (c.isTestOfCure)               flags.push("Test of Cure");
                if (c.repeatStage === "SECOND_REPEAT") flags.push("2nd Repeat");

                const hpv = hpvLabel(c.hpvResult);

                return (
                  <tr
                    key={c.caseId}
                    className={cn(
                      "border-b border-border/50 transition-colors",
                      isInvalid   && "bg-red-50/30 dark:bg-red-950/10",
                      !isInvalid && isSelected && "bg-brand-50/20 dark:bg-brand-950/10"
                    )}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isInvalid}
                        onChange={() => toggleOne(c.caseId)}
                        className="rounded border-border disabled:opacity-40"
                        aria-label={`Select ${c.source.externalPatientId ?? `row ${c.source.rowNumber}`}`}
                      />
                    </td>

                    {/* Patient ID + label */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-foreground tracking-wide">
                          {c.source.externalPatientId ?? `ROW-${String(c.source.rowNumber).padStart(3, "0")}`}
                        </span>
                        {isManual && (
                          <span className="inline-flex items-center rounded bg-violet-100 dark:bg-violet-900/30 px-1 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-400">
                            manual
                          </span>
                        )}
                      </div>
                      {c.label && (
                        <div className="text-xs text-muted-foreground truncate max-w-[150px] mt-0.5" title={c.label}>
                          {c.label}
                        </div>
                      )}
                    </td>

                    {/* Age */}
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums text-xs">
                      {c.patientAge != null ? `${c.patientAge} yr` : "—"}
                    </td>

                    {/* HPV */}
                    <td className="px-3 py-2.5">
                      {hpv ? (
                        <span className={cn(
                          "text-xs font-medium",
                          c.hpvResult === "HPV_16_18"    && "text-red-600 dark:text-red-400",
                          c.hpvResult === "HPV_OTHER"    && "text-amber-700 dark:text-amber-400",
                          c.hpvResult === "NOT_DETECTED" && "text-emerald-700 dark:text-emerald-400",
                        )}>
                          {hpv}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Cytology */}
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {c.cytologyResult?.replace(/_/g, " ") ?? "—"}
                    </td>

                    {/* Sample type */}
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {c.sampleType ?? "—"}
                    </td>

                    {/* Clinical flags */}
                    <td className="px-3 py-2.5">
                      {flags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {flags.map((f) => (
                            <span key={f} className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground whitespace-nowrap">
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Source system */}
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {c.source.sourceSystem ?? c.source.sourceType}
                    </td>

                    {/* Validation status */}
                    <td className="px-3 py-2.5">
                      <Badge variant={statusBadgeVariant[c.validationStatus]} size="sm">
                        <span className="flex items-center gap-1">
                          {statusIcon[c.validationStatus]}
                          {statusLabel[c.validationStatus]}
                        </span>
                      </Badge>
                    </td>

                    {/* Issues */}
                    <td className="px-3 py-2.5">
                      {issues.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "text-xs font-medium",
                            c.validationErrors.length > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                          )}>
                            {issues.length}
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
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Row actions */}
                    {hasRowActions && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5">
                          {onEditCase && (
                            <button
                              type="button"
                              onClick={() => onEditCase(c)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Edit"
                              aria-label={`Edit ${c.source.externalPatientId ?? `row ${c.source.rowNumber}`}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onDuplicateCase && (
                            <button
                              type="button"
                              onClick={() => onDuplicateCase(c)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Duplicate"
                              aria-label={`Duplicate ${c.source.externalPatientId ?? `row ${c.source.rowNumber}`}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onDeleteCase && (
                            <button
                              type="button"
                              onClick={() => onDeleteCase(c.caseId)}
                              className="p-1 rounded text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              title="Delete"
                              aria-label={`Delete ${c.source.externalPatientId ?? `row ${c.source.rowNumber}`}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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
