// Consolidated Clinical Decision Engine
// NZ Cervical Screening Clinical Practice Guidelines
// Implements Figures 1-10 and Table 1 in a single unified engine
// Phase 1 critical fix: Consolidates dual engine into single JSON-based engine

import type { ClinicalInput, ClinicalDecision, PathwayFigure } from "./types";

// ─── Helper: Cytology high grade check ────────────────────────────────────────

function isHighGradeCytology(r?: string): boolean {
  return ["ASC_H", "HSIL", "SCC", "AG3", "AG4", "AG5", "AC2", "AC3", "AC4"].includes(r ?? "");
}

function isLowGradeCytology(r?: string): boolean {
  return ["ASC_US", "LSIL", "AG1", "AC1"].includes(r ?? "");
}

function isAdenocarcinomaGlandular(r?: string): boolean {
  return ["AG1", "AG2", "AG3", "AG4", "AG5", "AC1", "AC2", "AC3", "AC4"].includes(r ?? "");
}

function referralPriorityFromRisk(risk: string): "P1" | "P2" | "P3" | "P4" {
  switch (risk) {
    case "URGENT": return "P1";
    case "HIGH": return "P2";
    case "MEDIUM": return "P3";
    default: return "P4";
  }
}

// ─── FIGURE 1: HPV Transition Pathway (cytology-negative, HPV first test) ─────

function evaluateFigure1(input: ClinicalInput): ClinicalDecision {
  const { hpvResult, cytologyResult } = input;

  if (!hpvResult) {
    return {
      figure: "FIGURE_1",
      riskLevel: "LOW",
      recommendation: "HPV result required to determine pathway",
      recommendationCode: "F1-PENDING",
      nextAction: "Enter HPV test result",
      guidelineReference: "Figure 1 - HPV Transition Pathway",
      rationale: "Patient transitioning from cytology-based to HPV screening. HPV result required.",
    };
  }

  if (hpvResult === "NOT_DETECTED") {
    return {
      figure: "FIGURE_1",
      riskLevel: "LOW",
      recommendation: "HPV not detected. Routine recall in 5 years.",
      recommendationCode: "F1-NEG-5Y",
      nextAction: "Schedule routine recall in 60 months",
      recallRequired: true,
      recallIntervalMonths: 60,
      nextScreeningIntervalMonths: 60,
      guidelineReference: "Figure 1 - HPV Transition Pathway: HPV not detected",
      rationale: "HPV not detected on transition test. 5-year recall per guidelines.",
    };
  }

  if (hpvResult === "INADEQUATE") {
    return {
      figure: "FIGURE_1",
      riskLevel: "MEDIUM",
      recommendation: "Inadequate sample. Repeat HPV test in 3 months.",
      recommendationCode: "F1-INAD-3M",
      nextAction: "Recall for repeat HPV test in 3 months",
      recallRequired: true,
      recallIntervalMonths: 3,
      guidelineReference: "Figure 1 - Inadequate sample",
      rationale: "Sample inadequate for HPV testing. Short-interval repeat required.",
    };
  }

  if (hpvResult === "HPV_OTHER") {
    if (cytologyResult === "NEGATIVE") {
      return {
        figure: "FIGURE_1",
        riskLevel: "MEDIUM",
        recommendation: "HPV Other detected, cytology negative. Repeat co-test in 12 months.",
        recommendationCode: "F1-HPVO-NEG-12M",
        nextAction: "Schedule repeat co-test (HPV + cytology) in 12 months",
        recallRequired: true,
        recallIntervalMonths: 12,
        guidelineReference: "Figure 1 - HPV Other, cytology negative",
        rationale: "HPV Other with negative cytology on transition test. 12-month recall.",
      };
    }
    if (isHighGradeCytology(cytologyResult)) {
      return {
        figure: "FIGURE_1",
        riskLevel: "HIGH",
        recommendation: "HPV Other with high-grade cytology. Urgent colposcopy referral.",
        recommendationCode: "F1-HPVO-HG-COLP",
        nextAction: "Urgent colposcopy referral",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P2",
        referralReason: "HPV Other + high-grade cytology on transition test",
        guidelineReference: "Figure 1 - HPV Other, high-grade cytology",
        rationale: "High-grade finding requires colposcopy assessment.",
      };
    }
    if (isLowGradeCytology(cytologyResult)) {
      return {
        figure: "FIGURE_1",
        riskLevel: "MEDIUM",
        recommendation: "HPV Other with low-grade cytology. Repeat co-test in 12 months.",
        recommendationCode: "F1-HPVO-LG-12M",
        nextAction: "Schedule repeat co-test in 12 months",
        recallRequired: true,
        recallIntervalMonths: 12,
        guidelineReference: "Figure 1 - HPV Other, low-grade cytology",
        rationale: "Low-grade finding with HPV Other. Repeat co-test.",
      };
    }
  }

  if (hpvResult === "HPV_16_18") {
    return {
      figure: "FIGURE_1",
      riskLevel: "HIGH",
      recommendation: "HPV 16/18 detected. Colposcopy referral required regardless of cytology.",
      recommendationCode: "F1-16-18-COLP",
      nextAction: "Colposcopy referral - Priority 2",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P2",
      referralReason: "HPV 16/18 detected on transition test",
      guidelineReference: "Figure 1 - HPV 16/18 detected",
      rationale: "HPV 16/18 carries highest risk and requires immediate colposcopy.",
    };
  }

  return {
    figure: "FIGURE_1",
    riskLevel: "LOW",
    recommendation: "Unable to determine pathway. Review result entry.",
    recommendationCode: "F1-UNKNOWN",
    nextAction: "Review and re-enter results",
    guidelineReference: "Figure 1",
    rationale: "Unexpected combination of results.",
  };
}

// ─── FIGURE 2: HPV Transition Pathway (previously abnormal cytology) ──────────

function evaluateFigure2(input: ClinicalInput): ClinicalDecision {
  const { hpvResult, cytologyResult, atypicalEndometrialHistory } = input;

  // Phase 1 critical fix: AG2 direct gynaecology referral (Issue 5)
  if (cytologyResult === "AG2" || atypicalEndometrialHistory) {
    return {
      figure: "FIGURE_2",
      riskLevel: "HIGH",
      recommendation: "Atypical endometrial cells (AG2) detected. Direct referral to gynaecology.",
      recommendationCode: "F2-AG2-GYN",
      nextAction: "Urgent gynaecology referral - bypass colposcopy",
      referralRequired: true,
      referralType: "GYNAECOLOGY",
      referralPriority: "P1",
      referralReason: "AG2 - Atypical endometrial cells require gynaecology assessment",
      clinicalWarnings: ["AG2 must be referred to gynaecology, NOT colposcopy"],
      guidelineReference: "Figure 2 - AG2 direct gynaecology referral",
      rationale: "Atypical endometrial cells indicate possible endometrial pathology requiring gynaecological assessment.",
    };
  }

  if (!hpvResult) {
    return {
      figure: "FIGURE_2",
      riskLevel: "LOW",
      recommendation: "HPV result required",
      recommendationCode: "F2-PENDING",
      nextAction: "Enter HPV test result",
      guidelineReference: "Figure 2",
      rationale: "HPV result required to determine pathway.",
    };
  }

  if (hpvResult === "NOT_DETECTED") {
    return {
      figure: "FIGURE_2",
      riskLevel: "LOW",
      recommendation: "HPV not detected. Routine recall in 3 years.",
      recommendationCode: "F2-NEG-3Y",
      nextAction: "Schedule recall in 36 months",
      recallRequired: true,
      recallIntervalMonths: 36,
      nextScreeningIntervalMonths: 36,
      guidelineReference: "Figure 2 - HPV not detected (previously abnormal)",
      rationale: "HPV negative on first transition test following abnormal cytology history. 3-year recall.",
    };
  }

  if (hpvResult === "HPV_16_18" || isHighGradeCytology(cytologyResult)) {
    return {
      figure: "FIGURE_2",
      riskLevel: "URGENT",
      recommendation: "High-risk result. Urgent colposcopy referral required.",
      recommendationCode: "F2-URGENT-COLP",
      nextAction: "Urgent colposcopy referral - Priority 1",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P1",
      referralReason: "HPV 16/18 or high-grade cytology in transition pathway with abnormal history",
      guidelineReference: "Figure 2 - High-risk transition",
      rationale: "High-risk HPV or cytology with prior abnormal history requires urgent assessment.",
    };
  }

  return {
    figure: "FIGURE_2",
    riskLevel: "MEDIUM",
    recommendation: "HPV Other detected. Colposcopy referral required.",
    recommendationCode: "F2-HPVO-COLP",
    nextAction: "Colposcopy referral - Priority 3",
    referralRequired: true,
    referralType: "COLPOSCOPY",
    referralPriority: "P3",
    referralReason: "HPV Other detected in transition pathway",
    guidelineReference: "Figure 2 - HPV Other transition",
    rationale: "HPV Other in previously abnormal cytology patient requires colposcopy.",
  };
}

// ─── FIGURE 3: Primary HPV Screening ──────────────────────────────────────────

