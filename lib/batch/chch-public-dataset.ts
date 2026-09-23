/**
 * Batch Processing — CHCH Public Dataset
 *
 * 30 synthetic cases supplied by an external vendor/partner for evaluating
 * CerviGrade's decision engine against their own expected outcomes.
 *
 * Source: CerviGrade_SurveyGrid_30_Synthetic_Patients.xlsx
 *
 * DEMO DATA — NOT REAL PATIENT DATA.
 *
 * HOW TO READ THIS FILE
 * ---------------------
 * The source rows live in `chch-source-records.ts` and are the oracle. This file
 * derives engine-facing facts FROM them. Each case therefore carries:
 *
 *   - `sourceEvidence`  — the verbatim row, the precise HPV genotype and the
 *     cytology state. Never reconstructed from anything downstream.
 *   - `hpvResult`       — the legacy engine's four-value projection of the
 *     genotype. HPV_16 and HPV_18 both project to HPV_16_18 at this boundary
 *     only; the precise value survives on `sourceEvidence` and in the canonical
 *     facts.
 *   - `cytologyResult`  — set ONLY from a genuine current result. Pending,
 *     missing, not required, no current sample, prior-only and unspecified all
 *     leave it absent, and remain distinguishable via the cytology state.
 *   - the `history` overrides below — only facts the source text actually
 *     states. A scoped negative ("No previous CIN") is not a previous normal
 *     screening result and is not recorded as one.
 *
 * The vendor's "Demo priority" and "Expected behaviour" columns are partner
 * expectations, not guideline authority. They are deliberately not encoded: a
 * field that exists can be used to tune inputs until the expected answer
 * appears.
 */

import type { CanonicalBatchCase } from "./types";
import { ENGINE_VERSION } from "./processor";
import {
  CHCH_MAPPING_VERSION,
  CHCH_SOURCE_EVIDENCE,
  CHCH_SOURCE_FILE_NAME,
} from "./chch-source-records";
import { currentCytologyResult, legacyHpvResult } from "./source-evidence";

const CHCH_PUBLIC_SOURCE_IMPORTED_AT = "2026-09-22T09:00:00.000Z";

const CHCH_PUBLIC_SOURCE_BASE = {
  sourceType: "chchPublic" as const,
  sourceSystem: "CHCH Public",
  sourceFileName: CHCH_SOURCE_FILE_NAME,
  mappingVersion: CHCH_MAPPING_VERSION,
  engineVersion: ENGINE_VERSION,
};

/**
 * Facts the source states in prose, mapped to the engine contract, per case.
 *
 * Only cases that need one appear. A case with no entry states no history fact
 * the engine can consume — which is a result, not an omission.
 */
