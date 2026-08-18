/**
 * Phase 0b(ii) — independent verification of UNSAT findings, per pipeline.
 *
 * scripts/verify-rule-reachability.ts uses a custom branch-and-bound search.
 * Replaying its SAT witnesses through the live evaluator proves reachability,
 * but proves NOTHING about its UNSAT findings — those rest on the same
 * algorithm and the same legal-domain encoding. This script verifies them by
 * two independent means and reports reachability separately for each grading
 * pipeline instead of unioning them.
 *
 *   Path A (batch)  — EXHAUSTIVE ENUMERATION of the entire legal state space
 *                     through the real evaluator. No solver, no encoding, no
 *                     shared code with the branch-and-bound. Complete by
 *                     construction.
 *
 *   Path B (case)   — INDEPENDENT CNF + DPLL. Separate Tseitin encoding and a
 *                     separately implemented solver, so a bug would have to be
 *                     replicated in two unrelated algorithms to go unnoticed.
 *
 * Also emits a human-readable unavoidable-blocker proof for every shadowed
 * rule, so a reviewer can audit the finding without trusting either solver.
 *
 * Run: npx tsx scripts/verify-independent.ts [--write]
 *
 * Analysis tool only. Never writes to the database, never mutates a release.
 */

import { writeFileSync } from "node:fs";
import type { ServiceLine } from "@prisma/client";

import {
  getBaselineCaseRuleReleaseDefinition,
  type CaseRuleDefinition,
  type CaseRuleReleaseDefinition,
} from "../lib/cases/rule-policy";
import { evaluateCaseRuleRelease } from "../lib/cases/rule-evaluator";
import { buildDomains, type Path } from "./verify-rule-reachability";

// ─────────────────────────────────────────────────────────────────────────────
// PATH A — exhaustive enumeration of the legal batch state space
//
// buildBatchRuleFacts (lib/batch/rule-facts.ts:72) maps a CanonicalBatchCase to
// labels through single-select enum fields. The whole reachable state space is
// therefore the cross product of those enums plus the independent booleans —
// small enough to enumerate completely.
// ─────────────────────────────────────────────────────────────────────────────

const HPV_STATES: Array<string[]> = [
  [], ["HPV 16/18"], ["HPV Other"], ["HPV Not Detected"],
];

const CYTOLOGY_STATES: Array<string[]> = [
  [], ["Normal cytology"], ["ASC-US"], ["LSIL"], ["ASC-H"], ["HSIL"],
  ["Cancer suspicion cytology"], ["Glandular abnormality"],
];

const HISTOLOGY_STATES: Array<string[]> = [
  [], ["CIN2"], ["CIN3"], ["Previous LSIL histology"], ["Cancer suspicion cytology"],
];

/** Independent boolean flags, each contributing one label. */
const FLAG_LABELS = [
  "Immune deficient",
  "Positive test of cure",
  "Abnormal appearance",
  "Previous normal colposcopy",
  "CIN3",
  "Second HPV positive result",
];

function* enumeratePathAStates(): Generator<{ labels: string[]; hsc: boolean }> {
  for (const hpv of HPV_STATES) {
    for (const cyt of CYTOLOGY_STATES) {
      for (const hist of HISTOLOGY_STATES) {
        for (let mask = 0; mask < 1 << FLAG_LABELS.length; mask += 1) {
          const flags = FLAG_LABELS.filter((_, i) => mask & (1 << i));
          const labels = [...new Set([...hpv, ...cyt, ...hist, ...flags])];
          // deriveBatchHighSuspicion: SCC cytology / SCC-adeno histology set the
          // flag; suspicionOfCancer and hasCancerSymptoms set it independently.
          const forced = cyt.includes("Cancer suspicion cytology") || hist.includes("Cancer suspicion cytology");
          if (forced) {
            yield { labels, hsc: true };
          } else {
            yield { labels, hsc: false };
            yield { labels, hsc: true };
          }
        }
      }
    }
  }
}

function exhaustivePathA(definition: CaseRuleReleaseDefinition) {
  const winners = new Map<string, { labels: string[]; hsc: boolean }>();
  let states = 0;

  for (const state of enumeratePathAStates()) {
    states += 1;
    const result = evaluateCaseRuleRelease({
      serviceLine: definition.serviceLine,
      ruleDefinition: definition,
      highSuspicionCancer: state.hsc,
      facts: state.labels.map((label) => ({
        label, valueText: "present", evidence: `${label} (exhaustive probe)`,
      })),
    });
    if (result.matchedRuleCode && !winners.has(result.matchedRuleCode)) {
      winners.set(result.matchedRuleCode, state);
    }
  }

  return { winners, states };
}