function evaluateFigure3(input: ClinicalInput): ClinicalDecision {
  const {
    hpvResult,
    cytologyResult,
    sampleType,
    atypicalEndometrialHistory,
    consecutiveNegativeCoTestCount,
  } = input;

  // Phase 1 fix: AG2 routing at entry level
  if (cytologyResult === "AG2" || atypicalEndometrialHistory) {
    return {
      figure: "FIGURE_3",
      riskLevel: "HIGH",
      recommendation: "AG2 detected. Direct referral to gynaecology.",
      recommendationCode: "F3-AG2-GYN",
      nextAction: "Urgent gynaecology referral",
      referralRequired: true,
      referralType: "GYNAECOLOGY",
      referralPriority: "P1",
      referralReason: "Atypical endometrial cells (AG2)",
      clinicalWarnings: ["AG2 requires gynaecology referral, NOT colposcopy"],
      guidelineReference: "Figure 3 - AG2 direct gynaecology referral",
      rationale: "AG2 indicates possible endometrial pathology.",
    };
  }

  // Swab sample type warning (Figure 3 requirement)
  const warnings: string[] = [];
  if (sampleType === "SWAB") {
    warnings.push("Swab sample taken: return visit with clinical examination required per Figure 3");
  }

  if (!hpvResult) {
    return {
      figure: "FIGURE_3",
      riskLevel: "LOW",
      recommendation: "HPV result required to determine Primary HPV Screening pathway",
      recommendationCode: "F3-PENDING",
      nextAction: "Enter HPV test result",
      clinicalWarnings: warnings.length ? warnings : undefined,
      guidelineReference: "Figure 3 - Primary HPV Screening",
      rationale: "HPV result is the primary entry point for Figure 3.",
    };
  }

  // HPV not detected
  if (hpvResult === "NOT_DETECTED") {
    // Immunocompromised modifier: 3-year recall instead of 5-year
    if (input.immunocompromised) {
      return {
        figure: "FIGURE_3",
        riskLevel: "LOW",
        recommendation: "HPV not detected. Immunocompromised patient — routine recall in 3 years (not 5 years).",
        recommendationCode: "F3-NEG-IC-3Y",
        nextAction: "Schedule routine recall in 36 months (immunocompromised patient)",
        recallRequired: true,
        recallIntervalMonths: 36,
        nextScreeningIntervalMonths: 36,
        incrementConsecutiveNegative: true,
        clinicalWarnings: [
          ...(warnings.length ? warnings : []),
          "Immunocompromised patient: shorter 3-year recall applies (not 5-year)",
        ],
        guidelineReference: "Figure 3 — HPV not detected, immunocompromised (3-year recall)",
        rationale: "HPV not detected in an immunocompromised patient. NZ guidelines recommend 3-year recall interval for immunocompromised individuals.",
      };
    }
    return {
      figure: "FIGURE_3",
      riskLevel: "LOW",
      recommendation: "HPV not detected. Routine recall in 5 years.",
      recommendationCode: "F3-NEG-5Y",
      nextAction: "Schedule routine recall in 60 months",
      recallRequired: true,
      recallIntervalMonths: 60,
      nextScreeningIntervalMonths: 60,
      incrementConsecutiveNegative: true,
      clinicalWarnings: warnings.length ? warnings : undefined,
      guidelineReference: "Figure 3 — Low Risk (green circle): HPV not detected",
      rationale: "HPV not detected. Patient at lowest risk. Routine 5-year recall.",
    };
  }

  // Inadequate
  if (hpvResult === "INADEQUATE") {
    return {
      figure: "FIGURE_3",
      riskLevel: "MEDIUM",
      recommendation: "Inadequate HPV sample. Repeat test in 3 months.",
      recommendationCode: "F3-INAD-3M",
      nextAction: "Recall for repeat HPV test in 3 months",
      recallRequired: true,
      recallIntervalMonths: 3,
      requiresSwabRepeat: sampleType === "SWAB",
      clinicalWarnings: warnings.length ? warnings : undefined,
      guidelineReference: "Figure 3 - Inadequate sample",
      rationale: "Sample inadequate. Short-interval recall required.",
    };
  }

  // HPV 16/18 detected
  if (hpvResult === "HPV_16_18") {
    if (!cytologyResult) {
      return {
        figure: "FIGURE_3",
        riskLevel: "HIGH",
        recommendation: "HPV 16/18 detected. Cytology result required to determine management.",
        recommendationCode: "F3-1618-CYTPENDING",
        nextAction: "Enter cytology result",
        clinicalWarnings: ["HPV 16/18 detected - high risk pathway"],
        guidelineReference: "Figure 3 - HPV 16/18 detected (purple square)",
        rationale: "HPV 16/18 detected. Cytology required per Figure 3.",
      };
    }

    if (cytologyResult === "NEGATIVE") {
      return {
        figure: "FIGURE_3",
        riskLevel: "HIGH",
        recommendation: "HPV 16/18 with negative cytology. Colposcopy referral required.",
        recommendationCode: "F3-1618-NEG-COLP",
        nextAction: "Colposcopy referral - Priority 2",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P2",
        referralReason: "HPV 16/18 with negative cytology per Figure 3",
        clinicalWarnings: [...warnings, "HPV 16/18 always requires colposcopy regardless of cytology"],
        resetConsecutiveNegative: true,
        guidelineReference: "Figure 3 - HPV 16/18, cytology negative (purple square)",
        rationale: "HPV 16/18 with any cytology result requires colposcopy per guidelines.",
      };
    }

    if (isHighGradeCytology(cytologyResult)) {
      return {
        figure: "FIGURE_3",
        riskLevel: "URGENT",
        recommendation: "HPV 16/18 with high-grade cytology. Urgent colposcopy - Priority 1.",
        recommendationCode: "F3-1618-HG-URGCOLP",
        nextAction: "Urgent colposcopy referral - Priority 1 (within 20 working days)",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P1",
        referralReason: "HPV 16/18 + high-grade cytology",
        clinicalWarnings: [...warnings, "URGENT: P1 referral must be actioned within 20 working days"],
        resetConsecutiveNegative: true,
        guidelineReference: "Figure 3 - HPV 16/18, high-grade cytology (urgent)",
        rationale: "Highest risk combination. Urgent P1 referral required.",
      };
    }

    // Low-grade or other positive cytology with HPV 16/18
    return {
      figure: "FIGURE_3",
      riskLevel: "HIGH",
      recommendation: "HPV 16/18 with abnormal cytology. Colposcopy referral required.",
      recommendationCode: "F3-1618-ABN-COLP",
      nextAction: "Colposcopy referral - Priority 2",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P2",
      referralReason: "HPV 16/18 + abnormal cytology",
      clinicalWarnings: warnings.length ? warnings : undefined,
      resetConsecutiveNegative: true,
      guidelineReference: "Figure 3 - HPV 16/18, abnormal cytology (purple square)",
      rationale: "HPV 16/18 requires colposcopy.",
    };
  }

  // HPV Other detected
  if (hpvResult === "HPV_OTHER") {
    if (!cytologyResult) {
      return {
        figure: "FIGURE_3",
        riskLevel: "MEDIUM",
        recommendation: "HPV Other detected. Cytology result required.",
        recommendationCode: "F3-HPVO-CYTPENDING",
        nextAction: "Enter cytology result",
        clinicalWarnings: [...warnings, "HPV Other detected - medium risk pathway (orange triangle)"],
        guidelineReference: "Figure 3 - HPV Other (orange triangle)",
        rationale: "HPV Other detected. Cytology result determines management.",
      };
    }

    if (cytologyResult === "NEGATIVE") {
      // At second repeat (24M from baseline): persistent HPV Other → colposcopy regardless of cytology
      // NZ guidelines (FIG3_REPEAT_24M): any HPV type detected at 2nd repeat → REFER_COLPOSCOPY
      if (consecutiveNegativeCoTestCount >= 2) {
        return {
          figure: "FIGURE_3",
          riskLevel: "HIGH",
          recommendation: "Persistent HPV Other at second repeat (24-month). Colposcopy referral required.",
          recommendationCode: "F3-HPVO-PERSIST-24M-COLP",
          nextAction: "Colposcopy referral — persistent HPV Other at second repeat",
          referralRequired: true,
          referralType: "COLPOSCOPY",
          referralPriority: "P2",
          referralReason: "HPV Other persistent at 24-month second repeat",
          resetConsecutiveNegative: true,
          clinicalWarnings: [
            ...(warnings.length ? warnings : []),
            "HPV Other persistent at second repeat (24M) — colposcopy required per guidelines",
          ],
          guidelineReference: "Figure 3 — HPV Other, 2nd repeat (24M): any HPV detected → colposcopy",
          rationale: "NZ guidelines: at the second repeat (24 months from baseline), any persistent HPV type requires colposcopy referral.",
        };
      }
      // At first repeat (12M): age ≥50 with HPV Other + negative cytology → colposcopy (no further waiting)
      // NZ guidelines (FIG3_REPEAT_12M): age ≥50 branch routes to colposcopy instead of second repeat
      if (consecutiveNegativeCoTestCount >= 1 && input.patientAge && input.patientAge >= 50) {
        return {
          figure: "FIGURE_3",
          riskLevel: "HIGH",
          recommendation: "HPV Other persisting at 12-month repeat. Patient age ≥50 — colposcopy referral required (no further repeat).",
          recommendationCode: "F3-HPVO-NEG-12M-AGE50-COLP",
          nextAction: "Colposcopy referral — age ≥50, HPV Other persisting at 12-month repeat",
          referralRequired: true,
          referralType: "COLPOSCOPY",
          referralPriority: "P2",
          referralReason: "HPV Other persisting at 12M repeat, patient age ≥50",
          resetConsecutiveNegative: true,
          clinicalWarnings: [
            ...(warnings.length ? warnings : []),
            "Age ≥50: HPV Other persisting at 12-month repeat requires colposcopy (not a second repeat)",
          ],
          guidelineReference: "Figure 3 — HPV Other, 12M repeat, age ≥50: colposcopy required",
          rationale: "NZ guidelines: patients aged ≥50 with HPV Other persisting at 12-month repeat are referred to colposcopy rather than a second 12-month repeat.",
        };
      }
      // Under 50 at first repeat: schedule second repeat at 12M (24M from baseline)
      if (consecutiveNegativeCoTestCount >= 1) {
        return {
          figure: "FIGURE_3",
          riskLevel: "MEDIUM",
          recommendation: "HPV Other persisting at 12-month repeat, cytology negative. Repeat co-test in 12 months (24 months from baseline).",
          recommendationCode: "F3-HPVO-NEG-12M-2ND",
          nextAction: "Schedule second repeat co-test in 12 months (recommend LBC)",
          recallRequired: true,
          recallIntervalMonths: 12,
          incrementConsecutiveNegative: true,
          clinicalWarnings: warnings.length ? warnings : undefined,
          guidelineReference: "Figure 3 — HPV Other, 12M repeat: second repeat at 24M",
          rationale: "HPV Other persisting at 12M repeat with negative cytology. Second repeat at 24 months (age <50). At that test, any HPV → colposcopy.",
        };
      }
      return {
        figure: "FIGURE_3",
        riskLevel: "MEDIUM",
        recommendation: "HPV Other with negative cytology. Repeat co-test in 12 months (recommend LBC).",
        recommendationCode: "F3-HPVO-NEG-12M",
        nextAction: "Schedule repeat co-test in 12 months (recommend LBC)",
        recallRequired: true,
        recallIntervalMonths: 12,
        incrementConsecutiveNegative: true,
        clinicalWarnings: warnings.length ? warnings : undefined,
        guidelineReference: "Figure 3 — HPV Other, cytology negative (orange triangle)",
        rationale: "HPV Other with negative cytology. Repeat co-test at 12 months per guidelines. If still positive at 12M: age ≥50 → colposcopy; age <50 → second repeat at 24M.",
      };
    }

    if (cytologyResult === "UNSATISFACTORY") {
      return {
        figure: "FIGURE_3",
        riskLevel: "MEDIUM",
        recommendation: "Unsatisfactory cytology with HPV Other. Repeat cytology in 3 months.",
        recommendationCode: "F3-HPVO-UNSAT-3M",
        nextAction: "Recall for repeat cytology in 3 months",
        recallRequired: true,
        recallIntervalMonths: 3,
        incrementUnsatisfactory: true,
        clinicalWarnings: warnings.length ? warnings : undefined,
        guidelineReference: "Figure 3 - HPV Other, unsatisfactory cytology",
        rationale: "Unsatisfactory cytology prevents adequate assessment. Repeat required.",
      };
    }

    if (isLowGradeCytology(cytologyResult)) {
      return {
        figure: "FIGURE_3",
        riskLevel: "MEDIUM",
        recommendation: "HPV Other with low-grade cytology. Repeat co-test in 12 months.",
        recommendationCode: "F3-HPVO-LG-12M",
        nextAction: "Schedule repeat co-test in 12 months",
        recallRequired: true,
        recallIntervalMonths: 12,
        clinicalWarnings: warnings.length ? warnings : undefined,
        guidelineReference: "Figure 3 - HPV Other, low-grade cytology (orange triangle)",
        rationale: "Low-grade cytology with HPV Other. Short-interval recall to monitor.",
      };
    }

    if (isHighGradeCytology(cytologyResult)) {
      return {
        figure: "FIGURE_3",
        riskLevel: "HIGH",
        recommendation: "HPV Other with high-grade cytology. Colposcopy referral required.",
        recommendationCode: "F3-HPVO-HG-COLP",
        nextAction: "Colposcopy referral - Priority 2",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P2",
        referralReason: "HPV Other + high-grade cytology",
        clinicalWarnings: warnings.length ? warnings : undefined,
        resetConsecutiveNegative: true,
        guidelineReference: "Figure 3 - HPV Other, high-grade cytology",
        rationale: "High-grade cytology requires colposcopy assessment.",
      };
    }
  }

  return {
    figure: "FIGURE_3",
    riskLevel: "LOW",
    recommendation: "Unable to determine pathway. Review results.",
    recommendationCode: "F3-UNKNOWN",
    nextAction: "Review and re-enter results",
    guidelineReference: "Figure 3",
    rationale: "Unexpected result combination.",
  };
}

