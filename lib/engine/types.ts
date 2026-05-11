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

export type SafetyOutcome =
  | "INSUFFICIENT_INFORMATION"
  | "CLINICIAN_REVIEW_REQUIRED"
  | "EXTERNAL_HISTORY_REQUIRED"
  | "NOT_IN_PHASE_1_SCOPE";

export type ScreeningStatus =
  | "NEVER_SCREENED"
  | "UNDER_SCREENED"
  | "OVERDUE"
  | "REGULAR_SCREENING"
  | "UNKNOWN";

export type PriorScreeningHistory =
  | "NEGATIVE_OR_NORMAL"
  | "LOW_GRADE_ONLY"
  | "LOW_GRADE_RETURNED_TO_REGULAR"
  | "LOW_GRADE_NOT_RETURNED_TO_REGULAR"
  | "HIGH_GRADE_TOC_COMPLETE"
  | "HIGH_GRADE_TOC_INCOMPLETE"
  | "HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED"
  | "PREVIOUS_AIS"
  | "PREVIOUS_ATYPICAL_GLANDULAR"
  | "PREVIOUS_ATYPICAL_ENDOMETRIAL"
  | "NO_KNOWN_SCREENING_HISTORY"
  | "UNKNOWN";

export type TestOfCureStatus =
  | "NOT_REQUIRED"
  | "REQUIRED"
  | "INCOMPLETE"
  | "COMPLETE"
  | "SUCCESSFULLY_COMPLETED"
  | "UNKNOWN";

export type TestOfCureStage = "FIRST_TEST" | "SECOND_TEST" | "CONTINUING";
export type RepeatStage = "BASELINE" | "FIRST_REPEAT" | "SECOND_REPEAT";
export type RepeatContext =
  | "PRIMARY_HPV"
  | "POST_NORMAL_COLPOSCOPY_LOW_GRADE_CYTOLOGY"
  | "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY"
  | "TEST_OF_CURE";

export type HysterectomyIndication = "BENIGN_GYNAECOLOGICAL_DISEASE" | "HSIL_CIN23_OR_AIS";
export type HysterectomySpecimenPathology =
  | "NO_CERVICAL_PATHOLOGY"
  | "NORMAL"
  | "LSIL_CIN1"
  | "HSIL_CIN23"
  | "AIS";
export type ExcisionStatus = "COMPLETE" | "INCOMPLETE" | "NOT_APPLICABLE" | "UNKNOWN";
export type TransformationZoneState = "NORMAL" | "ABNORMAL";
export type ColposcopicImpression = "NORMAL" | "LSIL" | "HSIL" | "AIS" | "INVASION" | "UNSATISFACTORY";
export type AbnormalBleedingStage = "INITIAL_ASSESSMENT" | "SIX_TO_EIGHT_WEEK_REVIEW";
export type BleedingType = "INTER_MENSTRUAL" | "POST_COITAL" | "BOTH" | "UNSPECIFIED";

// Input to the decision engine for a single evaluation
export interface ClinicalInput {
  // Patient context
  patientId: string;
  patientAge?: number;                    // Age in years — used for age boundaries and ≥50 branch in Figure 3
  ethnicityPrimary?: string;              // NZ ethnicity code (Level 2): e.g. "21" Māori, "30" Pacific, etc.
  isFirstTimeHPVTransition: boolean;      // Phase 1 fix: Module A routing
  previousScreeningType?: "CYTOLOGY" | "HPV";
  screeningStatus?: ScreeningStatus;
  screeningHistoryKnown?: boolean;
  priorScreeningHistory?: PriorScreeningHistory;
  priorLowGradeResult?: boolean;
  priorHighGradeResult?: boolean;
  previousHSILCIN23?: boolean;
  previousAIS?: boolean;
  previousAtypicalGlandularCells?: boolean;
  previousAtypicalEndometrialCells?: boolean;
  ag2ReportDate?: string | Date;
  specialistDischargedToPrimaryCare?: boolean;
  colposcopyRecommendedInLastCytology?: boolean;
  colposcopyCompletedForLastRecommendation?: boolean;
  historySourceAvailable?: boolean;
  isPostHysterectomy: boolean;
  hysterectomyType?: "TOTAL" | "SUBTOTAL"; // Subtotal (cervix-sparing) may still need cervical screening
  hysterectomyDate?: string | Date;
  hysterectomyIndication?: HysterectomyIndication;
  hysterectomySpecimenPathology?: HysterectomySpecimenPathology;
  excisionStatus?: ExcisionStatus;
  postHysterectomyHpvTestIndicated?: boolean;
  atypicalEndometrialHistory: boolean;   // Phase 1 fix: AG2 routing
  immunocompromised: boolean;
  swabReturnVisitCompleted?: boolean;     // SWAB sample: has patient returned for clinical examination?
  repeatStage?: RepeatStage;
  repeatContext?: RepeatContext;

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
  testOfCureStatus?: TestOfCureStatus;
  testOfCureStage?: TestOfCureStage;
  treatmentDate?: string | Date;

  // Figure 9: Pregnant participant with high-grade cytology
  isPregnant?: boolean;
  postpartumReviewTiming?: "SIX_MONTHS" | "SIX_TO_TWELVE_WEEKS_POSTPARTUM";
  expectedDeliveryDate?: string | Date;

  // Figure 10: Abnormal vaginal bleeding
  hasAbnormalVaginalBleeding?: boolean;
  abnormalBleedingStage?: AbnormalBleedingStage;
  bleedingType?: BleedingType;
  hasCancerSymptoms?: boolean;
  menstrualHistoryCaptured?: boolean;
  contraceptiveHistoryCaptured?: boolean;
  sexualHistoryCaptured?: boolean;
  speculumExamCompleted?: boolean;
  pelvicExamCompleted?: boolean;
  coTestCompleted?: boolean;
  abnormalCervix?: boolean;
  suspicionOfCancer?: boolean;
  suspectOralContraceptiveProblem?: boolean;
  oralContraceptiveAdjusted?: boolean;
  stiIdentified?: boolean;
  stiTreated?: boolean;
  bleedingResolved?: boolean;
  bleedingReviewDueDate?: string | Date;

  // Test of Cure flag — set true when nurse answers "Yes" to is_test_of_cure wizard step.
  // When true, evaluateClinicalDecision routes to Figure 6 (Test of Cure pathway).
  isTestOfCure?: boolean;

  // Session context
  currentFigure?: PathwayFigure;
  previousRecommendation?: string;

  // Colposcopy finding (when applicable)
  normalColposcopy?: boolean;
  visibleLesion?: boolean;
  transformationZoneState?: TransformationZoneState;
  colposcopicImpression?: ColposcopicImpression;
  biopsyResult?: HistologyResult;
  biopsyPositiveForInvasion?: boolean;
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
  safetyOutcome?: SafetyOutcome;
  missingInformation?: string[];
  externalDependencies?: string[];
  branchPath?: string[];
  ruleVersion?: string;
  validationStatus?: "IMPLEMENTED" | "REQUIRES_CLINICAL_CONFIRMATION" | "EXTERNAL_DEPENDENCY";
  // Contextual help (for UI display)
  guidelineReference?: string;
  rationale?: string;
}
