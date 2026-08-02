import type { ClinicalInput } from "@/lib/engine/types";

import type { ClinicalFactMap } from "./evaluator";

function assignIfAbsent(
  target: ClinicalFactMap,
  key: string,
  value: unknown
) {
  if (target[key] === undefined && value !== undefined && value !== null) {
    target[key] = value;
  }
}

function canonicalHpvResult(value: ClinicalInput["hpvResult"]) {
  if (value === "INADEQUATE") return undefined;
  return value;
}

function canonicalCytologyResult(value: ClinicalInput["cytologyResult"]) {
  if (value === "SCC") return "DEFINITE_INVASIVE_CANCER";
  return value;
}

function canonicalTzType(value: ClinicalInput["tzType"] | ClinicalInput["colposcopyTZType"]) {
  if (value === "TYPE1") return "TYPE_1";
  if (value === "TYPE2") return "TYPE_2";
  if (value === "TYPE3") return "TYPE_3";
  return undefined;
}

function canonicalHistoryGroup(value: ClinicalInput["priorScreeningHistory"]) {
  switch (value) {
    case "NEGATIVE_OR_NORMAL":
    case "LOW_GRADE_ONLY":
    case "LOW_GRADE_RETURNED_TO_REGULAR":
      return "NEGATIVE_OR_RESOLVED_LOW_GRADE";
    case "LOW_GRADE_NOT_RETURNED_TO_REGULAR":
      return "LOW_GRADE_NOT_RETURNED_TO_REGULAR";
    case "HIGH_GRADE_TOC_COMPLETE":
      return "TREATED_HSIL_TOC_COMPLETE";
    case "HIGH_GRADE_TOC_INCOMPLETE":
      return "PREVIOUS_TREATMENT_INCOMPLETE_TOC";
    case "HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED":
      return "UNTREATED_OR_INCOMPLETELY_TREATED_HSIL_AIS";
    case "NO_KNOWN_SCREENING_HISTORY":
      return "NO_KNOWN_SCREENING_HISTORY";
    default:
      return undefined;
  }
}

function canonicalPathology(value: ClinicalInput["hysterectomySpecimenPathology"]) {
  if (["NO_CERVICAL_PATHOLOGY", "NORMAL", "LSIL_CIN1"].includes(value ?? "")) {
    return "NO_OR_LOW_GRADE";
  }
  if (["HSIL_CIN23", "AIS"].includes(value ?? "")) return "HSIL_OR_AIS";
  return undefined;
}

function canonicalEventStage(input: Partial<ClinicalInput>) {
  if (input.currentFigure === "FIGURE_4") {
    if (input.repeatStage === "FIRST_REPEAT") return "TWELVE_MONTH_REPEAT";
    if (input.repeatStage === "SECOND_REPEAT") return "TWENTY_FOUR_MONTH_REPEAT";
  }
  if (input.repeatStage === "BASELINE") return "INITIAL";
  return input.repeatStage;
}

/**
 * Translate facts already present in the current legacy ClinicalInput contract
 * into the governed canonical vocabulary. The adapter never fabricates absent
 * clinical facts: unknown values remain absent, and a legacy false immune flag
 * is not promoted to a verified immune-competent classification.
 */
