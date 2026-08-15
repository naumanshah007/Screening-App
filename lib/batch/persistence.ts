/**
 * Batch Persistence + Review Worklist
 *
 * Bridges the in-memory batch decision engine to a persisted reviewer queue.
 *
 * Before this, a batch run computed recommendations and threw them away.
 * Now a run is saved as a BatchRun + BatchReviewItem[], so a reviewer can
 * open the worklist, see every pre-graded case with its full picture, and
 * bulk accept / reject / mark-for-info — with an audit trail on every action.
 *
 * The input is a `BatchProcessingResult` (see lib/batch/processor.ts), which is
 * source-agnostic: it looks the same whether the rows came from a CSV upload,
 * an HL7v2 lab feed, or an ERMS eReferral. Only the `source` enum differs.
 */

import { Prisma, type BatchReviewDisposition } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ensureDatabaseReady } from "@/lib/database/bootstrap";
import type {
  BatchProcessingResult,
  BatchCaseResult,
  CanonicalBatchCase,
  SourceType,
  IntakeParseManifest,
} from "@/lib/batch/types";
import { getRuntimeClinicalEnvironment, resolveClinicalAuthority } from "@/lib/clinical-rules/authority";
import { evaluateGradedDecision } from "@/lib/clinical-rules/graded-decision";
import { resolveShadowClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";
import { requireCurrentOrganisationId } from "@/lib/organisation/current-organisation";
import { clinicalPayloadDigest, rawPayloadDigest } from "@/lib/batch/source-identity";
import { processBatch } from "@/lib/batch/processor";
import { recordUsageEvent, usageEventTypeFor } from "@/lib/usage/usage-events";
import {
  classifyIncomingCases,
  identityForCase,
  recordEpisodeObservation,
} from "@/lib/batch/episode-registry";
import { safeLogError } from "@/lib/security/safe-logging";

/**
 * The most recent governed evaluation for an episode, if any.
 *
 * Used to link an amended result to what it supersedes. Returns null when the
 * episode is new, has no prior evaluation, or is not yet known — all of which
 * simply mean there is nothing to succeed.
 */
async function findPriorEvaluationForEpisode(
  episodeId: string | null,
  currentItemId: string
) {
  if (!episodeId) return null;

  const previous = await prisma.batchReviewItem.findFirst({
    // The current item is excluded explicitly rather than relying on its
    // evaluation being unwritten: an item must never be recorded as superseding
    // itself, and that must not depend on the order of two writes.
    where: {
      episodeId,
      id: { not: currentItemId },
      ruleEvaluationId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { ruleEvaluationId: true },
  });

  return previous?.ruleEvaluationId ? { id: previous.ruleEvaluationId } : null;
}

// ─── Source mapping ───────────────────────────────────────────────────────────

const SOURCE_TYPE_TO_ENUM: Record<SourceType, Prisma.BatchRunCreateInput["source"]> = {
  demo: "DEMO",
  csv: "CSV",
  xlsx: "XLSX",
  json: "JSON",
  manual: "MANUAL",
  hl7: "HL7",
  fhir: "FHIR",
  erms: "ERMS",
  "health-nz": "HEALTH_NZ",
};

function mapSourceType(sourceType: SourceType): Prisma.BatchRunCreateInput["source"] {
  return SOURCE_TYPE_TO_ENUM[sourceType] ?? "MANUAL";
}

/**
 * Whether the engine refused to silently auto-decide this case. These are the
 * cases a reviewer MUST open — the rest can usually be bulk-accepted.
 */
export function isReviewRequired(item: BatchCaseResult): boolean {
  if (item.status === "error") return true;
  const d = item.decision;
  if (d.safetyOutcome) return true; // INSUFFICIENT_INFORMATION / EXTERNAL_HISTORY_REQUIRED / CLINICIAN_REVIEW_REQUIRED
  if (d.validationStatus && d.validationStatus !== "IMPLEMENTED") return true;
  if ((d.missingInformation?.length ?? 0) > 0) return true;
  if ((d.externalDependencies?.length ?? 0) > 0) return true;
  return false;
}

// ─── Includes ─────────────────────────────────────────────────────────────────

const reviewerSelect = {
  select: { id: true, name: true, email: true, role: true },
} satisfies Prisma.UserDefaultArgs;

const batchRunListInclude = {
  createdBy: reviewerSelect,
} satisfies Prisma.BatchRunInclude;

const batchRunDetailInclude = {
  createdBy: reviewerSelect,
  items: {
    orderBy: [{ reviewRequired: "desc" }, { rowNumber: "asc" }],
    include: { reviewedBy: reviewerSelect, ruleEvaluation: true },
  },
} satisfies Prisma.BatchRunInclude;

export type BatchRunListRecord = Prisma.BatchRunGetPayload<{
  include: typeof batchRunListInclude;
}>;

export type BatchRunDetailRecord = Prisma.BatchRunGetPayload<{
  include: typeof batchRunDetailInclude;
}>;

export type BatchReviewItemRecord = BatchRunDetailRecord["items"][number];

export class DuplicateIngestionReceiptError extends Error {
  constructor(
    public readonly existingRunId: string | null,
    public readonly receivedAt: Date,
    public readonly caseCount: number
  ) {
    super("This file has already been received and was not processed again.");
    this.name = "DuplicateIngestionReceiptError";
  }
}

// ─── Save a run ────────────────────────────────────────────────────────────────

/**
 * Fail-closed markers used when the current governed ruleset cannot evaluate a
 * new case. These describe the ABSENCE of a governed recommendation — they are
 * a safety state, not clinical guidance, and deliberately carry no timing,
 * priority or referral action.
 */
const NO_GOVERNED_RESULT_CODE = "NO-GOVERNED-RECOMMENDATION";
const NO_GOVERNED_RESULT_TEXT =
  "No governed recommendation available — clinician review required.";

/**
 * caseJson retains the deterministic clinical snapshot but omits identity and
 * episode-display fields already held in dedicated columns. Those columns are
 * required for reviewer/search/audit use; duplicating them inside JSON adds no
 * operational value and increases the sensitive-data footprint.
 */
export function minimizePersistedBatchCase(c: CanonicalBatchCase) {
  const minimized: CanonicalBatchCase = {
    ...c,
    source: { ...c.source },
  };
  delete minimized.patientName;
  delete minimized.nhi;
  delete minimized.gpPractice;
  delete minimized.receivedDate;
  delete minimized.source.externalPatientId;
  delete minimized.source.sourceEpisodeKey;
  delete minimized.source.sourceFacility;
  delete minimized.source.testType;
  delete minimized.source.collectedOn;
  return minimized;
}

export async function saveBatchRun(args: {
  result: BatchProcessingResult;
  actorUserId: string;
  sourceSystem?: string;
  deliveryKey?: string | null;
  intakeSourceType?: SourceType;
  parseManifest: IntakeParseManifest;
  /**
   * Arrivals that were pulled in this intake but deliberately NOT sent for
   * review — automatically deselected duplicates, or rows the operator
   * unticked.
   *
   * They are recorded as observations with no review item. Without them a
   * correctly-suppressed result leaves no trace at all and is indistinguishable
   * from one that was lost, which is the exact question a service asks first:
   * "what happened to the result we sent you?"
   */
  withheldCases?: CanonicalBatchCase[];
}): Promise<BatchRunDetailRecord> {
  const { result, actorUserId, parseManifest } = args;

  const reviewRequiredCount = result.results.filter(isReviewRequired).length;
  const runtimeEnvironment = getRuntimeClinicalEnvironment();
  const resolvedAuthority = await resolveClinicalAuthority({ environment: runtimeEnvironment });
  const shadowRuleVersion = await resolveShadowClinicalRuleVersion().catch(() => null);
  const runRuleVersion =
    resolvedAuthority.authorityEngine === "CANONICAL" && resolvedAuthority.ruleSetVersionId
      ? {
          id: resolvedAuthority.ruleSetVersionId,
          displayVersion: resolvedAuthority.ruleSetVersion,
          checksum: resolvedAuthority.ruleSetChecksum,
        }
      : shadowRuleVersion;

  const itemData: Prisma.BatchReviewItemCreateWithoutBatchRunInput[] =
    result.results.map((item) => {
      const c = item.case;
      const d = item.decision;
      return {
        rowNumber: c.source.rowNumber,
        label: c.label ?? null,
        externalPatientId: c.source.externalPatientId ?? null,
        patientAge: c.patientAge ?? null,
        ethnicityPrimary: c.ethnicityPrimary ?? null,
        patientName: c.patientName ?? null,
        nhi: c.nhi ?? c.source.externalPatientId ?? null,
        gpPractice: c.gpPractice ?? null,
        receivedDate: c.receivedDate ? new Date(c.receivedDate) : null,
        // Episode identity, stored in clear alongside the digests so any later
        // match can be explained in the source's own terms.
        sourceEpisodeKey: c.source.sourceEpisodeKey ?? null,
        sourceFacility: c.source.sourceFacility ?? c.source.sourceSystem ?? null,
        testType: c.source.testType ?? null,
        collectedOn: c.source.collectedOn ? new Date(c.source.collectedOn) : null,
        rawPayloadDigest: rawPayloadDigest(c),
        clinicalPayloadDigest: clinicalPayloadDigest(item.input),
        figure: d.figure,
        riskLevel: d.riskLevel,
        recommendationCode: d.recommendationCode,
        recommendation: d.recommendation,
        referralPriority: d.referralPriority ?? null,
        referralType: d.referralType ?? null,
        safetyOutcome: d.safetyOutcome ?? null,
        reviewRequired: isReviewRequired(item),
        engineStatus: item.status,
        caseJson: JSON.stringify(minimizePersistedBatchCase(c)),
        inputJson: JSON.stringify(item.input),
        decisionJson: JSON.stringify(d),
      };
    });

  // Fails closed. A run written without a tenant is silently wrong — it cannot
  // be attributed later, and the episode and usage rows that will hang off it
  // are append-only. Refusing to persist is the recoverable outcome.
  const organisationId = await requireCurrentOrganisationId();

  const deliveryKey = args.deliveryKey?.trim() || null;
  const intakeSourceType = args.intakeSourceType ?? result.sourceType;
  const channel = deliveryKey ? "upload" : null;

  const createRun = (tx: Prisma.TransactionClient) => tx.batchRun.create({
    data: {
      organisationId,
      source: mapSourceType(intakeSourceType),
      sourceSystem: args.sourceSystem ?? null,
      sourceFileName: result.sourceFileName ?? null,
      engineVersion: result.engineVersion,
      pinnedRuleVersionId: runRuleVersion?.id ?? null,
      pinnedRuleVersionDisplay: runRuleVersion?.displayVersion ?? null,
      pinnedRulesetChecksum: runRuleVersion?.checksum ?? null,
      deliveryKey,
      intakeStatus: "PROCESSING",
      sourceRecordCount: parseManifest.sourceRecordCount,
      parsedRecordCount: parseManifest.parsedRecordCount,
      skippedRecordCount: parseManifest.skippedRecordCount,
      intakeManifestJson: JSON.stringify(parseManifest),
      outcomeManifestJson: JSON.stringify({ schemaVersion: 1, status: "PROCESSING" }),
      totalCases: result.results.length,
      pendingCount: result.results.length,
      reviewRequiredCount,
      createdByUserId: actorUserId,
      items: { create: itemData },
    },
    include: batchRunDetailInclude,
  });

  let run: BatchRunDetailRecord;
  if (channel && deliveryKey) {
    try {
      run = await prisma.$transaction(async (tx) => {
        const existing = await tx.ingestionReceipt.findUnique({
          where: {
            organisationId_channel_deliveryKey: { organisationId, channel, deliveryKey },
          },
        });
        if (existing) {
          throw new DuplicateIngestionReceiptError(
            existing.batchRunId,
            existing.receivedAt,
            existing.caseCount
          );
        }

        const created = await createRun(tx);
        await tx.ingestionReceipt.create({
          data: {
            organisationId,
            channel,
            deliveryKey,
            batchRunId: created.id,
            caseCount: parseManifest.sourceRecordCount,
          },
        });
        return created;
      });
    } catch (error) {
      if (error instanceof DuplicateIngestionReceiptError) throw error;
      // The unique constraint is the race-safe guard when two identical files
      // arrive between the read and create above. Reload the winner and return
      // the same explicit duplicate response.
      if ((error as { code?: string })?.code === "P2002") {
        const existing = await prisma.ingestionReceipt.findUnique({
          where: {
            organisationId_channel_deliveryKey: { organisationId, channel, deliveryKey },
          },
        });
        if (existing) {
          throw new DuplicateIngestionReceiptError(
            existing.batchRunId,
            existing.receivedAt,
            existing.caseCount
          );
        }
      }
      throw error;
    }
  } else {
    run = await prisma.$transaction((tx) => createRun(tx));
  }

  /*
    Register every arrival against its clinical episode.

    ONE SMALL TRANSACTION PER ARRIVAL, NOT ONE LARGE ONE
    ---------------------------------------------------
    This previously wrapped the whole batch — every episode upsert, every
    observation, the re-routing of withheld cases and their classification — in
    a single interactive transaction. Against a remote database that comfortably
    exceeded Prisma's interactive-transaction timeout on a 30-case run, and the
    entire registration rolled back: every review item kept a null episodeId,
    no observation was written at all, and the in-memory episode map survived
    the rollback and was then used to write usage events pointing at episodes
    that no longer existed.

    Atomicity is only needed between an episode and its own observation, which
    is what each small transaction now provides. A failure affects one arrival
    instead of the batch, and the map is populated only from writes that
    actually committed.

    Classification runs entirely OUTSIDE any transaction. It issues its own
    reads, and doing that inside an interactive transaction is what made the
    block slow enough to time out in the first place.
  */
  const episodeIdByRow = new Map<number, string>();
  const classificationCounts = {
    NEW: 0,
    ALREADY_IN_REVIEW: 0,
    COMPLETED: 0,
    UPDATED: 0,
    POSSIBLE_DUPLICATE: 0,
  };
  let episodeRegistrationFailed = 0;
  let governedEvaluationCompleted = 0;
  let governedEvaluationFailed = 0;
  const failedCaseIds = new Set<string>();
  let classificationFailed = false;

  // Everything that arrived: what is being reviewed, and what was withheld.
  // Withheld cases are re-routed and re-classified server-side rather than
  // trusting anything the client said — a client-supplied classification could
  // otherwise suppress a case the server would have processed.
  const withheldCases = args.withheldCases ?? [];
  const withheldRouted =
    withheldCases.length > 0
      ? processBatch(withheldCases, { includeWarnings: true, includeInvalid: true })
      : null;

  try {
    const classified = await classifyIncomingCases({ organisationId, items: result.results });
    for (const entry of classified) {
      classificationCounts[entry.classification] += 1;
    }

    const withheldClassified = withheldRouted
      ? await classifyIncomingCases({ organisationId, items: withheldRouted.results })
      : [];
    for (const entry of withheldClassified) {
      classificationCounts[entry.classification] += 1;
    }

    for (const [index, entry] of [...classified, ...withheldClassified].entries()) {
      const withheld = index >= classified.length;
      const item = withheld
        ? withheldRouted!.results[entry.index]
        : result.results[entry.index];
      const persisted = withheld
        ? null
        : run.items.find((c) => c.rowNumber === item.case.source.rowNumber) ?? null;

      try {
        const episodeId = await prisma.$transaction(async (tx) => {
          const id = await recordEpisodeObservation({
            tx,
            organisationId,
            batchRunId: run.id,
            identity: identityForCase(organisationId, item),
            classified: entry,
            // Null for a withheld arrival: it became no work, which is exactly
            // what makes the observation worth writing.
            batchReviewItemId: persisted?.id ?? null,
          });

          if (persisted) {
            await tx.batchReviewItem.update({
              where: { id: persisted.id },
              data: { episodeId: id },
            });
          }
          return id;
        });

        // Only after the write committed.
        if (persisted) episodeIdByRow.set(persisted.rowNumber, episodeId);

        if (withheld) {
          // Metered as suppression rather than as absence. A service asking why
          // its triaged volume is below its sending volume is answered from
          // this, not from a gap.
          const suppressedType = usageEventTypeFor({
            classification: entry.classification,
            evaluated: false,
            episodeAlreadyTriaged: true,
          });
          if (suppressedType) {
            await prisma.$transaction((tx) =>
              recordUsageEvent({
                tx,
                organisationId,
                episodeId,
                eventType: suppressedType,
                classification: entry.classification,
                batchRunId: run.id,
                source: run.source,
              })
            );
          }
        }
      } catch (arrivalError) {
        // One arrival, not the batch.
        episodeRegistrationFailed += 1;
        failedCaseIds.add(item.case.caseId);
        safeLogError("Episode registration failed for arrival", arrivalError, {
          batchRunId: run.id,
          rowNumber: item.case.source.rowNumber,
        });
      }
    }
  } catch (error) {
    // Recorded rather than raised. A case that reaches the queue without an
    // episode link is a provenance gap; a case that never reaches the queue
    // because episode bookkeeping failed is a clinical one.
    episodeRegistrationFailed += result.results.length + withheldCases.length;
    classificationFailed = true;
    for (const item of [...result.results, ...(withheldRouted?.results ?? [])]) {
      failedCaseIds.add(item.case.caseId);
    }
    safeLogError("batch.episode_registration.run_failed", error, {
      batchRunId: run.id,
    });
  }


  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: "CREATE",
      entity: "BatchRun",
      entityId: run.id,
      newValue: JSON.stringify({
        source: run.source,
        sourceSystem: run.sourceSystem,
        sourceFileName: run.sourceFileName,
        engineVersion: run.engineVersion,
        totalCases: run.totalCases,
        reviewRequiredCount: run.reviewRequiredCount,
      }),
    },
  });

  // The authoritative evaluation runs for EVERY item, unconditionally.
  //
  // It used to be gated on `runRuleVersion`. When that resolved to null — no
  // canonical activation and no shadow version — the loop was skipped entirely
  // and each row silently kept the legacy recommendation written above, while
  // the rest of the application reported canonical authority. That mixed state
  // is the defect this block now prevents.
  {
    const resultByRow = new Map(
      result.results.map((item) => [item.case.source.rowNumber, item])
    );
    for (const reviewItem of run.items) {
      const sourceResult = resultByRow.get(reviewItem.rowNumber);
      if (!sourceResult) continue;
      try {
        // An amended result becomes a LINKED SUCCESSOR of the evaluation it
        // supersedes — never a replacement. The prior evaluation stays readable
        // and stays the decision that was acted on at the time; RuleEvaluation
        // is append-only at the database level, so overwriting is not even
        // available. A completed decision is therefore never silently changed:
        // the new evaluation arrives as its own record for a clinician to
        // consider.
        const supersedes = await findPriorEvaluationForEpisode(
          episodeIdByRow.get(reviewItem.rowNumber) ?? null,
          reviewItem.id
        );

        const graded = await evaluateGradedDecision({
          input: sourceResult.input,
          subjectReference:
            sourceResult.case.nhi ??
            sourceResult.case.source.externalPatientId ??
            `batch:${run.id}:row:${reviewItem.rowNumber}`,
          enteredBy: actorUserId,
          canonicalFactsV2: sourceResult.canonicalFactsV2,
          batchRunId: run.id,
          environment: runtimeEnvironment,
          factSource: "REVIEWER_ENTRY",
          ...(supersedes
            ? {
                previousEvaluationId: supersedes.id,
                regradeReason:
                  "Updated result received for the same episode — new clinical information.",
              }
            : {}),
        });

        // Flag any still-open review item for the same episode.
        //
        // A reviewer looking at the earlier item is looking at superseded
        // information, and nothing else would tell them. Only the flag is
        // written: the decision, disposition and evaluation on that row are
        // untouched, so the record of what was known at the time survives and
        // the reviewer's own work is never silently altered.
        if (supersedes) {
          const episodeId = episodeIdByRow.get(reviewItem.rowNumber);
          if (episodeId) {
            await prisma.batchReviewItem.updateMany({
              where: {
                episodeId,
                id: { not: reviewItem.id },
                disposition: { in: ["PENDING", "NEEDS_INFO"] },
                supersededByItemId: null,
              },
              data: { supersededByItemId: reviewItem.id, supersededAt: new Date() },
            });
          }
        }
        const operativeResult = { ...sourceResult, decision: graded.decision };
        await prisma.batchReviewItem.update({
          where: { id: reviewItem.id },
          data: {
            ruleEvaluationId: graded.evaluationId,
            authorityEngine: graded.authority.authorityEngine,
            authorityReason: graded.authorityReason,
            legacyDecisionJson: JSON.stringify(graded.legacyDecision),
            decisionJson: JSON.stringify(graded.decision),
            figure: graded.decision.figure,
            riskLevel: graded.decision.riskLevel,
            recommendationCode: graded.decision.recommendationCode,
            recommendation: graded.decision.recommendation,
            referralPriority: graded.decision.referralPriority ?? null,
            referralType: graded.decision.referralType ?? null,
            safetyOutcome: graded.decision.safetyOutcome ?? null,
            reviewRequired: isReviewRequired(operativeResult),
          },
        });
        governedEvaluationCompleted += 1;

        // Meter the governed evaluation that just happened.
        //
        // Recorded here, after the evaluation succeeded, so the ledger counts
        // work that actually took place rather than work that was attempted. A
        // failed evaluation produces no usage event at all — the fail-closed
        // branch below writes a safety state, and charging for a case that
        // reached no governed recommendation would be indefensible.
        //
        // Written outside the run's transaction and best-effort: usage
        // accounting must never be able to fail a clinical decision that has
        // already been computed and persisted.
        const episodeId = episodeIdByRow.get(reviewItem.rowNumber);
        if (episodeId) {
          try {
            const alreadyTriaged = await prisma.usageEvent.findFirst({
              where: { episodeId, eventType: "FIRST_TRIAGE" },
              select: { id: true },
            });
            const eventType = usageEventTypeFor({
              classification: supersedes ? "UPDATED" : "NEW",
              evaluated: true,
              episodeAlreadyTriaged: Boolean(alreadyTriaged),
            });
            if (eventType) {
              await prisma.$transaction(async (tx) =>
                recordUsageEvent({
                  tx,
                  organisationId,
                  episodeId,
                  eventType,
                  classification: supersedes ? "UPDATED" : "NEW",
                  batchReviewItemId: reviewItem.id,
                  ruleEvaluationId: graded.evaluationId,
                  batchRunId: run.id,
                  rulesetVersion: runRuleVersion?.displayVersion ?? null,
                  rulesetChecksum: runRuleVersion?.checksum ?? null,
                  source: run.source,
                })
              );
            }
          } catch (usageError) {
            safeLogError("batch.usage_metering.item_failed", usageError, {
              batchRunId: run.id,
              reviewItemId: reviewItem.id,
            });
          }
        }
      } catch (error) {
        governedEvaluationFailed += 1;
        const failedSource = result.results.find(
          (candidate) => candidate.case.source.rowNumber === reviewItem.rowNumber
        );
        if (failedSource) failedCaseIds.add(failedSource.case.caseId);
        // FAIL CLOSED.
        //
        // This block previously only wrote an audit row, which left the legacy
        // recommendation persisted above as the item's recommendation — a
        // silent legacy fallback for a NEW case. A failed authoritative
        // evaluation must never present a legacy clinical recommendation as
        // though it were the governed result.
        //
        // The clinical columns are non-null, so the row is overwritten with an
        // explicit safety state rather than left blank. This states that no
        // governed recommendation exists; it does not invent a clinical action.
        await prisma.batchReviewItem.update({
          where: { id: reviewItem.id },
          data: {
            recommendationCode: NO_GOVERNED_RESULT_CODE,
            recommendation: NO_GOVERNED_RESULT_TEXT,
            referralPriority: null,
            referralType: null,
            safetyOutcome: "NO_GOVERNED_RECOMMENDATION",
            reviewRequired: true,
            engineStatus: "error",
            authorityReason:
              "The current governed ruleset could not evaluate this case; no " +
              "recommendation is offered and clinician review is required.",
          },
        });
        await prisma.auditLog.create({
          data: {
            userId: actorUserId,
            action: "CLINICAL_RULE_AUTHORITY_EVALUATION_FAILED",
            entity: "BatchReviewItem",
            entityId: reviewItem.id,
            severity: "ERROR",
            newValue: JSON.stringify({
              ruleVersionId: runRuleVersion?.id ?? null,
              failedClosed: true,
              message: error instanceof Error ? error.message : String(error),
            }),
          },
        });
      }
    }
  }

  const persisted = await prisma.batchRun.findUnique({
    where: { id: run.id },
    include: batchRunDetailInclude,
  });
  if (!persisted) throw new Error("Persisted batch run could not be reloaded.");
  const technicalFailureCount = failedCaseIds.size;
  const rejectedAtValidation = withheldCases.filter(
    (item) => item.validationStatus === "invalid"
  ).length;
  const hasAccountedIssues =
    parseManifest.skippedRecordCount > 0 ||
    parseManifest.errors.length > 0 ||
    rejectedAtValidation > 0;
  const intakeStatus = technicalFailureCount > 0
    ? "PARTIAL"
    : hasAccountedIssues
      ? "COMPLETED_WITH_ISSUES"
      : "COMPLETED";
  const classifiedCount = Object.values(classificationCounts).reduce((sum, count) => sum + count, 0);
  const outcomeManifest = {
    schemaVersion: 1,
    status: intakeStatus,
    counts: {
      received: parseManifest.sourceRecordCount,
      parsed: parseManifest.parsedRecordCount,
      skippedDuringParse: parseManifest.skippedRecordCount,
      prepared: parseManifest.preparedRecordCount,
      processed: result.results.length,
      withheld: withheldCases.length,
      alreadyInReview: classificationCounts.ALREADY_IN_REVIEW,
      completedPreviously: classificationCounts.COMPLETED,
      updated: classificationCounts.UPDATED,
      possibleDuplicate: classificationCounts.POSSIBLE_DUPLICATE,
      new: classificationCounts.NEW,
      rejectedAtValidation,
      governedEvaluationsCompleted: governedEvaluationCompleted,
      governedEvaluationsFailed: governedEvaluationFailed,
      episodeRegistrationFailed,
      failed: technicalFailureCount,
    },
    reconciliation: {
      sourceAccounted:
        parseManifest.sourceRecordCount ===
        parseManifest.parsedRecordCount + parseManifest.skippedRecordCount,
      preparedAccounted:
        parseManifest.preparedRecordCount === result.results.length + withheldCases.length,
      classificationsAccounted:
        !classificationFailed && classifiedCount === parseManifest.preparedRecordCount,
    },
  };
  await prisma.batchRun.update({
    where: { id: run.id },
    data: {
      reviewRequiredCount: persisted.items.filter((item) => item.reviewRequired).length,
      intakeStatus,
      outcomeManifestJson: JSON.stringify(outcomeManifest),
      completedAt: new Date(),
    },
  });
  return (await prisma.batchRun.findUnique({
    where: { id: run.id },
    include: batchRunDetailInclude,
  }))!;
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function listBatchRuns(limit = 50): Promise<BatchRunListRecord[]> {
  return prisma.batchRun.findMany({
    include: batchRunListInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getBatchRunWithItems(
  id: string
): Promise<BatchRunDetailRecord | null> {
  return prisma.batchRun.findUnique({
    where: { id },
    include: batchRunDetailInclude,
  });
}

/** Reconstruct the BatchCaseResult shape from a stored item for the drill-in UI. */
export function reconstructBatchCaseResult(item: BatchReviewItemRecord): BatchCaseResult {
  const evaluationTrace = item.ruleEvaluation
    ? JSON.parse(item.ruleEvaluation.evaluationTrace) as {
        factDiagnostics?: BatchCaseResult["canonicalShadow"] extends infer T
          ? T extends { factDiagnostics?: infer D }
            ? D
            : never
          : never;
        legacyComparison?: unknown;
      }
    : undefined;
  const minimizedCase = JSON.parse(item.caseJson) as CanonicalBatchCase;
  const reconstructedCase: CanonicalBatchCase = {
    ...minimizedCase,
    patientName: item.patientName ?? undefined,
    nhi: item.nhi ?? undefined,
    gpPractice: item.gpPractice ?? undefined,
    receivedDate: item.receivedDate?.toISOString(),
    source: {
      ...minimizedCase.source,
      externalPatientId: item.externalPatientId ?? undefined,
      sourceEpisodeKey: item.sourceEpisodeKey ?? undefined,
      sourceFacility: item.sourceFacility ?? undefined,
      testType: item.testType ?? undefined,
      collectedOn: item.collectedOn?.toISOString(),
    },
  };
  return {
    case: reconstructedCase,
    input: JSON.parse(item.inputJson),
    decision: JSON.parse(item.decisionJson),
    legacyDecision: item.legacyDecisionJson ? JSON.parse(item.legacyDecisionJson) : undefined,
    clinicalAuthority: {
      authorityEngine: item.authorityEngine === "CANONICAL" ? "CANONICAL" : "LEGACY",
      reason: item.authorityReason,
    },
    ...(item.ruleEvaluation
      ? {
          canonicalFactsV2: JSON.parse(item.ruleEvaluation.canonicalInputSnapshot),
          canonicalShadow: {
            reviewItemId: item.id,
            evaluationId: item.ruleEvaluation.id,
            evaluationMode: item.ruleEvaluation.evaluationMode,
            ruleVersionDisplay: item.ruleEvaluation.ruleVersionDisplay,
            rulesetChecksum: item.ruleEvaluation.rulesetChecksum,
            engineVersion: item.ruleEvaluation.engineVersion,
            provisionalRecommendation: item.ruleEvaluation.provisionalRecommendation,
            reviewerRequirement: item.ruleEvaluation.reviewerRequirement,
            clinicianOnly: item.ruleEvaluation.clinicianOnly,
            repeatInterval: item.ruleEvaluation.repeatInterval,
            evaluatedAt: item.ruleEvaluation.evaluatedAt.toISOString(),
            matchedRuleIds: JSON.parse(item.ruleEvaluation.matchedRuleIds),
            branchPath: JSON.parse(item.ruleEvaluation.branchPath),
            missingInformation: JSON.parse(item.ruleEvaluation.missingInformation),
            sourceReferences: JSON.parse(item.ruleEvaluation.sourceReferences),
            factDiagnostics: evaluationTrace?.factDiagnostics,
            legacyComparison: evaluationTrace?.legacyComparison,
          },
        }
      : {}),
    processingTimeMs: 0,
    status: item.engineStatus === "error" ? "error" : "success",
    error: undefined,
  };
}

// ─── Review queue (aggregate, across all runs) ────────────────────────────────

const reviewQueueInclude = {
  reviewedBy: reviewerSelect,
  ruleEvaluation: true,
  batchRun: {
    select: { id: true, source: true, sourceSystem: true, sourceFileName: true },
  },
} satisfies Prisma.BatchReviewItemInclude;

export type ReviewQueueItemRecord = Prisma.BatchReviewItemGetPayload<{
  include: typeof reviewQueueInclude;
}>;

const RISK_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Every case still awaiting a reviewer decision, across all runs — the single
 * destination a reviewer opens. Sorted so the most clinically pressing surface
 * first: engine-flagged review-required, then by risk, then most recent.
 */
export async function getReviewQueue(limit = 300): Promise<ReviewQueueItemRecord[]> {
  const items = await prisma.batchReviewItem.findMany({
    where: { disposition: "PENDING" },
    include: reviewQueueInclude,
    take: limit,
  });

  return items.sort((a, b) => {
    if (a.reviewRequired !== b.reviewRequired) return a.reviewRequired ? -1 : 1;
    const rank = (RISK_RANK[a.riskLevel] ?? 9) - (RISK_RANK[b.riskLevel] ?? 9);
    if (rank !== 0) return rank;
    const ad = a.receivedDate?.getTime() ?? a.createdAt.getTime();
    const bd = b.receivedDate?.getTime() ?? b.createdAt.getTime();
    return bd - ad;
  });
}

export async function getReviewQueueSnapshot(limit = 300): Promise<{
  items: ReviewQueueItemRecord[];
  total: number;
  mandatoryReview: number;
  urgentClinical: number;
}> {
  const [items, total, mandatoryReview, urgentClinical] = await Promise.all([
    getReviewQueue(limit),
    prisma.batchReviewItem.count({ where: { disposition: "PENDING" } }),
    prisma.batchReviewItem.count({ where: { disposition: "PENDING", reviewRequired: true } }),
    prisma.batchReviewItem.count({
      where: {
        disposition: "PENDING",
        OR: [
          { riskLevel: "URGENT" },
          { referralPriority: { in: ["P1", "P1_HSC"] } },
        ],
      },
    }),
  ]);
  return { items, total, mandatoryReview, urgentClinical };
}

export async function getNeedsInformationQueue(limit = 300): Promise<ReviewQueueItemRecord[]> {
  return prisma.batchReviewItem.findMany({
    where: { disposition: "NEEDS_INFO" },
    include: reviewQueueInclude,
    orderBy: [{ informationRequestedAt: "asc" }, { updatedAt: "asc" }],
    take: limit,
  });
}

/**
 * Bounded, server-paginated aggregate queue.
 *
 * The ID projection preserves the existing clinical sort exactly without
 * serialising hundreds of full decision/evaluation records. Details are loaded
 * only for the visible page in one follow-up query (never N+1).
 */
export async function getReviewQueuePage(args: {
  page?: number;
  pageSize?: number;
} = {}): Promise<{
  items: ReviewQueueItemRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pending: number;
  awaitingInformation: number;
  mandatoryReview: number;
  urgentClinical: number;
}> {
  await ensureDatabaseReady();
  const pageSize = Math.min(Math.max(Math.trunc(args.pageSize ?? 50), 1), 100);
  const page = Math.max(Math.trunc(args.page ?? 1), 1);
  const offset = (page - 1) * pageSize;

  const [idRows, grouped, mandatoryReview, urgentClinical] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "BatchReviewItem"
      WHERE "disposition" IN ('PENDING', 'NEEDS_INFO')
      ORDER BY
        CASE "disposition" WHEN 'PENDING' THEN 0 ELSE 1 END,
        CASE WHEN "disposition" = 'PENDING' THEN "reviewRequired" END DESC,
        CASE WHEN "disposition" = 'PENDING' THEN
          CASE "riskLevel"
            WHEN 'URGENT' THEN 0
            WHEN 'HIGH' THEN 1
            WHEN 'MEDIUM' THEN 2
            WHEN 'LOW' THEN 3
            ELSE 9
          END
        END ASC,
        CASE WHEN "disposition" = 'PENDING' THEN COALESCE("receivedDate", "createdAt") END DESC,
        CASE WHEN "disposition" = 'NEEDS_INFO' THEN "informationRequestedAt" END ASC,
        CASE WHEN "disposition" = 'NEEDS_INFO' THEN "updatedAt" END ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `),
    prisma.batchReviewItem.groupBy({
      by: ["disposition"],
      where: { disposition: { in: ["PENDING", "NEEDS_INFO"] } },
      _count: { _all: true },
    }),
    prisma.batchReviewItem.count({
      where: { disposition: "PENDING", reviewRequired: true },
    }),
    prisma.batchReviewItem.count({
      where: {
        disposition: "PENDING",
        OR: [
          { riskLevel: "URGENT" },
          { referralPriority: { in: ["P1", "P1_HSC"] } },
        ],
      },
    }),
  ]);

  const counts = new Map(
    grouped.map((row) => [row.disposition, row._count._all])
  );
  const pending = counts.get("PENDING") ?? 0;
  const awaitingInformation = counts.get("NEEDS_INFO") ?? 0;
  const total = pending + awaitingInformation;
  const ids = idRows.map((row) => row.id);
  const records = ids.length
    ? await prisma.batchReviewItem.findMany({
        where: { id: { in: ids } },
        include: reviewQueueInclude,
      })
    : [];
  const byId = new Map(records.map((record) => [record.id, record]));

  return {
    items: ids.flatMap((id) => {
      const record = byId.get(id);
      return record ? [record] : [];
    }),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    pending,
    awaitingInformation,
    mandatoryReview,
    urgentClinical,
  };
}

/** Lightweight counts for the sidebar badge. */
export async function getReviewQueueCounts(): Promise<{ pending: number; urgent: number }> {
  const [pending, urgent] = await Promise.all([
    prisma.batchReviewItem.count({ where: { disposition: "PENDING" } }),
    prisma.batchReviewItem.count({ where: { disposition: "PENDING", reviewRequired: true } }),
  ]);
  return { pending, urgent };
}

// ─── Review (bulk disposition) ────────────────────────────────────────────────

export class BatchReviewError extends Error {}
export class BatchReviewConflictError extends Error {
  constructor(message = "One or more cases changed while you were reviewing them. Refresh and review the current decision state.") {
    super(message);
    this.name = "BatchReviewConflictError";
  }
}

async function recomputeRunCounts(
  tx: Prisma.TransactionClient,
  runId: string
) {
  const grouped = await tx.batchReviewItem.groupBy({
    by: ["disposition"],
    where: { batchRunId: runId },
    _count: { _all: true },
  });
  const counts: Record<BatchReviewDisposition, number> = {
    PENDING: 0,
    ACCEPTED: 0,
    REJECTED: 0,
    NEEDS_INFO: 0,
  };
  for (const g of grouped) counts[g.disposition] = g._count._all;
  await tx.batchRun.update({
    where: { id: runId },
    data: {
      pendingCount: counts.PENDING,
      acceptedCount: counts.ACCEPTED,
      rejectedCount: counts.REJECTED,
      needsInfoCount: counts.NEEDS_INFO,
    },
  });
}

/**
 * Run-agnostic bulk disposition. Items may span multiple runs (the aggregate
 * Review Queue); counts are recomputed for every affected run. Returns how many
 * items were updated.
 */
export async function applyDisposition(args: {
  itemIds: string[];
  disposition: Exclude<BatchReviewDisposition, "PENDING">;
  reviewedByUserId: string;
  note?: string | null;
  overrideReason?: string | null;
}): Promise<{ updated: number; affectedRuns: number }> {
  const { disposition, reviewedByUserId } = args;

  if (args.itemIds.length === 0) {
    throw new BatchReviewError("No items selected for review.");
  }

  // A rejection must carry a reason — it's a clinical decision to NOT proceed
  // on a pre-graded case, and must be defensible in the audit trail.
  const note = args.note?.trim() || null;
  const overrideReason = args.overrideReason?.trim() || null;
  if (disposition === "REJECTED" && !overrideReason && !note) {
    throw new BatchReviewError("A reason is required when rejecting cases.");
  }
  if (disposition === "NEEDS_INFO" && !note) {
    throw new BatchReviewError("What information is needed must be recorded.");
  }

  const items = await prisma.batchReviewItem.findMany({
    where: { id: { in: args.itemIds } },
    select: {
      id: true,
      batchRunId: true,
      disposition: true,
      reviewedByUserId: true,
      reviewedAt: true,
      recommendationCode: true,
      recommendation: true,
      ruleEvaluationId: true,
      authorityEngine: true,
    },
  });
  const requestedIds = Array.from(new Set(args.itemIds));
  if (items.length !== requestedIds.length) {
    throw new BatchReviewConflictError("One or more selected cases no longer exist. Refresh before continuing.");
  }
  if (items.some((item) => item.disposition !== "PENDING")) {
    throw new BatchReviewConflictError();
  }
  const validIds = items.map((i) => i.id);
  const runIds = Array.from(new Set(items.map((i) => i.batchRunId)));
  const owner = disposition === "NEEDS_INFO"
    ? await prisma.user.findUnique({
        where: { id: reviewedByUserId },
        select: { name: true, email: true },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.batchReviewItem.updateMany({
      where: { id: { in: validIds }, disposition: "PENDING" },
      data: {
        disposition,
        reviewedByUserId,
        reviewedAt: new Date(),
        reviewNote: note,
        overrideReason,
        ...(disposition === "NEEDS_INFO"
          ? {
              informationOwnerUserId: reviewedByUserId,
              informationOwnerName: owner?.name ?? owner?.email ?? "Assigned reviewer",
              informationRequestedAt: new Date(),
              informationReceivedAt: null,
              informationResolutionNote: null,
            }
          : {}),
      },
    });
    if (updated.count !== validIds.length) {
      throw new BatchReviewConflictError();
    }

    for (const runId of runIds) {
      await recomputeRunCounts(tx, runId);
    }

    await tx.auditLog.create({
      data: {
        userId: reviewedByUserId,
        action: "REVIEW",
        entity: "BatchReviewItem",
        entityId: runIds[0],
        oldValue: JSON.stringify({
          items: items.map((item) => ({
            id: item.id,
            disposition: item.disposition,
            reviewedByUserId: item.reviewedByUserId,
            reviewedAt: item.reviewedAt,
            recommendationCode: item.recommendationCode,
            recommendation: item.recommendation,
            ruleEvaluationId: item.ruleEvaluationId,
            authorityEngine: item.authorityEngine,
          })),
        }),
        newValue: JSON.stringify({
          runIds,
          disposition,
          itemCount: validIds.length,
          itemIds: validIds,
          note,
          overrideReason,
        }),
      },
    });
  });

  return { updated: validIds.length, affectedRuns: runIds.length };
}

/**
 * Record that requested information arrived and return the work item to the
 * pending review queue. This changes workflow state only; clinical facts and
 * governed evaluations remain immutable until an explicit correction/regrade.
 */
export async function returnNeedsInformationToQueue(args: {
  itemId: string;
  actorUserId: string;
  resolutionNote: string;
}): Promise<void> {
  const resolutionNote = args.resolutionNote.trim();
  if (!resolutionNote) {
    throw new BatchReviewError("Record what information was received.");
  }

  const item = await prisma.batchReviewItem.findUnique({
    where: { id: args.itemId },
    select: {
      id: true,
      batchRunId: true,
      disposition: true,
      informationOwnerUserId: true,
      informationOwnerName: true,
      informationRequestedAt: true,
      reviewNote: true,
    },
  });
  if (!item) throw new BatchReviewConflictError("The work item no longer exists.");
  if (item.disposition !== "NEEDS_INFO") throw new BatchReviewConflictError();

  await prisma.$transaction(async (tx) => {
    const updated = await tx.batchReviewItem.updateMany({
      where: { id: item.id, disposition: "NEEDS_INFO" },
      data: {
        disposition: "PENDING",
        informationReceivedAt: new Date(),
        informationResolutionNote: resolutionNote,
      },
    });
    if (updated.count !== 1) throw new BatchReviewConflictError();

    await recomputeRunCounts(tx, item.batchRunId);
    await tx.auditLog.create({
      data: {
        userId: args.actorUserId,
        action: "INFORMATION_RECEIVED_RETURNED_TO_REVIEW",
        entity: "BatchReviewItem",
        entityId: item.id,
        oldValue: JSON.stringify({
          disposition: item.disposition,
          informationOwnerUserId: item.informationOwnerUserId,
          informationOwnerName: item.informationOwnerName,
          informationRequestedAt: item.informationRequestedAt,
          requestReason: item.reviewNote,
        }),
        newValue: JSON.stringify({ disposition: "PENDING", resolutionNote }),
      },
    });
  });
}

/** Per-run bulk disposition (validates membership), returns the updated run. */
export async function reviewBatchItems(args: {
  runId: string;
  itemIds: string[];
  disposition: Exclude<BatchReviewDisposition, "PENDING">;
  reviewedByUserId: string;
  note?: string | null;
  overrideReason?: string | null;
}): Promise<BatchRunDetailRecord> {
  const members = await prisma.batchReviewItem.findMany({
    where: { id: { in: args.itemIds }, batchRunId: args.runId },
    select: { id: true },
  });
  if (members.length === 0) {
    throw new BatchReviewError("None of the selected items belong to this run.");
  }

  await applyDisposition({
    itemIds: members.map((m) => m.id),
    disposition: args.disposition,
    reviewedByUserId: args.reviewedByUserId,
    note: args.note,
    overrideReason: args.overrideReason,
  });

  const updated = await getBatchRunWithItems(args.runId);
  if (!updated) {
    throw new BatchReviewError("Batch run disappeared during review.");
  }
  return updated;
}
