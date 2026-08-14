import type {
  Prisma,
  UsageEventCorrectionReasonCode,
  UsageEventCorrectionType,
} from "@prisma/client";

export const USAGE_EVENT_NOT_FOUND = "USAGE_EVENT_NOT_FOUND";
export const USAGE_EVENT_CORRECTION_ORGANISATION_MISMATCH =
  "USAGE_EVENT_CORRECTION_ORGANISATION_MISMATCH";
export const USAGE_EVENT_ALREADY_INVALIDATED_DIFFERENTLY =
  "USAGE_EVENT_ALREADY_INVALIDATED_DIFFERENTLY";

/** Explicit allow-list. Callers cannot pass an arbitrary object that might
 * contain payload, credential, patient or connector material. */
export type UsageCorrectionMetadata = {
  remediationId?: string;
  defect?: "EPISODE_REGISTRATION_TRANSACTION_ROLLBACK";
  deploymentSha?: string;
};

function metadataJson(metadata: UsageCorrectionMetadata | undefined) {
  if (!metadata) return null;
  const safe: UsageCorrectionMetadata = {};
  if (metadata.remediationId) safe.remediationId = metadata.remediationId;
  if (metadata.defect) safe.defect = metadata.defect;
  if (metadata.deploymentSha) safe.deploymentSha = metadata.deploymentSha;
  return Object.keys(safe).length ? JSON.stringify(safe) : null;
}

export type RecordUsageEventCorrectionArgs = {
  tx: Prisma.TransactionClient;
  usageEventId: string;
  organisationId: string;
  correctionType: UsageEventCorrectionType;
  reasonCode: UsageEventCorrectionReasonCode;
  reasonDetail?: string | null;
  actorUserId?: string | null;
  systemActor?: string | null;
  metadata?: UsageCorrectionMetadata;
};

/**
 * Append one terminal correction, idempotently.
 *
 * An exact retry is a no-op. A second attempt with different provenance or
 * reasoning is rejected rather than silently turning one event into an
 * ambiguous correction history.
 */
export async function recordUsageEventCorrection(
  args: RecordUsageEventCorrectionArgs
): Promise<boolean> {
  const usageEvent = await args.tx.usageEvent.findUnique({
    where: { id: args.usageEventId },
    select: { organisationId: true },
  });
  if (!usageEvent) throw new Error(USAGE_EVENT_NOT_FOUND);
  if (usageEvent.organisationId !== args.organisationId) {
    throw new Error(USAGE_EVENT_CORRECTION_ORGANISATION_MISMATCH);
  }

  const normalized = {
    reasonDetail: args.reasonDetail?.trim() || null,
    actorUserId: args.actorUserId ?? null,
    systemActor: args.systemActor?.trim() || null,
    metadataJson: metadataJson(args.metadata),
  };

  try {
    await args.tx.usageEventCorrection.create({
      data: {
        usageEventId: args.usageEventId,
        organisationId: args.organisationId,
        correctionType: args.correctionType,
        reasonCode: args.reasonCode,
        ...normalized,
      },
    });
    return true;
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;

    const existing = await args.tx.usageEventCorrection.findUnique({
      where: {
        usageEventId_correctionType: {
          usageEventId: args.usageEventId,
          correctionType: args.correctionType,
        },
      },
    });
    if (
      existing &&
      existing.reasonCode === args.reasonCode &&
      existing.reasonDetail === normalized.reasonDetail &&
      existing.actorUserId === normalized.actorUserId &&
      existing.systemActor === normalized.systemActor &&
      existing.organisationId === args.organisationId &&
      existing.metadataJson === normalized.metadataJson
    ) {
      return false;
    }

    throw new Error(USAGE_EVENT_ALREADY_INVALIDATED_DIFFERENTLY);
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code === "P2002") return true;
  return /UNIQUE constraint failed/i.test(
    error instanceof Error ? error.message : ""
  );
}
