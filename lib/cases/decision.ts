import type { CaseStatus, Prisma, TriagePriority } from "@prisma/client";

import { buildOperationalState } from "@/lib/cases/operational";
import { parseGradeRecommendationPayload } from "@/lib/cases/grading";
import { prisma } from "@/lib/prisma";
import { calculateCaseTargetDueAt } from "@/lib/cases/sla";

const clinicianDecisionInclude = {
  decidedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.ClinicianDecisionInclude;

export type ClinicianDecisionRecord = Prisma.ClinicianDecisionGetPayload<{
  include: typeof clinicianDecisionInclude;
}>;

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function deriveCaseStatus(finalPriority: TriagePriority): CaseStatus {
  switch (finalPriority) {
    case "INFO_REQUIRED":
      return "NEEDS_MORE_INFO";
    case "REJECT":
    case "DECLINE":
      return "REJECTED";
    default:
      return "GRADED";
  }
}

export async function getStoredClinicianDecision(caseId: string) {
  return prisma.clinicianDecision.findUnique({
    where: { caseId },
    include: clinicianDecisionInclude,
  });
}

export async function saveClinicianDecision(args: {
  caseId: string;
  decidedByUserId: string;
  finalPriority: TriagePriority;
  finalCategory?: string | null;
  finalOutcome: string;
  overrideReason?: string | null;
  notes?: string | null;
}) {
  const referralCase = await prisma.referralCase.findUnique({
    where: { id: args.caseId },
    include: {
      ruleDecision: true,
      clinicianDecision: true,
    },
  });

  if (!referralCase) {
    throw new Error("Referral case not found");
  }

  const finalCategory = normalizeOptionalText(args.finalCategory);
  const finalOutcome = args.finalOutcome.trim();
  const overrideReason = normalizeOptionalText(args.overrideReason);
  const notes = normalizeOptionalText(args.notes);

  if (!finalOutcome) {
    throw new Error("Final outcome is required");
  }

  const recommendation = referralCase.ruleDecision;
  const differsFromRecommendation =
    !recommendation ||
    recommendation.priority !== args.finalPriority ||
    (recommendation.category ?? null) !== finalCategory ||
    recommendation.outcome !== finalOutcome;

  if (differsFromRecommendation && !overrideReason) {
    throw new Error(
      "Override reason is required when changing the provisional recommendation"
    );
  }

  const caseStatus = deriveCaseStatus(args.finalPriority);
  const previousDecision = referralCase.clinicianDecision;
  const recommendationPayload = referralCase.ruleDecision
    ? parseGradeRecommendationPayload(referralCase.ruleDecision.traceJson)
    : null;
  const ruleTargetDays = recommendationPayload?.recommendation.targetDays ?? null;
  const targetDueAt = calculateCaseTargetDueAt(
    referralCase.receivedAt,
    referralCase.serviceLine,
    args.finalPriority,
    ruleTargetDays
  );
  const shouldClearBooking =
    args.finalPriority === "INFO_REQUIRED" ||
    args.finalPriority === "REJECT" ||
    args.finalPriority === "DECLINE";
  const nextCaseStatus =
    referralCase.bookedForAt && !shouldClearBooking ? "BOOKED" : caseStatus;
  const operationalState = buildOperationalState({
    priority: args.finalPriority,
    outcome: finalOutcome,
    requiresSmoReview: recommendationPayload?.operational.requiresSmoReview,
  });

  const result = await prisma.$transaction(async (tx) => {
    const decision = await tx.clinicianDecision.upsert({
      where: { caseId: referralCase.id },
      update: {
        decidedByUserId: args.decidedByUserId,
        finalPriority: args.finalPriority,
        finalCategory,
        finalOutcome,
        overrideReason,
        notes,
      },
      create: {
        caseId: referralCase.id,
        decidedByUserId: args.decidedByUserId,
        finalPriority: args.finalPriority,
        finalCategory,
        finalOutcome,
        overrideReason,
        notes,
      },
      include: clinicianDecisionInclude,
    });

    await tx.referralCase.update({
      where: { id: referralCase.id },
      data: {
        currentPriority: args.finalPriority,
        currentCategory: finalCategory,
        status: nextCaseStatus,
        smoOnly: operationalState.requiresSmoReview,
        targetDueAt,
        bookedForAt: shouldClearBooking ? null : undefined,
        bookedAt: shouldClearBooking ? null : undefined,
        bookingNotes: shouldClearBooking ? null : undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: args.decidedByUserId,
        action: previousDecision ? "UPDATE" : "CREATE",
        entity: "ClinicianDecision",
        entityId: decision.id,
        oldValue: previousDecision
          ? JSON.stringify({
              finalPriority: previousDecision.finalPriority,
              finalCategory: previousDecision.finalCategory,
              finalOutcome: previousDecision.finalOutcome,
              overrideReason: previousDecision.overrideReason,
              notes: previousDecision.notes,
            })
          : undefined,
        newValue: JSON.stringify({
          caseId: referralCase.id,
          finalPriority: args.finalPriority,
          finalCategory,
          finalOutcome,
          overrideReason,
          notes,
          caseStatus: nextCaseStatus,
          targetDueAt,
          workflow: operationalState.workflow,
          requiresSmoReview: operationalState.requiresSmoReview,
        }),
      },
    });

    return decision;
  });

  return result;
}
