import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const ENTERPRISE_INTEGRATION_IDS = [
  "database",
  "storage",
  "ai",
  "ncsr",
] as const;

export type EnterpriseIntegrationId =
  (typeof ENTERPRISE_INTEGRATION_IDS)[number];

export type IntegrationValidationOutcomeValue =
  | "PASSED"
  | "WARNING"
  | "FAILED";

const validationInclude = {
  validatedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.IntegrationValidationInclude;

export type IntegrationValidationRecord = Prisma.IntegrationValidationGetPayload<{
  include: typeof validationInclude;
}>;

export type IntegrationValidationState = {
  kind: "none" | "passed" | "warning" | "failed" | "expired";
  label: string;
  summary: string;
  detail: string;
  recommendedAction?: string;
  record: IntegrationValidationRecord | null;
};

export async function listLatestIntegrationValidations() {
  const records = await prisma.integrationValidation.findMany({
    where: {
      integrationId: {
        in: [...ENTERPRISE_INTEGRATION_IDS],
      },
    },
    include: validationInclude,
    orderBy: [{ validatedAt: "desc" }, { createdAt: "desc" }],
  });

  const latest = new Map<EnterpriseIntegrationId, IntegrationValidationRecord>();
  for (const record of records) {
    const integrationId = record.integrationId as EnterpriseIntegrationId;
    if (!latest.has(integrationId)) {
      latest.set(integrationId, record);
    }
  }

  return latest;
}

export async function getLatestIntegrationValidation(
  integrationId: EnterpriseIntegrationId
) {
  return prisma.integrationValidation.findFirst({
    where: { integrationId },
    include: validationInclude,
    orderBy: [{ validatedAt: "desc" }, { createdAt: "desc" }],
  });
}

function formatReviewer(record: IntegrationValidationRecord) {
  return record.validatedBy.name ?? record.validatedBy.email;
}

export function buildIntegrationValidationState(
  record: IntegrationValidationRecord | null
): IntegrationValidationState {
  if (!record) {
    return {
      kind: "none",
      label: "No validation recorded",
      summary: "No formal validation record is on file for this integration.",
      detail:
        "The integration may be configured, but there is no governed sign-off showing a controlled test was completed.",
      recommendedAction:
        "Record a controlled validation before treating this integration as live-service ready.",
      record: null,
    };
  }

  const reviewer = formatReviewer(record);
  const validatedAt = record.validatedAt.toLocaleDateString("en-NZ");
  const expiresAt = record.expiresAt?.toLocaleDateString("en-NZ");

  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
    return {
      kind: "expired",
      label: "Validation expired",
      summary: "A formal validation was recorded, but it has now expired.",
      detail: `${record.summary} Last validated ${validatedAt} by ${reviewer}.${expiresAt ? ` Expired ${expiresAt}.` : ""}`,
      recommendedAction:
        "Run the controlled validation again and record a fresh result.",
      record,
    };
  }

  if (record.outcome === "FAILED") {
    return {
      kind: "failed",
      label: "Validation failed",
      summary: "The latest formal validation did not pass.",
      detail: `${record.summary} Recorded ${validatedAt} by ${reviewer}.`,
      recommendedAction:
        "Resolve the failure and record a new passing validation before live use.",
      record,
    };
  }

  if (record.outcome === "WARNING") {
    return {
      kind: "warning",
      label: "Validated with caution",
      summary: "A formal validation is on file, but it includes cautions or follow-up work.",
      detail: `${record.summary} Recorded ${validatedAt} by ${reviewer}.${expiresAt ? ` Review again by ${expiresAt}.` : ""}`,
      recommendedAction:
        "Close the outstanding cautions or record a clean validation result after follow-up.",
      record,
    };
  }

  return {
    kind: "passed",
    label: "Validation passed",
    summary: "A formal validation record is on file.",
    detail: `${record.summary} Recorded ${validatedAt} by ${reviewer}.${expiresAt ? ` Valid until ${expiresAt}.` : ""}`,
    record,
  };
}

export async function getIntegrationValidationStateMap() {
  const latest = await listLatestIntegrationValidations();
  const stateMap = new Map<EnterpriseIntegrationId, IntegrationValidationState>();

  for (const integrationId of ENTERPRISE_INTEGRATION_IDS) {
    stateMap.set(
      integrationId,
      buildIntegrationValidationState(latest.get(integrationId) ?? null)
    );
  }

  return stateMap;
}

export async function saveIntegrationValidation(args: {
  integrationId: EnterpriseIntegrationId;
  environment?: string | null;
  outcome: IntegrationValidationOutcomeValue;
  summary: string;
  notes?: string | null;
  validatedAt: Date;
  expiresAt?: Date | null;
  validatedByUserId: string;
}) {
  const created = await prisma.$transaction(async (tx) => {
    const validation = await tx.integrationValidation.create({
      data: {
        integrationId: args.integrationId,
        environment: args.environment?.trim() || "current",
        outcome: args.outcome,
        summary: args.summary.trim(),
        notes: args.notes?.trim() || null,
        validatedAt: args.validatedAt,
        expiresAt: args.expiresAt ?? null,
        validatedByUserId: args.validatedByUserId,
      },
      include: validationInclude,
    });

    await tx.auditLog.create({
      data: {
        userId: args.validatedByUserId,
        action: "CREATE",
        entity: "IntegrationValidation",
        entityId: validation.id,
        newValue: JSON.stringify({
          integrationId: args.integrationId,
          outcome: args.outcome,
          summary: args.summary.trim(),
          notes: args.notes?.trim() || null,
          environment: args.environment?.trim() || "current",
          validatedAt: args.validatedAt.toISOString(),
          expiresAt: args.expiresAt?.toISOString() ?? null,
        }),
      },
    });

    return validation;
  });

  return created;
}
