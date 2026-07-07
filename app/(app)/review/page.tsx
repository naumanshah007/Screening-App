import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ClipboardCheck, Inbox } from "lucide-react";

import { PageIntro } from "@/components/layout/PageIntro";
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
    <div className="page-aura p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageIntro
        eyebrow="Triage"
        title="Review Queue"
        description="Every pending case awaiting clinician confirmation across pulled intake sessions. Mandatory-review cases and urgent clinical priorities are surfaced first; open any case for the full picture."
        actions={[{ label: "View intake sessions", href: "/batch/runs", variant: "outline" as const }]}
      />

      {/* Hero counters */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Inbox className="h-3.5 w-3.5" /> Awaiting review</div>
            <div className="text-2xl font-bold text-foreground mt-0.5">{items.length}</div>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"><ShieldAlert className="h-3.5 w-3.5" /> Mandatory clinician review</div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">{mandatoryReviewCount}</div>
          </div>
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 px-4 py-3 hidden sm:block">
            <div className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400"><ShieldAlert className="h-3.5 w-3.5" /> Urgent clinical priority</div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400 mt-0.5">{urgentClinicalCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3 hidden lg:block">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><ClipboardCheck className="h-3.5 w-3.5" /> Your role</div>
            <div className="text-sm font-semibold text-foreground mt-1.5">
              {canReview ? "Can accept / reject" : "View only"}
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing waiting for review"
          description="When cases are pulled from a data source and added to the Review Queue, pending clinical decisions appear here."
          action={{ label: "Pull cases", href: "/batch", variant: "primary" }}
        />
      ) : (
        <>
          {items.length >= REVIEW_QUEUE_LIMIT && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
              Showing the first {REVIEW_QUEUE_LIMIT.toLocaleString()} pending review items. Use intake-session views for targeted review until full pagination is added.
            </div>
          )}
          <WorklistClient initialItems={items} canReview={canReview} showSource removeCompletedOnAction />
        </>
      )}

      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Looking for a specific intake session?{" "}
          <Link href="/batch/runs" className="text-brand-600 dark:text-brand-400 hover:underline">
            Browse intake sessions →
          </Link>
        </p>
      )}
    </div>
  );
}
