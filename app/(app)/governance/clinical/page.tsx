import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { auth } from "@/lib/auth";
import { canPerformClinicalRuleAction } from "@/lib/clinical-rules/governance";
import { getClinicalAuthorityDisplay } from "@/lib/clinical-rules/authority-display";
import { getClinicalRuleVersionSnapshot } from "@/lib/clinical-rules/lifecycle";
import { CLINICAL_GOVERNANCE_CASES } from "@/lib/clinical-rules/governance-review";
import {
  ACTIVATION_GATE_DEFINITIONS,
  getActivationGateStates,
  ROLLBACK_THRESHOLD_CANDIDATES,
} from "@/lib/clinical-rules/activation-governance";
import { prisma } from "@/lib/prisma";
import { ClinicalGovernanceReviewWorkspace } from "@/components/clinical-rules/ClinicalGovernanceReviewWorkspace";
import { ActivationGovernancePanel } from "@/components/clinical-rules/ActivationGovernancePanel";
import { HeaderMeta, PageHeader, PageShell, Panel, StatusBadge } from "@/components/system";
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
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !canPerformClinicalRuleAction(user.role, "view")) redirect("/dashboard");
  const userRole = user.role!;

  const latest = await prisma.clinicalRuleVersion.findFirst({
    where: { displayVersion: "CG-NCSP-3.1.0" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!latest) redirect("/rules/clinical");

  const { version, snapshot } = await getClinicalRuleVersionSnapshot(latest.id);
  const [auditEvents, gateStates, admins, authority] = await Promise.all([
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
    getClinicalAuthorityDisplay(),
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

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Clinical Governance & Activation"
        title="CG-NCSP-3.1.0 approval centre"
        description="Authenticated, append-only decisions for clinical interpretation, accountable operational gates, and controlled Production activation."
        actions={<Link href={`/rules/clinical/${version.id}`} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">Open Rule Studio</Link>}
        meta={
          <>
            <HeaderMeta label="Version" value={version.displayVersion} />
            <HeaderMeta label="Revision" value={version.revision} />
            <HeaderMeta label="Lifecycle" value={version.status} />
            <HeaderMeta label="Authority" value={authority.authorityEngine} />
          </>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={authority.authorityEngine === "CANONICAL" ? "success" : "warn"} dot>Production authority: {authority.authorityEngine}</StatusBadge>
              <StatusBadge tone={approvedCards === governanceCases.length ? "success" : "warn"}>Clinical cards {approvedCards}/{governanceCases.length}</StatusBadge>
              <StatusBadge tone={clinicalApprovers.size >= 2 ? "success" : "warn"}>Clinical approvers {clinicalApprovers.size}/2</StatusBadge>
              <StatusBadge tone={approvedOperationalGates === gateStates.length ? "success" : "warn"}>Operational gates {approvedOperationalGates}/{gateStates.length}</StatusBadge>
            </div>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">
              Engineering evidence is visible but never counted as a human approval. Every decision is tied to an authenticated identity; stale-checksum decisions do not satisfy activation.
            </p>
          </div>
          <ShieldCheck className="h-8 w-8 text-brand-600" />
        </div>
        <div className="mt-4 break-all rounded-lg border border-border bg-muted/25 p-3 font-mono text-xs">SHA-256 {version.checksum}</div>
      </Panel>

      <Tabs defaultTab="clinical" className="rounded-2xl border border-border bg-card shadow-sm">
        <TabList className="px-2">
          <Tab id="clinical">Clinical interpretations ({approvedCards}/{governanceCases.length})</Tab>
          <Tab id="activation">Operational activation gates ({approvedOperationalGates}/{gateStates.length})</Tab>
        </TabList>
        <TabPanel id="clinical" className="p-6">
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
    </PageShell>
  );
}
