/**
 * Phase 0 — rule overlap and semantic analysis.
 *
 * Answers the question that gates the whole rulebook redesign: can the current
 * first-match-wins rule list be represented as a mutually exclusive decision
 * tree, or does the canonical model need ordered sibling branches with explicit
 * local priority?
 *
 * Run: npx tsx scripts/analyse-rule-overlap.ts [--json]
 *
 * This is an analysis tool, not part of the runtime. It reads the baseline
 * definitions and reports; it never writes to the database.
 */

import type { ServiceLine } from "@prisma/client";

import {
  getBaselineCaseRuleReleaseDefinition,
  type CaseRuleDefinition,
  type CaseRuleReleaseDefinition,
} from "../lib/cases/rule-policy";
import { evaluateCaseRuleRelease } from "../lib/cases/rule-evaluator";

// ─── Normalised predicate form ────────────────────────────────────────────────

/**
 * Every rule kind reduces to this shape. A model is a set of present fact
 * labels plus numeric values for threshold labels plus the HSC flag.
 */
type Predicate = {
  code: string;
  index: number;
  title: string;
  kind: CaseRuleDefinition["kind"];
  /** Labels that must all be present. */
  all: Set<string>;
  /** Each group needs at least one member present. */
  anyGroups: string[][];
  /** Labels that must be absent. */
  not: Set<string>;
  /** Numeric constraint, if any. The label must also be present. */
  threshold?: { label: string; min?: number; max?: number };
  /** Requires the highSuspicionCancer case flag. */
  requiresFlag: boolean;
  outcome: {
    priority: string;
    category: string;
    outcomeText: string;
    targetDays?: number;
    requiresSmoReview: boolean;
  };
};

function toPredicate(rule: CaseRuleDefinition, index: number): Predicate {
  const base = {
    code: rule.code,
    index,
    title: rule.title,
    kind: rule.kind,
    all: new Set<string>(),
    anyGroups: [] as string[][],
    not: new Set<string>(),
    requiresFlag: false,
    outcome: {
      priority: rule.recommendation.priority,
      category: rule.recommendation.category,
      outcomeText: rule.recommendation.outcome,
      targetDays: rule.recommendation.targetDays,
      requiresSmoReview: Boolean(rule.recommendation.requiresSmoReview),
    },
  } satisfies Predicate;

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
          ? {
              label: rule.thresholdLabel,
              min: rule.thresholdMin,
              max: rule.thresholdMax,
            }
          : undefined,
      };
  }
}

// ─── Satisfiability of a conjunction ──────────────────────────────────────────

/**
 * Can a single case satisfy both predicates at once?
 *
 * Facts are freely addable (the model is monotone apart from `not`), so the
 * conjunction is satisfiable unless a required label is forbidden, an `any`
 * group is entirely forbidden, or the numeric ranges are disjoint.
 */
function overlaps(a: Predicate, b: Predicate): boolean {
  const required = new Set([...a.all, ...b.all]);
  const forbidden = new Set([...a.not, ...b.not]);

  for (const label of required) {
    if (forbidden.has(label)) return false;
  }

  for (const group of [...a.anyGroups, ...b.anyGroups]) {
    if (group.every((label) => forbidden.has(label))) return false;
  }

  const ta = a.threshold;
  const tb = b.threshold;
  if (ta && forbidden.has(ta.label)) return false;
  if (tb && forbidden.has(tb.label)) return false;
  if (ta && tb && ta.label === tb.label) {
    const min = Math.max(ta.min ?? -Infinity, tb.min ?? -Infinity);
    const max = Math.min(ta.max ?? Infinity, tb.max ?? Infinity);
    if (min > max) return false;
  }

  return true;
}

/**
 * Does every case matching `specific` also match `general`?
 *
 * Used to find fully shadowed (dead) rules: a later rule whose every model is
 * already claimed by an earlier one can never fire.
 */
