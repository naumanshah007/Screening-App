import {
  canonicalClinicalFactsV2FromFlatFacts,
  type CanonicalClinicalFactsV2,
} from "../../canonical-facts-v2";
import { normalizeClinicalFactMap } from "../../facts";
import { enrichOracleFacts } from "../../../../scripts/rule-studio/run-canonical-differential";
import { probeFor } from "../../../../tests/clinical-conformance/support/conformance-runner";
import {
  guidelineOracle,
  type GuidelineRule,
} from "../../../../tests/clinical-conformance/support/guideline-oracle";

export type CanonicalV2CorpusCase = {
  caseId: string;
  oracle: GuidelineRule;
  canonicalFacts: CanonicalClinicalFactsV2;
  wasLegacyInputGap: boolean;
};

const LEGACY_INPUT_GAP_CASES = new Set([
  "F3-UNSUITABLE-HPV-REPEAT-ASAP",
  "F6-CIN2-UNDER30-ELIGIBLE-ACTIVE-SURVEILLANCE",
  "F6-CIN2-SURVEILLANCE-CIN3-TREAT",
  "F6-CIN2-PERSISTS-24M-TREAT",
  "F6-CIN2-REGRESSION-TOC",
  "F6-POSITIVE-MARGINS-UNDER50-COMMUNITY-TOC",
  "F6-POSITIVE-MARGINS-AGE50PLUS-SPECIALIST",
  "F7-AIS-CLEAR-MARGINS-PRIMARY-CARE-6-18M",
  "F8-CANCER-STAGE1A1-LOCAL-EXCISION-TOC-COMPLETE-REGULAR",
  "F8-CANCER-STAGE1A1-TOC-ABNORMAL-COLPOSCOPY",
  "F8-CANCER-STAGE1A1-POST-TOC-HPV-FIG3",
  "F8-CANCER-TOTAL-HYSTERECTOMY-TOC-COMPLETE-CEASE",
  "F8-OTHER-GYNAECOLOGICAL-CANCER-OUTSIDE-NCSP",
  "F8-NONCERVICAL-CANCER-HYSTERECTOMY-HSIL-INCOMPLETE-TOC",
  "F10-SINGLE-PREMENOPAUSAL-PCB-REASSURING-NO-COLPOSCOPY",
  "F10-RECURRENT-PERSISTENT-PCB-GYNAECOLOGY",
  "F10-PERSISTENT-UNEXPLAINED-IMB-GYNAECOLOGY",
  "F10-POSTMENOPAUSAL-BLEEDING-EXAM-COTEST-GYNAECOLOGY",
]);

