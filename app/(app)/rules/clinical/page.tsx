import Link from "next/link";
import { redirect } from "next/navigation";
import { GitBranch, ShieldCheck } from "lucide-react";

import { auth } from "@/lib/auth";
import { canPerformClinicalRuleAction } from "@/lib/clinical-rules/governance";
import { listClinicalRuleVersions } from "@/lib/clinical-rules/lifecycle";
import { parseSnapshot } from "@/lib/clinical-rules/schema";
import {
  PageShell,
  PageHeader,
  Panel,
  PanelInset,
  StatusBadge,
  StepTimeline,
  type BadgeTone,
  type StepState,
} from "@/components/system";
import {
  ClinicalRuleBootstrapAction,
  ClinicalRuleVersionActions,
} from "@/components/clinical-rules/ClinicalRuleVersionActions";
import { formatDateTime } from "@/lib/utils";

// Governed rule versions change through the lifecycle, not at build time.
export const dynamic = "force-dynamic";


function statusTone(status: string): BadgeTone {
  if (status === "ACTIVE") return "success";
  if (status === "VALIDATED" || status === "PUBLISHED") return "info";
  if (status === "DRAFT" || status === "VALIDATING") return "warn";
  return "neutral";
}

/**
 * The governed lifecycle, in order. A version sits at exactly one of these,
 * so the stepper reports stored status and never anticipates the next step.
 */
const LIFECYCLE = ["DRAFT", "VALIDATING", "VALIDATED", "PUBLISHED", "ACTIVE"] as const;

function lifecycleSteps(status: string): { id: string; label: string; state: StepState }[] | null {
  const index = LIFECYCLE.indexOf(status as (typeof LIFECYCLE)[number]);
  // RETIRED / ARCHIVED are terminal and off this path; showing them on the
  // ladder would imply a position in a progression they have already left.
  if (index === -1) return null;
  return LIFECYCLE.map((step, i) => ({
    id: step,
    label: step.charAt(0) + step.slice(1).toLowerCase(),
    state: i < index ? "complete" : i === index ? "current" : "upcoming",
  }));
}

