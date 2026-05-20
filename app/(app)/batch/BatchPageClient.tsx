"use client";

import { useState, useCallback } from "react";
import { PageIntro } from "@/components/layout/PageIntro";
import { BatchEngineTrustPanel } from "@/components/batch/BatchEngineTrustPanel";
import { BatchUploader } from "@/components/batch/BatchUploader";
import { BatchValidationPreview } from "@/components/batch/BatchValidationPreview";
import { BatchDataTable } from "@/components/batch/BatchDataTable";
import { BatchStatCards } from "@/components/batch/BatchStatCards";
import { BatchActionQueue } from "@/components/batch/BatchActionQueue";
import { BatchEquityCard } from "@/components/batch/BatchEquityCard";
import { BatchResultDetail } from "@/components/batch/BatchResultDetail";
import { ManualCaseForm } from "@/components/batch/ManualCaseForm";
import { IntegrationReadinessPanel } from "@/components/batch/IntegrationReadinessPanel";
import { RotateCcw, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  BatchCaseResult,
  BatchProcessingResult,
  ParsedSourceRow,
  CanonicalBatchCase,
} from "@/lib/batch/types";
import type { BatchValidationResult } from "@/lib/batch/validation";

// ─── Page States ─────────────────────────────────────────────────────────────
type PageState =
  | { step: "empty" }
  | { step: "uploading" }                                        // reading/parsing file
  | { step: "loaded"; validation: BatchValidationResult }
  | { step: "processing"; validation: BatchValidationResult }
  | { step: "results"; validation: BatchValidationResult; result: BatchProcessingResult };

const ENGINE_VERSION = "business-figures-table1-v1";

