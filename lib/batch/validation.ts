/**
 * Batch Processing — Validation Layer
 *
 * Validates ParsedSourceRow[] → CanonicalBatchCase[] using Zod v4.
 * Handles:
 *   - Boolean coercion (string "true"/"yes"/"1" → true)
 *   - Enum validation against engine types
 *   - Required field defaults (e.g. counter fields default to 0)
 *   - Duplicate externalPatientId detection
 *   - Missing required field detection
 *   - Unknown/unmapped column detection
 *   - Per-row error + warning collection (never throws, always returns)
 */

import { z } from "zod";
import type {
  ParsedSourceRow,
  CanonicalBatchCase,
  SourceMetadata,
  ValidationIssue,
  ValidationStatus,
} from "./types";
import {
  HPV_RESULTS,
  CYTOLOGY_RESULTS,
  HISTOLOGY_RESULTS,
  SAMPLE_TYPES,
  TZ_TYPES,
  REPEAT_CONTEXTS,
  REPEAT_STAGES,
  TEST_OF_CURE_STAGES,
  SCREENING_STATUSES,
  PRIOR_SCREENING_HISTORIES,
  HYSTERECTOMY_INDICATIONS,
  HYSTERECTOMY_SPECIMEN_PATHOLOGIES,
  EXCISION_STATUSES,
  ABNORMAL_BLEEDING_STAGES,
  BLEEDING_TYPES,
  COLPOSCOPIC_IMPRESSIONS,
  TRANSFORMATION_ZONE_STATES,
  buildColumnLookup,
  getKnownFieldNames,
} from "./template-columns";

// ─── Boolean coercion ────────────────────────────────────────────────────────

const TRUE_VALUES = new Set(["true", "yes", "1", "y", "on"]);
const FALSE_VALUES = new Set(["false", "no", "0", "n", "off", ""]);

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (TRUE_VALUES.has(lower)) return true;
    if (FALSE_VALUES.has(lower)) return false;
    return undefined; // invalid
  }
  if (value === null || value === undefined) return undefined;
  return undefined;
}

/** Zod transform that coerces string booleans. */
const booleanCoerce = z
  .union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    const result = coerceBoolean(v);
    return result ?? false;
  });

const optionalBooleanCoerce = z
  .union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    return coerceBoolean(v);
  });

/** Zod transform for optional enums — normalises to uppercase and validates. */
function optionalEnum<T extends readonly string[]>(allowed: T) {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return undefined;
      const upper = String(v).trim().toUpperCase();
      return allowed.includes(upper as T[number]) ? upper : v;
    });
}

// ─── Zod Schema for a single batch row ───────────────────────────────────────

