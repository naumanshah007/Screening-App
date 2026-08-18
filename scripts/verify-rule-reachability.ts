/**
 * Phase 0b — exact reachability verification and clinical discrepancy register.
 *
 * Phase 0 (scripts/analyse-rule-overlap.ts) showed the rulebook is an ordered
 * exception system and flagged rules that appear unreachable. That was a
 * heuristic search over an unconstrained label space. This script replaces it
 * with an exact decision procedure over the LEGAL fact domain, derived from the
 * actual fact-production pipeline, and classifies every finding.
 *
 * Run:
 *   npx tsx scripts/verify-rule-reachability.ts            # human report
 *   npx tsx scripts/verify-rule-reachability.ts --write    # + CSV/JSON register
 *
 * Analysis tool only. Reads source and baseline definitions; never writes to the
 * database and never mutates a rule release.
 */

import { readFileSync, writeFileSync } from "node:fs";
import type { ServiceLine } from "@prisma/client";

import {
  getBaselineCaseRuleReleaseDefinition,
  type CaseRuleDefinition,
  type CaseRuleReleaseDefinition,
} from "../lib/cases/rule-policy";
import {
  evaluateCaseRuleRelease,
  type RuleEvaluationFact,
} from "../lib/cases/rule-evaluator";

// ─────────────────────────────────────────────────────────────────────────────
// 1. LEGAL FACT DOMAIN
//
// Facts reach the evaluator by exactly two disjoint routes. Neither ever mixes
// with the other, so a rule is operationally reachable if it is reachable on
// EITHER route.
//
//   Path A — batch pipeline.  lib/batch/rule-facts.ts buildBatchRuleFacts()
//            is the ONLY fact source (see gradeCanonicalCase). Every label comes
//            from a single-select enum field, so the exclusions are hard.
//
//   Path B — case pipeline.   lib/cases/grading.ts buildEvaluationFacts() unions
//            persisted ExtractedFact rows, buildMappedFieldFacts() and
//            buildStructuredTextFacts(). The last runs the regex extractor in
//            lib/cases/fact-extraction.ts over free text, which can emit labels
//            independently — so field-level exclusivity does NOT hold on Path B
//            for any label the extractor can also produce.
// ─────────────────────────────────────────────────────────────────────────────

export type Path = "A_BATCH" | "B_CASE";

/** Parse the labels each producer can emit, straight from its source. */
function readProducerLabels() {
  const grab = (file: string, re: RegExp) => {
    const out = new Set<string>();
    for (const m of readFileSync(file, "utf8").matchAll(re)) out.add(m[1]);
    return out;
  };

  return {
    freeText: grab("lib/cases/fact-extraction.ts", /label:\s*"([^"]+)"/g),
    mappedField: grab("lib/cases/grading.ts", /addMappedFact\(\s*\n?\s*"([^"]+)"/g),
    batch: grab("lib/batch/rule-facts.ts", /fact\("([^"]+)"/g),
  };
}

/**
 * Single-select source fields. Labels within one group cannot co-occur when the
 * only producer for them on that path is the field itself.
 * Derived by reading the if/else-if chains in each producer.
 */
const PATH_A_EXCLUSIONS: string[][] = [
  // buildBatchRuleFacts: c.hpvResult
  ["HPV 16/18", "HPV Other", "HPV Not Detected"],
  // buildBatchRuleFacts: cytologyFacts(c.cytologyResult)
  [
    "Normal cytology",
    "ASC-US",
    "LSIL",
    "ASC-H",
    "HSIL",
    "Cancer suspicion cytology",
    "Glandular abnormality",
  ],
  // buildBatchRuleFacts: histologyFacts(c.histologyResult)
  ["CIN2", "Previous LSIL histology"],
];

const PATH_B_EXCLUSIONS: string[][] = [
  // buildMappedFieldFacts: hpvTestResult / cytologySample / referrerReasonCode /
  // gynaecologyCategory are single-select, BUT every label they emit is also
  // producible by the free-text extractor, so no exclusion survives on Path B.
];

