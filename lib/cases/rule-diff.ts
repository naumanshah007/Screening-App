/**
 * Rule release diff — compares two CaseRuleReleaseDefinitions by rule code so a
 * reviewer sees exactly what an edit changed (added / removed / changed rules)
 * before activating it.
 */

import type {
  CaseRuleDefinition,
  CaseRuleReleaseDefinition,
} from "@/lib/cases/rule-policy";

export type RuleFieldChange = { field: string; from: string; to: string };

export type RuleDiffEntry = {
  code: string;
  title: string;
  status: "added" | "removed" | "changed";
  changes: RuleFieldChange[];
};

export type RuleReleaseDiff = {
  added: RuleDiffEntry[];
  removed: RuleDiffEntry[];
  changed: RuleDiffEntry[];
  reordered: boolean;
  hasChanges: boolean;
};

/** Stable, human-readable summary of a rule's matching condition. */
function conditionSummary(rule: CaseRuleDefinition): string {
  switch (rule.kind) {
    case "case_flag":
      return `flag:${rule.flagName}`;
    case "fact_any":
      return `any(${[...rule.factLabels].sort().join(", ")})`;
    case "fact_all":
      return `all(${[...rule.factLabels].sort().join(", ")})`;
    case "fact_threshold":
      return `signal(${[...rule.signalLabels].sort().join(", ")}) ${rule.thresholdLabel}>=${rule.thresholdMin}`;
    case "compound":
      return [
        rule.allFactLabels?.length ? `all(${[...rule.allFactLabels].sort().join(", ")})` : "",
        rule.anyFactLabels?.length ? `any(${[...rule.anyFactLabels].sort().join(", ")})` : "",
        rule.absentFactLabels?.length ? `absent(${[...rule.absentFactLabels].sort().join(", ")})` : "",
        rule.thresholdLabel ? `${rule.thresholdLabel}[${rule.thresholdMin ?? ""}..${rule.thresholdMax ?? ""}]` : "",
      ]
        .filter(Boolean)
        .join(" & ");
    default:
      return "";
  }
}

function fieldChanges(a: CaseRuleDefinition, b: CaseRuleDefinition): RuleFieldChange[] {
  const changes: RuleFieldChange[] = [];
  const pairs: Array<[string, string, string]> = [
    ["Priority", a.recommendation.priority, b.recommendation.priority],
    ["Timeframe (days)", String(a.recommendation.targetDays ?? "—"), String(b.recommendation.targetDays ?? "—")],
    ["Category", a.recommendation.category, b.recommendation.category],
    ["Outcome", a.recommendation.outcome, b.recommendation.outcome],
    ["SMO review", String(Boolean(a.recommendation.requiresSmoReview)), String(Boolean(b.recommendation.requiresSmoReview))],
    ["Condition", conditionSummary(a), conditionSummary(b)],
    ["Title", a.title, b.title],
  ];
  for (const [field, from, to] of pairs) {
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

export function diffRuleReleases(
  base: CaseRuleReleaseDefinition,
  next: CaseRuleReleaseDefinition
): RuleReleaseDiff {
  const baseByCode = new Map(base.rules.map((r) => [r.code, r]));
  const nextByCode = new Map(next.rules.map((r) => [r.code, r]));

  const added: RuleDiffEntry[] = [];
  const removed: RuleDiffEntry[] = [];
  const changed: RuleDiffEntry[] = [];

  for (const rule of next.rules) {
    const prev = baseByCode.get(rule.code);
    if (!prev) {
      added.push({ code: rule.code, title: rule.title, status: "added", changes: [] });
      continue;
    }
    const changes = fieldChanges(prev, rule);
    if (changes.length > 0) {
      changed.push({ code: rule.code, title: rule.title, status: "changed", changes });
    }
  }

  for (const rule of base.rules) {
    if (!nextByCode.has(rule.code)) {
      removed.push({ code: rule.code, title: rule.title, status: "removed", changes: [] });
    }
  }

  // Order matters (first-match-wins), so flag pure reordering of shared codes.
  const sharedBase = base.rules.map((r) => r.code).filter((c) => nextByCode.has(c));
  const sharedNext = next.rules.map((r) => r.code).filter((c) => baseByCode.has(c));
  const reordered = sharedBase.join(",") !== sharedNext.join(",");

  return {
    added,
    removed,
    changed,
    reordered,
    hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0 || reordered,
  };
}