function subsumes(general: Predicate, specific: Predicate): boolean {
  if (general.requiresFlag && !specific.requiresFlag) return false;

  for (const label of general.all) {
    const forcedByAny = specific.anyGroups.some(
      (group) => group.length === 1 && group[0] === label
    );
    if (!specific.all.has(label) && !forcedByAny) return false;
  }

  for (const label of general.not) {
    if (!specific.not.has(label)) return false;
  }

  for (const group of general.anyGroups) {
    const hitByAll = group.some((label) => specific.all.has(label));
    const coveredByAnyGroup = specific.anyGroups.some((other) =>
      other.every((label) => group.includes(label))
    );
    if (!hitByAll && !coveredByAnyGroup) return false;
  }

  if (general.threshold) {
    const st = specific.threshold;
    if (!st || st.label !== general.threshold.label) return false;
    const gMin = general.threshold.min ?? -Infinity;
    const gMax = general.threshold.max ?? Infinity;
    const sMin = st.min ?? -Infinity;
    const sMax = st.max ?? Infinity;
    if (sMin < gMin || sMax > gMax) return false;
  }

  return true;
}

// ─── Complete reachability search ─────────────────────────────────────────────

/**
 * Can ANY case make this rule the first match?
 *
 * Pairwise subsumption only proves that one earlier rule co-matches; it does not
 * prove the rule is dead, because a larger fact set can violate an earlier
 * rule's `absent` constraint and knock it out. This does a complete search.
 *
 * Sound reduction of the search space:
 *   - every label the rule requires is present, every label it forbids is absent;
 *   - one member of each `any` group is chosen (all combinations tried);
 *   - any other label is only worth adding if it appears in an EARLIER rule's
 *     `absent` set, because that is the only way an extra fact can help. Every
 *     other extra fact is neutral or harmful, so it is left absent.
 * Numeric candidates are drawn from the constraint boundaries, which is complete
 * for interval arithmetic.
 */
type WitnessResult =
  | { status: "reachable"; present: string[]; numbers: Record<string, number> }
  | { status: "unreachable" }
  /** Search space exceeded the budget — neither proven nor disproven. */
  | { status: "unknown"; reason: string };

function findWitness(target: Predicate, earlier: Predicate[]): WitnessResult {
  // Optional labels worth toggling: an earlier rule's `absent` set (adding one
  // knocks that rule out) and any earlier rule's threshold label (its presence
  // is what arms that rule's numeric test).
  const knockout = [
    ...new Set(
      earlier
        .flatMap((p) => [...p.not, ...(p.threshold ? [p.threshold.label] : [])])
        .filter(
          (l) =>
            !target.all.has(l) &&
            !target.not.has(l) &&
            l !== target.threshold?.label
        )
    ),
  ];

  const numericLabels = [
    ...new Set(
      [target, ...earlier].flatMap((p) => (p.threshold ? [p.threshold.label] : []))
    ),
  ];
  const numericCandidates = new Map<string, number[]>();
  for (const label of numericLabels) {
    const values = new Set<number>([0]);
    for (const p of [target, ...earlier]) {
      if (p.threshold?.label !== label) continue;
      if (p.threshold.min !== undefined) {
        values.add(p.threshold.min);
        values.add(p.threshold.min - 1);
      }
      if (p.threshold.max !== undefined) {
        values.add(p.threshold.max);
        values.add(p.threshold.max + 1);
      }
    }
    values.add(Math.max(...values) + 1000);
    numericCandidates.set(label, [...values]);
  }

  const anyChoices: string[][] = target.anyGroups.map((group) =>
    group.filter((l) => !target.not.has(l))
  );
  if (anyChoices.some((c) => c.length === 0)) return { status: "unreachable" };

  const matches = (p: Predicate, present: Set<string>, numbers: Record<string, number>) => {
    if (p.requiresFlag) return false; // probes run with the HSC flag off
    for (const l of p.all) if (!present.has(l)) return false;
    for (const l of p.not) if (present.has(l)) return false;
    for (const g of p.anyGroups) if (!g.some((l) => present.has(l))) return false;
    if (p.threshold) {
      if (!present.has(p.threshold.label)) return false;
      const v = numbers[p.threshold.label];
      if (v === undefined) return false;
      if (p.threshold.min !== undefined && v < p.threshold.min) return false;
      if (p.threshold.max !== undefined && v > p.threshold.max) return false;
    }
    return true;
  };

  const anyCombos: string[][] = anyChoices.reduce<string[][]>(
    (acc, choices) => acc.flatMap((prefix) => choices.map((c) => [...prefix, c])),
    [[]]
  );

  const knockoutSubsets = 1 << knockout.length;
  if (knockout.length > 18) {
    return {
      status: "unknown",
      reason: `${knockout.length} optional labels — ${knockoutSubsets} combinations exceeds the search budget`,
    };
  }

  for (const combo of anyCombos) {
    for (let mask = 0; mask < knockoutSubsets; mask += 1) {
      const present = new Set<string>([...target.all, ...combo]);
      // The rule's own numeric field must be present for its threshold to fire.
      if (target.threshold) present.add(target.threshold.label);
      for (let b = 0; b < knockout.length; b += 1) {
        if (mask & (1 << b)) present.add(knockout[b]);
      }
      if ([...target.not].some((l) => present.has(l))) continue;

      const numericPresent = numericLabels.filter((l) => present.has(l));
      const numberCombos: Array<Record<string, number>> = numericPresent.reduce<
        Array<Record<string, number>>
      >(
        (acc, label) =>
          acc.flatMap((prefix) =>
            (numericCandidates.get(label) ?? [0]).map((v) => ({ ...prefix, [label]: v }))
          ),
        [{}]
      );

      for (const numbers of numberCombos) {
        if (!matches(target, present, numbers)) continue;
        if (earlier.some((p) => matches(p, present, numbers))) continue;
        return { status: "reachable", present: [...present], numbers };
      }
    }
  }

  return { status: "unreachable" };
}

