import type { ConditionExpression, RuleDefinition } from "./schema";

type Facts = Record<string, string | number | boolean | null>;

export type RuleBoundaryCase = {
  idSuffix: string;
  facts: Facts;
  expected: "TRUE" | "FALSE" | "UNKNOWN";
};

export type GovernedRuleCompilation = {
  conditionExpression: ConditionExpression;
  requiredFacts?: string[];
  boundaryCases?: RuleBoundaryCase[];
};

const fact = (
  name: string,
  operator: Extract<ConditionExpression, { type: "FACT" }> ["operator"],
  value?: string | number | boolean | null | Array<string | number | boolean | null>
): ConditionExpression => ({ type: "FACT", fact: name, operator, ...(value === undefined ? {} : { value }) });
const eq = (name: string, value: string | number | boolean | null) => fact(name, "EQ", value);
const neq = (name: string, value: string | number | boolean | null) => fact(name, "NEQ", value);
const oneOf = (name: string, values: Array<string | number | boolean | null>) => fact(name, "IN", values);
const exists = (name: string) => fact(name, "EXISTS");
const missing = (name: string) => fact(name, "MISSING");
const lt = (name: string, value: number) => fact(name, "LT", value);
const lte = (name: string, value: number) => fact(name, "LTE", value);
const gt = (name: string, value: number) => fact(name, "GT", value);
const gte = (name: string, value: number) => fact(name, "GTE", value);
const all = (...expressions: ConditionExpression[]): ConditionExpression => ({ type: "ALL", expressions });
const any = (...expressions: ConditionExpression[]): ConditionExpression => ({ type: "ANY", expressions });

const HIGH_GRADE_CYTOLOGY = ["ASC_H", "HSIL", "AG1", "AG3", "AG4", "AG5", "AIS", "AC1", "AC3", "AC4"];
const GLANDULAR_CYTOLOGY = ["AG1", "AG2", "AG3", "AG4", "AG5", "AIS", "AC1", "AC2", "AC3", "AC4"];
const LOW_GRADE_CYTOLOGY = ["NEGATIVE", "ASC_US", "LSIL"];
const INVASIVE_CERVICAL_CYTOLOGY = ["SCC", "SUSPICIOUS_INVASIVE_CANCER", "DEFINITE_INVASIVE_CANCER"];
const ENDOMETRIAL_CYTOLOGY = ["ATYPICAL_ENDOMETRIAL", "MALIGNANT_ENDOMETRIAL"];
const HPV_16_18 = ["HPV_16", "HPV_18", "HPV_16_18"];
const HPV_DETECTED = [...HPV_16_18, "HPV_OTHER"];

