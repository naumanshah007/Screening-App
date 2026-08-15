import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { getServerSession } from "@/lib/auth/server-session";
import { canPerformClinicalRuleAction } from "@/lib/clinical-rules/governance";
import { getClinicalRuleVersionSnapshot } from "@/lib/clinical-rules/lifecycle";
import { CLINICAL_GOVERNANCE_CASES } from "@/lib/clinical-rules/governance-review";
import {
  ACTIVATION_GATE_DEFINITIONS,
  getActivationGateStates,
  ROLLBACK_THRESHOLD_CANDIDATES,
} from "@/lib/clinical-rules/activation-governance";
import { NATIONAL_RULE_SET_KEY } from "@/lib/clinical-rules/constants";
import { getCurrentGovernedRuleset } from "@/lib/clinical-rules/current-ruleset";
import { prisma } from "@/lib/prisma";
import { ClinicalGovernanceReviewWorkspace } from "@/components/clinical-rules/ClinicalGovernanceReviewWorkspace";
import { ActivationGovernancePanel } from "@/components/clinical-rules/ActivationGovernancePanel";
import { ClinicalRuleVersionActions } from "@/components/clinical-rules/ClinicalRuleVersionActions";
import { DrawerDisclosure, HeaderMeta, PageHeader, PageShell, Panel, StatusBadge } from "@/components/system";
import { getRuntimeClinicalEnvironment } from "@/lib/clinical-rules/authority";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