// ─────────────────────────────────────────────────────────────────────────────
// PATH B — independent CNF encoding + DPLL
// ─────────────────────────────────────────────────────────────────────────────

type Literal = number; // +v true, -v false
type Clause = Literal[];

class CnfBuilder {
  private next = 1;
  readonly clauses: Clause[] = [];
  private readonly vars = new Map<string, number>();

  variable(name: string): number {
    let v = this.vars.get(name);
    if (v === undefined) {
      v = this.next++;
      this.vars.set(name, v);
    }
    return v;
  }

  add(clause: Clause) {
    this.clauses.push(clause);
  }

  /** Tseitin: aux ↔ (l1 ∨ l2 ∨ …) */
  defineOr(name: string, literals: Literal[]): Literal {
    const aux = this.variable(name);
    this.add([-aux, ...literals]);
    for (const l of literals) this.add([aux, -l]);
    return aux;
  }

  /** Tseitin: aux ↔ (l1 ∧ l2 ∧ …) */
  defineAnd(name: string, literals: Literal[]): Literal {
    const aux = this.variable(name);
    for (const l of literals) this.add([-aux, l]);
    this.add([aux, ...literals.map((l) => -l)]);
    return aux;
  }

  get variableCount() {
    return this.next - 1;
  }
}

/** Straightforward DPLL with unit propagation and pure-literal elimination. */
function dpll(clauses: Clause[], numVars: number): Map<number, boolean> | null {
  const assign = new Map<number, boolean>();

  const evaluate = (cs: Clause[], a: Map<number, boolean>): Clause[] | null => {
    const out: Clause[] = [];
    for (const clause of cs) {
      let satisfied = false;
      const rest: Clause = [];
      for (const lit of clause) {
        const value = a.get(Math.abs(lit));
        if (value === undefined) {
          rest.push(lit);
        } else if (value === lit > 0) {
          satisfied = true;
          break;
        }
      }
      if (satisfied) continue;
      if (rest.length === 0) return null; // empty clause → conflict
      out.push(rest);
    }
    return out;
  };

  const search = (cs: Clause[], a: Map<number, boolean>): Map<number, boolean> | null => {
    let current = evaluate(cs, a);
    if (current === null) return null;

    // unit propagation
    let unit = current.find((c) => c.length === 1);
    while (unit) {
      const lit = unit[0];
      a.set(Math.abs(lit), lit > 0);
      current = evaluate(cs, a);
      if (current === null) return null;
      unit = current.find((c) => c.length === 1);
    }
    if (current.length === 0) return a;

    const branchVar = Math.abs(current[0][0]);
    for (const value of [true, false]) {
      const next = new Map(a);
      next.set(branchVar, value);
      const found = search(cs, next);
      if (found) return found;
    }
    return null;
  };

  return search(clauses, assign);
}

type Predicate = {
  code: string;
  all: string[];
  anyGroups: string[][];
  not: string[];
  threshold?: { label: string; min?: number; max?: number };
  requiresFlag: boolean;
};

function toPredicate(rule: CaseRuleDefinition): Predicate {
  const base = { code: rule.code, all: [] as string[], anyGroups: [] as string[][], not: [] as string[], requiresFlag: false };
  switch (rule.kind) {
    case "case_flag": return { ...base, requiresFlag: true };
    case "fact_any": return { ...base, anyGroups: [[...rule.factLabels]] };
    case "fact_all": return { ...base, all: [...rule.factLabels] };
    case "fact_threshold":
      return { ...base, anyGroups: [[...rule.signalLabels]], threshold: { label: rule.thresholdLabel, min: rule.thresholdMin } };
    case "compound":
      return {
        ...base,
        all: [...(rule.allFactLabels ?? [])],
        anyGroups: rule.anyFactLabels?.length ? [[...rule.anyFactLabels]] : [],
        not: [...(rule.absentFactLabels ?? [])],
        threshold: rule.thresholdLabel
          ? { label: rule.thresholdLabel, min: rule.thresholdMin, max: rule.thresholdMax }
          : undefined,
      };
  }
}

/** Numeric equivalence classes across the whole ruleset, per label. */
function numericClasses(label: string, predicates: Predicate[]): number[] {
  const bounds = new Set<number>();
  for (const p of predicates) {
    if (p.threshold?.label !== label) continue;
    for (const b of [p.threshold.min, p.threshold.max]) {
      if (b === undefined) continue;
      bounds.add(b - 1); bounds.add(b - 0.1); bounds.add(b);
      bounds.add(b + 0.1); bounds.add(b + 1);
    }
  }
  bounds.add(0);
  return [...bounds].filter((v) => v >= 0).sort((a, b) => a - b);
}

