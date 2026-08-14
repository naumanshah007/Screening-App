import type { Prisma } from "@prisma/client";

import { recordUsageEvent } from "@/lib/usage/usage-events";

export type PersistedRegradeIdentity = {
  id: string;
  ruleVersionId: string;
  previousEvaluationId: string | null;
  regradeReason: string | null;
};

/** An exact route retry reuses the immutable regrade already persisted for the
 * same target and reason. A deliberately different reason creates a new linked
 * evaluation and therefore a distinct REGRADE usage fact. */
export function isPersistedManualRegradeRetry(args: {
  evaluation: PersistedRegradeIdentity | null;
  targetRuleVersionId: string;
  reason: string;
}) {
  const evaluation = args.evaluation;
  return Boolean(
    evaluation?.previousEvaluationId &&
      evaluation.ruleVersionId === args.targetRuleVersionId &&
      evaluation.regradeReason?.trim() === args.reason.trim()
  );
}

/** Meter one successfully persisted manual governed re-evaluation. The
 * immutable evaluation id is the business/idempotency identity, so retrying the
 * metering step cannot create another REGRADE event. */
export function recordManualRegradeUsage(args: {
  tx: Prisma.TransactionClient;
  organisationId: string;
  episodeId: string;
  batchReviewItemId: string;
  ruleEvaluationId: string;
  batchRunId: string;
  rulesetVersion: string;
  rulesetChecksum?: string | null;
  source: string;
}) {
  return recordUsageEvent({
    tx: args.tx,
    organisationId: args.organisationId,
    episodeId: args.episodeId,
    eventType: "REGRADE",
    classification: "MANUAL_REGRADE",
    batchReviewItemId: args.batchReviewItemId,
    ruleEvaluationId: args.ruleEvaluationId,
    batchRunId: args.batchRunId,
    rulesetVersion: args.rulesetVersion,
    rulesetChecksum: args.rulesetChecksum ?? null,
    source: args.source,
  });
}
