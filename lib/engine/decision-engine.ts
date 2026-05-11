import type {
  ClinicalDecision,
  ClinicalInput,
  ColposcopicImpression,
  CytologyResult,
  HistologyResult,
  PathwayFigure,
  RepeatStage,
} from "./types";

const RULE_VERSION = "business-figures-table1-v1";
const THREE_YEARS_MS = 3 * 365.25 * 24 * 60 * 60 * 1000;

const GLANDULAR_CODES = ["AG1", "AG2", "AG3", "AG4", "AG5", "AC1", "AC2", "AC3", "AC4"];
const FIGURE_9_QUALIFYING_CYTOLOGY = ["ASC_H", "HSIL", "AG1", "AG2", "AG3", "AG4", "AG5", "AC1", "AC2", "AC3", "AC4"];

function withDefaults(decision: ClinicalDecision): ClinicalDecision {
  return {
    ruleVersion: RULE_VERSION,
    validationStatus: "IMPLEMENTED",
    branchPath: [decision.figure, decision.recommendationCode],
    ...decision,
  };
}

function insufficient(
  figure: PathwayFigure,
  code: string,
  missingInformation: string[],
  nextAction = "Collect missing information before selecting a pathway",
  externalDependencies?: string[]
): ClinicalDecision {
  return withDefaults({
    figure,
    riskLevel: "MEDIUM",
    recommendation: "Insufficient information to safely determine pathway.",
    recommendationCode: code,
    nextAction,
    safetyOutcome: externalDependencies?.length ? "EXTERNAL_HISTORY_REQUIRED" : "INSUFFICIENT_INFORMATION",
    missingInformation,
    externalDependencies,
    validationStatus: externalDependencies?.length ? "EXTERNAL_DEPENDENCY" : "IMPLEMENTED",
    clinicalWarnings: ["The engine did not infer a clinical pathway from incomplete facts."],
    guidelineReference: `${figure} - missing required pathway facts`,
    rationale: "The supplied business figure/table requires structured facts that were not present in the request.",
  });
}

function clinicianReview(
  figure: PathwayFigure,
  code: string,
  recommendation: string,
  nextAction = "Clinician review required before pathway is finalised",
  missingInformation?: string[]
): ClinicalDecision {
  return withDefaults({
    figure,
    riskLevel: "HIGH",
    recommendation,
    recommendationCode: code,
    nextAction,
    safetyOutcome: "CLINICIAN_REVIEW_REQUIRED",
    missingInformation,
    validationStatus: "REQUIRES_CLINICAL_CONFIRMATION",
    clinicalWarnings: ["This branch needs clinician validation before it is treated as final."],
    guidelineReference: `${figure} - clinician review`,
    rationale: "The supplied source does not contain enough implementation detail for a silent automated decision.",
  });
}

function isHpvDetected(hpvResult?: string): boolean {
  return hpvResult === "HPV_16_18" || hpvResult === "HPV_OTHER";
}

function isNegativeOrLowGradeCytology(cytologyResult?: string): boolean {
  return cytologyResult === "NEGATIVE" || cytologyResult === "ASC_US" || cytologyResult === "LSIL";
}

function isLowGradeCytology(cytologyResult?: string): boolean {
  return cytologyResult === "ASC_US" || cytologyResult === "LSIL";
}

function isHighGradeCytology(cytologyResult?: string): boolean {
  return ["ASC_H", "HSIL", "SCC", ...GLANDULAR_CODES].includes(cytologyResult ?? "");
}

function isGlandularCytology(cytologyResult?: string): boolean {
  return GLANDULAR_CODES.includes(cytologyResult ?? "");
}

function isPregnancyQualifyingCytology(cytologyResult?: string): boolean {
  return FIGURE_9_QUALIFYING_CYTOLOGY.includes(cytologyResult ?? "");
}

function repeatStage(input: ClinicalInput): RepeatStage {
  if (input.repeatStage) return input.repeatStage;
  if (input.consecutiveNegativeCoTestCount >= 2) return "SECOND_REPEAT";
  if (input.consecutiveNegativeCoTestCount >= 1 || input.consecutiveLowGradeCount >= 1) return "FIRST_REPEAT";
  return "BASELINE";
}

function ageAtLeast(age: number | undefined, target: number): boolean | undefined {
  return age === undefined ? undefined : age >= target;
}

function reportOlderThanThreeYears(reportDate?: string | Date): boolean | undefined {
  if (!reportDate) return undefined;
  const parsed = new Date(reportDate).getTime();
  if (Number.isNaN(parsed)) return undefined;
  return Date.now() - parsed > THREE_YEARS_MS;
}

function returnToScreening(
  figure: PathwayFigure,
  code: string,
  immunocompromised: boolean,
  recommendation = "Return to regular interval screening."
): ClinicalDecision {
  const months = immunocompromised ? 36 : 60;
  return withDefaults({
    figure,
    riskLevel: "LOW",
    recommendation,
    recommendationCode: code,
    nextAction: `Schedule routine recall in ${months} months${immunocompromised ? " because participant is immune deficient" : ""}`,
    recallRequired: true,
    recallIntervalMonths: months,
    nextScreeningIntervalMonths: months,
    guidelineReference: `${figure} - return to screening`,
    rationale: immunocompromised
      ? "The supplied Figure 3 uses a 3-year return interval for immune deficient participants."
      : "The supplied pathway returns the participant to regular interval screening.",
  });
}

// Figure 1: transition invitation, not current HPV-result triage.
function evaluateFigure1(input: ClinicalInput): ClinicalDecision {
  const { screeningStatus, priorScreeningHistory, testOfCureStatus } = input;

  if (!screeningStatus || screeningStatus === "UNKNOWN") {
    return insufficient("FIGURE_1", "F1-EXTERNAL-HISTORY-REQUIRED", ["screeningStatus"], "Confirm screening status before invitation decision", ["NCSR or validated screening history"]);
  }

  if (["NEVER_SCREENED", "UNDER_SCREENED", "OVERDUE"].includes(screeningStatus)) {
    return withDefaults({
      figure: "FIGURE_1",
      riskLevel: "MEDIUM",
      recommendation: "Participant is never screened, under-screened, or overdue. Invite now for HPV primary screening.",
      recommendationCode: "F1-INVITE-NOW",
      nextAction: "Invite now, then perform HPV screening test and continue through Figure 3.",
      guidelineReference: "Figure 1 - transition to HPV primary screening",
      rationale: "The supplied Figure 1 routes never screened, under-screened, and overdue participants to immediate invitation.",
      branchPath: ["FIGURE_1", screeningStatus, "INVITE_NOW", "FIGURE_3_NEXT"],
    });
  }

  const regularHistoryOk =
    priorScreeningHistory === "NEGATIVE_OR_NORMAL" ||
    priorScreeningHistory === "LOW_GRADE_ONLY" ||
    priorScreeningHistory === "LOW_GRADE_RETURNED_TO_REGULAR" ||
    priorScreeningHistory === "HIGH_GRADE_TOC_COMPLETE" ||
    testOfCureStatus === "SUCCESSFULLY_COMPLETED" ||
    testOfCureStatus === "COMPLETE";

  if (screeningStatus === "REGULAR_SCREENING" && regularHistoryOk) {
    return withDefaults({
      figure: "FIGURE_1",
      riskLevel: "LOW",
      recommendation: "Regularly screened participant. Invite at next scheduled visit for HPV primary screening.",
      recommendationCode: "F1-INVITE-NEXT-SCHEDULED",
      nextAction: "Invite at next scheduled visit, then perform HPV screening test and continue through Figure 3.",
      guidelineReference: "Figure 1 - transition to HPV primary screening",
      rationale: "The supplied Figure 1 routes regularly screened participants with normal/low-grade history or completed Test of Cure to next scheduled invitation.",
      branchPath: ["FIGURE_1", "REGULAR_SCREENING", "INVITE_NEXT_SCHEDULED", "FIGURE_3_NEXT"],
    });
  }

  return insufficient(
    "FIGURE_1",
    "F1-HISTORY-DETAIL-REQUIRED",
    ["priorScreeningHistory or successful Test of Cure status"],
    "Confirm prior screening history before invitation timing is selected",
    ["NCSR or validated screening history"]
  );
}