const batchRowSchema = z.object({
  // Identity
  label: z.union([z.string(), z.null(), z.undefined()]).transform((v) => v ?? undefined),
  externalPatientId: z.union([z.string(), z.null(), z.undefined()]).transform((v) =>
    v ? String(v).trim() : undefined
  ),

  // Patient context
  patientAge: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : undefined;
    }),
  ethnicityPrimary: z.union([z.string(), z.null(), z.undefined()]).transform((v) =>
    v ? String(v).trim() : undefined
  ),

  // Required boolean flags (default to false)
  isFirstTimeHPVTransition: booleanCoerce.default(false),
  isPostHysterectomy: booleanCoerce.default(false),
  immunocompromised: booleanCoerce.default(false),
  atypicalEndometrialHistory: booleanCoerce.default(false),

  // Hysterectomy details
  hysterectomyType: optionalEnum(["TOTAL", "SUBTOTAL"] as const),
  hysterectomyIndication: optionalEnum(HYSTERECTOMY_INDICATIONS),
  hysterectomySpecimenPathology: optionalEnum(HYSTERECTOMY_SPECIMEN_PATHOLOGIES),
  excisionStatus: optionalEnum(EXCISION_STATUSES),
  postHysterectomyHpvTestIndicated: optionalBooleanCoerce,

  // Current test results
  hpvResult: optionalEnum(HPV_RESULTS),
  cytologyResult: optionalEnum(CYTOLOGY_RESULTS),
  histologyResult: optionalEnum(HISTOLOGY_RESULTS),
  sampleType: optionalEnum(SAMPLE_TYPES),
  tzType: optionalEnum(TZ_TYPES),

  // Screening history
  screeningStatus: optionalEnum(SCREENING_STATUSES),
  screeningHistoryKnown: optionalBooleanCoerce,
  priorScreeningHistory: optionalEnum(PRIOR_SCREENING_HISTORIES),
  priorLowGradeResult: optionalBooleanCoerce,
  priorHighGradeResult: optionalBooleanCoerce,
  previousHSILCIN23: optionalBooleanCoerce,
  previousAIS: optionalBooleanCoerce,
  previousAtypicalGlandularCells: optionalBooleanCoerce,
  previousAtypicalEndometrialCells: optionalBooleanCoerce,
  historySourceAvailable: optionalBooleanCoerce,

  // Session / repeat context
  repeatContext: optionalEnum(REPEAT_CONTEXTS),
  repeatStage: optionalEnum(REPEAT_STAGES),
  isTestOfCure: optionalBooleanCoerce,
  testOfCureStage: optionalEnum(TEST_OF_CURE_STAGES),
  consecutiveNegativeCoTestCount: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return 0;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
    })
    .default(0),
  consecutiveLowGradeCount: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return 0;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
    })
    .default(0),
  unsatisfactoryCytologyCount: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return 0;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
    })
    .default(0),

  // Figure 9: Pregnancy
  isPregnant: optionalBooleanCoerce,
  postpartumReviewTiming: optionalEnum(
    ["SIX_MONTHS", "SIX_TO_TWELVE_WEEKS_POSTPARTUM"] as const
  ),

  // Figure 10: Abnormal vaginal bleeding
  hasAbnormalVaginalBleeding: optionalBooleanCoerce,
  abnormalBleedingStage: optionalEnum(ABNORMAL_BLEEDING_STAGES),
  bleedingType: optionalEnum(BLEEDING_TYPES),
  hasCancerSymptoms: optionalBooleanCoerce,
  abnormalCervix: optionalBooleanCoerce,
  suspicionOfCancer: optionalBooleanCoerce,
  suspectOralContraceptiveProblem: optionalBooleanCoerce,
  stiIdentified: optionalBooleanCoerce,
  bleedingResolved: optionalBooleanCoerce,

  // Colposcopy findings
  normalColposcopy: optionalBooleanCoerce,
  visibleLesion: optionalBooleanCoerce,
  transformationZoneState: optionalEnum(TRANSFORMATION_ZONE_STATES),
  colposcopicImpression: optionalEnum(COLPOSCOPIC_IMPRESSIONS),
  biopsyResult: optionalEnum(HISTOLOGY_RESULTS),
  colposcopyTZType: optionalEnum(TZ_TYPES),
  mdmOutcome: z.union([z.string(), z.null(), z.undefined()]).transform((v) =>
    v ? String(v).trim() : undefined
  ),

  // SWAB return visit
  swabReturnVisitCompleted: optionalBooleanCoerce,
});

// ─── Column name normalisation ───────────────────────────────────────────────

const columnLookup = buildColumnLookup();

/**
 * Map source column names to canonical field names using aliases.
 * Returns the row with canonical keys.
 */
function normaliseColumnNames(row: ParsedSourceRow): Record<string, unknown> {
  const normalised: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith("_")) continue; // skip metadata fields
    const col = columnLookup.get(key.toLowerCase());
    if (col) {
      normalised[col.field] = value;
    } else {
      // Keep unknown fields as-is for unmapped column detection
      normalised[key] = value;
    }
  }
  return normalised;
}

// ─── Per-Row Validation ──────────────────────────────────────────────────────