export function BatchPageClient() {
  const [state, setState] = useState<PageState>({ step: "empty" });
  const [detailResult, setDetailResult] = useState<BatchCaseResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // ── Manual case form state ──────────────────────────────────────────────
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<CanonicalBatchCase | null>(null);
  // Tracks manually injected rows alongside uploaded data. Keys: validation result snapshots
  // are rebuilt by re-running validateBatchRows when rows change.
  const [manualRows, setManualRows] = useState<ParsedSourceRow[]>([]);
  // Track the "base" uploaded rows separately from manual additions
  const [baseRows, setBaseRows] = useState<ParsedSourceRow[]>([]);
  const [baseSourceMeta, setBaseSourceMeta] = useState<{
    sourceType: "demo" | "csv" | "xlsx" | "json";
    sourceSystem: string;
    sourceFileName?: string;
  } | null>(null);

  // ── Revalidate all rows (base + manual) ─────────────────────────────────
  async function revalidateAll(
    base: ParsedSourceRow[],
    manual: ParsedSourceRow[],
    meta: { sourceType: "demo" | "csv" | "xlsx" | "json"; sourceSystem: string; sourceFileName?: string }
  ) {
    const { validateBatchRows } = await import("@/lib/batch/validation");

    // Validate base rows
    const baseValidation = base.length > 0
      ? validateBatchRows(base, {
          sourceType: meta.sourceType,
          sourceSystem: meta.sourceSystem,
          sourceFileName: meta.sourceFileName,
          mappingVersion: `${meta.sourceType}-v1`,
          engineVersion: ENGINE_VERSION,
          externalPatientId: undefined,
        })
      : { cases: [], totalRows: 0, validCount: 0, warningCount: 0, invalidCount: 0 };

    // Validate manual rows
    const manualValidation = manual.length > 0
      ? validateBatchRows(manual, {
          sourceType: "manual",
          sourceSystem: "Manual test entry",
          mappingVersion: "manual-v1",
          engineVersion: ENGINE_VERSION,
          externalPatientId: undefined,
        })
      : { cases: [], totalRows: 0, validCount: 0, warningCount: 0, invalidCount: 0 };

    // Merge results
    const merged: import("@/lib/batch/validation").BatchValidationResult = {
      cases: [...baseValidation.cases, ...manualValidation.cases],
      totalRows: baseValidation.totalRows + manualValidation.totalRows,
      validCount: baseValidation.validCount + manualValidation.validCount,
      warningCount: baseValidation.warningCount + manualValidation.warningCount,
      invalidCount: baseValidation.invalidCount + manualValidation.invalidCount,
    };

    setState({ step: "loaded", validation: merged });
  }

  // ── Shared: validate rows and transition to "loaded" ─────────────────────
  async function validateAndLoad(
    rows: ParsedSourceRow[],
    sourceType: "demo" | "csv" | "xlsx" | "json",
    fileName?: string
  ) {
    const meta = {
      sourceType,
      sourceSystem: fileName ?? (sourceType === "demo" ? "Privexa Demo Dataset" : "Upload"),
      sourceFileName: fileName,
    };
    setBaseRows(rows);
    setBaseSourceMeta(meta);
    // Reset manual rows on new upload
    setManualRows([]);
    await revalidateAll(rows, [], meta);
  }

  // ── Load demo dataset ─────────────────────────────────────────────────────
  const loadDemo = useCallback(async () => {
    setState({ step: "uploading" });
    setUploadError("");
    try {
      const { DEMO_DATASET } = await import("@/lib/batch/demo-dataset");
      const { BATCH_COLUMNS } = await import("@/lib/batch/template-columns");
      const allFields = BATCH_COLUMNS.map((c) => c.field);

      const rows: ParsedSourceRow[] = DEMO_DATASET.map((demoCase, index) => {
        const row: ParsedSourceRow = { _rowIndex: index, _sourceFields: allFields };
        for (const col of BATCH_COLUMNS) {
          const value = (demoCase as unknown as Record<string, unknown>)[col.field];
          if (value !== undefined && value !== null) row[col.field] = value;
        }
        row.label = demoCase.label;
        row.externalPatientId = demoCase.source.externalPatientId;
        return row;
      });

      await validateAndLoad(rows, "demo");
    } catch (err) {
      console.error("Failed to load demo dataset:", err);
      setUploadError("Failed to load demo dataset.");
      setState({ step: "empty" });
    }
  }, []);

  // ── Load messy "real-world" demo dataset ─────────────────────────────────
  const loadMessyDemo = useCallback(async () => {
    setState({ step: "uploading" });
    setUploadError("");
    try {
      const { buildMessyDataset } = await import("@/lib/batch/demo-dataset-messy");
      const rows = buildMessyDataset();
      const meta = {
        sourceType: "demo" as const,
        sourceSystem: "Mock Lab Feed — Auckland LIS",
        sourceFileName: "real-world-sample",
      };
      setBaseRows(rows);
      setBaseSourceMeta(meta);
      setManualRows([]);

      const { validateBatchRows } = await import("@/lib/batch/validation");
      const validation = validateBatchRows(rows, {
        sourceType: "demo",
        sourceSystem: "Mock Lab Feed — Auckland LIS",
        sourceFileName: "real-world-sample",
        mappingVersion: "demo-messy-v1",
        engineVersion: ENGINE_VERSION,
        externalPatientId: undefined,
      });
      setState({ step: "loaded", validation });
    } catch (err) {
      console.error("Failed to load messy demo dataset:", err);
      setUploadError("Failed to load real-world sample.");
      setState({ step: "empty" });
    }
  }, []);

  // ── Upload a file ─────────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    setState({ step: "uploading" });
    setUploadError("");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let rows: ParsedSourceRow[];

      if (ext === "csv") {
        const text = await file.text();
        const { CSVUploadAdapter } = await import("@/lib/batch/adapters/csv-adapter");
        const adapter = new CSVUploadAdapter();
        const parsed = await adapter.parse(text, file.name);
        rows = parsed.rows;
        if (parsed.errors.length > 0 && rows.length === 0) {
          throw new Error(parsed.errors.map((e) => e.message).join("; "));
        }
        await validateAndLoad(rows, "csv", file.name);
      } else if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const { ExcelUploadAdapter } = await import("@/lib/batch/adapters/xlsx-adapter");
        const adapter = new ExcelUploadAdapter();
        const parsed = await adapter.parse(buffer, file.name);
        rows = parsed.rows;
        if (parsed.errors.length > 0 && rows.length === 0) {
          throw new Error(parsed.errors.map((e) => e.message).join("; "));
        }
        await validateAndLoad(rows, "xlsx", file.name);
      } else if (ext === "json") {
        const text = await file.text();
        const { JSONUploadAdapter } = await import("@/lib/batch/adapters/json-adapter");
        const adapter = new JSONUploadAdapter();
        const parsed = await adapter.parse(text, file.name);
        rows = parsed.rows;
        if (parsed.errors.length > 0 && rows.length === 0) {
          throw new Error(parsed.errors.map((e) => e.message).join("; "));
        }
        await validateAndLoad(rows, "json", file.name);
      } else {
        throw new Error(`Unsupported file type: .${ext}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error reading file.";
      setUploadError(msg);
      setState({ step: "empty" });
    }
  }, []);

  // ── Manual case: Add / Edit / Duplicate / Delete ──────────────────────────

  const handleOpenAddManual = useCallback(() => {
    setEditingCase(null);
    setManualFormOpen(true);
  }, []);

  const handleEditCase = useCallback((batchCase: CanonicalBatchCase) => {
    setEditingCase(batchCase);
    setManualFormOpen(true);
  }, []);

  const handleDuplicateCase = useCallback(async (batchCase: CanonicalBatchCase) => {
    // Create a new ParsedSourceRow from the case's fields
    const { BATCH_COLUMNS } = await import("@/lib/batch/template-columns");
    const row: ParsedSourceRow = {
      _rowIndex: baseRows.length + manualRows.length,
      _sourceFields: [],
    };

    for (const col of BATCH_COLUMNS) {
      const val = (batchCase as unknown as Record<string, unknown>)[col.field];
      if (val !== undefined && val !== null && val !== "") {
        row[col.field] = val;
        row._sourceFields.push(col.field);
      }
    }
    // Clear the patient ID so it gets a new one
    delete row.externalPatientId;
    row._sourceFields = row._sourceFields.filter((f) => f !== "externalPatientId");

    // Duplicate label with "(copy)" suffix
    if (batchCase.label) {
      row.label = `${batchCase.label} (copy)`;
    }

    const newManual = [...manualRows, row];
    setManualRows(newManual);
    if (baseSourceMeta) {
      await revalidateAll(baseRows, newManual, baseSourceMeta);
    }
  }, [baseRows, manualRows, baseSourceMeta]);

  const handleDeleteCase = useCallback(async (caseId: string) => {
    if (state.step !== "loaded" && state.step !== "processing") return;
    const validation = state.validation;

    // Find the case to delete
    const targetCase = validation.cases.find((c) => c.caseId === caseId);
    if (!targetCase) return;

    if (targetCase.source.sourceType === "manual") {
      // Remove from manual rows by matching row number (rowNumber is 1-based)
      const manualIndex = targetCase.source.rowNumber - 1;
      const newManual = manualRows.filter((_, i) => i !== manualIndex);
      setManualRows(newManual);
      if (baseSourceMeta) {
        await revalidateAll(baseRows, newManual, baseSourceMeta);
      }
    } else {
      // Remove from base rows by matching row index
      const baseIndex = targetCase.source.rowNumber - 1;
      const newBase = baseRows.filter((_, i) => i !== baseIndex);
      setBaseRows(newBase);
      if (baseSourceMeta) {
        await revalidateAll(newBase, manualRows, baseSourceMeta);
      }
    }
  }, [state, baseRows, manualRows, baseSourceMeta]);

  const handleSaveManualCase = useCallback(async (row: ParsedSourceRow, editCaseId?: string) => {
    if (editCaseId && state.step === "loaded") {
      // Editing an existing case — find which list it belongs to
      const targetCase = state.validation.cases.find((c) => c.caseId === editCaseId);
      if (targetCase?.source.sourceType === "manual") {
        // Replace in manual rows
        const manualIndex = targetCase.source.rowNumber - 1;
        const newManual = [...manualRows];
        row._rowIndex = manualIndex;
        newManual[manualIndex] = row;
        setManualRows(newManual);
        if (baseSourceMeta) {
          await revalidateAll(baseRows, newManual, baseSourceMeta);
        }
      } else if (targetCase) {
        // Editing a base row — replace in base rows
        const baseIndex = targetCase.source.rowNumber - 1;
        const newBase = [...baseRows];
        row._rowIndex = baseIndex;
        newBase[baseIndex] = row;
        setBaseRows(newBase);
        if (baseSourceMeta) {
          await revalidateAll(newBase, manualRows, baseSourceMeta);
        }
      }
    } else {
      // Adding a new manual row
      row._rowIndex = manualRows.length;
      const newManual = [...manualRows, row];
      setManualRows(newManual);

      if (baseSourceMeta) {
        await revalidateAll(baseRows, newManual, baseSourceMeta);
      } else {
        // No base data yet — create a "manual-only" dataset
        const meta = {
          sourceType: "demo" as const,
          sourceSystem: "Manual test entry",
          sourceFileName: undefined,
        };
        setBaseSourceMeta(meta);
        await revalidateAll([], newManual, meta);
      }
    }
  }, [state, baseRows, manualRows, baseSourceMeta]);

  // ── Process selected rows ─────────────────────────────────────────────────
  const processRows = useCallback(
    async (selectedCaseIds: string[]) => {
      if (state.step !== "loaded") return;
      const validation = state.validation;
      setState({ step: "processing", validation });

      const selectedCases = validation.cases.filter((c) => selectedCaseIds.includes(c.caseId));

      try {
        const res = await fetch("/api/batch/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cases: selectedCases, includeWarnings: true, includeInvalid: false }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const result: BatchProcessingResult = await res.json();
        setState({ step: "results", validation, result });
      } catch (err) {
        console.error("Batch processing failed:", err);
        setState({ step: "loaded", validation });
      }
    },
    [state]
  );

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setState({ step: "empty" });
    setDetailResult(null);
    setDetailOpen(false);
    setUploadError("");
    setManualRows([]);
    setBaseRows([]);
    setBaseSourceMeta(null);
    setManualFormOpen(false);
    setEditingCase(null);
  }, []);

  const openDetail = useCallback((result: BatchCaseResult) => {
    setDetailResult(result);
    setDetailOpen(true);
  }, []);

  const isUploading = state.step === "uploading";

  // Pipeline step index: 0-based
  const pipelineStep =
    state.step === "empty" || state.step === "uploading" ? 0
    : state.step === "loaded" || state.step === "processing" ? 1
    : 2; // results

  const PIPELINE_STEPS = [
    { label: "Upload Dataset", desc: "CSV, Excel, or JSON" },
    { label: "Validate & Select", desc: "Review records" },
    { label: "Process", desc: "Run decision engine" },
    { label: "Results", desc: "Batch outcomes" },
  ] as const;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageIntro
        eyebrow="Batch Processing"
        title="Batch Decision Support"
        description="Generate provisional, guideline-aligned recommendations for multiple cases at once. Outputs are decision-support only — reviewer confirmation is required before any clinical action."
        actions={
          state.step !== "empty" && state.step !== "uploading"
            ? [{ label: "Reset", onClick: reset, variant: "outline" as const, icon: <RotateCcw className="h-4 w-4" /> }]
            : []
        }
      />

      {/* Pipeline flow indicator */}
      <div className="flex items-center gap-1 flex-wrap">
        {PIPELINE_STEPS.map((s, i) => {
          const done    = i < pipelineStep || (i === 2 && state.step === "results");
          const active  = i === pipelineStep && !(i === 2 && state.step === "results");
          const isLast  = i === PIPELINE_STEPS.length - 1;
          return (
            <div key={s.label} className="flex items-center gap-1">
              <div className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                done   && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                active && "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400 ring-1 ring-brand-400/40",
                !done && !active && "text-muted-foreground"
              )}>
                {done
                  ? <CheckCircle2 className="h-3 w-3" />
                  : <span className={cn(
                      "h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold border",
                      active ? "border-brand-500 text-brand-600" : "border-muted-foreground/30 text-muted-foreground/50"
                    )}>{i + 1}</span>
                }
                {s.label}
              </div>
              {!isLast && <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      <BatchEngineTrustPanel />

      {uploadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <strong>Upload error:</strong> {uploadError}
        </div>
      )}

      {/* ── Uploader (visible when empty or uploading) ───────────────────── */}
      {(state.step === "empty" || state.step === "uploading") && (
        <BatchUploader
          onDemoLoad={loadDemo}
          onMessyDemoLoad={loadMessyDemo}
          onFileLoad={loadFile}
          loading={isUploading}
        />
      )}

      {/* ── Validation Preview ────────────────────────────────────────────── */}
      {(state.step === "loaded" || state.step === "processing") && (
        <BatchValidationPreview
          cases={state.validation.cases}
          validCount={state.validation.validCount}
          warningCount={state.validation.warningCount}
          invalidCount={state.validation.invalidCount}
          onProcess={processRows}
          processing={state.step === "processing"}
          onAddManual={handleOpenAddManual}
          onEditCase={handleEditCase}
          onDuplicateCase={handleDuplicateCase}
          onDeleteCase={handleDeleteCase}
        />
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {state.step === "results" && (
        <>
          <BatchActionQueue results={state.result.results} onViewDetail={openDetail} />
          <BatchStatCards result={state.result} />
          <BatchEquityCard results={state.result.results} />
          <BatchDataTable results={state.result.results} onViewDetail={openDetail} />
        </>
      )}

      {/* ── Integration Readiness (visible on upload screen and after results) */}
      {(state.step === "empty" || state.step === "uploading" || state.step === "results") && (
        <IntegrationReadinessPanel />
      )}

      {/* ── Detail Slide-Over ─────────────────────────────────────────────── */}
      <BatchResultDetail
        result={detailResult}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      {/* ── Manual Case Form ──────────────────────────────────────────────── */}
      <ManualCaseForm
        open={manualFormOpen}
        onClose={() => { setManualFormOpen(false); setEditingCase(null); }}
        editCase={editingCase}
        validationIssues={
          editingCase
            ? [...(editingCase.validationErrors ?? []), ...(editingCase.validationWarnings ?? [])]
            : undefined
        }
        onSave={handleSaveManualCase}
      />
    </div>
  );
}
