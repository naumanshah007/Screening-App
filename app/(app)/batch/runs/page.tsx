import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, ChevronRight, Database } from "lucide-react";

import { PageShell, PageHeader, Panel, StatusBadge } from "@/components/system";
import { EmptyState } from "@/components/ui/empty-state";
import { isFeatureEnabled } from "@/lib/features";
import { listBatchRuns } from "@/lib/batch/persistence";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  DEMO: "Demo dataset",
  CSV: "CSV upload",
  XLSX: "Excel upload",
  JSON: "JSON upload",
  MANUAL: "Manual entry",
  HL7: "HL7v2 lab feed",
  FHIR: "FHIR",
  ERMS: "eReferral / ERMS",
  HEALTH_NZ: "Health NZ",
};

export default async function BatchRunsPage() {
  if (!isFeatureEnabled("batchDemo")) {
    notFound();
  }

  const runs = await listBatchRuns();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Pull Cases"
        title="Intake Sessions"
        description="Saved case pulls feeding the Review Queue. Open an intake session to inspect prepared cases and reviewer decisions."
        actions={
          <Link
            href="/batch"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Pull cases
          </Link>
        }
      />

      {runs.length === 0 ? (
        <Panel>
        <EmptyState
          icon={ClipboardCheck}
          title="No intake sessions yet"
          description="Pull cases from a simulated source, prepare them, then add them to the Review Queue."
          action={{ label: "Pull cases", href: "/batch", variant: "primary" }}
        />
        </Panel>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const reviewed = run.acceptedCount + run.rejectedCount;
            const progress = run.totalCases > 0 ? Math.round((reviewed / run.totalCases) * 100) : 0;
            const unresolved = run.pendingCount + run.needsInfoCount;
            const complete = unresolved === 0;
            return (
              <Link
                key={run.id}
                href={`/batch/runs/${run.id}`}
                className="group block rounded-xl border border-border bg-card shadow-card transition-all hover:border-brand-200 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400">
                      <Database className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {SOURCE_LABELS[run.source] ?? run.source}
                        </span>
                        {run.sourceFileName && (
                          <span className="text-xs text-muted-foreground font-mono truncate">
                            {run.sourceFileName}
                          </span>
                        )}
                        <StatusBadge tone={complete ? "success" : "info"} size="sm">
                          {complete ? "Review complete" : `${unresolved} unresolved`}
                        </StatusBadge>
                        <StatusBadge
                          tone={run.intakeStatus === "COMPLETED" ? "success" : run.intakeStatus === "PARTIAL" ? "danger" : "warn"}
                          size="sm"
                        >
                          Intake {run.intakeStatus.toLowerCase().replaceAll("_", " ")}
                        </StatusBadge>
                        {run.reviewRequiredCount > 0 && (
                          <StatusBadge tone="warn" size="sm">
                            {run.reviewRequiredCount} mandatory clinician review
                          </StatusBadge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {run.totalCases} cases · saved {formatDateTime(run.createdAt)} by{" "}
                        {run.createdBy.name ?? run.createdBy.email} · {progress}% reviewed
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="text-success">✓ {run.acceptedCount} accepted</span>
                        <span className="text-destructive">✕ {run.rejectedCount} rejected</span>
                        <span className="text-muted-foreground">⊘ {run.needsInfoCount} needs information</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