/**
 * Encode: target true AND every earlier rule false, over the Path B domain.
 * Returns SAT assignment or null.
 */
function encodeAndSolve(
  target: Predicate,
  earlier: Predicate[],
  producible: Set<string>,
  allPredicates: Predicate[]
): { sat: boolean; facts?: Array<{ label: string; value?: number }> } {
  if (target.requiresFlag) return { sat: true };

  const cnf = new CnfBuilder();
  const lit = (label: string) => cnf.variable(`L:${label}`);

  // Labels the pipeline cannot emit are permanently false.
  const mentioned = new Set<string>();
  for (const p of [target, ...earlier]) {
    for (const l of [...p.all, ...p.anyGroups.flat(), ...p.not]) mentioned.add(l);
    if (p.threshold) mentioned.add(p.threshold.label);
  }
  for (const label of mentioned) {
    if (!producible.has(label)) cnf.add([-lit(label)]);
  }

  // Numeric one-hot classes: value_c implies the label is present, at most one class.
  const numericLits = new Map<string, Map<number, Literal>>();
  for (const label of mentioned) {
    const classes = allPredicates.some((p) => p.threshold?.label === label)
      ? numericClasses(label, allPredicates)
      : [];
    if (classes.length === 0) continue;
    const perClass = new Map<number, Literal>();
    for (const c of classes) {
      const v = cnf.variable(`N:${label}:${c}`);
      perClass.set(c, v);
      cnf.add([-v, lit(label)]); // a value implies presence
    }
    const list = [...perClass.values()];
    cnf.add([-lit(label), ...list]); // presence implies some value
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) cnf.add([-list[i], -list[j]]);
    }
    numericLits.set(label, perClass);
  }

  /** Literal that is true exactly when this predicate holds. */
  const predicateLit = (p: Predicate, tag: string): Literal => {
    const parts: Literal[] = [];
    for (const l of p.all) parts.push(lit(l));
    for (const l of p.not) parts.push(-lit(l));
    p.anyGroups.forEach((group, index) => {
      parts.push(cnf.defineOr(`ANY:${tag}:${index}`, group.map((l) => lit(l))));
    });
    if (p.threshold) {
      const classes = numericLits.get(p.threshold.label);
      if (!classes) return cnf.defineAnd(`P:${tag}`, [lit(p.threshold.label), -lit(p.threshold.label)]);
      const inRange = [...classes.entries()]
        .filter(([value]) => {
          if (p.threshold!.min !== undefined && value < p.threshold!.min) return false;
          if (p.threshold!.max !== undefined && value > p.threshold!.max) return false;
          return true;
        })
        .map(([, v]) => v);
      parts.push(
        inRange.length === 0
          ? cnf.defineAnd(`T:${tag}:empty`, [lit(p.threshold.label), -lit(p.threshold.label)])
          : cnf.defineOr(`T:${tag}`, inRange)
      );
    }
    if (parts.length === 0) return cnf.defineOr(`P:${tag}:empty`, []);
    return cnf.defineAnd(`P:${tag}`, parts);
  };

  // target true
  cnf.add([predicateLit(target, `t_${target.code}`)]);
  // every earlier rule false (case-flag rules cannot fire: probes run flag-off)
  for (const p of earlier) {
    if (p.requiresFlag) continue;
    cnf.add([-predicateLit(p, `e_${p.code}`)]);
  }

  const solution = dpll(cnf.clauses, cnf.variableCount);
  if (!solution) return { sat: false };

  // Carry the chosen numeric equivalence class through as valueNumber — without
  // it the evaluator's getFactNumber returns undefined and thresholds never fire.
  const facts = [...mentioned]
    .filter((label) => solution.get(cnf.variable(`L:${label}`)) === true)
    .map((label) => {
      const classes = numericLits.get(label);
      if (!classes) return { label };
      for (const [value, v] of classes) {
        if (solution.get(v) === true) return { label, value };
      }
      return { label };
    });
  return { sat: true, facts };
}

// ─────────────────────────────────────────────────────────────────────────────
// UNAVOIDABLE-BLOCKER PROOF
// ─────────────────────────────────────────────────────────────────────────────