// ─── FIGURE 4: Colposcopy and Histology (Low-grade findings) ──────────────────

function evaluateFigure4(input: ClinicalInput): ClinicalDecision {
  const { colposcopicImpression, biopsyResult, tzType, hpvResult } = input;

  if (!colposcopicImpression) {
    return {
      figure: "FIGURE_4",
      riskLevel: "LOW",
      recommendation: "Colposcopic impression required",
      recommendationCode: "F4-PENDING",
      nextAction: "Enter colposcopic impression",
      guidelineReference: "Figure 4 - Colposcopy assessment",
      rationale: "Colposcopy result required to determine management.",
    };
  }

  if (colposcopicImpression === "NORMAL") {
    // Phase 1 fix: Type 3 TZ exception
    if (tzType === "TYPE3") {
      return {
        figure: "FIGURE_4",
        riskLevel: "MEDIUM",
        recommendation: "Normal colposcopy, Type 3 TZ. Return to co-test in 12 months due to TZ3 exception.",
        recommendationCode: "F4-NORM-TZ3-12M",
        nextAction: "Repeat co-test in 12 months (TZ3 exception rule)",
        recallRequired: true,
        recallIntervalMonths: 12,
        clinicalWarnings: ["Type 3 TZ: colposcopy may be limited. 12-month recall applies."],
        guidelineReference: "Figure 4 — Normal colposcopy, Type 3 TZ exception",
        rationale: "Type 3 TZ has limited visualisation. Exception rule requires shorter recall interval.",
      };
    }
    // Immunocompromised: at second normal colposcopy, HPV detected → continue colposcopy surveillance
    if (input.immunocompromised) {
      return {
        figure: "FIGURE_4",
        riskLevel: "MEDIUM",
        recommendation: "Normal colposcopy in immunocompromised patient. Repeat co-test in 12 months — immunocompromised patients require annual surveillance.",
        recommendationCode: "F4-NORM-IC-12M",
        nextAction: "Repeat co-test in 12 months (immunocompromised patient — annual surveillance)",
        recallRequired: true,
        recallIntervalMonths: 12,
        clinicalWarnings: ["Immunocompromised patient: annual surveillance required after normal colposcopy"],
        guidelineReference: "Figure 4 — Normal colposcopy, immunocompromised patient",
        rationale: "Immunocompromised patients require more frequent surveillance due to impaired immune clearance of HPV.",
      };
    }
    return {
      figure: "FIGURE_4",
      riskLevel: "LOW",
      recommendation: "Normal colposcopy. Return to routine HPV screening in 12 months.",
      recommendationCode: "F4-NORM-ROUTINE",
      nextAction: "Routine HPV co-test at 12 months",
      recallRequired: true,
      recallIntervalMonths: 12,
      guidelineReference: "Figure 4 — Normal colposcopy",
      rationale: "Normal colposcopy assessment. Return to 12-month co-test. If second co-test negative: back to routine 5-year screening.",
    };
  }

  if (colposcopicImpression === "LSIL") {
    if (!biopsyResult) {
      return {
        figure: "FIGURE_4",
        riskLevel: "MEDIUM",
        recommendation: "Low-grade colposcopy. Biopsy result required for management decision.",
        recommendationCode: "F4-LSIL-BIOPSY",
        nextAction: "Enter biopsy result",
        guidelineReference: "Figure 4 - LSIL colposcopy",
        rationale: "Biopsy taken at colposcopy. Result required for pathway determination.",
      };
    }
    if (biopsyResult === "CIN1" || biopsyResult === "NORMAL") {
      // Discordance check: high-grade cytology (ASC-H, HSIL, SCC) with low-grade biopsy
      // NZ guidelines require MDM case review in this scenario
      if (input.cytologyResult && isHighGradeCytology(input.cytologyResult)) {
        return {
          figure: "FIGURE_4",
          riskLevel: "HIGH",
          recommendation: "Discordant finding: high-grade cytology with CIN1/normal biopsy. MDM case review required.",
          recommendationCode: "F4-DISCORDANT-MDM",
          nextAction: "MDM case review — discordant cytology/histology",
          requiresMDMReview: true,
          clinicalWarnings: [
            "Discordant result: referring cytology was high-grade but biopsy shows low-grade/normal",
            "MDM review is required per NZ guidelines for discordant cytology/histology",
          ],
          guidelineReference: "Figure 4 — Discordant cytology/histology (high-grade cytology, low-grade biopsy)",
          rationale: "High-grade cytology not confirmed on biopsy. NZ guidelines require MDM case review to determine appropriate management.",
        };
      }
      return {
        figure: "FIGURE_4",
        riskLevel: "MEDIUM",
        recommendation: "CIN1/Normal biopsy at colposcopy. Repeat co-test in 12 months.",
        recommendationCode: "F4-CIN1-12M",
        nextAction: "Schedule repeat co-test in 12 months",
        recallRequired: true,
        recallIntervalMonths: 12,
        incrementConsecutiveLowGrade: true,
        guidelineReference: "Figure 4 — CIN1/Normal biopsy",
        rationale: "CIN1 is low-grade. Surveillance with 12-month co-test.",
      };
    }
    if (biopsyResult === "CIN2" || biopsyResult === "CIN3") {
      // Escalate to Figure 5
      return evaluateFigure5(input);
    }
  }

  if (colposcopicImpression === "HSIL") {
    if (!biopsyResult) {
      return {
        figure: "FIGURE_4",
        riskLevel: "HIGH",
        recommendation: "High-grade colposcopy (HSIL). Biopsy result required.",
        recommendationCode: "F4-HSIL-BIOPSY",
        nextAction: "Enter biopsy result",
        clinicalWarnings: ["HSIL colposcopy - high-grade pathway"],
        guidelineReference: "Figure 4 - HSIL colposcopy",
        rationale: "High-grade colposcopic finding. Biopsy result determines management.",
      };
    }
    return evaluateFigure5({ ...input, colposcopicImpression: "HSIL" });
  }

  if (colposcopicImpression === "INVASION") {
    return {
      figure: "FIGURE_4",
      riskLevel: "URGENT",
      recommendation: "Suspicious for invasion at colposcopy. Urgent MDM review and specialist referral.",
      recommendationCode: "F4-INVASION-MDM",
      nextAction: "Urgent MDM review and specialist referral",
      referralRequired: true,
      referralType: "MDM",
      referralPriority: "P1",
      referralReason: "Colposcopy suspicious for invasive disease",
      requiresMDMReview: true,
      clinicalWarnings: ["URGENT: Suspicious for invasion - MDM and specialist referral required"],
      guidelineReference: "Figure 4 - Colposcopy suspicious for invasion",
      rationale: "Invasive disease suspected. Multi-disciplinary review required urgently.",
    };
  }

  return {
    figure: "FIGURE_4",
    riskLevel: "MEDIUM",
    recommendation: "Unsatisfactory colposcopy. Consider repeat colposcopy.",
    recommendationCode: "F4-UNSAT",
    nextAction: "Repeat colposcopy in 3-6 months",
    recallRequired: true,
    recallIntervalMonths: 3,
    guidelineReference: "Figure 4 - Unsatisfactory colposcopy",
    rationale: "Colposcopy was unsatisfactory. Repeat required for adequate assessment.",
  };
}