// Figure 2: transition for previous high-grade/AIS/AG2 histories.
function evaluateFigure2(input: ClinicalInput): ClinicalDecision {
  if (input.historySourceAvailable === false) {
    return insufficient("FIGURE_2", "F2-EXTERNAL-HISTORY-REQUIRED", ["validated previous abnormal history"], "Pull or enter validated screening history", ["NCSR or specialist history"]);
  }

  const hasPriorHighGradeOrGlandular =
    input.priorHighGradeResult ||
    input.previousHSILCIN23 ||
    input.previousAtypicalGlandularCells ||
    input.priorScreeningHistory === "PREVIOUS_ATYPICAL_GLANDULAR";

  if (input.previousAIS || input.priorScreeningHistory === "PREVIOUS_AIS") {
    if (!input.isPostHysterectomy) {
      return withDefaults({
        figure: "FIGURE_2",
        riskLevel: "HIGH",
        recommendation: "Previous AIS without total hysterectomy. Route to service-defined post-treatment follow-up.",
        recommendationCode: "F2-AIS-R208-FOLLOWUP",
        nextAction: "Use R2.08/post-treatment follow-up workflow or clinician-confirmed service pathway.",
        safetyOutcome: "CLINICIAN_REVIEW_REQUIRED",
        validationStatus: "REQUIRES_CLINICAL_CONFIRMATION",
        guidelineReference: "Figure 2 - previous AIS and no total hysterectomy",
        rationale: "The supplied Figure 2 references R2.08; product mapping for that service workflow must be confirmed.",
        branchPath: ["FIGURE_2", "PREVIOUS_AIS", "NO_TOTAL_HYSTERECTOMY", "R2_08"],
      });
    }
    return evaluateTable1({ ...input, currentFigure: "TABLE_1" });
  }

  if (
    input.previousAtypicalEndometrialCells ||
    input.atypicalEndometrialHistory ||
    input.priorScreeningHistory === "PREVIOUS_ATYPICAL_ENDOMETRIAL"
  ) {
    const olderThanThreeYears = reportOlderThanThreeYears(input.ag2ReportDate);

    if (olderThanThreeYears === true || input.specialistDischargedToPrimaryCare) {
      return withDefaults({
        figure: "FIGURE_2",
        riskLevel: "LOW",
        recommendation: "Previous atypical endometrial cells are eligible to return to HPV primary screening.",
        recommendationCode: olderThanThreeYears ? "F2-AG2-OLDER-3Y-FIG3" : "F2-AG2-DISCHARGED-FIG3",
        nextAction: "Proceed to primary HPV screening pathway (Figure 3) at the next scheduled visit.",
        guidelineReference: "Figure 2 - atypical endometrial cells status",
        rationale: olderThanThreeYears
          ? "The supplied Figure 2 routes reports more than 3 years old to primary HPV screening."
          : "The supplied Figure 2 routes specialist-discharged participants to primary HPV screening.",
        branchPath: ["FIGURE_2", "PREVIOUS_AG2", olderThanThreeYears ? "REPORT_OLDER_THAN_3Y" : "SPECIALIST_DISCHARGED", "FIGURE_3_NEXT"],
      });
    }

    if (olderThanThreeYears === undefined && !input.specialistDischargedToPrimaryCare) {
      return insufficient(
        "FIGURE_2",
        "F2-AG2-STATUS-REQUIRED",
        ["ag2ReportDate or specialistDischargedToPrimaryCare"],
        "Confirm atypical endometrial cell report age or specialist discharge status",
        ["NCSR or specialist service history"]
      );
    }

    return withDefaults({
      figure: "FIGURE_2",
      riskLevel: "HIGH",
      recommendation: "Previous atypical endometrial cells have not returned to 3-year screening. Refer to specialist gynaecology.",
      recommendationCode: "F2-AG2-SPECIALIST-GYN",
      nextAction: "Refer to specialist gynaecologist services.",
      referralRequired: true,
      referralType: "GYNAECOLOGY",
      referralPriority: "P1",
      referralReason: "Previous atypical endometrial cells not returned to routine screening",
      guidelineReference: "Figure 2 - atypical endometrial cells status otherwise",
      rationale: "The supplied Figure 2 routes this status to specialist gynaecologist services.",
      branchPath: ["FIGURE_2", "PREVIOUS_AG2", "OTHERWISE", "SPECIALIST_GYNAECOLOGY"],
    });
  }

  if (hasPriorHighGradeOrGlandular) {
    if (input.colposcopyRecommendedInLastCytology && !input.colposcopyCompletedForLastRecommendation) {
      return withDefaults({
        figure: "FIGURE_2",
        riskLevel: "HIGH",
        recommendation: "Previous possible/definite HSIL or atypical glandular result requires colposcopy because the last recommended colposcopy has not occurred.",
        recommendationCode: "F2-PRIOR-HG-COLP",
        nextAction: "Refer to colposcopy.",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P2",
        referralReason: "Previous high-grade/glandular result with outstanding recommended colposcopy",
        guidelineReference: "Figure 2 - previous high-grade result not returned to regular screening",
        rationale: "The supplied Figure 2 requires referral to colposcopy if recommended in the last cytology report and not already done.",
        branchPath: ["FIGURE_2", "PRIOR_HIGH_GRADE_OR_GLANDULAR", "COLPOSCOPY_RECOMMENDED_NOT_DONE"],
      });
    }

    if (input.testOfCureStatus === "COMPLETE" || input.testOfCureStatus === "SUCCESSFULLY_COMPLETED") {
      return withDefaults({
        figure: "FIGURE_2",
        riskLevel: "LOW",
        recommendation: "Previous high-grade/glandular history has completed Test of Cure. Return to regular interval HPV screening via Figure 3.",
        recommendationCode: "F2-PRIOR-HG-TOC-COMPLETE-FIG3",
        nextAction: "Proceed to regular interval screening pathway (Figure 3).",
        guidelineReference: "Figure 2 - Test of Cure complete",
        rationale: "The supplied Figure 2 returns completed Test of Cure participants to regular interval screening.",
        branchPath: ["FIGURE_2", "PRIOR_HIGH_GRADE_OR_GLANDULAR", "TOC_COMPLETE", "FIGURE_3_NEXT"],
      });
    }

    if (input.testOfCureStatus === "REQUIRED" || input.testOfCureStatus === "INCOMPLETE") {
      return withDefaults({
        figure: "FIGURE_2",
        riskLevel: "HIGH",
        recommendation: "Previous high-grade/glandular history requires completion of Test of Cure.",
        recommendationCode: "F2-PRIOR-HG-COMPLETE-TOC",
        nextAction: "Complete Test of Cure pathway (Figure 6).",
        guidelineReference: "Figure 2 - complete Test of Cure",
        rationale: "The supplied Figure 2 requires completion of Test of Cure when colposcopy is not the outstanding action.",
        branchPath: ["FIGURE_2", "PRIOR_HIGH_GRADE_OR_GLANDULAR", "COMPLETE_TEST_OF_CURE"],
      });
    }

    return insufficient("FIGURE_2", "F2-PRIOR-HG-TOC-STATUS-REQUIRED", ["testOfCureStatus"], "Confirm Test of Cure status", ["NCSR or specialist treatment history"]);
  }

  return insufficient("FIGURE_2", "F2-PRIOR-HISTORY-REQUIRED", ["previous high-grade/AIS/glandular/endometrial history category"], "Confirm which Figure 2 prior-history branch applies", ["NCSR or validated prior cytology history"]);
}

function evaluateFigure3(input: ClinicalInput): ClinicalDecision {
  const stage = repeatStage(input);
  const warnings: string[] = [];

  if (!input.hpvResult) {
    return insufficient("FIGURE_3", "F3-HPV-REQUIRED", ["hpvResult"], "Enter HPV result");
  }

  const cytologyNeeded = input.hpvResult === "HPV_OTHER" || input.hpvResult === "HPV_16_18";
  if (input.sampleType === "SWAB" && cytologyNeeded && !input.swabReturnVisitCompleted) {
    return withDefaults({
      figure: "FIGURE_3",
      riskLevel: "MEDIUM",
      recommendation: "Self-collected swab with HPV detected. Return visit with clinical examination is required before cytology-dependent pathway decision.",
      recommendationCode: "F3-SWAB-RETURN-REQUIRED",
      nextAction: "Schedule return visit with clinical examination and cytology/cotest review.",
      requiresSwabRepeat: true,
      missingInformation: ["swabReturnVisitCompleted"],
      guidelineReference: "Figure 3 - cytology after swab sample",
      rationale: "The supplied Figure 3 routes HPV-detected swab samples through a return visit with clinical examination when cytology is needed.",
      branchPath: ["FIGURE_3", "SWAB", "HPV_DETECTED", "RETURN_VISIT_REQUIRED"],
    });
  }
  if (input.sampleType === "SWAB" && input.swabReturnVisitCompleted) {
    warnings.push("Swab return visit documented.");
  }

  if (input.hpvResult === "NOT_DETECTED") {
    return returnToScreening(
      "FIGURE_3",
      input.immunocompromised ? "F3-HPV-NOT-DETECTED-IC-3Y" : "F3-HPV-NOT-DETECTED-5Y",
      input.immunocompromised,
      stage === "BASELINE" ? "HPV not detected." : "Repeat HPV not detected."
    );
  }

  if (input.hpvResult === "INADEQUATE") {
    return withDefaults({
      figure: "FIGURE_3",
      riskLevel: "MEDIUM",
      recommendation: "Inadequate HPV sample. Repeat HPV test in 3 months.",
      recommendationCode: "F3-INAD-3M",
      nextAction: "Recall for repeat HPV test in 3 months.",
      recallRequired: true,
      recallIntervalMonths: 3,
      clinicalWarnings: warnings.length ? warnings : undefined,
      guidelineReference: "Figure 3 - inadequate sample",
      rationale: "The supplied Figure 3 requires repeat testing when the primary HPV test is inadequate.",
    });
  }

  if (stage === "SECOND_REPEAT" && isHpvDetected(input.hpvResult)) {
    return withDefaults({
      figure: "FIGURE_3",
      riskLevel: "HIGH",
      recommendation: "Second repeat HPV detected any type. Cytology should be reported and colposcopy is required.",
      recommendationCode: "F3-SECOND-REPEAT-HPV-DETECTED-COLP",
      nextAction: "Report cytology if available and refer to colposcopy.",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P2",
      referralReason: "HPV detected at second repeat in Figure 3",
      clinicalWarnings: warnings.length ? warnings : undefined,
      guidelineReference: "Figure 3 - second repeat HPV detected any type",
      rationale: "The supplied Figure 3 routes any HPV detection at second repeat to colposcopy.",
      branchPath: ["FIGURE_3", "SECOND_REPEAT", "HPV_DETECTED_ANY_TYPE", "COLPOSCOPY"],
    });
  }

  if (input.hpvResult === "HPV_16_18") {
    const highGrade = isHighGradeCytology(input.cytologyResult);
    return withDefaults({
      figure: "FIGURE_3",
      riskLevel: highGrade ? "URGENT" : "HIGH",
      recommendation: input.cytologyResult
        ? "HPV 16/18 detected. Cytology is available; refer to colposcopy."
        : "HPV 16/18 detected. Cytology should be reported if LBC, but colposcopy referral is required.",
      recommendationCode: highGrade ? "F3-1618-HIGH-GRADE-COLP" : "F3-1618-COLP",
      nextAction: "Refer to colposcopy.",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: highGrade ? "P1" : "P2",
      referralReason: "HPV 16/18 detected",
      clinicalWarnings: [
        ...warnings,
        ...(input.cytologyResult ? [] : ["Cytology should still be reported if an LBC sample exists."]),
      ],
      guidelineReference: "Figure 3 - HPV 16 or 18",
      rationale: "The supplied Figure 3 routes HPV 16/18 to colposcopy.",
      branchPath: ["FIGURE_3", stage, "HPV_16_18", "COLPOSCOPY"],
    });
  }

  if (input.hpvResult === "HPV_OTHER") {
    if (!input.cytologyResult) {
      return insufficient("FIGURE_3", "F3-HPV-OTHER-CYTOLOGY-REQUIRED", ["cytologyResult"], "Enter cytology result for HPV Other");
    }

    if (input.cytologyResult === "AG2" || input.cytologyResult === "AC2") {
      return evaluateFigure7(input);
    }

    if (isHighGradeCytology(input.cytologyResult)) {
      return withDefaults({
        figure: "FIGURE_3",
        riskLevel: "HIGH",
        recommendation: "HPV Other with possible/definite high-grade cytology. Refer to colposcopy.",
        recommendationCode: "F3-HPV-OTHER-HIGH-GRADE-COLP",
        nextAction: "Refer to colposcopy.",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P2",
        referralReason: "HPV Other plus possible/definite high-grade cytology",
        clinicalWarnings: warnings.length ? warnings : undefined,
        guidelineReference: "Figure 3 - HPV Other high-grade cytology",
        rationale: "The supplied Figure 3 routes possible/definite high-grade cytology to colposcopy.",
        branchPath: ["FIGURE_3", stage, "HPV_OTHER", "HIGH_GRADE_CYTOLOGY", "COLPOSCOPY"],
      });
    }

    if (isNegativeOrLowGradeCytology(input.cytologyResult)) {
      if (stage === "FIRST_REPEAT") {
        const isOver50 = ageAtLeast(input.patientAge, 50);
        if (isOver50 === undefined) {
          return insufficient("FIGURE_3", "F3-FIRST-REPEAT-AGE-REQUIRED", ["patientAge"], "Enter age to determine age >= 50 branch");
        }
        if (isOver50) {
          return withDefaults({
            figure: "FIGURE_3",
            riskLevel: "HIGH",
            recommendation: "First repeat HPV Other with negative/ASC-US/LSIL cytology and age >= 50. Refer to colposcopy.",
            recommendationCode: "F3-FIRST-REPEAT-AGE50-COLP",
            nextAction: "Refer to colposcopy.",
            referralRequired: true,
            referralType: "COLPOSCOPY",
            referralPriority: "P2",
            referralReason: "HPV Other persists at first repeat and participant is age >= 50",
            guidelineReference: "Figure 3 - first repeat age >= 50",
            rationale: "The supplied Figure 3 sends participants age >= 50 with persistent HPV Other and negative/ASC-US/LSIL cytology to colposcopy.",
            branchPath: ["FIGURE_3", "FIRST_REPEAT", "HPV_OTHER", "NEG_ASCUS_LSIL", "AGE_50_OR_OVER", "COLPOSCOPY"],
          });
        }
        return withDefaults({
          figure: "FIGURE_3",
          riskLevel: "MEDIUM",
          recommendation: "First repeat HPV Other with negative/ASC-US/LSIL cytology and age < 50. Second repeat HPV test in 12 months.",
          recommendationCode: "F3-FIRST-REPEAT-UNDER50-SECOND-REPEAT",
          nextAction: "Schedule second repeat HPV test in 12 months; recommend LBC.",
          recallRequired: true,
          recallIntervalMonths: 12,
          guidelineReference: "Figure 3 - first repeat age < 50",
          rationale: "The supplied Figure 3 sends participants under 50 to a second repeat HPV test in 12 months.",
          branchPath: ["FIGURE_3", "FIRST_REPEAT", "HPV_OTHER", "NEG_ASCUS_LSIL", "UNDER_50", "SECOND_REPEAT_12M"],
        });
      }

      return withDefaults({
        figure: "FIGURE_3",
        riskLevel: "MEDIUM",
        recommendation: "HPV Other with negative/ASC-US/LSIL cytology. First repeat HPV test in 12 months.",
        recommendationCode: "F3-HPV-OTHER-NEG-ASCUS-LSIL-12M",
        nextAction: "Schedule first repeat HPV test in 12 months; recommend LBC.",
        recallRequired: true,
        recallIntervalMonths: 12,
        guidelineReference: "Figure 3 - HPV Other with negative/ASC-US/LSIL cytology",
        rationale: "The supplied Figure 3 routes this branch to first repeat HPV testing in 12 months.",
        branchPath: ["FIGURE_3", "BASELINE", "HPV_OTHER", "NEG_ASCUS_LSIL", "FIRST_REPEAT_12M"],
      });
    }
  }

  return clinicianReview("FIGURE_3", "F3-UNMAPPED-COMBINATION", "The HPV/cytology combination is not mapped in the supplied Figure 3.", "Review entered HPV and cytology values.");
}

