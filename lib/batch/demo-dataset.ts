/**
 * Batch Processing — Built-in Demo Dataset
 *
 * 14 de-identified sample cases exercising all major decision pathways.
 * Each row is a valid CanonicalBatchCase with source metadata.
 *
 * DEMO DATA — NOT REAL PATIENT DATA.
 * These cases are fictional and designed to exercise the decision engine.
 */

import type { CanonicalBatchCase } from "./types";
import { ENGINE_VERSION } from "./processor";

const DEMO_SOURCE_BASE = {
  sourceType: "demo" as const,
  sourceSystem: "Privexa Demo Dataset",
  sourceFileName: "built-in-demo-dataset",
  mappingVersion: "demo-v1",
  engineVersion: ENGINE_VERSION,
};

function demoCase(
  index: number,
  label: string,
  fields: Partial<CanonicalBatchCase>
): CanonicalBatchCase {
  return {
    caseId: crypto.randomUUID(),
    label,
    source: {
      ...DEMO_SOURCE_BASE,
      rowNumber: index + 1,
      importedAt: new Date().toISOString(),
      externalPatientId: `DEMO-${String(index + 1).padStart(3, "0")}`,
    },

    // Required defaults
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
    consecutiveNegativeCoTestCount: 0,
    consecutiveLowGradeCount: 0,
    unsatisfactoryCytologyCount: 0,

    // Validation
    validationStatus: "valid",
    validationErrors: [],
    validationWarnings: [],

    // Override with case-specific fields
    ...fields,
  };
}

export const DEMO_DATASET: CanonicalBatchCase[] = [
  // ── 1. HPV Negative, routine — Figure 3 → 5yr recall ───────────────────
  demoCase(0, "HPV Negative — routine recall", {
    patientAge: 35,
    hpvResult: "NOT_DETECTED",
    sampleType: "LBC",
  }),

  // ── 2. HPV 16/18, colposcopy referral — Figure 3 → colposcopy ──────────
  demoCase(1, "HPV 16/18 — colposcopy referral", {
    patientAge: 42,
    hpvResult: "HPV_16_18",
    sampleType: "LBC",
  }),

  // ── 3. HPV Other + Negative cytology — Figure 3 → 12mo repeat ──────────
  demoCase(2, "HPV Other + Negative cytology — 12mo repeat", {
    patientAge: 38,
    hpvResult: "HPV_OTHER",
    cytologyResult: "NEGATIVE",
    sampleType: "LBC",
  }),

  // ── 4. HPV Other + LSIL — Figure 3 → 12mo repeat ──────────────────────
  demoCase(3, "HPV Other + LSIL — 12mo repeat", {
    patientAge: 30,
    hpvResult: "HPV_OTHER",
    cytologyResult: "LSIL",
    sampleType: "LBC",
  }),

  // ── 5. HPV Other + HSIL — Figure 3 → colposcopy ────────────────────────
  demoCase(4, "HPV Other + HSIL — colposcopy referral", {
    patientAge: 45,
    hpvResult: "HPV_OTHER",
    cytologyResult: "HSIL",
    sampleType: "LBC",
  }),

  // ── 6. HPV Negative, immunocompromised — Figure 3 → 3yr recall ─────────
  demoCase(5, "HPV Negative, immunocompromised — 3yr recall", {
    patientAge: 50,
    hpvResult: "NOT_DETECTED",
    immunocompromised: true,
    sampleType: "LBC",
  }),

  // ── 7. Post-hysterectomy (benign, total) — Table 1 → exit screening ────
  demoCase(6, "Post-hysterectomy (benign, total) — exit screening", {
    patientAge: 55,
    isPostHysterectomy: true,
    hysterectomyType: "TOTAL",
    hysterectomyIndication: "BENIGN_GYNAECOLOGICAL_DISEASE",
    hysterectomySpecimenPathology: "NO_CERVICAL_PATHOLOGY",
  }),

  // ── 8. Test of Cure, 1st test, HPV negative — Figure 6 → continue ToC ──
  demoCase(7, "Test of Cure — 1st test, HPV negative", {
    patientAge: 40,
    hpvResult: "NOT_DETECTED",
    cytologyResult: "NEGATIVE",
    isTestOfCure: true,
    repeatContext: "TEST_OF_CURE",
    testOfCureStage: "FIRST_TEST",
    sampleType: "LBC",
  }),

  // ── 9. Pregnant + HSIL cytology — Figure 9 → pregnancy pathway ─────────
  demoCase(8, "Pregnant + HSIL cytology — pregnancy pathway", {
    patientAge: 32,
    hpvResult: "HPV_OTHER",
    cytologyResult: "HSIL",
    isPregnant: true,
    sampleType: "LBC",
  }),

  // ── 10. Abnormal bleeding + cancer symptoms — Figure 10 → urgent ────────
  demoCase(9, "Abnormal bleeding + cancer symptoms — urgent referral", {
    patientAge: 48,
    hasAbnormalVaginalBleeding: true,
    abnormalBleedingStage: "INITIAL_ASSESSMENT",
    hasCancerSymptoms: true,
  }),

  // ── 11. HPV 16/18 + CIN3 at colposcopy — Figure 5 → treatment ─────────
  demoCase(10, "HPV 16/18 + CIN3 at colposcopy — treatment", {
    patientAge: 37,
    hpvResult: "HPV_16_18",
    cytologyResult: "HSIL",
    colposcopicImpression: "HSIL",
    biopsyResult: "CIN3",
    sampleType: "LBC",
    repeatContext: "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY",
  }),

  // ── 12. Glandular cytology AG2 — Figure 7 → gynae referral ─────────────
  demoCase(11, "Glandular cytology AG2 — gynaecology referral", {
    patientAge: 52,
    hpvResult: "HPV_OTHER",
    cytologyResult: "AG2",
    sampleType: "LBC",
  }),

  // ── 13. Transition, never screened — Figure 1 → invite now ─────────────
  demoCase(12, "First HPV transition — never screened, invite now", {
    patientAge: 28,
    isFirstTimeHPVTransition: true,
    screeningStatus: "NEVER_SCREENED",
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
  }),

  // ── 14. HPV Other + LSIL, 2nd repeat — Figure 3 → colposcopy ──────────
  demoCase(13, "HPV Other + LSIL, 2nd repeat — colposcopy escalation", {
    patientAge: 44,
    hpvResult: "HPV_OTHER",
    cytologyResult: "LSIL",
    repeatStage: "SECOND_REPEAT",
    sampleType: "LBC",
  }),
];
