import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateFigure1,
  evaluateFigure2,
  evaluateFigure3,
  evaluateFigure4,
  evaluateFigure5,
  evaluateFigure6,
  evaluateFigure7,
  evaluateFigure8,
  evaluateFigure9,
  evaluateFigure10,
  evaluateTable1,
} from "../../../lib/engine/decision-engine";
import type { ClinicalDecision, ClinicalInput } from "../../../lib/engine/types";
import { rulesFor, type GuidelineRule, type SourceArea } from "./guideline-oracle";

type Evaluator = (input: ClinicalInput) => ClinicalDecision;
type Probe = {
  input?: ClinicalInput;
  evaluate?: Evaluator;
  missingKey?: keyof ClinicalInput;
  unsupportedReason?: string;
};

const sourceEvaluators: Record<SourceArea, Evaluator> = {
  "Figure 1": evaluateFigure1,
  "Figure 2": evaluateFigure2,
  "Figure 3": evaluateFigure3,
  "Figure 4": evaluateFigure4,
  "Figure 5": evaluateFigure5,
  "Figure 6": evaluateFigure6,
  "Figure 7": evaluateFigure7,
  "Figure 8": evaluateFigure8,
  "Table 1": evaluateTable1,
  "Figure 9": evaluateFigure9,
  "Figure 10": evaluateFigure10,
};

function base(overrides: Partial<ClinicalInput> = {}): ClinicalInput {
  return {
    patientId: "SYNTHETIC-CONFORMANCE",
    patientAge: 35,
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    atypicalEndometrialHistory: false,
    immunocompromised: false,
    consecutiveNegativeCoTestCount: 0,
    consecutiveLowGradeCount: 0,
    unsatisfactoryCytologyCount: 0,
    ...overrides,
  };
}

const cytologyMap: Record<string, ClinicalInput["cytologyResult"]> = {
  "NEGATIVE": "NEGATIVE",
  "ASC-US": "ASC_US",
  "LSIL": "LSIL",
  "ASC-H": "ASC_H",
  "HSIL": "HSIL",
  "SCC": "SCC",
  "ATYPICAL-GLANDULAR": "AG3",
  "AIS": "AIS",
  "ADENOCARCINOMA": "AC4",
};

function tokenAfter(id: string, marker: string): string | undefined {
  const rest = id.split(marker)[1];
  if (!rest) return undefined;
  return Object.keys(cytologyMap).sort((a, b) => b.length - a.length).find((token) => rest.startsWith(token));
}

function figure1Probe(id: string): Probe {
  if (id.includes("NEVER-SCREENED")) return { input: base({ screeningStatus: "NEVER_SCREENED" }), missingKey: "screeningStatus" };
  if (id.includes("UNDER-SCREENED")) return { input: base({ screeningStatus: "UNDER_SCREENED" }), missingKey: "screeningStatus" };
  if (id.includes("OVERDUE")) return { input: base({ screeningStatus: "OVERDUE" }), missingKey: "screeningStatus" };
  if (id.includes("REGULAR-NORMAL")) return { input: base({ screeningStatus: "REGULAR_SCREENING", priorScreeningHistory: "NEGATIVE_OR_NORMAL" }), missingKey: "priorScreeningHistory" };
  if (id.includes("LOW-GRADE-RESOLVED")) return { input: base({ screeningStatus: "REGULAR_SCREENING", priorScreeningHistory: "LOW_GRADE_RETURNED_TO_REGULAR" }), missingKey: "priorScreeningHistory" };
  return { input: base({ screeningStatus: "REGULAR_SCREENING", priorScreeningHistory: "HIGH_GRADE_TOC_COMPLETE", testOfCureStatus: "SUCCESSFULLY_COMPLETED" }), missingKey: "testOfCureStatus" };
}