function evaluateFigure4(input: ClinicalInput): ClinicalDecision {
  const stage = input.repeatStage ?? (input.hpvResult ? "FIRST_REPEAT" : "BASELINE");
  const normalColpo = input.normalColposcopy || input.colposcopicImpression === "NORMAL";

  if (!normalColpo) {
    return insufficient("FIGURE_4", "F4-NORMAL-COLPOSCOPY-REQUIRED", ["normalColposcopy or colposcopicImpression NORMAL"], "Confirm normal colposcopy after HPV detected with negative/ASC-US/LSIL cytology");
  }

  if (!input.hpvResult) {
    return withDefaults({
      figure: "FIGURE_4",
      riskLevel: "MEDIUM",
      recommendation: "Normal colposcopy after HPV detected and negative/ASC-US/LSIL cytology. Repeat HPV test in 12 months in community care, recommend LBC.",
      recommendationCode: "F4-NORMAL-COLP-REPEAT-HPV-12M",
      nextAction: "Schedule repeat HPV test in 12 months in community care; recommend LBC.",
      recallRequired: true,
      recallIntervalMonths: 12,
      guidelineReference: "Figure 4 - normal colposcopy initial follow-up",
      rationale: "The supplied Figure 4 starts normal-colposcopy follow-up with a 12-month repeat HPV test.",
      branchPath: ["FIGURE_4", "NORMAL_COLPOSCOPY", "REPEAT_HPV_12M"],
    });
  }

  if (input.hpvResult === "NOT_DETECTED") {
    return returnToScreening("FIGURE_4", "F4-REPEAT-HPV-NOT-DETECTED-REGULAR", input.immunocompromised);
  }

  if (input.hpvResult === "HPV_16_18") {
    return withDefaults({
      figure: "FIGURE_4",
      riskLevel: "HIGH",
      recommendation: "Repeat HPV 16/18 detected after normal colposcopy. Refer to colposcopy.",
      recommendationCode: "F4-REPEAT-1618-COLP",
      nextAction: "Refer to colposcopy.",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P2",
      referralReason: "HPV 16/18 detected after normal colposcopy follow-up",
      guidelineReference: "Figure 4 - repeat HPV 16/18",
      rationale: "The supplied Figure 4 routes HPV 16/18 at repeat testing to colposcopy.",
      branchPath: ["FIGURE_4", stage, "HPV_16_18", "COLPOSCOPY"],
    });
  }

  if (input.hpvResult === "HPV_OTHER") {
    if (stage === "SECOND_REPEAT") {
      return withDefaults({
        figure: "FIGURE_4",
        riskLevel: "HIGH",
        recommendation: "Second repeat HPV detected any type after normal colposcopy. Refer to colposcopy.",
        recommendationCode: "F4-SECOND-REPEAT-HPV-DETECTED-COLP",
        nextAction: "Refer to colposcopy.",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P2",
        referralReason: "HPV detected at second repeat after normal colposcopy",
        guidelineReference: "Figure 4 - second repeat HPV detected",
        rationale: "The supplied Figure 4 routes HPV detected at second repeat to colposcopy.",
        branchPath: ["FIGURE_4", "SECOND_REPEAT", "HPV_DETECTED_ANY_TYPE", "COLPOSCOPY"],
      });
    }

    if (!input.cytologyResult) {
      return insufficient("FIGURE_4", "F4-HPV-OTHER-CYTOLOGY-REQUIRED", ["cytologyResult"], "Enter cytology result for HPV Other after normal colposcopy");
    }
    if (isHighGradeCytology(input.cytologyResult)) {
      return withDefaults({
        figure: "FIGURE_4",
        riskLevel: "HIGH",
        recommendation: "HPV Other with cytology >= ASC-H after normal colposcopy. Refer to colposcopy.",
        recommendationCode: "F4-HPV-OTHER-HIGH-GRADE-COLP",
        nextAction: "Refer to colposcopy.",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P2",
        referralReason: "HPV Other plus cytology >= ASC-H after normal colposcopy",
        guidelineReference: "Figure 4 - HPV Other with cytology >= ASC-H",
        rationale: "The supplied Figure 4 routes this branch to colposcopy.",
        branchPath: ["FIGURE_4", stage, "HPV_OTHER", "CYTOLOGY_GE_ASC_H", "COLPOSCOPY"],
      });
    }
    if (isNegativeOrLowGradeCytology(input.cytologyResult)) {
      if (input.immunocompromised) {
        return withDefaults({
          figure: "FIGURE_4",
          riskLevel: "HIGH",
          recommendation: "HPV Other with negative/ASC-US/LSIL cytology after normal colposcopy in an immune deficient participant. Refer to colposcopy.",
          recommendationCode: "F4-HPV-OTHER-LOW-GRADE-IC-COLP",
          nextAction: "Refer to colposcopy.",
          referralRequired: true,
          referralType: "COLPOSCOPY",
          referralPriority: "P2",
          referralReason: "Immune deficient participant with persistent HPV after normal colposcopy",
          guidelineReference: "Figure 4 - immune deficient branch",
          rationale: "The supplied Figure 4 routes immune deficient participants in this branch to colposcopy.",
          branchPath: ["FIGURE_4", stage, "HPV_OTHER", "NEG_ASCUS_LSIL", "IMMUNE_DEFICIENT", "COLPOSCOPY"],
        });
      }
      return withDefaults({
        figure: "FIGURE_4",
        riskLevel: "MEDIUM",
        recommendation: "HPV Other with negative/ASC-US/LSIL cytology after normal colposcopy. Repeat HPV test in 12 months in community care, recommend LBC.",
        recommendationCode: "F4-HPV-OTHER-LOW-GRADE-SECOND-REPEAT",
        nextAction: "Schedule repeat HPV test in 12 months in community care; recommend LBC.",
        recallRequired: true,
        recallIntervalMonths: 12,
        guidelineReference: "Figure 4 - repeat HPV Other low-grade cytology",
        rationale: "The supplied Figure 4 routes non-immune-deficient participants to a second repeat HPV test.",
        branchPath: ["FIGURE_4", stage, "HPV_OTHER", "NEG_ASCUS_LSIL", "SECOND_REPEAT_12M"],
      });
    }
  }

  return clinicianReview("FIGURE_4", "F4-UNMAPPED-COMBINATION", "The post-normal-colposcopy follow-up combination is not mapped by the supplied Figure 4.", "Review HPV/cytology/repeat-stage data.");
}