const C: Record<string, GovernedRuleCompilation> = {
  // Global router and software-safety invariants.
  "GR-01": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), any(eq("hasAbnormalVaginalBleeding", true), eq("hasCancerConcern", true))) },
  "GR-02": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), eq("isPregnant", true), any(oneOf("hpvResult", HPV_16_18), oneOf("cytologyResult", HIGH_GRADE_CYTOLOGY))) },
  "GR-03": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), eq("isPregnant", true), eq("hpvResult", "HPV_OTHER"), oneOf("cytologyResult", LOW_GRADE_CYTOLOGY)) },
  "GR-04": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), oneOf("hysterectomyType", ["TOTAL", "SUBTOTAL"])) },
  "GR-05": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), eq("hasPriorCervicalVaginalOrGynaecologicalCancer", true)) },
  "GR-06": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), eq("priorHighGradeOrGlandularHistoryStatus", "UNRESOLVED")) },
  "GR-07": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), eq("isActiveHsilTestOfCure", true)) },
  "GR-08": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), any(eq("hasCurrentGlandularAbnormality", true), oneOf("cytologyResult", GLANDULAR_CYTOLOGY), oneOf("biopsyResult", ["AIS", "ADENOCARCINOMA"]))) },
  "GR-09": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), eq("postColposcopyContext", "NORMAL_AFTER_LOW_GRADE")) },
  "GR-10": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), eq("postColposcopyContext", "NORMAL_AFTER_HIGH_GRADE")) },
  "GR-13": { conditionExpression: eq("routingStage", "BEFORE_PATHWAY_SELECTION") },
  "GR-14": { conditionExpression: all(eq("routingStage", "BEFORE_TERMINAL_RECOMMENDATION"), eq("selectedPathwayFactsComplete", false)) },
  "GS-01": { conditionExpression: eq("selectedRuleHasMissingOrUnknownFact", true) },
  "GS-02": { conditionExpression: eq("sameCanonicalInputAndRuleRelease", true) },
  "GS-03": { conditionExpression: all(eq("decisionConfirmed", true), eq("ruleReleaseChanged", true)) },
  "GS-04": { conditionExpression: eq("clinicianOnlyBoundaryReached", true) },
  "GS-05": { conditionExpression: all(eq("nationalClinicalRouteAvailable", true), eq("localBookingPriorityAvailable", true)) },
  "GS-06": { conditionExpression: all(eq("environment", "DEMO"), eq("exportRequested", true), eq("reviewerDecisionConfirmed", true)) },

  // Transition safety routes.
  "F2-01": { conditionExpression: all(eq("currentPathway", "FIGURE_2"), oneOf("previousCytologyClass", ["POSSIBLE_HSIL", "DEFINITE_HSIL", "ATYPICAL_GLANDULAR_NON_ENDOMETRIAL"])) },
  "F2-02": { conditionExpression: all(eq("currentPathway", "FIGURE_2"), eq("previousAis", true), neq("hysterectomyType", "TOTAL")) },

  // Figure 3 primary HPV screening and repeat-stage safety overlays.
  "F3-01": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("hpvResult", "NOT_DETECTED"), exists("sampleType"), eq("immuneClassification", "IMMUNE_COMPETENT"), eq("hasSymptoms", false)) },
  "F3-02": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("hpvResult", "NOT_DETECTED"), exists("sampleType"), eq("immuneClassification", "IMMUNE_DEFICIENT")) },
  "F3-03": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), oneOf("hpvResult", HPV_16_18), exists("sampleType"), gte("ageYears", 25), lte("ageYears", 74)), boundaryCases: [
    { idSuffix: "AGE-25-INCLUSIVE", facts: { currentPathway: "FIGURE_3", hpvResult: "HPV_16", sampleType: "LBC", ageYears: 25 }, expected: "TRUE" },
    { idSuffix: "AGE-74-INCLUSIVE", facts: { currentPathway: "FIGURE_3", hpvResult: "HPV_18", sampleType: "SWAB", ageYears: 74 }, expected: "TRUE" },
  ] },
  "F3-05": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("eventStage", "INITIAL"), eq("hpvResult", "HPV_OTHER"), oneOf("cytologyResult", HIGH_GRADE_CYTOLOGY.filter((value) => ![...INVASIVE_CERVICAL_CYTOLOGY, ...ENDOMETRIAL_CYTOLOGY].includes(value)))) },
  "F3-09": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("eventStage", "FIRST_REPEAT"), oneOf("hpvResult", HPV_16_18)) },
  "F3-10": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("eventStage", "FIRST_REPEAT"), eq("hpvResult", "HPV_OTHER"), oneOf("cytologyResult", HIGH_GRADE_CYTOLOGY)) },
  "F3-11": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("eventStage", "FIRST_REPEAT"), eq("hpvResult", "HPV_OTHER"), oneOf("cytologyResult", LOW_GRADE_CYTOLOGY), gte("ageYears", 50)), boundaryCases: [
    { idSuffix: "AGE-49-EXCLUDED", facts: { currentPathway: "FIGURE_3", eventStage: "FIRST_REPEAT", hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE", ageYears: 49 }, expected: "FALSE" },
    { idSuffix: "AGE-50-INCLUSIVE", facts: { currentPathway: "FIGURE_3", eventStage: "FIRST_REPEAT", hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE", ageYears: 50 }, expected: "TRUE" },
  ] },
  "F3-14": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("eventStage", "SECOND_REPEAT"), oneOf("hpvResult", HPV_DETECTED)) },
  "F3-15": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("isExitTest", true), gte("ageYears", 70), lte("ageYears", 74), eq("hpvResult", "NOT_DETECTED"), eq("subsequentAbnormalResult", false)), boundaryCases: [
    { idSuffix: "AGE-70-INCLUSIVE", facts: { currentPathway: "FIGURE_3", isExitTest: true, ageYears: 70, hpvResult: "NOT_DETECTED", subsequentAbnormalResult: false }, expected: "TRUE" },
    { idSuffix: "AGE-74-INCLUSIVE", facts: { currentPathway: "FIGURE_3", isExitTest: true, ageYears: 74, hpvResult: "NOT_DETECTED", subsequentAbnormalResult: false }, expected: "TRUE" },
    { idSuffix: "DETECTED-EXCLUDED", facts: { currentPathway: "FIGURE_3", isExitTest: true, ageYears: 72, hpvResult: "HPV_OTHER", subsequentAbnormalResult: false }, expected: "FALSE" },
  ] },
  "F3-16": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("isExitTest", true), gte("ageYears", 70), lte("ageYears", 74), oneOf("hpvResult", HPV_DETECTED)), boundaryCases: [
    { idSuffix: "AGE-69-EXCLUDED", facts: { currentPathway: "FIGURE_3", isExitTest: true, ageYears: 69, hpvResult: "HPV_OTHER" }, expected: "FALSE" },
    { idSuffix: "AGE-70-INCLUSIVE", facts: { currentPathway: "FIGURE_3", isExitTest: true, ageYears: 70, hpvResult: "HPV_16" }, expected: "TRUE" },
    { idSuffix: "AGE-74-INCLUSIVE", facts: { currentPathway: "FIGURE_3", isExitTest: true, ageYears: 74, hpvResult: "HPV_18" }, expected: "TRUE" },
    { idSuffix: "AGE-75-EXCLUDED", facts: { currentPathway: "FIGURE_3", isExitTest: true, ageYears: 75, hpvResult: "HPV_OTHER" }, expected: "FALSE" },
    { idSuffix: "HPV-NOT-DETECTED-EXCLUDED", facts: { currentPathway: "FIGURE_3", isExitTest: true, ageYears: 72, hpvResult: "NOT_DETECTED" }, expected: "FALSE" },
  ] },
  "F3-19": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("cytologyAdequacy", "UNSATISFACTORY"), exists("hpvResult"), exists("consecutiveUnsatisfactoryCount")) },
  "F3-20": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("hpvResult", "HPV_OTHER"), oneOf("cytologyResult", INVASIVE_CERVICAL_CYTOLOGY)) },
  "F3-21": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), oneOf("hpvResult", HPV_16_18), oneOf("cytologyResult", INVASIVE_CERVICAL_CYTOLOGY)) },
  "F3-22": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), oneOf("eventStage", ["INITIAL", "FIRST_REPEAT", "SECOND_REPEAT"]), any(oneOf("hpvValidity", ["INVALID", "UNSUITABLE"]), eq("cytologyAdequacy", "UNSATISFACTORY"), oneOf("cytologyResult", ENDOMETRIAL_CYTOLOGY))) },

  // Figure 10 symptom and malignant-disease routes.
  "F10-01": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("hasCervicalCancerSignsOrSymptoms", true), exists("ageYears")) },
  "F10-03": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("abnormalCervix", true), eq("suspicionOfCancer", true)) },
  "F10-10": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("bleedingType", "POSTCOITAL"), eq("bleedingEpisodeState", "SINGLE"), eq("menopausalStatus", "PREMENOPAUSAL"), eq("abnormalCervix", false), eq("hpvResult", "NOT_DETECTED"), eq("cytologyResult", "NEGATIVE")) },
  "F10-11": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("bleedingType", "POSTCOITAL"), oneOf("bleedingEpisodeState", ["RECURRENT", "PERSISTENT"]), eq("hpvResult", "NOT_DETECTED"), eq("cytologyResult", "NEGATIVE")) },
  "F10-12": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("bleedingType", "INTERMENSTRUAL"), eq("bleedingEpisodeState", "PERSISTENT_UNEXPLAINED")) },
  "F10-13": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("menopausalStatus", "POSTMENOPAUSAL"), eq("hasAbnormalVaginalBleeding", true)) },
  "F10-14": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("isPregnant", true), eq("hasAbnormalVaginalBleeding", true)) },
  "F10-15": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("hysterectomyType", "TOTAL"), eq("hasAbnormalVaginalBleeding", true)) },

  // Figure 4 surveillance after normal colposcopy and low-grade cytology.
  "F4-03": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("eventStage", "TWELVE_MONTH_REPEAT"), oneOf("hpvResult", HPV_16_18)) },
  "F4-04": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("eventStage", "TWELVE_MONTH_REPEAT"), eq("hpvResult", "HPV_OTHER"), oneOf("cytologyResult", HIGH_GRADE_CYTOLOGY)) },
  "F4-05": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("eventStage", "TWELVE_MONTH_REPEAT"), eq("hpvResult", "HPV_OTHER"), oneOf("cytologyResult", LOW_GRADE_CYTOLOGY), eq("immuneClassification", "IMMUNE_DEFICIENT")) },
  "F4-08": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("eventStage", "TWENTY_FOUR_MONTH_REPEAT"), oneOf("hpvResult", HPV_DETECTED)) },
  "F4-13": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("eventStage", "TWELVE_MONTH_REPEAT"), eq("hpvResult", "HPV_OTHER"), eq("sampleType", "SWAB")) },
  "F4-14": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("hpvResult", "HPV_OTHER"), eq("cytologyResult", "ATYPICAL_ENDOMETRIAL"), eq("hasOtherCervicalColposcopyIndication", false)) },
  "F4-15": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), oneOf("cytologyResult", INVASIVE_CERVICAL_CYTOLOGY)) },
  "F4-16": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), oneOf("eventStage", ["TWELVE_MONTH_REPEAT", "TWENTY_FOUR_MONTH_REPEAT"]), any(oneOf("hpvValidity", ["INVALID", "UNSUITABLE"]), eq("cytologyAdequacy", "UNSATISFACTORY"), oneOf("cytologyResult", ENDOMETRIAL_CYTOLOGY))) },

  // Figure 5 discordant high-grade cytology and clinician/MDM boundaries.
  "F5-01": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), oneOf("hpvResult", HPV_DETECTED), oneOf("cytologyResult", HIGH_GRADE_CYTOLOGY), eq("colposcopyResult", "NORMAL")) },
  "F5-03": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), oneOf("mdmOutcome", ["UPGRADED_HSIL", "CONFIRMED_HSIL"]), exists("transformationZoneType")) },
  "F5-05": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), eq("reviewedCytology", "CONFIRMED_ASC_H"), eq("treatmentDeferred", true), eq("informedDecisionDocumented", true)) },
  "F5-06": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), eq("observationStage", "SIX_MONTH"), any(eq("visibleLesion", true), oneOf("cytologyResult", ["ASC_US", "LSIL", ...HIGH_GRADE_CYTOLOGY])), any(eq("cytologyResult", "NEGATIVE"), eq("cytologyResult", "ASC_US"), eq("cytologyResult", "LSIL"), oneOf("cytologyResult", HIGH_GRADE_CYTOLOGY))) },
  "F5-07": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), eq("observationStage", "SIX_MONTH"), oneOf("hpvResult", HPV_DETECTED), eq("colposcopyResult", "NORMAL"), eq("cytologyResult", "NEGATIVE")) },
  "F5-09": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), eq("transformationZoneType", "TYPE_3"), oneOf("reviewedCytology", ["CONFIRMED_ASC_H", "CONFIRMED_HSIL"])) },
  "F5-10": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), eq("diagnosticExcisionConsidered", true), eq("priorHighGradeCytology", true), eq("colposcopyResult", "NORMAL"), eq("completeVaginalColposcopyPerformed", true), eq("vainExcluded", true)) },
  "F5-11": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), eq("reviewedCytology", "CONFIRMED_ASC_H"), oneOf("transformationZoneType", ["TYPE_1", "TYPE_2"]), eq("visibleLesion", false), eq("observationSelected", true), eq("informedTreatmentDeferralPlanDocumented", true)) },
  "F5-12": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), eq("diagnosticExcisionCompleted", true), exists("histologyResult"), exists("marginStatus"), exists("invasionStatus")) },

  // Figure 6 HSIL treatment and longitudinal Test of Cure.
  "F6-01": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("tocEligibilityConfirmed", true), eq("treatmentConfirmed", true), exists("treatmentDate"), oneOf("tocEligibilityBasis", ["TREATED_HSIL_CIN2_3", "GUIDELINE_HIGH_GRADE_SQUAMOUS_FOLLOW_UP"])) },
  "F6-03": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), gte("consecutiveQualifyingNegativeCoTests", 2), gte("monthsBetweenQualifyingCoTests", 12)), boundaryCases: [
    { idSuffix: "ONE-NEGATIVE-EXCLUDED", facts: { currentPathway: "FIGURE_6", consecutiveQualifyingNegativeCoTests: 1, monthsBetweenQualifyingCoTests: 12 }, expected: "FALSE" },
    { idSuffix: "TWO-NEGATIVES-INCLUSIVE", facts: { currentPathway: "FIGURE_6", consecutiveQualifyingNegativeCoTests: 2, monthsBetweenQualifyingCoTests: 12 }, expected: "TRUE" },
    { idSuffix: "EARLY-SEQUENCE-EXCLUDED", facts: { currentPathway: "FIGURE_6", consecutiveQualifyingNegativeCoTests: 2, monthsBetweenQualifyingCoTests: 11 }, expected: "FALSE" },
  ] },
  "F6-04": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("isTestOfCureEvent", true), oneOf("hpvResult", HPV_DETECTED)) },
  "F6-05": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("isTestOfCureEvent", true), oneOf("cytologyResult", ["ASC_H", "HSIL", ...GLANDULAR_CYTOLOGY])) },
  "F6-07": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("hpvResult", "NOT_DETECTED"), gte("consecutiveLowGradeCytologyResults", 2)), boundaryCases: [
    { idSuffix: "ONE-LOW-GRADE-EXCLUDED", facts: { currentPathway: "FIGURE_6", hpvResult: "NOT_DETECTED", consecutiveLowGradeCytologyResults: 1 }, expected: "FALSE" },
    { idSuffix: "TWO-LOW-GRADE-INCLUSIVE", facts: { currentPathway: "FIGURE_6", hpvResult: "NOT_DETECTED", consecutiveLowGradeCytologyResults: 2 }, expected: "TRUE" },
  ] },
  "F6-08": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("previousTocEventCytologyClass", "LOW_GRADE"), eq("hpvResult", "NOT_DETECTED"), eq("cytologyResult", "NEGATIVE"), lt("consecutiveQualifyingNegativeCoTests", 2)) },
  "F6-09": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("treatmentModality", "EXCISION"), eq("marginStatus", "CLEAR")) },
  "F6-10": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("treatmentModality", "EXCISION"), oneOf("marginStatus", ["POSITIVE", "INCOMPLETE"]), lt("ageYears", 50)), boundaryCases: [
    { idSuffix: "AGE-49-INCLUDED", facts: { currentPathway: "FIGURE_6", treatmentModality: "EXCISION", marginStatus: "POSITIVE", ageYears: 49 }, expected: "TRUE" },
    { idSuffix: "AGE-50-EXCLUDED", facts: { currentPathway: "FIGURE_6", treatmentModality: "EXCISION", marginStatus: "POSITIVE", ageYears: 50 }, expected: "FALSE" },
  ] },
  "F6-11": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("treatmentModality", "EXCISION"), oneOf("marginStatus", ["POSITIVE", "INCOMPLETE"]), gte("ageYears", 50)), boundaryCases: [
    { idSuffix: "AGE-49-EXCLUDED", facts: { currentPathway: "FIGURE_6", treatmentModality: "EXCISION", marginStatus: "INCOMPLETE", ageYears: 49 }, expected: "FALSE" },
    { idSuffix: "AGE-50-INCLUDED", facts: { currentPathway: "FIGURE_6", treatmentModality: "EXCISION", marginStatus: "INCOMPLETE", ageYears: 50 }, expected: "TRUE" },
  ] },
  "F6-12": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), any(missing("treatmentDate"), eq("treatmentConfirmed", false))) },
  "F6-13": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("isTestOfCureEvent", true), any(oneOf("hpvValidity", ["INVALID", "UNSUITABLE"]), eq("cytologyAdequacy", "UNSATISFACTORY"))) },
  "F6-14": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), oneOf("treatmentModality", ["EXCISION", "ABLATION", "HYSTERECTOMY", "NO_DOCUMENTED_TREATMENT", "HISTORICAL_HIGH_GRADE_FOLLOW_UP"]), oneOf("marginStatus", ["CLEAR", "POSITIVE", "UNASSESSABLE", "NOT_APPLICABLE"]), any(eq("treatmentModality", "EXCISION"), eq("marginStatus", "NOT_APPLICABLE"))) },
  "F6-15": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("historicalHighGradeSquamousAbnormality", true), eq("tocRequiredBySpecialistPlan", true), any(eq("treatmentDocumentationComplete", false), eq("histologyDocumentationComplete", false))) },
  "F6-16": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("isTestOfCureEvent", true), any(oneOf("hpvValidity", ["INVALID", "UNSUITABLE"]), eq("cytologyAdequacy", "UNSATISFACTORY"), oneOf("cytologyResult", ENDOMETRIAL_CYTOLOGY))) },

  // Figure 7 glandular abnormalities, AIS and oncology boundaries.
  "F7-01": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), oneOf("cytologyResult", ["AG2", "AC2"])) },
  "F7-02": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), oneOf("cytologyResult", ["AG1", "AG3", "AG4", "AG5", "AIS", "AC1", "AC3", "AC4"])) },
  "F7-03": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("visibleLesion", false), exists("transformationZoneType")) },
  "F7-04": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("visibleLesion", false), eq("mdmCytologyReviewOutcome", "CONFIRMED_NON_AG2")) },
  "F7-05": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("visibleLesion", false), eq("mdmCytologyReviewOutcome", "CONFIRMED_AG2")) },
  "F7-06": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("visibleLesion", false), eq("mdmCytologyReviewOutcome", "NOT_CONFIRMED")) },
  "F7-07": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("visibleLesion", true), eq("biopsyResult", "AIS")) },
  "F7-08": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("visibleLesion", true), oneOf("biopsyResult", ["SCC", "ADENOCARCINOMA", "INVASIVE_CANCER"])) },
  "F7-09": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("histologyResult", "AIS"), oneOf("preTreatmentHpvStatus", HPV_DETECTED), eq("marginStatus", "CLEAR"), exists("treatmentDate")) },
  "F7-10": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("histologyResult", "AIS"), oneOf("marginStatus", ["INCOMPLETE", "UNASSESSABLE"])) },
  "F7-11": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("histologyResult", "AIS"), oneOf("preTreatmentHpvStatus", ["NOT_DETECTED", "UNKNOWN"]), neq("hysterectomyType", "TOTAL")) },
  "F7-12": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("lowerGenitalTractAbnormalityDetected", false), exists("endometrialAssessmentStatus")) },
  "F7-13": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("histologyResult", "AIS"), eq("preTreatmentHpvStatus", "NOT_TESTED")) },
  "F7-14": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("type3ExcisionCompleted", true), exists("histologyResult"), exists("marginStatus"), exists("preTreatmentHpvStatus"), exists("invasionStatus")) },
  "F7-15": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("histologyResult", "AIS"), eq("marginStatus", "CLEAR"), oneOf("preTreatmentHpvStatus", HPV_DETECTED), any(oneOf("followUpHpvResult", HPV_DETECTED), neq("followUpCytologyResult", "NEGATIVE"))) },
  "F7-16": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("histologyResult", "AIS"), eq("marginStatus", "CLEAR"), oneOf("preTreatmentHpvStatus", HPV_DETECTED), eq("sixMonthHpvResult", "NOT_DETECTED"), eq("sixMonthCytologyResult", "NEGATIVE"), eq("eighteenMonthHpvResult", "NOT_DETECTED"), eq("eighteenMonthCytologyResult", "NEGATIVE"), eq("cervixPresent", true)) },
  "F7-17": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), oneOf("cytologyResult", ["INVASIVE_ADENOCARCINOMA", "SUSPICIOUS_INVASIVE_GLANDULAR_CANCER", "DEFINITE_INVASIVE_GLANDULAR_CANCER"])) },
  "F7-18": { conditionExpression: all(eq("currentPathway", "FIGURE_7"), eq("visibleLesion", false), exists("transformationZoneType"), exists("mdmCytologyReviewOutcome")) },

  // Table 1: exact 21-cell matrix entries with HIGH/CRITICAL safety priority.
  "T1-03": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "NEGATIVE_OR_RESOLVED_LOW_GRADE"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "COMPLETE")) },
  "T1-04": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "NEGATIVE_OR_RESOLVED_LOW_GRADE"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "INCOMPLETE")) },
  "T1-07": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "LOW_GRADE_NOT_RETURNED_TO_REGULAR"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "COMPLETE")) },
  "T1-08": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "LOW_GRADE_NOT_RETURNED_TO_REGULAR"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "INCOMPLETE")) },
  "T1-11": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "TREATED_HSIL_TOC_COMPLETE"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "COMPLETE")) },
  "T1-12": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "TREATED_HSIL_TOC_COMPLETE"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "INCOMPLETE")) },
  "T1-13": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "UNTREATED_OR_INCOMPLETELY_TREATED_HSIL_AIS"), eq("hysterectomyIndication", "HSIL_AIS_WITH_OR_WITHOUT_BENIGN_DISEASE"), eq("specimenPathologyClass", "NO_OR_LOW_GRADE")) },
  "T1-14": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "UNTREATED_OR_INCOMPLETELY_TREATED_HSIL_AIS"), eq("hysterectomyIndication", "HSIL_AIS_WITH_OR_WITHOUT_BENIGN_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "COMPLETE")) },
  "T1-15": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "UNTREATED_OR_INCOMPLETELY_TREATED_HSIL_AIS"), eq("hysterectomyIndication", "HSIL_AIS_WITH_OR_WITHOUT_BENIGN_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "INCOMPLETE")) },
  "T1-16": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "PREVIOUS_TREATMENT_INCOMPLETE_TOC"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "NO_OR_LOW_GRADE")) },
  "T1-17": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "PREVIOUS_TREATMENT_INCOMPLETE_TOC"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "COMPLETE")) },
  "T1-18": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "PREVIOUS_TREATMENT_INCOMPLETE_TOC"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "INCOMPLETE")) },
  "T1-20": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "NO_KNOWN_SCREENING_HISTORY"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "COMPLETE")) },
  "T1-21": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "NO_KNOWN_SCREENING_HISTORY"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "INCOMPLETE")) },

  // Figure 8 total hysterectomy and vault pathways.
  "F8-03": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("table1HistoryGroupKnown", true), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "COMPLETE")) },
  "F8-04": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("table1HistoryGroupKnown", true), eq("specimenPathologyClass", "HSIL_OR_AIS"), eq("excisionCompleteness", "INCOMPLETE")) },
  "F8-06": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("priorScreeningHistoryGroup", "UNTREATED_OR_INCOMPLETELY_TREATED_HSIL_AIS"), eq("specimenPathologyClass", "NO_OR_LOW_GRADE")) },
  "F8-07": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("priorScreeningHistoryGroup", "PREVIOUS_TREATMENT_INCOMPLETE_TOC"), eq("specimenPathologyClass", "NO_OR_LOW_GRADE")) },
  "F8-08": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("priorScreeningHistoryGroup", "NO_KNOWN_SCREENING_HISTORY"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "NO_OR_LOW_GRADE")) },
  "F8-10": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("hasPriorCervicalOrVaginalCancer", true), exists("cancerStage"), exists("cancerTreatment"), exists("hysterectomyType")) },
  "F8-11": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("hysterectomyType", "TOTAL"), eq("sampleSite", "VAGINAL_VAULT"), gte("consecutiveQualifyingNegativeVaultCoTests", 2), gte("monthsBetweenQualifyingVaultCoTests", 12)), boundaryCases: [
    { idSuffix: "ONE-VAULT-COTEST-EXCLUDED", facts: { currentPathway: "FIGURE_8", hysterectomyType: "TOTAL", sampleSite: "VAGINAL_VAULT", consecutiveQualifyingNegativeVaultCoTests: 1, monthsBetweenQualifyingVaultCoTests: 12 }, expected: "FALSE" },
    { idSuffix: "TWO-VAULT-COTESTS-INCLUSIVE", facts: { currentPathway: "FIGURE_8", hysterectomyType: "TOTAL", sampleSite: "VAGINAL_VAULT", consecutiveQualifyingNegativeVaultCoTests: 2, monthsBetweenQualifyingVaultCoTests: 12 }, expected: "TRUE" },
    { idSuffix: "EARLY-VAULT-COTESTS-EXCLUDED", facts: { currentPathway: "FIGURE_8", hysterectomyType: "TOTAL", sampleSite: "VAGINAL_VAULT", consecutiveQualifyingNegativeVaultCoTests: 2, monthsBetweenQualifyingVaultCoTests: 11 }, expected: "FALSE" },
  ] },
  "F8-12": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("sampleSite", "VAGINAL_VAULT"), any(oneOf("vaultHpvResult", HPV_DETECTED), neq("vaultCytologyResult", "NEGATIVE"))) },
  "F8-13": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), any(missing("hysterectomyType"), all(eq("hysterectomyType", "TOTAL"), any(missing("operativeReportStatus"), missing("priorScreeningHistoryGroup"), missing("specimenPathologyClass"), missing("excisionCompleteness"))))) },
  "F8-14": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("hysterectomyType", "TOTAL"), eq("hasAbnormalVaginalBleeding", true)) },

  // Figure 9 pregnancy-specific pathway and timing gates.
  "F9-01": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("isPregnant", true), oneOf("cytologyResult", ["ASC_H", "HSIL", ...GLANDULAR_CYTOLOGY])) },
  "F9-02": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("isPregnant", true), oneOf("transformationZoneState", ["NORMAL", "TYPE_1", "TYPE_2", "TYPE_3"]), eq("visibleLesion", false)) },
  "F9-05": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("isPregnant", true), oneOf("mdmOutcome", ["CONFIRMED_POSSIBLE_HIGH_GRADE", "CONFIRMED_DEFINITE_HIGH_GRADE"]), eq("invasionExcluded", true)) },
  "F9-06": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("isPregnant", true), any(eq("transformationZoneState", "ABNORMAL"), eq("visibleLesion", true)), oneOf("colposcopicImpression", ["LSIL", "HSIL_CIN2_3", "AIS"]), eq("invasionExcluded", true)) },
  "F9-07": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("isPregnant", true), any(eq("cytologyInvasionSuspected", true), eq("colposcopyInvasionSuspected", true))) },
  "F9-08": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("isPregnant", true), oneOf("hpvResult", HPV_16_18)) },
  "F9-10": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("isPregnant", true), eq("highGradeLesionConfirmed", true), eq("invasionExcluded", true)) },
  "F9-11": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("pregnancyState", "POSTPARTUM"), exists("deliveryDate"), gte("weeksSinceDelivery", 6)), boundaryCases: [
    { idSuffix: "FIVE-WEEKS-EXCLUDED", facts: { currentPathway: "FIGURE_9", pregnancyState: "POSTPARTUM", deliveryDate: "2026-01-01", weeksSinceDelivery: 5 }, expected: "FALSE" },
    { idSuffix: "SIX-WEEKS-INCLUSIVE", facts: { currentPathway: "FIGURE_9", pregnancyState: "POSTPARTUM", deliveryDate: "2026-01-01", weeksSinceDelivery: 6 }, expected: "TRUE" },
    { idSuffix: "TWELVE-WEEKS-INCLUDED", facts: { currentPathway: "FIGURE_9", pregnancyState: "POSTPARTUM", deliveryDate: "2026-01-01", weeksSinceDelivery: 12 }, expected: "TRUE" },
  ] },
  "F9-12": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), any(missing("isPregnant"), missing("cytologyResult"), missing("transformationZoneState"), missing("visibleLesion"), missing("invasionStatus"), missing("biopsyStatus"), missing("mdmOutcome"))) },
  "F9-13": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("pregnancyTimingRecommendationRequested", true), any(missing("pregnancyState"), missing("gestationalAgeWeeks"), missing("estimatedDeliveryDate"), all(eq("pregnancyState", "POSTPARTUM"), missing("deliveryDate")))) },
  "F9-14": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("isPregnant", true), oneOf("cytologyResult", INVASIVE_CERVICAL_CYTOLOGY)) },

  // Under-25, DES, 2026 overlays and current immune-classifier provenance.
  "DES-01": { conditionExpression: eq("desExposureStatus", "KNOWN_EXPOSED") },
  "DES-02": { conditionExpression: all(eq("desExposureStatus", "KNOWN_EXPOSED"), eq("vaginalAdenosisPresent", true)) },
  "DES-04": { conditionExpression: all(eq("desExposureStatus", "KNOWN_EXPOSED"), eq("screenDetectedAbnormality", true)) },
  "U25-01": { conditionExpression: all(lt("ageYears", 25), eq("hasSymptoms", false), eq("alreadyInIndicatedFollowUp", false)), boundaryCases: [
    { idSuffix: "AGE-24-INCLUDED", facts: { ageYears: 24, hasSymptoms: false, alreadyInIndicatedFollowUp: false }, expected: "TRUE" },
    { idSuffix: "AGE-25-EXCLUDED", facts: { ageYears: 25, hasSymptoms: false, alreadyInIndicatedFollowUp: false }, expected: "FALSE" },
  ] },
  "U25-02": { conditionExpression: all(lt("ageYears", 25), eq("alreadyInScreeningOrFollowUp", true), exists("nextClinicallyIndicatedAppointment")) },
  "U25-03": { conditionExpression: all(lt("ageYears", 25), any(eq("earlySexualActivity", true), eq("sexualAbuseHistory", true), eq("hasSymptoms", true), eq("otherClinicalConcern", true))) },
  "A26-02": { conditionExpression: all(eq("biopsyResult", "CIN2"), lt("ageYears", 30), oneOf("transformationZoneType", ["TYPE_1", "TYPE_2"]), eq("cin3Excluded", true), eq("invasionExcluded", true), exists("participantTreatmentPreference")), boundaryCases: [
    { idSuffix: "AGE-29-INCLUDED", facts: { biopsyResult: "CIN2", ageYears: 29, transformationZoneType: "TYPE_1", cin3Excluded: true, invasionExcluded: true, participantTreatmentPreference: "SURVEILLANCE" }, expected: "TRUE" },
    { idSuffix: "AGE-30-EXCLUDED", facts: { biopsyResult: "CIN2", ageYears: 30, transformationZoneType: "TYPE_2", cin3Excluded: true, invasionExcluded: true, participantTreatmentPreference: "SURVEILLANCE" }, expected: "FALSE" },
  ] },
  "A26-03": { conditionExpression: all(eq("cin2ActiveSurveillance", true), eq("mdmBiopsyReviewOutcome", "DOWNGRADED_TO_LSIL")) },
  "A26-04": { conditionExpression: all(eq("cin2ActiveSurveillance", true), eq("cin2RegressionConfirmed", true)) },
  "A26-05": { conditionExpression: all(eq("cin2ActiveSurveillance", true), any(eq("followUpBiopsyResult", "CIN3"), all(eq("followUpBiopsyResult", "CIN2"), gte("surveillanceDurationMonths", 24)))), boundaryCases: [
    { idSuffix: "CIN2-AT-23-MONTHS-EXCLUDED", facts: { cin2ActiveSurveillance: true, followUpBiopsyResult: "CIN2", surveillanceDurationMonths: 23 }, expected: "FALSE" },
    { idSuffix: "CIN2-AT-24-MONTHS-INCLUDED", facts: { cin2ActiveSurveillance: true, followUpBiopsyResult: "CIN2", surveillanceDurationMonths: 24 }, expected: "TRUE" },
    { idSuffix: "CIN3-IMMEDIATE", facts: { cin2ActiveSurveillance: true, followUpBiopsyResult: "CIN3", surveillanceDurationMonths: 1 }, expected: "TRUE" },
  ] },
  "A26-06": { conditionExpression: all(oneOf("marginStatus", ["POSITIVE", "INCOMPLETE"]), eq("treatedHistology", "HSIL"), lt("ageYears", 50)), boundaryCases: [
    { idSuffix: "AGE-49-INCLUDED", facts: { marginStatus: "POSITIVE", treatedHistology: "HSIL", ageYears: 49 }, expected: "TRUE" },
    { idSuffix: "AGE-50-EXCLUDED", facts: { marginStatus: "POSITIVE", treatedHistology: "HSIL", ageYears: 50 }, expected: "FALSE" },
  ] },
  "A26-08": { conditionExpression: all(eq("cancerType", "CERVICAL"), eq("cancerStage", "STAGE_1A1"), eq("cancerTreatment", "LOCAL_EXCISION"), exists("tocStatus")) },
  "A26-09": { conditionExpression: all(eq("cancerType", "CERVICAL"), eq("cancerStage", "STAGE_1A1"), eq("cancerTreatment", "TOTAL_HYSTERECTOMY"), eq("tocStatus", "COMPLETE")) },
  "A26-13": { conditionExpression: all(eq("cin2ActiveSurveillance", true), eq("currentHistology", "CIN2"), lt("surveillanceDurationMonths", 24), eq("followUpMdmReviewDue", true)) },
  "A26-14": { conditionExpression: all(eq("cin2ActiveSurveillance", true), eq("currentHistology", "CIN2"), eq("participantTreatmentPreference", "TREATMENT")) },
  "IMM-01": { conditionExpression: all(eq("immuneClassificationChangedOrAssigned", true), exists("immuneClassifierVersion"), exists("immuneClassificationDate"), exists("immuneSourceConditionOrMedication"), exists("immuneClassificationRationale"), exists("immuneStatusSentOnLaboratoryRequest")) },

  // Remaining MEDIUM/LOW rules, classified and compiled for full-rulebook coverage.
  "GR-11": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), eq("isFirstCytologyToHpvTransition", true)) },
  "GR-12": { conditionExpression: all(eq("routingStage", "BEFORE_PATHWAY_SELECTION"), eq("hasSymptoms", false), eq("cervixPresent", true), gte("ageYears", 25), lte("ageYears", 74), exists("hpvResult"), exists("sampleType")) },

  "F1-01": { conditionExpression: all(eq("currentPathway", "FIGURE_1"), eq("screeningStatus", "NEVER_SCREENED")) },
  "F1-02": { conditionExpression: all(eq("currentPathway", "FIGURE_1"), eq("screeningStatus", "UNDER_SCREENED")) },
  "F1-03": { conditionExpression: all(eq("currentPathway", "FIGURE_1"), eq("screeningStatus", "OVERDUE")) },
  "F1-04": { conditionExpression: all(eq("currentPathway", "FIGURE_1"), eq("screeningStatus", "REGULAR_SCREENING"), eq("priorScreeningHistoryGroup", "NEGATIVE_OR_RESOLVED_LOW_GRADE"), eq("priorLowGradeResolved", false)) },
  "F1-05": { conditionExpression: all(eq("currentPathway", "FIGURE_1"), eq("priorScreeningHistoryGroup", "NEGATIVE_OR_RESOLVED_LOW_GRADE"), eq("priorLowGradeResolved", true)) },
  "F1-06": { conditionExpression: all(eq("currentPathway", "FIGURE_1"), eq("priorHighGradeHistory", true), eq("tocStatus", "COMPLETE")) },
  "F1-X": { conditionExpression: all(eq("currentPathway", "FIGURE_1"), eq("priorHighGradeOrGlandularHistoryStatus", "UNRESOLVED")) },

  "F2-03": { conditionExpression: all(eq("currentPathway", "FIGURE_2"), eq("previousAtypicalEndometrialCells", true), gt("monthsSinceAtypicalEndometrialReport", 36)), boundaryCases: [
    { idSuffix: "MONTH-36-EXCLUDED", facts: { currentPathway: "FIGURE_2", previousAtypicalEndometrialCells: true, monthsSinceAtypicalEndometrialReport: 36 }, expected: "FALSE" },
    { idSuffix: "MONTH-37-INCLUDED", facts: { currentPathway: "FIGURE_2", previousAtypicalEndometrialCells: true, monthsSinceAtypicalEndometrialReport: 37 }, expected: "TRUE" },
  ] },
  "F2-04": { conditionExpression: all(eq("currentPathway", "FIGURE_2"), eq("previousAtypicalEndometrialCells", true), eq("specialistAssessmentCompleted", true), eq("specialistDischargedToPrimaryCare", true)) },
  "F2-05": { conditionExpression: all(eq("currentPathway", "FIGURE_2"), eq("previousAtypicalEndometrialCells", true), lte("monthsSinceAtypicalEndometrialReport", 36), eq("specialistDischargedToPrimaryCare", false)) },
  "F2-X": { conditionExpression: all(eq("currentPathway", "FIGURE_2"), eq("priorHighGradeHistory", true), eq("tocStatus", "COMPLETE")) },

  "F3-04": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("hpvResult", "HPV_OTHER"), eq("sampleType", "SWAB")) },
  "F3-06": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("hpvResult", "HPV_OTHER"), eq("cytologyResult", "ATYPICAL_ENDOMETRIAL"), eq("hasOtherCervicalColposcopyIndication", false)) },
  "F3-07": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("eventStage", "INITIAL"), eq("hpvResult", "HPV_OTHER"), oneOf("cytologyResult", LOW_GRADE_CYTOLOGY), eq("sampleType", "LBC")) },
  "F3-08": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("eventStage", "FIRST_REPEAT"), eq("hpvResult", "NOT_DETECTED"), exists("immuneClassification")) },
  "F3-12": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("eventStage", "FIRST_REPEAT"), eq("hpvResult", "HPV_OTHER"), oneOf("cytologyResult", LOW_GRADE_CYTOLOGY), lt("ageYears", 50)), boundaryCases: [
    { idSuffix: "AGE-49-INCLUDED", facts: { currentPathway: "FIGURE_3", eventStage: "FIRST_REPEAT", hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE", ageYears: 49 }, expected: "TRUE" },
    { idSuffix: "AGE-50-EXCLUDED", facts: { currentPathway: "FIGURE_3", eventStage: "FIRST_REPEAT", hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE", ageYears: 50 }, expected: "FALSE" },
  ] },
  "F3-13": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), eq("eventStage", "SECOND_REPEAT"), eq("hpvResult", "NOT_DETECTED"), exists("immuneClassification")) },
  "F3-17": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), gte("ageYears", 75), eq("hasSymptoms", false)), boundaryCases: [
    { idSuffix: "AGE-74-EXCLUDED", facts: { currentPathway: "FIGURE_3", ageYears: 74, hasSymptoms: false }, expected: "FALSE" },
    { idSuffix: "AGE-75-INCLUDED", facts: { currentPathway: "FIGURE_3", ageYears: 75, hasSymptoms: false }, expected: "TRUE" },
  ] },
  "F3-18": { conditionExpression: all(eq("currentPathway", "FIGURE_3"), oneOf("hpvValidity", ["INVALID", "UNSUITABLE"]), eq("technicalIssueAssessmentComplete", true), eq("cytologyAvailabilityKnown", true)) },

  "F4-01": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("eventStage", "INITIAL"), oneOf("hpvResult", HPV_DETECTED), oneOf("cytologyResult", LOW_GRADE_CYTOLOGY), eq("colposcopyResult", "NORMAL")) },
  "F4-02": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("eventStage", "TWELVE_MONTH_REPEAT"), eq("hpvResult", "NOT_DETECTED"), exists("immuneClassification")) },
  "F4-06": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("eventStage", "TWELVE_MONTH_REPEAT"), eq("hpvResult", "HPV_OTHER"), oneOf("cytologyResult", LOW_GRADE_CYTOLOGY), eq("immuneClassification", "IMMUNE_COMPETENT")) },
  "F4-07": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("eventStage", "TWENTY_FOUR_MONTH_REPEAT"), eq("hpvResult", "NOT_DETECTED"), exists("immuneClassification")) },
  "F4-09": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("transformationZoneType", "TYPE_3"), oneOf("hpvResult", HPV_DETECTED), oneOf("cytologyResult", LOW_GRADE_CYTOLOGY), eq("colposcopyResult", "NORMAL")) },
  "F4-10": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("transformationZoneType", "TYPE_3"), eq("cytologicalHighGradeEvidence", false), eq("colposcopicHighGradeEvidence", false), eq("histologicalHighGradeEvidence", false)) },
  "F4-11": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("transformationZoneType", "TYPE_3"), any(eq("completedChildBearing", true), eq("clinicallySignificantAnxiety", true), gt("ageYears", 50), eq("attendanceUncertain", true)), eq("sharedDecisionRequired", true)), boundaryCases: [
    { idSuffix: "AGE-50-ALONE-EXCLUDED", facts: { currentPathway: "FIGURE_4", transformationZoneType: "TYPE_3", completedChildBearing: false, clinicallySignificantAnxiety: false, ageYears: 50, attendanceUncertain: false, sharedDecisionRequired: true }, expected: "FALSE" },
    { idSuffix: "AGE-51-INCLUDED", facts: { currentPathway: "FIGURE_4", transformationZoneType: "TYPE_3", completedChildBearing: false, clinicallySignificantAnxiety: false, ageYears: 51, attendanceUncertain: false, sharedDecisionRequired: true }, expected: "TRUE" },
  ] },
  "F4-12": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("persistentLowGradeCytology", true), eq("transformationZoneType", "TYPE_3")) },

  "F5-02": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), oneOf("mdmOutcome", ["DOWNGRADED_NEGATIVE", "DOWNGRADED_LSIL", "DOWNGRADED_ASC_US_LSIL"])) },
  "F5-04": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), eq("reviewedCytology", "CONFIRMED_ASC_H"), oneOf("transformationZoneType", ["TYPE_1", "TYPE_2"]), eq("visibleLesion", false)) },
  "F5-08": { conditionExpression: all(eq("currentPathway", "FIGURE_5"), eq("observationStage", "SIX_MONTH"), eq("hpvResult", "NOT_DETECTED"), eq("cytologyResult", "NEGATIVE"), eq("visibleLesion", false), eq("colposcopicImpressionUnchanged", true)) },

  "F6-02": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("isTestOfCureEvent", true), eq("tocEventTiming", "SIX_MONTH_POST_TREATMENT"), eq("hpvResult", "NOT_DETECTED"), eq("cytologyResult", "NEGATIVE")) },
  "F6-06": { conditionExpression: all(eq("currentPathway", "FIGURE_6"), eq("isTestOfCureEvent", true), eq("tocEventOrdinal", 1), eq("hpvResult", "NOT_DETECTED"), oneOf("cytologyResult", ["ASC_US", "LSIL"])) },

  "T1-01": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "NEGATIVE_OR_RESOLVED_LOW_GRADE"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyDetail", "NO_CERVICAL_PATHOLOGY")) },
  "T1-02": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "NEGATIVE_OR_RESOLVED_LOW_GRADE"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyDetail", "LSIL_CIN1")) },
  "T1-05": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "LOW_GRADE_NOT_RETURNED_TO_REGULAR"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyDetail", "NO_CERVICAL_PATHOLOGY")) },
  "T1-06": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "LOW_GRADE_NOT_RETURNED_TO_REGULAR"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyDetail", "LSIL_CIN1")) },
  "T1-09": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "TREATED_HSIL_TOC_COMPLETE"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyDetail", "NO_CERVICAL_PATHOLOGY")) },
  "T1-10": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "TREATED_HSIL_TOC_COMPLETE"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyDetail", "LSIL_CIN1")) },
  "T1-19": { conditionExpression: all(eq("currentPathway", "TABLE_1"), eq("priorScreeningHistoryGroup", "NO_KNOWN_SCREENING_HISTORY"), eq("hysterectomyIndication", "BENIGN_GYNAECOLOGICAL_DISEASE"), eq("specimenPathologyClass", "NO_OR_LOW_GRADE")) },

  "F8-01": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("hysterectomyType", "TOTAL"), oneOf("priorScreeningHistoryGroup", ["NEGATIVE_OR_RESOLVED_LOW_GRADE", "TREATED_HSIL_TOC_COMPLETE"]), eq("specimenPathologyDetail", "NO_CERVICAL_PATHOLOGY")) },
  "F8-02": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("hysterectomyType", "TOTAL"), oneOf("priorScreeningHistoryGroup", ["NEGATIVE_OR_RESOLVED_LOW_GRADE", "TREATED_HSIL_TOC_COMPLETE"]), eq("specimenPathologyDetail", "LSIL_CIN1")) },
  "F8-05": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("hysterectomyType", "TOTAL"), eq("priorScreeningHistoryGroup", "LOW_GRADE_NOT_RETURNED_TO_REGULAR"), eq("specimenPathologyClass", "NO_OR_LOW_GRADE")) },
  "F8-09": { conditionExpression: all(eq("currentPathway", "FIGURE_8"), eq("hysterectomyType", "SUBTOTAL")) },

  "F9-03": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("isPregnant", true), eq("mdmOutcome", "DOWNGRADED_NEGATIVE")) },
  "F9-04": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("isPregnant", true), oneOf("mdmOutcome", ["DOWNGRADED_LSIL", "DOWNGRADED_ASC_US_LSIL"])) },
  "F9-09": { conditionExpression: all(eq("currentPathway", "FIGURE_9"), eq("isPregnant", true), eq("hpvResult", "HPV_OTHER"), oneOf("cytologyResult", LOW_GRADE_CYTOLOGY)) },

  "F10-02": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("hasAbnormalVaginalBleeding", true), eq("bleedingAssessmentComplete", false)) },
  "F10-04": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("abnormalCervix", true), eq("suspicionOfCancer", false)) },
  "F10-05": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("abnormalCervix", false), eq("suspectOralContraceptiveProblem", true)) },
  "F10-06": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("bleedingReviewStage", "SIX_TO_EIGHT_WEEK_REVIEW"), eq("bleedingResolved", true)) },
  "F10-07": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("bleedingReviewStage", "SIX_TO_EIGHT_WEEK_REVIEW"), eq("bleedingResolved", false)) },
  "F10-08": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("abnormalCervix", false), eq("suspectOralContraceptiveProblem", false), eq("stiIdentified", true)) },
  "F10-09": { conditionExpression: all(eq("currentPathway", "FIGURE_10"), eq("abnormalCervix", false), eq("suspectOralContraceptiveProblem", false), eq("stiAssessmentComplete", true), eq("stiIdentified", false)) },

  "DES-03": { conditionExpression: all(eq("desExposureStatus", "KNOWN_EXPOSED"), eq("specialistAssessmentCompleted", true), eq("vaginalAdenosisPresent", false)) },
  "A26-01": { conditionExpression: all(eq("currentPathway", "FIGURE_4"), eq("transformationZoneType", "TYPE_3"), oneOf("hpvResult", HPV_DETECTED), oneOf("cytologyResult", LOW_GRADE_CYTOLOGY), eq("colposcopyResult", "NORMAL")) },
  "A26-07": { conditionExpression: all(oneOf("hpvResult", HPV_DETECTED), eq("treatedHistology", "AIS"), eq("marginStatus", "CLEAR")) },
  "A26-10": { conditionExpression: eq("hasOtherPriorCervicalOrVaginalCancer", true) },
  "A26-11": { conditionExpression: all(eq("priorHsil", true), eq("tocStatusBeforeHysterectomy", "INCOMPLETE"), eq("gynaecologicalCancerType", "NON_CERVICAL"), eq("hysterectomyType", "TOTAL")) },
  "A26-12": { conditionExpression: all(eq("hasGynaecologicalCancer", true), eq("hysterectomyType", "SUBTOTAL")) },
};

