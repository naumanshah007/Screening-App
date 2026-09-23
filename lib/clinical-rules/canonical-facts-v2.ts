import { z } from "zod";

import type { ClinicalRuleSnapshot, ConditionExpression } from "./schema";

export const CANONICAL_CLINICAL_FACTS_V2_SCHEMA_ID =
  "canonical-clinical-facts-v2" as const;

export const CanonicalFactStatusSchema = z.enum([
  "KNOWN",
  "UNKNOWN",
  "NOT_RECORDED",
  "NOT_APPLICABLE",
  "PENDING",
  "CONFLICTING",
]);
export type CanonicalFactStatus = z.infer<typeof CanonicalFactStatusSchema>;

export const CanonicalFactSourceSchema = z.enum([
  "PARTICIPANT_REPORT",
  "LAB_RESULT",
  "PATHOLOGY",
  "COLPOSCOPY",
  "OPERATIVE_REPORT",
  "SPECIALIST_LETTER",
  "PRIOR_RECORD",
  "REVIEWER_ENTRY",
  "SYNTHETIC_DEMO",
  // Computed by the legacy routing engine rather than observed or entered by a
  // person. `currentPathway` is the canonical example: CG-NCSP-3.1.0 has no
  // router, so the pathway it evaluates within is produced by
  // evaluateClinicalDecision(). Labelling that REVIEWER_ENTRY or PRIOR_RECORD
  // would assert in an immutable record that a clinician supplied a value that
  // software derived.
  "DERIVED_ROUTER",
]);
export type CanonicalFactSource = z.infer<typeof CanonicalFactSourceSchema>;

export const CanonicalFactVerificationStatusSchema = z.enum([
  "UNVERIFIED",
  "SOURCE_VERIFIED",
  "REVIEWER_VERIFIED",
  "CONFLICTING",
]);

const FactValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.array(z.union([z.string(), z.number().finite(), z.boolean()])).max(100),
]);

/**
 * How a fact came to hold the value it holds.
 *
 * SEPARATE FROM `source` AND FROM `verificationStatus`, DELIBERATELY
 * ------------------------------------------------------------------
 *   - `source` says WHO/WHAT supplied it (a lab, a prior record, the router).
 *   - `verificationStatus` says whether anyone has CHECKED it.
 *   - `evidenceClass` says what KIND of claim it is.
 *
 * All three were previously answered by `source` alone, which is why an assumed
 * default carrying `PRIOR_RECORD` was indistinguishable from a reported result.
 *
 * The load-bearing rule: an ASSUMED fact is never evaluated. It is recorded with
 * status NOT_RECORDED and no value, so it cannot satisfy a governed predicate,
 * and the rules that need it report it as missing instead of matching on it.
 */
export const CanonicalFactEvidenceClassSchema = z.enum([
  /** Explicitly supplied by the source, including an explicitly reported negative. */
  "SOURCE",
  /** A meaning-preserving transformation of source evidence. */
  "DERIVED",
  /** A scenario or configuration choice the source never stated. */
  "ASSUMED",
  /** Unknown or not supplied. */
  "MISSING",
]);
export type CanonicalFactEvidenceClass = z.infer<
  typeof CanonicalFactEvidenceClassSchema
>;

export const CanonicalFactCorrectionSchema = z.object({
  correctedAt: z.string().datetime(),
  correctedBy: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  previousStatus: CanonicalFactStatusSchema,
  previousValue: FactValueSchema.optional(),
});