function evaluateFigure5(input: ClinicalInput): ClinicalDecision {
  const mdmOutcome = input.mdmOutcome;

  if (!mdmOutcome) {
    return withDefaults({
      figure: "FIGURE_5",
      riskLevel: "HIGH",
      recommendation: "Normal colposcopy after HPV detected with cytology >= ASC-H. MDM case review is required.",
      recommendationCode: "F5-MDM-REQUIRED",
      nextAction: "Complete MDM case review before selecting downstream pathway.",
      requiresMDMReview: true,
      guidelineReference: "Figure 5 - MDM case review",
      rationale: "The supplied Figure 5 requires MDM case review before downstream management.",
      branchPath: ["FIGURE_5", "NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY", "MDM_REQUIRED"],
    });
  }

  if (mdmOutcome === "DOWNGRADED_LSIL" || mdmOutcome === "DOWNGRADED_ASC_US_LSIL") {
    return withDefaults({
      figure: "FIGURE_5",
      riskLevel: "MEDIUM",
      recommendation: "MDM downgraded to LSIL/ASC-US. Follow the LSIL pathway.",
      recommendationCode: "F5-MDM-DOWNGRADED-LSIL",
      nextAction: "Follow LSIL pathway.",
      guidelineReference: "Figure 5 - downgraded to LSIL",
      rationale: "The supplied Figure 5 routes this MDM outcome to the LSIL pathway.",
      branchPath: ["FIGURE_5", "MDM", "DOWNGRADED_LSIL", "LSIL_PATHWAY"],
    });
  }

  if (mdmOutcome === "UPGRADED_HSIL") {
    return withDefaults({
      figure: "FIGURE_5",
      riskLevel: "HIGH",
      recommendation: "MDM upgraded to HSIL. Follow HSIL pathway; treatment recommended.",
      recommendationCode: "F5-MDM-UPGRADED-HSIL-TREAT",
      nextAction: "Follow HSIL pathway and arrange treatment.",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P2",
      referralReason: "MDM upgraded cytology to HSIL",
      guidelineReference: "Figure 5 - upgraded to HSIL",
      rationale: "The supplied Figure 5 routes upgraded HSIL to the HSIL pathway and treatment.",
      branchPath: ["FIGURE_5", "MDM", "UPGRADED_HSIL", "TREATMENT_RECOMMENDED"],
    });
  }

  if (mdmOutcome === "CONFIRMED_ASC_H") {
    if (input.hpvResult === "NOT_DETECTED" && input.visibleLesion === false) {
      return withDefaults({
        figure: "FIGURE_5",
        riskLevel: "LOW",
        recommendation: "Confirmed ASC-H with HPV not detected and no visible lesion. Test of Cure/co-testing pathway.",
        recommendationCode: "F5-CONFIRMED-ASCH-HPV-NEG-NO-LESION-TOC",
        nextAction: "Arrange Test of Cure/co-testing.",
        guidelineReference: "Figure 5 - confirmed ASC-H, HPV not detected/no lesion",
        rationale: "The supplied Figure 5 routes this branch to Test of Cure/co-testing.",
        branchPath: ["FIGURE_5", "CONFIRMED_ASC_H", "HPV_NOT_DETECTED", "NO_VISIBLE_LESION", "TEST_OF_CURE"],
      });
    }

    if (
      isHpvDetected(input.hpvResult) &&
      input.cytologyResult === "NEGATIVE" &&
      (input.normalColposcopy || input.colposcopicImpression === "NORMAL") &&
      input.visibleLesion !== true
    ) {
      return withDefaults({
        figure: "FIGURE_5",
        riskLevel: "MEDIUM",
        recommendation: "Confirmed ASC-H with HPV detected, normal colposcopy, and negative cytology. Repeat colposcopy, HPV, and cytology in 12 months.",
        recommendationCode: "F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M",
        nextAction: "Repeat colposcopy, HPV, and cytology in 12 months.",
        recallRequired: true,
        recallIntervalMonths: 12,
        guidelineReference: "Figure 5 - confirmed ASC-H follow-up",
        rationale: "The supplied Figure 5 routes this specific branch to repeat colposcopy/HPV/cytology in 12 months.",
        branchPath: ["FIGURE_5", "CONFIRMED_ASC_H", "HPV_DETECTED", "NORMAL_COLPOSCOPY", "NEGATIVE_CYTOLOGY", "REPEAT_12M"],
      });
    }

    if (isHpvDetected(input.hpvResult) || (input.cytologyResult && input.cytologyResult !== "NEGATIVE") || input.visibleLesion) {
      return withDefaults({
        figure: "FIGURE_5",
        riskLevel: "HIGH",
        recommendation: "Confirmed ASC-H with abnormal cytology, HPV detected, and/or visible lesion. Treatment recommended; consider type 2 excision TZ.",
        recommendationCode: "F5-CONFIRMED-ASCH-TREAT",
        nextAction: "Recommend treatment; consider type 2 excision TZ.",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P2",
        referralReason: "Confirmed ASC-H with treatment branch criteria",
        guidelineReference: "Figure 5 - confirmed ASC-H treatment branch",
        rationale: "The supplied Figure 5 routes abnormal cytology, HPV detected, and/or visible lesion to treatment recommendation.",
        branchPath: ["FIGURE_5", "CONFIRMED_ASC_H", "TREATMENT_RECOMMENDED"],
      });
    }

    return insufficient("FIGURE_5", "F5-CONFIRMED-ASCH-RESULTS-REQUIRED", ["hpvResult", "cytologyResult", "visibleLesion"], "Enter HPV/cytology/visible lesion facts for confirmed ASC-H branch");
  }

  return clinicianReview("FIGURE_5", "F5-MDM-OUTCOME-UNMAPPED", "The Figure 5 MDM outcome is not one of the supplied source outcomes.", "Use a source-supported MDM outcome or clinician review.");
}

function evaluateFigure6(input: ClinicalInput): ClinicalDecision {
  if (!input.hpvResult || !input.cytologyResult) {
    return insufficient("FIGURE_6", "F6-COTEST-REQUIRED", ["hpvResult", "cytologyResult"], "Enter HPV and cytology results for Test of Cure");
  }

  const treatmentDateMissing = input.treatmentDate ? [] : ["treatmentDate"];

  if (isHpvDetected(input.hpvResult)) {
    return withDefaults({
      figure: "FIGURE_6",
      riskLevel: "HIGH",
      recommendation: "Test of Cure HPV detected any type with any cytology. Refer to colposcopy.",
      recommendationCode: "F6-HPV-DETECTED-ANY-CYTOLOGY-COLP",
      nextAction: "Refer to colposcopy.",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: input.hpvResult === "HPV_16_18" || isHighGradeCytology(input.cytologyResult) ? "P1" : "P2",
      referralReason: "HPV detected during Test of Cure",
      missingInformation: treatmentDateMissing.length ? treatmentDateMissing : undefined,
      guidelineReference: "Figure 6 - HPV detected any cytology",
      rationale: "The supplied Figure 6 routes HPV detected with any cytology during Test of Cure to colposcopy.",
      branchPath: ["FIGURE_6", "HPV_DETECTED_ANY_TYPE", "ANY_CYTOLOGY", "COLPOSCOPY"],
    });
  }

  if (input.hpvResult === "NOT_DETECTED" && input.cytologyResult === "NEGATIVE") {
    const secondNegative =
      input.testOfCureStage === "SECOND_TEST" ||
      input.testOfCureStatus === "COMPLETE" ||
      input.testOfCureStatus === "SUCCESSFULLY_COMPLETED" ||
      input.consecutiveNegativeCoTestCount >= 1;
    if (secondNegative) {
      return returnToScreening("FIGURE_6", "F6-SECOND-NEGATIVE-RETURN-REGULAR", input.immunocompromised, "Second negative Test of Cure co-test. Return to regular screening.");
    }
    return withDefaults({
      figure: "FIGURE_6",
      riskLevel: "LOW",
      recommendation: "First negative Test of Cure co-test. Repeat cytology and HPV testing in 12 months.",
      recommendationCode: "F6-FIRST-NEGATIVE-REPEAT-12M",
      nextAction: "Repeat cytology and HPV testing in 12 months.",
      recallRequired: true,
      recallIntervalMonths: 12,
      incrementConsecutiveNegative: true,
      missingInformation: treatmentDateMissing.length ? treatmentDateMissing : undefined,
      guidelineReference: "Figure 6 - first negative co-test",
      rationale: "The supplied Figure 6 requires a second co-test after the first HPV-not-detected/cytology-negative result.",
      branchPath: ["FIGURE_6", "FIRST_NEGATIVE_COTEST", "REPEAT_12M"],
    });
  }

  if (input.hpvResult === "NOT_DETECTED" && isHighGradeCytology(input.cytologyResult)) {
    return withDefaults({
      figure: "FIGURE_6",
      riskLevel: "HIGH",
      recommendation: "Test of Cure HPV not detected but cytology possible/definite high-grade. Refer to colposcopy.",
      recommendationCode: "F6-HPV-NEG-HIGH-GRADE-COLP",
      nextAction: "Refer to colposcopy.",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P1",
      referralReason: "High-grade cytology during Test of Cure",
      missingInformation: treatmentDateMissing.length ? treatmentDateMissing : undefined,
      guidelineReference: "Figure 6 - cytology possible/definite high-grade",
      rationale: "The supplied Figure 6 routes possible/definite high-grade cytology to colposcopy.",
      branchPath: ["FIGURE_6", "HPV_NOT_DETECTED", "HIGH_GRADE_CYTOLOGY", "COLPOSCOPY"],
    });
  }

  if (input.hpvResult === "NOT_DETECTED" && isLowGradeCytology(input.cytologyResult)) {
    return withDefaults({
      figure: "FIGURE_6",
      riskLevel: "MEDIUM",
      recommendation: "Test of Cure HPV not detected with low-grade cytology. Repeat cytology and HPV testing in 12 months.",
      recommendationCode: "F6-HPV-NEG-LOW-GRADE-REPEAT-12M",
      nextAction: "Repeat cytology and HPV testing in 12 months.",
      recallRequired: true,
      recallIntervalMonths: 12,
      missingInformation: treatmentDateMissing.length ? treatmentDateMissing : undefined,
      guidelineReference: "Figure 6 - low-grade cytology",
      rationale: "The supplied Figure 6 routes low-grade cytology to repeat testing.",
      branchPath: ["FIGURE_6", "HPV_NOT_DETECTED", "LOW_GRADE_CYTOLOGY", "REPEAT_12M"],
    });
  }

  return clinicianReview("FIGURE_6", "F6-UNMAPPED-CYTOLOGY", "The Test of Cure cytology result is not mapped by the supplied Figure 6.", "Review cytology category.");
}