export default async function ClinicalRuleVersionsPage() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!canPerformClinicalRuleAction(user?.role, "view")) redirect("/dashboard");
  const versions = await listClinicalRuleVersions();

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="National clinical logic"
        title="Versioned Clinical Rule Studio"
        description="One canonical NCSP graph per version, with synchronized master/pathway views, immutable publication, controlled demo activation, and evaluation provenance."
        actions={
          <Link
            href="/rules"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Operational booking rules
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-navy-700 p-3 text-white" aria-hidden>
              <GitBranch className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">National graph and local workflow remain separate</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">This studio governs source-derived NCSP clinical destinations. The existing Case Rule Releases continue to govern local booking priority, queue, service, and target-day overlays. A local overlay cannot silently change or relabel a national clinical branch.</p>
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-600" aria-hidden /> Safety wording
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Provisional recommendation · Reviewer confirmation required · Not for direct clinical action · Demo environment · Simulated export package</p>
        </Panel>
      </div>

      <div className="space-y-4">
        {versions.length === 0 && (
          <Panel className="space-y-4">
            <div>
              <h2 className="font-semibold text-foreground">No governed snapshot loaded</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Load the committed, checksum-verified NCSP snapshots into this
                non-Production validation database. This creates inactive drafts
                only; it does not approve, publish, or activate clinical authority.
              </p>
            </div>
            {canPerformClinicalRuleAction(user?.role, "edit") && (
              <ClinicalRuleBootstrapAction />
            )}
          </Panel>
        )}
        {versions.map((version) => {
          const snapshot = parseSnapshot(JSON.parse(version.snapshotJson));
          const validation = version.validationJson
            ? (JSON.parse(version.validationJson) as { valid?: boolean; counts?: { errors?: number } })
            : null;
          const steps = lifecycleSteps(version.status);
          return (
            <Panel key={version.id} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">{version.displayVersion}</h2>
                    <StatusBadge tone={statusTone(version.status)} dot>{version.status}</StatusBadge>
                    <StatusBadge tone="neutral">{version.ruleSet.scope}</StatusBadge>
                    {validation && (
                      <StatusBadge tone={validation.valid ? "success" : "danger"}>
                        {validation.valid ? "Validation passed" : `${validation.counts?.errors ?? 0} blockers`}
                      </StatusBadge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{version.changeSummary ?? "No change summary recorded"}</p>
                </div>
                <Link
                  href={`/rules/clinical/${version.id}`}
                  className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Open studio
                </Link>
              </div>

              {steps ? (
                <PanelInset>
                  <StepTimeline steps={steps} />
                </PanelInset>
              ) : (
                <PanelInset>
                  <p className="text-xs text-muted-foreground">
                    This version is <span className="font-medium text-foreground">{version.status}</span> and has left the publication lifecycle.
                  </p>
                </PanelInset>
              )}

              <div className="space-y-5">
                <div className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <div><div className="text-muted-foreground">Rules / graph</div><div className="mt-1 font-semibold">{snapshot.rules.length} / {snapshot.nodes.length} nodes</div></div>
                  <div><div className="text-muted-foreground">Views</div><div className="mt-1 font-semibold">{snapshot.views.length} synchronized</div></div>
                  <div><div className="text-muted-foreground">Clinical sources</div><div className="mt-1 font-semibold">v{version.sourcePackageVersion ?? "—"}</div></div>
                  <div><div className="text-muted-foreground">Parent</div><div className="mt-1 font-semibold">{version.parentVersion?.displayVersion ?? "Initial import"}</div></div>
                  <div><div className="text-muted-foreground">Evaluations</div><div className="mt-1 font-semibold">{version._count.evaluations}</div></div>
                  <div><div className="text-muted-foreground">Created by</div><div className="mt-1 font-semibold">{version.createdBy?.name ?? version.createdBy?.email ?? "System import"}</div></div>
                  <div><div className="text-muted-foreground">Approved by</div><div className="mt-1 font-semibold">{version.approvedBy?.name ?? version.approvedBy?.email ?? "Not approved"}</div></div>
                  <div><div className="text-muted-foreground">Classification</div><div className="mt-1 font-semibold">{version.changeClassification.replace(/_/g, " ")}</div></div>
                  <div className="sm:col-span-2"><div className="text-muted-foreground">Active environments</div><div className="mt-1 font-semibold">{version.activations.filter((activation) => !activation.deactivatedAt).map((activation) => `${activation.environment}${activation.organisationKey ? ` · ${activation.organisationKey}` : " · global"}`).join(", ") || "Not active"}</div></div>
                  <div className="sm:col-span-2"><div className="text-muted-foreground">Source summary</div><div className="mt-1 font-semibold">{version.sourceGuidelineSummary}</div></div>
                  <div className="sm:col-span-2 xl:col-span-4"><div className="text-muted-foreground">Checksum</div><div className="mt-1 break-all font-mono text-xs">{version.checksum ?? "Not calculated"}</div></div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="text-xs text-muted-foreground">Created {formatDateTime(version.createdAt)}{version.publishedAt ? ` · Published ${formatDateTime(version.publishedAt)}` : ""}</div>
                  <ClinicalRuleVersionActions
                    id={version.id}
                    status={version.status}
                    sourceSummary={version.sourceGuidelineSummary}
                    canEdit={canPerformClinicalRuleAction(user?.role, "edit")}
                    canValidate={canPerformClinicalRuleAction(user?.role, "validate")}
                    canApprove={canPerformClinicalRuleAction(user?.role, "approve")}
                    canPublish={canPerformClinicalRuleAction(user?.role, "publish")}
                    canActivate={canPerformClinicalRuleAction(user?.role, "activate")}
                    canRollback={canPerformClinicalRuleAction(user?.role, "rollback")}
                    canExport={canPerformClinicalRuleAction(user?.role, "export")}
                  />
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </PageShell>
  );
}
