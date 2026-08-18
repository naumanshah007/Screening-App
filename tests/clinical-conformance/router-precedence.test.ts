import assert from "node:assert/strict";
import test from "node:test";
import { evaluateClinicalDecision } from "../../lib/engine/decision-engine";
import type { ClinicalInput, PathwayFigure } from "../../lib/engine/types";

function base(overrides: Partial<ClinicalInput> = {}): ClinicalInput {
  return { patientId: "SYNTHETIC-ROUTER", patientAge: 35, isFirstTimeHPVTransition: false, isPostHysterectomy: false, atypicalEndometrialHistory: false, immunocompromised: false, consecutiveNegativeCoTestCount: 0, consecutiveLowGradeCount: 0, unsatisfactoryCytologyCount: 0, ...overrides };
}

type RouterCase = {
  id: string;
  input: ClinicalInput;
  expectedFigure: PathwayFigure;
  expectedCode?: string;
  rationale: string;
};

const cases: RouterCase[] = [
  { id: "RP-01-SYMPTOMS-HPV-NOT-DETECTED", input: base({ hpvResult: "NOT_DETECTED", sampleType: "LBC", hasAbnormalVaginalBleeding: true }), expectedFigure: "FIGURE_10", rationale: "Symptom investigation precedes routine HPV recall." },
  { id: "RP-02-SYMPTOMS-HPV16-18", input: base({ hpvResult: "HPV_16_18", sampleType: "LBC", hasAbnormalVaginalBleeding: true }), expectedFigure: "FIGURE_10", rationale: "The symptomatic assessment is selected first; its co-test result then informs referral." },
  { id: "RP-03-UNDER25-SUSPICIOUS-SYMPTOMS", input: base({ patientAge: 24, hasAbnormalVaginalBleeding: true, hasCancerSymptoms: true }), expectedFigure: "FIGURE_10", expectedCode: "F10-CANCER-SYMPTOMS-URGENT-GYN", rationale: "Cancer-suspicion referral applies at any age and must precede routine age eligibility." },
  { id: "RP-04-AGE70-74-HPV16-18", input: base({ patientAge: 70, hpvResult: "HPV_16_18", sampleType: "LBC" }), expectedFigure: "FIGURE_3", expectedCode: "F3-1618-COLP", rationale: "A detected HPV 16/18 result is managed, not intercepted by an exit-screen invitation gate." },
  { id: "RP-05-AGE75-SUSPECTED-CANCER", input: base({ patientAge: 75, hasAbnormalVaginalBleeding: true, hasCancerSymptoms: true }), expectedFigure: "FIGURE_10", expectedCode: "F10-CANCER-SYMPTOMS-URGENT-GYN", rationale: "Routine programme exit never suppresses symptomatic cancer investigation." },
  { id: "RP-06-PREGNANCY-HIGH-GRADE", input: base({ isPregnant: true, cytologyResult: "HSIL", hpvResult: "HPV_OTHER" }), expectedFigure: "FIGURE_9", rationale: "Pregnancy high-grade management precedes ordinary Figure 3 triage." },
  { id: "RP-07-PREGNANCY-SUSPECTED-INVASION", input: base({ isPregnant: true, cytologyResult: "HSIL", transformationZoneState: "ABNORMAL", visibleLesion: true, colposcopicImpression: "INVASION" }), expectedFigure: "FIGURE_9", expectedCode: "F9-INVASION-IMPRESSION-BIOPSY", rationale: "Suspected invasion remains inside the pregnancy specialist pathway through biopsy/oncology routing." },
  { id: "RP-08-PREGNANCY-ACTIVE-TOC", input: base({ isPregnant: true, isTestOfCure: true, hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE", treatmentDate: "2025-01-01" }), expectedFigure: "FIGURE_6", rationale: "Pregnancy alone does not invoke Figure 9 without qualifying high-grade/glandular cytology; active ToC remains controlling." },
  { id: "RP-09-TOTAL-HYSTERECTOMY-BLEEDING", input: base({ isPostHysterectomy: true, hysterectomyType: "TOTAL", hasAbnormalVaginalBleeding: true }), expectedFigure: "FIGURE_10", rationale: "Active abnormal bleeding takes precedence over screening-cessation logic." },
  { id: "RP-10-TOTAL-HYSTERECTOMY-PRIOR-AIS", input: base({ isPostHysterectomy: true, hysterectomyType: "TOTAL", priorScreeningHistory: "PREVIOUS_AIS", hysterectomySpecimenPathology: "AIS", excisionStatus: "COMPLETE" }), expectedFigure: "FIGURE_8", rationale: "Total hysterectomy history is resolved through Figure 8/Table 1 and current cancer/AIS guidance, not routine Figure 3." },
  { id: "RP-11-ACTIVE-TOC-HPV16-18", input: base({ isTestOfCure: true, hpvResult: "HPV_16_18", cytologyResult: "NEGATIVE", treatmentDate: "2025-01-01" }), expectedFigure: "FIGURE_6", expectedCode: "F6-HPV-DETECTED-ANY-CYTOLOGY-COLP", rationale: "Active ToC controls longitudinal meaning while retaining HPV-detected colposcopy escalation." },
  { id: "RP-12-UNRESOLVED-PRIOR-HIGH-GRADE-NEGATIVE-HPV", input: base({ isFirstTimeHPVTransition: true, priorHighGradeResult: true, historySourceAvailable: true, testOfCureStatus: "INCOMPLETE", hpvResult: "NOT_DETECTED", sampleType: "LBC" }), expectedFigure: "FIGURE_2", rationale: "Unresolved high-grade history prevents routine negative-HPV reassurance." },
  { id: "RP-13-GLANDULAR-ABNORMALITY-ROUTINE-INPUTS", input: base({ hpvResult: "HPV_OTHER", sampleType: "LBC", cytologyResult: "AG3" }), expectedFigure: "FIGURE_7", rationale: "Glandular abnormalities enter Figure 7 specialist routing before generic Figure 3." },
  { id: "RP-14-INVALID-HPV-HIGH-GRADE-CYTOLOGY", input: base({ hpvResult: "INADEQUATE", sampleType: "LBC", cytologyResult: "HSIL" }), expectedFigure: "FIGURE_3", expectedCode: "F3-HPV-OTHER-HIGH-GRADE-COLP", rationale: "A reportable high-grade cytology result must not be erased by the invalid HPV branch; the exact implementation code may differ but colposcopy must result." },
  { id: "RP-15-UNSAT-CYTOLOGY-HPV16-18", input: base({ hpvResult: "HPV_16_18", sampleType: "LBC", cytologyResult: "UNSATISFACTORY" }), expectedFigure: "FIGURE_3", expectedCode: "F3-1618-COLP", rationale: "Unsatisfactory cytology does not delay the HPV 16/18 colposcopy branch." },
  { id: "RP-16-IMMUNE-HPV-NOT-DETECTED", input: base({ hpvResult: "NOT_DETECTED", sampleType: "LBC", immunocompromised: true }), expectedFigure: "FIGURE_3", expectedCode: "F3-HPV-NOT-DETECTED-IC-3Y", rationale: "Current immune classification changes regular recall to three years." },
  { id: "RP-17-IMMUNE-PERSISTENT-HPV-OTHER", input: base({ currentFigure: "FIGURE_4", repeatContext: "POST_NORMAL_COLPOSCOPY_LOW_GRADE_CYTOLOGY", normalColposcopy: true, hpvResult: "HPV_OTHER", cytologyResult: "LSIL", immunocompromised: true }), expectedFigure: "FIGURE_4", expectedCode: "F4-HPV-OTHER-LOW-GRADE-IC-COLP", rationale: "The immune branch after normal colposcopy proceeds to colposcopy." },
  { id: "RP-18-CANCER-HISTORY-HYSTERECTOMY", input: base({ isPostHysterectomy: true, hysterectomyType: "TOTAL", priorScreeningHistory: "UNKNOWN", hysterectomySpecimenPathology: "NORMAL" }), expectedFigure: "FIGURE_8", expectedCode: "F8-UNMAPPED-HYSTERECTOMY-BRANCH", rationale: "Cancer history outside deterministic NCSP scenarios requires clinician review; the product cannot encode it." },
  { id: "RP-19-MISSING-EXTERNAL-HISTORY-ROUTINE-RESULT", input: base({ isFirstTimeHPVTransition: true, screeningStatus: "REGULAR_SCREENING", historySourceAvailable: false, hpvResult: "NOT_DETECTED", sampleType: "LBC" }), expectedFigure: "FIGURE_1", expectedCode: "F1-HISTORY-DETAIL-REQUIRED", rationale: "Missing external screening history prevents a confident transition/routine result." },
];

for (const fixture of cases) {
  test(`${fixture.id}: ${fixture.rationale}`, () => {
    const actual = evaluateClinicalDecision(fixture.input);
    assert.equal(actual.figure, fixture.expectedFigure, `trace=${JSON.stringify(actual.branchPath)}`);
    if (fixture.id === "RP-14-INVALID-HPV-HIGH-GRADE-CYTOLOGY") {
      assert.equal(actual.referralType, "COLPOSCOPY", `actual=${actual.recommendationCode}; trace=${JSON.stringify(actual.branchPath)}`);
    } else if (fixture.expectedCode) {
      assert.equal(actual.recommendationCode, fixture.expectedCode, `trace=${JSON.stringify(actual.branchPath)}`);
    }
  });
}