function evaluateFigure7(input: ClinicalInput): ClinicalDecision {
  const cytology = input.cytologyResult;

  if (cytology === "AG2" || cytology === "AC2" || input.atypicalEndometrialHistory) {
    return withDefaults({
      figure: "FIGURE_7",
      riskLevel: "HIGH",
      recommendation: `${cytology === "AC2" ? "AC2" : "AG2"} glandular abnormality. Refer to gynaecology.`,
      recommendationCode: cytology === "AC2" ? "F7-AC2-GYNAECOLOGY" : "F7-AG2-GYNAECOLOGY",
      nextAction: "Refer to gynaecology; do not route to colposcopy for this branch.",
      referralRequired: true,
      referralType: "GYNAECOLOGY",
      referralPriority: "P1",
      referralReason: "AG2/AC2 direct gynaecology branch in Figure 7",
      guidelineReference: "Figure 7 - AG2/AC2",
      rationale: "The supplied Figure 7 routes AG2 and AC2 directly to gynaecology.",
      branchPath: ["FIGURE_7", cytology === "AC2" ? "AC2" : "AG2", "GYNAECOLOGY"],
    });
  }

  const supportedColposcopyEntry = ["AG1", "AG3", "AG4", "AG5", "AC1", "AC3", "AC4"].includes(cytology ?? "");
  const hasColpoContext = input.visibleLesion !== undefined || input.colposcopicImpression !== undefined || input.normalColposcopy;

  if (supportedColposcopyEntry && !hasColpoContext) {
    return withDefaults({
      figure: "FIGURE_7",
      riskLevel: "HIGH",
      recommendation: "Glandular abnormality requires colposcopy.",
      recommendationCode: "F7-GLANDULAR-COLPOSCOPY",
      nextAction: "Refer to colposcopy.",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: cytology === "AG1" || cytology === "AC1" ? "P2" : "P1",
      referralReason: "Figure 7 glandular abnormality routed to colposcopy",
      guidelineReference: "Figure 7 - glandular abnormalities",
      rationale: "The supplied Figure 7 routes AG1, AG3-AG5, AC1, AC3, and AC4 to colposcopy.",
      branchPath: ["FIGURE_7", cytology ?? "GLANDULAR", "COLPOSCOPY"],
    });
  }

  const visibleLesion = input.visibleLesion;

  if (visibleLesion === undefined) {
    return insufficient("FIGURE_7", "F7-VISIBLE-LESION-REQUIRED", ["visibleLesion"], "Enter whether a visible lesion is present at colposcopy");
  }

  if (visibleLesion) {
    if (!input.biopsyResult) {
      return withDefaults({
        figure: "FIGURE_7",
        riskLevel: "HIGH",
        recommendation: "Visible lesion in glandular abnormality pathway. Biopsy is required.",
        recommendationCode: "F7-VISIBLE-LESION-BIOPSY",
        nextAction: "Perform biopsy and enter result.",
        guidelineReference: "Figure 7 - visible lesion",
        rationale: "The supplied Figure 7 routes visible lesions to biopsy.",
        branchPath: ["FIGURE_7", "VISIBLE_LESION", "BIOPSY_REQUIRED"],
      });
    }
    if (input.biopsyResult === "AIS") {
      return withDefaults({
        figure: "FIGURE_7",
        riskLevel: "HIGH",
        recommendation: "Biopsy shows AIS. Type 3 excision is required.",
        recommendationCode: "F7-BIOPSY-AIS-TYPE3-EXCISION",
        nextAction: "Arrange type 3 excision.",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P1",
        referralReason: "AIS on biopsy in Figure 7",
        guidelineReference: "Figure 7 - biopsy AIS",
        rationale: "The supplied Figure 7 routes AIS biopsy to type 3 excision.",
        branchPath: ["FIGURE_7", "VISIBLE_LESION", "BIOPSY_AIS", "TYPE_3_EXCISION"],
      });
    }
    if (input.biopsyResult === "SCC" || input.biopsyResult === "ADENOCARCINOMA" || input.biopsyPositiveForInvasion) {
      return withDefaults({
        figure: "FIGURE_7",
        riskLevel: "URGENT",
        recommendation: "Biopsy is consistent with cancer. Refer to gynaecological oncologist.",
        recommendationCode: "F7-BIOPSY-CANCER-ONCOLOGY",
        nextAction: "Refer to gynaecological oncologist.",
        referralRequired: true,
        referralType: "SPECIALIST",
        referralPriority: "P1",
        referralReason: "Cancer on biopsy in Figure 7",
        guidelineReference: "Figure 7 - biopsy consistent with cancer",
        rationale: "The supplied Figure 7 routes biopsy consistent with cancer to gynaecological oncology.",
        branchPath: ["FIGURE_7", "VISIBLE_LESION", "BIOPSY_CANCER", "GYNAE_ONCOLOGY"],
      });
    }
    return clinicianReview("FIGURE_7", "F7-BIOPSY-RESULT-OUTSIDE-SOURCE", "The supplied Figure 7 only specifies AIS or cancer outcomes after visible-lesion biopsy.", "Clinician review required for this biopsy result.");
  }

  if (!input.mdmOutcome) {
    return withDefaults({
      figure: "FIGURE_7",
      riskLevel: "HIGH",
      recommendation: "No visible lesion in glandular abnormality pathway. MDM case review is required.",
      recommendationCode: "F7-NO-LESION-MDM",
      nextAction: "Complete MDM case review.",
      requiresMDMReview: true,
      guidelineReference: "Figure 7 - no visible lesion",
      rationale: "The supplied Figure 7 routes no visible lesion to MDM case review.",
      branchPath: ["FIGURE_7", "NO_VISIBLE_LESION", "MDM_REQUIRED"],
    });
  }

  if (input.mdmOutcome === "CYTOLOGY_CONFIRMED_NOT_AG2") {
    return withDefaults({
      figure: "FIGURE_7",
      riskLevel: "HIGH",
      recommendation: "MDM confirmed cytology and it is not AG2. Type 3 excision is required.",
      recommendationCode: "F7-MDM-CONFIRMED-NOT-AG2-TYPE3",
      nextAction: "Arrange type 3 excision.",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P1",
      referralReason: "MDM confirmed non-AG2 glandular cytology",
      guidelineReference: "Figure 7 - MDM cytology confirmed not AG2",
      rationale: "The supplied Figure 7 routes confirmed non-AG2 cytology to type 3 excision.",
      branchPath: ["FIGURE_7", "NO_VISIBLE_LESION", "MDM_CONFIRMED_NOT_AG2", "TYPE_3_EXCISION"],
    });
  }

  if (input.mdmOutcome === "AG2_CYTOLOGY_CONFIRMED") {
    return withDefaults({
      figure: "FIGURE_7",
      riskLevel: "HIGH",
      recommendation: "MDM confirmed AG2 cytology. Investigate further for other gynaecological malignancies.",
      recommendationCode: "F7-MDM-AG2-INVESTIGATE-MALIGNANCIES",
      nextAction: "Investigate for other gynaecological malignancies.",
      referralRequired: true,
      referralType: "GYNAECOLOGY",
      referralPriority: "P1",
      referralReason: "MDM confirmed AG2 cytology",
      guidelineReference: "Figure 7 - MDM AG2 confirmed",
      rationale: "The supplied Figure 7 routes confirmed AG2 to further gynaecological malignancy investigation.",
      branchPath: ["FIGURE_7", "NO_VISIBLE_LESION", "MDM_AG2_CONFIRMED", "INVESTIGATE_MALIGNANCIES"],
    });
  }

  if (input.mdmOutcome === "CYTOLOGY_NOT_CONFIRMED") {
    return withDefaults({
      figure: "FIGURE_7",
      riskLevel: "MEDIUM",
      recommendation: "MDM did not confirm cytology. Repeat colposcopy in 6 months.",
      recommendationCode: "F7-MDM-CYTOLOGY-NOT-CONFIRMED-6M",
      nextAction: "Repeat colposcopy in 6 months.",
      recallRequired: true,
      recallIntervalMonths: 6,
      guidelineReference: "Figure 7 - MDM cytology not confirmed",
      rationale: "The supplied Figure 7 routes cytology not confirmed to repeat colposcopy in 6 months.",
      branchPath: ["FIGURE_7", "NO_VISIBLE_LESION", "MDM_CYTOLOGY_NOT_CONFIRMED", "REPEAT_COLPOSCOPY_6M"],
    });
  }

  return clinicianReview("FIGURE_7", "F7-MDM-OUTCOME-UNMAPPED", "The MDM outcome is not one of the supplied Figure 7 outcomes.", "Use a source-supported MDM outcome or clinician review.");
}

function highGradeSpecimen(pathology?: string): boolean {
  return pathology === "HSIL_CIN23" || pathology === "AIS";
}

function lowOrNoPathology(pathology?: string): boolean {
  return pathology === "NO_CERVICAL_PATHOLOGY" || pathology === "NORMAL" || pathology === "LSIL_CIN1";
}

function hysterectomyHighGradeOutcome(input: ClinicalInput, figure: PathwayFigure): ClinicalDecision {
  if (input.excisionStatus === "COMPLETE") {
    return withDefaults({
      figure,
      riskLevel: "HIGH",
      recommendation: "HSIL/CIN2/3 or AIS completely excised in hysterectomy specimen. Test of Cure is required.",
      recommendationCode: `${figure === "TABLE_1" ? "T1" : "F8"}-HSIL-AIS-COMPLETE-TOC`,
      nextAction: "Start or continue Test of Cure pathway.",
      guidelineReference: `${figure} - complete excision`,
      rationale: "The supplied Figure 8/Table 1 routes completely excised HSIL/CIN2/3 or AIS to Test of Cure.",
      branchPath: [figure, "HSIL_AIS", "COMPLETE_EXCISION", "TEST_OF_CURE"],
    });
  }
  if (input.excisionStatus === "INCOMPLETE") {
    return withDefaults({
      figure,
      riskLevel: "HIGH",
      recommendation: "HSIL/CIN2/3 or AIS incompletely excised in hysterectomy specimen. Colposcopy is required.",
      recommendationCode: `${figure === "TABLE_1" ? "T1" : "F8"}-HSIL-AIS-INCOMPLETE-COLP`,
      nextAction: "Refer to colposcopy.",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P2",
      referralReason: "Incompletely excised HSIL/CIN2/3 or AIS after hysterectomy",
      guidelineReference: `${figure} - incomplete excision`,
      rationale: "The supplied Figure 8/Table 1 routes incompletely excised HSIL/CIN2/3 or AIS to colposcopy.",
      branchPath: [figure, "HSIL_AIS", "INCOMPLETE_EXCISION", "COLPOSCOPY"],
    });
  }
  return insufficient(figure, `${figure === "TABLE_1" ? "T1" : "F8"}-EXCISION-STATUS-REQUIRED`, ["excisionStatus"], "Enter complete/incomplete excision status for HSIL/CIN2/3 or AIS specimen pathology");
}

