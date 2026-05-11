import { Prisma } from "@prisma/client";
import { addDays, endOfDay, startOfDay } from "date-fns";

import { getWorkflowPriorityValues } from "@/lib/cases/operational";
import { calculateCaseTargetDueAt } from "@/lib/cases/sla";
import { prisma } from "@/lib/prisma";
import type {
  CreateReferralCaseInput,
  ListReferralCasesFilters,
  UpdateReferralCaseInput,
} from "@/lib/cases/types";

const referralCaseInclude = {
  patient: {
    select: {
      id: true,
      nhi: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gpPractice: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  clinicianDecision: {
    select: {
      id: true,
      finalPriority: true,
      finalCategory: true,
      finalOutcome: true,
    },
  },
  summary: {
    select: {
      id: true,
      status: true,
      updatedAt: true,
      approvedAt: true,
    },
  },
  documents: {
    select: {
      id: true,
      parseStatus: true,
    },
  },
  extractedFacts: {
    select: {
      id: true,
    },
  },
  ruleDecision: {
    select: {
      id: true,
      priority: true,
      category: true,
      outcome: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ReferralCaseInclude;

export type ReferralCaseRecord = Prisma.ReferralCaseGetPayload<{
  include: typeof referralCaseInclude;
}>;

const intakeAssigneeRoles = [
  "ADMIN",
  "COORDINATOR",
  "COLPOSCOPIST",
  "COLPO_CNS",
  "GYNAE_GRADER",
  "SMO_REVIEWER",
] as const;

export async function getReferralCaseIntakeOptions() {
  const [patients, assignees] = await Promise.all([
    prisma.patient.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        nhi: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gpPractice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
      take: 250,
    }),
    prisma.user.findMany({
      where: {
        role: {
          in: [...intakeAssigneeRoles],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
    }),
  ]);

  return { patients, assignees };
}

function buildSlaBucketWhere(
  filters: ListReferralCasesFilters
): Prisma.ReferralCaseWhereInput | undefined {
  if (!filters.slaBucket) {
    return undefined;
  }

  const now = startOfDay(new Date());
  const dueSoonLimit = endOfDay(addDays(now, 3));
  const activeStatuses: Prisma.ReferralCaseWhereInput = {
    status: { notIn: ["REJECTED", "RETURNED_TO_GP", "CLOSED"] },
  };

  switch (filters.slaBucket) {
    case "OVERDUE":
      return {
        AND: [
          activeStatuses,
          { bookedForAt: null },
          { targetDueAt: { lt: now } },
        ],
      };
    case "DUE_SOON":
      return {
        AND: [
          activeStatuses,
          { bookedForAt: null },
          { targetDueAt: { gte: now, lte: dueSoonLimit } },
        ],
      };
    case "BOOKED":
      return { bookedForAt: { not: null } };
    case "ON_TRACK":
      return {
        AND: [
          activeStatuses,
          { bookedForAt: null },
          { targetDueAt: { gt: dueSoonLimit } },
        ],
      };
    case "NO_TARGET":
      return {
        AND: [
          activeStatuses,
          { bookedForAt: null },
          { targetDueAt: null },
        ],
      };
    default:
      return undefined;
  }
}

function buildWorkflowWhere(
  filters: ListReferralCasesFilters
): Prisma.ReferralCaseWhereInput | undefined {
  if (!filters.workflow) {
    return undefined;
  }

  if (filters.workflow === "PENDING_REVIEW") {
    return {
      AND: [
        { currentPriority: null },
        { clinicianDecision: { is: null } },
        { ruleDecision: { is: null } },
      ],
    };
  }

  const priorities = getWorkflowPriorityValues(filters.workflow);
  if (priorities.length === 0) {
    return undefined;
  }

  return {
    OR: [
      { currentPriority: { in: priorities } },
      {
        clinicianDecision: {
          is: { finalPriority: { in: priorities } },
        },
      },
      {
        ruleDecision: {
          is: { priority: { in: priorities } },
        },
      },
    ],
  };
}

export function buildReferralCaseWhere(
  filters: ListReferralCasesFilters
): Prisma.ReferralCaseWhereInput {
  const andClauses: Prisma.ReferralCaseWhereInput[] = [];

  if (filters.serviceLine) {
    andClauses.push({ serviceLine: filters.serviceLine });
  }
  if (filters.status) {
    andClauses.push({ status: filters.status });
  }
  if (filters.currentPriority) {
    andClauses.push({ currentPriority: filters.currentPriority });
  }
  if (filters.requiresSmoReview !== undefined) {
    andClauses.push({ smoOnly: filters.requiresSmoReview });
  }
  if (filters.assignedToUserId) {
    andClauses.push({ assignedToUserId: filters.assignedToUserId });
  }

  const workflowWhere = buildWorkflowWhere(filters);
  if (workflowWhere) {
    andClauses.push(workflowWhere);
  }

  const slaBucketWhere = buildSlaBucketWhere(filters);
  if (slaBucketWhere) {
    andClauses.push(slaBucketWhere);
  }

  if (filters.search) {
    andClauses.push({
      OR: [
        { referralReason: { contains: filters.search } },
        { currentCategory: { contains: filters.search } },
        { externalCaseId: { contains: filters.search } },
        {
          patient: {
            is: {
              OR: [
                { nhi: { contains: filters.search } },
                { firstName: { contains: filters.search } },
                { lastName: { contains: filters.search } },
              ],
            },
          },
        },
      ],
    });
  }

  return andClauses.length > 0 ? { AND: andClauses } : {};
}

export async function listReferralCases(filters: ListReferralCasesFilters) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const where = buildReferralCaseWhere(filters);

  const [cases, total] = await Promise.all([
    prisma.referralCase.findMany({
      where,
      include: referralCaseInclude,
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.referralCase.count({ where }),
  ]);

  return { cases, total, page, limit };
}

export async function getReferralCaseById(id: string) {
  return prisma.referralCase.findUnique({
    where: { id },
    include: referralCaseInclude,
  });
}

export async function createReferralCase(
  input: CreateReferralCaseInput,
  actorUserId: string
) {
  const [patient, assignee, parentCase] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: input.patientId },
      select: { id: true },
    }),
    input.assignedToUserId
      ? prisma.user.findUnique({
          where: { id: input.assignedToUserId },
          select: { id: true },
        })
      : Promise.resolve(null),
    input.regradeOfCaseId
      ? prisma.referralCase.findUnique({
          where: { id: input.regradeOfCaseId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!patient) {
    throw new Error("Patient not found");
  }
  if (input.assignedToUserId && !assignee) {
    throw new Error("Assigned user not found");
  }
  if (input.regradeOfCaseId && !parentCase) {
    throw new Error("regradeOfCaseId does not match an existing case");
  }

  const createdCase = await prisma.referralCase.create({
    data: {
      patientId: input.patientId,
      serviceLine: input.serviceLine,
      status: "NEW",
      receivedAt: input.receivedAt ?? new Date(),
      referralSource: input.referralSource,
      externalCaseId: input.externalCaseId,
      referralReason: input.referralReason,
      currentPriority: input.currentPriority,
      currentCategory: input.currentCategory,
      assignedToUserId: input.assignedToUserId,
      createdByUserId: actorUserId,
      highSuspicionCancer: input.highSuspicionCancer ?? false,
      smoOnly: input.smoOnly ?? false,
      regradeOfCaseId: input.regradeOfCaseId,
      triageNotes: input.triageNotes,
      // Colposcopy-specific fields
      fctStatus: input.fctStatus,
      hpvTestResult: input.hpvTestResult,
      hpvType: input.hpvType,
      cytologySample: input.cytologySample,
      referrerReasonCode: input.referrerReasonCode,
      assessmentOfReferral: input.assessmentOfReferral,
      bookingPriorityNote: input.bookingPriorityNote,
      referralType: input.referralType,
      ovestinInstruction: input.ovestinInstruction,
      ncsrNoteAdded: input.ncsrNoteAdded,
      referralNoteAdded: input.referralNoteAdded,
      internalTriageNotes: input.internalTriageNotes,
      // Gynaecology-specific fields
      gynaecologyCategory: input.gynaecologyCategory,
      ussAvailable: input.ussAvailable,
      ussFindings: input.ussFindings,
    },
    include: referralCaseInclude,
  });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: "CREATE",
      entity: "ReferralCase",
      entityId: createdCase.id,
      newValue: JSON.stringify({
        serviceLine: createdCase.serviceLine,
        status: createdCase.status,
        currentPriority: createdCase.currentPriority,
        patientId: createdCase.patientId,
      }),
    },
  });

  return createdCase;
}

export async function updateReferralCase(
  caseId: string,
  input: UpdateReferralCaseInput,
  actorUserId: string
) {
  const existingCase = await prisma.referralCase.findUnique({
    where: { id: caseId },
    include: {
      clinicianDecision: true,
    },
  });

  if (!existingCase) {
    throw new Error("Referral case not found");
  }

  const [assignee, parentCase] = await Promise.all([
    input.assignedToUserId
      ? prisma.user.findUnique({
          where: { id: input.assignedToUserId },
          select: { id: true },
        })
      : Promise.resolve(null),
    input.regradeOfCaseId
      ? prisma.referralCase.findUnique({
          where: { id: input.regradeOfCaseId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (input.assignedToUserId && !assignee) {
    throw new Error("Assigned user not found");
  }
  if (input.regradeOfCaseId && input.regradeOfCaseId === caseId) {
    throw new Error("regradeOfCaseId cannot point to the same case");
  }
  if (input.regradeOfCaseId && !parentCase) {
    throw new Error("regradeOfCaseId does not match an existing case");
  }

  const nextReceivedAt = input.receivedAt ?? existingCase.receivedAt;
  const targetPriority =
    existingCase.clinicianDecision?.finalPriority ?? existingCase.currentPriority;
  const shouldRecalculateTargetDueAt = input.receivedAt !== undefined;
  const targetDueAt = shouldRecalculateTargetDueAt
    ? calculateCaseTargetDueAt(
        nextReceivedAt,
        existingCase.serviceLine,
        targetPriority
      )
    : undefined;

  const updateData: Prisma.ReferralCaseUncheckedUpdateInput = {};
  if (input.receivedAt !== undefined) updateData.receivedAt = input.receivedAt;
  if (input.referralSource !== undefined) updateData.referralSource = input.referralSource;
  if (input.externalCaseId !== undefined) updateData.externalCaseId = input.externalCaseId;
  if (input.referralReason !== undefined) updateData.referralReason = input.referralReason;
  if (input.currentCategory !== undefined) updateData.currentCategory = input.currentCategory;
  if (input.assignedToUserId !== undefined) updateData.assignedToUserId = input.assignedToUserId;
  if (input.highSuspicionCancer !== undefined) {
    updateData.highSuspicionCancer = input.highSuspicionCancer;
  }
  if (input.smoOnly !== undefined) updateData.smoOnly = input.smoOnly;
  if (input.regradeOfCaseId !== undefined) updateData.regradeOfCaseId = input.regradeOfCaseId;
  if (input.triageNotes !== undefined) updateData.triageNotes = input.triageNotes;
  if (targetDueAt !== undefined) updateData.targetDueAt = targetDueAt;
  // Colposcopy-specific fields
  if (input.fctStatus !== undefined) updateData.fctStatus = input.fctStatus;
  if (input.hpvTestResult !== undefined) updateData.hpvTestResult = input.hpvTestResult;
  if (input.hpvType !== undefined) updateData.hpvType = input.hpvType;
  if (input.cytologySample !== undefined) updateData.cytologySample = input.cytologySample;
  if (input.referrerReasonCode !== undefined) updateData.referrerReasonCode = input.referrerReasonCode;
  if (input.assessmentOfReferral !== undefined) updateData.assessmentOfReferral = input.assessmentOfReferral;
  if (input.bookingPriorityNote !== undefined) updateData.bookingPriorityNote = input.bookingPriorityNote;
  if (input.referralType !== undefined) updateData.referralType = input.referralType;
  if (input.ovestinInstruction !== undefined) updateData.ovestinInstruction = input.ovestinInstruction;
  if (input.ncsrNoteAdded !== undefined) updateData.ncsrNoteAdded = input.ncsrNoteAdded;
  if (input.referralNoteAdded !== undefined) updateData.referralNoteAdded = input.referralNoteAdded;
  if (input.internalTriageNotes !== undefined) updateData.internalTriageNotes = input.internalTriageNotes;
  // Gynaecology-specific fields
  if (input.gynaecologyCategory !== undefined) updateData.gynaecologyCategory = input.gynaecologyCategory;
  if (input.ussAvailable !== undefined) updateData.ussAvailable = input.ussAvailable;
  if (input.ussFindings !== undefined) updateData.ussFindings = input.ussFindings;

  const updatedCase = await prisma.referralCase.update({
    where: { id: caseId },
    data: updateData,
    include: referralCaseInclude,
  });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: "UPDATE",
      entity: "ReferralCase",
      entityId: updatedCase.id,
      oldValue: JSON.stringify({
        receivedAt: existingCase.receivedAt,
        referralSource: existingCase.referralSource,
        externalCaseId: existingCase.externalCaseId,
        referralReason: existingCase.referralReason,
        currentCategory: existingCase.currentCategory,
        assignedToUserId: existingCase.assignedToUserId,
        highSuspicionCancer: existingCase.highSuspicionCancer,
        smoOnly: existingCase.smoOnly,
        regradeOfCaseId: existingCase.regradeOfCaseId,
        triageNotes: existingCase.triageNotes,
        targetDueAt: existingCase.targetDueAt,
      }),
      newValue: JSON.stringify({
        receivedAt: updatedCase.receivedAt,
        referralSource: updatedCase.referralSource,
        externalCaseId: updatedCase.externalCaseId,
        referralReason: updatedCase.referralReason,
        currentCategory: updatedCase.currentCategory,
        assignedToUserId: updatedCase.assignedToUserId,
        highSuspicionCancer: updatedCase.highSuspicionCancer,
        smoOnly: updatedCase.smoOnly,
        regradeOfCaseId: updatedCase.regradeOfCaseId,
        triageNotes: updatedCase.triageNotes,
        targetDueAt: updatedCase.targetDueAt,
      }),
    },
  });

  return updatedCase;
}

export async function recordReferralCaseRead(caseId: string, actorUserId?: string) {
  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: "READ",
      entity: "ReferralCase",
      entityId: caseId,
    },
  });
}
