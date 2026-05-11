import {
  buildOperationalState,
  isOperationalWorkflowBookable,
} from "@/lib/cases/operational";
import { prisma } from "@/lib/prisma";

export async function saveCaseBooking(args: {
  caseId: string;
  actorUserId: string;
  bookedForAt?: string | null;
  bookingNotes?: string | null;
}) {
  const referralCase = await prisma.referralCase.findUnique({
    where: { id: args.caseId },
    include: {
      clinicianDecision: true,
    },
  });

  if (!referralCase) {
    throw new Error("Referral case not found");
  }

  if (!referralCase.clinicianDecision) {
    throw new Error("Clinician decision is required before booking");
  }

  const operationalState = buildOperationalState({
    priority: referralCase.clinicianDecision.finalPriority,
    outcome: referralCase.clinicianDecision.finalOutcome,
    requiresSmoReview: referralCase.smoOnly,
  });

  if (!isOperationalWorkflowBookable(operationalState.workflow)) {
    throw new Error("This case cannot be booked for appointment in its current state");
  }

  const bookingNotes = args.bookingNotes?.trim() || null;
  const bookedForAt = args.bookedForAt?.trim()
    ? new Date(args.bookedForAt)
    : null;

  if (bookedForAt && Number.isNaN(bookedForAt.getTime())) {
    throw new Error("Booked date is invalid");
  }

  const nextStatus = bookedForAt ? "BOOKED" : "GRADED";

  const updatedCase = await prisma.$transaction(async (tx) => {
    const updated = await tx.referralCase.update({
      where: { id: referralCase.id },
      data: {
        bookedForAt,
        bookedAt: bookedForAt ? new Date() : null,
        bookingNotes,
        status: nextStatus,
      },
      include: {
        patient: {
          select: {
            id: true,
            nhi: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: args.actorUserId,
        action: "UPDATE",
        entity: "ReferralCaseBooking",
        entityId: referralCase.id,
        oldValue: JSON.stringify({
          bookedForAt: referralCase.bookedForAt,
          bookedAt: referralCase.bookedAt,
          bookingNotes: referralCase.bookingNotes,
          status: referralCase.status,
        }),
        newValue: JSON.stringify({
          bookedForAt,
          bookingNotes,
          status: nextStatus,
        }),
      },
    });

    return updated;
  });

  return updatedCase;
}
