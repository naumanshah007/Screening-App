import type { RuleEvaluationMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { evaluateClinicalDecision } from "@/lib/engine/decision-engine";
import type { ClinicalInput } from "@/lib/engine/types";

import { calculateRuleSnapshotChecksum, deterministicJson } from "./checksum";
import {
  canonicalClinicalFactsV2ToFactMap,
  normalizedCanonicalFactsV2Snapshot,
  type CanonicalClinicalFactsV2,
  type CanonicalFactsDiagnostics,
} from "./canonical-facts-v2";
import { governedRulePrecedence } from "./compiled-v2-1";
import { CANONICAL_ENGINE_VERSION } from "./constants";
import { getClinicalRuleVersion, resolveActiveClinicalRuleVersion } from "./lifecycle";
import { normalizeClinicalFactMap } from "./facts";
import {
  parseSnapshot,
  type ClinicalRuleSnapshot,
  type ConditionExpression,
  type RuleDefinition,
  type ScalarFactValue,
  type SourceReference,
} from "./schema";

export type ClinicalFactMap = Record<string, unknown>;
type TruthValue = "TRUE" | "FALSE" | "UNKNOWN";
export const MAX_CONDITION_EVALUATION_DEPTH = 64;

export type ClinicalEvaluationResult = {
  ruleSetId: string;
  ruleVersionId: string;
  ruleVersionDisplay: string;
  ruleSetChecksum: string;
  engineVersion: string;
  matchedRuleIds: string[];
  branchPath: string[];
  provisionalRecommendation: string;
  riskLevel: string;
  urgency?: string;
  referralDestination?: string;
  repeatInterval?: string;
  missingInformation: string[];
  mandatoryReviewerConfirmation: boolean;
  reviewerRequirement: RuleDefinition["reviewerRequirement"];
  clinicianOnly: boolean;
  sourceReferences: SourceReference[];
  safetyNotices: string[];
  factDiagnostics?: CanonicalFactsDiagnostics;
};

export type EvaluationTraceEntry = {
  ruleId: string;
  result: TruthValue;
  missingFacts: string[];
  expressionType: ConditionExpression["type"];
};

export type SnapshotEvaluation = {
  matchedRules: RuleDefinition[];
  result: Omit<
    ClinicalEvaluationResult,
    "ruleSetId" | "ruleVersionId" | "ruleVersionDisplay" | "ruleSetChecksum" | "engineVersion"
  >;
  trace: EvaluationTraceEntry[];
};

function scalar(value: unknown): ScalarFactValue | undefined {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return value as ScalarFactValue;
  }
  return undefined;
}

function equal(left: unknown, right: ScalarFactValue) {
  return scalar(left) === right;
}