export function normalizeClinicalFactMap(rawFacts: ClinicalFactMap): ClinicalFactMap {
  const facts: ClinicalFactMap = { ...rawFacts };
  const input = rawFacts as Partial<ClinicalInput>;

  assignIfAbsent(facts, "currentPathway", input.currentFigure);
  assignIfAbsent(facts, "ageYears", input.patientAge);
  const normalizedHpvResult = canonicalHpvResult(input.hpvResult);
  if (normalizedHpvResult !== undefined) facts.hpvResult = normalizedHpvResult;
  const normalizedCytologyResult = canonicalCytologyResult(input.cytologyResult);
  if (normalizedCytologyResult !== undefined) facts.cytologyResult = normalizedCytologyResult;
  assignIfAbsent(facts, "histologyResult", input.histologyResult);
  assignIfAbsent(facts, "biopsyResult", input.biopsyResult);
  assignIfAbsent(facts, "sampleType", input.sampleType);
  assignIfAbsent(facts, "eventStage", canonicalEventStage(input));
  assignIfAbsent(facts, "transformationZoneType", canonicalTzType(input.tzType ?? input.colposcopyTZType));
  assignIfAbsent(facts, "transformationZoneState", input.transformationZoneState);
  assignIfAbsent(facts, "visibleLesion", input.visibleLesion);
  assignIfAbsent(facts, "colposcopicImpression", input.colposcopicImpression);
  assignIfAbsent(facts, "mdmOutcome", input.mdmOutcome);
  assignIfAbsent(facts, "isPregnant", input.isPregnant);
  assignIfAbsent(facts, "hasAbnormalVaginalBleeding", input.hasAbnormalVaginalBleeding);
  assignIfAbsent(facts, "hasCervicalCancerSignsOrSymptoms", input.hasCancerSymptoms);
  assignIfAbsent(facts, "hasCancerConcern", input.hasCancerSymptoms ?? input.suspicionOfCancer);
  assignIfAbsent(facts, "abnormalCervix", input.abnormalCervix);
  assignIfAbsent(facts, "suspicionOfCancer", input.suspicionOfCancer);
  assignIfAbsent(facts, "hysterectomyType", input.hysterectomyType);
  assignIfAbsent(facts, "hysterectomyIndication", input.hysterectomyIndication === "HSIL_CIN23_OR_AIS" ? "HSIL_AIS_WITH_OR_WITHOUT_BENIGN_DISEASE" : input.hysterectomyIndication);
  assignIfAbsent(facts, "priorScreeningHistoryGroup", canonicalHistoryGroup(input.priorScreeningHistory));
  assignIfAbsent(facts, "specimenPathologyClass", canonicalPathology(input.hysterectomySpecimenPathology));
  assignIfAbsent(facts, "excisionCompleteness", input.excisionStatus);
  assignIfAbsent(facts, "tocStatus", input.testOfCureStatus);
  assignIfAbsent(facts, "isTestOfCureEvent", input.isTestOfCure);
  assignIfAbsent(facts, "isActiveHsilTestOfCure", input.isTestOfCure || ["REQUIRED", "INCOMPLETE"].includes(input.testOfCureStatus ?? ""));
  assignIfAbsent(facts, "treatmentDate", input.treatmentDate);
  assignIfAbsent(facts, "treatmentConfirmed", input.treatmentDate ? true : undefined);
  assignIfAbsent(facts, "consecutiveQualifyingNegativeCoTests", input.consecutiveNegativeCoTestCount);
  assignIfAbsent(facts, "consecutiveLowGradeCytologyResults", input.consecutiveLowGradeCount);
  assignIfAbsent(facts, "consecutiveUnsatisfactoryCount", input.unsatisfactoryCytologyCount);
  assignIfAbsent(facts, "hpvValidity", input.hpvResult === "INADEQUATE" ? "INVALID" : input.hpvResult ? "VALID" : undefined);
  assignIfAbsent(facts, "cytologyAdequacy", input.cytologyResult === "UNSATISFACTORY" ? "UNSATISFACTORY" : input.cytologyResult ? "SATISFACTORY" : undefined);
  assignIfAbsent(facts, "colposcopyResult", input.normalColposcopy === true ? "NORMAL" : undefined);

  if (input.currentFigure === "FIGURE_3" && input.patientAge !== undefined) {
    assignIfAbsent(facts, "isExitTest", input.patientAge >= 70 && input.patientAge <= 74);
  }
  if (input.normalColposcopy === true) {
    assignIfAbsent(
      facts,
      "postColposcopyContext",
      input.repeatContext === "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY"
        ? "NORMAL_AFTER_HIGH_GRADE"
        : input.repeatContext === "POST_NORMAL_COLPOSCOPY_LOW_GRADE_CYTOLOGY"
          ? "NORMAL_AFTER_LOW_GRADE"
          : undefined
    );
  }
  if (input.immunocompromised === true) {
    assignIfAbsent(facts, "immuneClassification", "IMMUNE_DEFICIENT");
  }
  if (input.previousAIS === true) assignIfAbsent(facts, "previousAis", true);
  if (input.previousAtypicalGlandularCells || input.cytologyResult?.match(/^(AG|AC)|AIS/)) {
    assignIfAbsent(facts, "hasCurrentGlandularAbnormality", true);
  }
  if (input.isPostHysterectomy === true) {
    assignIfAbsent(facts, "table1HistoryGroupKnown", Boolean(canonicalHistoryGroup(input.priorScreeningHistory)));
  }

  return facts;
}
