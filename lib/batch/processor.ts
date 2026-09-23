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
import { canonicalHpvFactValue, sourceCellRef } from "./source-evidence";

/**
 * Facts a source-evidence-bearing case supplies because the legacy contract
 * requires a value, but which no source row states.
 *
 * These are recorded as NOT_RECORDED, so they never enter the evaluated fact
 * map and can never satisfy a governed rule predicate. The supplied value is
 * still written down as provenance, and the legacy engine still receives it
 * through ClinicalInput — only the governed evaluation is protected.
 *
 * Provenance alone was not enough: marking a fact SYNTHETIC_DEMO described it
 * without gating it, and an assumed LBC sample type was still the load-bearing
 * fact behind every HPV16/18 referral.
 */
const ALWAYS_ASSUMED_FACTS = [
  // No CHCH row states a collection method.
  "sampleType",
  // No row states the programme-transition status.
  "isFirstCytologyToHpvTransition",
  // Derived from an assumed isPostHysterectomy=false, so equally assumed.
  "cervixPresent",
  "isPostHysterectomy",
  "hysterectomyType",
  // An absent immune status is not verified immune competence.
  "immunocompromised",
  "atypicalEndometrialHistory",
  // No row reports a prior consecutive sequence; zero is "not recorded",
  // which must not satisfy a threshold.
  "consecutiveQualifyingNegativeCoTests",
  "consecutiveLowGradeCytologyResults",
  "consecutiveUnsatisfactoryCount",
] as const;

/**
 * The assumed facts for one case.
 *
 * Scoped to cases carrying immutable source evidence — today the CHCH
 * evaluation set. Other intake paths are unchanged.
 */
export function assumedCanonicalFactNames(
  batchCase: CanonicalBatchCase
): ReadonlySet<string> {
  if (!batchCase.sourceEvidence) return new Set();
  const assumed = new Set<string>(ALWAYS_ASSUMED_FACTS);

  // The screening event is a source fact only where the row states one — a
  // first screen, or a stated repeat interval. "Routine screening" says nothing
  // about whether this is a baseline or a repeat, so the BASELINE the contract
  // requires is an assumption there and the eventStage derived from it inherits
  // that.
  if (batchCase.sourceEvidence.screeningEvent === "NOT_STATED") {
    assumed.add("eventStage");
  }

  // isActiveHsilTestOfCure is built by boolean evaluation of absent Test of
  // Cure fields, so it reports false for every case that never mentioned one.
  if (batchCase.isTestOfCure !== true) {
    assumed.add("isActiveHsilTestOfCure");
  }

  return assumed;
}

/**
 * Canonical facts for one case.
 *
 * Two things happen here that do not happen for a plain legacy input:
 *
 *  1. the PRECISE HPV genotype replaces the legacy grouped value. CG-NCSP-3.1.0
 *     predicates accept HPV_16 and HPV_18 directly, so collapsing them before
 *     governed evaluation discards information the governed rules can use.
 *  2. facts the dataset assumed rather than observed are marked as such.
 */
export function canonicalFactsForCase(args: {
  batchCase: CanonicalBatchCase;
  input: ClinicalInput;
  currentPathway?: string;
}) {
  const { batchCase, input } = args;
  const shadowInput = { ...input } as Record<string, unknown>;
  // Legacy batch processing historically assumes bleeding work-up and treatment
  // completion flags. The canonical facts must not inherit those fabricated
  // actions or examinations.
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

  const facts = normalizeClinicalFactMap({
    ...shadowInput,
    // Produced by the legacy router, not by the source system. Its provenance
    // is forced to DERIVED_ROUTER by ROUTER_DERIVED_FACTS.
    currentPathway: args.currentPathway,
  });

  // The genotype the source actually reported, not its legacy projection.
  const preciseHpv = canonicalHpvFactValue(batchCase.sourceEvidence?.hpvGenotype);
  if (preciseHpv !== undefined) facts.hpvResult = preciseHpv;

  const assumedFacts = assumedCanonicalFactNames(batchCase);

  // Which canonical facts came VERBATIM from a source cell, and which are
  // meaning-preserving transformations of one. Everything else on a
  // source-evidence case is neither, and is reported as such rather than
  // inheriting a borrowed provenance.
  const evidence = batchCase.sourceEvidence;
  const locator = evidence?.locator;
  const sourceFacts: Record<string, string | true> = {};
  const derivedFacts: Record<string, string> = {};
  if (evidence && locator) {
    if (facts.hpvResult !== undefined) {
      sourceFacts.hpvResult = sourceCellRef(locator, "hpvResult");
    }
    if (facts.cytologyResult !== undefined) {
      sourceFacts.cytologyResult = sourceCellRef(locator, "cytologyFollowUp");
    }
    if (facts.ageYears !== undefined) {
      sourceFacts.ageYears = sourceCellRef(locator, "age");
    }
    const mapping = locator.mappingVersion;
    for (const name of [
      "hpvValidity",
      "cytologyAdequacy",
      "eventStage",
      "priorScreeningHistoryGroup",
      "priorHighGradeHistory",
      "priorLowGradeResolved",
      "isTestOfCureEvent",
      "screeningStatus",
      "isExitTest",
      "hasCurrentGlandularAbnormality",
    ]) {
      if (facts[name] !== undefined && !assumedFacts.has(name)) {
        derivedFacts[name] = mapping;
      }
    }
  }
  const factSources = Object.fromEntries(
    [...assumedFacts]
      .filter((name) => facts[name] !== undefined)
      .map((name) => [name, "SYNTHETIC_DEMO" as const])
  );

  return canonicalClinicalFactsV2FromFlatFacts({
    subjectReference:
      batchCase.nhi ?? batchCase.source.externalPatientId ?? batchCase.caseId,
    facts,
    source: "PRIOR_RECORD",
    factSources,
    assumedFacts,
    ...(Object.keys(sourceFacts).length > 0 ? { sourceFacts } : {}),
    ...(Object.keys(derivedFacts).length > 0 ? { derivedFacts } : {}),
    enteredBy: `batch-${batchCase.source.mappingVersion}`,
    recordedAt: batchCase.source.importedAt,
    routerEngine: ENGINE_VERSION,
  });
}

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
    colposcopyRecommendedInLastCytology: batchCase.colposcopyRecommendedInLastCytology,
    colposcopyCompletedForLastRecommendation: batchCase.colposcopyCompletedForLastRecommendation,
    previousHpv1618Episode: batchCase.previousHpv1618Episode,

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
    testOfCureStatus: batchCase.testOfCureStatus,
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
      const canonicalFactsV2 = canonicalFactsForCase({
        batchCase,
        input,
        currentPathway: decision.figure,
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
