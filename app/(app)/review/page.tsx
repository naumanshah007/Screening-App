import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ClipboardCheck, Inbox, Siren } from "lucide-react";

import { PageShell, PageHeader, Panel, MetricTile, MetricGrid } from "@/components/system";
import { EmptyState } from "@/components/ui/empty-state";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { isFeatureEnabled } from "@/lib/features";
import { getReviewQueue, reconstructBatchCaseResult } from "@/lib/batch/persistence";
import { WorklistClient, type WorklistItem } from "@/components/batch/WorklistClient";

export const dynamic = "force-dynamic";

const REVIEW_QUEUE_LIMIT = 300;

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

function isUrgentClinicalPriority(item: { riskLevel: string; referralPriority: string | null }) {
  return item.riskLevel === "URGENT" || item.referralPriority === "P1" || item.referralPriority === "P1_HSC";
}

export default async function ReviewQueuePage() {
  if (!isFeatureEnabled("batchDemo")) {
    notFound();
  }

  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const canReview = hasPermission(user?.role, "cases:grade");

  const queue = await getReviewQueue(REVIEW_QUEUE_LIMIT);
  const mandatoryReviewCount = queue.filter((i) => i.reviewRequired).length;
  const urgentClinicalCount = queue.filter(isUrgentClinicalPriority).length;

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
    overrideReason: item.overrideReason,
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
            value={items.length}
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
            label="Your role"
            value={canReview ? "Accept / reject" : "View only"}
            caption={canReview ? "You can confirm decisions" : "You cannot action cases"}
            icon={<ClipboardCheck className="h-4.5 w-4.5" />}
            tone="neutral"
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
          {items.length >= REVIEW_QUEUE_LIMIT && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"
            >
              Showing the first {REVIEW_QUEUE_LIMIT.toLocaleString()} pending review items. Use intake-session views for targeted review until full pagination is added.
            </div>
          )}
          <WorklistClient initialItems={items} canReview={canReview} showSource removeCompletedOnAction />
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