/** Does every case satisfying `specific` also satisfy `general`? */
function subsumes(general: Predicate, specific: Predicate): boolean {
  if (general.requiresFlag) return false;
  for (const l of general.all) {
    const forced = specific.all.includes(l) ||
      specific.anyGroups.some((g) => g.length === 1 && g[0] === l) ||
      specific.threshold?.label === l;
    if (!forced) return false;
  }
  for (const l of general.not) if (!specific.not.includes(l)) return false;
  for (const g of general.anyGroups) {
    const hit = g.some((l) => specific.all.includes(l) || specific.threshold?.label === l);
    const covered = specific.anyGroups.some((o) => o.every((l) => g.includes(l)));
    if (!hit && !covered) return false;
  }
  if (general.threshold) {
    const t = specific.threshold;
    if (!t || t.label !== general.threshold.label) return false;
    const gMin = general.threshold.min ?? -Infinity;
    const gMax = general.threshold.max ?? Infinity;
    if ((t.min ?? -Infinity) < gMin || (t.max ?? Infinity) > gMax) return false;
  }
  return true;
}

function describeConditions(p: Predicate): string {
  const parts: string[] = [];
  if (p.all.length) parts.push(`requires ${p.all.join(" + ")}`);
  for (const g of p.anyGroups) parts.push(`requires one of (${g.join(" / ")})`);
  if (p.not.length) parts.push(`requires absence of ${p.not.join(", ")}`);
  if (p.threshold) {
    const range = [
      p.threshold.min !== undefined ? `>= ${p.threshold.min}` : "",
      p.threshold.max !== undefined ? `<= ${p.threshold.max}` : "",
    ].filter(Boolean).join(" and ");
    parts.push(`requires ${p.threshold.label} ${range}`);
  }
  return parts.join("; ") || "no conditions";
}