export function evaluateConditionExpression(
  expression: ConditionExpression,
  facts: ClinicalFactMap,
  depth = 0
): { result: TruthValue; missingFacts: string[] } {
  if (depth > MAX_CONDITION_EVALUATION_DEPTH) {
    throw new Error("Clinical rule condition exceeds the governed evaluation depth limit.");
  }
  switch (expression.type) {
    case "SOURCE_TEXT":
      return { result: "UNKNOWN", missingFacts: [] };
    case "ALWAYS":
      return { result: "TRUE", missingFacts: [] };
    case "NOT": {
      const child = evaluateConditionExpression(expression.expression, facts, depth + 1);
      return {
        result: child.result === "TRUE" ? "FALSE" : child.result === "FALSE" ? "TRUE" : "UNKNOWN",
        missingFacts: child.missingFacts,
      };
    }
    case "ALL": {
      const children = expression.expressions.map((child) =>
        evaluateConditionExpression(child, facts, depth + 1)
      );
      const missingFacts = [...new Set(children.flatMap((child) => child.missingFacts))];
      if (children.some((child) => child.result === "FALSE")) return { result: "FALSE", missingFacts };
      if (children.some((child) => child.result === "UNKNOWN")) return { result: "UNKNOWN", missingFacts };
      return { result: "TRUE", missingFacts };
    }
    case "ANY": {
      const children = expression.expressions.map((child) =>
        evaluateConditionExpression(child, facts, depth + 1)
      );
      const missingFacts = [...new Set(children.flatMap((child) => child.missingFacts))];
      if (children.some((child) => child.result === "TRUE")) return { result: "TRUE", missingFacts };
      if (children.some((child) => child.result === "UNKNOWN")) return { result: "UNKNOWN", missingFacts };
      return { result: "FALSE", missingFacts };
    }
    case "FACT": {
      const present = Object.prototype.hasOwnProperty.call(facts, expression.fact) && facts[expression.fact] != null;
      if (expression.operator === "EXISTS") return { result: present ? "TRUE" : "FALSE", missingFacts: [] };
      if (expression.operator === "MISSING") return { result: present ? "FALSE" : "TRUE", missingFacts: [] };
      if (!present) return { result: "UNKNOWN", missingFacts: [expression.fact] };
      const actual = facts[expression.fact];
      const expected = expression.value;

      switch (expression.operator) {
        case "EQ":
          return { result: !Array.isArray(expected) && equal(actual, expected ?? null) ? "TRUE" : "FALSE", missingFacts: [] };
        case "NEQ":
          return { result: !Array.isArray(expected) && !equal(actual, expected ?? null) ? "TRUE" : "FALSE", missingFacts: [] };
        case "IN":
          return {
            result: Array.isArray(expected) && expected.some((value) => equal(actual, value)) ? "TRUE" : "FALSE",
            missingFacts: [],
          };
        case "NOT_IN":
          return {
            result: Array.isArray(expected) && !expected.some((value) => equal(actual, value)) ? "TRUE" : "FALSE",
            missingFacts: [],
          };
        case "CONTAINS": {
          if (typeof actual === "string" && typeof expected === "string") {
            return { result: actual.includes(expected) ? "TRUE" : "FALSE", missingFacts: [] };
          }
          if (Array.isArray(actual) && !Array.isArray(expected)) {
            return { result: actual.some((value) => equal(value, expected ?? null)) ? "TRUE" : "FALSE", missingFacts: [] };
          }
          return { result: "FALSE", missingFacts: [] };
        }
        case "GT":
        case "GTE":
        case "LT":
        case "LTE": {
          if (typeof actual !== "number" || typeof expected !== "number") {
            return { result: "FALSE", missingFacts: [] };
          }
          const matched =
            expression.operator === "GT"
              ? actual > expected
              : expression.operator === "GTE"
                ? actual >= expected
                : expression.operator === "LT"
                  ? actual < expected
                  : actual <= expected;
          return { result: matched ? "TRUE" : "FALSE", missingFacts: [] };
        }
      }
    }
  }
}

const SAFETY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as const;

function inferUrgency(rule: RuleDefinition | undefined) {
  if (!rule) return undefined;
  const value = `${rule.timingDestination} ${rule.provisionalOutcome}`;
  if (/immediate|urgent|P1\b/i.test(value)) return "URGENT";
  if (/P2\b/i.test(value)) return "P2";
  if (/P3\b/i.test(value)) return "P3";
  return undefined;
}

function inferRepeatInterval(rule: RuleDefinition | undefined) {
  if (!rule) return undefined;
  return rule.timingDestination || undefined;
}

type OutcomeBranch = NonNullable<RuleDefinition["outcomeBranches"]>[number];

function selectOutcomeBranch(
  rule: RuleDefinition,
  facts: ClinicalFactMap
): OutcomeBranch | undefined {
  return rule.outcomeBranches?.find(
    (branch) =>
      evaluateConditionExpression(branch.conditionExpression, facts).result === "TRUE"
  );
}

function hasKnownPositiveEvidence(
  expression: ConditionExpression,
  facts: ClinicalFactMap
): boolean {
  switch (expression.type) {
    case "FACT":
      return evaluateConditionExpression(expression, facts).result === "TRUE";
    case "ALL":
    case "ANY":
      return expression.expressions.some((child) =>
        hasKnownPositiveEvidence(child, facts)
      );
    case "NOT":
      return evaluateConditionExpression(expression, facts).result === "TRUE";
    case "ALWAYS":
      return true;
    case "SOURCE_TEXT":
      return false;
  }
}