// ─── FIGURE 5: High-grade lesion management ────────────────────────────────────

function evaluateFigure5(input: ClinicalInput): ClinicalDecision {
  const { biopsyResult, tzType, mdmOutcome } = input;

  // Phase 1 fix: Type 3 TZ exception for Figure 5
  if (tzType === "TYPE3" && (biopsyResult === "CIN2" || biopsyResult === "CIN3")) {
    return {
      figure: "FIGURE_5",
      riskLevel: "HIGH",
      recommendation: "CIN2/3 with Type 3 TZ. MDM review required before treatment decision.",
      recommendationCode: "F5-CIN23-TZ3-MDM",
      nextAction: "MDM review required (TZ3 exception)",
      requiresMDMReview: true,
      clinicalWarnings: [
        "Type 3 TZ: ablative treatment not recommended - excision required",
        "MDM review required for Type 3 TZ with CIN2/3",
      ],
      guidelineReference: "Figure 5 - CIN2/3, Type 3 TZ exception",
      rationale: "Type 3 TZ requires excisional treatment. MDM review to plan appropriate management.",
    };
  }

  if (biopsyResult === "CIN2") {
    return {
      figure: "FIGURE_5",
      riskLevel: "HIGH",
      recommendation: "CIN2 confirmed. Treatment required. Discuss treatment options.",
      recommendationCode: "F5-CIN2-TX",
      nextAction: "Treatment (LLETZ/ablation) then Test of Cure pathway",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P2",
      referralReason: "CIN2 - treatment required",
      guidelineReference: "Figure 5 - CIN2 management",
      rationale: "CIN2 requires treatment. Patient to enter Test of Cure pathway after treatment.",
    };
  }

  if (biopsyResult === "CIN3") {
    return {
      figure: "FIGURE_5",
      riskLevel: "URGENT",
      recommendation: "CIN3 confirmed. Urgent treatment required.",
      recommendationCode: "F5-CIN3-URGENT",
      nextAction: "Urgent treatment referral - LLETZ",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P1",
      referralReason: "CIN3 - urgent treatment required",
      clinicalWarnings: ["CIN3 requires urgent treatment"],
      guidelineReference: "Figure 5 - CIN3 management",
      rationale: "CIN3 is high-grade precancerous lesion requiring urgent treatment.",
    };
  }

  if (biopsyResult === "AIS") {
    return {
      figure: "FIGURE_5",
      riskLevel: "URGENT",
      recommendation: "AIS (Adenocarcinoma in situ) confirmed. MDM review and specialist referral.",
      recommendationCode: "F5-AIS-MDM",
      nextAction: "MDM review and gynaecology specialist referral",
      referralRequired: true,
      referralType: "MDM",
      referralPriority: "P1",
      requiresMDMReview: true,
      clinicalWarnings: ["AIS requires MDM review - specialist management"],
      guidelineReference: "Figure 5 - AIS management",
      rationale: "AIS is a precancerous glandular lesion requiring specialist management.",
    };
  }

  if (biopsyResult === "SCC" || biopsyResult === "ADENOCARCINOMA") {
    return {
      figure: "FIGURE_5",
      riskLevel: "URGENT",
      recommendation: "Invasive cancer confirmed. URGENT specialist referral.",
      recommendationCode: "F5-CANCER-URGENT",
      nextAction: "Immediate gynaecology oncology referral",
      referralRequired: true,
      referralType: "SPECIALIST",
      referralPriority: "P1",
      requiresMDMReview: true,
      clinicalWarnings: ["URGENT: Invasive cancer diagnosed - immediate specialist referral"],
      guidelineReference: "Figure 5 - Invasive cancer",
      rationale: "Confirmed invasive malignancy. Immediate oncology referral required.",
    };
  }

  return {
    figure: "FIGURE_5",
    riskLevel: "HIGH",
    recommendation: "High-grade finding. Specialist review required.",
    recommendationCode: "F5-REVIEW",
    nextAction: "Colposcopy specialist review",
    referralRequired: true,
    referralType: "COLPOSCOPY",
    referralPriority: "P2",
    guidelineReference: "Figure 5 - High-grade management",
    rationale: "High-grade finding requiring specialist assessment.",
  };
}

// ─── FIGURE 6: Test of Cure ────────────────────────────────────────────────────

function evaluateFigure6(input: ClinicalInput): ClinicalDecision {
  const {
    hpvResult,
    cytologyResult,
    consecutiveNegativeCoTestCount,
    consecutiveLowGradeCount,
  } = input;

  if (!hpvResult) {
    return {
      figure: "FIGURE_6",
      riskLevel: "LOW",
      recommendation: "Test of Cure: HPV result required",
      recommendationCode: "F6-PENDING",
      nextAction: "Enter HPV test result for Test of Cure",
      guidelineReference: "Figure 6 - Test of Cure",
      rationale: "Patient is in Test of Cure protocol following treatment. HPV result required.",
    };
  }

  if (hpvResult === "NOT_DETECTED" && cytologyResult === "NEGATIVE") {
    // NZ guidelines (FIG6_AT_6M): first ToC test at 6 MONTHS post-treatment
    // Counter 0 = first co-test (at 6M post-treatment)
    if (consecutiveNegativeCoTestCount === 0) {
      return {
        figure: "FIGURE_6",
        riskLevel: "LOW",
        recommendation: "Test of Cure: first negative co-test at 6 months post-treatment. Repeat co-test in 12 months.",
        recommendationCode: "F6-TOC-6M-NEG",
        nextAction: "Schedule repeat co-test in 12 months (12 months from 6M test = 18 months post-treatment)",
        recallRequired: true,
        recallIntervalMonths: 12,
        incrementConsecutiveNegative: true,
        guidelineReference: "Figure 6 — Test of Cure: 6-month negative co-test (clean path)",
        rationale: "First negative co-test at 6 months post-treatment. Second negative co-test at 12M from this test (18M from treatment) required before discharge.",
      };
    }
    // Counter ≥1 = second or later co-test; if two consecutive negatives → discharge
    if (consecutiveNegativeCoTestCount >= 1) {
      // Discharge to 5-year routine recall (3-year if immunocompromised)
      const recallMonths = input.immunocompromised ? 36 : 60;
      return {
        figure: "FIGURE_6",
        riskLevel: "LOW",
        recommendation: `Two consecutive negative co-tests post-treatment. Discharge to routine ${input.immunocompromised ? "3-year" : "5-year"} screening.`,
        recommendationCode: input.immunocompromised ? "F6-TOC-DISCHARGE-IC-3Y" : "F6-TOC-DISCHARGE-5Y",
        nextAction: `Discharge to routine HPV screening. Next recall in ${recallMonths} months.`,
        recallRequired: true,
        recallIntervalMonths: recallMonths,
        nextScreeningIntervalMonths: recallMonths,
        incrementConsecutiveNegative: true,
        clinicalWarnings: input.immunocompromised
          ? ["Immunocompromised patient: 3-year recall after ToC discharge"]
          : undefined,
        guidelineReference: "Figure 6 — Test of Cure: two consecutive negative co-tests → discharge",
        rationale: "Two consecutive negative co-tests confirms treatment success. Discharge to routine recall.",
      };
    }
  }

  if (hpvResult === "HPV_OTHER" && cytologyResult === "NEGATIVE") {
    if (consecutiveLowGradeCount >= 2) {
      return {
        figure: "FIGURE_6",
        riskLevel: "HIGH",
        recommendation: "Persistent HPV Other after treatment. Colposcopy referral required.",
        recommendationCode: "F6-PERSIST-COLP",
        nextAction: "Colposcopy referral - persistent HPV post-treatment",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P2",
        referralReason: "Persistent HPV Other after treatment in Test of Cure protocol",
        guidelineReference: "Figure 6 - Persistent HPV post-treatment",
        rationale: "Persistent HPV Other after 2 co-tests post-treatment requires colposcopy.",
      };
    }
    return {
      figure: "FIGURE_6",
      riskLevel: "MEDIUM",
      recommendation: "HPV Other detected post-treatment. Repeat co-test in 12 months.",
      recommendationCode: "F6-HPVO-12M",
      nextAction: "Schedule repeat co-test in 12 months",
      recallRequired: true,
      recallIntervalMonths: 12,
      incrementConsecutiveLowGrade: true,
      guidelineReference: "Figure 6 - HPV Other post-treatment",
      rationale: "HPV Other post-treatment. Monitoring required.",
    };
  }

  if (hpvResult === "HPV_16_18" || isHighGradeCytology(cytologyResult)) {
    return {
      figure: "FIGURE_6",
      riskLevel: "URGENT",
      recommendation: "High-risk result post-treatment. Urgent colposcopy referral.",
      recommendationCode: "F6-RELAPSE-URGCOLP",
      nextAction: "Urgent colposcopy referral - possible residual/recurrent disease",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P1",
      referralReason: "High-risk HPV or high-grade cytology post-treatment",
      clinicalWarnings: ["Possible residual or recurrent disease post-treatment"],
      guidelineReference: "Figure 6 - Recurrence post-treatment",
      rationale: "High-risk result suggests residual or recurrent disease requiring urgent assessment.",
    };
  }

  return {
    figure: "FIGURE_6",
    riskLevel: "MEDIUM",
    recommendation: "Abnormal result post-treatment. Repeat co-test in 12 months.",
    recommendationCode: "F6-ABN-12M",
    nextAction: "Schedule repeat co-test in 12 months",
    recallRequired: true,
    recallIntervalMonths: 12,
    guidelineReference: "Figure 6 - Post-treatment abnormal",
    rationale: "Abnormal result post-treatment requires monitoring.",
  };
}

// ─── FIGURE 7: Management of Glandular Abnormalities ──────────────────────────
// Handles all AG (glandular) and AC (adenocarcinoma-related) cytology codes
// Entry point: AG1–AG5 or AC1–AC4 cytology, OR colposcopy follow-up for glandular cases
// NZ Cervical Screening Guidelines — Figure 7

