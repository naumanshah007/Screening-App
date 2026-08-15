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
import type { CanonicalClinicalFactsV2 } from "@/lib/clinical-rules/canonical-facts-v2";

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
  | "manual"
  | "hl7"
  | "fhir"
  | "erms"
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

  // ── Episode identity ────────────────────────────────────────────────────
  //
  // Held in clear, never only as a hash. A reviewer asked to accept that two
  // results are the same episode is entitled to see "accession A12345 from
  // Awanui Labs", not a fingerprint.

  /**
   * The source's identifier for this specimen or episode — accession number,
   * specimen ID, lab number.
   *
   * NOT a message control ID. A control number names one transmission and
   * changes when the same episode is resent or amended; an accession names the
   * specimen and does not. Transport identity lives on the ingestion receipt.
   */
  sourceEpisodeKey?: string;
  /**
   * The facility the result came from, e.g. "Awanui Labs — Auckland".
   *
   * Distinct from the tenant: a lab sends results to a service, and the two are
   * different parties. The tenant is on the batch run.
   */
  sourceFacility?: string;
  /** Test type this episode represents, e.g. "HPV", "LBC", "HISTOLOGY". */
  testType?: string;
  /** ISO-8601 date the specimen was collected. */
  collectedOn?: string;
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

  // ── Display identity (optional; synthetic in demo, from source PID in prod) ─
  /** Patient display name. Not used by the engine — worklist display only. */
  patientName?: string;
  /** NHI (National Health Index) number. Display only. */
  nhi?: string;
  /** Referring GP practice name. Display only. */
  gpPractice?: string;
  /** ISO-8601 date the referral/result was received by the source system. */
  receivedDate?: string;

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
  /** The router/Legacy outcome retained as technical provenance when canonical is operative. */
  legacyDecision?: ClinicalDecision;
  clinicalAuthority?: {
    authorityEngine: "LEGACY" | "CANONICAL";
    reason?: string | null;
  };
  /** V2 facts persisted only for canonical shadow evaluation. */
  canonicalFactsV2?: CanonicalClinicalFactsV2;
  /** Persisted canonical result shown as comparison evidence, never authority. */
  canonicalShadow?: {
    reviewItemId?: string;
    evaluationId: string;
    evaluationMode: string;
    ruleVersionDisplay: string;
    rulesetChecksum: string;
    engineVersion: string;
    provisionalRecommendation: string;
    reviewerRequirement: string;
    clinicianOnly: boolean;
    /** Governed timing text, e.g. "12 months". Classified for display, never parsed. */
    repeatInterval?: string | null;
    evaluatedAt?: string | null;
    matchedRuleIds: string[];
    branchPath: string[];
    missingInformation: string[];
    sourceReferences: Array<{ document: string; reference: string }>;
    factDiagnostics?: {
      factsUsed?: string[];
      factsMissing?: string[];
      factsIgnored?: string[];
      factsConflicting?: string[];
      provenanceSources?: string[];
    };
    legacyComparison?: unknown;
  };
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
  /** Number of source records presented to the adapter, before any row is skipped. */
  sourceRecordCount: number;
  rows: ParsedSourceRow[];
  warnings: ParseWarning[];
  errors: ParseError[];
  /** All column names found in the source. */
  detectedColumns: string[];
  /** Column names that don't match any known engine field. */
  unmappedColumns: string[];
}

/**
 * Durable receipt for the client-side parsing step. It travels with the batch
 * run so an operator can reconcile the original delivery without relying on
 * transient upload-screen state.
 */
export interface IntakeParseManifest {
  schemaVersion: 1;
  sourceRecordCount: number;
  parsedRecordCount: number;
  skippedRecordCount: number;
  /** Rows currently prepared after explicit operator additions/removals. */
  preparedRecordCount: number;
  warnings: ParseWarning[];
  errors: ParseError[];
  detectedColumns: string[];
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
