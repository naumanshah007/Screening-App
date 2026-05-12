import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateClinicalDecision } from "../decision-engine";
import type { ClinicalInput } from "../types";
import { answersToInputFields, getInvalidatedAnswerStepIds, getNextUnansweredStep, getVisibleAnswerMap, getVisibleSteps, WIZARD_STEPS } from "../../wizard/steps";

type WizardScenario = {
  answers: Record<string, string>;
  expectedCode: string;
  expectedInput?: Partial<ClinicalInput>;
};

function completeViaWizardAnswers(scenario: WizardScenario): {
  visibleAnswers: Record<string, string>;
  clinicalInput: ClinicalInput;
  actualCode: string;
} {
  const visibleAnswers = getVisibleAnswerMap(scenario.answers);
  const fieldMap = answersToInputFields(visibleAnswers) as Partial<ClinicalInput>;
  const clinicalInput: ClinicalInput = {
    ...fieldMap,
    patientId: "test-patient",
    patientAge: 35,
    isFirstTimeHPVTransition: fieldMap.isFirstTimeHPVTransition ?? false,
    isPostHysterectomy: fieldMap.isPostHysterectomy ?? false,
    atypicalEndometrialHistory: fieldMap.atypicalEndometrialHistory ?? false,
    immunocompromised: fieldMap.immunocompromised ?? false,
    isTestOfCure: fieldMap.isTestOfCure ?? false,
    consecutiveNegativeCoTestCount: 0,
    consecutiveLowGradeCount: 0,
    unsatisfactoryCytologyCount: 0,
  };

  for (const [key, value] of Object.entries(scenario.expectedInput ?? {})) {
    assert.deepEqual(clinicalInput[key as keyof ClinicalInput], value, key);
  }

  const decision = evaluateClinicalDecision(clinicalInput);
  assert.equal(decision.recommendationCode, scenario.expectedCode);

  return {
    visibleAnswers,
    clinicalInput,
    actualCode: decision.recommendationCode,
  };
}

const standardScreeningAnswers = {
  pathway_entry: "CLINICAL_CARE",
  consent_confirmed: "true",
  is_post_hysterectomy: "false",
  immunocompromised: "false",
  is_first_hpv_transition: "false",
  has_abnormal_vaginal_bleeding: "false",
};

const directHpvAnswers = {
  pathway_entry: "DIRECT_HPV",
  consent_confirmed: "true",
  immunocompromised: "false",
};

const primaryHpvAnswers = {
  ...standardScreeningAnswers,
  is_pregnant: "false",
  is_test_of_cure: "false",
  repeat_context: "PRIMARY_HPV",
  repeat_stage: "BASELINE",
  has_colposcopy_findings: "false",
};

const figure5Answers = {
  ...standardScreeningAnswers,
  sample_type: "LBC",
  hpv_result: "HPV_OTHER",
  is_pregnant: "false",
  is_test_of_cure: "false",
  repeat_context: "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY",
  has_colposcopy_findings: "true",
  tz_type: "TYPE1",
  biopsy_taken: "false",
  mdm_outcome: "CONFIRMED_ASC_H",
};

const testOfCureAnswers = {
  ...standardScreeningAnswers,
  sample_type: "LBC",
  is_pregnant: "false",
  is_test_of_cure: "true",
};

test("Wizard/API completion mapping: Figure 3 HPV 16/18 swab bypasses return-visit block without cytology", () => {
  completeViaWizardAnswers({
    answers: {
      ...directHpvAnswers,
      sample_type: "SWAB",
      hpv_result: "HPV_16_18",
    },
    expectedCode: "F3-1618-COLP",
    expectedInput: {
      sampleType: "SWAB",
      swabReturnVisitCompleted: undefined,
      hpvResult: "HPV_16_18",
      cytologyResult: undefined,
    },
  });
});

test("Wizard/API completion mapping: Figure 3 HPV 16/18 LBC bypasses cytology requirement", () => {
  completeViaWizardAnswers({
    answers: {
      ...directHpvAnswers,
      sample_type: "LBC",
      hpv_result: "HPV_16_18",
    },
    expectedCode: "F3-1618-COLP",
    expectedInput: {
      sampleType: "LBC",
      hpvResult: "HPV_16_18",
      cytologyResult: undefined,
    },
  });
});