function explicitLegacyGapFacts(caseId: string): Record<string, unknown> {
  switch (caseId) {
    case "F3-UNSUITABLE-HPV-REPEAT-ASAP":
      return {
        currentPathway: "FIGURE_3",
        eventStage: "INITIAL",
        hpvValidity: "UNSUITABLE",
        technicalIssueAssessmentComplete: true,
        cytologyAvailabilityKnown: true,
      };
    case "F6-CIN2-UNDER30-ELIGIBLE-ACTIVE-SURVEILLANCE":
      return {
        biopsyResult: "CIN2",
        ageYears: 29,
        transformationZoneType: "TYPE_1",
        cin3Excluded: true,
        invasionExcluded: true,
        participantTreatmentPreference: "SURVEILLANCE",
      };
    case "F6-CIN2-SURVEILLANCE-CIN3-TREAT":
      return {
        cin2ActiveSurveillance: true,
        followUpBiopsyResult: "CIN3",
        surveillanceDurationMonths: 6,
      };
    case "F6-CIN2-PERSISTS-24M-TREAT":
      return {
        cin2ActiveSurveillance: true,
        followUpBiopsyResult: "CIN2",
        surveillanceDurationMonths: 24,
      };
    case "F6-CIN2-REGRESSION-TOC":
      return {
        cin2ActiveSurveillance: true,
        cin2RegressionConfirmed: true,
      };
    case "F6-POSITIVE-MARGINS-UNDER50-COMMUNITY-TOC":
      return {
        currentPathway: "FIGURE_6",
        treatmentModality: "EXCISION",
        marginStatus: "POSITIVE",
        ageYears: 49,
        treatmentDate: "2026-01-15",
        treatmentConfirmed: true,
      };
    case "F6-POSITIVE-MARGINS-AGE50PLUS-SPECIALIST":
      return {
        currentPathway: "FIGURE_6",
        treatmentModality: "EXCISION",
        marginStatus: "POSITIVE",
        ageYears: 50,
        treatmentDate: "2026-01-15",
        treatmentConfirmed: true,
      };
    case "F7-AIS-CLEAR-MARGINS-PRIMARY-CARE-6-18M":
      return {
        currentPathway: "FIGURE_7",
        hpvResult: "HPV_OTHER",
        preTreatmentHpvStatus: "HPV_OTHER",
        histologyResult: "AIS",
        treatedHistology: "AIS",
        marginStatus: "CLEAR",
        treatmentDate: "2026-01-15",
        cervixPresent: true,
      };
    case "F8-CANCER-STAGE1A1-LOCAL-EXCISION-TOC-COMPLETE-REGULAR":
      return {
        cancerType: "CERVICAL",
        cancerStage: "STAGE_1A1",
        cancerTreatment: "LOCAL_EXCISION",
        tocStatus: "COMPLETE",
        cancerFollowUpPhase: "AFTER_TOC",
        hpvResult: "NOT_DETECTED",
      };
    case "F8-CANCER-STAGE1A1-TOC-ABNORMAL-COLPOSCOPY":
      return {
        cancerType: "CERVICAL",
        cancerStage: "STAGE_1A1",
        cancerTreatment: "LOCAL_EXCISION",
        tocStatus: "INCOMPLETE",
        cancerFollowUpPhase: "DURING_TOC",
        hpvResult: "HPV_OTHER",
        cytologyResult: "LSIL",
      };
    case "F8-CANCER-STAGE1A1-POST-TOC-HPV-FIG3":
      return {
        cancerType: "CERVICAL",
        cancerStage: "STAGE_1A1",
        cancerTreatment: "LOCAL_EXCISION",
        tocStatus: "COMPLETE",
        cancerFollowUpPhase: "AFTER_TOC",
        hpvResult: "HPV_OTHER",
      };
    case "F8-CANCER-TOTAL-HYSTERECTOMY-TOC-COMPLETE-CEASE":
      return {
        cancerType: "CERVICAL",
        cancerStage: "STAGE_1A1",
        cancerTreatment: "TOTAL_HYSTERECTOMY",
        hysterectomyType: "TOTAL",
        tocStatus: "COMPLETE",
      };
    case "F8-OTHER-GYNAECOLOGICAL-CANCER-OUTSIDE-NCSP":
      return {
        hasOtherPriorCervicalOrVaginalCancer: true,
        cancerType: "VAGINAL",
        ncspApplicability: "OUTSIDE_NCSP",
      };
    case "F8-NONCERVICAL-CANCER-HYSTERECTOMY-HSIL-INCOMPLETE-TOC":
      return {
        priorHsil: true,
        tocStatusBeforeHysterectomy: "INCOMPLETE",
        gynaecologicalCancerType: "NON_CERVICAL",
        hysterectomyType: "TOTAL",
      };
    case "F10-SINGLE-PREMENOPAUSAL-PCB-REASSURING-NO-COLPOSCOPY":
      return {
        currentPathway: "FIGURE_10",
        hasAbnormalVaginalBleeding: true,
        bleedingType: "POSTCOITAL",
        bleedingEpisodeState: "SINGLE",
        menopausalStatus: "PREMENOPAUSAL",
        abnormalCervix: false,
        hpvResult: "NOT_DETECTED",
        cytologyResult: "NEGATIVE",
      };
    case "F10-RECURRENT-PERSISTENT-PCB-GYNAECOLOGY":
      return {
        currentPathway: "FIGURE_10",
        hasAbnormalVaginalBleeding: true,
        bleedingType: "POSTCOITAL",
        bleedingEpisodeState: "RECURRENT",
        menopausalStatus: "PREMENOPAUSAL",
        abnormalCervix: false,
        hpvResult: "NOT_DETECTED",
        cytologyResult: "NEGATIVE",
      };
    case "F10-PERSISTENT-UNEXPLAINED-IMB-GYNAECOLOGY":
      return {
        currentPathway: "FIGURE_10",
        hasAbnormalVaginalBleeding: true,
        bleedingType: "INTERMENSTRUAL",
        bleedingEpisodeState: "PERSISTENT_UNEXPLAINED",
      };
    case "F10-POSTMENOPAUSAL-BLEEDING-EXAM-COTEST-GYNAECOLOGY":
      return {
        currentPathway: "FIGURE_10",
        hasAbnormalVaginalBleeding: true,
        bleedingType: "POSTCOITAL",
        bleedingEpisodeState: "SINGLE",
        menopausalStatus: "POSTMENOPAUSAL",
      };
    default:
      throw new Error(`Missing explicit CanonicalClinicalFactsV2 fixture for ${caseId}.`);
  }
}

function factsForOracleCase(rule: GuidelineRule) {
  if (LEGACY_INPUT_GAP_CASES.has(rule.ruleId)) {
    return explicitLegacyGapFacts(rule.ruleId);
  }
  const probe = probeFor(rule);
  if (!probe.input) {
    throw new Error(probe.unsupportedReason ?? `No fixture input for ${rule.ruleId}.`);
  }
  const facts = enrichOracleFacts(rule, probe.input as unknown as Record<string, unknown>);

  if (rule.ruleId === "F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED") {
    Object.assign(facts, {
      currentPathway: "FIGURE_5",
      reviewedCytology: "CONFIRMED_ASC_H",
      transformationZoneType: "TYPE_1",
      visibleLesion: false,
      colposcopyResult: "NORMAL",
      cytologyResult: "ASC_H",
      hpvResult: "HPV_OTHER",
    });
  }
  if (rule.ruleId === "F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC") {
    Object.assign(facts, {
      currentPathway: "FIGURE_5",
      reviewedCytology: "CONFIRMED_ASC_H",
      observationStage: "SIX_MONTH",
      treatmentDeferred: true,
      informedDecisionDocumented: true,
      hpvResult: "NOT_DETECTED",
      cytologyResult: "NEGATIVE",
      visibleLesion: false,
      colposcopicImpressionUnchanged: true,
    });
  }
  return normalizeClinicalFactMap(facts);
}

export const canonicalV2Corpus: CanonicalV2CorpusCase[] = guidelineOracle.map(
  (oracle) => ({
    caseId: oracle.ruleId,
    oracle,
    canonicalFacts: canonicalClinicalFactsV2FromFlatFacts({
      subjectReference: `SYNTHETIC-${oracle.ruleId}`,
      facts: factsForOracleCase(oracle),
      source: "SYNTHETIC_DEMO",
      enteredBy: "canonical-v2-source-oracle-fixture",
      recordedAt: "2026-08-03T00:00:00.000Z",
    }),
    wasLegacyInputGap: LEGACY_INPUT_GAP_CASES.has(oracle.ruleId),
  })
);

export const legacyInputGapCaseIds = [...LEGACY_INPUT_GAP_CASES].sort();
