import { AlertTriangle, CheckCircle2, FileSearch } from "lucide-react";

import { Panel } from "@/components/system";
import type { IntakeParseManifest } from "@/lib/batch/types";

export function BatchIntakeManifest({ manifest }: { manifest: IntakeParseManifest }) {
  const reconciles =
    manifest.sourceRecordCount ===
    manifest.parsedRecordCount + manifest.skippedRecordCount;
  const hasDiagnostics =
    manifest.errors.length > 0 ||
    manifest.warnings.length > 0 ||
    manifest.unmappedColumns.length > 0;

  return (
    <Panel className="px-4 py-4">
      <div className="flex items-start gap-3">
        <FileSearch className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">File receipt</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Every source record is retained in the intake accounting, including rows that could not be parsed.
              </p>
            </div>
            <span className={reconciles ? "inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300" : "inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300"}>
              {reconciles ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {reconciles ? "Source records reconciled" : "Reconciliation failed"}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Received", manifest.sourceRecordCount],
              ["Parsed", manifest.parsedRecordCount],
              ["Skipped", manifest.skippedRecordCount],
              ["Prepared", manifest.preparedRecordCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-foreground">{value}</dd>
              </div>
            ))}
          </dl>

          {hasDiagnostics && (
            <div className="mt-3 space-y-2 text-xs">
              {manifest.errors.map((error, index) => (
                <p key={`error-${index}`} className="text-red-700 dark:text-red-300">
                  <strong>Row {error.rowIndex + 1} parse error:</strong> {error.message}
                </p>
              ))}
              {manifest.warnings.map((warning, index) => (
                <p key={`warning-${index}`} className="text-amber-800 dark:text-amber-300">
                  <strong>Row {warning.rowIndex + 1} warning:</strong> {warning.message}
                </p>
              ))}
              {manifest.unmappedColumns.length > 0 && (
                <p className="text-amber-800 dark:text-amber-300">
                  <strong>Unmapped columns:</strong> {manifest.unmappedColumns.join(", ")}. Their values were retained in the source row but were not used for routing.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
