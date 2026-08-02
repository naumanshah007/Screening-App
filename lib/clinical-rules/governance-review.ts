import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const ClinicalGovernanceDispositionSchema = z.enum([
  "SOURCE_SUPPORTS_OPTION_A",
  "SOURCE_SUPPORTS_OPTION_B",
  "KEEP_GOVERNANCE_STOP",
  "REQUIRE_EXTERNAL_CLINICAL_ADVICE",
  "RULEBOOK_CORRECTION_REQUIRED",
  "ORACLE_CORRECTION_REQUIRED",
]);

export type ClinicalGovernanceDisposition = z.infer<
  typeof ClinicalGovernanceDispositionSchema
>;

export const ClinicalGovernanceReviewActionSchema = z.object({
  action: z.enum(["PROPOSE", "APPROVE"]),
  caseId: z.string().trim().min(1).max(160),
  disposition: ClinicalGovernanceDispositionSchema,
  comments: z.string().trim().min(10).max(4_000),
  expectedRevision: z.number().int().positive(),
});

export const CLINICAL_GOVERNANCE_CASES = [
  {
    caseId: "F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED",
    title: "Confirmed ASC-H: excision considered versus observation",
    source: "Figure 5; primary prose p46/PDF 48; figure p47/PDF 49",
    recommendations: ["R6.08", "R6.09"],
    figureBranch: "Confirmed ASC-H → treatment decision",
    affectedRuleIds: ["F5-01", "F5-04"],
    affectedTests: ["CV2-F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED"],
    competingInterpretation:
      "A deterministic treatment terminal versus a specialist decision in which diagnostic excision is considered and observation remains available.",
    sourceSupportedDisposition: "ORACLE_CORRECTION_REQUIRED" as const,
    effectOnPathways:
      "Keeps treatment selection and completion as separately recorded facts and prevents autonomous treatment finalisation.",
  },
  {
    caseId: "F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC",
    title: "Figure 5 observation: co-test surveillance provenance",
    source: "Figure 5; primary prose p46/PDF 48; figure p47/PDF 49",
    recommendations: ["R6.09"],
    figureBranch: "Observation → reassuring six-month result → repeat co-test",
    affectedRuleIds: ["F5-05", "F5-08"],
    affectedTests: ["CV2-F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC"],
    competingInterpretation:
      "Ordinary post-treatment Figure 6 Test of Cure versus Figure 5 specialist co-testing surveillance without inferred prior treatment.",
    sourceSupportedDisposition: "ORACLE_CORRECTION_REQUIRED" as const,
    effectOnPathways:
      "Preserves the two-stage negative sequence and Figure 5 provenance; it does not fabricate treatment or a treatment date.",
  },
  {
    caseId: "F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT",
    title: "Test of Cure: first versus second consecutive low-grade result",
    source: "R8.06–R8.08 p55/PDF 57; Figure 6 p56/PDF 58",
    recommendations: ["R8.06", "R8.07", "R8.08"],
    figureBranch: "HPV not detected → low-grade cytology → sequence count",
    affectedRuleIds: ["F6-07", "F6-09", "F6-14"],
    affectedTests: ["CV2-F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT"],
    competingInterpretation:
      "Repeat after a first low-grade result versus colposcopy once two consecutive low-grade results are recorded.",
    sourceSupportedDisposition: "ORACLE_CORRECTION_REQUIRED" as const,
    effectOnPathways:
      "Requires longitudinal sequence evidence and prevents a first low-grade result from being collapsed into the second-consecutive branch.",
  },
] as const;

function parseAfterJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function assertSeparateGovernanceActors(
  proposerUserId: string | null,
  approverUserId: string
) {
  if (proposerUserId === approverUserId) {
    throw new Error(
      "The proposer cannot finally approve the same clinical interpretation."
    );
  }
}