function sameOutcome(a: Predicate, b: Predicate): boolean {
  return (
    a.outcome.priority === b.outcome.priority &&
    a.outcome.category === b.outcome.category &&
    a.outcome.outcomeText === b.outcome.outcomeText &&
    a.outcome.targetDays === b.outcome.targetDays &&
    a.outcome.requiresSmoReview === b.outcome.requiresSmoReview
  );
}

// ─── Discriminator analysis ───────────────────────────────────────────────────

/**
 * Labels that partition the rule set into clinical contexts. A tree branches on
 * these first; rules that mention none of them are cross-cutting and cannot sit
 * under a single context subtree without duplication.
 */
const CONTEXT_LABELS: Record<ServiceLine, string[]> = {
  COLPOSCOPY: [
    "Post-treatment assessment",
    "HPV surveillance",
    "Positive test of cure",
    "Abnormal appearance",
    "Other clinical assessment",
    "Previous normal colposcopy",
    "Endorsed referral on colposcopy",
  ],
  GYNAECOLOGY: [
    "Postmenopausal bleeding",
    "Abnormal uterine bleeding",
    "Symptomatic prolapse",
    "Asymptomatic prolapse",
    "Stress urinary incontinence",
    "Urge incontinence",
    "Endometriosis",
    "Previous endometriosis",
    "Ovarian cyst",
    "Complex adnexal mass",
    "Endometrioma",
    "Fibroids",
    "Mesh related problem",
    "Paediatric gynaecology",
    "Urogynaecology",
    "Cervical polyp",
    "Uterine polyp on USS",
    "Pelvic pain",
    "Fertility",
    "Tubal ligation",
  ],
};

/** Labels that act as risk adjustments rather than context selectors. */
const MODIFIER_LABELS = [
  "Immune deficient",
  "Patient under 16",
  "Fertility",
  "Medical management trialled",
  "Prior conservative management",
  "Pelvic floor physiotherapy",
  "Bladder training",
  "New clinical information",
  "Re-grading requested",
  "Upgraded urgency",
  "Recurrent symptoms",
  "Persistent bleeding >3 months",
];

function labelsOf(p: Predicate): string[] {
  return [
    ...p.all,
    ...p.anyGroups.flat(),
    ...p.not,
    ...(p.threshold ? [p.threshold.label] : []),
  ];
}

// ─── Report ───────────────────────────────────────────────────────────────────

type PairFinding = {
  earlier: string;
  later: string;
  earlierTitle: string;
  laterTitle: string;
  orderDependent: boolean;
  fullyShadowed: boolean;
  earlierOutcome: string;
  laterOutcome: string;
};

/**
 * Build the case this rule was written for and run it through the real
 * evaluator, so the report states what a clinician actually gets today.
 */
