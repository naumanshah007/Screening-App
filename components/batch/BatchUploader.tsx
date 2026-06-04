"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Upload, Download, FileText, FileSpreadsheet, AlertTriangle, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

interface BatchUploaderProps {
  onDemoLoad: () => void;
  onMessyDemoLoad?: () => void;
  onFileLoad: (file: File) => void;
  loading?: boolean;
}

const ACCEPTED_TYPES = [".csv", ".xlsx", ".xls", ".json"];
const ACCEPTED_MIME = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/json",
  "text/plain",
];

function FileIcon({ ext }: { ext: string }) {
  if (ext === "xlsx" || ext === "xls") return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
  if (ext === "csv") return <FileText className="h-5 w-5 text-blue-600" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

export function BatchUploader({ onDemoLoad, onMessyDemoLoad, onFileLoad, loading = false }: BatchUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");

  function validateAndLoad(file: File) {
    setFileError("");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ACCEPTED_TYPES.includes(`.${ext}`)) {
      setFileError(`Unsupported file type ".${ext}". Please upload CSV, XLSX, or JSON.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError("File too large (max 10 MB).");
      return;
    }
    onFileLoad(file);
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndLoad(file);
    },
    [onFileLoad]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndLoad(file);
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [onFileLoad]
  );

  return (
    <Card>
      <CardContent className="py-8 space-y-6">
        {/* Demo buttons — clean + messy */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Database className="h-4 w-4 text-brand-600" />
              Clean Demo Dataset
            </div>
            <p className="text-xs text-muted-foreground flex-1">
              14 de-identified records covering all major cervical screening pathways.
              All rows valid — ideal for the happy-path walkthrough.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={onDemoLoad}
              loading={loading}
              disabled={loading}
              icon={<Database className="h-4 w-4" />}
              className="self-start"
            >
              Load Clean Demo
            </Button>
          </div>

          {onMessyDemoLoad && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Real-world Sample (Mock Lab Feed)
              </div>
              <p className="text-xs text-muted-foreground flex-1">
                14 records with realistic data-quality issues — bad enums, missing NHI, mixed case,
                duplicates, partial rows. Demonstrates validation handling.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onMessyDemoLoad}
                loading={loading}
                disabled={loading}
                icon={<FlaskConical className="h-4 w-4" />}
                className="self-start"
              >
                Load Messy Sample
              </Button>
            </div>
          )}
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground bg-card px-2">or upload your own file</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "relative rounded-xl border-2 border-dashed transition-all duration-150 cursor-pointer",
            "flex flex-col items-center justify-center gap-3 py-10 px-6 text-center",
            dragging
              ? "border-brand-500 bg-brand-50/40 dark:bg-brand-950/20"
              : "border-border hover:border-border-strong hover:bg-muted/30"
          )}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          aria-label="Upload file — click or drag and drop"
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={onInputChange}
            className="hidden"
            aria-hidden
          />
          <div className={cn(
            "p-3 rounded-xl transition-colors",
            dragging ? "bg-brand-100 dark:bg-brand-900/40" : "bg-muted"
          )}>
            <Upload className={cn("h-6 w-6", dragging ? "text-brand-600" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {dragging ? "Drop to upload" : "Click to browse or drag & drop"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              CSV, Excel (.xlsx), or JSON · Max 10 MB
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {[
              { ext: "csv", label: "CSV" },
              { ext: "xlsx", label: "Excel" },
              { ext: "json", label: "JSON" },
            ].map(({ ext, label }) => (
              <span key={ext} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-md px-2 py-1">
                <FileIcon ext={ext} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {fileError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{fileError}</p>
          </div>
        )}

        {/* Download template */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-1 text-center">
          <span className="text-xs text-muted-foreground">Don't have data? Download a template:</span>
          <div className="flex items-center gap-2">
            <a
              href="/templates/batch-upload-template.xlsx"
              download
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-400 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Excel (.xlsx)
            </a>
            <span className="text-muted-foreground/40">·</span>
            <a
              href="/templates/batch-upload-template.csv"
              download
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-400 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