test("Wizard/API completion mapping: Figure 3 HPV 16/18 ignores stale swab-return answer", () => {
  const result = completeViaWizardAnswers({
    answers: {
      ...directHpvAnswers,
      sample_type: "SWAB",
      swab_return_visit_completed: "false",
      hpv_result: "HPV_16_18",
    },
    expectedCode: "F3-1618-COLP",
    expectedInput: {
      swabReturnVisitCompleted: undefined,
      hpvResult: "HPV_16_18",
    },
  });

  assert.equal(result.visibleAnswers.swab_return_visit_completed, undefined);
});

test("Wizard/API completion mapping: Figure 3 HPV Other swab still requires return visit", () => {
  const result = completeViaWizardAnswers({
    answers: {
      ...directHpvAnswers,
      sample_type: "SWAB",
      swab_return_visit_completed: "false",
      hpv_result: "HPV_OTHER",
      cytology_result: "NEGATIVE",
    },
    expectedCode: "F3-SWAB-RETURN-REQUIRED",
    expectedInput: {
      sampleType: "SWAB",
      swabReturnVisitCompleted: false,
      hpvResult: "HPV_OTHER",
      cytologyResult: undefined,
    },
  });

  assert.equal(result.visibleAnswers.cytology_result, undefined);
  assert.equal(getNextUnansweredStep(result.visibleAnswers), null);
});

test("Wizard/API completion mapping: Figure 3 HPV Other high-grade cytology routes to colposcopy", () => {
  completeViaWizardAnswers({
    answers: {
      ...directHpvAnswers,
      sample_type: "LBC",
      hpv_result: "HPV_OTHER",
      cytology_result: "HSIL",
    },
    expectedCode: "F3-HPV-OTHER-HIGH-GRADE-COLP",
    expectedInput: {
      hpvResult: "HPV_OTHER",
      cytologyResult: "HSIL",
    },
  });
});

test("Wizard UI flow: cytology is hidden after HPV 16/18 and inadequate options are hidden", () => {
  const hpvStep = WIZARD_STEPS.find((step) => step.id === "hpv_result");
  const cytologyStep = WIZARD_STEPS.find((step) => step.id === "cytology_result");

  assert.ok(hpvStep);
  assert.ok(cytologyStep);
  assert.equal(hpvStep.options?.some((option) => option.value === "INADEQUATE" || /Inadequate/i.test(option.label)), false);
  assert.equal(cytologyStep.options?.some((option) => option.value === "UNSATISFACTORY" || /Unsatisfactory|Inadequate|Repeat required/i.test(option.label)), false);

  const visibleAfterHpv1618 = getVisibleSteps({
    ...directHpvAnswers,
    sample_type: "SWAB",
    hpv_result: "HPV_16_18",
  }).map((step) => step.id);

  assert.equal(visibleAfterHpv1618.includes("cytology_result"), false);
  assert.equal(visibleAfterHpv1618.includes("swab_return_visit_completed"), false);
});

test("Wizard UI flow: consent gate blocks clinical questions until confirmed", () => {
  const beforeConsent = getVisibleSteps({ pathway_entry: "DIRECT_HPV" }).map((step) => step.id);
  assert.deepEqual(beforeConsent.filter((id) => id !== "patient_context"), ["pathway_entry", "consent_confirmed"]);
  assert.equal(getNextUnansweredStep({ pathway_entry: "DIRECT_HPV" })?.id, "consent_confirmed");

  const consentStep = WIZARD_STEPS.find((step) => step.id === "consent_confirmed");
  assert.equal(consentStep?.type, "consent-checkbox");
  assert.equal(consentStep?.options?.some((option) => option.value === "false"), false);
});

test("Wizard UI flow: entry pathway selection routes Direct HPV and clinical care differently", () => {
  assert.equal(WIZARD_STEPS.find((step) => step.id === "pathway_entry")?.options?.[0]?.value, "DIRECT_HPV");
  assert.equal(getNextUnansweredStep({ pathway_entry: "DIRECT_HPV", consent_confirmed: "true" })?.id, "immunocompromised");
  assert.equal(getNextUnansweredStep({ pathway_entry: "DIRECT_HPV", consent_confirmed: "true", immunocompromised: "false" })?.id, "sample_type");
  assert.equal(getNextUnansweredStep({ pathway_entry: "CLINICAL_CARE", consent_confirmed: "true" })?.id, "is_post_hysterectomy");
});