export const CanonicalFactV2Schema = z
  .object({
    value: FactValueSchema.optional(),
    status: CanonicalFactStatusSchema,
    source: CanonicalFactSourceSchema,
    /**
     * What kind of claim this is. Optional for backward compatibility: facts
     * persisted before this field existed parse unchanged and are read as
     * unclassified rather than silently relabelled as SOURCE.
     */
    evidenceClass: CanonicalFactEvidenceClassSchema.optional(),
    /** Where in the source document this fact came from, e.g. "Sheet1!C4". */
    sourceCell: z.string().trim().min(1).optional(),
    /** The versioned mapping that produced a DERIVED fact. */
    derivation: z.string().trim().min(1).optional(),
    observedAt: z.string().datetime().optional(),
    recordedAt: z.string().datetime(),
    enteredBy: z.string().trim().min(1),
    verifiedBy: z.string().trim().min(1).optional(),
    verificationStatus: CanonicalFactVerificationStatusSchema,
    sourceDocumentId: z.string().trim().min(1).optional(),
    externalReference: z.string().trim().min(1).optional(),
    corrections: z.array(CanonicalFactCorrectionSchema).default([]),
  })
  .superRefine((fact, context) => {
    if (fact.status === "KNOWN" && fact.value === undefined) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "A KNOWN fact requires an explicit value.",
      });
    }
    if (fact.status !== "KNOWN" && fact.value !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: `${fact.status} must not carry a value that could be evaluated as known.`,
      });
    }
    if (fact.evidenceClass === "ASSUMED" && fact.status === "KNOWN") {
      context.addIssue({
        code: "custom",
        path: ["evidenceClass"],
        message:
          "An ASSUMED fact may never be KNOWN: it would satisfy governed predicates it has no evidence for.",
      });
    }
    if (fact.evidenceClass === "MISSING" && fact.status === "KNOWN") {
      context.addIssue({
        code: "custom",
        path: ["evidenceClass"],
        message: "A MISSING fact may never be KNOWN.",
      });
    }
    if (
      fact.verificationStatus === "REVIEWER_VERIFIED" &&
      !fact.verifiedBy
    ) {
      context.addIssue({
        code: "custom",
        path: ["verifiedBy"],
        message: "Reviewer-verified facts require verifiedBy.",
      });
    }
  });
export type CanonicalFactV2 = z.infer<typeof CanonicalFactV2Schema>;

export const CanonicalClinicalFactsV2Schema = z.object({
  schemaId: z.literal(CANONICAL_CLINICAL_FACTS_V2_SCHEMA_ID),
  subjectReference: z.string().trim().min(1),
  capturedAt: z.string().datetime(),
  facts: z.record(z.string().trim().min(1).max(160), CanonicalFactV2Schema),
});
export type CanonicalClinicalFactsV2 = z.infer<
  typeof CanonicalClinicalFactsV2Schema
>;

export const canonicalClinicalFactsV2JsonSchema = z.toJSONSchema(
  CanonicalClinicalFactsV2Schema,
  { target: "draft-2020-12" }
);

export const CANONICAL_FACT_FIELD_CATALOG_V2 = Object.freeze({
  sampleValidity: [
    "hpvValidity",
    "hpvSampleValid",
    "hpvSampleInvalid",
    "hpvSampleUnsuitable",
    "hpvSampleLeaked",
    "hpvSampleInadequate",
    "cytologyPending",
    "cytologyAdequacy",
    "consecutiveUnsatisfactoryCount",
    "sampleSite",
    "collectionMethod",
    "sampleType",
  ],
  cin2Surveillance: [
    "ageYears",
    "biopsyResult",
    "cin3Excluded",
    "cin2SurveillanceEligible",
    "fertilityContextDocumented",
    "sharedDecisionRequired",
    "participantTreatmentPreference",
    "cin2ActiveSurveillance",
    "surveillanceStartDate",
    "followUpEventCount",
    "surveillanceDurationMonths",
    "currentHistology",
    "cytologyResult",
    "hpvResult",
    "colposcopicImpression",
    "visibleLesion",
    "followUpMdmReviewDue",
    "cin2RegressionConfirmed",
  ],
  hsilTreatment: [
    "treatedHistology",
    "treatmentModality",
    "treatmentDate",
    "marginApplicability",
    "marginStatus",
    "ageYears",
    "careSetting",
    "tocEventSequence",
  ],
  ais: [
    "preTreatmentHpvStatus",
    "preTreatmentHpvGenotype",
    "histologyResult",
    "treatmentDate",
    "treatmentModality",
    "marginStatus",
    "cervixPresent",
    "hysterectomyType",
    "sixMonthHpvResult",
    "sixMonthCytologyResult",
    "eighteenMonthHpvResult",
    "eighteenMonthCytologyResult",
    "followUpSetting",
    "oncologyReferralStatus",
    "invasionStatus",
  ],
  cancerHistory: [
    "cancerType",
    "gynaecologicalCancerType",
    "cancerStage",
    "cancerTreatment",
    "treatmentConfirmed",
    "ncspApplicability",
    "tocStatus",
    "cancerFollowUpPhase",
    "tocEventSequence",
    "currentClinicianFollowUpPlan",
  ],
  abnormalBleeding: [
    "bleedingType",
    "menopausalStatus",
    "bleedingEpisodeCount",
    "bleedingEpisodeState",
    "bleedingDurationDays",
    "abnormalCervix",
    "suspicionOfCancer",
    "speculumExamStatus",
    "pelvicExamStatus",
    "coTestStatus",
    "stiAssessmentComplete",
    "stiIdentified",
    "suspectOralContraceptiveProblem",
    "localTreatmentStatus",
    "bleedingReviewDate",
    "bleedingResolved",
    "isPregnant",
    "hysterectomyType",
  ],
});

