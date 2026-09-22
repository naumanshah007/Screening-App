/**
 * Batch Processing — CHCH Public Dataset
 *
 * 30 synthetic cases supplied by an external vendor/partner for evaluating
 * CerviGrade's decision engine against their own expected outcomes.
 *
 * Source: CerviGrade_SurveyGrid_30_Synthetic_Patients.xlsx
 *
 * DEMO DATA — NOT REAL PATIENT DATA. These cases are fictional and were
 * authored by the vendor to exercise specific decision-engine branches
 * (HPV16/18 direct pathway, non-16/18 triage, persistence, history
 * overrides, workflow/data-quality flags, and reassuring low-risk cases).
 *
 * Each case below carries the vendor's own "Demo priority" and "Expected
 * behaviour" note as a comment, so a reviewer can pull this source and
 * compare the engine's actual output against what the vendor expects.
 */

import type { CanonicalBatchCase } from "./types";
import { ENGINE_VERSION } from "./processor";

const CHCH_PUBLIC_SOURCE_IMPORTED_AT = "2026-09-22T09:00:00.000Z";

const CHCH_PUBLIC_SOURCE_BASE = {
  sourceType: "chchPublic" as const,
  sourceSystem: "CHCH Public",
  sourceFileName: "CerviGrade_SurveyGrid_30_Synthetic_Patients.xlsx",
  mappingVersion: "chch-public-v1",
  engineVersion: ENGINE_VERSION,
};

function chchCase(
  rowNumber: number,
  externalPatientId: string,
  patientName: string,
  label: string,
  fields: Partial<CanonicalBatchCase>
): CanonicalBatchCase {
  return {
    caseId: crypto.randomUUID(),
    label,
    patientName,
    source: {
      ...CHCH_PUBLIC_SOURCE_BASE,
      rowNumber,
      importedAt: CHCH_PUBLIC_SOURCE_IMPORTED_AT,
      externalPatientId,
    },

    // Required defaults (baseline screening event unless overridden below)
    repeatStage: "BASELINE",
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
    consecutiveNegativeCoTestCount: 0,
    consecutiveLowGradeCount: 0,
    unsatisfactoryCytologyCount: 0,
    sampleType: "LBC",

    // Validation
    validationStatus: "valid",
    validationErrors: [],
    validationWarnings: [],

    ...fields,
  };
}