function evaluateHysterectomyPathway(input: ClinicalInput, figure: PathwayFigure): ClinicalDecision {
  const prefix = figure === "TABLE_1" ? "T1" : "F8";

  if (input.hysterectomyType === "SUBTOTAL") {
    return withDefaults({
      figure,
      riskLevel: "MEDIUM",
      recommendation: "Subtotal hysterectomy confirmed; cervix remains. Use standard primary HPV screening pathway.",
      recommendationCode: `${prefix}-SUBTOTAL-FIG3`,
      nextAction: "Proceed to Figure 3 primary HPV screening.",
      guidelineReference: `${figure} - subtotal hysterectomy`,
      rationale: "Figure 8/Table 1 apply to total hysterectomy. Subtotal hysterectomy retains the cervix.",
      branchPath: [figure, "SUBTOTAL_HYSTERECTOMY", "FIGURE_3"],
    });
  }

  if (input.postHysterectomyHpvTestIndicated && input.hpvResult) {
    if (input.hpvResult === "NOT_DETECTED") {
      return withDefaults({
        figure,
        riskLevel: "LOW",
        recommendation: "Post-hysterectomy HPV test not detected. No further screening required for this branch.",
        recommendationCode: `${prefix}-POST-HYST-HPV-NOT-DETECTED-NO-FURTHER`,
        nextAction: "No further screening required; document source branch and history.",
        guidelineReference: `${figure} - post-hysterectomy HPV not detected`,
        rationale: "The supplied Figure 8 routes HPV not detected after the indicated post-hysterectomy HPV test to no further screening.",
        branchPath: [figure, "POST_HYSTERECTOMY_HPV_TEST", "HPV_NOT_DETECTED", "NO_FURTHER_SCREENING"],
      });
    }
    if (isHpvDetected(input.hpvResult)) {
      return withDefaults({
        figure,
        riskLevel: "MEDIUM",
        recommendation: "Post-hysterectomy HPV detected any type. Follow primary HPV pathway Figure 3.",
        recommendationCode: `${prefix}-POST-HYST-HPV-DETECTED-FIG3`,
        nextAction: "Follow Figure 3 primary HPV pathway using the HPV/cytology result.",
        guidelineReference: `${figure} - post-hysterectomy HPV detected`,
        rationale: "The supplied Figure 8 routes HPV detected after the indicated post-hysterectomy HPV test to Figure 3.",
        branchPath: [figure, "POST_HYSTERECTOMY_HPV_TEST", "HPV_DETECTED_ANY_TYPE", "FIGURE_3"],
      });
    }
  }

  if (!input.priorScreeningHistory || !input.hysterectomySpecimenPathology) {
    return insufficient(
      figure,
      `${prefix}-HYSTERECTOMY-HISTORY-REQUIRED`,
      ["priorScreeningHistory", "hysterectomySpecimenPathology"],
      "Enter validated prior screening history and hysterectomy specimen pathology",
      ["NCSR and hysterectomy histology report"]
    );
  }

  const history = input.priorScreeningHistory;
  const pathology = input.hysterectomySpecimenPathology;

  if (
    history === "NEGATIVE_OR_NORMAL" ||
    history === "LOW_GRADE_RETURNED_TO_REGULAR" ||
    history === "LOW_GRADE_ONLY" ||
    history === "HIGH_GRADE_TOC_COMPLETE"
  ) {
    if (pathology === "NO_CERVICAL_PATHOLOGY" || pathology === "NORMAL") {
      if (input.screeningHistoryKnown === false) {
        return withDefaults({
          figure,
          riskLevel: "MEDIUM",
          recommendation: "Screening history is unknown with no cervical pathology. HPV test is required.",
          recommendationCode: `${prefix}-UNKNOWN-HISTORY-HPV-TEST`,
          nextAction: "Perform HPV test; if HPV not detected no further screening, if HPV detected follow Figure 3.",
          guidelineReference: `${figure} - unknown history/no pathology`,
          rationale: "The supplied Figure 8 requires HPV testing when screening history is not known.",
          branchPath: [figure, "UNKNOWN_HISTORY", "NO_PATHOLOGY", "HPV_TEST"],
        });
      }
      return withDefaults({
        figure,
        riskLevel: "LOW",
        recommendation: "Known negative/returned-regular history with no cervical pathology. No further screening required.",
        recommendationCode: `${prefix}-KNOWN-HISTORY-NO-PATHOLOGY-NO-FURTHER`,
        nextAction: "No further screening required.",
        guidelineReference: `${figure} - no cervical pathology`,
        rationale: "The supplied Figure 8/Table 1 route this branch to no further screening.",
        branchPath: [figure, "KNOWN_HISTORY", "NO_CERVICAL_PATHOLOGY", "NO_FURTHER_SCREENING"],
      });
    }
    if (pathology === "LSIL_CIN1") {
      return withDefaults({
        figure,
        riskLevel: "MEDIUM",
        recommendation: "LSIL/CIN1 in hysterectomy specimen. HPV test and follow Figure 3.",
        recommendationCode: `${prefix}-LSIL-CIN1-HPV-FIG3`,
        nextAction: "Perform HPV test and follow Figure 3.",
        guidelineReference: `${figure} - LSIL/CIN1 specimen`,
        rationale: "The supplied Figure 8/Table 1 route LSIL/CIN1 specimen pathology to HPV testing/Figure 3.",
        branchPath: [figure, "LSIL_CIN1", "HPV_TEST", "FIGURE_3"],
      });
    }
    if (highGradeSpecimen(pathology)) return hysterectomyHighGradeOutcome(input, figure);
  }

  if (history === "LOW_GRADE_NOT_RETURNED_TO_REGULAR") {
    if (lowOrNoPathology(pathology)) {
      return withDefaults({
        figure,
        riskLevel: "MEDIUM",
        recommendation: "Previous low-grade history not returned to regular screening with normal/LSIL specimen. HPV test and follow Figure 3.",
        recommendationCode: `${prefix}-LOW-GRADE-NOT-RETURNED-HPV-FIG3`,
        nextAction: "Perform HPV test and follow Figure 3.",
        guidelineReference: `${figure} - low-grade not returned`,
        rationale: "The supplied Figure 8/Table 1 route this branch to HPV testing/Figure 3.",
        branchPath: [figure, "LOW_GRADE_NOT_RETURNED", "NORMAL_OR_LSIL", "HPV_TEST_FIGURE_3"],
      });
    }
    if (highGradeSpecimen(pathology)) return hysterectomyHighGradeOutcome(input, figure);
  }

  if (
    history === "HIGH_GRADE_TOC_INCOMPLETE" ||
    history === "HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED" ||
    input.testOfCureStatus === "INCOMPLETE"
  ) {
    if (lowOrNoPathology(pathology)) {
      return withDefaults({
        figure,
        riskLevel: "HIGH",
        recommendation: "Untreated/incomplete Test of Cure high-grade history with no/low-grade specimen pathology. Continue Test of Cure until successful completion.",
        recommendationCode: `${prefix}-INCOMPLETE-TOC-LOW-PATHOLOGY-TOC`,
        nextAction: "Continue Test of Cure until successful completion.",
        guidelineReference: `${figure} - incomplete Test of Cure`,
        rationale: "The supplied Figure 8/Table 1 route this branch to Test of Cure until successful completion.",
        branchPath: [figure, "INCOMPLETE_TOC_OR_UNTREATED_HSIL_AIS", "NO_OR_LOW_GRADE_PATHOLOGY", "TEST_OF_CURE"],
      });
    }
    if (highGradeSpecimen(pathology)) return hysterectomyHighGradeOutcome(input, figure);
  }

  if (history === "NO_KNOWN_SCREENING_HISTORY") {
    if (lowOrNoPathology(pathology)) {
      return withDefaults({
        figure,
        riskLevel: "MEDIUM",
        recommendation: "No known screening history with no/low-grade specimen pathology. HPV test at 6 months post hysterectomy.",
        recommendationCode: `${prefix}-NO-KNOWN-HISTORY-HPV-6M`,
        nextAction: "Schedule HPV test at 6 months post hysterectomy.",
        recallRequired: true,
        recallIntervalMonths: 6,
        missingInformation: input.hysterectomyDate ? undefined : ["hysterectomyDate"],
        guidelineReference: "Table 1 - no known screening history",
        rationale: "The supplied Table 1 routes no known screening history with no/low-grade specimen pathology to HPV at 6 months post hysterectomy.",
        branchPath: [figure, "NO_KNOWN_SCREENING_HISTORY", "NO_OR_LOW_GRADE_PATHOLOGY", "HPV_6M_POST_HYSTERECTOMY"],
      });
    }
    if (highGradeSpecimen(pathology)) return hysterectomyHighGradeOutcome(input, figure);
  }

  return clinicianReview(figure, `${prefix}-UNMAPPED-HYSTERECTOMY-BRANCH`, "The hysterectomy history/specimen combination is not mapped by Figure 8/Table 1.", "Review prior history, indication, specimen pathology, and excision status.");
}

function evaluateFigure8(input: ClinicalInput): ClinicalDecision {
  return evaluateHysterectomyPathway(input, "FIGURE_8");
}

