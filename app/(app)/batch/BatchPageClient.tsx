"use client";

import { useState, useCallback } from "react";
import { PageIntro } from "@/components/layout/PageIntro";
import { BatchDemoBanner } from "@/components/batch/BatchDemoBanner";
import { BatchUploader } from "@/components/batch/BatchUploader";
import { BatchValidationPreview } from "@/components/batch/BatchValidationPreview";
import { BatchDataTable } from "@/components/batch/BatchDataTable";
import { BatchStatCards } from "@/components/batch/BatchStatCards";
import { BatchResultDetail } from "@/components/batch/BatchResultDetail";
import { RotateCcw, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  BatchCaseResult,
  BatchProcessingResult,
  ParsedSourceRow,
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

  // ── Shared: validate rows and transition to "loaded" ─────────────────────
  async function validateAndLoad(
    rows: ParsedSourceRow[],
    sourceType: "demo" | "csv" | "xlsx" | "json",
    fileName?: string
  ) {
    const { validateBatchRows } = await import("@/lib/batch/validation");
    const validation = validateBatchRows(rows, {
      sourceType,
      sourceSystem: fileName ?? (sourceType === "demo" ? "Privexa Demo Dataset" : "Upload"),
      sourceFileName: fileName,
      mappingVersion: `${sourceType}-v1`,
      engineVersion: ENGINE_VERSION,
      externalPatientId: undefined,
    });
    setState({ step: "loaded", validation });
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
        title="Batch Decision Engine"
        description="Process multiple patient cases through the cervical screening decision engine in a single automated pass."
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

      <BatchDemoBanner />

      {uploadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <strong>Upload error:</strong> {uploadError}
        </div>
      )}

      {/* ── Uploader (visible when empty or uploading) ───────────────────── */}
      {(state.step === "empty" || state.step === "uploading") && (
        <BatchUploader
          onDemoLoad={loadDemo}
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
        />
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {state.step === "results" && (
        <>
          <BatchStatCards result={state.result} />
          <BatchDataTable results={state.result.results} onViewDetail={openDetail} />
        </>
      )}

      {/* ── Detail Slide-Over ─────────────────────────────────────────────── */}
      <BatchResultDetail
        result={detailResult}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