export const CHCH_PUBLIC_DATASET: CanonicalBatchCase[] = [
  // chch-001 · Aroha T., 34 · Demo priority: High
  // Expected: Direct colposcopy pathway; do not wait for cytology before prioritising.
  chchCase(1, "chch-001", "Aroha T.", "First HPV screen — HPV16, cytology pending", {
    patientAge: 34,
    hpvResult: "HPV_16_18",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-002 · Emma R., 42 · Demo priority: High
  // Expected: Keep high priority despite negative cytology; route to colposcopy pathway.
  chchCase(2, "chch-002", "Emma R.", "Routine screening — HPV18, negative cytology", {
    patientAge: 42,
    hpvResult: "HPV_16_18",
    cytologyResult: "NEGATIVE",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-003 · Mereana K., 39 · Demo priority: Very High
  // Expected: Urgent clinical action; genotype plus high-grade cytology should surface prominently.
  chchCase(3, "chch-003", "Mereana K.", "Routine screening — HPV16, HSIL", {
    patientAge: 39,
    hpvResult: "HPV_16_18",
    cytologyResult: "HSIL",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-004 · Sophie L., 31 · Demo priority: Intermediate
  // Expected: Apply cytology-based triage for non-16/18 hrHPV and route for appropriate review/follow-up.
  chchCase(4, "chch-004", "Sophie L.", "Routine screening — HPV Other, ASC-US", {
    patientAge: 31,
    hpvResult: "HPV_OTHER",
    cytologyResult: "ASC_US",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-005 · Priya S., 46 · Demo priority: High
  // Expected: Recognise persistent high-risk HPV and escalate based on longitudinal history.
  chchCase(5, "chch-005", "Priya S.", "12-month follow-up — HPV18 persistent, negative cytology", {
    patientAge: 46,
    hpvResult: "HPV_16_18",
    cytologyResult: "NEGATIVE",
    repeatContext: "PRIMARY_HPV",
    repeatStage: "FIRST_REPEAT",
    screeningHistoryKnown: true,
  }),

  // chch-006 · Hana W., 29 · Demo priority: Surveillance
  // Expected: Create follow-up/safety-net interval rather than immediate high-priority escalation.
  chchCase(6, "chch-006", "Hana W.", "First screen — HPV Other, negative cytology", {
    patientAge: 29,
    hpvResult: "HPV_OTHER",
    cytologyResult: "NEGATIVE",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-007 · Olivia M., 51 · Demo priority: Very High
  // Expected: History override; prior high-grade disease plus HPV16 should trigger high-priority review.
  chchCase(7, "chch-007", "Olivia M.", "Post-treatment surveillance — HPV16, treated CIN3", {
    patientAge: 51,
    hpvResult: "HPV_16_18",
    cytologyResult: "NEGATIVE",
    previousHSILCIN23: true,
    priorHighGradeResult: true,
    screeningHistoryKnown: true,
    priorScreeningHistory: "HIGH_GRADE_TOC_INCOMPLETE",
    // "Post-treatment surveillance" after treated CIN3 IS Test of Cure, so it
    // belongs on Figure 6, not the Figure 3 primary-screening pathway. Without
    // these three fields the engine cannot tell it apart from a routine screen
    // and silently grades it as one.
    isTestOfCure: true,
    repeatContext: "TEST_OF_CURE",
    testOfCureStage: "FIRST_TEST",
    testOfCureStatus: "INCOMPLETE",
  }),

  // chch-008 · Lucy P., 37 · Demo priority: High / Workflow
  // Expected: Flag incomplete triage pathway and place in action/reviewer queue.
  chchCase(8, "chch-008", "Lucy P.", "HPV-positive screen — HPV18, cytology missing", {
    patientAge: 37,
    hpvResult: "HPV_16_18",
    historySourceAvailable: true,
  }),

  // chch-009 · Grace N., 44 · Demo priority: High / Safety net
  // Expected: Flag overdue follow-up and surface for active recall.
  chchCase(9, "chch-009", "Grace N.", "Overdue follow-up — prior HPV16, no new sample", {
    patientAge: 44,
    screeningStatus: "OVERDUE",
    priorHighGradeResult: true,
    screeningHistoryKnown: true,
    priorScreeningHistory: "UNKNOWN",
    historySourceAvailable: true,
  }),

  // chch-010 · Isabella C., 36 · Demo priority: Manual Review
  // Expected: Do not auto-close; flag unresolved previous high-risk episode and missing outcome.
  chchCase(10, "chch-010", "Isabella C.", "Current routine screen — HPV not detected, unresolved prior HPV16", {
    patientAge: 36,
    hpvResult: "NOT_DETECTED",
    priorHighGradeResult: true,
    screeningHistoryKnown: true,
    priorScreeningHistory: "UNKNOWN",
    historySourceAvailable: false,
  }),

  // chch-011 · Charlotte B., 33 · Demo priority: High
  // Expected: Prioritise HPV16 pathway and show LSIL as an additional clinical signal.
  chchCase(11, "chch-011", "Charlotte B.", "First HPV screen — HPV16, LSIL", {
    patientAge: 33,
    hpvResult: "HPV_16_18",
    cytologyResult: "LSIL",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-012 · Mia H., 48 · Demo priority: High
  // Expected: Route based on HPV18 status; cytology should remain visible but not downgrade the pathway.
  chchCase(12, "chch-012", "Mia H.", "Routine screening — HPV18, ASC-US", {
    patientAge: 48,
    hpvResult: "HPV_16_18",
    cytologyResult: "ASC_US",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-013 · Ruby D., 41 · Demo priority: Very High
  // Expected: Detect persistent HPV16 and elevate for prompt clinical review.
  chchCase(13, "chch-013", "Ruby D.", "12-month surveillance — HPV16 persistent, negative cytology", {
    patientAge: 41,
    hpvResult: "HPV_16_18",
    cytologyResult: "NEGATIVE",
    repeatContext: "PRIMARY_HPV",
    repeatStage: "FIRST_REPEAT",
    screeningHistoryKnown: true,
  }),

  // chch-014 · Amelia J., 35 · Demo priority: Very High
  // Expected: Surface immediately; high-risk genotype plus HSIL demonstrates combined-rule escalation.
  chchCase(14, "chch-014", "Amelia J.", "Routine screening — HPV18, HSIL", {
    patientAge: 35,
    hpvResult: "HPV_16_18",
    cytologyResult: "HSIL",
    historySourceAvailable: false,
  }),

  // chch-015 · Zoe F., 28 · Demo priority: High
  // Expected: Demonstrate that negative cytology does not neutralise an HPV16-driven referral pathway.
  chchCase(15, "chch-015", "Zoe F.", "First HPV screen — HPV16, negative cytology", {
    patientAge: 28,
    hpvResult: "HPV_16_18",
    cytologyResult: "NEGATIVE",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-016 · Ella C., 54 · Demo priority: High / Workflow
  // Expected: Flag HPV18 and inadequate cytology; route for clinical action and required specimen/cytology resolution.
  chchCase(16, "chch-016", "Ella C.", "Routine screening — HPV18, cytology unsatisfactory", {
    patientAge: 54,
    hpvResult: "HPV_16_18",
    cytologyResult: "UNSATISFACTORY",
    unsatisfactoryCytologyCount: 1,
  }),

  // chch-017 · Maia R., 32 · Demo priority: Intermediate
  // Expected: Apply non-16/18 triage logic and schedule the appropriate clinical pathway.
  chchCase(17, "chch-017", "Maia R.", "Routine screening — HPV Other, LSIL", {
    patientAge: 32,
    hpvResult: "HPV_OTHER",
    cytologyResult: "LSIL",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-018 · Sarah K., 45 · Demo priority: Very High
  // Expected: Use previous CIN2 plus current HPV16 as a history-based escalation trigger.
  chchCase(18, "chch-018", "Sarah K.", "Post-colposcopy surveillance — HPV16, prior CIN2", {
    patientAge: 45,
    hpvResult: "HPV_16_18",
    cytologyResult: "NEGATIVE",
    previousHSILCIN23: true,
    priorHighGradeResult: true,
    screeningHistoryKnown: true,
    priorScreeningHistory: "HIGH_GRADE_TOC_INCOMPLETE",
    isTestOfCure: true,
    repeatContext: "TEST_OF_CURE",
    testOfCureStage: "FIRST_TEST",
    testOfCureStatus: "INCOMPLETE",
  }),

  // chch-019 · Anika P., 38 · Demo priority: High / Manual Review
  // Expected: Recognise possible persistence and missing follow-up documentation; place in reviewer queue.
  chchCase(19, "chch-019", "Anika P.", "Routine screening — HPV18 persistent, follow-up docs incomplete", {
    patientAge: 38,
    hpvResult: "HPV_16_18",
    cytologyResult: "NEGATIVE",
    repeatContext: "PRIMARY_HPV",
    repeatStage: "FIRST_REPEAT",
    historySourceAvailable: false,
  }),

  // chch-020 · Jessica W., 50 · Demo priority: Routine / Low
  // Expected: Demonstrate a straightforward low-risk case that can move through the routine pathway.
  chchCase(20, "chch-020", "Jessica W.", "Routine screening — HPV not detected, negative cytology", {
    patientAge: 50,
    hpvResult: "NOT_DETECTED",
    cytologyResult: "NEGATIVE",
    screeningStatus: "REGULAR_SCREENING",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-021 · Mia H., 33 · Demo priority: Low
  // Expected: Routine screening pathway; no immediate clinical action. Return to standard recall interval.
  chchCase(21, "chch-021", "Mia H.", "Routine screening — HPV not detected", {
    patientAge: 33,
    hpvResult: "NOT_DETECTED",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-022 · Charlotte B., 41 · Demo priority: Low
  // Expected: No escalation. Maintain routine screening recall and close current screening episode if complete.
  chchCase(22, "chch-022", "Charlotte B.", "Routine screening — HPV not detected", {
    patientAge: 41,
    hpvResult: "NOT_DETECTED",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-023 · Leilani F., 28 · Demo priority: Low
  // Expected: Routine low-priority case. Record result and set standard recall without entering review queue.
  chchCase(23, "chch-023", "Leilani F.", "First HPV screen — HPV not detected", {
    patientAge: 28,
    hpvResult: "NOT_DETECTED",
  }),

  // chch-024 · Amelia J., 48 · Demo priority: Low
  // Expected: No abnormal trigger. Standard recall only.
  chchCase(24, "chch-024", "Amelia J.", "Routine screening — HPV not detected", {
    patientAge: 48,
    hpvResult: "NOT_DETECTED",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-025 · Ruby D., 36 · Demo priority: Low / Surveillance
  // Expected: Place in surveillance pathway rather than urgent review; create follow-up/safety-net tracking.
  chchCase(25, "chch-025", "Ruby D.", "Routine screening — HPV Other, first positive episode", {
    patientAge: 36,
    hpvResult: "HPV_OTHER",
    cytologyResult: "NEGATIVE",
    repeatStage: "BASELINE",
  }),

  // chch-026 · Nina V., 32 · Demo priority: Low / Surveillance
  // Expected: Non-16/18 hrHPV with reassuring triage result. Route to surveillance, track follow-up interval.
  chchCase(26, "chch-026", "Nina V.", "Routine screening — HPV Other, negative cytology", {
    patientAge: 32,
    hpvResult: "HPV_OTHER",
    cytologyResult: "NEGATIVE",
    screeningHistoryKnown: true,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // chch-027 · Ella C., 45 · Demo priority: Low
  // Expected: Reassuring follow-up result. Do not retain prior abnormality as active once pathway is satisfied.
  chchCase(27, "chch-027", "Ella C.", "Follow-up screen — prior HPV Other now HPV not detected", {
    patientAge: 45,
    hpvResult: "NOT_DETECTED",
    repeatContext: "PRIMARY_HPV",
    repeatStage: "FIRST_REPEAT",
  }),

  // chch-028 · Anika P., 38 · Demo priority: Low
  // Expected: Historical minor abnormality should not create unnecessary escalation when current pathway is reassuring.
  chchCase(28, "chch-028", "Anika P.", "Routine screening — HPV not detected, resolved historical ASC-US", {
    patientAge: 38,
    hpvResult: "NOT_DETECTED",
    priorLowGradeResult: true,
    screeningHistoryKnown: true,
    priorScreeningHistory: "LOW_GRADE_RETURNED_TO_REGULAR",
  }),

  // chch-029 · Zoe R., 52 · Demo priority: Low / Surveillance
  // Expected: Track as surveillance rather than urgent referral. Separates non-16/18 hrHPV from HPV16/18 pathways.
  chchCase(29, "chch-029", "Zoe R.", "Routine screening — HPV Other, first positive result", {
    patientAge: 52,
    hpvResult: "HPV_OTHER",
    cytologyResult: "NEGATIVE",
    repeatStage: "BASELINE",
  }),

  // chch-030 · Sienna G., 30 · Demo priority: Low
  // Expected: Routine screening result. No clinical-review alert; standard recall and audit record only.
  chchCase(30, "chch-030", "Sienna G.", "Routine screening — HPV not detected", {
    patientAge: 30,
    hpvResult: "NOT_DETECTED",
  }),
];
