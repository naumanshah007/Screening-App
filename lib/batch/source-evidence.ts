/**
 * Source evidence — what the source document actually said.
 *
 * This is deliberately NOT a second clinical model. It is the exact text of the
 * row the case was transcribed from, plus the two result states the engine's
 * own enums cannot express: the precise HPV genotype, and the difference
 * between "no cytology result" and the several distinct reasons a source gives
 * for there not being one.
 *
 * The rule is simple and load-bearing: nothing here is reconstructed from an
 * authored label or from an engine value. Source evidence is written down once,
 * from the source, and everything else is derived FROM it — never back into it.
 */

import type { CytologyResult, HPVResult } from "@/lib/engine/types";

/**
 * The precise HPV result a source reports.
 *
 * `HPV_16_OR_18_UNSPECIFIED` exists for sources that genuinely report the
 * grouped result. It means "16 or 18, the source did not say which" — it never
 * means both were detected. The legacy engine's `HPV_16_18` is the projection
 * of all three positive genotype values, not a synonym for any one of them.
 */
export type SourceHpvGenotype =
  | "NOT_DETECTED"
  | "HPV_16"
  | "HPV_18"
  | "HPV_16_OR_18_UNSPECIFIED"
  | "HPV_OTHER"
  | "INADEQUATE";

/**
 * Why there is, or is not, a current cytology result.
 *
 * A single optional `cytologyResult` collapsed seven distinct source statements
 * into one absent value. They are not the same clinical situation and they do
 * not produce the same next action.
 */
export type SourceCytologyState =
  /** A current result exists and is in `cytologyResult`. */
  | "AVAILABLE"
  /** Sample taken, result not back yet. */
  | "PENDING"
  /** The source says the cytology is missing. */
  | "MISSING"
  /** The source says no cytology was required for this screen. */
  | "NOT_REQUIRED"
  /** No current sample was collected at all. */
  | "NO_CURRENT_SAMPLE"
  /** Only a previous cytology result is reported; it is in `priorCytologyResult`. */
  | "PRIOR_ONLY"
  /** A current sample was taken but could not be reported. */
  | "UNSATISFACTORY"
  /** The source's follow-up text does not state a cytology state either way. */
  | "UNSPECIFIED";

/**
 * What the source says about WHICH screening event this is.
 *
 * The engine contract requires a repeat stage, so every case is given one. That
 * default is only a source fact where the row actually states the event: a
 * first screen, or a stated repeat interval. "Routine screening" says nothing
 * about whether this is a baseline or a repeat, and a BASELINE derived from it
 * is an assumption that must not satisfy a governed stage predicate.
 */
export type SourceScreeningEvent = "FIRST" | "REPEAT" | "NOT_STATED";

/**
 * The smallest rule-relevant facts the history/context text actually states.
 *
 * Everything here must be READABLE OFF THE SOURCE STRING. Nothing is inferred
 * from what would make a rule fire, and absence of a field means the source did
 * not say — never that the answer is no.
 *
 * The exact history string is retained alongside this and remains what the
 * clinician is shown; this is only what the rules may consume.
 */
export interface SourceHistoryEvidence {
  /** A previous HPV result the source reports, with its genotype if stated. */
  previousHpvGenotype?: SourceHpvGenotype;
  /** The source states a previous HPV-positive episode, genotype unstated. */
  previousHpvPositiveUnspecifiedGenotype?: boolean;
  /** Months since the previous HPV result, where the source states an interval. */
  previousHpvIntervalMonths?: number;
  /** The source explicitly states the same genotype persisted. */
  sameGenotypePersistence?: boolean;

  /** Previous high-grade lesion, by grade, where the source names one. */
  priorCin2?: boolean;
  priorCin3?: boolean;
  /** The source states treatment occurred. Absent means it did not say. */
  treatmentOccurred?: boolean;
  /**
   * How precisely the source dates that treatment. RELATIVE means a phrase like
   * "three years ago" — real evidence of timing, but not a date.
   */
  treatmentDatePrecision?: "EXACT" | "RELATIVE" | "NOT_STATED";
  /** Years since treatment, where the source states a relative interval. */
  treatmentRelativeYears?: number;

