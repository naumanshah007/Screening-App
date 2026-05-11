import type { ServiceLine } from "@prisma/client";

import { evaluateCaseRuleRelease } from "@/lib/cases/rule-evaluator";
import { getCaseRuleFixturesForService } from "@/lib/cases/rule-fixtures";
import {
  parseCaseRuleReleaseDefinition,
  type CaseRuleReleaseDefinition,
} from "@/lib/cases/rule-policy";

export type CaseRuleFixtureResult = {
  id: string;
  title: string;
  sourceNote: string;
  passed: boolean;
  expected: {
    priority: string;
    category: string;
    matchedRuleCode: string | null;
  };
  actual: {
    priority: string;
    category: string;
    matchedRuleCode: string | null;
  };
};

export type CaseRuleRegressionSummary = {
  serviceLine: ServiceLine;
  total: number;
  passed: number;
  failed: number;
  fixtures: CaseRuleFixtureResult[];
};

export function runCaseRuleRegression(args: {
  serviceLine: ServiceLine;
  definition?: CaseRuleReleaseDefinition;
  definitionJson?: string;
}) {
  const definition =
    args.definition ??
    parseCaseRuleReleaseDefinition({
      serviceLine: args.serviceLine,
      definitionJson: args.definitionJson ?? "",
    });

  const fixtures = getCaseRuleFixturesForService(args.serviceLine);
  const results = fixtures.map((fixture) => {
    const evaluation = evaluateCaseRuleRelease({
      serviceLine: fixture.serviceLine,
      ruleDefinition: definition,
      highSuspicionCancer: Boolean(fixture.highSuspicionCancer),
      facts: fixture.facts.map((fact) => ({
        ...fact,
        evidence: `${fact.label}: ${fact.valueText} (fixture)`,
      })),
    });

    const passed =
      evaluation.recommendation.priority === fixture.expected.priority &&
      evaluation.recommendation.category === fixture.expected.category &&
      (fixture.expected.matchedRuleCode ?? null) === evaluation.matchedRuleCode;

    return {
      id: fixture.id,
      title: fixture.title,
      sourceNote: fixture.sourceNote,
      passed,
      expected: {
        priority: fixture.expected.priority,
        category: fixture.expected.category,
        matchedRuleCode: fixture.expected.matchedRuleCode ?? null,
      },
      actual: {
        priority: evaluation.recommendation.priority,
        category: evaluation.recommendation.category,
        matchedRuleCode: evaluation.matchedRuleCode,
      },
    } satisfies CaseRuleFixtureResult;
  });

  const passed = results.filter((result) => result.passed).length;

  return {
    serviceLine: args.serviceLine,
    total: results.length,
    passed,
    failed: results.length - passed,
    fixtures: results,
  } satisfies CaseRuleRegressionSummary;
}
