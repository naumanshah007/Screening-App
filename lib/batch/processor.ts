/**
 * Batch Processing — Processor
 *
 * Maps CanonicalBatchCase → ClinicalInput, calls evaluateClinicalDecision()
 * in a loop, and assembles BatchCaseResult[].
 *
 * The decision engine is a pure function with no side effects — no DB,
 * no network, no state. This processor is intentionally simple.
 */

import { evaluateClinicalDecision } from "@/lib/engine/decision-engine";
import type { ClinicalInput } from "@/lib/engine/types";
import type {
  CanonicalBatchCase,
  BatchCaseResult,
  BatchProcessingResult,
  SourceType,
} from "./types";
import { canonicalClinicalFactsV2FromFlatFacts } from "@/lib/clinical-rules/canonical-facts-v2";
import { normalizeClinicalFactMap } from "@/lib/clinical-rules/facts";

// ─── Engine version (from the decision engine rule version) ──────────────────

export const ENGINE_VERSION = "business-figures-table1-v1";

// ─── Mapper: CanonicalBatchCase → ClinicalInput ─────────────────────────────

/**
 * Maps a validated CanonicalBatchCase to the ClinicalInput the engine expects.
 * Mirrors the defaults used in app/api/rules/evaluate/route.ts.
 */
export function mapCanonicalToClinicalInput(
  batchCase: CanonicalBatchCase
): ClinicalInput {
  return {
    // Patient context
    patientId: `batch-${batchCase.caseId}`,
    patientAge: batchCase.patientAge,
    ethnicityPrimary: batchCase.ethnicityPrimary,
    isFirstTimeHPVTransition: batchCase.isFirstTimeHPVTransition,
    isPostHysterectomy: batchCase.isPostHysterectomy,
    hysterectomyType: batchCase.hysterectomyType,
    hysterectomyIndication: batchCase.hysterectomyIndication,
    hysterectomySpecimenPathology: batchCase.hysterectomySpecimenPathology,
    excisionStatus: batchCase.excisionStatus,
    postHysterectomyHpvTestIndicated: batchCase.postHysterectomyHpvTestIndicated,
    immunocompromised: batchCase.immunocompromised,
    atypicalEndometrialHistory: batchCase.atypicalEndometrialHistory,

    // Screening history
    screeningStatus: batchCase.screeningStatus,
    screeningHistoryKnown: batchCase.screeningHistoryKnown,
    priorScreeningHistory: batchCase.priorScreeningHistory,
    priorLowGradeResult: batchCase.priorLowGradeResult,
    priorHighGradeResult: batchCase.priorHighGradeResult,
    previousHSILCIN23: batchCase.previousHSILCIN23,
    previousAIS: batchCase.previousAIS,
    previousAtypicalGlandularCells: batchCase.previousAtypicalGlandularCells,
    previousAtypicalEndometrialCells: batchCase.previousAtypicalEndometrialCells,
    historySourceAvailable: batchCase.historySourceAvailable,

    // Current test results
    hpvResult: batchCase.hpvResult,
    cytologyResult: batchCase.cytologyResult,
    histologyResult: batchCase.histologyResult,
    sampleType: batchCase.sampleType,
    tzType: batchCase.tzType,

    // Session / repeat context
    repeatContext: batchCase.repeatContext,
    repeatStage: batchCase.repeatStage,
    isTestOfCure: batchCase.isTestOfCure,
    testOfCureStage: batchCase.testOfCureStage,
    consecutiveNegativeCoTestCount: batchCase.consecutiveNegativeCoTestCount,
    consecutiveLowGradeCount: batchCase.consecutiveLowGradeCount,
    unsatisfactoryCytologyCount: batchCase.unsatisfactoryCytologyCount,

    // Figure 9: Pregnancy
    isPregnant: batchCase.isPregnant,
    postpartumReviewTiming: batchCase.postpartumReviewTiming,

    // Figure 10: Abnormal vaginal bleeding
    hasAbnormalVaginalBleeding: batchCase.hasAbnormalVaginalBleeding,
    abnormalBleedingStage: batchCase.abnormalBleedingStage,
    bleedingType: batchCase.bleedingType,
    hasCancerSymptoms: batchCase.hasCancerSymptoms,
    abnormalCervix: batchCase.abnormalCervix,
    suspicionOfCancer: batchCase.suspicionOfCancer,
    suspectOralContraceptiveProblem: batchCase.suspectOralContraceptiveProblem,
    stiIdentified: batchCase.stiIdentified,
    bleedingResolved: batchCase.bleedingResolved,

    // Bleeding workup flags — set when bleeding pathway is active
    ...(batchCase.hasAbnormalVaginalBleeding
      ? {
          menstrualHistoryCaptured: true,
          contraceptiveHistoryCaptured: true,
          sexualHistoryCaptured: true,
          speculumExamCompleted: true,
          pelvicExamCompleted: true,
          coTestCompleted: true,
          oralContraceptiveAdjusted: batchCase.suspectOralContraceptiveProblem ?? undefined,
          stiTreated: batchCase.stiIdentified ?? undefined,
        }
      : {}),

    // Colposcopy findings
    normalColposcopy: batchCase.normalColposcopy,
    visibleLesion: batchCase.visibleLesion,
    transformationZoneState: batchCase.transformationZoneState,
    colposcopicImpression: batchCase.colposcopicImpression,
    biopsyResult: batchCase.biopsyResult,
    colposcopyTZType: batchCase.colposcopyTZType,
    mdmOutcome: batchCase.mdmOutcome,

    // SWAB
    swabReturnVisitCompleted: batchCase.swabReturnVisitCompleted,
  };
}

