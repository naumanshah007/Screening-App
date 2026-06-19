import type {
  BatchReviewDisposition,
  BatchRunSource,
  Prisma,
  UserRole,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type DecisionUser = {
  id?: string | null;
  role?: string | null;
};

export type CompletedDecisionAccess = "all" | "own" | "none";

export type CompletedDecisionFilters = {
  disposition?: string;
  source?: string;
  reviewerId?: string;
  urgency?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
};

export const COMPLETED_DECISION_ALL_ROLES: UserRole[] = [
  "ADMIN",
  "INTEGRATION_ADMIN",
  "COORDINATOR",
];

export const COMPLETED_DECISION_OWN_ROLES: UserRole[] = [
  "SMO_REVIEWER",
  "COLPOSCOPIST",
  "COLPO_CNS",
  "GYNAE_GRADER",
];

const COMPLETED_DISPOSITIONS: BatchReviewDisposition[] = [
  "ACCEPTED",
  "REJECTED",
  "NEEDS_INFO",
];

const SOURCES: BatchRunSource[] = [
  "DEMO",
  "CSV",
  "XLSX",
  "JSON",
  "MANUAL",
  "HL7",
  "FHIR",
  "ERMS",
  "HEALTH_NZ",
];

const USER_ROLES: UserRole[] = [
  "ADMIN",
  "SMO_REVIEWER",
  "COLPOSCOPIST",
  "COLPO_CNS",
  "GYNAE_GRADER",
  "COORDINATOR",
  "GP",
  "INTEGRATION_ADMIN",
];

export const SOURCE_LABELS: Record<string, string> = {
  DEMO: "Demo dataset",
  CSV: "CSV upload",
  XLSX: "Excel upload",
  JSON: "JSON upload",
  MANUAL: "Manual entry",
  HL7: "HL7v2 lab feed",
  FHIR: "FHIR preview",
  ERMS: "eReferral / ERMS",
  HEALTH_NZ: "Screening Register / Health NZ",
};

const reviewerSelect = {
  select: { id: true, name: true, email: true, role: true },
} satisfies Prisma.UserDefaultArgs;

const completedDecisionInclude = {
  reviewedBy: reviewerSelect,
  batchRun: {
    select: {
      id: true,
      source: true,
      sourceSystem: true,
      sourceFileName: true,
      createdAt: true,
      createdBy: reviewerSelect,
    },
  },
} satisfies Prisma.BatchReviewItemInclude;

export type CompletedDecisionRecord = Prisma.BatchReviewItemGetPayload<{
  include: typeof completedDecisionInclude;
}>;

function isUserRole(role: string | null | undefined): role is UserRole {
  return Boolean(role && USER_ROLES.includes(role as UserRole));
}

export function getCompletedDecisionAccess(user: DecisionUser): CompletedDecisionAccess {
  if (!isUserRole(user.role)) return "none";
  if (COMPLETED_DECISION_ALL_ROLES.includes(user.role)) return "all";
  if (COMPLETED_DECISION_OWN_ROLES.includes(user.role) && user.id) return "own";
  return "none";
}

export function canViewCompletedDecisions(user: DecisionUser) {
  return getCompletedDecisionAccess(user) !== "none";
}

function isCompletedDisposition(value: string | undefined): value is Exclude<BatchReviewDisposition, "PENDING"> {
  return Boolean(value && COMPLETED_DISPOSITIONS.includes(value as BatchReviewDisposition));
}

function isSource(value: string | undefined): value is BatchRunSource {
  return Boolean(value && SOURCES.includes(value as BatchRunSource));
}

function dateStart(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateEnd(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

export function buildUrgencyWhere(urgency?: string): Prisma.BatchReviewItemWhereInput | null {
  if (urgency === "mandatory") return { reviewRequired: true };
  if (urgency === "urgent") {
    return {
      OR: [
        { riskLevel: "URGENT" },
        { referralPriority: { in: ["P1", "P1_HSC"] } },
      ],
    };
  }
  if (urgency === "routine") {
    return {
      reviewRequired: false,
      NOT: [
        { riskLevel: "URGENT" },
        { referralPriority: { in: ["P1", "P1_HSC"] } },
      ],
    };
  }
  return null;
}

export function buildCompletedDecisionWhere(
  user: DecisionUser,
  filters: CompletedDecisionFilters = {}
): Prisma.BatchReviewItemWhereInput {
  const access = getCompletedDecisionAccess(user);
  if (access === "none") return { id: "__no_completed_decision_access__" };

  const clauses: Prisma.BatchReviewItemWhereInput[] = [
    { disposition: { in: COMPLETED_DISPOSITIONS } },
  ];

  if (access === "own") {
    clauses.push({ reviewedByUserId: user.id ?? "__missing_user_id__" });
  }

  if (isCompletedDisposition(filters.disposition)) {
    clauses.push({ disposition: filters.disposition });
  }

  if (isSource(filters.source)) {
    clauses.push({ batchRun: { source: filters.source } });
  }

  if (access === "all" && filters.reviewerId) {
    clauses.push({ reviewedByUserId: filters.reviewerId });
  }

  const urgencyWhere = buildUrgencyWhere(filters.urgency);
  if (urgencyWhere) clauses.push(urgencyWhere);

  const from = dateStart(filters.dateFrom);
  const to = dateEnd(filters.dateTo);
  if (from || to) {
    clauses.push({
      reviewedAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    });
  }

  const q = filters.q?.trim();
  if (q) {
    clauses.push({
      OR: [
        { patientName: { contains: q } },
        { nhi: { contains: q } },
        { externalPatientId: { contains: q } },
        { gpPractice: { contains: q } },
      ],
    });
  }

  return clauses.length === 1 ? clauses[0] : { AND: clauses };
}

export async function listCompletedDecisions(args: {
  user: DecisionUser;
  filters?: CompletedDecisionFilters;
  limit?: number;
}): Promise<CompletedDecisionRecord[]> {
  if (!canViewCompletedDecisions(args.user)) return [];

  return prisma.batchReviewItem.findMany({
    where: buildCompletedDecisionWhere(args.user, args.filters),
    include: completedDecisionInclude,
    orderBy: [{ reviewedAt: "desc" }, { updatedAt: "desc" }],
    take: args.limit ?? 300,
  });
}

export async function getCompletedDecisionForUser(
  id: string,
  user: DecisionUser
): Promise<CompletedDecisionRecord | null> {
  if (!canViewCompletedDecisions(user)) return null;

  return prisma.batchReviewItem.findFirst({
    where: {
      AND: [
        buildCompletedDecisionWhere(user),
        { id },
      ],
    },
    include: completedDecisionInclude,
  });
}

export async function getCompletedDecisionFilterOptions(user: DecisionUser) {
  if (!canViewCompletedDecisions(user)) {
    return { sources: [], reviewers: [] };
  }

  const rows = await prisma.batchReviewItem.findMany({
    where: buildCompletedDecisionWhere(user),
    select: {
      batchRun: { select: { source: true, sourceSystem: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { reviewedAt: "desc" },
    take: 500,
  });

  const sourceMap = new Map<string, string>();
  const reviewerMap = new Map<string, string>();

  for (const row of rows) {
    sourceMap.set(
      row.batchRun.source,
      row.batchRun.sourceSystem ?? SOURCE_LABELS[row.batchRun.source] ?? row.batchRun.source
    );
    if (row.reviewedBy?.id) {
      reviewerMap.set(
        row.reviewedBy.id,
        row.reviewedBy.name ?? row.reviewedBy.email ?? "Reviewer"
      );
    }
  }

  return {
    sources: Array.from(sourceMap, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    reviewers: Array.from(reviewerMap, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}