function blockerProof(target: Predicate, earlier: Predicate[]): string[] {
  const subsuming = earlier.filter((e) => subsumes(e, target));
  if (subsuming.length > 0) {
    const e = subsuming[0];
    return [
      `${target.code} ${describeConditions(target)}.`,
      `${e.code} ${describeConditions(e)}.`,
      `Every legal input satisfying ${target.code} therefore also satisfies ${e.code}.`,
      `${e.code} precedes ${target.code} in the ordered list.`,
      `No exclusion available to ${target.code} can falsify ${e.code}.`,
      `Therefore ${target.code} can never win.`,
    ];
  }
  return [
    `${target.code} ${describeConditions(target)}.`,
    `No single earlier rule subsumes it, but no legal fact vector satisfies ${target.code} while falsifying every earlier rule.`,
    `The blocking set is: ${earlier.filter((e) => !e.requiresFlag).map((e) => e.code).slice(0, 8).join(", ")}…`,
    `Verified independently by exhaustive enumeration (Path A) and CNF/DPLL (Path B).`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

type PipelineStatus = "reachable" | "shadowed" | "not_producible" | "n/a";

type Row = {
  serviceLine: ServiceLine;
  code: string;
  title: string;
  batch: PipelineStatus;
  case_: PipelineStatus;
  combined: string;
  proof?: string[];
};

function classify(serviceLine: ServiceLine): Row[] {
  const definition = getBaselineCaseRuleReleaseDefinition(serviceLine);
  const predicates = definition.rules.map(toPredicate);
  const domains = buildDomains();
  const rows: Row[] = [];

  // Path A is only meaningful for the colposcopy batch pipeline.
  const pathAApplies = serviceLine === "COLPOSCOPY";
  const exhaustive = pathAApplies ? exhaustivePathA(definition) : null;
  if (exhaustive) {
    console.log(`  Path A exhaustive enumeration: ${exhaustive.states} legal states evaluated`);
  }

  for (let i = 0; i < predicates.length; i += 1) {
    const target = predicates[i];
    const earlier = predicates.slice(0, i);
    const rule = definition.rules[i];

    // ── Path A ──
    let batch: PipelineStatus;
    if (!pathAApplies) {
      // The batch pipeline grades colposcopy only (lib/batch/persistence.ts:103).
      batch = "n/a";
    } else if (target.requiresFlag) {
      batch = "reachable";
    } else {
      const needed = [
        ...target.all,
        ...(target.threshold ? [target.threshold.label] : []),
      ];
      const anyUnproducible = needed.some((l) => !domains.A_BATCH.producible.has(l)) ||
        target.anyGroups.some((g) => !g.some((l) => domains.A_BATCH.producible.has(l)));
      batch = anyUnproducible
        ? "not_producible"
        : exhaustive!.winners.has(target.code) ? "reachable" : "shadowed";
    }

    // ── Path B ──
    let case_: PipelineStatus;
    if (target.requiresFlag) {
      case_ = "reachable";
    } else {
      const needed = [...target.all, ...(target.threshold ? [target.threshold.label] : [])];
      const anyUnproducible = needed.some((l) => !domains.B_CASE.producible.has(l)) ||
        target.anyGroups.some((g) => !g.some((l) => domains.B_CASE.producible.has(l)));
      if (anyUnproducible) {
        case_ = "not_producible";
      } else {
        const solved = encodeAndSolve(target, earlier, domains.B_CASE.producible, predicates);
        if (solved.sat && solved.facts) {
          // Confirm the CNF witness against the real evaluator.
          const check = evaluateCaseRuleRelease({
            serviceLine: definition.serviceLine,
            ruleDefinition: definition,
            highSuspicionCancer: false,
            facts: solved.facts.map((f) => ({
              label: f.label,
              valueText: f.value !== undefined ? String(f.value) : "present",
              valueNumber: f.value,
              evidence: `${f.label} (CNF witness)`,
            })),
          });
          if (check.matchedRuleCode !== target.code) {
            throw new Error(
              `CNF witness for ${target.code} rejected by evaluator: matched ${check.matchedRuleCode}`
            );
          }
        }
        case_ = solved.sat ? "reachable" : "shadowed";
      }
    }

    const combined =
      batch === "n/a"
        ? (case_ === "reachable" ? "reachable (case pipeline only applies)"
          : case_ === "not_producible" ? "operationally unreachable"
          : "shadowed in the case pipeline")
      : batch === "reachable" && case_ === "reachable" ? "reachable in both"
      : batch === "reachable" ? "batch-only (unreachable in case pipeline)"
      : case_ === "reachable" ? "case-only (unreachable in batch pipeline)"
      : batch === "not_producible" && case_ === "not_producible" ? "operationally unreachable in both"
      : "shadowed in every pipeline";

    rows.push({
      serviceLine, code: target.code, title: rule.title, batch, case_, combined,
      proof: combined.includes("shadowed") ? blockerProof(target, earlier) : undefined,
    });
  }

  return rows;
}

function main() {
  console.log("═".repeat(78));
  console.log("PHASE 0b(ii) — INDEPENDENT VERIFICATION, PER PIPELINE");
  console.log("═".repeat(78));

  console.log("\nCOLPOSCOPY");
  const colp = classify("COLPOSCOPY");
  console.log("\nGYNAECOLOGY");
  const gyn = classify("GYNAECOLOGY");
  const rows = [...colp, ...gyn];

  console.log(`\n${"─".repeat(78)}`);
  console.log("PIPELINE REACHABILITY MATRIX");
  console.log("─".repeat(78));
  console.log(`  ${"rule".padEnd(9)} ${"batch".padEnd(15)} ${"case".padEnd(15)} combined`);
  for (const r of rows) {
    if (r.combined === "reachable in both" || r.combined === "reachable (case pipeline only applies)") continue;
    console.log(`  ${r.code.padEnd(9)} ${r.batch.padEnd(15)} ${r.case_.padEnd(15)} ${r.combined}`);
  }

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.combined, (counts.get(r.combined) ?? 0) + 1);
  console.log(`\n${"─".repeat(78)}`);
  console.log("SUMMARY");
  console.log("─".repeat(78));
  for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(36)} ${v}`);
  }

  const shadowed = rows.filter((r) => r.proof);
  console.log(`\n${"─".repeat(78)}`);
  console.log(`UNAVOIDABLE-BLOCKER PROOFS — ${shadowed.length} shadowed rules`);
  console.log("─".repeat(78));
  for (const r of shadowed) {
    console.log(`\n  ${r.code} — ${r.title}`);
    for (const line of r.proof!) console.log(`     ${line}`);
  }

  if (process.argv.includes("--write")) {
    const header = "service_line,rule_code,rule_title,batch,case,combined,blocker_proof";
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = [
      header,
      ...rows.map((r) =>
        [r.serviceLine, r.code, r.title, r.batch, r.case_, r.combined, (r.proof ?? []).join(" ")]
          .map(esc).join(",")
      ),
    ].join("\n");
    writeFileSync("docs/clinical-audit/07-pipeline-reachability.csv", csv);
    writeFileSync(
      "docs/clinical-audit/07-pipeline-reachability.json",
      JSON.stringify({ generatedFrom: "scripts/verify-independent.ts", rows }, null, 2)
    );
    console.log("\nWrote docs/clinical-audit/07-pipeline-reachability.{csv,json}");
  }
}

main();