export type RemainingRuleClassification =
  | "EXECUTABLE_ROUTING"
  | "EXECUTABLE_VALIDATION"
  | "CLINICIAN_ONLY_INFORMATION"
  | "DISPLAY_ONLY"
  | "SOURCE_PROVENANCE_ONLY"
  | "SUPERSEDED";

const CLINICIAN_ONLY_INFORMATION = new Set([
  "F4-10", "F4-11", "F4-12", "F5-04", "F10-02", "F10-04",
  "F10-05", "F10-08", "F10-09", "DES-03", "A26-10",
]);

export const REMAINING_RULE_CLASSIFICATION: Record<string, RemainingRuleClassification> =
  Object.fromEntries(
    [
      "GR-11", "GR-12", "F1-01", "F1-02", "F1-03", "F1-04", "F1-05", "F1-06", "F1-X",
      "F2-03", "F2-04", "F2-05", "F2-X", "F3-04", "F3-06", "F3-07", "F3-08", "F3-12",
      "F3-13", "F3-17", "F3-18", "F4-01", "F4-02", "F4-06", "F4-07", "F4-09", "F4-10",
      "F4-11", "F4-12", "F5-02", "F5-04", "F5-08", "F6-02", "F6-06", "T1-01", "T1-02",
      "T1-05", "T1-06", "T1-09", "T1-10", "T1-19", "F8-01", "F8-02", "F8-05", "F8-09",
      "F9-03", "F9-04", "F9-09", "F10-02", "F10-04", "F10-05", "F10-06", "F10-07", "F10-08",
      "F10-09", "DES-03", "A26-01", "A26-07", "A26-10", "A26-11", "A26-12",
    ].map((ruleId) => [
      ruleId,
      ruleId === "A26-01"
        ? "EXECUTABLE_VALIDATION"
        : CLINICIAN_ONLY_INFORMATION.has(ruleId)
          ? "CLINICIAN_ONLY_INFORMATION"
          : "EXECUTABLE_ROUTING",
    ])
  ) as Record<string, RemainingRuleClassification>;