test("Wizard UI flow: Back target is previous visible answered step and changed answers prune future branch answers", () => {
  const answers = {
    ...directHpvAnswers,
    sample_type: "LBC",
    hpv_result: "HPV_OTHER",
    cytology_result: "NEGATIVE",
  };
  const visible = getVisibleSteps(answers).filter((step) => step.type !== "info");
  const currentStep = getNextUnansweredStep(answers);
  const previousStep = visible.slice(0, currentStep ? visible.findIndex((step) => step.id === currentStep.id) : visible.length).reverse().find((step) => step.id in answers);

  assert.equal(previousStep?.id, "cytology_result");
  assert.deepEqual(getInvalidatedAnswerStepIds(answers, "hpv_result", "HPV_16_18"), ["cytology_result"]);
});

test("Wizard/API completion mapping: Figure 5 confirmed ASC-H HPV detected normal colposcopy negative cytology repeats", () => {
  completeViaWizardAnswers({
    answers: {
      ...figure5Answers,
      cytology_result: "NEGATIVE",
      visible_lesion: "false",
      colposcopic_impression: "NORMAL",
    },
    expectedCode: "F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M",
    expectedInput: {
      repeatContext: "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY",
      mdmOutcome: "CONFIRMED_ASC_H",
      normalColposcopy: true,
      visibleLesion: false,
      cytologyResult: "NEGATIVE",
    },
  });
});

test("Wizard/API completion mapping: Figure 5 confirmed ASC-H abnormal cytology recommends treatment", () => {
  completeViaWizardAnswers({
    answers: {
      ...figure5Answers,
      cytology_result: "LSIL",
      visible_lesion: "false",
      colposcopic_impression: "NORMAL",
    },
    expectedCode: "F5-CONFIRMED-ASCH-TREAT",
    expectedInput: {
      mdmOutcome: "CONFIRMED_ASC_H",
      visibleLesion: false,
      cytologyResult: "LSIL",
    },
  });
});

test("Wizard/API completion mapping: Figure 5 confirmed ASC-H visible lesion recommends treatment", () => {
  completeViaWizardAnswers({
    answers: {
      ...figure5Answers,
      cytology_result: "NEGATIVE",
      visible_lesion: "true",
      colposcopic_impression: "LSIL",
    },
    expectedCode: "F5-CONFIRMED-ASCH-TREAT",
    expectedInput: {
      mdmOutcome: "CONFIRMED_ASC_H",
      visibleLesion: true,
      cytologyResult: "NEGATIVE",
    },
  });
});

test("Wizard/API completion mapping: Figure 6 first negative Test of Cure repeats in 12 months", () => {
  completeViaWizardAnswers({
    answers: {
      ...testOfCureAnswers,
      hpv_result: "NOT_DETECTED",
      cytology_result: "NEGATIVE",
      test_of_cure_stage: "FIRST_TEST",
    },
    expectedCode: "F6-FIRST-NEGATIVE-REPEAT-12M",
    expectedInput: {
      isTestOfCure: true,
      testOfCureStage: "FIRST_TEST",
      hpvResult: "NOT_DETECTED",
      cytologyResult: "NEGATIVE",
    },
  });
});

test("Wizard/API completion mapping: Figure 6 second negative Test of Cure returns to regular screening", () => {
  completeViaWizardAnswers({
    answers: {
      ...testOfCureAnswers,
      hpv_result: "NOT_DETECTED",
      cytology_result: "NEGATIVE",
      test_of_cure_stage: "SECOND_TEST",
    },
    expectedCode: "F6-SECOND-NEGATIVE-RETURN-REGULAR",
    expectedInput: {
      isTestOfCure: true,
      testOfCureStage: "SECOND_TEST",
    },
  });
});

test("Wizard/API completion mapping: Figure 6 repeat HPV negative with abnormal cytology routes to colposcopy", () => {
  completeViaWizardAnswers({
    answers: {
      ...testOfCureAnswers,
      hpv_result: "NOT_DETECTED",
      cytology_result: "LSIL",
      test_of_cure_stage: "SECOND_TEST",
    },
    expectedCode: "F6-REPEAT-HPV-NEG-CYTOLOGY-ABNORMAL-COLP",
    expectedInput: {
      testOfCureStage: "SECOND_TEST",
      cytologyResult: "LSIL",
    },
  });
});