function evaluateFigure7(input: ClinicalInput): ClinicalDecision {
  const { cytologyResult, colposcopicImpression, biopsyResult, atypicalEndometrialHistory } = input;

  // ── AG2 / AC2: Direct gynaecology referral ──────────────────────────────────
  // AG2 (atypical endometrial cells) AND AC2 (per NZ guidelines Figure 7) must NOT be
  // referred to colposcopy — direct gynaecology referral only.
  if (cytologyResult === "AG2" || cytologyResult === "AC2" || atypicalEndometrialHistory) {
    const isAC2 = cytologyResult === "AC2";
    return {
      figure: "FIGURE_7",
      riskLevel: "HIGH",
      recommendation: isAC2
        ? "AC2 glandular abnormality. Direct referral to gynaecology required — do not refer to colposcopy."
        : "Atypical endometrial cells (AG2). Direct referral to gynaecology required — do not refer to colposcopy.",
      recommendationCode: isAC2 ? "F7-AC2-GYN" : "F7-AG2-GYN",
      nextAction: "Gynaecology referral — bypass colposcopy",
      referralRequired: true,
      referralType: "GYNAECOLOGY",
      referralPriority: "P1",
      referralReason: isAC2
        ? "AC2 — glandular abnormality requiring direct gynaecology assessment"
        : "AG2 — atypical endometrial cells require endometrial assessment",
      clinicalWarnings: isAC2
        ? ["AC2 must be referred to gynaecology, NOT colposcopy (per NZ guidelines Figure 7)"]
        : ["AG2 must be referred to gynaecology, NOT colposcopy"],
      guidelineReference: `Figure 7 — Glandular Abnormalities: ${isAC2 ? "AC2" : "AG2 (atypical endometrial cells)"}`,
      rationale: isAC2
        ? "AC2 requires direct gynaecological assessment per NZ guidelines Figure 7."
        : "AG2 indicates possible endometrial pathology. Direct gynaecological assessment required to exclude endometrial carcinoma.",
    };
  }

  // ── Post-colposcopy management (colposcopy findings present) ────────────────
  if (colposcopicImpression) {

    // Visible lesion (LSIL, HSIL, or INVASION impression) → biopsy management
    if (colposcopicImpression !== "NORMAL" && colposcopicImpression !== "UNSATISFACTORY") {

      if (colposcopicImpression === "INVASION") {
        return {
          figure: "FIGURE_7",
          riskLevel: "URGENT",
          recommendation: "Invasive disease suspected at colposcopy. Urgent gynaecological oncology referral.",
          recommendationCode: "F7-INVASION-ONCO",
          nextAction: "Urgent gynaecological oncology referral",
          referralRequired: true,
          referralType: "SPECIALIST",
          referralPriority: "P1",
          requiresMDMReview: true,
          clinicalWarnings: ["Invasive disease suspected — urgent oncology referral required"],
          guidelineReference: "Figure 7 — Glandular Abnormalities: invasion suspected",
          rationale: "Colposcopic impression of invasion in glandular abnormality workup. Immediate oncology referral required.",
        };
      }

      if (biopsyResult) {
        // AIS confirmed → MDM + excisional treatment
        if (biopsyResult === "AIS") {
          return {
            figure: "FIGURE_7",
            riskLevel: "URGENT",
            recommendation: "AIS confirmed on biopsy. MDM review and excisional treatment required.",
            recommendationCode: "F7-AIS-MDM-EXCISION",
            nextAction: "MDM review and excisional treatment (cone biopsy or hysterectomy)",
            referralRequired: true,
            referralType: "MDM",
            referralPriority: "P1",
            requiresMDMReview: true,
            clinicalWarnings: [
              "AIS requires complete excision with clear margins",
              "MDM review required — hysterectomy may be appropriate depending on age/fertility wishes",
            ],
            guidelineReference: "Figure 7 — Glandular Abnormalities: AIS confirmed on biopsy",
            rationale: "AIS is a pre-invasive glandular lesion requiring excisional treatment. MDM review required to plan management.",
          };
        }

        // Invasive cancer → urgent oncology
        if (biopsyResult === "SCC" || biopsyResult === "ADENOCARCINOMA") {
          return {
            figure: "FIGURE_7",
            riskLevel: "URGENT",
            recommendation: "Invasive cancer confirmed on biopsy. Urgent gynaecological oncology referral.",
            recommendationCode: "F7-CANCER-ONCO",
            nextAction: "Urgent gynaecological oncology referral",
            referralRequired: true,
            referralType: "SPECIALIST",
            referralPriority: "P1",
            requiresMDMReview: true,
            clinicalWarnings: ["Invasive cancer confirmed — immediate oncology referral required"],
            guidelineReference: "Figure 7 — Glandular Abnormalities: invasive cancer on biopsy",
            rationale: "Confirmed invasive malignancy on biopsy. Immediate oncology referral required.",
          };
        }

        // CIN2/3 (squamous) → treat CIN, then continue glandular surveillance
        if (biopsyResult === "CIN2" || biopsyResult === "CIN3") {
          return {
            figure: "FIGURE_7",
            riskLevel: "HIGH",
            recommendation: "CIN2/3 found at colposcopy in glandular abnormality workup. Treat CIN, then continue 12-monthly co-test surveillance for glandular component.",
            recommendationCode: "F7-CIN23-TREAT-SURVEIL",
            nextAction: "Treat CIN2/3 then 12-month co-test surveillance",
            referralRequired: true,
            referralType: "COLPOSCOPY",
            referralPriority: "P2",
            clinicalWarnings: [
              "Glandular abnormality workup: after CIN treatment, continue enhanced annual surveillance",
              "Glandular component may not be fully assessed — clinical judgement required",
            ],
            guidelineReference: "Figure 7 — Glandular Abnormalities: CIN2/3 at colposcopy",
            rationale: "CIN2/3 found in glandular abnormality workup. Treat CIN then continue surveillance for possible glandular component.",
          };
        }

        // CIN1 / Normal / Unsatisfactory biopsy with glandular cytology → MDM case review
        return {
          figure: "FIGURE_7",
          riskLevel: "HIGH",
          recommendation: "Low-grade or normal biopsy in glandular abnormality workup. MDM case review required — glandular lesions may not be visible colposcopically.",
          recommendationCode: "F7-LOWGRADE-BX-MDM",
          nextAction: "MDM case review",
          requiresMDMReview: true,
          clinicalWarnings: [
            "Low-grade histology does not exclude glandular pathology",
            "MDM review required — glandular lesions may be endocervical or above colposcopic view",
          ],
          guidelineReference: "Figure 7 — Glandular Abnormalities: low-grade biopsy, MDM required",
          rationale: "Low-grade biopsy with glandular cytology is discordant. MDM case review required as glandular lesions are often above colposcopic view.",
        };
      }

      // Visible lesion, biopsy not yet available
      return {
        figure: "FIGURE_7",
        riskLevel: "HIGH",
        recommendation: "Visible lesion at colposcopy in glandular abnormality workup. Biopsy required.",
        recommendationCode: "F7-VIS-BIOPSY-REQUIRED",
        nextAction: "Biopsy required — enter histology result when available",
        guidelineReference: "Figure 7 — Glandular Abnormalities: visible lesion, biopsy required",
        rationale: "Visible lesion seen at colposcopy during glandular abnormality workup. Biopsy required for histological diagnosis.",
      };
    }

    // Normal colposcopy / no visible lesion → MDM case review (mandatory) → outcome routing
    if (colposcopicImpression === "NORMAL") {
      // MDM outcome routing (per NZ guidelines Figure 7)
      if (input.mdmOutcome === "CYTOLOGY_CONFIRMED_NOT_AG2") {
        // MDM reviewed: cytology is NOT AG2 → Type 3 excision (cold knife cone or surgical excision)
        return {
          figure: "FIGURE_7",
          riskLevel: "URGENT",
          recommendation: "MDM confirmed glandular cytology (not AG2). Excisional treatment (Type 3 excision / cone biopsy) required.",
          recommendationCode: "F7-MDM-TYPE3-EXCISION",
          nextAction: "Type 3 excision (cold knife cone biopsy or equivalent) recommended",
          referralRequired: true,
          referralType: "COLPOSCOPY",
          referralPriority: "P1",
          clinicalWarnings: ["Type 3 excision required — MDM has confirmed glandular abnormality (not AG2)"],
          guidelineReference: "Figure 7 — Glandular Abnormalities: MDM → excisional treatment",
          rationale: "MDM review confirmed non-AG2 glandular cytology. Type 3 excision required to obtain adequate endocervical specimen.",
        };
      }

      if (input.mdmOutcome === "AG2_CYTOLOGY_CONFIRMED") {
        // MDM confirmed AG2 → investigate for other gynaecological malignancies
        return {
          figure: "FIGURE_7",
          riskLevel: "URGENT",
          recommendation: "MDM confirmed AG2. Investigate for other gynaecological malignancies.",
          recommendationCode: "F7-MDM-AG2-INVESTIGATE",
          nextAction: "Investigate for other gynaecological malignancies (endometrial, ovarian)",
          referralRequired: true,
          referralType: "GYNAECOLOGY",
          referralPriority: "P1",
          clinicalWarnings: [
            "AG2 confirmed by MDM — endometrial and other gynaecological malignancies must be excluded",
            "Endometrial biopsy and/or imaging may be required",
          ],
          guidelineReference: "Figure 7 — Glandular Abnormalities: MDM → AG2 confirmed → investigate for malignancies",
          rationale: "MDM confirmed AG2 (atypical endometrial cells). Investigation for endometrial and other gynaecological malignancies is required.",
        };
      }

      if (input.mdmOutcome === "CYTOLOGY_NOT_CONFIRMED") {
        // MDM: cytology not confirmed on review → repeat colposcopy in 6 months
        return {
          figure: "FIGURE_7",
          riskLevel: "MEDIUM",
          recommendation: "MDM: cytology not confirmed on review. Repeat colposcopy with HPV + cytology in 6 months.",
          recommendationCode: "F7-MDM-CYTNOTCONFIRMED-COLP-6M",
          nextAction: "Repeat colposcopy with HPV + cytology in 6 months",
          recallRequired: true,
          recallIntervalMonths: 6,
          guidelineReference: "Figure 7 — Glandular Abnormalities: MDM → cytology not confirmed → repeat colposcopy 6M",
          rationale: "MDM review could not confirm the glandular cytology. Repeat colposcopy with HPV and cytology in 6 months.",
        };
      }

      // MDM not yet performed → refer for MDM review
      return {
        figure: "FIGURE_7",
        riskLevel: "HIGH",
        recommendation: "Normal colposcopy in glandular abnormality workup — no visible lesion. MDM case review is mandatory.",
        recommendationCode: "F7-NORM-COLP-MDM",
        nextAction: "MDM case review",
        requiresMDMReview: true,
        clinicalWarnings: [
          "Normal colposcopy does NOT exclude glandular pathology",
          "MDM review is mandatory — glandular lesions are often not visible at colposcopy",
        ],
        guidelineReference: "Figure 7 — Glandular Abnormalities: normal colposcopy, MDM required",
        rationale: "No visible lesion at colposcopy in glandular workup. MDM case review is mandatory as glandular lesions may be endocervical or not colposcopically visible.",
      };
    }

    // Unsatisfactory colposcopy
    return {
      figure: "FIGURE_7",
      riskLevel: "MEDIUM",
      recommendation: "Unsatisfactory colposcopy in glandular abnormality workup. Repeat colposcopy required.",
      recommendationCode: "F7-UNSAT-COLP",
      nextAction: "Repeat colposcopy in 3 months",
      recallRequired: true,
      recallIntervalMonths: 3,
      guidelineReference: "Figure 7 — Glandular Abnormalities: unsatisfactory colposcopy",
      rationale: "Unsatisfactory colposcopy prevents adequate assessment. Repeat required.",
    };
  }

  // ── Cytology entry point — route to colposcopy based on glandular code ────────

  // AG5 / AC4: Cytology consistent with invasive adenocarcinoma → urgent
  if (cytologyResult === "AG5" || cytologyResult === "AC4") {
    return {
      figure: "FIGURE_7",
      riskLevel: "URGENT",
      recommendation: "Cytology consistent with invasive adenocarcinoma (AG5/AC4). Urgent colposcopy and gynaecological oncology assessment.",
      recommendationCode: "F7-AG5AC4-URGENT-COLP",
      nextAction: "Urgent colposcopy and gynaecological oncology referral",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P1",
      clinicalWarnings: ["Possible invasive adenocarcinoma on cytology — urgent assessment required"],
      guidelineReference: "Figure 7 — Glandular Abnormalities: AG5/AC4 (invasive)",
      rationale: "Cytology consistent with invasive adenocarcinoma. Urgent colposcopy and oncology assessment required.",
    };
  }

  // AG3, AG4 (high-grade glandular / AIS cytology), AC3: high-grade → urgent colposcopy P1
  // Note: AC2 is handled above (→ gynaecology, not colposcopy, per NZ guidelines Figure 7)
  const highGradeGlandular = ["AG3", "AG4", "AC3"];
  if (highGradeGlandular.includes(cytologyResult ?? "")) {
    return {
      figure: "FIGURE_7",
      riskLevel: "HIGH",
      recommendation: "High-grade glandular abnormality on cytology. Colposcopy referral required — Priority 1.",
      recommendationCode: "F7-HGGLANDULAR-P1-COLP",
      nextAction: "Colposcopy referral — Priority 1 (within 20 working days)",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P1",
      clinicalWarnings: ["High-grade glandular cytology — urgent colposcopy required"],
      guidelineReference: "Figure 7 — Glandular Abnormalities: high-grade (AG3/AG4/AC2/AC3)",
      rationale: "High-grade glandular cytology requires urgent colposcopic assessment to exclude AIS or invasive glandular disease.",
    };
  }

  // AG1, AC1: Low-grade glandular → colposcopy P2
  const lowGradeGlandular = ["AG1", "AC1"];
  if (lowGradeGlandular.includes(cytologyResult ?? "")) {
    return {
      figure: "FIGURE_7",
      riskLevel: "MEDIUM",
      recommendation: "Low-grade glandular abnormality on cytology (AG1/AC1). Colposcopy referral required — Priority 2.",
      recommendationCode: "F7-LGGLANDULAR-P2-COLP",
      nextAction: "Colposcopy referral — Priority 2 (within 42 working days)",
      referralRequired: true,
      referralType: "COLPOSCOPY",
      referralPriority: "P2",
      guidelineReference: "Figure 7 — Glandular Abnormalities: low-grade (AG1/AC1)",
      rationale: "Low-grade glandular cytology requires colposcopic assessment to assess for underlying glandular pathology.",
    };
  }

  // Default — glandular abnormality, manage with colposcopy
  return {
    figure: "FIGURE_7",
    riskLevel: "HIGH",
    recommendation: "Glandular abnormality detected. Colposcopy referral required.",
    recommendationCode: "F7-GLANDULAR-COLP",
    nextAction: "Colposcopy referral",
    referralRequired: true,
    referralType: "COLPOSCOPY",
    referralPriority: "P2",
    guidelineReference: "Figure 7 — Glandular Abnormalities",
    rationale: "Glandular abnormality on cytology. Colposcopy required for assessment.",
  };
}