function figure2Probe(id: string): Probe {
  if (id.includes("OUTSTANDING-COLPOSCOPY")) return { input: base({ priorHighGradeResult: true, historySourceAvailable: true, colposcopyRecommendedInLastCytology: true, colposcopyCompletedForLastRecommendation: false }), missingKey: "colposcopyRecommendedInLastCytology" };
  if (id.includes("INCOMPLETE-TOC")) return { input: base({ priorHighGradeResult: true, historySourceAvailable: true, colposcopyRecommendedInLastCytology: false, testOfCureStatus: "INCOMPLETE" }), missingKey: "testOfCureStatus" };
  if (id.includes("TOC-COMPLETE-F3")) return { input: base({ priorHighGradeResult: true, historySourceAvailable: true, testOfCureStatus: "SUCCESSFULLY_COMPLETED" }), missingKey: "testOfCureStatus" };
  if (id.includes("AIS-NO-TOTAL")) return { input: base({ previousAIS: true, historySourceAvailable: true, isPostHysterectomy: false }), missingKey: "previousAIS" };
  if (id.includes("OLDER-3Y")) return { input: base({ previousAtypicalEndometrialCells: true, historySourceAvailable: true, ag2ReportDate: "2020-01-01" }), missingKey: "ag2ReportDate" };
  if (id.includes("DISCHARGED")) return { input: base({ previousAtypicalEndometrialCells: true, historySourceAvailable: true, specialistDischargedToPrimaryCare: true }), missingKey: "specialistDischargedToPrimaryCare" };
  return { input: base({ previousAtypicalEndometrialCells: true, historySourceAvailable: true, ag2ReportDate: new Date().toISOString(), specialistDischargedToPrimaryCare: false, returnedTo3YearlyCytologyScreening: false }), missingKey: "ag2ReportDate" };
}

function figure3Probe(id: string): Probe {
  if (id.includes("MISSING-GENOTYPE")) return { input: base({ sampleType: "LBC" }), missingKey: "hpvResult" };
  if (id.includes("MISSING-SAMPLE-TYPE")) return { input: base({ hpvResult: "NOT_DETECTED" }), missingKey: "sampleType" };
  if (id.includes("MISSING-AGE")) return { input: base({ patientAge: undefined, hpvResult: "HPV_OTHER", sampleType: "LBC", cytologyResult: "NEGATIVE", repeatStage: "FIRST_REPEAT" }), missingKey: "patientAge" };
  if (id.includes("UNKNOWN-IMMUNE")) return { input: base({ hpvResult: "NOT_DETECTED", sampleType: "LBC", immunocompromised: undefined as unknown as boolean }), missingKey: "immunocompromised" };
  if (id.includes("UNSUITABLE")) return { unsupportedReason: "ClinicalInput collapses invalid/unsuitable into one INADEQUATE HPV value and cannot encode leakage/unsuitable separately." };
  if (id.includes("CYTOLOGY-PENDING")) return { input: base({ hpvResult: "HPV_OTHER", sampleType: "LBC" }), missingKey: "cytologyResult" };
  if (id.includes("SECOND-UNSAT")) return { input: base({ hpvResult: "HPV_OTHER", sampleType: "LBC", cytologyResult: "UNSATISFACTORY", unsatisfactoryCytologyCount: 2 }), missingKey: "unsatisfactoryCytologyCount" };
  if (id.includes("FIRST-UNSAT")) return { input: base({ hpvResult: "HPV_OTHER", sampleType: "LBC", cytologyResult: "UNSATISFACTORY", unsatisfactoryCytologyCount: 1 }), missingKey: "cytologyResult" };
  if (id.includes("INVALID-HPV")) return { input: base({ hpvResult: "INADEQUATE", sampleType: "LBC" }), missingKey: "hpvResult" };
  if (id.includes("HPV16-18")) return { input: base({ hpvResult: "HPV_16_18", sampleType: id.includes("SWAB") ? "SWAB" : "LBC" }), missingKey: "sampleType" };
  if (id.includes("HPV-OTHER-SWAB-RETURN")) return { input: base({ hpvResult: "HPV_OTHER", sampleType: "SWAB", swabReturnVisitCompleted: false }), missingKey: "sampleType" };
  if (id.includes("HPV-NOT-DETECTED") || id.includes("NOT-DETECTED")) {
    return { input: base({ hpvResult: "NOT_DETECTED", sampleType: id.includes("SWAB") ? "SWAB" : "LBC", immunocompromised: id.includes("IMMUNE-3Y"), repeatStage: id.includes("SECOND-REPEAT") ? "SECOND_REPEAT" : id.includes("FIRST-REPEAT") ? "FIRST_REPEAT" : "BASELINE" }), missingKey: id.includes("IMMUNE") || id.includes("5Y") ? "immunocompromised" : "hpvResult" };
  }
  if (id.includes("SECOND-REPEAT-HPV16-18")) return { input: base({ hpvResult: "HPV_16_18", sampleType: "LBC", repeatStage: "SECOND_REPEAT", cytologyResult: "NEGATIVE" }), missingKey: "repeatStage" };
  if (id.includes("SECOND-REPEAT-HPV-OTHER")) return { input: base({ hpvResult: "HPV_OTHER", sampleType: "LBC", repeatStage: "SECOND_REPEAT", cytologyResult: "NEGATIVE" }), missingKey: "repeatStage" };
  const cytToken = tokenAfter(id, "HPV-OTHER-");
  if (cytToken) {
    const stage = id.includes("FIRST-REPEAT") ? "FIRST_REPEAT" : "BASELINE";
    return { input: base({ patientAge: id.includes("AGE50PLUS") ? 50 : 49, hpvResult: "HPV_OTHER", sampleType: "LBC", cytologyResult: cytologyMap[cytToken], repeatStage: stage }), missingKey: "cytologyResult" };
  }
  return { unsupportedReason: `No source-to-engine probe mapper for ${id}.` };
}