function evaluateFigure9(input: ClinicalInput): ClinicalDecision {
  if (!input.isPregnant) {
    return insufficient("FIGURE_9", "F9-PREGNANCY-REQUIRED", ["isPregnant"], "Confirm pregnancy status");
  }
  if (!isPregnancyQualifyingCytology(input.cytologyResult)) {
    return insufficient("FIGURE_9", "F9-QUALIFYING-CYTOLOGY-REQUIRED", ["ASC-H, HSIL, atypical glandular cells, or AIS cytology"], "Figure 9 applies only to pregnant participants with qualifying cytology");
  }

  const hasColpoAssessment =
    input.colposcopicImpression !== undefined ||
    input.visibleLesion !== undefined ||
    input.transformationZoneState !== undefined ||
    input.normalColposcopy;

  if (!hasColpoAssessment) {
    return withDefaults({
      figure: "FIGURE_9",
      riskLevel: "HIGH",
      recommendation: "Pregnant participant with qualifying high-grade/glandular cytology. Initial action is colposcopy.",
      recommendationCode: "F9-INITIAL-COLPOSCOPY",
      nextAction: "Arrange colposcopy.",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P1",
      referralReason: "Pregnancy with ASC-H/HSIL/glandular/AIS cytology",
      guidelineReference: "Figure 9 - initial colposcopy",
      rationale: "The supplied Figure 9 begins with colposcopy.",
      branchPath: ["FIGURE_9", "PREGNANT_QUALIFYING_CYTOLOGY", "INITIAL_COLPOSCOPY"],
    });
  }

  const normalTzOrNoLesion =
    input.transformationZoneState === "NORMAL" ||
    input.visibleLesion === false ||
    input.normalColposcopy ||
    input.colposcopicImpression === "NORMAL";

  if (normalTzOrNoLesion) {
    if (input.mdmOutcome === "DOWNGRADED_NEGATIVE") {
      return withDefaults({
        figure: "FIGURE_9",
        riskLevel: "LOW",
        recommendation: "MDM downgraded cytology to negative. Follow HPV primary screening pathway Figure 3.",
        recommendationCode: "F9-MDM-DOWNGRADED-NEGATIVE-FIG3",
        nextAction: "Follow Figure 3.",
        guidelineReference: "Figure 9 - MDM downgraded negative",
        rationale: "The supplied Figure 9 routes downgraded negative to Figure 3.",
        branchPath: ["FIGURE_9", "NORMAL_TZ_NO_LESION", "MDM_DOWNGRADED_NEGATIVE", "FIGURE_3"],
      });
    }
    if (input.mdmOutcome === "DOWNGRADED_LSIL" || input.mdmOutcome === "DOWNGRADED_ASC_US_LSIL") {
      return withDefaults({
        figure: "FIGURE_9",
        riskLevel: "MEDIUM",
        recommendation: "MDM downgraded to LSIL/ASC-US. Follow LSIL pathway.",
        recommendationCode: "F9-MDM-DOWNGRADED-LSIL",
        nextAction: "Follow the LSIL pathway.",
        guidelineReference: "Figure 9 - MDM downgraded LSIL/ASC-US",
        rationale: "The supplied Figure 9 routes downgraded LSIL/ASC-US to the LSIL pathway.",
        branchPath: ["FIGURE_9", "NORMAL_TZ_NO_LESION", "MDM_DOWNGRADED_LSIL", "LSIL_PATHWAY"],
      });
    }
    if (input.mdmOutcome === "CONFIRMED_HIGH_GRADE") {
      return withDefaults({
        figure: "FIGURE_9",
        riskLevel: "HIGH",
        recommendation: "MDM confirmed possible/definite high-grade. Colposcopy review in 6 months or at 6-12 weeks postpartum.",
        recommendationCode: "F9-MDM-CONFIRMED-HIGH-GRADE-REVIEW",
        nextAction: "Schedule colposcopy review in 6 months or at 6-12 weeks postpartum.",
        recallRequired: true,
        recallIntervalMonths: 6,
        missingInformation: input.expectedDeliveryDate ? undefined : ["expectedDeliveryDate if postpartum timing is chosen"],
        guidelineReference: "Figure 9 - MDM confirmed high grade",
        rationale: "The supplied Figure 9 routes confirmed high-grade in pregnancy to colposcopy review timing.",
        branchPath: ["FIGURE_9", "NORMAL_TZ_NO_LESION", "MDM_CONFIRMED_HIGH_GRADE", "COLPOSCOPY_REVIEW"],
      });
    }
    return withDefaults({
      figure: "FIGURE_9",
      riskLevel: "HIGH",
      recommendation: "Normal TZ/no visible lesion. MDM case review is required.",
      recommendationCode: "F9-NORMAL-TZ-MDM",
      nextAction: "Complete MDM case review.",
      requiresMDMReview: true,
      guidelineReference: "Figure 9 - normal TZ",
      rationale: "The supplied Figure 9 routes normal TZ/no visible lesion to MDM.",
      branchPath: ["FIGURE_9", "NORMAL_TZ_NO_LESION", "MDM_REQUIRED"],
    });
  }

  if (input.colposcopicImpression === "INVASION") {
    if (!input.biopsyResult && input.biopsyPositiveForInvasion === undefined) {
      return withDefaults({
        figure: "FIGURE_9",
        riskLevel: "URGENT",
        recommendation: "Invasion suspected on colposcopic impression. Biopsy is required before oncology routing.",
        recommendationCode: "F9-INVASION-IMPRESSION-BIOPSY",
        nextAction: "Perform biopsy to confirm or exclude invasion.",
        guidelineReference: "Figure 9 - invasion impression",
        rationale: "The supplied Figure 9 routes invasion impression to biopsy before downstream decision.",
        branchPath: ["FIGURE_9", "ABNORMAL_TZ", "INVASION_IMPRESSION", "BIOPSY_REQUIRED"],
      });
    }
    if (input.biopsyPositiveForInvasion || input.biopsyResult === "SCC" || input.biopsyResult === "ADENOCARCINOMA") {
      return withDefaults({
        figure: "FIGURE_9",
        riskLevel: "URGENT",
        recommendation: "Biopsy positive for invasion. Refer to Gynaecological Oncologist.",
        recommendationCode: "F9-BIOPSY-POSITIVE-INVASION-ONCOLOGY",
        nextAction: "Refer to Gynaecological Oncologist.",
        referralRequired: true,
        referralType: "SPECIALIST",
        referralPriority: "P1",
        referralReason: "Pregnancy pathway biopsy positive for invasion",
        guidelineReference: "Figure 9 - biopsy positive for invasion",
        rationale: "The supplied Figure 9 routes biopsy positive for invasion to gynaecological oncology.",
        branchPath: ["FIGURE_9", "INVASION_IMPRESSION", "BIOPSY_POSITIVE", "GYNAE_ONCOLOGY"],
      });
    }
    return withDefaults({
      figure: "FIGURE_9",
      riskLevel: "HIGH",
      recommendation: "Biopsy negative for invasion. MDM case review is required.",
      recommendationCode: "F9-BIOPSY-NEGATIVE-INVASION-MDM",
      nextAction: "Complete MDM case review.",
      requiresMDMReview: true,
      guidelineReference: "Figure 9 - biopsy negative for invasion",
      rationale: "The supplied Figure 9 routes biopsy negative for invasion to MDM case review.",
      branchPath: ["FIGURE_9", "INVASION_IMPRESSION", "BIOPSY_NEGATIVE", "MDM"],
    });
  }

  if (["LSIL", "HSIL", "AIS"].includes(input.colposcopicImpression ?? "")) {
    return withDefaults({
      figure: "FIGURE_9",
      riskLevel: "HIGH",
      recommendation: "Abnormal TZ/visible lesion with LSIL, HSIL/CIN2/3, or AIS impression. Colposcopy review in 6 months or at 6-12 weeks postpartum.",
      recommendationCode: "F9-ABNORMAL-TZ-REVIEW",
      nextAction: "Schedule colposcopy review in 6 months or at 6-12 weeks postpartum.",
      recallRequired: true,
      recallIntervalMonths: 6,
      missingInformation: input.expectedDeliveryDate ? undefined : ["expectedDeliveryDate if postpartum timing is chosen"],
      guidelineReference: "Figure 9 - abnormal TZ impression",
      rationale: "The supplied Figure 9 routes LSIL/HSIL/AIS impression to colposcopy review timing.",
      branchPath: ["FIGURE_9", "ABNORMAL_TZ", input.colposcopicImpression ?? "IMPRESSION", "COLPOSCOPY_REVIEW"],
    });
  }

  return clinicianReview("FIGURE_9", "F9-UNMAPPED-COLPOSCOPY-STATE", "The pregnancy colposcopy state is not mapped by the supplied Figure 9.", "Review normal/abnormal TZ, lesion, impression, biopsy, and MDM state.");
}

