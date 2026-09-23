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

/** Whether a case identifier is a real NHI or something else entirely. */
export type CaseIdentifierKind = "SYNTHETIC_CASE" | "SOURCE_PATIENT_ID" | "NHI";

/** Where in the originating document this row came from. Internal/audit only. */
export interface SourceLocator {
  fileName: string;
  sheet: string;
  /** The row number IN THE WORKSHEET, not the case ordinal. */
  row: number;
  /** SHA-256 of the source document, when one was taken. */
  documentSha256?: string;
  mappingVersion: string;
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