  /** The circumstance is explicitly post-treatment surveillance. */
  postTreatmentSurveillance?: boolean;
  /** The circumstance is explicitly post-colposcopy surveillance. */
  postColposcopySurveillance?: boolean;

  /** A referral or colposcopy whose outcome the source says is not documented. */
  unresolvedReferralOutcome?: boolean;
  /** The source says follow-up documentation is incomplete. */
  followUpDocumentationIncomplete?: boolean;
  /** Months overdue, where the source states a duration. */
  overdueByMonths?: number;

  /** A previous low-grade cytology result the source names. */
  priorLowGradeResult?: "ASC_US" | "LSIL";
  /** How long ago, where the source is only qualitative. */
  priorLowGradeTiming?: "SEVERAL_YEARS";
  /** The source reports later normal follow-up — NOT a formal discharge. */
  subsequentNormalFollowUp?: boolean;
  /** A previous normal or negative screening RESULT the source reports. */
  previousNormalScreeningResult?: boolean;
  /** A scoped negative: no previous CIN. Not a normal screening history. */
  noPreviousCinStated?: boolean;
  /** A scoped negative: no previous abnormality/abnormal screening. */
  noPreviousAbnormalityStated?: boolean;
  /** The source says no prior CIN is RECORDED — absence of documentation. */
  noPriorCinRecordedStated?: boolean;
  /** The source says prior screening is up to date. */
  priorScreeningUpToDate?: boolean;
  /** The source says there is no high-grade history. */
  noHighGradeHistoryStated?: boolean;
  /** The source states this is the first hrHPV-positive episode. */
  firstPositiveEpisode?: boolean;
  /** Age of the current specimen in days, where the source states one. */
  sampleAgeDays?: number;
}

/** Whether a case identifier is a real NHI or something else entirely. */
export type CaseIdentifierKind = "SYNTHETIC_CASE" | "SOURCE_PATIENT_ID" | "NHI";

/**
 * Which worksheet column holds which field.
 *
 * Recorded so a reviewer can open the workbook at the exact cell rather than
 * trusting a transcription. `Sheet1!A4:I33` with the header on row 3.
 */
export const CHCH_SOURCE_COLUMNS = {
  caseId: "A",
  patientName: "B",
  age: "C",
  screenCircumstance: "D",
  hpvResult: "E",
  cytologyFollowUp: "F",
  relevantHistory: "G",
  // H and I are the partner's Demo priority and Expected behaviour columns.
  // Deliberately not ingested: they are expectations, not guideline authority.
} as const;

export type SourceField = keyof typeof CHCH_SOURCE_COLUMNS;

/** Where in the originating document this row came from. Internal/audit only. */
export interface SourceLocator {
  fileName: string;
  sheet: string;
  /** The row number IN THE WORKSHEET, not the case ordinal. */
  row: number;
  /** SHA-256 of the source document, when one was taken. */
  documentSha256?: string;
  mappingVersion: string;
  /** ISO-8601 timestamp of the ingestion that produced this record. */
  ingestedAt?: string;
  /** The full range the record was read from, e.g. "Sheet1!A4:I4". */
  range?: string;
}

/** The exact cell a field came from, e.g. "Sheet1!E4". */
export function sourceCellRef(locator: SourceLocator, field: SourceField): string {
  return `${locator.sheet}!${CHCH_SOURCE_COLUMNS[field]}${locator.row}`;
}

/**
 * The immutable source record for one case.
 *
 * The four `*Text` fields are verbatim source cells. They are what a clinician
 * is shown under Source inputs. Everything typed alongside them is a mapping OF
 * those strings, recorded so a reviewer can check the mapping against the text.
 */
export interface CaseSourceEvidence {
  /** Stable case identity, e.g. "chch-001". Not an NHI. */
  caseId: string;
  identifierKind: CaseIdentifierKind;
  patientName?: string;
  age?: number;

  // ── Verbatim source text ────────────────────────────────────────────────
  screenCircumstanceText: string;
  hpvResultText: string;
  cytologyFollowUpText: string;
  relevantHistoryText: string;

  // ── Typed mapping of the text above ─────────────────────────────────────
  /**
   * The genotype the source reports. Absent when the source reports no CURRENT
   * HPV result at all (e.g. "HPV 16 positive (previous)" with no new sample).
   */
  hpvGenotype?: SourceHpvGenotype;
  /** False when the reported HPV result is explicitly a previous one. */
  hpvIsCurrentResult: boolean;