function gradeIntent(definition: CaseRuleReleaseDefinition, p: Predicate) {
  const labels = new Set<string>([...p.all]);
  for (const group of p.anyGroups) {
    const pick = group.find((l) => !p.not.has(l));
    if (pick) labels.add(pick);
  }
  if (p.threshold) labels.add(p.threshold.label);

  const value = p.threshold
    ? p.threshold.min !== undefined
      ? p.threshold.min
      : p.threshold.max !== undefined
        ? p.threshold.max
        : 1
    : undefined;

  const result = evaluateCaseRuleRelease({
    serviceLine: definition.serviceLine,
    ruleDefinition: definition,
    highSuspicionCancer: false,
    facts: [...labels].map((label) => ({
      label,
      valueText: label === p.threshold?.label ? String(value) : "present",
      valueNumber: label === p.threshold?.label ? value : undefined,
      evidence: `${label} (intent probe)`,
    })),
  });

  return {
    priority: result.recommendation.priority,
    targetDays: result.recommendation.targetDays,
    matchedRuleCode: result.matchedRuleCode,
  };
}

function describeOutcome(p: Predicate): string {
  const days = p.outcome.targetDays !== undefined ? `${p.outcome.targetDays}d` : "no target";
  return `${p.outcome.priority}/${days}`;
}

function analyse(serviceLine: ServiceLine) {
  const definition = getBaselineCaseRuleReleaseDefinition(serviceLine);
  const predicates = definition.rules.map(toPredicate);

  const pairs: PairFinding[] = [];
  for (let i = 0; i < predicates.length; i += 1) {
    for (let j = i + 1; j < predicates.length; j += 1) {
      const a = predicates[i];
      const b = predicates[j];
      if (!overlaps(a, b)) continue;
      const orderDependent = !sameOutcome(a, b);
      pairs.push({
        earlier: a.code,
        later: b.code,
        earlierTitle: a.title,
        laterTitle: b.title,
        orderDependent,
        fullyShadowed: orderDependent && subsumes(a, b),
        earlierOutcome: describeOutcome(a),
        laterOutcome: describeOutcome(b),
      });
    }
  }

  const contextLabels = new Set(CONTEXT_LABELS[serviceLine]);
  const modifierLabels = new Set(MODIFIER_LABELS);

  const contextCount = new Map<string, number>();
  const crossCutting: string[] = [];
  const multiContext: Array<{ code: string; contexts: string[] }> = [];
  const modifierRules: Array<{ code: string; modifiers: string[] }> = [];

  for (const p of predicates) {
    const labels = labelsOf(p);
    const contexts = [...new Set(labels.filter((l) => contextLabels.has(l)))];
    const modifiers = [...new Set(labels.filter((l) => modifierLabels.has(l)))];

    if (contexts.length === 0 && !p.requiresFlag) crossCutting.push(p.code);
    if (contexts.length > 1) multiContext.push({ code: p.code, contexts });
    if (modifiers.length > 0) modifierRules.push({ code: p.code, modifiers });
    for (const c of contexts) contextCount.set(c, (contextCount.get(c) ?? 0) + 1);
  }

  const orderDependent = pairs.filter((p) => p.orderDependent);
  const shadowed = pairs.filter((p) => p.fullyShadowed);

  // Complete reachability: is there any case at all that this rule wins?
  const unreachable: Array<{
    code: string;
    title: string;
    intended: string;
    actual: string;
    actualCode: string | null;
  }> = [];
  const unproven: Array<{ code: string; reason: string }> = [];
  for (let i = 0; i < predicates.length; i += 1) {
    const target = predicates[i];
    if (target.requiresFlag) continue;
    const witness = findWitness(target, predicates.slice(0, i));
    if (witness.status === "reachable") continue;
    if (witness.status === "unknown") {
      unproven.push({ code: target.code, reason: witness.reason });
      continue;
    }

    // What does a case built to this rule's own intent actually get graded as?
    const actual = gradeIntent(definition, target);

    // Self-check: an unreachable rule can never win its own intent probe. If it
    // does, the search is wrong and the finding must not be reported.
    if (actual.matchedRuleCode === target.code) {
      throw new Error(
        `Analysis bug: ${target.code} reported unreachable but wins its own intent probe`
      );
    }

    unreachable.push({
      code: target.code,
      title: target.title,
      intended: describeOutcome(target),
      actual: `${actual.priority}/${actual.targetDays !== undefined ? `${actual.targetDays}d` : "no target"}`,
      actualCode: actual.matchedRuleCode,
    });
  }

  // Rules that are the later member of at least one order-dependent pair
  // require either an earlier sibling guard or an explicit priority marker.
  const needsPriority = new Set(orderDependent.map((p) => p.later));

  return {
    serviceLine,
    ruleCount: predicates.length,
    predicates,
    totalPairs: (predicates.length * (predicates.length - 1)) / 2,
    overlappingPairs: pairs.length,
    orderDependentPairs: orderDependent.length,
    fullyShadowedPairs: shadowed.length,
    shadowed,
    unreachable,
    unproven,
    needsPriority: [...needsPriority].sort(),
    crossCutting,
    multiContext,
    modifierRules,
    contextCount: [...contextCount.entries()].sort((a, b) => b[1] - a[1]),
    orderDependent,
  };
}

