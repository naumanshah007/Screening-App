"use client";

/**
 * ManualCaseForm — SlideOver form for adding/editing batch test cases.
 *
 * Driven entirely by BATCH_COLUMNS from template-columns.ts (single source of truth).
 * Groups fields by category and renders the appropriate control for each type.
 *
 * When editing a row with validation issues, the problematic fields are
 * highlighted (red for errors, amber for warnings) and the form auto-scrolls
 * to the first error field.
 *
 * This is demo/testing functionality — not production clinical entry.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { SlideOver } from "@/components/ui/slide-over";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FlaskConical, Save, Plus, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BATCH_COLUMNS, type ColumnDef } from "@/lib/batch/template-columns";
import type { ParsedSourceRow, CanonicalBatchCase, ValidationIssue } from "@/lib/batch/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ManualCaseFormProps {
  open: boolean;
  onClose: () => void;
  /** If provided, pre-populates the form for editing. */
  editCase?: CanonicalBatchCase | null;
  /** Validation issues from the existing case — used to highlight error fields. */
  validationIssues?: ValidationIssue[];
  /** Called with the raw form data when user saves. */
  onSave: (row: ParsedSourceRow, editCaseId?: string) => void;
}

// ─── Group metadata ─────────────────────────────────────────────────────────

const GROUP_ORDER: Array<{ key: ColumnDef["group"]; label: string }> = [
  { key: "patient",    label: "Patient Context" },
  { key: "results",    label: "Current Test Results" },
  { key: "history",    label: "Screening History" },
  { key: "session",    label: "Session / Repeat Context" },
  { key: "pregnancy",  label: "Pregnancy" },
  { key: "bleeding",   label: "Abnormal Vaginal Bleeding" },
  { key: "colposcopy", label: "Colposcopy Findings" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract current form value for a column from a CanonicalBatchCase. */
function extractFieldValue(c: CanonicalBatchCase, field: string): string {
  const raw = (c as unknown as Record<string, unknown>)[field];
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "boolean") return raw ? "true" : "false";
  return String(raw);
}

/** Group columns by their group key. */
function groupColumns(): Map<string, ColumnDef[]> {
  const map = new Map<string, ColumnDef[]>();
  for (const col of BATCH_COLUMNS) {
    const existing = map.get(col.group) ?? [];
    existing.push(col);
    map.set(col.group, existing);
  }
  return map;
}

/** Build field-level error/warning maps from ValidationIssue[]. */
function buildIssuesMaps(issues?: ValidationIssue[]): {
  errors: Record<string, string>;
  warnings: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  if (!issues) return { errors, warnings };

  for (const issue of issues) {
    if (issue.field === "_row" || issue.field === "_parse") continue;
    if (issue.severity === "error") {
      if (!errors[issue.field]) errors[issue.field] = issue.message;
    } else {
      if (!warnings[issue.field]) warnings[issue.field] = issue.message;
    }
  }
  return { errors, warnings };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ManualCaseForm({ open, onClose, editCase, validationIssues, onSave }: ManualCaseFormProps) {
  const initialState = useMemo(() => {
    const values: Record<string, string> = {};
    if (editCase) {
      for (const col of BATCH_COLUMNS) {
        const val = extractFieldValue(editCase, col.field);
        if (val) values[col.field] = val;
      }
      if (editCase.source.externalPatientId) {
        values.externalPatientId = editCase.source.externalPatientId;
      }
    }

    const { errors, warnings } = buildIssuesMaps(validationIssues);
    return { values, errors, warnings };
  }, [editCase, validationIssues]);

  const issueKey =
    validationIssues?.map((issue) => `${issue.field}:${issue.severity}:${issue.message}`).join("|") ??
    "no-issues";
  const formKey = open ? `${editCase?.caseId ?? "new"}:${issueKey}` : "closed";

  return (
    <ManualCaseFormContent
      key={formKey}
      open={open}
      onClose={onClose}
      editCase={editCase}
      onSave={onSave}
      initialValues={initialState.values}
      initialFieldErrors={initialState.errors}
      initialFieldWarnings={initialState.warnings}
    />
  );
}

function ManualCaseFormContent({
  open,
  onClose,
  editCase,
  onSave,
  initialValues,
  initialFieldErrors,
  initialFieldWarnings,
}: {
  open: boolean;
  onClose: () => void;
  editCase?: CanonicalBatchCase | null;
  onSave: (row: ParsedSourceRow, editCaseId?: string) => void;
  initialValues: Record<string, string>;
  initialFieldErrors: Record<string, string>;
  initialFieldWarnings: Record<string, string>;
}) {
  const isEdit = !!editCase;
  const grouped = useMemo(() => groupColumns(), []);

  // Form state: field name → string value
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>(initialFieldErrors);
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>(initialFieldWarnings);

  // Auto-scroll to the first validation error after opening an edit form.
  const firstErrorField = Object.keys(initialFieldErrors)[0];
  useEffect(() => {
    if (!open || !firstErrorField) return;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(`manual-${firstErrorField}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, firstErrorField]);

  const setValue = useCallback((field: string, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear field error/warning on change
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setFieldWarnings((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // ── Client-side validation (quick checks before submission) ─────────────

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    for (const col of BATCH_COLUMNS) {
      const val = values[col.field]?.trim() ?? "";

      // Enum validation
      if (col.type === "enum" && val && col.allowedValues) {
        const upper = val.toUpperCase();
        if (!col.allowedValues.includes(upper)) {
          errors[col.field] = `Invalid value. Allowed: ${col.allowedValues.join(", ")}`;
        }
      }

      // Number validation
      if (col.type === "number" && val) {
        const n = Number(val);
        if (!Number.isFinite(n)) {
          errors[col.field] = "Must be a valid number.";
        } else if (col.field === "patientAge" && (n < 0 || n > 120)) {
          errors[col.field] = "Age must be 0–120.";
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [values]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!validate()) return;

    // Build ParsedSourceRow from form values
    const row: ParsedSourceRow = {
      _rowIndex: 0, // will be reassigned by the page
      _sourceFields: Object.keys(values).filter((k) => values[k]?.trim()),
    };

    for (const col of BATCH_COLUMNS) {
      const val = values[col.field]?.trim();
      if (!val) continue;

      if (col.type === "number") {
        row[col.field] = Number(val);
      } else if (col.type === "boolean") {
        row[col.field] = val.toLowerCase() === "true" || val === "1" || val.toLowerCase() === "yes";
      } else if (col.type === "enum") {
        row[col.field] = val.toUpperCase();
      } else {
        row[col.field] = val;
      }
    }

    onSave(row, editCase?.caseId);
    onClose();
  }, [values, validate, onSave, onClose, editCase]);

  // ── Render a single field ─────────────────────────────────────────────────

  function renderField(col: ColumnDef) {
    const val = values[col.field] ?? "";
    const error = fieldErrors[col.field];
    const warning = fieldWarnings[col.field];
    const fieldId = `manual-${col.field}`;

    if (col.type === "enum" && col.allowedValues) {
      return (
        <Select
          key={col.field}
          id={fieldId}
          label={col.label}
          value={val}
          onChange={(e) => setValue(col.field, e.target.value)}
          error={error}
          warning={warning}
          hint={col.description}
          required={col.required}
          placeholder="Select..."
          options={col.allowedValues.map((v) => ({
            value: v,
            label: v.replace(/_/g, " "),
          }))}
        />
      );
    }

    if (col.type === "boolean") {
      return (
        <Select
          key={col.field}
          id={fieldId}
          label={col.label}
          value={val}
          onChange={(e) => setValue(col.field, e.target.value)}
          error={error}
          warning={warning}
          hint={col.description}
          required={col.required}
          placeholder="Select..."
          options={[
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
        />
      );
    }

    if (col.type === "number") {
      return (
        <Input
          key={col.field}
          id={fieldId}
          type="number"
          label={col.label}
          value={val}
          onChange={(e) => setValue(col.field, e.target.value)}
          error={error}
          warning={warning}
          hint={col.description}
          required={col.required}
          min={col.field === "patientAge" ? 0 : undefined}
          max={col.field === "patientAge" ? 120 : undefined}
        />
      );
    }

    // string / date
    return (
      <Input
        key={col.field}
        id={fieldId}
        type={col.type === "date" ? "date" : "text"}
        label={col.label}
        value={val}
        onChange={(e) => setValue(col.field, e.target.value)}
        error={error}
        warning={warning}
        hint={col.description}
        required={col.required}
      />
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  const errorCount = Object.keys(fieldErrors).length;
  const warningCount = Object.keys(fieldWarnings).length;
  const hasIssues = errorCount > 0 || warningCount > 0;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Test Case" : "Add Test Case"}
      subtitle="Manual test entry — for demo and validation only."
      width="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FlaskConical className="h-3.5 w-3.5" />
            <span>Fields driven by template-columns.ts</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              icon={isEdit ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            >
              {isEdit ? "Save Changes" : "Add Case"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Warning banner */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Manual test entry &mdash; for demo and validation only.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              This row will be tagged as <span className="font-mono">sourceType: &quot;manual&quot;</span> and
              processed through the same validation and decision engine as uploaded data.
            </p>
          </div>
        </div>

        {/* Validation issues summary (when editing a row with issues) */}
        {isEdit && hasIssues && (
          <div className={cn(
            "flex items-start gap-2.5 rounded-lg border px-4 py-3",
            errorCount > 0
              ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
              : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
          )}>
            {errorCount > 0 ? (
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={cn(
                "text-xs font-medium",
                errorCount > 0 ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"
              )}>
                This row has {errorCount > 0 && <>{errorCount} validation error{errorCount !== 1 ? "s" : ""}</>}
                {errorCount > 0 && warningCount > 0 && " and "}
                {warningCount > 0 && <>{warningCount} warning{warningCount !== 1 ? "s" : ""}</>}
              </p>
              <p className={cn(
                "text-xs mt-0.5",
                errorCount > 0 ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
              )}>
                Fix the highlighted fields below. Errors will clear as you correct each value.
              </p>
            </div>
          </div>
        )}

        {/* Field groups */}
        {GROUP_ORDER.map(({ key, label }) => {
          const cols = grouped.get(key);
          if (!cols || cols.length === 0) return null;

          // Count issues in this group
          const groupErrors = cols.filter((c) => fieldErrors[c.field]).length;
          const groupWarnings = cols.filter((c) => fieldWarnings[c.field]).length;

          return (
            <div key={key} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </h3>
                {groupErrors > 0 ? (
                  <Badge variant="urgent" size="sm">
                    {groupErrors} error{groupErrors !== 1 ? "s" : ""}
                  </Badge>
                ) : groupWarnings > 0 ? (
                  <Badge variant="high" size="sm">
                    {groupWarnings} warning{groupWarnings !== 1 ? "s" : ""}
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm">
                    {cols.filter((c) => c.required).length > 0
                      ? `${cols.filter((c) => c.required).length} required`
                      : "all optional"}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {cols.map((col) => renderField(col))}
              </div>
            </div>
          );
        })}
      </div>
    </SlideOver>
  );
}