const DERIVED_FACTS: Record<string, Partial<CanonicalBatchCase>> = {
  // "No previous CIN" is a scoped negative about CIN. It is not a previous
  // normal screening result, and screening history is not established by it.
  "chch-001": {},

  // "No relevant history" states nothing about prior results.
  "chch-002": {},

  // "Previous screening normal" — a previous result the source does report.
  "chch-003": {
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  },

  // "No previous abnormal history" — absence of an abnormality is not a
  // recorded normal result.
  "chch-004": {},

  // "12-month follow-up" with "HPV positive 12 months earlier".
  //
  // The repeat context is the stated circumstance. What is NOT stated is the
  // earlier genotype: "HPV positive" does not establish that the same HPV18 is
  // persisting, so no persistence claim is made here or in the label.
  "chch-005": {
    repeatContext: "PRIMARY_HPV",
    repeatStage: "FIRST_REPEAT",
    previousHpv1618Episode: undefined,
  },

  "chch-006": {},

  // "Treated CIN3 three years ago" + "Post-treatment surveillance".
  //
  // CIN3 and the treatment are both stated, so the high-grade history is real.
  // The exact treatment date is not stated and is not invented; Test of Cure
  // stage and status stay unknown.
  "chch-007": {
    previousHSILCIN23: true,
    priorHighGradeResult: true,
    isTestOfCure: true,
    repeatContext: "TEST_OF_CURE",
  },

  // "Sample collected 18 days ago" is the age of a specimen. It says nothing
  // about whether a history source is available, and is no longer read as
  // though it did.
  "chch-008": {},

  // "Overdue follow-up", overdue by 5 months, previous HPV16 result, no new
  // sample. The previous positive is an HPV episode, not high-grade disease.
  // Whether the earlier referral happened is unknown, not false.
  "chch-009": {
    screeningStatus: "OVERDUE",
    previousHpv1618Episode: true,
  },

  // "Previous HPV16 positive; colposcopy outcome not documented" — two stated
  // facts. The outcome is explicitly undocumented, which is unknown, not false:
  // false would assert the colposcopy did not happen.
  "chch-010": {
    previousHpv1618Episode: true,
    colposcopyCompletedForLastRecommendation: undefined,
  },

  "chch-011": {},

  "chch-012": {
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  },

  // "HPV16 also detected 12 months ago" — the SAME genotype, explicitly. Unlike
  // chch-005, persistence is what the source says.
  "chch-013": {
    repeatContext: "PRIMARY_HPV",
    repeatStage: "FIRST_REPEAT",
    previousHpv1618Episode: true,
  },

  // "No prior CIN recorded" is absence of documentation about CIN. It is not a
  // statement that history sources are unavailable.
  "chch-014": {},

  "chch-015": {},

  // One unsatisfactory result is reported. A count of consecutive
  // unsatisfactory results is not, so none is asserted.
  "chch-016": {},

  "chch-017": {
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  },

  // "Previous CIN2; surveillance episode". CIN2 is high-grade, so the history
  // is stated. Treatment is NOT: CIN2 is frequently observed rather than
  // excised, and Test of Cure presupposes treatment.
  "chch-018": {
    previousHSILCIN23: true,
    priorHighGradeResult: true,
  },

  // "Previous HPV18 result; follow-up documentation incomplete" on a ROUTINE
  // screen. No interval and no ordinal are stated, so no repeat stage is
  // invented, and incomplete documentation is not widened into "history source
  // unavailable".
  "chch-019": {
    previousHpv1618Episode: true,
  },

  // "Prior screening up to date; no high-grade history". Up to date is the
  // screening status. "No high-grade history" is an explicitly reported absence
  // of high-grade disease — which is not the same as a recorded normal result,
  // so no prior-history category is asserted.
  "chch-020": {
    screeningStatus: "REGULAR_SCREENING",
    priorHighGradeResult: false,
  },

  "chch-021": {},

  "chch-022": {
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  },

  "chch-023": {},

  // "Previous HPV-negative screen" — a previous result the source reports.
  "chch-024": {
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  },

  // "First hrHPV-positive episode" supports the baseline stage; "no previous
  // CIN" stays a scoped negative.
  "chch-025": {},

  "chch-026": {},

  // "Previous non-16/18 hrHPV positive; follow-up now HPV negative" on a
  // "Follow-up screen". The repeat context is stated; the ordinal is not, so no
  // first/second repeat is asserted. The previous negative cytology is a PRIOR
  // result and is held on the source evidence — never as a current one.
  "chch-027": {
    repeatContext: "PRIMARY_HPV",
  },

  // "Previous ASC-US several years earlier with subsequent normal follow-up".
  // The prior low-grade result is stated. A formal return to regular screening
  // is not: "subsequent normal follow-up" is not a recorded discharge decision.
  "chch-028": {
    priorLowGradeResult: true,
  },

  // "No previous CIN; first positive result" — the first positive supports the
  // baseline stage; no previous CIN stays a scoped negative.
  "chch-029": {},

  "chch-030": {},
};

/**
 * Short display label.
 *
 * Built from the source cells, so it cannot drift from them and cannot assert
 * something the source does not say (the old labels claimed "HPV18 persistent"
 * for a row that only said "HPV positive 12 months earlier").
 */
function labelFor(circumstance: string, hpv: string, cytology: string) {
  return `${circumstance} — ${hpv}, ${cytology.toLowerCase()}`;
}

export const CHCH_PUBLIC_DATASET: CanonicalBatchCase[] =
  CHCH_SOURCE_EVIDENCE.map((evidence, index) => {
    const derived = DERIVED_FACTS[evidence.caseId] ?? {};
    return {
      caseId: crypto.randomUUID(),
      label: labelFor(
        evidence.screenCircumstanceText,
        evidence.hpvResultText,
        evidence.cytologyFollowUpText
      ),
      patientName: evidence.patientName,
      // chch-NNN is a synthetic case identifier, not an NHI. Stated explicitly
      // so storage and display cannot quietly treat it as one.
      identifierKind: evidence.identifierKind,
      sourceEvidence: evidence,
      source: {
        ...CHCH_PUBLIC_SOURCE_BASE,
        rowNumber: index + 1,
        importedAt: CHCH_PUBLIC_SOURCE_IMPORTED_AT,
        externalPatientId: evidence.caseId,
      },

      patientAge: evidence.age,

      // Derived from the source evidence, at the legacy boundary only.
      hpvResult: legacyHpvResult(evidence.hpvGenotype),
      cytologyResult: currentCytologyResult(evidence),

      // Values the source does not state.
      //
      // These are assumptions, not facts, and the rulebook is explicit that
      // unknown is never equivalent to false (§20) — so they are declared in
      // lib/batch/chch-public-assumptions.ts with their basis, the rules they
      // affect, and a clinician approval field, rather than sitting here as
      // bare literals nobody can review.
      repeatStage: "BASELINE",
      isFirstTimeHPVTransition: false,
      isPostHysterectomy: false,
      immunocompromised: false,
      atypicalEndometrialHistory: false,
      consecutiveNegativeCoTestCount: 0,
      consecutiveLowGradeCount: 0,
      unsatisfactoryCytologyCount: 0,
      // Sample type is NOT stated by any row. It is supplied because the type
      // requires it; it is declared as an assumption and must never be shown as
      // a source fact.
      sampleType: "LBC",

      validationStatus: "valid",
      validationErrors: [],
      validationWarnings: [],

      ...derived,
    } satisfies CanonicalBatchCase;
  });