export function evaluateClinicalSnapshot(
  snapshot: ClinicalRuleSnapshot,
  facts: ClinicalFactMap
): SnapshotEvaluation {
  const trace: EvaluationTraceEntry[] = [];
  const matchedRules: RuleDefinition[] = [];
  const unknownRules: RuleDefinition[] = [];
  const missingInformation = new Set<string>();

  for (const rule of snapshot.rules) {
    const evaluated = evaluateConditionExpression(rule.conditionExpression, facts);
    const missingFacts = evaluated.missingFacts.length
      ? evaluated.missingFacts
      : evaluated.result === "UNKNOWN"
        ? rule.requiredFacts.filter((fact) => facts[fact] == null)
        : [];
    trace.push({
      ruleId: rule.stableRuleId,
      result: evaluated.result,
      missingFacts,
      expressionType: rule.conditionExpression.type,
    });
    if (evaluated.result === "TRUE") matchedRules.push(rule);
    if (evaluated.result === "UNKNOWN") {
      unknownRules.push(rule);
      missingFacts.forEach((fact) => missingInformation.add(fact));
    }
  }

  matchedRules.sort(
    (left, right) =>
      governedRulePrecedence(right) - governedRulePrecedence(left) ||
      SAFETY_RANK[right.safetyPriority] - SAFETY_RANK[left.safetyPriority] ||
      snapshot.rules.indexOf(left) - snapshot.rules.indexOf(right)
  );
  const controllingRule = matchedRules[0];
  const unresolvedHighRisk = unknownRules.filter((rule) =>
    ["CRITICAL", "HIGH"].includes(rule.safetyPriority)
  );

  if (!controllingRule) {
    const riskLevel = unresolvedHighRisk.some((rule) => rule.safetyPriority === "CRITICAL")
      ? "CRITICAL"
      : "HIGH";
    return {
      matchedRules,
      trace,
      result: {
        matchedRuleIds: [],
        branchPath: ["node:root", "node:clinician-review:unresolved-source-condition"],
        provisionalRecommendation:
          "Insufficient governed executable rule coverage. Stop automated routing and obtain clinician review.",
        riskLevel,
        missingInformation: [...missingInformation],
        mandatoryReviewerConfirmation: true,
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: true,
        sourceReferences: unresolvedHighRisk.flatMap((rule) => rule.sourceReferences),
        safetyNotices: snapshot.safetyNotices,
      },
    };
  }

  const outcomeBranch = selectOutcomeBranch(controllingRule, facts);
  const outcome = outcomeBranch?.provisionalOutcome ?? controllingRule.provisionalOutcome;
  const timing = outcomeBranch?.timingDestination ?? controllingRule.timingDestination;
  const careSetting = outcomeBranch?.careSetting ?? controllingRule.careSetting;

  const clinicianOnly =
    outcomeBranch?.clinicianOnly ??
    controllingRule.clinicianOnly ??
    (controllingRule.conditionExpression.type === "SOURCE_TEXT" ||
      /clinician|mdm|specialist/i.test(
        `${controllingRule.automationBoundary} ${controllingRule.reviewerRequirement}`
      ));
  return {
    matchedRules,
    trace,
    result: {
      matchedRuleIds: matchedRules.map((rule) => rule.stableRuleId),
      branchPath: [
        "node:root",
        `node:section:${controllingRule.section.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
        `node:rule:${controllingRule.stableRuleId}`,
        ...(outcomeBranch ? [`branch:${outcomeBranch.id}`] : []),
        `node:outcome:${controllingRule.stableRuleId}`,
      ],
      provisionalRecommendation: outcome,
      riskLevel: controllingRule.safetyPriority,
      urgency:
        outcomeBranch?.urgency ??
        inferUrgency({
          ...controllingRule,
          provisionalOutcome: outcome,
          timingDestination: timing,
        }),
      referralDestination: careSetting || undefined,
      repeatInterval: timing || inferRepeatInterval(controllingRule),
      missingInformation: [...missingInformation],
      mandatoryReviewerConfirmation: true,
      reviewerRequirement:
        outcomeBranch?.reviewerRequirement ?? controllingRule.reviewerRequirement,
      clinicianOnly,
      sourceReferences:
        outcomeBranch?.sourceReferences ?? controllingRule.sourceReferences,
      safetyNotices: snapshot.safetyNotices,
    },
  };
}

export function evaluateCanonicalClinicalFactsV2(
  snapshot: ClinicalRuleSnapshot,
  input: CanonicalClinicalFactsV2
): SnapshotEvaluation {
  const converted = canonicalClinicalFactsV2ToFactMap(input, snapshot);
  const evaluated = evaluateClinicalSnapshot(snapshot, converted.factMap);
  const explicitlyUnresolved = new Set(converted.diagnostics.factsMissing);
  const relevantUnknownTrace = evaluated.trace.filter((entry) => {
    if (entry.result !== "UNKNOWN" || entry.missingFacts.length === 0) {
      return false;
    }
    if (!entry.missingFacts.some((fact) => explicitlyUnresolved.has(fact))) {
      return false;
    }
    const rule = snapshot.rules.find(
      (candidate) => candidate.stableRuleId === entry.ruleId
    );
    return Boolean(
      rule && hasKnownPositiveEvidence(rule.conditionExpression, converted.factMap)
    );
  });
  const diagnostics: CanonicalFactsDiagnostics = {
    ...converted.diagnostics,
    factsMissing: [
      ...new Set([
        ...converted.diagnostics.factsMissing,
        ...relevantUnknownTrace.flatMap((entry) => entry.missingFacts),
        ...(evaluated.matchedRules[0]?.requiredFacts.filter(
          (fact) => converted.factMap[fact] == null
        ) ?? []),
      ]),
    ].sort(),
  };

  if (diagnostics.factsConflicting.length > 0) {
    return {
      ...evaluated,
      result: {
        ...evaluated.result,
        matchedRuleIds: [],
        branchPath: ["node:root", "node:clinician-review:conflicting-canonical-facts"],
        provisionalRecommendation:
          "Conflicting canonical clinical facts require governed clinician review before a pathway can be selected.",
        riskLevel: "HIGH",
        urgency: undefined,
        referralDestination: undefined,
        repeatInterval: undefined,
        missingInformation: diagnostics.factsMissing,
        mandatoryReviewerConfirmation: true,
        reviewerRequirement: "SPECIALIST_REVIEW",
        clinicianOnly: true,
        sourceReferences: [],
        factDiagnostics: diagnostics,
      },
    };
  }

  const controlling = evaluated.matchedRules[0];
  const unresolvedHigherRisk = relevantUnknownTrace
    .map((entry) => snapshot.rules.find((rule) => rule.stableRuleId === entry.ruleId))
    .filter((rule): rule is RuleDefinition => Boolean(rule))
    .filter(
      (rule) =>
        ["HIGH", "CRITICAL"].includes(rule.safetyPriority) &&
        (!controlling ||
          governedRulePrecedence(rule) >= governedRulePrecedence(controlling))
    );

  if (unresolvedHigherRisk.length > 0) {
    return {
      ...evaluated,
      result: {
        ...evaluated.result,
        matchedRuleIds: [],
        branchPath: ["node:root", "node:clinician-review:missing-canonical-facts"],
        provisionalRecommendation:
          "Required canonical clinical facts are unknown or not recorded. Stop automated routing and obtain the identified information.",
        riskLevel: unresolvedHigherRisk.some(
          (rule) => rule.safetyPriority === "CRITICAL"
        )
          ? "CRITICAL"
          : "HIGH",
        urgency: undefined,
        referralDestination: undefined,
        repeatInterval: undefined,
        missingInformation: diagnostics.factsMissing,
        mandatoryReviewerConfirmation: true,
        reviewerRequirement: "SPECIALIST_REVIEW",
        clinicianOnly: true,
        sourceReferences: unresolvedHigherRisk.flatMap(
          (rule) => rule.sourceReferences
        ),
        factDiagnostics: diagnostics,
      },
    };
  }

  return {
    ...evaluated,
    result: {
      ...evaluated.result,
      missingInformation: diagnostics.factsMissing,
      factDiagnostics: diagnostics,
    },
  };
}

function compareLegacyResult(
  canonical: ClinicalEvaluationResult,
  legacyInput?: ClinicalInput
) {
  if (!legacyInput) return undefined;
  const legacy = evaluateClinicalDecision(legacyInput);
  return {
    legacyEngine: "business-figures-table1-v1",
    legacy,
    differences: {
      recommendation: canonical.provisionalRecommendation !== legacy.recommendation,
      riskLevel: canonical.riskLevel !== legacy.riskLevel,
      referralDestination: canonical.referralDestination !== legacy.referralType,
      reviewerBoundary: canonical.mandatoryReviewerConfirmation,
    },
  };
}

export async function evaluateClinicalCase(args: {
  facts?: ClinicalFactMap;
  canonicalFactsV2?: CanonicalClinicalFactsV2;
  ruleVersionId: string;
  evaluationMode: RuleEvaluationMode;
  organisationKey?: string;
  legacyInput?: ClinicalInput;
  caseId?: string;
  batchRunId?: string;
  previousEvaluationId?: string;
  regradeReason?: string;
}) {
  const version = await getClinicalRuleVersion(args.ruleVersionId);
  if (!version) throw new Error("Clinical rule version not found.");
  if (args.evaluationMode === "LIVE_DEMO" && !["PUBLISHED", "ACTIVE"].includes(version.status)) {
    throw new Error("Live demo evaluation requires a published or active clinical rule version.");
  }
  if (args.previousEvaluationId && !args.regradeReason?.trim()) {
    throw new Error("A regrade reason is required when linking a previous evaluation.");
  }

  const snapshot = parseSnapshot(JSON.parse(version.snapshotJson));
  const checksum = calculateRuleSnapshotChecksum(snapshot);
  if (version.checksum !== checksum) throw new Error("Clinical rule snapshot checksum mismatch.");
  if (!args.facts && !args.canonicalFactsV2) {
    throw new Error("Canonical facts or a legacy-compatible fact map is required.");
  }
  if (args.facts && args.canonicalFactsV2) {
    throw new Error("Provide one canonical input representation, not both.");
  }
  const normalizedFacts = args.canonicalFactsV2
    ? canonicalClinicalFactsV2ToFactMap(args.canonicalFactsV2, snapshot).factMap
    : normalizeClinicalFactMap(args.facts ?? {});
  const evaluated = args.canonicalFactsV2
    ? evaluateCanonicalClinicalFactsV2(snapshot, args.canonicalFactsV2)
    : evaluateClinicalSnapshot(snapshot, normalizedFacts);
  const result: ClinicalEvaluationResult = {
    ruleSetId: version.ruleSetId,
    ruleVersionId: version.id,
    ruleVersionDisplay: version.displayVersion,
    ruleSetChecksum: checksum,
    engineVersion: snapshot.engineContractVersion ?? CANONICAL_ENGINE_VERSION,
    ...evaluated.result,
  };
  const legacyComparison =
    args.evaluationMode === "SHADOW"
      ? compareLegacyResult(result, args.legacyInput)
      : undefined;

  const evaluation = await prisma.ruleEvaluation.create({
    data: {
      caseId: args.caseId,
      batchRunId: args.batchRunId,
      ruleSetId: version.ruleSetId,
      ruleVersionId: version.id,
      ruleVersionDisplay: version.displayVersion,
      rulesetChecksum: checksum,
      engineVersion: result.engineVersion,
      evaluationMode: args.evaluationMode,
      canonicalInputSnapshot: deterministicJson(
        args.canonicalFactsV2
          ? normalizedCanonicalFactsV2Snapshot(args.canonicalFactsV2)
          : normalizedFacts
      ),
      matchedRuleIds: JSON.stringify(result.matchedRuleIds),
      branchPath: JSON.stringify(result.branchPath),
      provisionalRecommendation: result.provisionalRecommendation,
      riskLevel: result.riskLevel,
      urgency: result.urgency,
      referralDestination: result.referralDestination,
      repeatInterval: result.repeatInterval,
      missingInformation: JSON.stringify(result.missingInformation),
      reviewerRequirement: result.clinicianOnly
        ? `CLINICIAN_ONLY:${result.reviewerRequirement}`
        : result.reviewerRequirement,
      mandatoryReviewerConfirmation: result.mandatoryReviewerConfirmation,
      clinicianOnly: result.clinicianOnly,
      sourceReferences: JSON.stringify(result.sourceReferences),
      evaluationTrace: JSON.stringify({
        trace: evaluated.trace,
        factDiagnostics: evaluated.result.factDiagnostics,
        legacyComparison,
      }),
      previousEvaluationId: args.previousEvaluationId,
      regradeReason: args.regradeReason,
    },
  });

  return { evaluationId: evaluation.id, result, trace: evaluated.trace, legacyComparison };
}

export async function evaluateWithActiveClinicalRuleVersion(args: {
  facts: ClinicalFactMap;
  organisationKey?: string;
  legacyInput?: ClinicalInput;
  evaluationMode?: RuleEvaluationMode;
  caseId?: string;
  batchRunId?: string;
}) {
  const version = await resolveActiveClinicalRuleVersion({
    environment: "DEMO",
    organisationKey: args.organisationKey,
  });
  if (!version) throw new Error("No active DEMO clinical rule version is configured.");
  return evaluateClinicalCase({
    ...args,
    ruleVersionId: version.id,
    evaluationMode: args.evaluationMode ?? "LIVE_DEMO",
  });
}
