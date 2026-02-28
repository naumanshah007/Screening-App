// Clinical Decision Engine Types
// NZ Cervical Screening Clinical Practice Guidelines

export type HPVResult = "NOT_DETECTED" | "HPV_16_18" | "HPV_OTHER" | "INADEQUATE";

export type CytologyResult =
  | "NEGATIVE"
  | "ASC_US"
  | "LSIL"
  | "ASC_H"
  | "HSIL"
  | "SCC"
  | "AG1"
  | "AG2"
  | "AG3"
  | "AG4"
  | "AG5"
  | "AC1"
  | "AC2"
  | "AC3"
  | "AC4"
  | "UNSATISFACTORY";

export type HistologyResult =
  | "NORMAL"
  | "CIN1"
  | "CIN2"
  | "CIN3"
  | "AIS"
  | "SCC"
  | "ADENOCARCINOMA"
  | "UNSATISFACTORY";

export type TZType = "TYPE1" | "TYPE2" | "TYPE3";
export type SampleType = "LBC" | "SWAB";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ReferralPriority = "P1" | "P2" | "P3" | "P4";
export type PathwayFigure =
  | "FIGURE_1"
  | "FIGURE_2"
  | "FIGURE_3"
  | "FIGURE_4"
  | "FIGURE_5"
  | "FIGURE_6"
  | "FIGURE_7"
  | "FIGURE_8"
  | "FIGURE_9"
  | "FIGURE_10"
  | "TABLE_1";

export type ReferralType = "COLPOSCOPY" | "GYNAECOLOGY" | "MDM" | "SPECIALIST";

// Input to the decision engine for a single evaluation
export interface ClinicalInput {
  // Patient context
  patientId: string;
  patientAge?: number;                    // Age in years — used for age ≥50 branch in Figure 3
  isFirstTimeHPVTransition: boolean;      // Phase 1 fix: Module A routing
  previousScreeningType?: "CYTOLOGY" | "HPV";
  isPostHysterectomy: boolean;
  atypicalEndometrialHistory: boolean;   // Phase 1 fix: AG2 routing
  immunocompromised: boolean;

  // Current test results
  hpvResult?: HPVResult;
  cytologyResult?: CytologyResult;
  histologyResult?: HistologyResult;
  sampleType?: SampleType;
  tzType?: TZType;

  // Session counters (Phase 1 fixes)
  consecutiveNegativeCoTestCount: number;
  consecutiveLowGradeCount: number;
  unsatisfactoryCytologyCount: number;

  // Figure 9: Pregnant participant with high-grade cytology
  isPregnant?: boolean;

  // Figure 10: Abnormal vaginal bleeding
  hasAbnormalVaginalBleeding?: boolean;
  abnormalCervix?: boolean;
  suspicionOfCancer?: boolean;
  suspectOralContraceptiveProblem?: boolean;
  stiIdentified?: boolean;
  bleedingResolved?: boolean;

  // Test of Cure flag — set true when nurse answers "Yes" to is_test_of_cure wizard step.
  // When true, evaluateClinicalDecision routes to Figure 6 (Test of Cure pathway).
  isTestOfCure?: boolean;

  // Session context
  currentFigure?: PathwayFigure;
  previousRecommendation?: string;

  // Colposcopy finding (when applicable)
  colposcopicImpression?: "NORMAL" | "LSIL" | "HSIL" | "INVASION" | "UNSATISFACTORY";
  biopsyResult?: HistologyResult;
  colposcopyTZType?: TZType;
  mdmOutcome?: string;
}

// Output from the decision engine
export interface ClinicalDecision {
  figure: PathwayFigure;
  riskLevel: RiskLevel;
  recommendation: string;
  recommendationCode: string;
  nextAction: string;
  nextScreeningIntervalMonths?: number;
  referralRequired?: boolean;
  referralType?: ReferralType;
  referralPriority?: ReferralPriority;
  referralReason?: string;
  recallRequired?: boolean;
  recallIntervalMonths?: number;
  // Counter updates
  incrementConsecutiveNegative?: boolean;
  incrementConsecutiveLowGrade?: boolean;
  incrementUnsatisfactory?: boolean;
  resetConsecutiveNegative?: boolean;
  resetConsecutiveLowGrade?: boolean;
  resetUnsatisfactory?: boolean;
  // Flags
  requiresMDMReview?: boolean;
  requiresSwabRepeat?: boolean;
  clinicalWarnings?: string[];
  // Contextual help (for UI display)
  guidelineReference?: string;
  rationale?: string;
}