// ─── FIGURE 8: Post-hysterectomy ───────────────────────────────────────────────

function evaluateFigure8(input: ClinicalInput): ClinicalDecision {
  const { hpvResult, cytologyResult } = input;

  if (!hpvResult) {
    return {
      figure: "FIGURE_8",
      riskLevel: "LOW",
      recommendation: "Post-hysterectomy screening: HPV result required",
      recommendationCode: "F8-PENDING",
      nextAction: "Enter vault HPV test result",
      guidelineReference: "Figure 8 - Post-hysterectomy screening",
      rationale: "Post-hysterectomy patients require vault HPV screening.",
    };
  }

  if (hpvResult === "NOT_DETECTED") {
    return {
      figure: "FIGURE_8",
      riskLevel: "LOW",
      recommendation: "Vault HPV not detected. Routine recall in 5 years.",
      recommendationCode: "F8-NEG-5Y",
      nextAction: "Schedule routine recall in 60 months",
      recallRequired: true,
      recallIntervalMonths: 60,
      nextScreeningIntervalMonths: 60,
      guidelineReference: "Figure 8 - Post-hysterectomy HPV not detected",
      rationale: "HPV not detected post-hysterectomy. Routine 5-year recall.",
    };
  }

  if (hpvResult === "HPV_16_18" || isHighGradeCytology(cytologyResult)) {
    return {
      figure: "FIGURE_8",
      riskLevel: "URGENT",
      recommendation: "High-risk vault result post-hysterectomy. Urgent specialist referral.",
      recommendationCode: "F8-URGENT-SPEC",
      nextAction: "Urgent gynaecology specialist referral",
      referralRequired: true,
      referralType: "SPECIALIST",
      referralPriority: "P1",
      clinicalWarnings: ["Post-hysterectomy high-risk result - specialist assessment required"],
      guidelineReference: "Figure 8 - Post-hysterectomy high-risk",
      rationale: "High-risk vault result post-hysterectomy requires specialist assessment.",
    };
  }

  return {
    figure: "FIGURE_8",
    riskLevel: "MEDIUM",
    recommendation: "HPV Other detected post-hysterectomy. Repeat vault test in 12 months.",
    recommendationCode: "F8-HPVO-12M",
    nextAction: "Repeat vault HPV test in 12 months",
    recallRequired: true,
    recallIntervalMonths: 12,
    guidelineReference: "Figure 8 - Post-hysterectomy HPV Other",
    rationale: "HPV Other post-hysterectomy. Short-interval repeat required.",
  };
}

// ─── FIGURE 9: Pregnant participant with high-grade in situ cytology ──────────
// ASC-H, HSIL, Atypical glandular cells, AIS
// Reference: Figure 9 — Management of pregnant participant with possible/definite
// high-grade in situ cytology (ASC-H, HSIL, Atypical glandular cells, AIS)