// ─── Batch Processor ─────────────────────────────────────────────────────────

/**
 * Process an array of validated CanonicalBatchCase through the decision engine.
 * Only processes cases with validationStatus !== "invalid".
 * Returns results for all processable cases + error list for failures.
 */
export function processBatch(
  cases: CanonicalBatchCase[],
  options?: {
    /** Process even rows with warnings (default: true). */
    includeWarnings?: boolean;
    /** Process invalid rows too (default: false). */
    includeInvalid?: boolean;
  }
): BatchProcessingResult {
  const { includeWarnings = true, includeInvalid = false } = options ?? {};
  const start = performance.now();
  const results: BatchCaseResult[] = [];
  const errors: Array<{ caseId: string; error: string }> = [];

  // Determine source metadata from first case
  const sourceType: SourceType = cases[0]?.source.sourceType ?? "demo";
  const sourceFileName = cases[0]?.source.sourceFileName;

  for (const batchCase of cases) {
    // Skip invalid rows unless explicitly requested
    if (batchCase.validationStatus === "invalid" && !includeInvalid) continue;
    if (batchCase.validationStatus === "warnings" && !includeWarnings) continue;

    const rowStart = performance.now();
    try {
      const input = mapCanonicalToClinicalInput(batchCase);
      const decision = evaluateClinicalDecision(input);
      const shadowInput = { ...input } as Record<string, unknown>;
      // Legacy batch processing historically assumes bleeding work-up and
      // treatment completion flags. The canonical shadow must not inherit
      // those fabricated actions or examinations.
      for (const key of [
        "menstrualHistoryCaptured",
        "contraceptiveHistoryCaptured",
        "sexualHistoryCaptured",
        "speculumExamCompleted",
        "pelvicExamCompleted",
        "coTestCompleted",
        "oralContraceptiveAdjusted",
        "stiTreated",
      ]) {
        delete shadowInput[key];
      }
      const canonicalFactsV2 = canonicalClinicalFactsV2FromFlatFacts({
        subjectReference:
          batchCase.nhi ?? batchCase.source.externalPatientId ?? batchCase.caseId,
        facts: normalizeClinicalFactMap({
          ...shadowInput,
          // Produced by the legacy router, not by the source system. Its
          // provenance is forced to DERIVED_ROUTER by ROUTER_DERIVED_FACTS.
          currentPathway: decision.figure,
        }),
        source: "PRIOR_RECORD",
        enteredBy: `batch-${batchCase.source.mappingVersion}`,
        recordedAt: batchCase.source.importedAt,
        routerEngine: ENGINE_VERSION,
      });
      results.push({
        case: batchCase,
        input,
        decision,
        canonicalFactsV2,
        processingTimeMs: performance.now() - rowStart,
        status: "success",
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      errors.push({ caseId: batchCase.caseId, error: errorMessage });
      results.push({
        case: batchCase,
        input: mapCanonicalToClinicalInput(batchCase),
        decision: {
          figure: "FIGURE_3",
          riskLevel: "LOW",
          recommendation: `Processing error: ${errorMessage}`,
          recommendationCode: "ERROR",
          nextAction: "Review this case manually.",
        },
        processingTimeMs: performance.now() - rowStart,
        status: "error",
        error: errorMessage,
      });
    }
  }

  return {
    results,
    totalTimeMs: performance.now() - start,
    processedCount: results.filter((r) => r.status === "success").length,
    errorCount: errors.length,
    errors,
    sourceType,
    sourceFileName,
    processedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
  };
}
