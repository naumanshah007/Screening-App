import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ClipboardCheck, Inbox, Siren, HelpCircle } from "lucide-react";

import { PageShell, PageHeader, Panel, MetricTile, MetricGrid } from "@/components/system";
import { EmptyState } from "@/components/ui/empty-state";
import { getServerSession } from "@/lib/auth/server-session";
import { hasPermission } from "@/lib/auth/permissions";
import { isFeatureEnabled } from "@/lib/features";
import {
  getReviewQueuePage,
  reconstructBatchCaseResult,
} from "@/lib/batch/persistence";
import { WorklistClient, type WorklistItem } from "@/components/batch/WorklistClient";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const REVIEW_QUEUE_PAGE_SIZE = 50;

const SOURCE_LABELS: Record<string, string> = {
  DEMO: "Demo dataset",
  CSV: "CSV upload",
  XLSX: "Excel upload",
  JSON: "JSON upload",
  MANUAL: "Manual entry",
  HL7: "Awanui Labs (HL7v2)",
  FHIR: "FHIR",
  ERMS: "CM eReferrals",
  HEALTH_NZ: "NCSR",
};

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!isFeatureEnabled("batchDemo")) {
    notFound();
  }

  const session = await getServerSession();
  const user = session?.user as { role?: string } | undefined;
  const canReview = hasPermission(user?.role, "cases:grade");
  const canManageInformation =
    hasPermission(user?.role, "cases:edit") || hasPermission(user?.role, "cases:grade");

  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const snapshot = await getReviewQueuePage({
    page: Number.isSafeInteger(requestedPage) ? requestedPage : 1,
    pageSize: REVIEW_QUEUE_PAGE_SIZE,
  });
  if (snapshot.total > 0 && snapshot.page > snapshot.totalPages) {
    redirect(`/review?page=${snapshot.totalPages}`);
  }
  const queue = snapshot.items;
  const mandatoryReviewCount = snapshot.mandatoryReview;
  const urgentClinicalCount = snapshot.urgentClinical;

  const items: WorklistItem[] = queue.map((item) => ({
    id: item.id,
    rowNumber: item.rowNumber,
    label: item.label,
    externalPatientId: item.externalPatientId,
    patientName: item.patientName,
    nhi: item.nhi,
    gpPractice: item.gpPractice,
    receivedDate: item.receivedDate
      ? new Date(item.receivedDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
      : null,
    patientAge: item.patientAge,
    ethnicityPrimary: item.ethnicityPrimary,
    figure: item.figure,
    riskLevel: item.riskLevel,
    recommendationCode: item.recommendationCode,
    recommendation: item.recommendation,
    referralPriority: item.referralPriority,
    safetyOutcome: item.safetyOutcome,
    reviewRequired: item.reviewRequired,
    engineStatus: item.engineStatus,
    disposition: item.disposition,
    reviewedByName: item.reviewedBy?.name ?? item.reviewedBy?.email ?? null,
    reviewedAt: null,
    reviewNote: item.reviewNote,
    supersededAt: item.supersededAt?.toISOString() ?? null,
    overrideReason: item.overrideReason,
    informationOwnerName: item.informationOwnerName,
    informationRequestedAt: item.informationRequestedAt
      ? formatDateTime(item.informationRequestedAt)
      : null,
    informationReceivedAt: item.informationReceivedAt
      ? formatDateTime(item.informationReceivedAt)
      : null,
    informationResolutionNote: item.informationResolutionNote,
    result: reconstructBatchCaseResult(item),
    sourceSystem: item.batchRun.sourceSystem ?? SOURCE_LABELS[item.batchRun.source] ?? item.batchRun.source,
    runId: item.batchRunId,
  }));

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Triage"
        title="Review Queue"
        description="Every pending case awaiting clinician confirmation across pulled intake sessions. Mandatory-review cases and urgent clinical priorities are surfaced first; open any case for the full picture."
        actions={
          <Link
            href="/batch/runs"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            View intake sessions
          </Link>
        }
      />

      {/* Summary strip. Every figure is a count of the queue actually loaded —
          no series is passed, because the queue has no stored daily history. */}
      {items.length > 0 && (
        <MetricGrid columns={4}>
          <MetricTile
            label="Awaiting review"
            value={snapshot.pending}
            caption="Pending clinician confirmation"
            icon={<Inbox className="h-4.5 w-4.5" />}
            tone="brand"
          />
          <MetricTile
            label="Mandatory clinician review"
            value={mandatoryReviewCount}
            caption="Safety stop or evidence gap"
            icon={<ShieldAlert className="h-4.5 w-4.5" />}
            tone="warn"
          />
          <MetricTile
            label="Urgent clinical priority"
            value={urgentClinicalCount}
            caption="Urgent risk or P1 priority"
            icon={<Siren className="h-4.5 w-4.5" />}
            tone="danger"
          />
          <MetricTile
            label="Awaiting information"
            value={snapshot.awaitingInformation}
            caption="Owned follow-up work · not completed"
            icon={<HelpCircle className="h-4.5 w-4.5" />}
            tone={snapshot.awaitingInformation > 0 ? "warn" : "neutral"}
          />
        </MetricGrid>
      )}

      {items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing waiting for review"
            description="When cases are pulled from a data source and added to the Review Queue, pending clinical decisions appear here."
            action={{ label: "Pull cases", href: "/batch", variant: "primary" }}
          />
        </Panel>
      ) : (
        <>
          {snapshot.total > snapshot.items.length && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"
            >
              Showing {((snapshot.page - 1) * snapshot.pageSize + 1).toLocaleString()}–{Math.min(snapshot.page * snapshot.pageSize, snapshot.total).toLocaleString()} of {snapshot.total.toLocaleString()} active queue items.
            </div>
          )}
          <WorklistClient
            initialItems={items}
            canReview={canReview}
            canManageInformation={canManageInformation}
            showSource
            removeCompletedOnAction
          />
          {snapshot.totalPages > 1 && (
            <nav className="flex items-center justify-between gap-3" aria-label="Review Queue pages">
              {snapshot.page > 1 ? (
                <Link className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted" href={`/review?page=${snapshot.page - 1}`}>
                  Previous page
                </Link>
              ) : <span />}
              <span className="text-sm text-muted-foreground">
                Page {snapshot.page} of {snapshot.totalPages}
              </span>
              {snapshot.page < snapshot.totalPages ? (
                <Link className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted" href={`/review?page=${snapshot.page + 1}`}>
                  Next page
                </Link>
              ) : <span />}
            </nav>
          )}
        </>
      )}

      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Looking for a specific intake session?{" "}
          <Link href="/batch/runs" className="text-brand-600 hover:underline dark:text-brand-400">
            Browse intake sessions →
          </Link>
        </p>
      )}
    </PageShell>
  );
}