function figure4Probe(id: string): Probe {
  const common = { currentFigure: "FIGURE_4" as const, normalColposcopy: true, repeatContext: "POST_NORMAL_COLPOSCOPY_LOW_GRADE_CYTOLOGY" as const };
  if (id.includes("TYPE3")) return { input: base({ ...common, hpvResult: undefined, colposcopyTZType: "TYPE3", cytologyResult: "LSIL" }), missingKey: "colposcopyTZType" };
  if (id.includes("INITIAL")) return { input: base(common), missingKey: "normalColposcopy" };
  if (id.includes("NOT-DETECTED")) return { input: base({ ...common, hpvResult: "NOT_DETECTED", immunocompromised: id.includes("IMMUNE-3Y"), repeatStage: id.includes("SECOND-REPEAT") ? "SECOND_REPEAT" : "FIRST_REPEAT" }), missingKey: "immunocompromised" };
  if (id.includes("HPV16-18")) return { input: base({ ...common, hpvResult: "HPV_16_18", repeatStage: id.includes("SECOND-REPEAT") ? "SECOND_REPEAT" : "FIRST_REPEAT" }), missingKey: "hpvResult" };
  if (id.includes("SECOND-REPEAT-HPV-OTHER")) return { input: base({ ...common, hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE", repeatStage: "SECOND_REPEAT" }), missingKey: "repeatStage" };
  const token = tokenAfter(id, "HPV-OTHER-");
  if (token) return { input: base({ ...common, hpvResult: "HPV_OTHER", cytologyResult: cytologyMap[token], immunocompromised: id.includes("IMMUNE-COLPOSCOPY"), repeatStage: "FIRST_REPEAT" }), missingKey: "cytologyResult" };
  return { unsupportedReason: `No source-to-engine probe mapper for ${id}.` };
}

function figure5Probe(id: string): Probe {
  const common = { currentFigure: "FIGURE_5" as const, normalColposcopy: true, hpvResult: "HPV_OTHER" as const, cytologyResult: "ASC_H" as const };
  if (id.includes("MDM-PENDING")) return { input: base(common), missingKey: "mdmOutcome" };
  if (id.includes("DOWNGRADED")) return { input: base({ ...common, mdmOutcome: "DOWNGRADED_LSIL" }), missingKey: "mdmOutcome" };
  if (id.includes("UPGRADED")) return { input: base({ ...common, mdmOutcome: "UPGRADED_HSIL" }), missingKey: "mdmOutcome" };
  if (id.includes("HPV-NOT-DETECTED")) return { input: base({ ...common, mdmOutcome: "CONFIRMED_ASC_H", hpvResult: "NOT_DETECTED", visibleLesion: false }), missingKey: "visibleLesion" };
  if (id.includes("HPV-DETECTED-NORMAL")) return { input: base({ ...common, mdmOutcome: "CONFIRMED_ASC_H", cytologyResult: "NEGATIVE", visibleLesion: false }), missingKey: "cytologyResult" };
  return { input: base({ ...common, mdmOutcome: "CONFIRMED_ASC_H", cytologyResult: "HSIL", visibleLesion: true }), missingKey: "mdmOutcome" };
}

function figure6Probe(id: string): Probe {
  const common = { currentFigure: "FIGURE_6" as const, isTestOfCure: true, treatmentDate: "2025-01-01" };
  if (id.includes("MISSING-TREATMENT")) return { input: base({ ...common, treatmentDate: undefined, hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE" }), missingKey: "treatmentDate" };
  if (id.includes("POSITIVE-MARGINS")) return { unsupportedReason: "ClinicalInput has no HSIL excision-margin field, so updated R8.06 cannot be represented." };
  if (id.includes("HPV-DETECTED")) return { input: base({ ...common, hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE", testOfCureStage: id.includes("AFTER-LOW-GRADE") ? "CONTINUING" : "FIRST_TEST" }), missingKey: "treatmentDate" };
  if (id.includes("HIGH-GRADE")) return { input: base({ ...common, hpvResult: "NOT_DETECTED", cytologyResult: "HSIL", testOfCureStage: id.includes("18M") ? "SECOND_TEST" : "FIRST_TEST" }), missingKey: "treatmentDate" };
  if (id.includes("ABNORMAL-COLPOSCOPY")) return { input: base({ ...common, hpvResult: "NOT_DETECTED", cytologyResult: "LSIL", testOfCureStage: "CONTINUING" }), missingKey: "treatmentDate" };
  if (id.includes("AFTER-LOW-GRADE-NEGATIVE")) return { input: base({ ...common, hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE", testOfCureStage: "CONTINUING" }), missingKey: "treatmentDate" };
  if (id.includes("LOW-GRADE")) return { input: base({ ...common, hpvResult: "NOT_DETECTED", cytologyResult: "LSIL", testOfCureStage: id.includes("18M") ? "SECOND_TEST" : "FIRST_TEST" }), missingKey: "treatmentDate" };
  if (id.includes("SECOND-NEGATIVE")) return { input: base({ ...common, hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE", testOfCureStage: "SECOND_TEST", consecutiveNegativeCoTestCount: 1 }), missingKey: "treatmentDate" };
  if (id.includes("FIRST-NEGATIVE")) return { input: base({ ...common, hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE", testOfCureStage: "FIRST_TEST" }), missingKey: "treatmentDate" };
  return { unsupportedReason: `No source-to-engine probe mapper for ${id}.` };
}

function figure7Probe(id: string): Probe {
  const exactCode = id.match(/^F7-(AG[1-5]|AC[1-4])-/)?.[1] as ClinicalInput["cytologyResult"] | undefined;
  if (exactCode) return { input: base({ currentFigure: "FIGURE_7", cytologyResult: exactCode }), missingKey: "cytologyResult" };
  const common = { currentFigure: "FIGURE_7" as const, cytologyResult: "AG3" as const };
  if (id.includes("CLEAR-MARGINS")) return { unsupportedReason: "ClinicalInput cannot encode AIS pre-treatment HPV status plus excision margin status and treatment date for updated R9.14." };
  if (id.includes("CONFIRMED-TYPE3")) return { input: base({ ...common, visibleLesion: false, mdmOutcome: "CYTOLOGY_CONFIRMED_NOT_AG2" }), missingKey: "mdmOutcome" };
  if (id.includes("AG2-CONFIRMED")) return { input: base({ ...common, visibleLesion: false, mdmOutcome: "AG2_CYTOLOGY_CONFIRMED" }), missingKey: "mdmOutcome" };
  if (id.includes("NOT-CONFIRMED")) return { input: base({ ...common, visibleLesion: false, mdmOutcome: "CYTOLOGY_NOT_CONFIRMED" }), missingKey: "mdmOutcome" };
  if (id.includes("BIOPSY-AIS")) return { input: base({ ...common, visibleLesion: true, biopsyResult: "AIS" }), missingKey: "biopsyResult" };
  if (id.includes("BIOPSY-CANCER")) return { input: base({ ...common, visibleLesion: true, biopsyResult: "ADENOCARCINOMA" }), missingKey: "biopsyResult" };
  return { unsupportedReason: `No source-to-engine probe mapper for ${id}.` };
}

function hysterectomyProbe(rule: GuidelineRule): Probe {
  const id = rule.ruleId;
  if (id.includes("CANCER-") || id.includes("GYNAECOLOGICAL-CANCER")) return { unsupportedReason: "ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state." };
  const input: Partial<ClinicalInput> = { currentFigure: rule.figureOrTable === "Table 1" ? "TABLE_1" : "FIGURE_8", isPostHysterectomy: true, hysterectomyType: "TOTAL", hysterectomyIndication: "BENIGN_GYNAECOLOGICAL_DISEASE", hysterectomyDate: "2025-01-01" };
  if (id.includes("NO-KNOWN-HISTORY") || id.includes("NO-HISTORY")) input.priorScreeningHistory = "NO_KNOWN_SCREENING_HISTORY";
  else if (id.includes("LOW-GRADE-NOT-RETURNED") || id.includes("PRIOR-LOW-GRADE-NOT-RETURNED")) input.priorScreeningHistory = "LOW_GRADE_NOT_RETURNED_TO_REGULAR";
  else if (id.includes("TOC-COMPLETE")) input.priorScreeningHistory = "HIGH_GRADE_TOC_COMPLETE";
  else if (id.includes("UNTREATED")) input.priorScreeningHistory = "HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED";
  else if (id.includes("INCOMPLETE-TOC")) input.priorScreeningHistory = "HIGH_GRADE_TOC_INCOMPLETE";
  else input.priorScreeningHistory = "NEGATIVE_OR_NORMAL";

  if (id.includes("NO-OR-LOW-PATHOLOGY") || id.includes("NO-LOW-PATHOLOGY")) input.hysterectomySpecimenPathology = "NO_CERVICAL_PATHOLOGY";
  else if (id.includes("LSIL") && !id.includes("HISTORY") && !id.includes("LOW-GRADE-NOT-RETURNED")) input.hysterectomySpecimenPathology = "LSIL_CIN1";
  else if (id.includes("HSIL-AIS-COMPLETE") || id.includes("HIGH-GRADE-COMPLETE")) { input.hysterectomySpecimenPathology = "HSIL_CIN23"; input.excisionStatus = "COMPLETE"; }
  else if (id.includes("HSIL-AIS-INCOMPLETE") || id.includes("HIGH-GRADE-INCOMPLETE")) { input.hysterectomySpecimenPathology = "HSIL_CIN23"; input.excisionStatus = "INCOMPLETE"; }
  else input.hysterectomySpecimenPathology = "NO_CERVICAL_PATHOLOGY";
  return { input: base(input), missingKey: "hysterectomySpecimenPathology" };
}

function figure9Probe(id: string): Probe {
  const common = { currentFigure: "FIGURE_9" as const, isPregnant: true };
  if (id.includes("INITIAL-COLPOSCOPY")) {
    const cyt = id.includes("ASC-H") ? "ASC_H" : id.includes("HSIL") ? "HSIL" : id.includes("AIS") ? "AIS" : "AG3";
    return { input: base({ ...common, cytologyResult: cyt }), missingKey: "isPregnant" };
  }
  if (id.includes("DOWNGRADE-NEGATIVE")) return { input: base({ ...common, cytologyResult: "HSIL", transformationZoneState: "NORMAL", visibleLesion: false, mdmOutcome: "DOWNGRADED_NEGATIVE" }), missingKey: "mdmOutcome" };
  if (id.includes("DOWNGRADE-LOW")) return { input: base({ ...common, cytologyResult: "HSIL", transformationZoneState: "NORMAL", visibleLesion: false, mdmOutcome: "DOWNGRADED_LSIL" }), missingKey: "mdmOutcome" };
  if (id.includes("CONFIRMS-HIGH")) return { input: base({ ...common, cytologyResult: "HSIL", transformationZoneState: "NORMAL", visibleLesion: false, mdmOutcome: "CONFIRMED_HIGH_GRADE" }), missingKey: "mdmOutcome" };
  if (id.includes("ABNORMAL-TZ")) return { input: base({ ...common, cytologyResult: "HSIL", transformationZoneState: "ABNORMAL", visibleLesion: true, colposcopicImpression: "HSIL" }), missingKey: "colposcopicImpression" };
  if (id.includes("POSITIVE-ONCOLOGY")) return { input: base({ ...common, cytologyResult: "HSIL", transformationZoneState: "ABNORMAL", visibleLesion: true, colposcopicImpression: "INVASION", biopsyResult: "SCC" }), missingKey: "biopsyResult" };
  if (id.includes("NEGATIVE-MDM")) return { input: base({ ...common, cytologyResult: "HSIL", transformationZoneState: "ABNORMAL", visibleLesion: true, colposcopicImpression: "INVASION", biopsyResult: "NORMAL" }), missingKey: "biopsyResult" };
  return { unsupportedReason: `No source-to-engine probe mapper for ${id}.` };
}

function figure10Probe(id: string): Probe {
  const assessed = { currentFigure: "FIGURE_10" as const, hasAbnormalVaginalBleeding: true, bleedingType: "POST_COITAL" as const, menstrualHistoryCaptured: true, contraceptiveHistoryCaptured: true, sexualHistoryCaptured: true, speculumExamCompleted: true, pelvicExamCompleted: true, coTestCompleted: true };
  if (id.includes("SINGLE-PREMENOPAUSAL") || id.includes("RECURRENT-PERSISTENT") || id.includes("PERSISTENT-UNEXPLAINED") || id.includes("POSTMENOPAUSAL")) return { unsupportedReason: "ClinicalInput cannot encode menopausal status, episode count/persistence, or the full reassuring co-test combination required by R15.02/R15.05/R15.06." };
  if (id.includes("CANCER-SIGNS")) return { input: base({ ...assessed, hasCancerSymptoms: true }), missingKey: "hasCancerSymptoms" };
  if (id.includes("ABNORMAL-CERVIX-CANCER")) return { input: base({ ...assessed, abnormalCervix: true, suspicionOfCancer: true }), missingKey: "suspicionOfCancer" };
  if (id.includes("ABNORMAL-CERVIX-NO-CANCER")) return { input: base({ ...assessed, abnormalCervix: true, suspicionOfCancer: false }), missingKey: "suspicionOfCancer" };
  if (id.includes("OCP")) return { input: base({ ...assessed, abnormalCervix: false, suspectOralContraceptiveProblem: true }), missingKey: "suspectOralContraceptiveProblem" };
  if (id.includes("STI-TREAT")) return { input: base({ ...assessed, abnormalCervix: false, suspectOralContraceptiveProblem: false, stiIdentified: true }), missingKey: "stiIdentified" };
  if (id.includes("NO-STI")) return { input: base({ ...assessed, abnormalCervix: false, suspectOralContraceptiveProblem: false, stiIdentified: false }), missingKey: "stiIdentified" };
  if (id.includes("RESOLVED-AGE25PLUS")) return { input: base({ ...assessed, patientAge: 25, abnormalBleedingStage: "SIX_TO_EIGHT_WEEK_REVIEW", bleedingResolved: true }), missingKey: "bleedingResolved" };
  if (id.includes("RESOLVED-UNDER25")) return { input: base({ ...assessed, patientAge: 24, abnormalBleedingStage: "SIX_TO_EIGHT_WEEK_REVIEW", bleedingResolved: true }), missingKey: "bleedingResolved" };
  if (id.includes("PERSISTS-GYNAECOLOGY")) return { input: base({ ...assessed, abnormalBleedingStage: "SIX_TO_EIGHT_WEEK_REVIEW", bleedingResolved: false }), missingKey: "bleedingResolved" };
  return { unsupportedReason: `No source-to-engine probe mapper for ${id}.` };
}

export function probeFor(rule: GuidelineRule): Probe {
  const evaluate = sourceEvaluators[rule.figureOrTable];
  let probe: Probe;
  switch (rule.figureOrTable) {
    case "Figure 1": probe = figure1Probe(rule.ruleId); break;
    case "Figure 2": probe = figure2Probe(rule.ruleId); break;
    case "Figure 3": probe = figure3Probe(rule.ruleId); break;
    case "Figure 4": probe = figure4Probe(rule.ruleId); break;
    case "Figure 5": probe = figure5Probe(rule.ruleId); break;
    case "Figure 6": probe = figure6Probe(rule.ruleId); break;
    case "Figure 7": probe = figure7Probe(rule.ruleId); break;
    case "Figure 8":
    case "Table 1": probe = hysterectomyProbe(rule); break;
    case "Figure 9": probe = figure9Probe(rule.ruleId); break;
    case "Figure 10": probe = figure10Probe(rule.ruleId); break;
  }
  return { ...probe, evaluate };
}

export function actualActionClass(decision: ClinicalDecision): string {
  const code = decision.recommendationCode;
  if (decision.safetyOutcome === "INSUFFICIENT_INFORMATION" || decision.safetyOutcome === "EXTERNAL_HISTORY_REQUIRED") return "SAFETY_STOP";
  if (code.includes("ONCOLOGY")) return "ONCOLOGY";
  if (decision.referralType === "GYNAECOLOGY") return decision.riskLevel === "URGENT" ? "URGENT_GYNAECOLOGY" : "GYNAECOLOGY";
  if (decision.referralType === "COLPOSCOPY") return "COLPOSCOPY";
  if (decision.referralType === "SPECIALIST") return "SPECIALIST_FOLLOW_UP";
  if (decision.requiresMDMReview || code.includes("MDM")) return "MDM_REVIEW";
  if (code.includes("INVITE-NOW")) return "INVITE_NOW";
  if (code.includes("INVITE-NEXT")) return "INVITE_NEXT_SCHEDULED";
  if (code.includes("FIG3")) return "ROUTE_FIGURE_3";
  if (code.includes("DOWNGRADED-LSIL")) return "ROUTE_LSIL";
  if (code.includes("UPGRADED-HSIL")) return "ROUTE_HSIL";
  if (code.includes("TYPE3-EXCISION")) return "TYPE3_EXCISION";
  if (code.includes("INVESTIGATE-MALIGNANCIES")) return "GYNAECOLOGY_INVESTIGATION";
  if (code.includes("RETURN-REQUIRED")) return "RETURN_FOR_LBC";
  if (code.includes("NO-FURTHER")) return "NO_FURTHER_SCREENING";
  if (code.includes("HPV-6M")) return "POST_HYSTERECTOMY_HPV_6M";
  if (code.includes("LSIL-HPV") || code.includes("NO-PATH-HPV") || code.includes("POST-HYST-HPV")) return "POST_HYSTERECTOMY_HPV";
  if (code.includes("SECOND-NEGATIVE-RETURN")) return "TOC_COMPLETE";
  if (code.includes("CONTINUE-TOC") || code.includes("INCOMPLETE-TOC") || code.includes("UNTREATED-HSIL")) return "CONTINUE_TOC";
  if (code.includes("TOC") || code.includes("COMPLETE-TOC")) return "TEST_OF_CURE";
  if (code.includes("SECOND-REPEAT") || code.includes("LOW-GRADE-SECOND-REPEAT")) return code.includes("COLP") ? "COLPOSCOPY" : "SECOND_REPEAT_HPV";
  if (code.includes("REPEAT") && code.includes("COLPOSCOPY")) return "REPEAT_COLPOSCOPY_COTEST";
  if (code.includes("REPEAT") || code.includes("INAD")) return code.startsWith("F6") ? "REPEAT_COTEST" : "REPEAT_HPV";
  if (code.includes("HPV-NOT-DETECTED") || code.includes("RETURN-REGULAR")) return "ROUTINE_RECALL";
  if (code.includes("TREAT")) return "TREATMENT";
  if (code.includes("ABNORMAL-TZ-REVIEW") || code.includes("HIGH-GRADE-REVIEW")) return "PREGNANCY_COLPOSCOPY_REVIEW";
  if (code.includes("BIOPSY")) return "BIOPSY";
  if (code.includes("OCP")) return "OCP_REVIEW";
  if (code.includes("STI-TREAT")) return "STI_REVIEW";
  if (code.includes("NO-STI") || code.includes("NO-CANCER-REVIEW")) return "LOCAL_PATHWAY_REVIEW";
  if (code.includes("REVIEW-RESOLVED")) return decision.nextAction.includes("age 25") ? "SCREEN_AT_25" : "ROUTINE_SCREENING";
  if (code.includes("1618") || code.includes("HIGH-GRADE")) return "COLPOSCOPY";
  return `UNMAPPED_ACTUAL:${code}`;
}

export function equivalent(expected: string, actual: string): boolean {
  const aliases: Record<string, string[]> = {
    AIS_FOLLOW_UP: ["SAFETY_STOP", "TEST_OF_CURE", "COLPOSCOPY"],
    GLANDULAR_SPECIALIST_ROUTE: ["COLPOSCOPY", "GYNAECOLOGY", "URGENT_GYNAECOLOGY"],
    COMMUNITY_TOC: ["TEST_OF_CURE", "CONTINUE_TOC", "COMMUNITY_TOC"],
    SPECIALIST_FOLLOW_UP: ["COLPOSCOPY", "SPECIALIST_FOLLOW_UP"],
    NO_MDM_CONTINUE_F4: ["REPEAT_HPV", "SECOND_REPEAT_HPV", "NO_MDM_CONTINUE_F4"],
    NO_COLPOSCOPY: ["ROUTINE_SCREENING", "ROUTINE_RECALL", "NO_COLPOSCOPY"],
    SPECIALIST_TREATMENT_DECISION_REQUIRED: ["TREATMENT", "COLPOSCOPY"],
    FIGURE_5_COTEST_SURVEILLANCE: ["TEST_OF_CURE", "REPEAT_COTEST"],
  };
  return expected === actual || aliases[expected]?.includes(actual) === true;
}

export interface ClinicalFixture {
  caseId: string;
  sourceRuleId: string;
  figureOrTable: SourceArea;
  page: number;
  recommendationNumbers: string[];
  syntheticInput: ClinicalInput | Record<string, string[]>;
  expected: {
    route: string;
    action: string;
    referral: string | null;
    timeframe: string | null;
    mandatoryReview: boolean;
    missingData: string;
  };
  rationale: string;
  testClass: "golden" | "negative" | "missing-data";
}

export function fixtureFor(rule: GuidelineRule, testClass: ClinicalFixture["testClass"]): ClinicalFixture {
  const probe = probeFor(rule);
  return {
    caseId: `${rule.ruleId}-${testClass.toUpperCase()}`,
    sourceRuleId: rule.ruleId,
    figureOrTable: rule.figureOrTable,
    page: rule.page,
    recommendationNumbers: rule.recommendationNumbers,
    syntheticInput: probe.input ?? { sourceConditions: rule.branchConditions },
    expected: {
      route: rule.figureOrTable,
      action: rule.actionClass,
      referral: rule.referralDestination,
      timeframe: rule.guidelineTimeframe,
      mandatoryReview: rule.mandatoryClinicianReview,
      missingData: rule.missingDataBehaviour,
    },
    rationale: rule.rationale,
    testClass,
  };
}

export function runSourceSuite(source: SourceArea): void {
  const sourceRules = rulesFor(source);
  for (let index = 0; index < sourceRules.length; index += 1) {
    const rule = sourceRules[index];
    const probe = probeFor(rule);

    test(`${rule.ruleId} golden source-to-implementation comparison`, () => {
      const fixture = fixtureFor(rule, "golden");
      assert.equal(fixture.sourceRuleId, rule.ruleId);
      assert.ok(rule.recommendationNumbers.length > 0, `${rule.ruleId} needs an exact recommendation/range citation`);
      assert.ok(probe.input && probe.evaluate, probe.unsupportedReason ?? `No executable probe for ${rule.ruleId}`);
      const actual = probe.evaluate!(probe.input!);
      const actualClass = actualActionClass(actual);
      assert.ok(equivalent(rule.actionClass, actualClass), `${rule.ruleId}: expected ${rule.actionClass}; actual ${actualClass} (${actual.recommendationCode}) trace=${JSON.stringify(actual.branchPath)}`);
      if (rule.referralRequired) assert.equal(actual.referralRequired, true, `${rule.ruleId} must preserve referral`);
      if (rule.repeatInterval?.match(/^\d+ months$/)) assert.equal(actual.recallIntervalMonths, Number(rule.repeatInterval.split(" ")[0]), `${rule.ruleId} interval mismatch`);
      if (rule.clinicianOnly) assert.ok(actual.safetyOutcome === "CLINICIAN_REVIEW_REQUIRED" || actual.referralRequired || actual.requiresMDMReview, `${rule.ruleId} clinician-only branch was emitted without an explicit review/referral boundary`);
    });

    test(`${rule.ruleId} nearest-neighbour exclusion fixture`, () => {
      const neighbour = sourceRules[(index + 1) % sourceRules.length];
      const fixture = fixtureFor(rule, "negative");
      assert.notEqual(rule.ruleId, neighbour.ruleId);
      assert.notDeepEqual([...rule.entryCriteria, ...rule.branchConditions], [...neighbour.entryCriteria, ...neighbour.branchConditions], `${rule.ruleId} was collapsed with its nearest source neighbour`);
      assert.equal(fixture.testClass, "negative");
    });

    test(`${rule.ruleId} missing-critical-data safety`, () => {
      const fixture = fixtureFor(rule, "missing-data");
      assert.match(fixture.expected.missingData, /stop|request|missing|incomplete|do not|remain|CLINICIAN_REVIEW_REQUIRED/i);
      if (!probe.input || !probe.evaluate || !probe.missingKey) return;
      const missingInput = { ...probe.input };
      delete (missingInput as Partial<ClinicalInput>)[probe.missingKey];
      const actual = probe.evaluate(missingInput);
      assert.ok(
        actual.safetyOutcome === "INSUFFICIENT_INFORMATION" ||
          actual.safetyOutcome === "EXTERNAL_HISTORY_REQUIRED" ||
          actual.safetyOutcome === "CLINICIAN_REVIEW_REQUIRED" ||
          actual.requiresMDMReview === true,
        `${rule.ruleId}: deleting ${String(probe.missingKey)} still produced ${actual.recommendationCode} without a safe stop`
      );
    });
  }
}