test("Wizard/API completion mapping: Figure 8 low-risk returned history with LSIL/CIN1 routes to HPV/Figure 3 branch", () => {
  completeViaWizardAnswers({
    answers: {
      pathway_entry: "CLINICAL_CARE",
      consent_confirmed: "true",
      is_post_hysterectomy: "true",
      hysterectomy_type: "TOTAL",
      prior_screening_history: "LOW_GRADE_RETURNED_TO_REGULAR",
      hysterectomy_indication: "BENIGN_GYNAECOLOGICAL_DISEASE",
      hysterectomy_specimen_pathology: "LSIL_CIN1",
      post_hysterectomy_hpv_test_indicated: "false",
    },
    expectedCode: "F8-NEG-RETURNED-LSIL-HPV",
    expectedInput: {
      hysterectomyType: "TOTAL",
      priorScreeningHistory: "LOW_GRADE_RETURNED_TO_REGULAR",
      hysterectomySpecimenPathology: "LSIL_CIN1",
    },
  });
});

test("Wizard/API completion mapping: Figure 8 untreated/incomplete HSIL/AIS with LSIL/CIN1 routes to Test of Cure", () => {
  completeViaWizardAnswers({
    answers: {
      pathway_entry: "CLINICAL_CARE",
      consent_confirmed: "true",
      is_post_hysterectomy: "true",
      hysterectomy_type: "TOTAL",
      prior_screening_history: "HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED",
      hysterectomy_indication: "HSIL_CIN23_OR_AIS",
      hysterectomy_specimen_pathology: "LSIL_CIN1",
      post_hysterectomy_hpv_test_indicated: "false",
    },
    expectedCode: "F8-UNTREATED-HSIL-AIS-NO-PATH-LOWGRADE-TOC",
    expectedInput: {
      priorScreeningHistory: "HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED",
      hysterectomySpecimenPathology: "LSIL_CIN1",
    },
  });
});

test("Wizard/API completion mapping: Table 1 no known history with no pathology schedules HPV at 6 months", () => {
  completeViaWizardAnswers({
    answers: {
      pathway_entry: "CLINICAL_CARE",
      consent_confirmed: "true",
      is_post_hysterectomy: "true",
      hysterectomy_type: "TOTAL",
      prior_screening_history: "NO_KNOWN_SCREENING_HISTORY",
      hysterectomy_indication: "BENIGN_GYNAECOLOGICAL_DISEASE",
      hysterectomy_specimen_pathology: "NO_CERVICAL_PATHOLOGY",
      post_hysterectomy_hpv_test_indicated: "false",
    },
    expectedCode: "F8-NO-HISTORY-NO-PATH-LOWGRADE-HPV-6M",
    expectedInput: {
      priorScreeningHistory: "NO_KNOWN_SCREENING_HISTORY",
      hysterectomySpecimenPathology: "NO_CERVICAL_PATHOLOGY",
    },
  });
});

test("Wizard/API completion mapping: Figure 9 pregnant qualifying cytology without colposcopy findings routes to initial colposcopy", () => {
  for (const cytologyResult of ["ASC_H", "HSIL", "AIS", "AG1", "AG5"] as const) {
    completeViaWizardAnswers({
      answers: {
        ...standardScreeningAnswers,
        sample_type: "LBC",
        hpv_result: "HPV_OTHER",
        cytology_result: cytologyResult,
        is_pregnant: "true",
        has_colposcopy_findings: "false",
      },
      expectedCode: "F9-INITIAL-COLPOSCOPY",
      expectedInput: {
        isPregnant: true,
        cytologyResult,
      },
    });
  }
});

test("Wizard/API completion mapping: Figure 10 abnormal bleeding with cancer symptoms routes to urgent gynaecology", () => {
  completeViaWizardAnswers({
    answers: {
      pathway_entry: "CLINICAL_CARE",
      consent_confirmed: "true",
      is_post_hysterectomy: "false",
      immunocompromised: "false",
      is_first_hpv_transition: "false",
      has_abnormal_vaginal_bleeding: "true",
      abnormal_bleeding_stage: "INITIAL_ASSESSMENT",
      has_cancer_symptoms: "true",
    },
    expectedCode: "F10-CANCER-SYMPTOMS-URGENT-GYN",
    expectedInput: {
      hasAbnormalVaginalBleeding: true,
      abnormalBleedingStage: "INITIAL_ASSESSMENT",
      hasCancerSymptoms: true,
    },
  });
});

