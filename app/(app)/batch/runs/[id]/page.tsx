import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Database, Inbox, ClipboardCheck, ShieldAlert } from "lucide-react";

import {
  PageShell,
  PageHeader,
  HeaderMeta,
  Panel,
  StepTimeline,
  MetricTile,
  MetricGrid,
  type StepState,
} from "@/components/system";
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

  const pending = items.filter((item) => item.disposition === "PENDING").length;
  const mandatoryReview = items.filter((item) => item.reviewRequired).length;
  const reviewed = items.length - pending;

  // Run lifecycle. Every state is read from what the run actually recorded —
  // the review step only completes when no item is still pending.
  const runSteps: { id: string; label: string; state: StepState; caption?: string }[] = [
    {
      id: "pulled",
      label: "Pulled from source",
      state: "complete",
      caption: SOURCE_LABELS[run.source] ?? run.source,
    },
    {
      id: "graded",
      label: "Decision support run",
      state: "complete",
      caption: `${run.totalCases} cases · ${run.engineVersion}`,
    },
    {
      id: "queued",
      label: "Added to Review Queue",
      state: "complete",
      caption: formatDateTime(run.createdAt),
    },
    {
      id: "reviewed",
      label: "Clinician review",
      state: pending === 0 ? "complete" : "current",
      caption: pending === 0 ? "All cases actioned" : `${pending} still pending`,
    },
  ];

  return (
    <PageShell width="wide">
      <Link
        href="/batch/runs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All intake sessions
      </Link>

      <PageHeader
        eyebrow={SOURCE_LABELS[run.source] ?? run.source}
        title="Review Queue Intake"
        description={`${run.totalCases} pre-graded cases${
          run.sourceFileName ? ` from ${run.sourceFileName}` : ""
        }. Review decisions are provisional decision-support only and require clinician confirmation.`}
        meta={
          <>
            <HeaderMeta label="Saved" value={formatDateTime(run.createdAt)} />
            <HeaderMeta
              label="Legacy engine (authoritative)"
              value={<span className="font-mono">{run.engineVersion}</span>}
            />
            <HeaderMeta
              label="Versioned shadow (not authoritative)"
              value={
                <span className="font-mono">
                  {run.pinnedRuleVersionDisplay ?? "not configured"}
                </span>
              }
            />
            {run.pinnedRulesetChecksum && (
              <HeaderMeta
                label="Ruleset checksum"
                value={
                  <span className="font-mono">{run.pinnedRulesetChecksum.slice(0, 12)}…</span>
                }
              />
            )}
          </>
        }
      />

      <Panel>
        <StepTimeline steps={runSteps} />
      </Panel>

      <MetricGrid columns={4}>
        <MetricTile
          label="Cases in session"
          value={run.totalCases}
          caption="Pulled and graded together"
          icon={<Database className="h-4.5 w-4.5" />}
          tone="brand"
        />
        <MetricTile
          label="Awaiting review"
          value={pending}
          caption="No disposition recorded yet"
          icon={<Inbox className="h-4.5 w-4.5" />}
          tone={pending > 0 ? "warn" : "success"}
        />
        <MetricTile
          label="Reviewed"
          value={reviewed}
          caption="Accepted, rejected or needs information"
          icon={<ClipboardCheck className="h-4.5 w-4.5" />}
          tone="neutral"
        />
        <MetricTile
          label="Mandatory clinician review"
          value={mandatoryReview}
          caption="Safety stop or evidence gap"
          icon={<ShieldAlert className="h-4.5 w-4.5" />}
          tone={mandatoryReview > 0 ? "warn" : "neutral"}
        />
      </MetricGrid>

      {canClinicalRegrade && activeClinicalVersion && activeClinicalVersion.id !== run.pinnedRuleVersionId && (
        <ClinicalRuleRegradeButton runId={run.id} targetVersionId={activeClinicalVersion.id} targetVersionDisplay={activeClinicalVersion.displayVersion} pinnedVersionDisplay={run.pinnedRuleVersionDisplay} newer={activeIsNewer} />
      )}
      {!activeClinicalVersion && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"
        >
          No governed clinical version is active in the demo environment. This run retains its original versioned-shadow pin; clinical regrading is unavailable until a validated version is published and activated.
        </div>
      )}
      <WorklistClient
        runId={run.id}
        initialItems={items}
        canReview={canReview}
        engineVersion={run.engineVersion}
      />
    </PageShell>
  );
}
