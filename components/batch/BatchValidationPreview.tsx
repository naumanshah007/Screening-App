"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, AlertTriangle, XCircle, Database,
  Plus, Pencil, Copy, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanonicalBatchCase } from "@/lib/batch/types";
import { ValidationIssuePopover } from "./ValidationIssuePopover";

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

/** Clinical flag chips for a case — shared by the desktop table and mobile cards. */
function rowFlags(c: CanonicalBatchCase): string[] {
  const flags: string[] = [];
  if (c.immunocompromised)          flags.push("Immunocompromised");
  if (c.isPostHysterectomy)         flags.push("Post-hysterectomy");
  if (c.isFirstTimeHPVTransition)   flags.push("HPV Transition");
  if (c.isPregnant)                 flags.push("Pregnant");
  if (c.hasAbnormalVaginalBleeding) flags.push("Abn. Bleeding");
  if (c.hasCancerSymptoms)          flags.push("Cancer Sx");
  if (c.isTestOfCure)               flags.push("Test of Cure");
  if (c.repeatStage === "SECOND_REPEAT") flags.push("2nd Repeat");
  return flags;
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
  // Stable row identity that survives revalidation (caseId is regenerated every
  // time validateBatchRows runs). We key selection by `{sourceType}::{rowNumber}`
  // so that editing a row preserves its selection — UNLESS the edit makes the
  // row invalid, in which case it is automatically deselected.
  const rowKey = (c: { source: { sourceType: string; rowNumber: number } }) =>
    `${c.source.sourceType}::${c.source.rowNumber}`;

  const caseById = useMemo(() => {
    const m = new Map<string, (typeof cases)[number]>();
    for (const c of cases) m.set(c.caseId, c);
    return m;
  }, [cases]);

  const idsByRowKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cases) m.set(rowKey(c), c.caseId);
    return m;
  }, [cases]);

  // Selection stored by stable rowKey, NOT caseId.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const c of cases) {
      if (c.validationStatus !== "invalid") initial.add(rowKey(c));
    }
    return initial;
  });

  // Reconcile selection whenever cases change:
  //  - drop keys whose row no longer exists (deleted)
  //  - drop keys whose row is now invalid (auto-deselect)
  //  - auto-select newly-added processable rows
  //  - auto-select rows that transitioned from invalid → processable (edit fix)
  const prevKeysRef = useRef<Set<string>>(new Set(idsByRowKey.keys()));
  const prevStatusByKeyRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const currentKeys = new Set(idsByRowKey.keys());
    const statusByKey = new Map<string, string>();
    for (const c of cases) statusByKey.set(rowKey(c), c.validationStatus);

    setSelectedKeys((prev) => {
      const next = new Set<string>();
      // 1. Keep previously-selected keys that still exist AND are still processable
      for (const key of prev) {
        const caseId = idsByRowKey.get(key);
        if (!caseId) continue;
        const c = caseById.get(caseId);
        if (c && c.validationStatus !== "invalid") next.add(key);
      }
      // 2. Auto-select rows that are processable and either:
      //    (a) newly added (not present in previous render), OR
      //    (b) were previously invalid and are now processable (edit fix)
      for (const key of currentKeys) {
        const caseId = idsByRowKey.get(key);
        const c = caseId ? caseById.get(caseId) : undefined;
        if (!c || c.validationStatus === "invalid") continue;

        const wasPresent = prevKeysRef.current.has(key);
        const prevStatus = prevStatusByKeyRef.current.get(key);
        const wasInvalid = prevStatus === "invalid";

        if (!wasPresent || wasInvalid) next.add(key);
      }
      return next;
    });
    prevKeysRef.current = currentKeys;
    prevStatusByKeyRef.current = statusByKey;
  }, [cases, idsByRowKey, caseById]);

  // Derive the live caseId selection from rowKey selection
  const selectedCaseIds = useMemo(() => {
    const out: string[] = [];
    for (const key of selectedKeys) {
      const id = idsByRowKey.get(key);
      if (!id) continue;
      const c = caseById.get(id);
      if (c && c.validationStatus !== "invalid") out.push(id);
    }
    return out;
  }, [selectedKeys, idsByRowKey, caseById]);

  const selectedCount = selectedCaseIds.length;
  const allSelected = selectedCount === processableIds.length && processableIds.length > 0;

  function toggleAll() {
    setSelectedKeys(() => {
      if (allSelected) return new Set();
      const all = new Set<string>();
      for (const c of cases) {
        if (c.validationStatus !== "invalid") all.add(rowKey(c));
      }
      return all;
    });
  }
  function toggleOne(c: (typeof cases)[number]) {
    const key = rowKey(c);
    setSelectedKeys((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }
  function isCaseSelected(c: (typeof cases)[number]) {
    return selectedKeys.has(rowKey(c));
  }

  const sourceSystem = cases[0]?.source?.sourceSystem ?? "Unknown source";
  const sourceType   = cases[0]?.source?.sourceType   ?? "demo";

  const hasRowActions = !!(onEditCase || onDuplicateCase || onDeleteCase);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        {/* Title + source info */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <CardTitle>Pulled Cases</CardTitle>
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

        {/* Provisional / reviewer notice */}
        <div className="mt-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 leading-snug">
          <strong>Provisional output — reviewer confirmation required.</strong>{" "}
          Selected rows generate decision-support recommendations for review.
          Not for direct clinical action.
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between gap-3 mt-1 flex-wrap">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Select records to prepare for the Review Queue. Invalid rows cannot be processed.
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
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {selectedCount} of {processableIds.length} selected
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onProcess(selectedCaseIds)}
              disabled={selectedCount === 0 || processing}
              loading={processing}
            >
              Prepare {selectedCount} for Review Queue
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* ── Desktop / tablet: full table (md+) ── */}
        <div className="hidden max-w-full overflow-x-auto overscroll-x-contain md:block">
          <table className="min-w-[980px] w-full text-sm">
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
                const isSelected = isCaseSelected(c);
                const issues     = [...c.validationErrors, ...c.validationWarnings];
                const isManual   = c.source.sourceType === "manual";

                const flags = rowFlags(c);
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
                        checked={isSelected && !isInvalid}
                        disabled={isInvalid}
                        onChange={() => toggleOne(c)}
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
                      <ValidationIssuePopover
                        issues={issues}
                        validationStatus={c.validationStatus}
                        patientId={c.source.externalPatientId ?? `ROW-${String(c.source.rowNumber).padStart(3, "0")}`}
                      />
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

        {/* ── Mobile: stacked cards (< md) ── */}
        <div className="md:hidden divide-y divide-border">
          {cases.map((c) => {
            const isInvalid  = c.validationStatus === "invalid";
            const isSelected = isCaseSelected(c);
            const issues     = [...c.validationErrors, ...c.validationWarnings];
            const isManual   = c.source.sourceType === "manual";
            const flags      = rowFlags(c);
            const hpv        = hpvLabel(c.hpvResult);
            const patientId  = c.source.externalPatientId ?? `ROW-${String(c.source.rowNumber).padStart(3, "0")}`;
            return (
              <div
                key={c.caseId}
                className={cn(
                  "p-4",
                  isInvalid && "bg-red-50/30 dark:bg-red-950/10",
                  !isInvalid && isSelected && "bg-brand-50/20 dark:bg-brand-950/10"
                )}
              >
                {/* Header: checkbox + ID + status */}
                <div className="flex items-start justify-between gap-2">
                  <label className="flex min-w-0 items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected && !isInvalid}
                      disabled={isInvalid}
                      onChange={() => toggleOne(c)}
                      className="mt-0.5 flex-shrink-0 rounded border-border disabled:opacity-40"
                      aria-label={`Select ${patientId}`}
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold tracking-wide text-foreground">{patientId}</span>
                        {isManual && (
                          <span className="inline-flex items-center rounded bg-violet-100 px-1 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">manual</span>
                        )}
                      </span>
                      {c.label && <span className="mt-0.5 block text-xs text-muted-foreground">{c.label}</span>}
                    </span>
                  </label>
                  <Badge variant={statusBadgeVariant[c.validationStatus]} size="sm">
                    <span className="flex items-center gap-1">
                      {statusIcon[c.validationStatus]}
                      {statusLabel[c.validationStatus]}
                    </span>
                  </Badge>
                </div>

                {/* Key clinical fields */}
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 pl-7 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Age</dt>
                    <dd className="font-medium tabular-nums text-foreground">{c.patientAge != null ? `${c.patientAge} yr` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">HPV</dt>
                    <dd className={cn(
                      "font-medium",
                      c.hpvResult === "HPV_16_18"    && "text-red-600 dark:text-red-400",
                      c.hpvResult === "HPV_OTHER"    && "text-amber-700 dark:text-amber-400",
                      c.hpvResult === "NOT_DETECTED" && "text-emerald-700 dark:text-emerald-400",
                      !hpv && "text-muted-foreground"
                    )}>{hpv ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Cytology</dt>
                    <dd className="font-medium text-foreground">{c.cytologyResult?.replace(/_/g, " ") ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sample</dt>
                    <dd className="font-medium text-foreground">{c.sampleType ?? "—"}</dd>
                  </div>
                </dl>

                {flags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 pl-7">
                    {flags.map((f) => (
                      <span key={f} className="inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{f}</span>
                    ))}
                  </div>
                )}

                {/* Issues + actions */}
                <div className="mt-3 flex items-center justify-between gap-2 pl-7">
                  <ValidationIssuePopover
                    issues={issues}
                    validationStatus={c.validationStatus}
                    patientId={patientId}
                  />
                  {hasRowActions && (
                    <div className="flex items-center gap-0.5">
                      {onEditCase && (
                        <button type="button" onClick={() => onEditCase(c)} className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Edit" aria-label={`Edit ${patientId}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {onDuplicateCase && (
                        <button type="button" onClick={() => onDuplicateCase(c)} className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Duplicate" aria-label={`Duplicate ${patientId}`}>
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                      {onDeleteCase && (
                        <button type="button" onClick={() => onDeleteCase(c.caseId)} className="p-1.5 rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors" title="Delete" aria-label={`Delete ${patientId}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