function expressionFactNames(expression: ConditionExpression): string[] {
  switch (expression.type) {
    case "FACT":
      return [expression.fact];
    case "ALL":
    case "ANY":
      return [...new Set(expression.expressions.flatMap(expressionFactNames))];
    case "NOT":
      return expressionFactNames(expression.expression);
    default:
      return [];
  }
}

function alternateValue(value: string | number | boolean | null | undefined) {
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return value + 1;
  if (value === null) return "KNOWN";
  return `NOT_${value ?? "VALUE"}`;
}

function mergeFacts(...parts: Facts[]): Facts {
  return Object.assign({}, ...parts);
}

export function factsForExpressionTruth(
  expression: ConditionExpression,
  expected: "TRUE" | "FALSE"
): Facts {
  switch (expression.type) {
    case "SOURCE_TEXT":
      return {};
    case "ALWAYS":
      return {};
    case "NOT":
      return factsForExpressionTruth(
        expression.expression,
        expected === "TRUE" ? "FALSE" : "TRUE"
      );
    case "ALL": {
      if (expected === "TRUE") {
        return mergeFacts(
          ...expression.expressions.map((child) => factsForExpressionTruth(child, "TRUE"))
        );
      }
      const [first, ...remaining] = expression.expressions;
      return mergeFacts(
        ...(first ? [factsForExpressionTruth(first, "FALSE")] : []),
        ...remaining.map((child) => factsForExpressionTruth(child, "TRUE"))
      );
    }
    case "ANY": {
      if (expected === "TRUE") {
        const first = expression.expressions[0];
        return first ? factsForExpressionTruth(first, "TRUE") : {};
      }
      return mergeFacts(
        ...expression.expressions.map((child) => factsForExpressionTruth(child, "FALSE"))
      );
    }
    case "FACT": {
      const values = Array.isArray(expression.value)
        ? expression.value
        : [expression.value as string | number | boolean | null | undefined];
      const first = values[0];
      switch (expression.operator) {
        case "EQ":
          return { [expression.fact]: expected === "TRUE" ? first ?? null : alternateValue(first) };
        case "NEQ":
          return { [expression.fact]: expected === "TRUE" ? alternateValue(first) : first ?? null };
        case "IN":
          return { [expression.fact]: expected === "TRUE" ? first ?? null : alternateValue(first) };
        case "NOT_IN":
          return { [expression.fact]: expected === "TRUE" ? alternateValue(first) : first ?? null };
        case "EXISTS":
          return expected === "TRUE" ? { [expression.fact]: "PRESENT" } : {};
        case "MISSING":
          return expected === "TRUE" ? {} : { [expression.fact]: "PRESENT" };
        case "GT": {
          const threshold = Number(first);
          return { [expression.fact]: expected === "TRUE" ? threshold + 1 : threshold };
        }
        case "GTE": {
          const threshold = Number(first);
          return { [expression.fact]: expected === "TRUE" ? threshold : threshold - 1 };
        }
        case "LT": {
          const threshold = Number(first);
          return { [expression.fact]: expected === "TRUE" ? threshold - 1 : threshold };
        }
        case "LTE": {
          const threshold = Number(first);
          return { [expression.fact]: expected === "TRUE" ? threshold : threshold + 1 };
        }
        case "CONTAINS":
          return {
            [expression.fact]:
              expected === "TRUE" ? String(first ?? "VALUE") : "NO_MATCHING_VALUE",
          };
      }
    }
  }
}

