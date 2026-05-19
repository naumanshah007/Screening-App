/**
 * Batch Processing — Type Definitions
 *
 * Five distinct data layers:
 *   1. RawSourceRow      — untyped data straight from the file/source
 *   2. ParsedSourceRow   — typed fields after adapter parsing, before validation
 *   3. CanonicalBatchCase — validated, enriched with source metadata, engine-ready
 *   4. ClinicalInput     — (from lib/engine/types.ts) what the engine consumes
 *   5. BatchCaseResult   — case + engine decision + processing metadata
 */

import type {
  ClinicalInput,
  ClinicalDecision,
  HPVResult,
  CytologyResult,
  HistologyResult,
  SampleType,
  TZType,
  RepeatContext,
  RepeatStage,
  TestOfCureStage,
  TestOfCureStatus,
  ScreeningStatus,
  PriorScreeningHistory,
  AbnormalBleedingStage,
  BleedingType,
  HysterectomyIndication,
  HysterectomySpecimenPathology,
  ExcisionStatus,
  TransformationZoneState,
  ColposcopicImpression,
} from "@/lib/engine/types";

// ─── Layer 1: Raw Source Row ─────────────────────────────────────────────────

/** Untyped key-value pairs straight from the file/source. */
export type RawSourceRow = Record<string, unknown>;

// ─── Layer 2: Parsed Source Row ──────────────────────────────────────────────

/** After adapter parsing — typed but NOT validated against engine enums yet. */
export interface ParsedSourceRow {
  /** Original position in the source file (0-based). */
  _rowIndex: number;
  /** Column names found in source (for unmapped-column detection). */
  _sourceFields: string[];
  /** All parsed fields. */
  [key: string]: unknown;
}

// ─── Source Metadata ─────────────────────────────────────────────────────────

export type SourceType =
  | "demo"
  | "csv"
  | "xlsx"
  | "json"
  | "hl7"
  | "fhir"
  | "health-nz";

export interface SourceMetadata {
  /** Adapter/source type that produced this row. */
  sourceType: SourceType;
  /** Name of the originating system, e.g. "Labnet", "Counties Manukau DHB". */
  sourceSystem?: string;
  /** Original filename (for file uploads). */
  sourceFileName?: string;
  /** ISO-8601 timestamp of when the data was imported. */
  importedAt: string;
  /** Original row number in the source (1-based for human display). */
  rowNumber: number;
  /** Patient identifier from the external source (e.g. NHI). */
  externalPatientId?: string;
  /** Version of the adapter/mapping used, e.g. "csv-v1". */
  mappingVersion: string;
  /** Version of the decision engine used. */
  engineVersion: string;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning";
export type ValidationStatus = "valid" | "warnings" | "invalid";

export interface ValidationIssue {
  field: string;
  message: string;
  severity: ValidationSeverity;
  /** The problematic value (if available). */
  value?: unknown;
}

// ─── Layer 3: Canonical Batch Case ───────────────────────────────────────────

/**
 * Validated, engine-ready representation with source metadata.
 * Clinical fields mirror ClinicalInput but are grouped for clarity.
 */
export interface CanonicalBatchCase {
  // ── Identity ────────────────────────────────────────────────────────────
  /** Auto-generated UUID. */
  caseId: string;
  /** Optional display label, e.g. "Case 7 — HPV 16/18 + HSIL". */
  label?: string;

  // ── Source metadata ─────────────────────────────────────────────────────
  source: SourceMetadata;

  // ── Patient context ─────────────────────────────────────────────────────
  patientAge?: number;
  ethnicityPrimary?: string;
  isFirstTimeHPVTransition: boolean;
  isPostHysterectomy: boolean;
  hysterectomyType?: "TOTAL" | "SUBTOTAL";
  hysterectomyIndication?: HysterectomyIndication;
  hysterectomySpecimenPathology?: HysterectomySpecimenPathology;
  excisionStatus?: ExcisionStatus;
  postHysterectomyHpvTestIndicated?: boolean;
  immunocompromised: boolean;
  atypicalEndometrialHistory: boolean;

  // ── Screening history ───────────────────────────────────────────────────
  screeningStatus?: ScreeningStatus;
  screeningHistoryKnown?: boolean;
  priorScreeningHistory?: PriorScreeningHistory;
  priorLowGradeResult?: boolean;
  priorHighGradeResult?: boolean;
  previousHSILCIN23?: boolean;
  previousAIS?: boolean;
  previousAtypicalGlandularCells?: boolean;
  previousAtypicalEndometrialCells?: boolean;
  historySourceAvailable?: boolean;

  // ── Current test results ────────────────────────────────────────────────
  hpvResult?: HPVResult;
  cytologyResult?: CytologyResult;
  histologyResult?: HistologyResult;
  sampleType?: SampleType;
  tzType?: TZType;