interface RowValidationResult {
  data: z.infer<typeof batchRowSchema>;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// ─── NHI Validation ─────────────────────────────────────────────────────────

/**
 * Validate NZ National Health Index (NHI) number format.
 *
 * Old format: 3 uppercase letters + 4 digits (e.g. ZAA1234)
 * New format: 3 uppercase letters + 2 digits + 2 uppercase letters (e.g. ZAA12AB)
 *
 * Letters I and O are excluded to avoid confusion with 1 and 0.
 * Returns null if valid, or a description of what's wrong.
 */
const NHI_OLD_RE = /^[A-HJ-NP-Z]{3}\d{4}$/;
const NHI_NEW_RE = /^[A-HJ-NP-Z]{3}\d{2}[A-HJ-NP-Z]{2}$/;

function validateNHI(value: string): string | null {
  const v = value.trim().toUpperCase();
  if (v.length === 0) return null; // empty is fine (optional field)
  if (NHI_OLD_RE.test(v) || NHI_NEW_RE.test(v)) return null;

  // Give specific feedback
  if (v.length !== 7) {
    return `NHI "${value}" is ${v.length} characters — must be exactly 7 (e.g. ABC1234 or ABC12DE).`;
  }
  if (/[IO]/i.test(v)) {
    return `NHI "${value}" contains I or O which are not allowed in NHI numbers (avoids confusion with 1/0).`;
  }
  if (!/^[A-Z]{3}/.test(v)) {
    return `NHI "${value}" must start with 3 letters (e.g. ABC1234).`;
  }
  return `NHI "${value}" does not match the NZ NHI format. Expected: 3 letters + 4 digits (ABC1234) or 3 letters + 2 digits + 2 letters (ABC12DE).`;
}

// ─── NZ Ethnicity Code Validation ───────────────────────────────────────────

const VALID_ETHNICITY_L1 = new Set([
  "1", "10", "11", "12",                         // European
  "2", "21",                                       // Māori
  "3", "30", "31", "32", "33", "34", "35", "36", "37",  // Pacific
  "4", "40", "41", "42", "43", "44",              // Asian
  "5", "51", "52", "53", "54",                    // MELAA/Other
  "6", "61",                                       // Other
  "9", "94", "95", "97", "99",                    // Not stated / Unknown
]);

const VALID_ETHNICITY_NAMES = new Set([
  "EUROPEAN", "NZ EUROPEAN", "PĀKEHĀ", "PAKEHA",
  "MĀORI", "MAORI",
  "PACIFIC", "PASIFIKA", "SAMOAN", "TONGAN", "COOK ISLAND MAORI", "FIJIAN", "NIUEAN", "TOKELAUAN",
  "ASIAN", "CHINESE", "INDIAN", "KOREAN", "JAPANESE", "FILIPINO", "SOUTHEAST ASIAN",
  "MELAA", "OTHER", "MIDDLE EASTERN", "LATIN AMERICAN", "AFRICAN",
  "UNKNOWN",
]);

function validateEthnicity(value: string): string | null {
  const v = value.trim().toUpperCase();
  if (v.length === 0) return null;
  if (VALID_ETHNICITY_L1.has(v)) return null;
  if (VALID_ETHNICITY_NAMES.has(v)) return null;
  return `Ethnicity "${value}" not recognised. Use NZ Level-2 numeric code (e.g. "21" for Māori, "11" for NZ European) or a standard name (e.g. "MĀORI", "PACIFIC", "ASIAN", "EUROPEAN").`;
}

function validateSingleRow(
  row: ParsedSourceRow,
  rowIndex: number
): RowValidationResult {
  const normalised = normaliseColumnNames(row);
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // ── Unknown columns ─────────────────────────────────────────────────────
  const knownFields = getKnownFieldNames();
  for (const key of row._sourceFields ?? []) {
    if (!knownFields.has(key.toLowerCase()) && !key.startsWith("_")) {
      warnings.push({
        field: key,
        message: `Unknown column "${key}" — not mapped to any engine field.`,
        severity: "warning",
        value: key,
      });
    }
  }

  // ── NHI validation ──────────────────────────────────────────────────────
  const rawNhi = normalised.externalPatientId;
  if (rawNhi !== undefined && rawNhi !== null && rawNhi !== "") {
    const nhiError = validateNHI(String(rawNhi));
    if (nhiError) {
      warnings.push({
        field: "externalPatientId",
        message: nhiError,
        severity: "warning",
        value: rawNhi,
      });
    }
  }

  // ── Ethnicity validation ────────────────────────────────────────────────
  const rawEth = normalised.ethnicityPrimary;
  if (rawEth !== undefined && rawEth !== null && rawEth !== "") {
    const ethError = validateEthnicity(String(rawEth));
    if (ethError) {
      warnings.push({
        field: "ethnicityPrimary",
        message: ethError,
        severity: "warning",
        value: rawEth,
      });
    }
  }

  // ── Enum validation (ALL enum fields, not just the main 6) ──────────────
  const enumChecks: Array<{ field: string; value: unknown; allowed: readonly string[] }> = [
    { field: "hpvResult",                    value: normalised.hpvResult,                    allowed: HPV_RESULTS },
    { field: "cytologyResult",               value: normalised.cytologyResult,               allowed: CYTOLOGY_RESULTS },
    { field: "histologyResult",              value: normalised.histologyResult,              allowed: HISTOLOGY_RESULTS },
    { field: "sampleType",                   value: normalised.sampleType,                   allowed: SAMPLE_TYPES },
    { field: "tzType",                       value: normalised.tzType,                       allowed: TZ_TYPES },
    { field: "repeatContext",                value: normalised.repeatContext,                allowed: REPEAT_CONTEXTS },
    { field: "repeatStage",                  value: normalised.repeatStage,                  allowed: REPEAT_STAGES },
    { field: "testOfCureStage",              value: normalised.testOfCureStage,              allowed: TEST_OF_CURE_STAGES },
    { field: "screeningStatus",              value: normalised.screeningStatus,              allowed: SCREENING_STATUSES },
    { field: "priorScreeningHistory",        value: normalised.priorScreeningHistory,        allowed: PRIOR_SCREENING_HISTORIES },
    { field: "hysterectomyType",             value: normalised.hysterectomyType,             allowed: ["TOTAL", "SUBTOTAL"] },
    { field: "hysterectomyIndication",       value: normalised.hysterectomyIndication,       allowed: HYSTERECTOMY_INDICATIONS },
    { field: "hysterectomySpecimenPathology", value: normalised.hysterectomySpecimenPathology, allowed: HYSTERECTOMY_SPECIMEN_PATHOLOGIES },
    { field: "excisionStatus",               value: normalised.excisionStatus,               allowed: EXCISION_STATUSES },
    { field: "abnormalBleedingStage",        value: normalised.abnormalBleedingStage,        allowed: ABNORMAL_BLEEDING_STAGES },
    { field: "bleedingType",                 value: normalised.bleedingType,                 allowed: BLEEDING_TYPES },
    { field: "colposcopicImpression",        value: normalised.colposcopicImpression,        allowed: COLPOSCOPIC_IMPRESSIONS },
    { field: "transformationZoneState",      value: normalised.transformationZoneState,      allowed: TRANSFORMATION_ZONE_STATES },
    { field: "biopsyResult",                 value: normalised.biopsyResult,                 allowed: HISTOLOGY_RESULTS },
    { field: "colposcopyTZType",             value: normalised.colposcopyTZType,             allowed: TZ_TYPES },
    { field: "postpartumReviewTiming",       value: normalised.postpartumReviewTiming,       allowed: ["SIX_MONTHS", "SIX_TO_TWELVE_WEEKS_POSTPARTUM"] },
  ];

  for (const { field, value, allowed } of enumChecks) {
    if (value !== null && value !== undefined && value !== "") {
      const upper = String(value).trim().toUpperCase();
      if (!allowed.includes(upper)) {
        errors.push({
          field,
          message: `Invalid value "${value}" for ${field}. Allowed: ${allowed.join(", ")}.`,
          severity: "error",
          value,
        });
      }
    }
  }

  // ── Age validation ──────────────────────────────────────────────────────
  if (normalised.patientAge !== undefined && normalised.patientAge !== null && normalised.patientAge !== "") {
    const age = Number(normalised.patientAge);
    if (!Number.isFinite(age) || age < 0 || age > 120) {
      errors.push({
        field: "patientAge",
        message: `Invalid age "${normalised.patientAge}". Must be 0–120.`,
        severity: "error",
        value: normalised.patientAge,
      });
    } else if (age < 25) {
      warnings.push({
        field: "patientAge",
        message: `Age ${age} is below the NCSP screening start age of 25. Verify this is correct.`,
        severity: "warning",
        value: normalised.patientAge,
      });
    } else if (age > 70) {
      warnings.push({
        field: "patientAge",
        message: `Age ${age} is above the NCSP screening exit age of 69. Verify this is correct.`,
        severity: "warning",
        value: normalised.patientAge,
      });
    }
  }

  // ── Counter field validation ────────────────────────────────────────────
  const counterFields = [
    { field: "consecutiveNegativeCoTestCount", label: "consecutive negative co-test count" },
    { field: "consecutiveLowGradeCount",       label: "consecutive low-grade count" },
    { field: "unsatisfactoryCytologyCount",    label: "unsatisfactory cytology count" },
  ];
  for (const { field, label } of counterFields) {
    const val = normalised[field];
    if (val !== undefined && val !== null && val !== "") {
      const n = Number(val);
      if (!Number.isFinite(n)) {
        warnings.push({
          field,
          message: `Non-numeric value "${val}" for ${label}. Defaulting to 0.`,
          severity: "warning",
          value: val,
        });
      } else if (n < 0) {
        warnings.push({
          field,
          message: `Negative value ${n} for ${label}. Must be 0 or greater. Defaulting to 0.`,
          severity: "warning",
          value: val,
        });
      } else if (n > 20) {
        warnings.push({
          field,
          message: `Unusually high ${label} (${n}). Verify this is correct.`,
          severity: "warning",
          value: val,
        });
      }
    }
  }

  // ── Boolean field validation ────────────────────────────────────────────
  const booleanFields = [
    "isFirstTimeHPVTransition", "isPostHysterectomy", "immunocompromised",
    "atypicalEndometrialHistory", "isPregnant", "hasAbnormalVaginalBleeding",
    "isTestOfCure", "hasCancerSymptoms", "abnormalCervix", "suspicionOfCancer",
    "normalColposcopy", "visibleLesion", "bleedingResolved", "stiIdentified",
    "previousHSILCIN23", "previousAIS",
  ];
  for (const field of booleanFields) {
    const val = normalised[field];
    if (val !== undefined && val !== null && val !== "") {
      if (typeof val === "string" && coerceBoolean(val) === undefined) {
        warnings.push({
          field,
          message: `Could not parse "${val}" as boolean for ${field}. Defaulting to false.`,
          severity: "warning",
          value: val,
        });
      }
    }
  }

  // ── Logical consistency checks ──────────────────────────────────────────

  // Hysterectomy details without the flag
  if (!coerceBoolean(normalised.isPostHysterectomy) && normalised.hysterectomyType) {
    warnings.push({
      field: "hysterectomyType",
      message: `Hysterectomy type "${normalised.hysterectomyType}" provided but isPostHysterectomy is not set to true. Set isPostHysterectomy = true or remove hysterectomy details.`,
      severity: "warning",
      value: normalised.hysterectomyType,
    });
  }

  // Test of cure stage without the flag
  if (!coerceBoolean(normalised.isTestOfCure) && normalised.testOfCureStage) {
    warnings.push({
      field: "testOfCureStage",
      message: `Test of Cure stage "${normalised.testOfCureStage}" provided but isTestOfCure is not set to true. Set isTestOfCure = true or remove the stage.`,
      severity: "warning",
      value: normalised.testOfCureStage,
    });
  }

  // Bleeding details without the flag
  if (!coerceBoolean(normalised.hasAbnormalVaginalBleeding) && normalised.abnormalBleedingStage) {
    warnings.push({
      field: "abnormalBleedingStage",
      message: `Bleeding stage "${normalised.abnormalBleedingStage}" provided but hasAbnormalVaginalBleeding is not set to true.`,
      severity: "warning",
      value: normalised.abnormalBleedingStage,
    });
  }

  // Pregnant + immunocompromised (unusual combination, worth flagging)
  if (coerceBoolean(normalised.isPregnant) && coerceBoolean(normalised.immunocompromised)) {
    warnings.push({
      field: "isPregnant",
      message: "Patient is both pregnant and immunocompromised — verify both flags are correct.",
      severity: "warning",
    });
  }

  // ── Minimal clinical data check ─────────────────────────────────────────
  const hasClinicalData =
    normalised.hpvResult ||
    normalised.cytologyResult ||
    normalised.histologyResult ||
    normalised.isFirstTimeHPVTransition ||
    normalised.isPostHysterectomy ||
    normalised.hasAbnormalVaginalBleeding ||
    normalised.isPregnant;

  if (!hasClinicalData) {
    warnings.push({
      field: "_row",
      message: "Row has no clinical data (no HPV/cytology/histology results or pathway flags). May produce a generic result.",
      severity: "warning",
    });
  }

  // ── Parse with Zod ──────────────────────────────────────────────────────
  const parsed = batchRowSchema.safeParse(normalised);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        field: issue.path.join(".") || "_parse",
        message: issue.message,
        severity: "error",
        value: undefined,
      });
    }
    return {
      data: batchRowSchema.parse({}),
      errors,
      warnings,
    };
  }

  return { data: parsed.data, errors, warnings };
}