/** Numeric labels — carry valueNumber and are compared with min/max. */
const NUMERIC_LABELS = new Set([
  "CA-125",
  "Endometrial thickness",
  "Fibroid size",
  "Ovarian cyst size",
  "Cervical polyp size",
  "Endometrioma size",
]);

export type FactDomain = {
  path: Path;
  producible: Set<string>;
  exclusions: string[][];
};

export function buildDomains(): Record<Path, FactDomain> {
  const producers = readProducerLabels();
  return {
    A_BATCH: {
      path: "A_BATCH",
      producible: new Set(producers.batch),
      exclusions: PATH_A_EXCLUSIONS,
    },
    B_CASE: {
      path: "B_CASE",
      producible: new Set([...producers.freeText, ...producers.mappedField]),
      exclusions: PATH_B_EXCLUSIONS,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. NORMALISED PREDICATES
// ─────────────────────────────────────────────────────────────────────────────

type Predicate = {
  code: string;
  index: number;
  title: string;
  all: Set<string>;
  anyGroups: string[][];
  not: Set<string>;
  threshold?: { label: string; min?: number; max?: number };
  requiresFlag: boolean;
  rec: CaseRuleDefinition["recommendation"];
};

function toPredicate(rule: CaseRuleDefinition, index: number): Predicate {
  const base = {
    code: rule.code,
    index,
    title: rule.title,
    all: new Set<string>(),
    anyGroups: [] as string[][],
    not: new Set<string>(),
    requiresFlag: false,
    rec: rule.recommendation,
  };
  switch (rule.kind) {
    case "case_flag":
      return { ...base, requiresFlag: true };
    case "fact_any":
      return { ...base, anyGroups: [[...rule.factLabels]] };
    case "fact_all":
      return { ...base, all: new Set(rule.factLabels) };
    case "fact_threshold":
      return {
        ...base,
        anyGroups: [[...rule.signalLabels]],
        threshold: { label: rule.thresholdLabel, min: rule.thresholdMin },
      };
    case "compound":
      return {
        ...base,
        all: new Set(rule.allFactLabels ?? []),
        anyGroups: rule.anyFactLabels?.length ? [[...rule.anyFactLabels]] : [],
        not: new Set(rule.absentFactLabels ?? []),
        threshold: rule.thresholdLabel
          ? { label: rule.thresholdLabel, min: rule.thresholdMin, max: rule.thresholdMax }
          : undefined,
      };
  }
}

function labelsOf(p: Predicate): string[] {
  return [
    ...p.all,
    ...p.anyGroups.flat(),
    ...p.not,
    ...(p.threshold ? [p.threshold.label] : []),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BOUNDARY-COMPLETE NUMERIC DOMAINS
//
// For every threshold appearing anywhere in the ruleset, generate the full
// equivalence-class set around each cut point: below, at, and above, plus the
// absent state. Interval arithmetic over these classes is complete — any value
// not in the set is behaviourally identical to one that is.
// ─────────────────────────────────────────────────────────────────────────────

function numericDomain(label: string, predicates: Predicate[]): number[] {
  const values = new Set<number>();
  for (const p of predicates) {
    if (p.threshold?.label !== label) continue;
    for (const bound of [p.threshold.min, p.threshold.max]) {
      if (bound === undefined) continue;
      values.add(bound - 1);
      values.add(bound);
      values.add(bound + 1);
      // fractional boundaries (e.g. max 2.9) need a strictly-inside neighbour
      values.add(bound - 0.1);
      values.add(bound + 0.1);
    }
  }
  if (values.size === 0) values.add(1);
  values.add(0);
  return [...values].filter((v) => v >= 0).sort((a, b) => a - b);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. EXACT REACHABILITY
//
// Question: does a legal fact vector exist with R true and every earlier rule
// false? Complete branch-and-bound.
//
// Soundness of the search-space reduction: a label not required by R is left
// absent unless adding it breaks an earlier rule's `absent` constraint — the
// only way an extra fact can ever help. Those additions are exactly the branch
// options below, so nothing reachable is skipped.
// ─────────────────────────────────────────────────────────────────────────────

type Assignment = {
  forcedTrue: Set<string>;
  forcedFalse: Set<string>;
  numbers: Map<string, number>;
};

type SolveResult =
  | { status: "SAT"; witness: Assignment }
  | { status: "UNSAT"; reason: string }
  | { status: "BUDGET"; nodes: number };

const NODE_BUDGET = 200_000;

function solve(
  target: Predicate,
  earlier: Predicate[],
  domain: FactDomain,
  allPredicates: Predicate[]
): SolveResult {
  // Any label the pipeline cannot emit is permanently absent.
  const required = labelsOf(target).filter((l) => !target.not.has(l));
  const unproducibleRequired = [...target.all].filter((l) => !domain.producible.has(l));
  if (unproducibleRequired.length > 0) {
    return {
      status: "UNSAT",
      reason: `pipeline cannot emit required label(s): ${unproducibleRequired.join(", ")}`,
    };
  }
  if (target.threshold && !domain.producible.has(target.threshold.label)) {
    return {
      status: "UNSAT",
      reason: `pipeline cannot emit numeric field: ${target.threshold.label}`,
    };
  }
  for (const group of target.anyGroups) {
    if (!group.some((l) => domain.producible.has(l))) {
      return {
        status: "UNSAT",
        reason: `pipeline cannot emit any of: ${group.join(", ")}`,
      };
    }
  }

  const violatesExclusion = (present: Set<string>) =>
    domain.exclusions.some(
      (group) => group.filter((l) => present.has(l)).length > 1
    );

  const matches = (p: Predicate, present: Set<string>, numbers: Map<string, number>) => {
    if (p.requiresFlag) return false; // probes run with the HSC flag off
    for (const l of p.all) if (!present.has(l)) return false;
    for (const l of p.not) if (present.has(l)) return false;
    for (const g of p.anyGroups) if (!g.some((l) => present.has(l))) return false;
    if (p.threshold) {
      if (!present.has(p.threshold.label)) return false;
      const v = numbers.get(p.threshold.label);
      if (v === undefined) return false;
      if (p.threshold.min !== undefined && v < p.threshold.min) return false;
      if (p.threshold.max !== undefined && v > p.threshold.max) return false;
    }
    return true;
  };

  // Enumerate the target's own choices: one member per `any` group, and a
  // boundary-complete value for its numeric field.
  const anyChoices = target.anyGroups.map((g) =>
    g.filter((l) => domain.producible.has(l) && !target.not.has(l))
  );
  if (anyChoices.some((c) => c.length === 0)) {
    return { status: "UNSAT", reason: "no producible member for a required signal group" };
  }
  const anyCombos = anyChoices.reduce<string[][]>(
    (acc, choices) => acc.flatMap((prefix) => choices.map((c) => [...prefix, c])),
    [[]]
  );

  const numericValues = target.threshold
    ? numericDomain(target.threshold.label, allPredicates).filter((v) => {
        const t = target.threshold!;
        if (t.min !== undefined && v < t.min) return false;
        if (t.max !== undefined && v > t.max) return false;
        return true;
      })
    : [undefined];
  if (target.threshold && numericValues.length === 0) {
    return { status: "UNSAT", reason: "numeric constraint has no satisfying value" };
  }

  let nodes = 0;

  const search = (assign: Assignment): Assignment | null => {
    if (nodes++ > NODE_BUDGET) throw new RangeError("budget");

    const present = new Set(assign.forcedTrue);
    if (violatesExclusion(present)) return null;
    if (!matches(target, present, assign.numbers)) return null;

    const blocker = earlier.find((p) => matches(p, present, assign.numbers));
    if (!blocker) return assign;

    // Ways to falsify the blocker without falsifying the target.
    const options: Array<() => Assignment | null> = [];

    for (const l of blocker.all) {
      if (required.includes(l) || assign.forcedTrue.has(l)) continue;
      if (assign.forcedFalse.has(l)) continue;
      options.push(() => ({
        forcedTrue: new Set([...assign.forcedTrue].filter((x) => x !== l)),
        forcedFalse: new Set([...assign.forcedFalse, l]),
        numbers: assign.numbers,
      }));
    }

    for (const l of blocker.not) {
      if (target.not.has(l) || assign.forcedFalse.has(l)) continue;
      if (!domain.producible.has(l) || assign.forcedTrue.has(l)) continue;
      options.push(() => ({
        forcedTrue: new Set([...assign.forcedTrue, l]),
        forcedFalse: assign.forcedFalse,
        numbers: assign.numbers,
      }));
    }

    for (const group of blocker.anyGroups) {
      if (group.some((l) => required.includes(l))) continue;
      options.push(() => ({
        forcedTrue: new Set([...assign.forcedTrue].filter((x) => !group.includes(x))),
        forcedFalse: new Set([...assign.forcedFalse, ...group]),
        numbers: assign.numbers,
      }));
    }

    if (blocker.threshold && blocker.threshold.label !== target.threshold?.label) {
      const l = blocker.threshold.label;
      if (!required.includes(l) && !assign.forcedTrue.has(l)) {
        options.push(() => ({
          forcedTrue: new Set([...assign.forcedTrue].filter((x) => x !== l)),
          forcedFalse: new Set([...assign.forcedFalse, l]),
          numbers: assign.numbers,
        }));
      }
    }

    for (const makeNext of options) {
      const next = makeNext();
      if (next === null) continue;
      // A commitment must not contradict an earlier one.
      if ([...next.forcedTrue].some((l) => next.forcedFalse.has(l))) continue;
      const found = search(next);
      if (found) return found;
    }

    return null;
  };

  try {
    for (const combo of anyCombos) {
      for (const value of numericValues) {
        const forcedTrue = new Set<string>([...target.all, ...combo]);
        if (target.threshold) forcedTrue.add(target.threshold.label);
        if ([...forcedTrue].some((l) => target.not.has(l))) continue;
        if ([...forcedTrue].some((l) => !domain.producible.has(l))) continue;

        const numbers = new Map<string, number>();
        if (target.threshold && value !== undefined) {
          numbers.set(target.threshold.label, value);
        }

        const found = search({ forcedTrue, forcedFalse: new Set(target.not), numbers });
        if (found) return { status: "SAT", witness: found };
      }
    }
  } catch (error) {
    if (error instanceof RangeError) return { status: "BUDGET", nodes };
    throw error;
  }

  return {
    status: "UNSAT",
    reason: "every legal fact vector satisfying this rule is claimed by an earlier rule",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INDEPENDENT CONFIRMATION AGAINST THE REAL EVALUATOR
// ─────────────────────────────────────────────────────────────────────────────

function toFacts(assign: Assignment): RuleEvaluationFact[] {
  return [...assign.forcedTrue].map((label) => {
    const n = assign.numbers.get(label);
    return {
      label,
      valueText: n !== undefined ? String(n) : "present",
      valueNumber: n,
      evidence: `${label} (Phase 0b witness)`,
    };
  });
}

function runEvaluator(definition: CaseRuleReleaseDefinition, assign: Assignment) {
  const result = evaluateCaseRuleRelease({
    serviceLine: definition.serviceLine,
    ruleDefinition: definition,
    highSuspicionCancer: false,
    facts: toFacts(assign),
  });
  return {
    matchedRuleCode: result.matchedRuleCode,
    priority: result.recommendation.priority,
    targetDays: result.recommendation.targetDays,
    category: result.recommendation.category,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export type Classification =
  | "REACHABLE"
  | "LOGICALLY_UNREACHABLE"
  | "SHADOWED"
  | "OPERATIONALLY_UNREACHABLE"
  | "UNPROVEN";

export type Finding = {
  serviceLine: ServiceLine;
  code: string;
  title: string;
  classification: Classification;
  reachablePaths: Path[];
  detail: string;
  /** Facts that satisfy the rule's own conditions, if any legal set exists. */
  exampleFacts: string[];
  intendedPriority: string;
  intendedTargetDays: string;
  actualPriority: string;
  actualTargetDays: string;
  actualWinner: string;
  urgencyDirection: "increases" | "decreases" | "unchanged" | "n/a";
};

const PRIORITY_RANK: Record<string, number> = {
  P1_HSC: 0, P1: 1, P2_HSC: 2, P2: 3, P3: 4, P5: 5,
  INFO_REQUIRED: 6, REJECT: 7, DECLINE: 8,
};

function urgencyDirection(intended: string, actual: string, intendedDays?: number, actualDays?: number) {
  const ri = PRIORITY_RANK[intended] ?? 99;
  const ra = PRIORITY_RANK[actual] ?? 99;
  if (ra < ri) return "increases" as const;
  if (ra > ri) return "decreases" as const;
  if (intendedDays !== undefined && actualDays !== undefined) {
    if (actualDays < intendedDays) return "increases" as const;
    if (actualDays > intendedDays) return "decreases" as const;
  }
  return "unchanged" as const;
}

/**
 * Can this rule's own conditions be satisfied at all on this path, ignoring
 * every other rule? Distinguishes "no legal input exists" (operationally
 * unreachable) from "a legal input exists but an earlier rule wins" (shadowed).
 */
function satisfiableAlone(target: Predicate, domain: FactDomain, all: Predicate[]): Assignment | null {
  const result = solve(target, [], domain, all);
  return result.status === "SAT" ? result.witness : null;
}

export function analyseService(
  serviceLine: ServiceLine,
  domains: Record<Path, FactDomain> = buildDomains(),
  override?: CaseRuleReleaseDefinition
): Finding[] {
  const definition = override ?? getBaselineCaseRuleReleaseDefinition(serviceLine);
  const predicates = definition.rules.map(toPredicate);
  const findings: Finding[] = [];

  for (let i = 0; i < predicates.length; i += 1) {
    const target = predicates[i];
    const earlier = predicates.slice(0, i);

    if (target.requiresFlag) {
      findings.push({
        serviceLine, code: target.code, title: target.title,
        classification: "REACHABLE", reachablePaths: ["A_BATCH", "B_CASE"],
        detail: "case flag rule; reachable whenever the high-suspicion flag is set",
        exampleFacts: ["<highSuspicionCancer flag>"],
        intendedPriority: target.rec.priority,
        intendedTargetDays: String(target.rec.targetDays ?? "—"),
        actualPriority: target.rec.priority,
        actualTargetDays: String(target.rec.targetDays ?? "—"),
        actualWinner: target.code, urgencyDirection: "n/a",
      });
      continue;
    }

    const perPath: Record<Path, SolveResult> = {
      A_BATCH: solve(target, earlier, domains.A_BATCH, predicates),
      B_CASE: solve(target, earlier, domains.B_CASE, predicates),
    };

    const reachablePaths = (Object.keys(perPath) as Path[]).filter(
      (p) => perPath[p].status === "SAT"
    );

    // Reachable somewhere — confirm the witness against the real evaluator.
    if (reachablePaths.length > 0) {
      const path = reachablePaths[0];
      const witness = (perPath[path] as { witness: Assignment }).witness;
      const actual = runEvaluator(definition, witness);
      if (actual.matchedRuleCode !== target.code) {
        throw new Error(
          `Witness for ${target.code} on ${path} was not confirmed: evaluator matched ${actual.matchedRuleCode}`
        );
      }
      findings.push({
        serviceLine, code: target.code, title: target.title,
        classification: "REACHABLE", reachablePaths,
        detail: `confirmed by the evaluator on path ${reachablePaths.join(" + ")}`,
        exampleFacts: [...witness.forcedTrue],
        intendedPriority: target.rec.priority,
        intendedTargetDays: String(target.rec.targetDays ?? "—"),
        actualPriority: actual.priority,
        actualTargetDays: String(actual.targetDays ?? "—"),
        actualWinner: target.code, urgencyDirection: "unchanged",
      });
      continue;
    }

    if ((Object.keys(perPath) as Path[]).some((p) => perPath[p].status === "BUDGET")) {
      findings.push({
        serviceLine, code: target.code, title: target.title,
        classification: "UNPROVEN", reachablePaths: [],
        detail: "search budget exceeded on at least one path; neither proven nor disproven",
        exampleFacts: [],
        intendedPriority: target.rec.priority,
        intendedTargetDays: String(target.rec.targetDays ?? "—"),
        actualPriority: "?", actualTargetDays: "?", actualWinner: "?",
        urgencyDirection: "n/a",
      });
      continue;
    }

    // Unreachable everywhere. Which kind?
    const aloneA = satisfiableAlone(target, domains.A_BATCH, predicates);
    const aloneB = satisfiableAlone(target, domains.B_CASE, predicates);
    const alone = aloneA ?? aloneB;

    if (!alone) {
      const reasons = [perPath.A_BATCH, perPath.B_CASE]
        .map((r) => (r.status === "UNSAT" ? r.reason : ""))
        .filter(Boolean);
      findings.push({
        serviceLine, code: target.code, title: target.title,
        classification: "OPERATIONALLY_UNREACHABLE", reachablePaths: [],
        detail: reasons[0] ?? "no legal fact vector satisfies this rule",
        exampleFacts: [],
        intendedPriority: target.rec.priority,
        intendedTargetDays: String(target.rec.targetDays ?? "—"),
        actualPriority: "n/a — never evaluated",
        actualTargetDays: "n/a", actualWinner: "n/a",
        urgencyDirection: "n/a",
      });
      continue;
    }

    // A legal input satisfies the rule, but an earlier rule always wins.
    const actual = runEvaluator(definition, alone);
    if (actual.matchedRuleCode === target.code) {
      throw new Error(
        `Contradiction: ${target.code} reported unreachable but wins its own witness`
      );
    }
    findings.push({
      serviceLine, code: target.code, title: target.title,
      classification: "SHADOWED", reachablePaths: [],
      detail: `satisfiable, but ${actual.matchedRuleCode ?? "the default"} always matches first`,
      exampleFacts: [...alone.forcedTrue],
      intendedPriority: target.rec.priority,
      intendedTargetDays: String(target.rec.targetDays ?? "—"),
      actualPriority: actual.priority,
      actualTargetDays: String(actual.targetDays ?? "—"),
      actualWinner: actual.matchedRuleCode ?? "default",
      urgencyDirection: urgencyDirection(
        target.rec.priority, actual.priority, target.rec.targetDays, actual.targetDays
      ),
    });
  }

  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. REPORT
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const domains = buildDomains();
  const producers = readProducerLabels();
  const findings = [
    ...analyseService("COLPOSCOPY", domains),
    ...analyseService("GYNAECOLOGY", domains),
  ];

  const allRuleLabels = new Set<string>();
  for (const sl of ["COLPOSCOPY", "GYNAECOLOGY"] as const) {
    for (const rule of getBaselineCaseRuleReleaseDefinition(sl).rules) {
      labelsOf(toPredicate(rule, 0)).forEach((l) => allRuleLabels.add(l));
    }
  }
  const producibleAnywhere = new Set([
    ...producers.freeText, ...producers.mappedField, ...producers.batch,
  ]);
  const orphanLabels = [...allRuleLabels]
    .filter((l) => !producibleAnywhere.has(l))
    .sort();

  console.log("═".repeat(78));
  console.log("PHASE 0b — EXACT REACHABILITY VERIFICATION");
  console.log("═".repeat(78));

  console.log(`\nLegal fact domain, derived from source:`);
  console.log(`  Path A (batch)  producible labels: ${domains.A_BATCH.producible.size}`);
  console.log(`  Path B (case)   producible labels: ${domains.B_CASE.producible.size}`);
  console.log(`  Labels referenced by rules:        ${allRuleLabels.size}`);
  console.log(`  Referenced but NO producer emits:  ${orphanLabels.length}`);
  for (const l of orphanLabels) console.log(`     · ${l}`);

  const byClass = (c: Classification) => findings.filter((f) => f.classification === c);

  console.log(`\n${"─".repeat(78)}`);
  console.log("CLASSIFICATION");
  console.log("─".repeat(78));
  for (const c of [
    "REACHABLE", "SHADOWED", "OPERATIONALLY_UNREACHABLE",
    "LOGICALLY_UNREACHABLE", "UNPROVEN",
  ] as Classification[]) {
    console.log(`  ${c.padEnd(28)} ${byClass(c).length}`);
  }

  for (const c of [
    "SHADOWED", "OPERATIONALLY_UNREACHABLE", "LOGICALLY_UNREACHABLE", "UNPROVEN",
  ] as Classification[]) {
    const rows = byClass(c);
    if (rows.length === 0) continue;
    console.log(`\n${"─".repeat(78)}`);
    console.log(`${c} — ${rows.length} rules`);
    console.log("─".repeat(78));
    for (const f of rows) {
      console.log(`  ${f.code} — ${f.title}`);
      console.log(`      ${f.detail}`);
      if (c === "SHADOWED") {
        console.log(
          `      intended ${f.intendedPriority}/${f.intendedTargetDays}d → actual ${f.actualPriority}/${f.actualTargetDays}d by ${f.actualWinner}  [urgency ${f.urgencyDirection}]`
        );
        console.log(`      example facts: ${f.exampleFacts.join(", ")}`);
      }
    }
  }

  const consequential = byClass("SHADOWED").filter((f) => f.urgencyDirection !== "unchanged");
  console.log(`\n${"═".repeat(78)}`);
  console.log("VERDICT");
  console.log("═".repeat(78));
  console.log(`  Rules verified:                        ${findings.length}`);
  console.log(`  Reachable (witness confirmed):         ${byClass("REACHABLE").length}`);
  console.log(`  Shadowed (clinical discrepancy):       ${byClass("SHADOWED").length}`);
  console.log(`     ...of which change urgency:         ${consequential.length}`);
  console.log(`  Operationally unreachable (no input):  ${byClass("OPERATIONALLY_UNREACHABLE").length}`);
  console.log(`  Unproven:                              ${byClass("UNPROVEN").length}`);

  if (process.argv.includes("--write")) {
    const header = [
      "service_line", "rule_code", "rule_title", "classification", "reachable_paths",
      "intended_priority", "intended_target_days", "actual_priority", "actual_target_days",
      "actual_winning_rule", "urgency_direction", "example_facts", "detail",
    ].join(",");
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const rows = findings.map((f) =>
      [
        f.serviceLine, f.code, f.title, f.classification, f.reachablePaths.join(" + "),
        f.intendedPriority, f.intendedTargetDays, f.actualPriority, f.actualTargetDays,
        f.actualWinner, f.urgencyDirection, f.exampleFacts.join("; "), f.detail,
      ].map(esc).join(",")
    );
    writeFileSync("docs/clinical-audit/06-reachability-register.csv", [header, ...rows].join("\n"));
    writeFileSync(
      "docs/clinical-audit/06-reachability-register.json",
      JSON.stringify({ generatedFrom: "scripts/verify-rule-reachability.ts", orphanLabels, findings }, null, 2)
    );
    console.log("\nWrote docs/clinical-audit/06-reachability-register.{csv,json}");
  }
}

if (process.argv[1]?.endsWith("verify-rule-reachability.ts")) main();
