import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, ChevronRight, Database } from "lucide-react";

import { PageIntro } from "@/components/layout/PageIntro";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <div className="page-aura p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <PageIntro
        eyebrow="Pull Cases"
        title="Intake Sessions"
        description="Saved case pulls feeding the Review Queue. Open an intake session to inspect prepared cases and reviewer decisions."
        actions={[{ label: "Pull cases", href: "/batch", variant: "outline" as const }]}
      />

      {runs.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No intake sessions yet"
          description="Pull cases from a simulated source, prepare them, then add them to the Review Queue."
          action={{ label: "Pull cases", href: "/batch", variant: "primary" }}
        />
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const reviewed = run.acceptedCount + run.rejectedCount + run.needsInfoCount;
            const progress = run.totalCases > 0 ? Math.round((reviewed / run.totalCases) * 100) : 0;
            const complete = run.pendingCount === 0;
            return (
              <Link key={run.id} href={`/batch/runs/${run.id}`} className="block group">
                <Card className="transition-colors group-hover:border-brand-400/50">
                  <CardContent className="py-4 flex items-center gap-4">
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
                        <Badge variant={complete ? "low" : "info"} size="sm">
                          {complete ? "Review complete" : `${run.pendingCount} pending`}
                        </Badge>
                        {run.reviewRequiredCount > 0 && (
                          <Badge variant="high" size="sm">
                            {run.reviewRequiredCount} mandatory clinician review
                          </Badge>
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
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
