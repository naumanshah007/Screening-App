import type { ServiceLine, TriagePriority } from "@prisma/client";

import { buildOperationalState, type OperationalState } from "@/lib/cases/operational";
import type { CaseRuleReleaseDefinition } from "@/lib/cases/rule-policy";

export type RuleEvaluationFact = {
  label: string;
  valueText: string;
  valueNumber?: number | null;
  evidence: string;
};

export type TraceMatch = {
  code: string;
  title: string;
  matched: boolean;
  impact: string;
  evidence: string[];
};

export type RuleEvaluationResult = {
  serviceLine: ServiceLine;
  recommendation: {
    priority: TriagePriority;
    category: string;
    outcome: string;
    requiresSmoReview?: boolean;
    targetDays?: number;
  };
  rationale: string[];
  trace: TraceMatch[];
  matchedRuleCode: string | null;
  operational: OperationalState;
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractNumber(valueText: string) {
  const match = /(\d+(?:\.\d+)?)/.exec(valueText);
  if (!match) return undefined;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatMissingFactEvidence(label: string) {
  return `No extracted ${label}`;
}

export function evaluateCaseRuleRelease(args: {
  serviceLine: ServiceLine;
  ruleDefinition: CaseRuleReleaseDefinition;
  highSuspicionCancer: boolean;
  facts: RuleEvaluationFact[];
}) {
  const { serviceLine, ruleDefinition, highSuspicionCancer, facts } = args;

  const hasFact = (label: string) => facts.some((fact) => fact.label === label);
  const getFacts = (label: string) => facts.filter((fact) => fact.label === label);
  const getFactNumber = (label: string) =>
    getFacts(label)
      .map((fact) => fact.valueNumber ?? extractNumber(fact.valueText))
      .find((value): value is number => value !== undefined);
  const evidenceForLabel = (label: string) => getFacts(label).map((fact) => fact.evidence);

  const trace: TraceMatch[] = [];
  let matchedRuleCode: string | null = null;
  let recommendation = {
    priority: ruleDefinition.defaultRecommendation.priority,
    category: ruleDefinition.defaultRecommendation.category,
    outcome: ruleDefinition.defaultRecommendation.outcome,
    requiresSmoReview: ruleDefinition.defaultRecommendation.requiresSmoReview,
    targetDays: ruleDefinition.defaultRecommendation.targetDays,
  };
  const rationale: string[] = [];

  for (const rule of ruleDefinition.rules) {
    if (rule.kind === "case_flag") {
      const matched = rule.flagName === "highSuspicionCancer" && highSuspicionCancer;
      trace.push({
        code: rule.code,
        title: rule.title,
        matched,
        impact: rule.impact,
        evidence: matched ? [rule.flagLabel] : [`No ${rule.flagLabel.toLowerCase()}`],
      });

      if (matched && matchedRuleCode === null) {
        matchedRuleCode = rule.code;
        recommendation = {
          priority: rule.recommendation.priority,
          category: rule.recommendation.category,
          outcome: rule.recommendation.outcome,
          requiresSmoReview: rule.recommendation.requiresSmoReview,
          targetDays: rule.recommendation.targetDays,
        };
        rationale.push(rule.recommendation.rationale);
      }
      continue;
    }

    if (rule.kind === "fact_any") {
      const matched = rule.factLabels.some((label) => hasFact(label));
      trace.push({
        code: rule.code,
        title: rule.title,
        matched,
        impact: rule.impact,
        evidence: matched
          ? unique(rule.factLabels.flatMap((label) => evidenceForLabel(label)))
          : unique(rule.factLabels.map((label) => formatMissingFactEvidence(label))),
      });

      if (matched && matchedRuleCode === null) {
        matchedRuleCode = rule.code;
        recommendation = {
          priority: rule.recommendation.priority,
          category: rule.recommendation.category,
          outcome: rule.recommendation.outcome,
          requiresSmoReview: rule.recommendation.requiresSmoReview,
          targetDays: rule.recommendation.targetDays,
        };
        rationale.push(rule.recommendation.rationale);
      }
      continue;
    }

    if (rule.kind === "fact_all") {
      const matched = rule.factLabels.every((label) => hasFact(label));
      trace.push({
        code: rule.code,
        title: rule.title,
        matched,
        impact: rule.impact,
        evidence: matched
          ? unique(rule.factLabels.flatMap((label) => evidenceForLabel(label)))
          : unique(
              rule.factLabels.map((label) =>
                hasFact(label) ? `${label} detected` : formatMissingFactEvidence(label)
              )
            ),
      });

      if (matched && matchedRuleCode === null) {
        matchedRuleCode = rule.code;
        recommendation = {
          priority: rule.recommendation.priority,
          category: rule.recommendation.category,
          outcome: rule.recommendation.outcome,
          requiresSmoReview: rule.recommendation.requiresSmoReview,
          targetDays: rule.recommendation.targetDays,
        };
        rationale.push(rule.recommendation.rationale);
      }
      continue;
    }

    if (rule.kind === "compound") {
      const allMatched =
        !rule.allFactLabels || rule.allFactLabels.every((label) => hasFact(label));
      const anyMatched =
        !rule.anyFactLabels || rule.anyFactLabels.some((label) => hasFact(label));
      const absentMatched =
        !rule.absentFactLabels ||
        rule.absentFactLabels.every((label) => !hasFact(label));
      const thresholdValue = rule.thresholdLabel
        ? getFactNumber(rule.thresholdLabel)
        : undefined;
      const minMatched =
        rule.thresholdMin === undefined ||
        (thresholdValue !== undefined && thresholdValue >= rule.thresholdMin);
      const maxMatched =
        rule.thresholdMax === undefined ||
        (thresholdValue !== undefined && thresholdValue <= rule.thresholdMax);
      const thresholdMatched =
        rule.thresholdLabel === undefined
          ? true
          : thresholdValue !== undefined && minMatched && maxMatched;
      const matched = allMatched && anyMatched && absentMatched && thresholdMatched;

      const evidence = matched
        ? unique([
            ...(rule.allFactLabels ?? []).flatMap((label) => evidenceForLabel(label)),
            ...(rule.anyFactLabels ?? []).flatMap((label) => evidenceForLabel(label)),
            ...(rule.absentFactLabels ?? []).map((label) => `No extracted ${label}`),
            ...(rule.thresholdLabel ? evidenceForLabel(rule.thresholdLabel) : []),
          ])
        : unique([
            ...((rule.allFactLabels ?? []).map((label) =>
              hasFact(label) ? `${label} detected` : formatMissingFactEvidence(label)
            )),
            ...(rule.anyFactLabels && rule.anyFactLabels.length > 0
              ? [
                  rule.anyFactLabels.some((label) => hasFact(label))
                    ? `${rule.anyFactLabels.join(" / ")} detected`
                    : `No extracted ${rule.anyFactLabels.join(" / ")}`,
                ]
              : []),
            ...((rule.absentFactLabels ?? []).map((label) =>
              hasFact(label) ? `${label} present` : `No extracted ${label}`
            )),
            ...(rule.thresholdLabel
              ? [
                  thresholdValue !== undefined
                    ? `${rule.thresholdLabel} ${thresholdValue}`
                    : formatMissingFactEvidence(rule.thresholdLabel),
                ]
              : []),
          ]);

      trace.push({
        code: rule.code,
        title: rule.title,
        matched,
        impact: rule.impact,
        evidence,
      });

      if (matched && matchedRuleCode === null) {
        matchedRuleCode = rule.code;
        recommendation = {
          priority: rule.recommendation.priority,
          category: rule.recommendation.category,
          outcome: rule.recommendation.outcome,
          requiresSmoReview: rule.recommendation.requiresSmoReview,
          targetDays: rule.recommendation.targetDays,
        };
        rationale.push(rule.recommendation.rationale);
      }
      continue;
    }

    const signalDetected = rule.signalLabels.some((label) => hasFact(label));
    const thresholdValue = getFactNumber(rule.thresholdLabel);
    const matched =
      signalDetected && thresholdValue !== undefined && thresholdValue >= rule.thresholdMin;

    trace.push({
      code: rule.code,
      title: rule.title,
      matched,
      impact: rule.impact,
      evidence: matched
        ? unique([
            ...rule.signalLabels.flatMap((label) => evidenceForLabel(label)),
            ...evidenceForLabel(rule.thresholdLabel),
          ])
        : unique([
            signalDetected
              ? `${rule.signalLabels.join(" / ")} detected`
              : `No extracted ${rule.signalLabels.join(" / ")}`,
            thresholdValue !== undefined
              ? `${rule.thresholdLabel} ${thresholdValue}`
              : formatMissingFactEvidence(rule.thresholdLabel),
          ]),
    });

    if (matched && matchedRuleCode === null) {
      matchedRuleCode = rule.code;
      recommendation = {
        priority: rule.recommendation.priority,
        category: rule.recommendation.category,
        outcome: rule.recommendation.outcome,
        requiresSmoReview: rule.recommendation.requiresSmoReview,
        targetDays: rule.recommendation.targetDays,
      };
      rationale.push(rule.recommendation.rationale);
    }
  }

  if (matchedRuleCode === null) {
    rationale.push(ruleDefinition.defaultRecommendation.rationale);
  }

  return {
    serviceLine,
    recommendation,
    rationale: unique(rationale),
    trace,
    matchedRuleCode,
    operational: buildOperationalState({
      priority: recommendation.priority,
      outcome: recommendation.outcome,
      requiresSmoReview: recommendation.requiresSmoReview,
    }),
  } satisfies RuleEvaluationResult;
}