export async function recordClinicalGovernanceReview(args: {
  versionId: string;
  actorUserId: string;
  action: "PROPOSE" | "APPROVE";
  caseId: string;
  disposition: ClinicalGovernanceDisposition;
  comments: string;
  expectedRevision: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  if (!CLINICAL_GOVERNANCE_CASES.some((item) => item.caseId === args.caseId)) {
    throw new Error("Unknown clinical governance case.");
  }

  return prisma.$transaction(async (tx) => {
    const version = await tx.clinicalRuleVersion.findUnique({
      where: { id: args.versionId },
    });
    if (!version) throw new Error("Clinical rule version not found.");
    if (version.status !== "DRAFT") {
      throw new Error("Governance interpretation may only revise a draft successor.");
    }
    if (version.revision !== args.expectedRevision) {
      throw new Error(
        `Revision conflict: expected ${args.expectedRevision}, found ${version.revision}. Refresh before continuing.`
      );
    }

    if (args.action === "PROPOSE") {
      await tx.ruleVersionAuditEvent.create({
        data: {
          ruleSetId: version.ruleSetId,
          ruleVersionId: version.id,
          actorUserId: args.actorUserId,
          eventType: "GOVERNANCE_INTERPRETATION_PROPOSED",
          reason: args.comments,
          afterJson: JSON.stringify({
            caseId: args.caseId,
            disposition: args.disposition,
            approvalStatus: "PROPOSED",
            versionRevision: version.revision,
          }),
          ipAddress: args.ipAddress,
          userAgent: args.userAgent,
        },
      });
      return { action: "PROPOSED" as const, revision: version.revision };
    }

    const events = await tx.ruleVersionAuditEvent.findMany({
      where: {
        ruleVersionId: version.id,
        eventType: "GOVERNANCE_INTERPRETATION_PROPOSED",
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const proposal = events.find((event) => {
      const details = parseAfterJson(event.afterJson);
      return details?.caseId === args.caseId && details.disposition === args.disposition;
    });
    if (!proposal) {
      throw new Error("A matching proposal is required before approval.");
    }
    assertSeparateGovernanceActors(proposal.actorUserId, args.actorUserId);

    const priorValidation = version.validationJson
      ? parseAfterJson(version.validationJson) ?? {}
      : {};
    const priorReviews =
      priorValidation.governanceReviews &&
      typeof priorValidation.governanceReviews === "object"
        ? priorValidation.governanceReviews as Record<string, unknown>
        : {};
    const nextRevision = version.revision + 1;
    await tx.clinicalRuleVersion.update({
      where: { id: version.id, revision: version.revision },
      data: {
        revision: { increment: 1 },
        validationJson: JSON.stringify({
          ...priorValidation,
          releaseSubStatus:
            "ENGINEERING_VALIDATION_PASSED_CLINICAL_GOVERNANCE_PENDING",
          publicationPermitted: false,
          governanceReviews: {
            ...priorReviews,
            [args.caseId]: {
              disposition: args.disposition,
              approvalStatus: "APPROVED_IN_DRAFT_REVISION",
              proposerUserId: proposal.actorUserId,
              approverUserId: args.actorUserId,
              approvedRevision: nextRevision,
            },
          },
        }),
      },
    });
    await tx.ruleVersionAuditEvent.create({
      data: {
        ruleSetId: version.ruleSetId,
        ruleVersionId: version.id,
        actorUserId: args.actorUserId,
        eventType: "GOVERNANCE_INTERPRETATION_APPROVED",
        reason: args.comments,
        beforeJson: JSON.stringify({
          caseId: args.caseId,
          proposalEventId: proposal.id,
          revision: version.revision,
        }),
        afterJson: JSON.stringify({
          caseId: args.caseId,
          disposition: args.disposition,
          approvalStatus: "APPROVED_IN_DRAFT_REVISION",
          revision: nextRevision,
          publicationPermitted: false,
        }),
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: args.actorUserId,
        action: "GOVERNANCE_INTERPRETATION_APPROVED",
        entity: "ClinicalRuleVersion",
        entityId: version.id,
        oldValue: JSON.stringify({ revision: version.revision }),
        newValue: JSON.stringify({
          revision: nextRevision,
          caseId: args.caseId,
          disposition: args.disposition,
          publicationPermitted: false,
        }),
      },
    });
    return { action: "APPROVED" as const, revision: nextRevision };
  });
}