function evaluateFigure10(input: ClinicalInput): ClinicalDecision {
  if (input.hasCancerSymptoms) {
    return withDefaults({
      figure: "FIGURE_10",
      riskLevel: "URGENT",
      recommendation: "Signs or symptoms of cervical cancer are present. Refer for gynaecological assessment without delay.",
      recommendationCode: "F10-CANCER-SYMPTOMS-URGENT-GYN",
      nextAction: "Refer for urgent gynaecological assessment without delay.",
      referralRequired: true,
      referralType: "GYNAECOLOGY",
      referralPriority: "P1",
      referralReason: "Signs/symptoms of cervical cancer with abnormal vaginal bleeding",
      guidelineReference: "Figure 10 - cancer symptoms safety exception",
      rationale: "The supplied Figure 10 includes a safety exception for signs/symptoms of cervical cancer.",
      branchPath: ["FIGURE_10", "CANCER_SYMPTOMS", "URGENT_GYNAECOLOGY"],
    });
  }

  const missingInitialFacts = [
    input.bleedingType ? undefined : "bleedingType",
    input.menstrualHistoryCaptured ? undefined : "menstrualHistoryCaptured",
    input.contraceptiveHistoryCaptured ? undefined : "contraceptiveHistoryCaptured",
    input.sexualHistoryCaptured ? undefined : "sexualHistoryCaptured",
    input.speculumExamCompleted ? undefined : "speculumExamCompleted",
    input.pelvicExamCompleted ? undefined : "pelvicExamCompleted",
    input.coTestCompleted ? undefined : "coTestCompleted",
  ].filter(Boolean) as string[];

  if (input.abnormalBleedingStage === "SIX_TO_EIGHT_WEEK_REVIEW") {
    if (input.bleedingResolved === undefined) {
      return insufficient("FIGURE_10", "F10-REVIEW-RESOLUTION-REQUIRED", ["bleedingResolved"], "Enter whether bleeding resolved at 6-8 week review");
    }
    if (input.bleedingResolved) {
      return withDefaults({
        figure: "FIGURE_10",
        riskLevel: "LOW",
        recommendation: "Bleeding resolved at 6-8 week review. Continue regular cervical screening if age >= 25, or commence at age 25.",
        recommendationCode: "F10-REVIEW-RESOLVED-SCREENING",
        nextAction: input.patientAge !== undefined && input.patientAge < 25
          ? "Commence routine cervical screening at age 25."
          : "Continue regular cervical screening.",
        guidelineReference: "Figure 10 - bleeding resolved",
        rationale: "The supplied Figure 10 routes resolved bleeding to regular/age-25 screening, not a hard-coded interval.",
        branchPath: ["FIGURE_10", "SIX_TO_EIGHT_WEEK_REVIEW", "BLEEDING_RESOLVED", "REGULAR_SCREENING_OR_AGE_25"],
      });
    }
    return withDefaults({
      figure: "FIGURE_10",
      riskLevel: "HIGH",
      recommendation: "Bleeding has not resolved at 6-8 week review. Refer to gynaecology.",
      recommendationCode: "F10-REVIEW-UNRESOLVED-GYNAECOLOGY",
      nextAction: "Refer to gynaecology.",
      referralRequired: true,
      referralType: "GYNAECOLOGY",
      referralPriority: "P2",
      referralReason: "Abnormal vaginal bleeding unresolved after 6-8 weeks",
      guidelineReference: "Figure 10 - bleeding unresolved",
      rationale: "The supplied Figure 10 routes unresolved bleeding to gynaecology.",
      branchPath: ["FIGURE_10", "SIX_TO_EIGHT_WEEK_REVIEW", "BLEEDING_NOT_RESOLVED", "GYNAECOLOGY"],
    });
  }

  if (input.abnormalCervix === undefined) {
    return withDefaults({
      figure: "FIGURE_10",
      riskLevel: "MEDIUM",
      recommendation: "Abnormal vaginal bleeding. Complete history, speculum exam, pelvic exam, co-test, and cervix assessment.",
      recommendationCode: "F10-INITIAL-ASSESSMENT",
      nextAction: "Capture menstrual/contraceptive/sexual history; complete speculum and pelvic exam; complete co-test; document cervix appearance.",
      missingInformation: missingInitialFacts.length ? missingInitialFacts : ["abnormalCervix"],
      guidelineReference: "Figure 10 - initial workup",
      rationale: "The supplied Figure 10 starts with full history, speculum/pelvic exam, co-test, and cervix assessment.",
      branchPath: ["FIGURE_10", "INITIAL_ASSESSMENT"],
    });
  }

  if (input.abnormalCervix) {
    if (input.suspicionOfCancer === undefined) {
      return insufficient("FIGURE_10", "F10-SUSPICION-REQUIRED", ["suspicionOfCancer"], "Enter whether there is suspicion of cancer");
    }
    if (input.suspicionOfCancer) {
      return withDefaults({
        figure: "FIGURE_10",
        riskLevel: "URGENT",
        recommendation: "Abnormal cervix with suspicion of cancer. Co-test and colposcopy required.",
        recommendationCode: "F10-ABNORMAL-CERVIX-CANCER-COTEST-COLP",
        nextAction: "Complete co-test and refer to colposcopy.",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P1",
        referralReason: "Abnormal cervix with suspicion of cancer",
        missingInformation: input.coTestCompleted ? undefined : ["coTestCompleted"],
        guidelineReference: "Figure 10 - abnormal cervix suspicion of cancer",
        rationale: "The supplied Figure 10 routes this branch to co-test and colposcopy.",
        branchPath: ["FIGURE_10", "ABNORMAL_CERVIX", "SUSPICION_OF_CANCER", "COTEST_COLPOSCOPY"],
      });
    }
    return withDefaults({
      figure: "FIGURE_10",
      riskLevel: "MEDIUM",
      recommendation: "Abnormal cervix without suspicion of cancer. Treat according to Healthcare Pathways or refer to gynaecology, then review in 6-8 weeks.",
      recommendationCode: "F10-ABNORMAL-CERVIX-NO-CANCER-REVIEW",
      nextAction: "Treat according to Healthcare Pathways or refer to gynaecology; create 6-8 week review.",
      recallRequired: true,
      recallIntervalMonths: 2,
      missingInformation: missingInitialFacts.length ? missingInitialFacts : undefined,
      guidelineReference: "Figure 10 - abnormal cervix no cancer suspicion",
      rationale: "The supplied Figure 10 routes this branch to management and 6-8 week review.",
      branchPath: ["FIGURE_10", "ABNORMAL_CERVIX", "NO_CANCER_SUSPICION", "REVIEW_6_8_WEEKS"],
    });
  }

  if (input.suspectOralContraceptiveProblem === undefined) {
    return insufficient("FIGURE_10", "F10-OCP-STATUS-REQUIRED", ["suspectOralContraceptiveProblem"], "Enter whether an oral contraceptive problem is suspected");
  }
  if (input.suspectOralContraceptiveProblem) {
    return withDefaults({
      figure: "FIGURE_10",
      riskLevel: "MEDIUM",
      recommendation: "Normal cervix with suspected oral contraceptive issue. Adjust oral contraceptive and review in 6-8 weeks.",
      recommendationCode: "F10-OCP-ADJUST-REVIEW",
      nextAction: "Adjust oral contraceptive and create 6-8 week review.",
      recallRequired: true,
      recallIntervalMonths: 2,
      missingInformation: missingInitialFacts.length ? missingInitialFacts : undefined,
      guidelineReference: "Figure 10 - OCP branch",
      rationale: "The supplied Figure 10 routes suspected OCP issue to adjustment and 6-8 week review.",
      branchPath: ["FIGURE_10", "NORMAL_CERVIX", "OCP_SUSPECTED", "REVIEW_6_8_WEEKS"],
    });
  }

  if (input.stiIdentified === undefined) {
    return withDefaults({
      figure: "FIGURE_10",
      riskLevel: "MEDIUM",
      recommendation: "Normal cervix with no suspected OCP issue. Investigations per Healthcare Pathways or consult local gynaecology.",
      recommendationCode: "F10-NORMAL-CERVIX-INVESTIGATE",
      nextAction: "Complete investigations, including STI assessment, per Healthcare Pathways or local gynaecology advice.",
      missingInformation: [...missingInitialFacts, "stiIdentified"].filter(Boolean),
      guidelineReference: "Figure 10 - investigations branch",
      rationale: "The supplied Figure 10 requires investigation before STI branch selection.",
      branchPath: ["FIGURE_10", "NORMAL_CERVIX", "NO_OCP", "INVESTIGATE"],
    });
  }

  if (input.stiIdentified) {
    return withDefaults({
      figure: "FIGURE_10",
      riskLevel: "MEDIUM",
      recommendation: "STI identified. Treat STI and review bleeding in 6-8 weeks.",
      recommendationCode: "F10-STI-TREAT-REVIEW",
      nextAction: "Treat STI and create 6-8 week bleeding review.",
      recallRequired: true,
      recallIntervalMonths: 2,
      missingInformation: missingInitialFacts.length ? missingInitialFacts : undefined,
      guidelineReference: "Figure 10 - STI identified",
      rationale: "The supplied Figure 10 routes STI identified to treatment and 6-8 week review.",
      branchPath: ["FIGURE_10", "NORMAL_CERVIX", "NO_OCP", "STI_IDENTIFIED", "REVIEW_6_8_WEEKS"],
    });
  }

  return withDefaults({
    figure: "FIGURE_10",
    riskLevel: "MEDIUM",
    recommendation: "No STI identified. Manage according to Healthcare Pathways or refer to gynaecology.",
    recommendationCode: "F10-NO-STI-HEALTHCARE-PATHWAYS",
    nextAction: "Manage according to Healthcare Pathways or refer to gynaecology; create 6-8 week review if treated locally.",
    recallRequired: true,
    recallIntervalMonths: 2,
    missingInformation: missingInitialFacts.length ? missingInitialFacts : undefined,
    guidelineReference: "Figure 10 - no STI",
    rationale: "The supplied Figure 10 routes no-STI branch to Healthcare Pathways/local gynaecology management.",
    branchPath: ["FIGURE_10", "NORMAL_CERVIX", "NO_OCP", "NO_STI", "HEALTHCARE_PATHWAYS_OR_GYNAECOLOGY"],
  });
}

function evaluateTable1(input: ClinicalInput): ClinicalDecision {
  return evaluateHysterectomyPathway(input, "TABLE_1");
}

export function evaluateClinicalDecision(input: ClinicalInput): ClinicalDecision {
  if (input.hasAbnormalVaginalBleeding || input.currentFigure === "FIGURE_10") {
    return evaluateFigure10(input);
  }

  if (input.currentFigure === "FIGURE_9" || (input.isPregnant && isPregnancyQualifyingCytology(input.cytologyResult))) {
    return evaluateFigure9(input);
  }

  if (input.currentFigure === "TABLE_1") {
    return evaluateTable1(input);
  }
  if (input.isPostHysterectomy || input.currentFigure === "FIGURE_8") {
    return evaluateFigure8(input);
  }

  if (input.patientAge !== undefined) {
    if (input.patientAge < 25) {
      return withDefaults({
        figure: "FIGURE_3",
        riskLevel: "LOW",
        recommendation: "Patient is under 25 years old. Routine cervical screening does not apply.",
        recommendationCode: "AGE-UNDER-25",
        nextAction: "Do not perform routine screening; investigate symptoms through the appropriate symptomatic pathway.",
        guidelineReference: "Age eligibility",
        rationale: "Age gate applies to routine screening only; symptomatic pathways are routed before this gate.",
      });
    }
    if (input.patientAge >= 75) {
      return withDefaults({
        figure: "FIGURE_3",
        riskLevel: "LOW",
        recommendation: "Patient is 75 or older. Discharge from routine cervical screening programme.",
        recommendationCode: "AGE-75-DISCHARGE",
        nextAction: "Discharge from routine cervical screening; investigate symptoms clinically.",
        guidelineReference: "Age eligibility",
        rationale: "Routine screening exit applies after symptom/hysterectomy/pregnancy routing.",
      });
    }
    if (input.patientAge >= 70) {
      return withDefaults({
        figure: "FIGURE_3",
        riskLevel: "LOW",
        recommendation: "Patient is aged 70-74. Deferred exit from routine screening; offer final HPV screen if not recently tested.",
        recommendationCode: "AGE-70-74-DEFERRED",
        nextAction: "Offer final HPV screen if indicated and discharge at age 75.",
        guidelineReference: "Age eligibility",
        rationale: "Routine screening age gate applies after higher-priority symptomatic/special pathways.",
      });
    }
  }

  if (input.currentFigure === "FIGURE_2") {
    return evaluateFigure2(input);
  }

  if (input.currentFigure === "FIGURE_1") {
    return evaluateFigure1(input);
  }

  if (input.isFirstTimeHPVTransition) {
    const hasFigure2History =
      input.priorHighGradeResult ||
      input.previousHSILCIN23 ||
      input.previousAIS ||
      input.previousAtypicalGlandularCells ||
      input.previousAtypicalEndometrialCells ||
      input.atypicalEndometrialHistory ||
      ["PREVIOUS_AIS", "PREVIOUS_ATYPICAL_GLANDULAR", "PREVIOUS_ATYPICAL_ENDOMETRIAL", "HIGH_GRADE_TOC_INCOMPLETE"].includes(input.priorScreeningHistory ?? "");
    if (hasFigure2History) return evaluateFigure2(input);
    if (isGlandularCytology(input.cytologyResult)) return evaluateFigure7(input);
    return evaluateFigure1(input);
  }

  if (input.isTestOfCure || input.currentFigure === "FIGURE_6" || input.repeatContext === "TEST_OF_CURE") {
    return evaluateFigure6(input);
  }

  if (input.currentFigure === "FIGURE_7" || isGlandularCytology(input.cytologyResult)) {
    return evaluateFigure7(input);
  }

  if (input.currentFigure === "FIGURE_5" || input.repeatContext === "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY") {
    return evaluateFigure5(input);
  }

  if (input.currentFigure === "FIGURE_4" || input.repeatContext === "POST_NORMAL_COLPOSCOPY_LOW_GRADE_CYTOLOGY") {
    return evaluateFigure4(input);
  }

  return evaluateFigure3(input);
}

export {
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
};
