import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { CLINICAL_GOVERNANCE_CASES } from "./governance-review";

export const ROLLBACK_THRESHOLD_CANDIDATES = {
  canonicalEvaluationFailure: "1 or more in any 15-minute window",
  authorityResolverFailure: "1 or more in any 15-minute window",
  urgentDisagreement: "1 or more unexplained events",
  recommendationReversal: "2 or more unexplained reversals in 24 hours",
  clinicianOverride: "Greater than 20% over 20 consecutive reviewed cases",
  missingInformationFailure: "Any confident recommendation produced with a missing mandatory fact",
  timingAmbiguity: "Any machine-scheduled date from a clinician-timing-required rule",
  persistenceFailure: "Any failed RuleEvaluation or audit write",
} as const;

export const ACTIVATION_GATE_DEFINITIONS = [
  { gateId: "GOV-01", title: "Clinical interpretation register", question: "Have all mandatory clinical interpretation cards been adjudicated?", evidence: "Governance review ledger and source-backed differential evidence.", proposed: "Require every displayed clinical card to carry an approved disposition.", safetyImpact: "Prevents unresolved source interpretation from becoming live authority.", pathway: "All governed pathways", tests: "Governance review and semantic conformance suites", engineeringStatus: "ENFORCED", roles: ["ADMIN"] },
  { gateId: "GOV-02", title: "Independent clinical approvals", question: "Have two different clinical approvers approved the final validated checksum?", evidence: "APPROVAL events scoped to the current revision and checksum.", proposed: "Require two distinct authenticated approvers.", safetyImpact: "Provides independent clinical review of the release identity.", pathway: "All governed pathways", tests: "Lifecycle separation-of-duty tests", engineeringStatus: "ENFORCED", roles: ["ADMIN"] },
  { gateId: "GOV-03", title: "Activation separation of duties", question: "Is the activation operator different from both clinical approvers?", evidence: "Authenticated operator assignment and lifecycle actor checks.", proposed: "Require an ADMIN operator who is not either clinical approver.", safetyImpact: "Prevents one person from approving and activating the same clinical release.", pathway: "Production activation", tests: "Activation separation-of-duty tests", engineeringStatus: "ENFORCED", roles: ["ADMIN"] },
  { gateId: "GOV-04-OPERATING-POINT", title: "Operating point and reviewer capacity", question: "Is the reviewer capacity and safe operating point accepted?", evidence: "Current monitoring signals; no fabricated historical baseline.", proposed: "Begin with conservative rollback-on-first-failure controls and review after a signed pilot baseline.", safetyImpact: "Avoids exceeding reviewer capacity or silently tolerating unsafe stops.", pathway: "All review queues", tests: "Monitoring and missing-information suites", engineeringStatus: "IMPLEMENTED", roles: ["ADMIN"] },
  { gateId: "ROLLBACK-THRESHOLDS", title: "Rollback thresholds", question: "Does the risk owner approve the proposed T+0 rollback thresholds?", evidence: "Live monitoring counters and documented candidate values.", proposed: "Approve the candidate set shown below or request a change.", safetyImpact: "Creates an objective and auditable rollback boundary.", pathway: "Production monitoring", tests: "Monitoring, activation, rollback and persistence suites", engineeringStatus: "PROPOSED_REQUIRES_RISK_OWNER_APPROVAL", roles: ["ADMIN"] },
  { gateId: "LICENSING", title: "Source licensing and redistribution", question: "May the derived clinical artefacts be stored and rendered in CerviGrade?", evidence: "Internal JSON snapshots, generated graphs/views, source excerpts and public guideline representations are inventoried.", proposed: "Record APPROVED, NOT APPROVED, or REQUIRES LEGAL REVIEW.", safetyImpact: "Prevents unapproved redistribution while preserving clinical provenance.", pathway: "Guidelines and Rule Studio", tests: "Source manifest and deterministic rebuild verification", engineeringStatus: "TECHNICAL_INVENTORY_COMPLETE", roles: ["ADMIN"] },
  { gateId: "RISK-ACCEPTANCE", title: "Residual security and operational risk", question: "Has the accountable risk owner accepted or rejected the documented residual risk?", evidence: "Security suite, dependency audit, durability checks and rehearsal evidence.", proposed: "Approve only after reviewing the current evidence and exceptions.", safetyImpact: "Makes residual release risk explicit and attributable.", pathway: "Whole platform", tests: "Security and database suites", engineeringStatus: "EVIDENCE_AVAILABLE", roles: ["ADMIN"] },
  { gateId: "R6-CREDENTIAL", title: "Historical credential exposure", question: "Has the credential owner confirmed rotation/revocation or formally accepted the residual risk?", evidence: "No password is rendered or hard-coded; Production seeding fails closed. Historical password is never tested.", proposed: "Record post-exposure rotation/revocation evidence or formal acceptance.", safetyImpact: "Closes the remaining historical authentication exposure.", pathway: "Authentication", tests: "16 security regression tests", engineeringStatus: "TECHNICAL_REMEDIATION_COMPLETE_OWNER_ATTESTATION_REQUIRED", roles: ["ADMIN"] },
  { gateId: "ACTIVATION-OPERATOR", title: "Activation Operator", question: "Who will execute the controlled Production activation?", evidence: "Selected authenticated ADMIN identity.", proposed: "Assign one operator distinct from both clinical approvers.", safetyImpact: "Creates accountable technical ownership for activation and rollback.", pathway: "Production activation", tests: "Lifecycle actor-separation tests", engineeringStatus: "ENFORCED", roles: ["ADMIN"] },
  { gateId: "DEPUTY-OPERATOR", title: "Deputy Operator", question: "Who is the distinct deputy for rollback coverage?", evidence: "Selected authenticated ADMIN identity.", proposed: "Assign a deputy different from the primary operator and clinical approvers.", safetyImpact: "Provides a second accountable rollback operator.", pathway: "Production activation", tests: "Activation-gate tests", engineeringStatus: "ENFORCED", roles: ["ADMIN"] },
  { gateId: "SHARED-REHEARSAL", title: "Shared activation and rollback rehearsal", question: "Has the complete rehearsal passed on a dedicated non-Production durable database?", evidence: "Recorded A–L observations, audit trail, immutable evaluations and measured RTO.", proposed: "Approve only after the shared rehearsal evidence is attached.", safetyImpact: "Demonstrates rollback and history preservation outside an isolated process.", pathway: "Validation environment", tests: "Shared rehearsal plus isolated database suite", engineeringStatus: "IMPLEMENTED_AWAITING_SHARED_INFRASTRUCTURE", roles: ["ADMIN", "INTEGRATION_ADMIN"] },
] as const;