// ─── Batch Validation ────────────────────────────────────────────────────────

export interface BatchValidationResult {
  cases: CanonicalBatchCase[];
  totalRows: number;
  validCount: number;
  warningCount: number;
  invalidCount: number;
}

/**
 * Validate an array of parsed rows into CanonicalBatchCase[].
 * Every row produces a case (even invalid ones) so the UI can show all rows.
 */
export function validateBatchRows(
  rows: ParsedSourceRow[],
  sourceMetadataBase: Omit<SourceMetadata, "rowNumber" | "importedAt">
): BatchValidationResult {
  const now = new Date().toISOString();
  const cases: CanonicalBatchCase[] = [];
  const seenPatientIds = new Map<string, number>(); // externalPatientId → first row
  let validCount = 0;
  let warningCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { data, errors, warnings } = validateSingleRow(row, i);

    // Duplicate patient ID check
    if (data.externalPatientId) {
      const prevRow = seenPatientIds.get(data.externalPatientId.toLowerCase());
      if (prevRow !== undefined) {
        warnings.push({
          field: "externalPatientId",
          message: `Duplicate patient ID "${data.externalPatientId}" — also appears in row ${prevRow + 1}.`,
          severity: "warning",
          value: data.externalPatientId,
        });
      } else {
        seenPatientIds.set(data.externalPatientId.toLowerCase(), i);
      }
    }

    // Determine validation status
    let validationStatus: ValidationStatus;
    if (errors.length > 0) {
      validationStatus = "invalid";
      invalidCount++;
    } else if (warnings.length > 0) {
      validationStatus = "warnings";
      warningCount++;
    } else {
      validationStatus = "valid";
      validCount++;
    }

    const batchCase: CanonicalBatchCase = {
      caseId: crypto.randomUUID(),
      label: data.label,
      source: {
        ...sourceMetadataBase,
        rowNumber: row._rowIndex + 1, // 1-based for display
        importedAt: now,
        externalPatientId: data.externalPatientId,
      },

      // Patient context
      patientAge: data.patientAge,
      ethnicityPrimary: data.ethnicityPrimary,
      isFirstTimeHPVTransition: data.isFirstTimeHPVTransition,
      isPostHysterectomy: data.isPostHysterectomy,
      hysterectomyType: data.hysterectomyType as CanonicalBatchCase["hysterectomyType"],
      hysterectomyIndication: data.hysterectomyIndication as CanonicalBatchCase["hysterectomyIndication"],
      hysterectomySpecimenPathology: data.hysterectomySpecimenPathology as CanonicalBatchCase["hysterectomySpecimenPathology"],
      excisionStatus: data.excisionStatus as CanonicalBatchCase["excisionStatus"],
      postHysterectomyHpvTestIndicated: data.postHysterectomyHpvTestIndicated,
      immunocompromised: data.immunocompromised,
      atypicalEndometrialHistory: data.atypicalEndometrialHistory,

      // Screening history
      screeningStatus: data.screeningStatus as CanonicalBatchCase["screeningStatus"],
      screeningHistoryKnown: data.screeningHistoryKnown,
      priorScreeningHistory: data.priorScreeningHistory as CanonicalBatchCase["priorScreeningHistory"],
      priorLowGradeResult: data.priorLowGradeResult,
      priorHighGradeResult: data.priorHighGradeResult,
      previousHSILCIN23: data.previousHSILCIN23,
      previousAIS: data.previousAIS,
      previousAtypicalGlandularCells: data.previousAtypicalGlandularCells,
      previousAtypicalEndometrialCells: data.previousAtypicalEndometrialCells,
      historySourceAvailable: data.historySourceAvailable,

      // Test results
      hpvResult: data.hpvResult as CanonicalBatchCase["hpvResult"],
      cytologyResult: data.cytologyResult as CanonicalBatchCase["cytologyResult"],
      histologyResult: data.histologyResult as CanonicalBatchCase["histologyResult"],
      sampleType: data.sampleType as CanonicalBatchCase["sampleType"],
      tzType: data.tzType as CanonicalBatchCase["tzType"],

      // Session / repeat
      repeatContext: data.repeatContext as CanonicalBatchCase["repeatContext"],
      repeatStage: data.repeatStage as CanonicalBatchCase["repeatStage"],
      isTestOfCure: data.isTestOfCure,
      testOfCureStage: data.testOfCureStage as CanonicalBatchCase["testOfCureStage"],
      consecutiveNegativeCoTestCount: data.consecutiveNegativeCoTestCount,
      consecutiveLowGradeCount: data.consecutiveLowGradeCount,
      unsatisfactoryCytologyCount: data.unsatisfactoryCytologyCount,

      // Pregnancy
      isPregnant: data.isPregnant,
      postpartumReviewTiming: data.postpartumReviewTiming as CanonicalBatchCase["postpartumReviewTiming"],

      // Bleeding
      hasAbnormalVaginalBleeding: data.hasAbnormalVaginalBleeding,
      abnormalBleedingStage: data.abnormalBleedingStage as CanonicalBatchCase["abnormalBleedingStage"],
      bleedingType: data.bleedingType as CanonicalBatchCase["bleedingType"],
      hasCancerSymptoms: data.hasCancerSymptoms,
      abnormalCervix: data.abnormalCervix,
      suspicionOfCancer: data.suspicionOfCancer,
      suspectOralContraceptiveProblem: data.suspectOralContraceptiveProblem,
      stiIdentified: data.stiIdentified,
      bleedingResolved: data.bleedingResolved,

      // Colposcopy
      normalColposcopy: data.normalColposcopy,
      visibleLesion: data.visibleLesion,
      transformationZoneState: data.transformationZoneState as CanonicalBatchCase["transformationZoneState"],
      colposcopicImpression: data.colposcopicImpression as CanonicalBatchCase["colposcopicImpression"],
      biopsyResult: data.biopsyResult as CanonicalBatchCase["biopsyResult"],
      colposcopyTZType: data.colposcopyTZType as CanonicalBatchCase["colposcopyTZType"],
      mdmOutcome: data.mdmOutcome,

      // SWAB
      swabReturnVisitCompleted: data.swabReturnVisitCompleted,

      // Validation
      validationStatus,
      validationErrors: errors,
      validationWarnings: warnings,
    };

    cases.push(batchCase);
  }

  return {
    cases,
    totalRows: rows.length,
    validCount,
    warningCount,
    invalidCount,
  };
}