export type CanonicalFactsDiagnostics = {
  factsUsed: string[];
  factsMissing: string[];
  factsIgnored: string[];
  factsConflicting: string[];
  provenance: Record<string, CanonicalFactSource>;
};

function expressionFacts(expression: ConditionExpression, target: Set<string>) {
  switch (expression.type) {
    case "FACT":
      target.add(expression.fact);
      return;
    case "ALL":
    case "ANY":
      expression.expressions.forEach((child) => expressionFacts(child, target));
      return;
    case "NOT":
      expressionFacts(expression.expression, target);
      return;
    default:
      return;
  }
}

export function snapshotFactNames(snapshot: ClinicalRuleSnapshot) {
  const names = new Set<string>();
  for (const rule of snapshot.rules) {
    expressionFacts(rule.conditionExpression, names);
    rule.outcomeBranches?.forEach((branch) =>
      expressionFacts(branch.conditionExpression, names)
    );
  }
  return names;
}

/**
 * Facts that are always computed by the legacy routing engine, never observed or
 * entered. Their provenance is forced to `DERIVED_ROUTER` regardless of the
 * caller's default source, so no call site can accidentally assert that a
 * clinician supplied a routed value.
 *
 * `currentPathway` is required by essentially every CG-NCSP-3.1.0 rule and is
 * produced by `evaluateClinicalDecision().figure`.
 */
export const ROUTER_DERIVED_FACTS: ReadonlySet<string> = new Set(["currentPathway"]);

