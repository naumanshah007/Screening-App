/**
 * Rule vocabulary — the fact labels and threshold labels that actually appear
 * in a service line's rules, derived from the baseline definition. The friendly
 * editor offers only these so an admin can't author a rule that silently never
 * matches (every label here is one the fact/extraction/mapping layer can emit).
 */

import type { ServiceLine, TriagePriority } from "@prisma/client";

import {
  getBaselineCaseRuleReleaseDefinition,
  type CaseRuleDefinition,
  type CaseRuleReleaseDefinition,
} from "@/lib/cases/rule-policy";

export const TRIAGE_PRIORITIES: TriagePriority[] = [
  "P1_HSC",
  "P1",
  "P2_HSC",
  "P2",
  "P3",
  "P5",
  "REJECT",
  "DECLINE",
  "INFO_REQUIRED",
];

export const RULE_KINDS: { value: CaseRuleDefinition["kind"]; label: string }[] = [
  { value: "fact_any", label: "Any of these facts" },
  { value: "fact_all", label: "All of these facts" },
  { value: "compound", label: "Compound (all / any / absent / threshold)" },
  { value: "fact_threshold", label: "Signal + numeric threshold" },
  { value: "case_flag", label: "Case flag (high suspicion cancer)" },
];

function collectLabels(definition: CaseRuleReleaseDefinition): {
  factLabels: string[];
  thresholdLabels: string[];
} {
  const facts = new Set<string>();
  const thresholds = new Set<string>();
  for (const rule of definition.rules) {
    if (rule.kind === "fact_any" || rule.kind === "fact_all") {
      rule.factLabels.forEach((l) => facts.add(l));
    } else if (rule.kind === "compound") {
      rule.allFactLabels?.forEach((l) => facts.add(l));
      rule.anyFactLabels?.forEach((l) => facts.add(l));
      rule.absentFactLabels?.forEach((l) => facts.add(l));
      if (rule.thresholdLabel) thresholds.add(rule.thresholdLabel);
    } else if (rule.kind === "fact_threshold") {
      rule.signalLabels.forEach((l) => facts.add(l));
      thresholds.add(rule.thresholdLabel);
    }
  }
  return {
    factLabels: Array.from(facts).sort((a, b) => a.localeCompare(b)),
    thresholdLabels: Array.from(thresholds).sort((a, b) => a.localeCompare(b)),
  };
}

const CACHE = new Map<ServiceLine, { factLabels: string[]; thresholdLabels: string[] }>();

export function getRuleVocabulary(serviceLine: ServiceLine) {
  const cached = CACHE.get(serviceLine);
  if (cached) return cached;
  const vocab = collectLabels(getBaselineCaseRuleReleaseDefinition(serviceLine));
  CACHE.set(serviceLine, vocab);
  return vocab;
}