function parseDetails(value: string | null) {
  try {
    return JSON.parse(value ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default async function ClinicalGovernanceActivationPage() {
  const session = await getServerSession();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !canPerformClinicalRuleAction(user.role, "view")) redirect("/dashboard");
  const userRole = user.role!;

  /*
    WHICH VERSION THIS PAGE GOVERNS
    -------------------------------
    This was pinned to the literal "CG-NCSP-3.1.0", which made the formal
    process impossible to complete. `recordClinicalGovernanceReview` refuses
    anything that is not a DRAFT — "Governance interpretation may only revise a
    draft successor" — but that string always resolved to the ACTIVE version, so
    the approval centre could only ever show the one version whose controls are
    permanently disabled. A reviewer could create the required draft successor
    in Rule Studio and this page would still not address it.

    It now prefers the newest DRAFT successor in the governed rule set and falls
    back to the current governed version when no draft exists. The fallback is
    read-only by the same server-side rule as before — nothing here enables a
    decision that was previously refused.
  */
  const ruleSet = await prisma.clinicalRuleSet.findUnique({
    where: { key: NATIONAL_RULE_SET_KEY },
    select: { id: true },
  });
  if (!ruleSet) redirect("/rules/clinical");

  const draftSuccessor = await prisma.clinicalRuleVersion.findFirst({
    where: { ruleSetId: ruleSet.id, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  // The ruleset deciding new cases right now — the thing a draft succeeds.
  const currentGoverned = await getCurrentGovernedRuleset();
  const fallback =
    currentGoverned?.ruleVersionId ??
    (
      await prisma.clinicalRuleVersion.findFirst({
        where: { ruleSetId: ruleSet.id, status: { in: ["ACTIVE", "PUBLISHED", "VALIDATED"] } },
        orderBy: [{ versionMajor: "desc" }, { versionMinor: "desc" }, { versionPatch: "desc" }],
        select: { id: true },
      })
    )?.id;

  const targetVersionId = draftSuccessor?.id ?? fallback;
  if (!targetVersionId) redirect("/rules/clinical");

  const { version, snapshot } = await getClinicalRuleVersionSnapshot(targetVersionId);
  const governingDraft = version.status === "DRAFT";
  const [auditEvents, gateStates, admins] = await Promise.all([
    prisma.ruleVersionAuditEvent.findMany({
      where: { ruleVersionId: version.id },
      include: { actorUser: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getActivationGateStates(version.id),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
  ]);

  const governanceCases = CLINICAL_GOVERNANCE_CASES.map((item) => {
    const latestEvent = auditEvents.find((event) => {
      if (!event.eventType.startsWith("GOVERNANCE_INTERPRETATION_")) return false;
      return parseDetails(event.afterJson).caseId === item.caseId;
    });
    const details = parseDetails(latestEvent?.afterJson ?? null);
    const currentChecksum = details.checksum === version.checksum;
    const approved =
      currentChecksum &&
      latestEvent?.eventType === "GOVERNANCE_INTERPRETATION_APPROVED" &&
      details.approvalStatus === "APPROVED_IN_DRAFT_REVISION";
    return {
      ...item,
      rules: snapshot.rules
        .filter((rule) => (item.affectedRuleIds as readonly string[]).includes(rule.stableRuleId))
        .map((rule) => ({
          stableRuleId: rule.stableRuleId,
          conditionExpression: rule.conditionExpression,
          provisionalOutcome: rule.provisionalOutcome,
        })),
      approvalStatus: approved
        ? "APPROVED_IN_DRAFT_REVISION"
        : latestEvent && !currentChecksum
          ? "STALE_CHECKSUM_REVIEW_REQUIRED"
          : String(details.approvalStatus ?? "EVIDENCE_RESOLVED_GOVERNANCE_PENDING"),
      recordedDisposition: typeof details.disposition === "string" ? details.disposition : null,
      reviewerComment: latestEvent?.reason ?? null,
      approver: approved
        ? latestEvent?.actorUser?.name ?? latestEvent?.actorUser?.email ?? "Recorded user"
        : null,
      approvalDate: approved ? latestEvent?.createdAt.toLocaleDateString("en-NZ") ?? null : null,
    };
  });

  const approvedCards = governanceCases.filter((item) => item.approvalStatus.startsWith("APPROVED")).length;
  const clinicalApprovers = new Set(
    auditEvents
      .filter((event) => {
        if (event.eventType !== "APPROVAL") return false;
        const details = parseDetails(event.afterJson);
        return details.revision === version.revision && details.checksum === version.checksum;
      })
      .map((event) => event.actorUserId)
      .filter(Boolean)
  );
  const approvedOperationalGates = gateStates.filter((state) => state.action === "APPROVE").length;
  // Names the environment these governed rules are active for, so "active" is
  // never read as "active in hospital production".
  const clinicalEnvironment = getRuntimeClinicalEnvironment();
  const environmentLabel =
    clinicalEnvironment === "VALIDATION" || clinicalEnvironment === "TEST"
      ? "Test"
      : clinicalEnvironment === "PRODUCTION"
        ? "Production"
        : "Demo";
  const productionGovernanceComplete =
    approvedCards === governanceCases.length &&
    clinicalApprovers.size >= 2 &&
    approvedOperationalGates === gateStates.length;
  const productionGovernanceStarted =
    approvedCards > 0 || clinicalApprovers.size > 0 || approvedOperationalGates > 0;
  const productionGovernanceStatus = productionGovernanceComplete
    ? "Complete"
    : productionGovernanceStarted
      ? "Not complete"
      : "Not started";
  const governedVersion = currentGoverned?.displayVersion ?? "Not configured";
  const governedStatus = currentGoverned ? `Active for ${environmentLabel}` : "Not active";

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Advanced"
        title="Clinical Governance"
        description="Review the current governed rules, successor version, clinical approvals, and controlled activation status."
        actions={<Link href={`/rules/clinical/${version.id}`} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">Open Rule Studio</Link>}
        meta={
          <>
            <HeaderMeta label="Current governed rules" value={governedVersion} />
            <HeaderMeta label="Environment" value={environmentLabel} />
            <HeaderMeta label="Review version" value={governingDraft ? version.displayVersion : "None"} />
          </>
        }
      />

      <Panel title="Current governed rules">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-2xl font-semibold tracking-tight text-foreground">{governedVersion}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge tone={currentGoverned ? "success" : "warn"} dot>{governedStatus}</StatusBadge>
              {currentGoverned && <StatusBadge tone="neutral">Immutable</StatusBadge>}
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {currentGoverned
                ? "New cases use the current governed version. Historical cases retain the exact rules and authority that evaluated them; explicit re-evaluation creates a new linked evaluation."
                : "No governed version is active for new cases. Draft and review versions remain evaluation-only until separately approved, published, and deliberately activated."}
            </p>
          </div>
          <ShieldCheck className="h-8 w-8 text-brand-600" />
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Production governance</p>
          <p className="mt-2 text-xl font-semibold text-foreground">{productionGovernanceStatus}</p>
        </Panel>
        <Panel>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Clinical interpretations</p>
          <p className="mt-2 text-xl font-semibold text-foreground">{approvedCards} / {governanceCases.length}</p>
        </Panel>
        <Panel>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Independent approvals</p>
          <p className="mt-2 text-xl font-semibold text-foreground">{clinicalApprovers.size} / 2</p>
        </Panel>
        <Panel>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Operational gates</p>
          <p className="mt-2 text-xl font-semibold text-foreground">{approvedOperationalGates} / {gateStates.length}</p>
        </Panel>
      </div>

      <Panel title="Current review version">
        {governingDraft ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-foreground">{version.displayVersion}</p>
              <p className="mt-1 text-sm text-muted-foreground">Draft under review · revision {version.revision}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ClinicalRuleVersionActions
                id={version.id}
                displayVersion={version.displayVersion}
                status={version.status}
                sourceSummary={version.sourceGuidelineSummary}
                canEdit={canPerformClinicalRuleAction(userRole, "edit")}
                canValidate={canPerformClinicalRuleAction(userRole, "validate")}
                canApprove={canPerformClinicalRuleAction(userRole, "approve")}
                canPublish={version.status !== "PUBLISHED" && canPerformClinicalRuleAction(userRole, "publish")}
                canActivate={false}
                canRollback={false}
                canExport={false}
              />
              <Link href={`/rules/clinical/${version.id}`} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">Continue in Rule Studio</Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-foreground">No draft under review</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Create a new version from {governedVersion} to begin a governed review. The active version remains read-only.</p>
            </div>
            <ClinicalRuleVersionActions
              id={version.id}
              displayVersion={version.displayVersion}
              status={version.status}
              sourceSummary={version.sourceGuidelineSummary}
              canEdit={canPerformClinicalRuleAction(userRole, "edit")}
              canValidate={false}
              canApprove={false}
              canPublish={false}
              canActivate={false}
              canRollback={false}
              canExport={false}
            />
          </div>
        )}
      </Panel>

      <div id="governance-register">
        <DrawerDisclosure
          title="View detailed governance register"
          caption="Clinical interpretation cards, operational gates, thresholds, checksums, and technical evidence"
          className="rounded-xl bg-card p-4 shadow-card"
        >
          <div className="break-all rounded-lg border border-border bg-muted/25 p-3 font-mono text-xs">SHA-256 {version.checksum}</div>
          <Tabs defaultTab="clinical" className="rounded-xl border border-border bg-card">
            <TabList className="px-2">
              <Tab id="clinical">Clinical interpretations ({approvedCards}/{governanceCases.length})</Tab>
              <Tab id="activation">Operational gates ({approvedOperationalGates}/{gateStates.length})</Tab>
            </TabList>
            <TabPanel id="clinical" className="p-6">
              {!governingDraft && (
                <div
                  role="note"
                  className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"
                >
                  <p className="font-semibold">No draft successor exists, so no interpretation can be recorded.</p>
                  <p className="mt-1">
                    {version.displayVersion} is {version.status}. Interpretations are recorded only against a draft successor and remain bound to its exact checksum. Create a new version from the immutable current rules before starting the formal register. The cases below remain available read-only.
                  </p>
                </div>
              )}
              <ClinicalGovernanceReviewWorkspace
                versionId={version.id}
                initialRevision={version.revision}
                status={version.status}
                canPropose={canPerformClinicalRuleAction(userRole, "validate")}
                canApprove={canPerformClinicalRuleAction(userRole, "approve")}
                cases={governanceCases}
              />
            </TabPanel>
            <TabPanel id="activation" className="p-6">
              <ActivationGovernancePanel
                versionId={version.id}
                versionStatus={version.status}
                definitions={ACTIVATION_GATE_DEFINITIONS.map((item) => ({ ...item }))}
                states={gateStates.map((state) => ({ ...state, timestamp: state.timestamp?.toISOString() ?? null }))}
                admins={admins}
                currentUserId={user.id}
                currentUserRole={userRole}
                thresholds={{ ...ROLLBACK_THRESHOLD_CANDIDATES }}
              />
            </TabPanel>
          </Tabs>
        </DrawerDisclosure>
      </div>
    </PageShell>
  );
}