function evaluateFigure9(input: ClinicalInput): ClinicalDecision {
  const { colposcopicImpression, biopsyResult, mdmOutcome } = input;

  // ── Invasive cancer found (either directly or via biopsy) ──────────────────
  if (
    colposcopicImpression === "INVASION" ||
    biopsyResult === "SCC" ||
    biopsyResult === "ADENOCARCINOMA"
  ) {
    return {
      figure: "FIGURE_9",
      riskLevel: "URGENT",
      recommendation: "Invasive cancer identified in pregnant participant. Urgent referral to Gynaecological Oncologist required.",
      recommendationCode: "F9-PREG-INVASION-ONCO",
      nextAction: "Urgent referral to Gynaecological Oncologist",
      referralRequired: true,
      referralType: "SPECIALIST",
      referralPriority: "P1",
      clinicalWarnings: [
        "Pregnant participant with invasive cancer — do not delay oncology referral",
        "Gynaecological oncologist must lead management during pregnancy",
      ],
      guidelineReference: "Figure 9 — Pregnant participant: invasion confirmed",
      rationale: "Invasion confirmed in pregnant participant. Immediate gynaecological oncologist referral is required.",
    };
  }

  // ── Normal TZ (no visible lesion on colposcopy) → MDM case review ─────────
  if (!colposcopicImpression || colposcopicImpression === "NORMAL") {
    // MDM outcome drives next step
    if (mdmOutcome === "DOWNGRADED_NEGATIVE") {
      return {
        figure: "FIGURE_9",
        riskLevel: "LOW",
        recommendation: "MDM downgraded cytology to negative. Return to HPV primary screening pathway (Figure 3).",
        recommendationCode: "F9-PREG-MDM-NEG-F3",
        nextAction: "Follow HPV primary screening pathway — Figure 3",
        recallRequired: true,
        recallIntervalMonths: 12,
        guidelineReference: "Figure 9 — Pregnant participant: MDM downgraded to negative",
        rationale: "MDM review downgraded high-grade cytology to negative. Patient returns to regular Figure 3 HPV primary screening.",
      };
    }

    if (mdmOutcome === "DOWNGRADED_LSIL") {
      return {
        figure: "FIGURE_9",
        riskLevel: "MEDIUM",
        recommendation: "MDM downgraded to LSIL / ASC-US. Follow LSIL management pathway.",
        recommendationCode: "F9-PREG-MDM-LSIL",
        nextAction: "Follow pathway for LSIL",
        recallRequired: true,
        recallIntervalMonths: 12,
        guidelineReference: "Figure 9 — Pregnant participant: MDM downgraded to LSIL/ASC-US",
        rationale: "MDM review downgraded to LSIL/ASC-US. Manage according to LSIL pathway.",
      };
    }

    if (mdmOutcome === "CONFIRMED_HIGH_GRADE") {
      return {
        figure: "FIGURE_9",
        riskLevel: "HIGH",
        recommendation: "MDM confirmed high-grade in pregnancy. Colposcopy review in 6 months or at 6–12 weeks postpartum.",
        recommendationCode: "F9-PREG-MDM-HIGHGRADE-6M",
        nextAction: "Colposcopy review in 6 months or at 6–12 weeks postpartum",
        recallRequired: true,
        recallIntervalMonths: 6,
        clinicalWarnings: [
          "High-grade confirmed in pregnancy — defer definitive treatment until postpartum",
          "Postpartum colposcopy review mandatory at 6–12 weeks",
        ],
        guidelineReference: "Figure 9 — Pregnant participant: MDM confirmed high-grade",
        rationale: "Confirmed possible/definite high-grade in pregnancy. Defer treatment; review at 6 months or 6–12 weeks postpartum.",
      };
    }

    // Awaiting MDM review
    return {
      figure: "FIGURE_9",
      riskLevel: "HIGH",
      recommendation: "Normal TZ on colposcopy. MDM case review required before further management.",
      recommendationCode: "F9-PREG-NTZ-MDM",
      nextAction: "MDM case review",
      requiresMDMReview: true,
      clinicalWarnings: [
        "Pregnant participant with high-grade cytology — MDM review is mandatory",
        "Do not treat during pregnancy without MDM guidance",
      ],
      guidelineReference: "Figure 9 — Pregnant participant: normal TZ, MDM pending",
      rationale: "No visible lesion on colposcopy (normal TZ). MDM case review required before proceeding.",
    };
  }

  // ── Abnormal TZ (visible lesion) ───────────────────────────────────────────
  // Colposcopic impression is LSIL, HSIL, or UNSATISFACTORY → proceed to biopsy

  if (biopsyResult) {
    // Biopsy positive for invasion (any grade beyond CIN)
    if (biopsyResult === "AIS" || biopsyResult === "CIN3" || biopsyResult === "CIN2") {
      // Biopsy negative for invasion → MDM case review
      return {
        figure: "FIGURE_9",
        riskLevel: "HIGH",
        recommendation: "Biopsy confirms CIN/AIS — negative for invasion. MDM case review required.",
        recommendationCode: "F9-PREG-ATZ-BX-NEG-MDM",
        nextAction: "MDM case review",
        requiresMDMReview: true,
        clinicalWarnings: [
          "High-grade histology in pregnant participant — MDM review required",
          "Avoid excisional treatment during pregnancy unless invasion confirmed",
        ],
        guidelineReference: "Figure 9 — Pregnant participant: abnormal TZ, biopsy negative for invasion",
        rationale: "Biopsy negative for invasion in pregnant participant. MDM case review to guide management during pregnancy.",
      };
    }

    if (biopsyResult === "CIN1" || biopsyResult === "NORMAL" || biopsyResult === "UNSATISFACTORY") {
      return {
        figure: "FIGURE_9",
        riskLevel: "MEDIUM",
        recommendation: "Biopsy shows low-grade/negative — no invasion. MDM case review.",
        recommendationCode: "F9-PREG-ATZ-BX-LOWGRADE-MDM",
        nextAction: "MDM case review",
        requiresMDMReview: true,
        guidelineReference: "Figure 9 — Pregnant participant: abnormal TZ, low-grade biopsy",
        rationale: "Low-grade or normal biopsy in pregnant participant with colposcopic abnormality. MDM review required.",
      };
    }
  }

  // Abnormal TZ, biopsy pending — colposcopic impression guides next step
  if (colposcopicImpression === "LSIL" || colposcopicImpression === "HSIL" || colposcopicImpression === "UNSATISFACTORY") {
    return {
      figure: "FIGURE_9",
      riskLevel: "HIGH",
      recommendation: "Colposcopic abnormality in pregnancy. Biopsy required to exclude invasion.",
      recommendationCode: "F9-PREG-ATZ-COLP-BX",
      nextAction: "Proceed with biopsy",
      clinicalWarnings: [
        "Pregnant participant with colposcopic abnormality — biopsy required to exclude invasion",
        "LSIL, HSIL (CIN2/3) or AIS at colposcopy requires histological confirmation",
      ],
      guidelineReference: "Figure 9 — Pregnant participant: colposcopic abnormality, biopsy required",
      rationale: "Abnormal TZ with colposcopic impression of LSIL, HSIL (CIN2/3) or AIS. Biopsy required to exclude invasion before managing in pregnancy.",
    };
  }

  // Default — initial colposcopy referral
  return {
    figure: "FIGURE_9",
    riskLevel: "HIGH",
    recommendation: "Pregnant participant with high-grade cytology. Colposcopy required.",
    recommendationCode: "F9-PREG-COLP",
    nextAction: "Colposcopy assessment",
    clinicalWarnings: [
      "High-grade cytology in pregnant participant — colposcopy must be performed",
      "Treatment deferred until after colposcopic assessment and MDM review",
    ],
    guidelineReference: "Figure 9 — Pregnant participant with ASC-H / HSIL / AG / AIS",
    rationale: "Pregnant participant with possible/definite high-grade cytology. Colposcopy required to assess visible lesion and transformation zone.",
  };
}

// ─── FIGURE 10: Investigation of abnormal vaginal bleeding ────────────────────
// Inter-menstrual or post-coital bleeding
// Reference: Figure 10 — Investigation of participants with abnormal vaginal
// bleeding (inter-menstrual or post-coital)