test("Wizard/API completion mapping preserves Figure 2 returned-to-3-yearly-cytology field", () => {
  completeViaWizardAnswers({
    answers: {
      pathway_entry: "CLINICAL_CARE",
      consent_confirmed: "true",
      is_post_hysterectomy: "false",
      immunocompromised: "false",
      is_first_hpv_transition: "true",
      screening_status: "REGULAR_SCREENING",
      transition_prior_history: "PREVIOUS_ATYPICAL_ENDOMETRIAL",
      ag2_report_timing: "WITHIN_3_YEARS",
      specialist_discharged_to_primary_care: "false",
      returned_to_3_yearly_cytology_screening: "true",
    },
    expectedCode: "F2-AG2-RETURNED-3Y-CYTOLOGY-FIG3",
    expectedInput: {
      returnedTo3YearlyCytologyScreening: true,
      previousAtypicalEndometrialCells: true,
      priorScreeningHistory: "PREVIOUS_ATYPICAL_ENDOMETRIAL",
    },
  });
});

test("Wizard/API completion mapping preserves all completion-route clinical fields", () => {
  const { clinicalInput } = completeViaWizardAnswers({
    answers: {
      ...figure5Answers,
      cytology_result: "NEGATIVE",
      visible_lesion: "false",
      colposcopic_impression: "NORMAL",
      returned_to_3_yearly_cytology_screening: "true",
    },
    expectedCode: "F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M",
  });

  assert.equal(clinicalInput.visibleLesion, false);
  assert.equal(clinicalInput.normalColposcopy, true);
  assert.equal(clinicalInput.mdmOutcome, "CONFIRMED_ASC_H");
  assert.equal(clinicalInput.testOfCureStage, undefined);
  assert.equal(clinicalInput.hysterectomyType, undefined);
  assert.equal(clinicalInput.priorScreeningHistory, undefined);
  assert.equal(clinicalInput.hysterectomySpecimenPathology, undefined);
  assert.equal(clinicalInput.excisionStatus, undefined);
});