  /** Whether the row states which screening event this is. */
  screeningEvent: SourceScreeningEvent;

  /** The rule-relevant facts the history text states, and only those. */
  history: SourceHistoryEvidence;

  cytologyState: SourceCytologyState;
  /** Only ever set when `cytologyState` is AVAILABLE or UNSATISFACTORY. */
  cytologyResult?: CytologyResult;
  /** Only ever set when `cytologyState` is PRIOR_ONLY. */
  priorCytologyResult?: CytologyResult;

  /** Workbook/sheet/row provenance. Internal — never shown in the clinician view. */
  locator?: SourceLocator;
}

/**
 * Project a precise genotype onto the legacy engine's four-value domain.
 *
 * This is the ONLY place the collapse is allowed to happen, and it happens at
 * the legacy boundary. The precise genotype survives on the source evidence, in
 * the canonical facts and through persistence.
 */
export function legacyHpvResult(
  genotype: SourceHpvGenotype | undefined
): HPVResult | undefined {
  switch (genotype) {
    case "HPV_16":
    case "HPV_18":
    case "HPV_16_OR_18_UNSPECIFIED":
      return "HPV_16_18";
    case "HPV_OTHER":
      return "HPV_OTHER";
    case "NOT_DETECTED":
      return "NOT_DETECTED";
    case "INADEQUATE":
      return "INADEQUATE";
    case undefined:
      return undefined;
  }
}

/**
 * The genotype value the governed canonical predicates should evaluate.
 *
 * CG-NCSP-3.1.0 accepts `HPV_16` and `HPV_18` directly, so the precise value
 * goes in unchanged. Only the source's own grouped report projects to the
 * grouped literal, because that is what it means.
 */
export function canonicalHpvFactValue(
  genotype: SourceHpvGenotype | undefined
): string | undefined {
  if (genotype === undefined) return undefined;
  if (genotype === "INADEQUATE") return undefined;
  if (genotype === "HPV_16_OR_18_UNSPECIFIED") return "HPV_16_18";
  return genotype;
}

/** True for any genotype that satisfies an HPV 16-or-18 rule predicate. */
export function isHpv16Or18(genotype: SourceHpvGenotype | undefined): boolean {
  return (
    genotype === "HPV_16" ||
    genotype === "HPV_18" ||
    genotype === "HPV_16_OR_18_UNSPECIFIED"
  );
}

/**
 * The current cytology result the engine may consume.
 *
 * PENDING, MISSING, NOT_REQUIRED, NO_CURRENT_SAMPLE, PRIOR_ONLY and UNSPECIFIED
 * all yield `undefined`: none of them is a current result, and a prior result in
 * particular must never satisfy a rule that asks for the current one.
 */
export function currentCytologyResult(
  evidence: Pick<CaseSourceEvidence, "cytologyState" | "cytologyResult">
): CytologyResult | undefined {
  if (evidence.cytologyState === "AVAILABLE") return evidence.cytologyResult;
  if (evidence.cytologyState === "UNSATISFACTORY") return "UNSATISFACTORY";
  return undefined;
}

/** Plain-language label for a cytology state, for the clinician Source inputs. */
export const CYTOLOGY_STATE_LABEL: Record<SourceCytologyState, string> = {
  AVAILABLE: "Result available",
  PENDING: "Pending",
  MISSING: "Missing",
  NOT_REQUIRED: "Not required",
  NO_CURRENT_SAMPLE: "No current sample",
  PRIOR_ONLY: "Previous result only",
  UNSATISFACTORY: "Unsatisfactory",
  UNSPECIFIED: "Not stated",
};

/** Plain-language label for a genotype, for the clinician Source inputs. */
export const HPV_GENOTYPE_LABEL: Record<SourceHpvGenotype, string> = {
  NOT_DETECTED: "Not detected",
  HPV_16: "HPV 16 positive",
  HPV_18: "HPV 18 positive",
  HPV_16_OR_18_UNSPECIFIED: "HPV 16 or 18 positive (genotype not specified)",
  HPV_OTHER: "Other high-risk HPV positive",
  INADEQUATE: "Inadequate sample",
};