  // ── Session / repeat context ────────────────────────────────────────────
  repeatContext?: RepeatContext;
  repeatStage?: RepeatStage;
  testOfCureStage?: TestOfCureStage;
  testOfCureStatus?: TestOfCureStatus;
  isTestOfCure?: boolean;
  consecutiveNegativeCoTestCount: number;
  consecutiveLowGradeCount: number;
  unsatisfactoryCytologyCount: number;

  // ── Figure 9: Pregnancy ─────────────────────────────────────────────────
  isPregnant?: boolean;
  postpartumReviewTiming?: "SIX_MONTHS" | "SIX_TO_TWELVE_WEEKS_POSTPARTUM";

  // ── Figure 10: Abnormal vaginal bleeding ────────────────────────────────
  hasAbnormalVaginalBleeding?: boolean;
  abnormalBleedingStage?: AbnormalBleedingStage;
  bleedingType?: BleedingType;
  hasCancerSymptoms?: boolean;
  abnormalCervix?: boolean;
  suspicionOfCancer?: boolean;
  suspectOralContraceptiveProblem?: boolean;
  stiIdentified?: boolean;
  bleedingResolved?: boolean;

  // ── Colposcopy findings ─────────────────────────────────────────────────
  normalColposcopy?: boolean;
  visibleLesion?: boolean;
  transformationZoneState?: TransformationZoneState;
  colposcopicImpression?: ColposcopicImpression;
  biopsyResult?: HistologyResult;
  colposcopyTZType?: TZType;
  mdmOutcome?: string;

  // ── SWAB return visit ───────────────────────────────────────────────────
  swabReturnVisitCompleted?: boolean;

  // ── Validation state ────────────────────────────────────────────────────
  validationStatus: ValidationStatus;
  validationErrors: ValidationIssue[];
  validationWarnings: ValidationIssue[];
}

// ─── Layer 5: Batch Case Result ──────────────────────────────────────────────

export interface BatchCaseResult {
  /** The validated case that was processed. */
  case: CanonicalBatchCase;
  /** The ClinicalInput that was sent to the engine. */
  input: ClinicalInput;
  /** The ClinicalDecision the engine returned. */
  decision: ClinicalDecision;
  /** Processing time for this row in milliseconds. */
  processingTimeMs: number;
  /** Whether the engine call succeeded. */
  status: "success" | "error";
  /** Error message if status is "error". */
  error?: string;
}

// ─── Batch Processing Result (aggregate) ─────────────────────────────────────

export interface BatchProcessingResult {
  results: BatchCaseResult[];
  totalTimeMs: number;
  processedCount: number;
  errorCount: number;
  errors: Array<{ caseId: string; error: string }>;
  /** Metadata for the entire batch run. */
  sourceType: SourceType;
  sourceFileName?: string;
  processedAt: string;
  engineVersion: string;
}

// ─── Adapter Interface ───────────────────────────────────────────────────────

export interface ParseWarning {
  rowIndex: number;
  field: string;
  message: string;
}

export interface ParseError {
  rowIndex: number;
  field?: string;
  message: string;
}

export interface AdapterParseResult {
  rows: ParsedSourceRow[];
  warnings: ParseWarning[];
  errors: ParseError[];
  /** All column names found in the source. */
  detectedColumns: string[];
  /** Column names that don't match any known engine field. */
  unmappedColumns: string[];
}

/**
 * DataSourceAdapter — the extensibility seam for data sources.
 *
 * Today:  DemoDatasetAdapter, CSVUploadAdapter, ExcelUploadAdapter, JSONUploadAdapter
 * Later:  FHIRBundleAdapter, HL7MessageAdapter, HealthNZConnector, etc.
 *
 * Each adapter takes raw input from its specific source and returns
 * ParsedSourceRow[]. The downstream validation, mapping, processing,
 * and UI remain unchanged regardless of source.
 */
export interface DataSourceAdapter<TRaw = unknown> {
  /** Human-readable name for this data source. */
  readonly name: string;
  /** Unique source type identifier. */
  readonly sourceType: SourceType;
  /** File extensions this adapter handles, e.g. [".csv"]. */
  readonly fileExtensions?: string[];
  /** Parse raw input into ParsedSourceRow[]. */
  parse(raw: TRaw, fileName?: string): Promise<AdapterParseResult>;
}

// ─── Re-exports for convenience ──────────────────────────────────────────────

export type {
  ClinicalInput,
  ClinicalDecision,
  HPVResult,
  CytologyResult,
  HistologyResult,
  SampleType,
  TZType,
  RepeatContext,
  RepeatStage,
  TestOfCureStage,
  TestOfCureStatus,
  ScreeningStatus,
  PriorScreeningHistory,
  AbnormalBleedingStage,
  BleedingType,
  HysterectomyIndication,
  HysterectomySpecimenPathology,
  ExcisionStatus,
  TransformationZoneState,
  ColposcopicImpression,
};