export function missingFactCaseForExpression(expression: ConditionExpression): {
  facts: Facts;
  missingFact: string;
} {
  const positive = factsForExpressionTruth(expression, "TRUE");
  const factNames = expressionFactNames(expression);
  const missingFact = factNames.find((name) => Object.hasOwn(positive, name)) ?? factNames[0];
  if (!missingFact) {
    throw new Error("A governed rule expression must reference at least one explicit fact.");
  }
  const facts = { ...positive };
  delete facts[missingFact];
  return { facts, missingFact };
}

export function conformanceTestIdsForRule(ruleId: string): string[] {
  const compilation = C[ruleId];
  if (!compilation) return [];
  return [
    `CG-V21-${ruleId}-POSITIVE`,
    `CG-V21-${ruleId}-NEGATIVE`,
    `CG-V21-${ruleId}-MISSING`,
    ...(compilation.boundaryCases ?? []).map(
      (boundaryCase) => `CG-V21-${ruleId}-${boundaryCase.idSuffix}`
    ),
  ];
}

export const EXECUTABLE_CONFORMANCE_TEST_IDS = new Set(
  Object.keys(C).flatMap(conformanceTestIdsForRule)
);

export function governedCompilationForRule(ruleId: string) {
  return C[ruleId];
}

export function compileGovernedHighRiskRule(rule: RuleDefinition): RuleDefinition {
  const compilation = C[rule.stableRuleId];
  if (!compilation) {
    if (!["HIGH", "CRITICAL"].includes(rule.safetyPriority)) return rule;
    throw new Error(
      `No governed typed compilation exists for ${rule.stableRuleId} (${rule.safetyPriority}).`
    );
  }
  return {
    ...rule,
    conditionExpression: structuredClone(compilation.conditionExpression),
    requiredFacts:
      compilation.requiredFacts ?? expressionFactNames(compilation.conditionExpression),
    executableTestIds: conformanceTestIdsForRule(rule.stableRuleId),
    governedClassification: REMAINING_RULE_CLASSIFICATION[rule.stableRuleId],
  };
}

