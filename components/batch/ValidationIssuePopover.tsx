"use client";

/**
 * ValidationIssuePopover — click-triggered flash card showing validation
 * errors and warnings for a batch row.
 *
 * Shows: patient ID, field name (human + technical), problematic value,
 * reason, accepted values, and suggested fix.
 */

import { useState, useRef, useEffect } from "react";
import { XCircle, AlertTriangle, X, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { BATCH_COLUMNS, type ColumnDef } from "@/lib/batch/template-columns";
import type { ValidationIssue, ValidationStatus } from "@/lib/batch/types";

interface ValidationIssuePopoverProps {
  issues: ValidationIssue[];
  validationStatus: ValidationStatus;
  /** Patient ID or row label for context */
  patientId?: string;
}

// Build field → ColumnDef lookup once
const FIELD_MAP: Record<string, ColumnDef> = {};
for (const col of BATCH_COLUMNS) {
  FIELD_MAP[col.field] = col;
}

function fieldLabel(field: string): string {
  if (field === "_row") return "Row";
  if (field === "_parse") return "Parse";
  return FIELD_MAP[field]?.label ?? field;
}

/** Generate a suggested fix based on issue type and field metadata. */
function suggestedFix(issue: ValidationIssue): string | null {
  const col = FIELD_MAP[issue.field];
  if (!col) {
    if (issue.field === "_row") return "Add at least one clinical field (HPV result, cytology, or a pathway flag).";
    return null;
  }

  // Enum error → suggest accepted values
  if (col.type === "enum" && col.allowedValues && issue.severity === "error") {
    return `Use one of: ${col.allowedValues.join(", ")}`;
  }

  // Age error
  if (col.field === "patientAge" && issue.severity === "error") {
    return "Enter a number between 0 and 120.";
  }

  // Boolean coercion warning
  if (col.type === "boolean" && issue.severity === "warning") {
    return 'Use "true" / "false", "yes" / "no", or 1 / 0.';
  }

  // Unknown column
  if (issue.message.includes("Unknown column")) {
    return "Remove or rename this column to match a known field name.";
  }

  // Duplicate patient ID
  if (issue.field === "externalPatientId" && issue.message.includes("Duplicate")) {
    return "Use a unique patient identifier for each row, or leave blank.";
  }

  return null;
}

export function ValidationIssuePopover({ issues, validationStatus, patientId }: ValidationIssuePopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (issues.length === 0) {
    return <span className="text-xs text-muted-foreground">&mdash;</span>;
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors",
          "hover:bg-muted",
          errors.length > 0
            ? "text-red-600 dark:text-red-400"
            : "text-amber-600 dark:text-amber-400"
        )}
        aria-expanded={open}
        aria-label={`${issues.length} validation issue${issues.length !== 1 ? "s" : ""}`}
      >
        {issues.length}
        <Info className="h-3.5 w-3.5" />
      </button>

      {/* Popover */}
      {open && (
        <div
          className={cn(
            "absolute z-50 right-0 top-full mt-1",
            "w-[340px] max-h-96 overflow-y-auto",
            "rounded-xl border shadow-lg bg-card",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
          role="dialog"
          aria-label="Validation issues"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-card rounded-t-xl">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {issues.length} Issue{issues.length !== 1 ? "s" : ""}
                </span>
                {errors.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                    {errors.length} error{errors.length !== 1 ? "s" : ""}
                  </span>
                )}
                {warnings.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                    {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {patientId && (
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{patientId}</p>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Issue cards */}
          <div className="p-2 space-y-1.5">
            {errors.map((issue, i) => (
              <IssueCard key={`e-${i}`} issue={issue} />
            ))}
            {warnings.map((issue, i) => (
              <IssueCard key={`w-${i}`} issue={issue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue }: { issue: ValidationIssue }) {
  const isError = issue.severity === "error";
  const fix = suggestedFix(issue);
  const col = FIELD_MAP[issue.field];

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 space-y-1.5",
        isError
          ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
          : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
      )}
    >
      {/* Header: icon + field label + technical name */}
      <div className="flex items-center gap-1.5">
        {isError ? (
          <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        )}
        <span className={cn(
          "text-xs font-semibold",
          isError ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
        )}>
          {fieldLabel(issue.field)}
        </span>
        {issue.field !== "_row" && issue.field !== "_parse" && (
          <span className="font-mono text-[10px] text-muted-foreground/60 ml-auto">
            {issue.field}
          </span>
        )}
      </div>

      {/* Problematic value */}
      {issue.value !== undefined && issue.value !== null && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex-shrink-0">Value:</span>
          <code className={cn(
            "text-xs font-mono px-1.5 py-0.5 rounded truncate max-w-[200px]",
            isError
              ? "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300"
              : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
          )}>
            {String(issue.value)}
          </code>
        </div>
      )}

      {/* Reason */}
      <p className={cn(
        "text-xs leading-relaxed",
        isError ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
      )}>
        {issue.message}
      </p>

      {/* Accepted values (for enum fields with errors) */}
      {isError && col?.type === "enum" && col.allowedValues && !issue.message.includes("Allowed:") && (
        <div className="text-[10px] text-muted-foreground">
          <span className="uppercase tracking-wider">Accepted: </span>
          <span className="font-mono">{col.allowedValues.join(", ")}</span>
        </div>
      )}

      {/* Suggested fix */}
      {fix && (
        <div className={cn(
          "flex items-start gap-1.5 rounded px-2 py-1.5 text-xs",
          isError
            ? "bg-red-100/60 dark:bg-red-900/30 text-red-800 dark:text-red-300"
            : "bg-amber-100/60 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
        )}>
          <Lightbulb className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span>{fix}</span>
        </div>
      )}
    </div>
  );
}
