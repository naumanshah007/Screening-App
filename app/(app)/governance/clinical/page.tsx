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
import { NATIONAL_RULE_SET_KEY } from "@/lib/clinical-rules/constants";
import { getCurrentGovernedRuleset } from "@/lib/clinical-rules/current-ruleset";
import { prisma } from "@/lib/prisma";
import { ClinicalGovernanceReviewWorkspace } from "@/components/clinical-rules/ClinicalGovernanceReviewWorkspace";
import { ActivationGovernancePanel } from "@/components/clinical-rules/ActivationGovernancePanel";
import { ClinicalRuleVersionActions } from "@/components/clinical-rules/ClinicalRuleVersionActions";
import { HeaderMeta, PageHeader, PageShell, Panel, StatusBadge } from "@/components/system";
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
  const session = await auth();
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
  // Names the environment these governed rules are active for, so "active" is
  // never read as "active in hospital production".
  const clinicalEnvironment = getRuntimeClinicalEnvironment();

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Clinical Governance & Activation"
        title={`${version.displayVersion} approval centre`}
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
            {/*
              Two SEPARATE statements, because conflating them is actively
              misleading.

              The badge here previously read "Production authority: CANONICAL"
              beside "Clinical cards 0/16" — inviting the reading that hospital
              production governance was complete. It is not. What is active is
              the governed ruleset for THIS environment; real pilot/production
              readiness is a different question with its own unmet gates.

              Presentation only — no governance record, ledger or gate is
              changed by this block.
            */}
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {clinicalEnvironment === "PRODUCTION"
                  ? "Production clinical authority"
                  : `${clinicalEnvironment} clinical authority`}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge
                  tone={authority.authorityEngine === "CANONICAL" ? "success" : "warn"}
                  dot
                >
                  {/*
                    Names the CURRENT GOVERNED ruleset, not the version this
                    page is governing. Once a draft successor exists those are
                    two different versions, and printing the draft's identifier
                    beside the word ACTIVE would state that an unapproved draft
                    is deciding cases.
                  */}
                  {authority.authorityEngine === "CANONICAL"
                    ? `${currentGoverned?.displayVersion ?? version.displayVersion} · ACTIVE`
                    : "Previous grading rules"}
                </StatusBadge>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {clinicalEnvironment === "PRODUCTION"
                  ? "New cases in this environment are evaluated using these governed rules."
                  : "New synthetic/demo cases in this environment are evaluated using these governed rules."}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Real pilot / production readiness
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <StatusBadge
                  tone={
                    approvedCards === governanceCases.length &&
                    clinicalApprovers.size >= 2 &&
                    approvedOperationalGates === gateStates.length
                      ? "success"
                      : "warn"
                  }
                  dot
                >
                  Independent clinical governance:{" "}
                  {approvedCards === governanceCases.length &&
                  clinicalApprovers.size >= 2 &&
                  approvedOperationalGates === gateStates.length
                    ? "Complete"
                    : "Not complete"}
                </StatusBadge>
                <StatusBadge tone={approvedCards === governanceCases.length ? "success" : "warn"}>Clinical interpretations {approvedCards}/{governanceCases.length}</StatusBadge>
                <StatusBadge tone={clinicalApprovers.size >= 2 ? "success" : "warn"}>Clinical approvers {clinicalApprovers.size}/2</StatusBadge>
                <StatusBadge tone={approvedOperationalGates === gateStates.length ? "success" : "warn"}>Operational activation gates {approvedOperationalGates}/{gateStates.length}</StatusBadge>
              </div>
            </div>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">
              Engineering evidence is visible but never counted as a human approval. Every decision is tied to an authenticated identity; stale-checksum decisions do not satisfy activation. Demonstration attestations are excluded from production activation gates.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <ShieldCheck className="h-8 w-8 text-brand-600" />
            <ClinicalRuleVersionActions
              id={version.id}
              status={version.status}
              sourceSummary={version.sourceGuidelineSummary}
              canEdit={false}
              canValidate={canPerformClinicalRuleAction(userRole, "validate")}
              canApprove={canPerformClinicalRuleAction(userRole, "approve")}
              canPublish={version.status !== "PUBLISHED" && canPerformClinicalRuleAction(userRole, "publish")}
              canActivate={false}
              canRollback={false}
              canExport={false}
            />
          </div>
        </div>
        <div className="mt-4 break-all rounded-lg border border-border bg-muted/25 p-3 font-mono text-xs">SHA-256 {version.checksum}</div>
      </Panel>

      <Tabs defaultTab="clinical" className="rounded-2xl border border-border bg-card shadow-sm">
        <TabList className="px-2">
          <Tab id="clinical">Clinical interpretations ({approvedCards}/{governanceCases.length})</Tab>
          <Tab id="activation">Operational activation gates ({approvedOperationalGates}/{gateStates.length})</Tab>
        </TabList>
        <TabPanel id="clinical" className="p-6">
          {/*
            The register cannot be filled against a version that is already
            active — the server refuses it. Saying so here, with the step that
            unblocks it, replaces a page of silently greyed-out controls.
          */}
          {!governingDraft && (
            <div
              role="note"
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"
            >
              <p className="font-semibold">
                No draft successor exists, so no interpretation can be recorded.
              </p>
              <p className="mt-1">
                {version.displayVersion} is {version.status}. Clinical interpretations are recorded
                against a draft successor and are bound to its exact checksum, so they can never be
                written onto a version that is already deciding cases. To begin the formal register,
                open{" "}
                <Link
                  href={`/rules/clinical/${version.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  Rule Studio
                </Link>{" "}
                and clone {version.displayVersion} into a new draft; this page will then govern that
                draft. The cases below are shown read-only for reference.
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
    </PageShell>
  );
}