export function compiledRuleIds() {
  return Object.keys(C);
}

/** @deprecated Use compiledRuleIds; retained for compatibility with revision-3 callers. */
export const compiledHighRiskRuleIds = compiledRuleIds;

const EXPLICIT_PRECEDENCE: Record<string, number> = {
  // Missing-data and clinician-only stops outrank every terminal route.
  "GS-01": 1200,
  "GR-14": 1200,
  "F6-12": 1200,
  "F8-13": 1200,
  "F9-12": 1200,
  "F9-13": 1200,
  "GS-04": 1150,
  // Specific malignant-disease routes outrank generic pathway routers.
  "F3-20": 1300,
  "F3-21": 1300,
  "F4-15": 1300,
  "F7-08": 1300,
  "F7-17": 1300,
  "F9-14": 1300,
  "F10-01": 1300,
  "F10-03": 1300,
  // Specific symptom/cancer overlays outrank ordinary pathway branches.
  "GR-01": 1050,
  "GR-05": 1050,
  "F8-10": 1050,
  "F8-14": 1050,
  "F10-14": 1050,
  "F10-15": 1050,
  "F3-15": 900,
  "F3-16": 900,
  "F3-17": 900,
  "F3-18": 1250,
  "F3-08": 500,
  "F3-13": 500,
  "F8-09": 1250,
  "A26-10": 1100,
  "F10-04": 500,
  "F10-05": 500,
  "F10-06": 500,
  "F10-07": 500,
  "F10-08": 500,
  "F10-09": 500,
  // Entry/MDM routers remain matched for traceability; downstream decisions
  // control once their more-specific facts are present.
  "F5-01": 600,
  "F5-02": 700,
  "F5-03": 700,
  "F5-04": 700,
  "F5-05": 700,
  "F5-06": 700,
  "F5-07": 700,
  "F5-08": 700,
  "F5-09": 700,
  "F5-10": 700,
  "F5-11": 700,
  "F5-12": 700,
  "F6-01": 300,
  "F6-02": 800,
  "F6-03": 800,
  "F6-04": 800,
  "F6-05": 800,
  "F6-06": 800,
  "F6-07": 800,
  "F6-08": 800,
  "F6-09": 500,
  "F6-10": 500,
  "F6-11": 500,
  "F6-14": 100,
  "F7-01": 600,
  "F7-02": 600,
  "F7-03": 650,
  "F7-04": 700,
  "F7-05": 700,
  "F7-06": 700,
  "F7-07": 700,
  "F7-09": 700,
  "F7-10": 700,
  "F7-11": 700,
  "F7-12": 700,
  "F7-13": 700,
  "F7-14": 700,
  "F7-15": 700,
  "F7-16": 700,
  "F7-18": 675,
  "F9-01": 675,
  "F9-02": 650,
  "F9-03": 700,
  "F9-04": 700,
  "F9-05": 700,
  "F9-06": 700,
  "F9-07": 700,
  "F9-08": 700,
  "F9-09": 700,
  "F9-10": 700,
  "F9-11": 700,
  // A known DES exposure selects the overlay; its more specific outcomes then
  // control within that overlay instead of being hidden by the entry rule.
  "DES-01": 600,
  "DES-02": 700,
  "DES-03": 700,
  "DES-04": 700,
  // Remaining global routers select the pathway before pathway-local rules.
  "GR-02": 1000,
  "GR-03": 1000,
  "GR-04": 1000,
  "GR-06": 1000,
  "GR-07": 1000,
  "GR-08": 1000,
  "GR-09": 1000,
  "GR-10": 1000,
  "GR-11": 1000,
  "GR-12": 1000,
  // GR-13 is the intake fallback, not a peer of the specific global routers.
  "GR-13": 850,
};

export function governedRulePrecedence(rule: RuleDefinition): number {
  return (
    EXPLICIT_PRECEDENCE[rule.stableRuleId] ??
    (rule.safetyPriority === "CRITICAL" ? 800 : rule.safetyPriority === "HIGH" ? 600 : 200)
  );
}
