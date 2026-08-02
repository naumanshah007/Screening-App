import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageIntro } from "@/components/layout/PageIntro";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { isFeatureEnabled } from "@/lib/features";
import {
  getBatchRunWithItems,
  reconstructBatchCaseResult,
} from "@/lib/batch/persistence";
import { formatDateTime } from "@/lib/utils";
import { WorklistClient, type WorklistItem } from "@/components/batch/WorklistClient";
import { ClinicalRuleRegradeButton } from "@/components/clinical-rules/ClinicalRuleRegradeButton";
import { resolveActiveClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";

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

export default async function BatchRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isFeatureEnabled("batchDemo")) {
    notFound();
  }

  const { id } = await params;
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const canReview = hasPermission(user?.role, "cases:grade");
  const canClinicalRegrade = hasPermission(user?.role, "rules:simulate");

  const run = await getBatchRunWithItems(id);
  if (!run) {
    notFound();
  }
  const activeClinicalVersion = await resolveActiveClinicalRuleVersion({ environment: "DEMO" });
  const versionTuple = (value?: string | null) =>
    value?.match(/(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number) ?? [0, 0, 0];
  const [activeMajor, activeMinor, activePatch] = versionTuple(activeClinicalVersion?.displayVersion);
  const [pinnedMajor, pinnedMinor, pinnedPatch] = versionTuple(run.pinnedRuleVersionDisplay);
  const activeIsNewer = activeMajor > pinnedMajor || (activeMajor === pinnedMajor && activeMinor > pinnedMinor) || (activeMajor === pinnedMajor && activeMinor === pinnedMinor && activePatch > pinnedPatch);


  const items: WorklistItem[] = run.items.map((item) => ({
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
    reviewedAt: item.reviewedAt ? formatDateTime(item.reviewedAt) : null,
    reviewNote: item.reviewNote,
    overrideReason: item.overrideReason,
    result: reconstructBatchCaseResult(item),
  }));

  return (
    <div className="page-aura p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <Link
        href="/batch/runs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All intake sessions
      </Link>

      <PageIntro
        eyebrow={SOURCE_LABELS[run.source] ?? run.source}
        title="Review Queue Intake"
        description={`${run.totalCases} pre-graded cases${
          run.sourceFileName ? ` from ${run.sourceFileName}` : ""
        } · saved ${formatDateTime(run.createdAt)}. Legacy engine ${run.engineVersion}; versioned shadow ${run.pinnedRuleVersionDisplay ?? "not configured"}${run.pinnedRulesetChecksum ? ` (${run.pinnedRulesetChecksum.slice(0, 12)}…)` : ""}. Review decisions are provisional decision-support only and require clinician confirmation.`}
      />


      {canClinicalRegrade && activeClinicalVersion && activeClinicalVersion.id !== run.pinnedRuleVersionId && (
        <ClinicalRuleRegradeButton runId={run.id} targetVersionId={activeClinicalVersion.id} targetVersionDisplay={activeClinicalVersion.displayVersion} pinnedVersionDisplay={run.pinnedRuleVersionDisplay} newer={activeIsNewer} />
      )}
      {!activeClinicalVersion && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">No governed clinical version is active in the demo environment. This run retains its original versioned-shadow pin; clinical regrading is unavailable until a validated version is published and activated.</div>
      )}
      <WorklistClient
        runId={run.id}
        initialItems={items}
        canReview={canReview}
        engineVersion={run.engineVersion}
      />
    </div>
  );
}
