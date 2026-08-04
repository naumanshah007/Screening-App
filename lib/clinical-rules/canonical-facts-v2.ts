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

export function canonicalClinicalFactsV2FromFlatFacts(args: {
  subjectReference: string;
  facts: Record<string, unknown>;
  source?: CanonicalFactSource;
  enteredBy?: string;
  recordedAt?: string;
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
    facts[key] = {
      value: value as string | number | boolean | Array<string | number | boolean>,
      status: "KNOWN",
      source: args.source ?? "SYNTHETIC_DEMO",
      recordedAt,
      enteredBy: args.enteredBy ?? "canonical-v2-adapter",
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