export function canonicalClinicalFactsV2FromFlatFacts(args: {
  subjectReference: string;
  facts: Record<string, unknown>;
  source?: CanonicalFactSource;
  enteredBy?: string;
  recordedAt?: string;
  /** Per-fact provenance overrides, applied on top of `source`. */
  factSources?: Record<string, CanonicalFactSource>;
  /**
   * Facts the caller is SUPPLYING A VALUE FOR without having observed one.
   *
   * They are recorded as `NOT_RECORDED` and carry NO value, which keeps them
   * out of the evaluated fact map entirely: an assumption cannot satisfy a
   * governed rule predicate, and a rule that needs one reports it as missing
   * instead of matching on it. The value the legacy contract was given is still
   * recorded on the case's ClinicalInput, which is where it belongs.
   *
   * Provenance alone was not enough. Labelling a fact SYNTHETIC_DEMO changed
   * only its description: `canonicalClinicalFactsV2ToFactMap` copies every
   * KNOWN fact into the map whatever its source, so an assumed sample type was
   * still the load-bearing fact behind a referral.
   */
  assumedFacts?: ReadonlySet<string>;
  /** Facts supplied verbatim by the source, with the cell they came from. */
  sourceFacts?: Readonly<Record<string, string | true>>;
  /** Facts that are meaning-preserving transformations, with the mapping name. */
  derivedFacts?: Readonly<Record<string, string>>;
  /** Identifies the router that produced `ROUTER_DERIVED_FACTS`, e.g. "business-figures-table1-v1". */
  routerEngine?: string;
}): CanonicalClinicalFactsV2 {
  const recordedAt = args.recordedAt ?? new Date().toISOString();
  const facts: Record<string, CanonicalFactV2> = {};
  for (const [key, value] of Object.entries(args.facts)) {
    if (
      value === undefined ||
      value === null ||
      (!(["string", "number", "boolean"].includes(typeof value)) &&
        !Array.isArray(value))
    ) {
      continue;
    }
    const routerDerived = ROUTER_DERIVED_FACTS.has(key);
    const assumed = args.assumedFacts?.has(key) ?? false;
    const sourceCell = args.sourceFacts?.[key];
    const derivation = routerDerived
      ? `router:${args.routerEngine ?? "legacy-router"}`
      : args.derivedFacts?.[key];
    // Unclassified unless the caller actually classified it. Defaulting to
    // SOURCE would have relabelled every legacy-normalised fact as reported
    // evidence, which is the over-claim this field exists to prevent.
    // Classified only where the caller actually classified it. A fact with no
    // stated class stays unclassified: defaulting to SOURCE would relabel every
    // legacy-normalised passthrough as reported evidence, and defaulting to
    // MISSING would contradict its own KNOWN status. Both are worse than
    // saying nothing.
    const evidenceClass: CanonicalFactEvidenceClass | undefined = assumed
      ? "ASSUMED"
      : sourceCell !== undefined
        ? "SOURCE"
        : derivation !== undefined
          ? "DERIVED"
          : undefined;
    facts[key] = {
      ...(evidenceClass ? { evidenceClass } : {}),
      ...(typeof sourceCell === "string" ? { sourceCell } : {}),
      ...(derivation && !assumed ? { derivation } : {}),
      // An assumed value is not knowledge, and the schema already refuses to let
      // a non-KNOWN fact carry a value that could be evaluated as one. The fact
      // is recorded as present-but-unresolved so the rules that need it report
      // it as missing.
      ...(assumed
        ? {}
        : { value: value as string | number | boolean | Array<string | number | boolean> }),
      status: assumed ? ("NOT_RECORDED" as const) : ("KNOWN" as const),
      source: routerDerived
        ? "DERIVED_ROUTER"
        : args.factSources?.[key] ?? args.source ?? "SYNTHETIC_DEMO",
      recordedAt,
      // A router-derived fact records the router identity, not a person.
      enteredBy: routerDerived
        ? args.routerEngine ?? "legacy-router"
        : args.enteredBy ?? "canonical-v2-adapter",
      verificationStatus: "UNVERIFIED",
      corrections: [],
    };
  }
  return CanonicalClinicalFactsV2Schema.parse({
    schemaId: CANONICAL_CLINICAL_FACTS_V2_SCHEMA_ID,
    subjectReference: args.subjectReference,
    capturedAt: recordedAt,
    facts,
  });
}

export function canonicalClinicalFactsV2ToFactMap(
  input: CanonicalClinicalFactsV2,
  snapshot: ClinicalRuleSnapshot
) {
  const parsed = CanonicalClinicalFactsV2Schema.parse(input);
  const referenced = snapshotFactNames(snapshot);
  const factMap: Record<string, unknown> = {};
  const factsUsed: string[] = [];
  const factsMissing: string[] = [];
  const factsIgnored: string[] = [];
  const factsConflicting: string[] = [];
  const provenance: Record<string, CanonicalFactSource> = {};

  for (const [name, fact] of Object.entries(parsed.facts)) {
    provenance[name] = fact.source;
    if (!referenced.has(name)) factsIgnored.push(name);
    if (fact.status === "KNOWN") {
      factMap[name] = fact.value;
      if (referenced.has(name)) factsUsed.push(name);
    } else if (fact.status === "CONFLICTING") {
      factsConflicting.push(name);
      if (referenced.has(name)) factsMissing.push(name);
    } else if (referenced.has(name)) {
      factsMissing.push(name);
    }
  }

  return {
    parsed,
    factMap,
    diagnostics: {
      factsUsed: factsUsed.sort(),
      factsMissing: [...new Set(factsMissing)].sort(),
      factsIgnored: factsIgnored.sort(),
      factsConflicting: factsConflicting.sort(),
      provenance,
    } satisfies CanonicalFactsDiagnostics,
  };
}

export function normalizedCanonicalFactsV2Snapshot(
  input: CanonicalClinicalFactsV2
) {
  const parsed = CanonicalClinicalFactsV2Schema.parse(input);
  return {
    ...parsed,
    facts: Object.fromEntries(
      Object.entries(parsed.facts)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, fact]) => [
          name,
          {
            ...fact,
            corrections: [...fact.corrections].sort((left, right) =>
              left.correctedAt.localeCompare(right.correctedAt)
            ),
          },
        ])
    ),
  };
}