test("Wizard/API completion mapping preserves AIS colposcopic impression for structured persistence", () => {
  const { clinicalInput } = completeViaWizardAnswers({
    answers: {
      ...standardScreeningAnswers,
      sample_type: "LBC",
      hpv_result: "HPV_OTHER",
      cytology_result: "HSIL",
      is_pregnant: "true",
      has_colposcopy_findings: "true",
      tz_type: "TYPE1",
      transformation_zone_state: "ABNORMAL",
      visible_lesion: "true",
      colposcopic_impression: "AIS",
      biopsy_taken: "false",
    },
    expectedCode: "F9-ABNORMAL-TZ-REVIEW",
    expectedInput: {
      colposcopicImpression: "AIS",
    },
  });

  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const completionRoute = readFileSync("app/api/pathway/sessions/[id]/complete/route.ts", "utf8");

  assert.match(schema, /enum ColposcopicImpression \{[\s\S]*\bAIS\b[\s\S]*\}/);
  assert.doesNotMatch(completionRoute, /colposcopicImpression\s*!==\s*["']AIS["']/);
  assert.equal(clinicalInput.colposcopicImpression, "AIS");
});

test("Session isolation: same patient Run 2 does not retain HPV Other swab-return result", () => {
  const run1 = completeViaWizardAnswers({
    answers: {
      ...primaryHpvAnswers,
      sample_type: "SWAB",
      swab_return_visit_completed: "false",
      hpv_result: "HPV_OTHER",
      cytology_result: "NEGATIVE",
    },
    expectedCode: "F3-SWAB-RETURN-REQUIRED",
  });
  const run2 = completeViaWizardAnswers({
    answers: {
      ...primaryHpvAnswers,
      sample_type: "SWAB",
      swab_return_visit_completed: "false",
      hpv_result: "HPV_16_18",
      cytology_result: "NEGATIVE",
    },
    expectedCode: "F3-1618-COLP",
  });

  assert.equal(run1.clinicalInput.patientId, run2.clinicalInput.patientId);
  assert.equal(run2.clinicalInput.hpvResult, "HPV_16_18");
  assert.notEqual(run2.clinicalInput.hpvResult, run1.clinicalInput.hpvResult);
  assert.notEqual(run2.actualCode, run1.actualCode);
});

test("Session isolation: new primary HPV run does not retain previous Test of Cure stage", () => {
  const run1 = completeViaWizardAnswers({
    answers: {
      ...testOfCureAnswers,
      hpv_result: "NOT_DETECTED",
      cytology_result: "NEGATIVE",
      test_of_cure_stage: "SECOND_TEST",
    },
    expectedCode: "F6-SECOND-NEGATIVE-RETURN-REGULAR",
  });
  const run2 = completeViaWizardAnswers({
    answers: {
      ...primaryHpvAnswers,
      sample_type: "LBC",
      hpv_result: "NOT_DETECTED",
    },
    expectedCode: "F3-HPV-NOT-DETECTED-5Y",
  });

  assert.equal(run1.clinicalInput.patientId, run2.clinicalInput.patientId);
  assert.equal(run2.clinicalInput.isTestOfCure, false);
  assert.equal(run2.clinicalInput.testOfCureStage, undefined);
  assert.equal(run2.clinicalInput.repeatContext, "PRIMARY_HPV");
});

test("Session isolation: new uterus-intact run does not retain hysterectomy fields", () => {
  const run1 = completeViaWizardAnswers({
    answers: {
      pathway_entry: "CLINICAL_CARE",
      consent_confirmed: "true",
      is_post_hysterectomy: "true",
      hysterectomy_type: "TOTAL",
      prior_screening_history: "HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED",
      hysterectomy_indication: "HSIL_CIN23_OR_AIS",
      hysterectomy_specimen_pathology: "LSIL_CIN1",
      post_hysterectomy_hpv_test_indicated: "false",
    },
    expectedCode: "F8-UNTREATED-HSIL-AIS-NO-PATH-LOWGRADE-TOC",
  });
  const run2 = completeViaWizardAnswers({
    answers: {
      ...primaryHpvAnswers,
      sample_type: "LBC",
      hpv_result: "NOT_DETECTED",
    },
    expectedCode: "F3-HPV-NOT-DETECTED-5Y",
  });

  assert.equal(run1.clinicalInput.patientId, run2.clinicalInput.patientId);
  assert.equal(run2.clinicalInput.isPostHysterectomy, false);
  assert.equal(run2.clinicalInput.hysterectomyType, undefined);
  assert.equal(run2.clinicalInput.priorScreeningHistory, undefined);
  assert.equal(run2.clinicalInput.hysterectomySpecimenPathology, undefined);
  assert.equal(run2.clinicalInput.excisionStatus, undefined);
});

test("Session isolation: Figure 10 priority does not remain active in new primary HPV run", () => {
  const run1 = completeViaWizardAnswers({
    answers: {
      pathway_entry: "CLINICAL_CARE",
      consent_confirmed: "true",
      is_post_hysterectomy: "false",
      immunocompromised: "false",
      is_first_hpv_transition: "false",
      has_abnormal_vaginal_bleeding: "true",
      abnormal_bleeding_stage: "INITIAL_ASSESSMENT",
      has_cancer_symptoms: "true",
    },
    expectedCode: "F10-CANCER-SYMPTOMS-URGENT-GYN",
  });
  const run2 = completeViaWizardAnswers({
    answers: {
      ...primaryHpvAnswers,
      sample_type: "LBC",
      hpv_result: "NOT_DETECTED",
    },
    expectedCode: "F3-HPV-NOT-DETECTED-5Y",
  });

  assert.equal(run1.clinicalInput.patientId, run2.clinicalInput.patientId);
  assert.equal(run2.clinicalInput.hasAbnormalVaginalBleeding, false);
  assert.equal(run2.clinicalInput.hasCancerSymptoms, undefined);
});

test("Session isolation: pregnancy state and high-grade cytology do not remain active in new primary HPV run", () => {
  const run1 = completeViaWizardAnswers({
    answers: {
      ...standardScreeningAnswers,
      sample_type: "LBC",
      hpv_result: "HPV_OTHER",
      cytology_result: "HSIL",
      is_pregnant: "true",
      has_colposcopy_findings: "false",
    },
    expectedCode: "F9-INITIAL-COLPOSCOPY",
  });
  const run2 = completeViaWizardAnswers({
    answers: {
      ...primaryHpvAnswers,
      sample_type: "LBC",
      hpv_result: "NOT_DETECTED",
    },
    expectedCode: "F3-HPV-NOT-DETECTED-5Y",
  });

  assert.equal(run1.clinicalInput.patientId, run2.clinicalInput.patientId);
  assert.notEqual(run2.clinicalInput.isPregnant, true);
  assert.equal(run2.clinicalInput.cytologyResult, undefined);
  assert.equal(run2.actualCode, "F3-HPV-NOT-DETECTED-5Y");
});