function main() {
  const asJson = process.argv.includes("--json");
  const reports = (["COLPOSCOPY", "GYNAECOLOGY"] as const).map(analyse);

  if (asJson) {
    console.log(
      JSON.stringify(
        reports.map((r) => ({ ...r, predicates: undefined, orderDependent: undefined })),
        null,
        2
      )
    );
    return;
  }

  for (const r of reports) {
    console.log(`\n${"═".repeat(78)}`);
    console.log(`${r.serviceLine} — ${r.ruleCount} rules`);
    console.log("═".repeat(78));
    console.log(`Rule pairs examined:            ${r.totalPairs}`);
    console.log(`Pairs that can co-match:        ${r.overlappingPairs}`);
    console.log(`  ...with differing outcomes:   ${r.orderDependentPairs}  <- order-dependent`);
    console.log(`  ...fully shadowed (dead):     ${r.fullyShadowedPairs}`);
    console.log(`Rules needing explicit priority: ${r.needsPriority.length} of ${r.ruleCount}`);
    console.log(`  ${r.needsPriority.join(", ") || "none"}`);

    console.log(`\nCross-cutting rules (no context label — apply in every context):`);
    console.log(`  ${r.crossCutting.length}: ${r.crossCutting.join(", ") || "none"}`);

    console.log(`\nRules spanning multiple contexts (would duplicate in a strict tree):`);
    if (r.multiContext.length === 0) {
      console.log("  none");
    } else {
      for (const m of r.multiContext) {
        console.log(`  ${m.code}: ${m.contexts.join(" + ")}`);
      }
    }

    console.log(`\nRules carrying cross-cutting modifiers:`);
    if (r.modifierRules.length === 0) {
      console.log("  none");
    } else {
      for (const m of r.modifierRules) {
        console.log(`  ${m.code}: ${m.modifiers.join(", ")}`);
      }
    }

    console.log(
      `\nUNREACHABLE RULES — proven by complete search, no case can ever match these:`
    );
    if (r.unreachable.length === 0) {
      console.log("  none");
    } else {
      for (const u of r.unreachable) {
        const drift = u.intended !== u.actual ? "  <-- GRADE DIFFERS" : "";
        console.log(`  ${u.code} — ${u.title}`);
        console.log(
          `      intended ${u.intended}, actually graded ${u.actual} by ${u.actualCode ?? "default"}${drift}`
        );
      }
    }
    if (r.unproven.length > 0) {
      console.log(`\n  Not proven either way (search budget exceeded):`);
      for (const u of r.unproven) console.log(`    ${u.code} — ${u.reason}`);
    }

    console.log(`\nTop order-dependent pairs (first 20):`);
    for (const p of r.orderDependent.slice(0, 20)) {
      console.log(
        `  ${p.earlier} (${p.earlierOutcome}) before ${p.later} (${p.laterOutcome})`
      );
    }
    if (r.orderDependent.length > 20) {
      console.log(`  ... ${r.orderDependent.length - 20} more`);
    }
  }

  const totalOrderDependent = reports.reduce((n, r) => n + r.orderDependentPairs, 0);
  const totalNeedsPriority = reports.reduce((n, r) => n + r.needsPriority.length, 0);
  const totalRules = reports.reduce((n, r) => n + r.ruleCount, 0);

  console.log(`\n${"═".repeat(78)}`);
  console.log("VERDICT");
  console.log("═".repeat(78));
  console.log(`${totalOrderDependent} order-dependent rule pairs across ${totalRules} rules.`);
  console.log(
    `${totalNeedsPriority} rules (${Math.round((totalNeedsPriority / totalRules) * 100)}%) rely on an earlier rule not having matched.`
  );
  console.log(
    totalOrderDependent === 0
      ? "A mutually exclusive tree is sufficient."
      : "A mutually exclusive tree is NOT sufficient: the canonical model needs\nordered sibling branches with explicit local priority and mandatory fallbacks."
  );
}

main();