function evaluateFigure10(input: ClinicalInput): ClinicalDecision {
  const {
    abnormalCervix,
    suspicionOfCancer,
    suspectOralContraceptiveProblem,
    stiIdentified,
    bleedingResolved,
  } = input;

  // ── Abnormal cervix ────────────────────────────────────────────────────────
  if (abnormalCervix) {
    // Suspicion of cancer → immediate co-test + colposcopy
    if (suspicionOfCancer) {
      return {
        figure: "FIGURE_10",
        riskLevel: "URGENT",
        recommendation: "Abnormal cervix with suspicion of cancer. Co-test and colposcopy required urgently.",
        recommendationCode: "F10-ABNCRV-CANCER-COLP",
        nextAction: "Urgent co-test and colposcopy",
        referralRequired: true,
        referralType: "COLPOSCOPY",
        referralPriority: "P1",
        clinicalWarnings: [
          "Refer for gynaecological assessment without delay if signs and symptoms of cervical cancer",
          "Urgent co-test and colposcopy — do not delay",
        ],
        guidelineReference: "Figure 10 — Abnormal cervix with suspicion of cancer",
        rationale: "Abnormal cervix on examination with clinical suspicion of cancer. Immediate co-test and colposcopy are required.",
      };
    }

    // Abnormal cervix, no cancer suspicion → treat + 6-8 week review
    if (bleedingResolved === true) {
      return {
        figure: "FIGURE_10",
        riskLevel: "LOW",
        recommendation: "Bleeding resolved after treatment. Continue regular cervical screening.",
        recommendationCode: "F10-ABNCRV-RESOLVED-SCREEN",
        nextAction: "Continue regular cervical screening (if ≥25) or commence screening at age 25",
        recallRequired: true,
        recallIntervalMonths: 36,
        guidelineReference: "Figure 10 — Abnormal cervix, bleeding resolved",
        rationale: "Abnormal cervix treated; bleeding resolved at 6–8 week review. Return to regular cervical screening.",
      };
    }

    if (bleedingResolved === false) {
      return {
        figure: "FIGURE_10",
        riskLevel: "MEDIUM",
        recommendation: "Bleeding not resolved at 6–8 weeks after treatment. Refer to gynaecology.",
        recommendationCode: "F10-ABNCRV-UNRESOLVED-GYN",
        nextAction: "Refer to gynaecology",
        referralRequired: true,
        referralType: "GYNAECOLOGY",
        referralPriority: "P2",
        guidelineReference: "Figure 10 — Abnormal cervix, bleeding unresolved",
        rationale: "Bleeding persists at 6–8 week review despite treatment. Gynaecology referral is required.",
      };
    }

    // Awaiting 6-8 week review
    return {
      figure: "FIGURE_10",
      riskLevel: "MEDIUM",
      recommendation: "Abnormal cervix without suspicion of cancer. Treat as per Healthcare Pathways or refer to gynaecology. Review at 6–8 weeks.",
      recommendationCode: "F10-ABNCRV-TREAT-REVIEW",
      nextAction: "Treat as per Healthcare Pathways or refer to gynaecology. Review at 6–8 weeks.",
      clinicalWarnings: [
        "Refer for gynaecological assessment without delay if signs and symptoms of cervical cancer develop",
      ],
      guidelineReference: "Figure 10 — Abnormal cervix, no cancer suspicion",
      rationale: "Abnormal cervix on examination but no immediate cancer suspicion. Treat per Healthcare Pathways and review in 6–8 weeks.",
    };
  }

  // ── Normal cervix ──────────────────────────────────────────────────────────
  // Suspect oral contraceptive problem?
  if (suspectOralContraceptiveProblem) {
    if (bleedingResolved === true) {
      return {
        figure: "FIGURE_10",
        riskLevel: "LOW",
        recommendation: "OCP adjusted; bleeding resolved. Continue regular cervical screening.",
        recommendationCode: "F10-OCP-RESOLVED-SCREEN",
        nextAction: "Continue regular cervical screening (if ≥25) or commence at age 25",
        recallRequired: true,
        recallIntervalMonths: 36,
        guidelineReference: "Figure 10 — OCP problem, bleeding resolved",
        rationale: "Oral contraceptive adjusted; bleeding resolved at review. Return to regular cervical screening.",
      };
    }

    if (bleedingResolved === false) {
      return {
        figure: "FIGURE_10",
        riskLevel: "MEDIUM",
        recommendation: "Bleeding unresolved after OCP adjustment. Refer to gynaecology.",
        recommendationCode: "F10-OCP-UNRESOLVED-GYN",
        nextAction: "Refer to gynaecology",
        referralRequired: true,
        referralType: "GYNAECOLOGY",
        referralPriority: "P2",
        guidelineReference: "Figure 10 — OCP adjustment, bleeding unresolved",
        rationale: "Bleeding not resolved after OCP adjustment at 6–8 week review. Gynaecology referral required.",
      };
    }

    return {
      figure: "FIGURE_10",
      riskLevel: "MEDIUM",
      recommendation: "Suspected oral contraceptive problem. Adjust oral contraceptive and review in 6–8 weeks.",
      recommendationCode: "F10-OCP-ADJUST",
      nextAction: "Adjust oral contraceptive. Review bleeding in 6–8 weeks.",
      guidelineReference: "Figure 10 — Suspected OCP problem",
      rationale: "Suspected oral contraceptive-related bleeding on normal cervix. Adjust OCP and review in 6–8 weeks.",
    };
  }

  // ── Normal cervix, no OCP issue → investigate ────────────────────────────
  // (Investigations as per Healthcare Pathways or consult local gynaecology)
  if (stiIdentified === true) {
    if (bleedingResolved === true) {
      return {
        figure: "FIGURE_10",
        riskLevel: "LOW",
        recommendation: "STI treated; bleeding resolved. Continue regular cervical screening.",
        recommendationCode: "F10-STI-RESOLVED-SCREEN",
        nextAction: "Continue regular cervical screening (if ≥25) or commence at age 25",
        recallRequired: true,
        recallIntervalMonths: 36,
        guidelineReference: "Figure 10 — STI identified, bleeding resolved",
        rationale: "STI treated; bleeding resolved at 6–8 week review. Return to regular cervical screening.",
      };
    }

    if (bleedingResolved === false) {
      return {
        figure: "FIGURE_10",
        riskLevel: "MEDIUM",
        recommendation: "STI treated but bleeding persists. Refer to gynaecology.",
        recommendationCode: "F10-STI-UNRESOLVED-GYN",
        nextAction: "Refer to gynaecology",
        referralRequired: true,
        referralType: "GYNAECOLOGY",
        referralPriority: "P2",
        guidelineReference: "Figure 10 — STI treated, bleeding unresolved",
        rationale: "STI treated but bleeding not resolved at 6–8 week review. Gynaecology referral required.",
      };
    }

    return {
      figure: "FIGURE_10",
      riskLevel: "MEDIUM",
      recommendation: "STI identified. Treat STI and review bleeding in 6–8 weeks.",
      recommendationCode: "F10-STI-TREAT",
      nextAction: "Treat STI. Review bleeding resolution in 6–8 weeks.",
      guidelineReference: "Figure 10 — STI identified",
      rationale: "STI found on investigation as cause of abnormal vaginal bleeding. Treat STI and review in 6–8 weeks.",
    };
  }

  if (stiIdentified === false) {
    if (bleedingResolved === true) {
      return {
        figure: "FIGURE_10",
        riskLevel: "LOW",
        recommendation: "No STI found; bleeding resolved. Continue regular cervical screening.",
        recommendationCode: "F10-NSTI-RESOLVED-SCREEN",
        nextAction: "Continue regular cervical screening (if ≥25) or commence at age 25",
        recallRequired: true,
        recallIntervalMonths: 36,
        guidelineReference: "Figure 10 — No STI, bleeding resolved",
        rationale: "No STI identified; bleeding resolved. Return to regular cervical screening.",
      };
    }

    if (bleedingResolved === false) {
      return {
        figure: "FIGURE_10",
        riskLevel: "MEDIUM",
        recommendation: "No STI found; bleeding unresolved. Refer to gynaecology.",
        recommendationCode: "F10-NSTI-UNRESOLVED-GYN",
        nextAction: "Refer to gynaecology",
        referralRequired: true,
        referralType: "GYNAECOLOGY",
        referralPriority: "P2",
        guidelineReference: "Figure 10 — No STI, bleeding unresolved",
        rationale: "No STI identified; investigations completed but bleeding persists. Gynaecology referral required.",
      };
    }

    return {
      figure: "FIGURE_10",
      riskLevel: "MEDIUM",
      recommendation: "No STI identified. Further investigations per Healthcare Pathways or gynaecology consultation.",
      recommendationCode: "F10-NSTI-INVESTIGATE",
      nextAction: "Further investigations per Healthcare Pathways or consult local gynaecology. Review in 6–8 weeks.",
      guidelineReference: "Figure 10 — No STI, further investigations required",
      rationale: "No STI found on initial investigations. Manage per Healthcare Pathways or consult local gynaecology; review in 6–8 weeks.",
    };
  }

  // ── Default: initial assessment ────────────────────────────────────────────
  return {
    figure: "FIGURE_10",
    riskLevel: "MEDIUM",
    recommendation: "Abnormal vaginal bleeding. Consider full history and perform speculum, pelvic exam and co-test.",
    recommendationCode: "F10-INIT-ASSESS",
    nextAction: "Take history (menstrual, contraceptive, sexual). Perform speculum, pelvic exam and co-test.",
    clinicalWarnings: [
      "Refer for gynaecological assessment without delay if signs or symptoms of cervical cancer are present",
    ],
    guidelineReference: "Figure 10 — Abnormal vaginal bleeding: initial assessment",
    rationale: "Initial assessment for inter-menstrual or post-coital bleeding. Full history and co-test required before pathway determination.",
  };
}

// ─── Table 1: Routine Case Management ─────────────────────────────────────────

function evaluateTable1(input: ClinicalInput): ClinicalDecision {
  const { hpvResult, cytologyResult, consecutiveNegativeCoTestCount } = input;

  // Rule: Two consecutive negative co-tests → 5-year recall
  if (consecutiveNegativeCoTestCount >= 2) {
    return {
      figure: "TABLE_1",
      riskLevel: "LOW",
      recommendation: "Two consecutive negative co-tests. Routine 5-year recall.",
      recommendationCode: "T1-2NEG-5Y",
      nextAction: "Routine recall in 60 months",
      recallRequired: true,
      recallIntervalMonths: 60,
      nextScreeningIntervalMonths: 60,
      guidelineReference: "Table 1 - Rule: 2 consecutive negative co-tests",
      rationale: "Two consecutive negative co-tests demonstrates low risk. 5-year recall.",
    };
  }

  // Default Table 1 evaluation
  return evaluateFigure3(input);
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function evaluateClinicalDecision(input: ClinicalInput): ClinicalDecision {
  // ── Figure 9: Pregnant participant with high-grade cytology ───────────────
  // Triggered when isPregnant=true OR explicitly set as current figure
  if (
    input.isPregnant ||
    input.currentFigure === "FIGURE_9"
  ) {
    return evaluateFigure9(input);
  }

  // ── Figure 10: Abnormal vaginal bleeding ──────────────────────────────────
  // Triggered when hasAbnormalVaginalBleeding=true OR explicitly set
  if (
    input.hasAbnormalVaginalBleeding ||
    input.currentFigure === "FIGURE_10"
  ) {
    return evaluateFigure10(input);
  }

  // ── Module A: First-time HPV transition (Figures 1 & 2) ──────────────────
  if (input.isFirstTimeHPVTransition && !input.isPostHysterectomy) {
    const hasPreviousAbnormal = input.atypicalEndometrialHistory;
    if (hasPreviousAbnormal) {
      return evaluateFigure2(input);
    }
    return evaluateFigure1(input);
  }

  // ── Post-hysterectomy vault screening (Figure 8) ──────────────────────────
  if (input.isPostHysterectomy) {
    return evaluateFigure8(input);
  }

  // ── Glandular abnormalities routing (Figure 7) ────────────────────────────
  // AG1, AG2, AG3, AG4, AG5, AC1, AC2, AC3, AC4 → dedicated glandular pathway
  // AG2 also caught here (direct gynaecology — not just via atypicalEndometrialHistory)
  const glandularCytologyCodes = ["AG1", "AG2", "AG3", "AG4", "AG5", "AC1", "AC2", "AC3", "AC4"];
  if (
    glandularCytologyCodes.includes(input.cytologyResult ?? "") ||
    input.currentFigure === "FIGURE_7"
  ) {
    return evaluateFigure7(input);
  }

  // ── Colposcopy / histology routing (Figures 4 & 5) ────────────────────────
  // Only enter colposcopy figures when NOT pregnant (Figure 9 handles pregnant colposcopy)
  if (
    input.currentFigure === "FIGURE_4" ||
    input.colposcopicImpression ||
    input.biopsyResult
  ) {
    if (
      input.biopsyResult === "CIN2" ||
      input.biopsyResult === "CIN3" ||
      input.biopsyResult === "AIS" ||
      input.biopsyResult === "SCC" ||
      input.biopsyResult === "ADENOCARCINOMA" ||
      input.currentFigure === "FIGURE_5"
    ) {
      return evaluateFigure5(input);
    }
    return evaluateFigure4(input);
  }

  // ── Test of Cure (Figure 6) ───────────────────────────────────────────────
  if (input.currentFigure === "FIGURE_6") {
    return evaluateFigure6(input);
  }

  // Note: FIGURE_7 routing is handled above (glandular abnormalities check),
  // so no additional currentFigure === "FIGURE_7" check is needed here.

  // ── Table 1: Routine case management ─────────────────────────────────────
  if (input.currentFigure === "TABLE_1") {
    return evaluateTable1(input);
  }

  // ── Default: Primary HPV Screening (Figure 3) ─────────────────────────────
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