export type ActivationGateId = (typeof ACTIVATION_GATE_DEFINITIONS)[number]["gateId"];
export const ActivationGateIdSchema = z.enum(
  ACTIVATION_GATE_DEFINITIONS.map((item) => item.gateId) as [ActivationGateId, ...ActivationGateId[]]
);
export const ActivationGateActionSchema = z.enum(["APPROVE", "REJECT", "REQUEST_CHANGE"]);

export const ActivationGateDecisionSchema = z.object({
  gateId: ActivationGateIdSchema,
  action: ActivationGateActionSchema,
  comments: z.string().trim().min(10).max(4_000),
  subjectUserId: z.string().trim().min(1).optional(),
});

export type ActivationGateState = {
  gateId: ActivationGateId;
  action: "APPROVE" | "REJECT" | "REQUEST_CHANGE" | "PENDING";
  comments: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  actorName: string | null;
  subjectUserId: string | null;
  subjectName: string | null;
  timestamp: Date | null;
  outcome: string | null;
};

function parseAfterJson(value: string | null) {
  try {
    return JSON.parse(value ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function getActivationGateStates(ruleVersionId: string) {
  const version = await prisma.clinicalRuleVersion.findUnique({
    where: { id: ruleVersionId },
    select: { checksum: true },
  });
  const events = await prisma.ruleVersionAuditEvent.findMany({
    where: { ruleVersionId, eventType: "ACTIVATION_GATE_DECISION" },
    include: { actorUser: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  const subjectIds = events
    .map((event) => String(parseAfterJson(event.afterJson).subjectUserId ?? ""))
    .filter(Boolean);
  const subjects = subjectIds.length
    ? await prisma.user.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true, email: true } })
    : [];
  const subjectById = new Map(subjects.map((user) => [user.id, user]));

  return ACTIVATION_GATE_DEFINITIONS.map((definition): ActivationGateState => {
    const event = events.find((candidate) => {
      const details = parseAfterJson(candidate.afterJson);
      return details.gateId === definition.gateId && details.checksum === version?.checksum;
    });
    if (!event) return { gateId: definition.gateId, action: "PENDING", comments: null, actorUserId: null, actorRole: null, actorName: null, subjectUserId: null, subjectName: null, timestamp: null, outcome: null };
    const details = parseAfterJson(event.afterJson);
    const subjectUserId = typeof details.subjectUserId === "string" ? details.subjectUserId : null;
    const subject = subjectUserId ? subjectById.get(subjectUserId) : null;
    return {
      gateId: definition.gateId,
      action: details.action === "APPROVE" || details.action === "REJECT" || details.action === "REQUEST_CHANGE" ? details.action : "PENDING",
      comments: event.reason,
      actorUserId: event.actorUserId,
      actorRole: typeof details.actorRole === "string" ? details.actorRole : null,
      actorName: event.actorUser?.name ?? event.actorUser?.email ?? null,
      subjectUserId,
      subjectName: subject?.name ?? subject?.email ?? null,
      timestamp: event.createdAt,
      outcome: typeof details.outcome === "string" ? details.outcome : null,
    };
  });
}

export async function recordActivationGateDecision(args: {
  ruleVersionId: string;
  actorUserId: string;
  actorRole: string;
  gateId: ActivationGateId;
  action: "APPROVE" | "REJECT" | "REQUEST_CHANGE";
  comments: string;
  subjectUserId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const definition = ACTIVATION_GATE_DEFINITIONS.find((item) => item.gateId === args.gateId)!;
  if (!(definition.roles as readonly string[]).includes(args.actorRole)) {
    throw new Error(`${args.actorRole} cannot decide ${args.gateId}.`);
  }
  const version = await prisma.clinicalRuleVersion.findUnique({ where: { id: args.ruleVersionId } });
  if (!version) throw new Error("Clinical rule version not found.");

  if (args.gateId === "ACTIVATION-OPERATOR" || args.gateId === "DEPUTY-OPERATOR") {
    if (args.action !== "APPROVE" || !args.subjectUserId) throw new Error("An approved operator assignment requires a selected user.");
    const subject = await prisma.user.findUnique({ where: { id: args.subjectUserId }, select: { id: true, role: true } });
    if (!subject || subject.role !== "ADMIN") throw new Error("The assigned activation operator must be an ADMIN.");
    const approvals = await prisma.ruleVersionAuditEvent.findMany({ where: { ruleVersionId: version.id, eventType: "APPROVAL" }, select: { actorUserId: true, afterJson: true } });
    const clinicalActors = new Set(approvals.filter((event) => { const details = parseAfterJson(event.afterJson); return details.revision === version.revision && details.checksum === version.checksum; }).map((event) => event.actorUserId).filter(Boolean));
    if (clinicalActors.has(subject.id)) throw new Error("An activation operator cannot be one of the clinical approvers.");
    const states = await getActivationGateStates(version.id);
    const otherGate = args.gateId === "ACTIVATION-OPERATOR" ? "DEPUTY-OPERATOR" : "ACTIVATION-OPERATOR";
    const other = states.find((state) => state.gateId === otherGate);
    if (other?.action === "APPROVE" && other.subjectUserId === subject.id) throw new Error("The primary and deputy operators must be different people.");
  }

  const after = {
    gateId: args.gateId,
    action: args.action,
    actorRole: args.actorRole,
    subjectUserId: args.subjectUserId ?? null,
    checksum: version.checksum,
    outcome:
      args.gateId === "LICENSING"
        ? args.action === "APPROVE"
          ? "APPROVED"
          : args.action === "REJECT"
            ? "NOT_APPROVED"
            : "REQUIRES_LEGAL_REVIEW"
        : args.action,
    thresholds: args.gateId === "ROLLBACK-THRESHOLDS" ? ROLLBACK_THRESHOLD_CANDIDATES : undefined,
  };
  return prisma.$transaction(async (tx) => {
    const event = await tx.ruleVersionAuditEvent.create({ data: { ruleSetId: version.ruleSetId, ruleVersionId: version.id, actorUserId: args.actorUserId, eventType: "ACTIVATION_GATE_DECISION", reason: args.comments.trim(), afterJson: JSON.stringify(after), ipAddress: args.ipAddress, userAgent: args.userAgent } });
    await tx.auditLog.create({ data: { userId: args.actorUserId, action: "ACTIVATION_GATE_DECISION", entity: "ClinicalRuleVersion", entityId: version.id, newValue: JSON.stringify(after) } });
    return event;
  });
}

export async function assertProductionGovernanceGates(ruleVersionId: string, actorUserId: string) {
  const version = await prisma.clinicalRuleVersion.findUnique({
    where: { id: ruleVersionId },
    select: { checksum: true },
  });
  if (!version?.checksum) throw new Error("Production activation requires a checksummed rule version.");

  const reviewEvents = await prisma.ruleVersionAuditEvent.findMany({
    where: {
      ruleVersionId,
      eventType: { startsWith: "GOVERNANCE_INTERPRETATION_" },
    },
    orderBy: { createdAt: "desc" },
    select: { eventType: true, afterJson: true },
  });
  const incompleteClinicalCards = CLINICAL_GOVERNANCE_CASES.filter((item) => {
    const latest = reviewEvents.find((event) => parseAfterJson(event.afterJson).caseId === item.caseId);
    if (!latest || latest.eventType !== "GOVERNANCE_INTERPRETATION_APPROVED") return true;
    const details = parseAfterJson(latest.afterJson);
    return details.checksum !== version.checksum || details.approvalStatus !== "APPROVED_IN_DRAFT_REVISION";
  }).map((item) => item.caseId);
  if (incompleteClinicalCards.length) {
    throw new Error(
      `Clinical interpretation cards are incomplete for the current checksum: ${incompleteClinicalCards.join(", ")}.`
    );
  }

  const states = await getActivationGateStates(ruleVersionId);
  const missing = states.filter((state) => state.action !== "APPROVE").map((state) => state.gateId);
  if (missing.length) throw new Error(`Production activation gates are incomplete: ${missing.join(", ")}.`);
  const operator = states.find((state) => state.gateId === "ACTIVATION-OPERATOR");
  if (operator?.subjectUserId !== actorUserId) throw new Error("Only the assigned Activation Operator may activate Production.");
}

export async function assertProductionRollbackOperator(ruleVersionId: string, actorUserId: string) {
  const states = await getActivationGateStates(ruleVersionId);
  const operators = states
    .filter((state) =>
      (state.gateId === "ACTIVATION-OPERATOR" || state.gateId === "DEPUTY-OPERATOR") &&
      state.action === "APPROVE"
    )
    .map((state) => state.subjectUserId);
  if (!operators.includes(actorUserId)) {
    throw new Error("Only the assigned Activation Operator or Deputy Operator may roll Production back to Legacy.");
  }
}
