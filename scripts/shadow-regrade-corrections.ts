/**
 * Phase 0b — correction strategy comparison and shadow regrade.
 *
 * For each candidate fix to the shadowing defects found by
 * scripts/verify-rule-reachability.ts, this measures:
 *   · does the previously shadowed rule become reachable?
 *   · what collateral change does the fix cause across a case population?
 *   · which rules does the population actually exercise (coverage)?
 *
 * Two strategies are compared, per the requirement not to default to reordering:
 *   NARROW   — add explicit exclusions to the broad catch-all so it stops
 *              claiming cases that belong to a later, more specific rule.
 *   REORDER  — move the broad catch-all after the specific rules.
 *
 * IMPORTANT: the population here is SYNTHETIC (lib/batch/realistic-dataset.ts),
 * not real referrals, and exercises only the batch route. It bounds collateral
 * damage; it does not substitute for a historical replay against production
 * data, which remains a required gate before any correction is activated.
 *
 * Run: npx tsx scripts/shadow-regrade-corrections.ts [caseCount]
 *
 * Analysis tool only. Never writes to the database, never mutates a release.
 */

import {
  getBaselineCaseRuleReleaseDefinition,
  type CaseRuleDefinition,
  type CaseRuleReleaseDefinition,
} from "../lib/cases/rule-policy";
import { generateRealisticCases } from "../lib/batch/realistic-dataset";
import { gradeCanonicalCase } from "../lib/batch/rule-facts";
import { evaluateCaseRuleRelease } from "../lib/cases/rule-evaluator";
import { analyseService, buildDomains } from "./verify-rule-reachability";

// ─── Candidate corrections ───────────────────────────────────────────────────

type Correction = {
  id: string;
  strategy: "NARROW" | "REORDER";
  description: string;
  /** Rules expected to become reachable. */
  unblocks: string[];
  apply: (d: CaseRuleReleaseDefinition) => CaseRuleReleaseDefinition;
};

function clone(d: CaseRuleReleaseDefinition): CaseRuleReleaseDefinition {
  return JSON.parse(JSON.stringify(d));
}

/** Add absent-label exclusions to a rule, converting kind if needed. */
function narrow(
  d: CaseRuleReleaseDefinition,
  code: string,
  exclude: string[]
): CaseRuleReleaseDefinition {
  const next = clone(d);
  const index = next.rules.findIndex((r) => r.code === code);
  if (index < 0) throw new Error(`rule ${code} not found`);
  const rule = next.rules[index];

  let converted: CaseRuleDefinition;
  if (rule.kind === "fact_any") {
    converted = {
      code: rule.code, title: rule.title, impact: rule.impact,
      kind: "compound",
      anyFactLabels: [...rule.factLabels],
      absentFactLabels: exclude,
      recommendation: rule.recommendation,
    };
  } else if (rule.kind === "fact_all") {
    converted = {
      code: rule.code, title: rule.title, impact: rule.impact,
      kind: "compound",
      allFactLabels: [...rule.factLabels],
      absentFactLabels: exclude,
      recommendation: rule.recommendation,
    };
  } else if (rule.kind === "compound") {
    converted = {
      ...rule,
      absentFactLabels: [...new Set([...(rule.absentFactLabels ?? []), ...exclude])],
    };
  } else {
    throw new Error(`cannot narrow rule kind ${rule.kind}`);
  }

  next.rules[index] = converted;
  return next;
}

/** Move a rule to immediately after the last of the given codes. */
function moveAfter(
  d: CaseRuleReleaseDefinition,
  code: string,
  afterCodes: string[]
): CaseRuleReleaseDefinition {
  const next = clone(d);
  const index = next.rules.findIndex((r) => r.code === code);
  const [rule] = next.rules.splice(index, 1);
  const target = Math.max(...afterCodes.map((c) => next.rules.findIndex((r) => r.code === c)));
  next.rules.splice(target + 1, 0, rule);
  return next;
}

const RE_REFERRAL_CONTEXTS = ["Previous normal colposcopy", "Previous LSIL histology"];

const CORRECTIONS: Correction[] = [
  {
    id: "C1-NARROW-COL-004",
    strategy: "NARROW",
    description:
      "COL-004 (any HPV 16/18 → P2/30d) excludes re-referral and post-treatment contexts",
    unblocks: ["COL-023", "COL-035", "COL-036", "COL-040", "COL-041"],
    apply: (d) => narrow(d, "COL-004", [...RE_REFERRAL_CONTEXTS, "Post-treatment assessment"]),
  },
  {
    id: "C1-REORDER-COL-004",
    strategy: "REORDER",
    description: "COL-004 moved after the specific rules it currently shadows",
    unblocks: ["COL-023", "COL-035", "COL-036", "COL-040", "COL-041"],
    apply: (d) => moveAfter(d, "COL-004", ["COL-041", "COL-043"]),
  },
  {
    id: "C2-NARROW-COL-007",
    strategy: "NARROW",
    description:
      "COL-007 (any LSIL/HPV Other → P3/90d) excludes re-referral contexts",
    unblocks: ["COL-038", "COL-043"],
    apply: (d) => narrow(d, "COL-007", RE_REFERRAL_CONTEXTS),
  },
  {
    id: "C2-REORDER-COL-007",
    strategy: "REORDER",
    description: "COL-007 moved after the specific rules it currently shadows",
    unblocks: ["COL-038", "COL-043"],
    apply: (d) => moveAfter(d, "COL-007", ["COL-043", "COL-044"]),
  },
  {
    id: "C3-NARROW-COL-027",
    strategy: "NARROW",
    description: "COL-027 (immune-deficient HPV Other) excludes re-referral contexts",
    unblocks: ["COL-037", "COL-042"],
    apply: (d) => narrow(d, "COL-027", RE_REFERRAL_CONTEXTS),
  },
  {
    id: "C4-NARROW-COL-024",
    strategy: "NARROW",
    description:
      "COL-024 excludes HPV Other, the long-cycle surveillance case handled by COL-025. " +
      "NOTE: excluding 'HPV surveillance' instead — the first thing tried — makes COL-024 " +
      "self-contradictory and unreachable, because COL-024 requires that label.",
    unblocks: ["COL-025"],
    apply: (d) => narrow(d, "COL-024", ["HPV Other"]),
  },
  {
    id: "C6-COMPOSITE",
    strategy: "NARROW",
    description:
      "All narrowings applied together — the corrections are NOT independent, because several catch-alls stack in front of the same specific rule",
    unblocks: [
      "COL-023", "COL-025", "COL-035", "COL-036",
      "COL-037", "COL-038", "COL-040", "COL-041", "COL-042", "COL-043",
    ],
    apply: (d) => {
      let next = narrow(d, "COL-004", [...RE_REFERRAL_CONTEXTS, "Post-treatment assessment"]);
      next = narrow(next, "COL-007", [...RE_REFERRAL_CONTEXTS, "HPV surveillance"]);
      next = narrow(next, "COL-027", RE_REFERRAL_CONTEXTS);
      next = narrow(next, "COL-024", ["HPV Other"]);
      // COL-017 keeps its position — rule-policy.ts:94 describes it as the "30d
      // fallback" that COL-027/028 must precede, so its own unreachability looks
      // intentional and confirming that is a clinical decision, not an edit.
      // But once COL-027 stops claiming re-referral cases, COL-017 starts to, so
      // it needs the same exclusion. Each narrowing exposes the next catch-all
      // behind it; the set must be iterated to a fixpoint and re-verified exactly.
      next = narrow(next, "COL-017", RE_REFERRAL_CONTEXTS);
      return next;
    },
  },
];

// ─── Grading helpers ─────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = {
  P1_HSC: 0, P1: 1, P2_HSC: 2, P2: 3, P3: 4, P5: 5,
  INFO_REQUIRED: 6, REJECT: 7, DECLINE: 8,
};

function direction(before: string, after: string, beforeDays?: number, afterDays?: number) {
  const rb = PRIORITY_RANK[before] ?? 99;
  const ra = PRIORITY_RANK[after] ?? 99;
  if (ra < rb) return "urgency_increased";
  if (ra > rb) return "urgency_decreased";
  if (beforeDays !== undefined && afterDays !== undefined) {
    if (afterDays < beforeDays) return "urgency_increased";
    if (afterDays > beforeDays) return "urgency_decreased";
  }
  return "unchanged";
}

/** Does this rule now win for some fact vector? Uses the rule's own intent probe. */
function isReachableByIntent(d: CaseRuleReleaseDefinition, code: string): boolean {
  const rule = d.rules.find((r) => r.code === code);
  if (!rule) return false;
  const labels = new Set<string>();
  const anyRule = rule as unknown as Record<string, string[] | undefined>;
  for (const key of ["allFactLabels", "factLabels"]) {
    (anyRule[key] ?? []).forEach((l) => labels.add(l));
  }
  for (const key of ["anyFactLabels", "signalLabels"]) {
    const group = anyRule[key];
    if (group?.length) labels.add(group[0]);
  }
  const result = evaluateCaseRuleRelease({
    serviceLine: d.serviceLine,
    ruleDefinition: d,
    highSuspicionCancer: false,
    facts: [...labels].map((label) => ({
      label, valueText: "present", evidence: `${label} (reachability probe)`,
    })),
  });
  return result.matchedRuleCode === code;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const count = Number(process.argv[2] ?? 20000);
  const baseline = getBaselineCaseRuleReleaseDefinition("COLPOSCOPY");

  const population = generateRealisticCases({
    connector: "ncsr",
    count,
    rangeStart: new Date("2026-01-01"),
    rangeEnd: new Date("2026-07-31"),
  });

  const before = population.map((c) =>
    gradeCanonicalCase({ ruleDefinition: baseline, batchCase: c })
  );

  console.log("═".repeat(78));
  console.log("PHASE 0b — CORRECTION COMPARISON AND SHADOW REGRADE");
  console.log("═".repeat(78));
  console.log(`Population: ${count} synthetic batch cases (NOT real referrals)`);

  // Coverage — which rules does this population actually exercise?
  const exercised = new Set(before.map((r) => r.matchedRuleCode).filter(Boolean) as string[]);
  console.log(`\nRule coverage of this population:`);
  console.log(`  Rules in the colposcopy release:  ${baseline.rules.length}`);
  console.log(`  Rules ever matched:               ${exercised.size}`);
  console.log(`  Matched: ${[...exercised].sort().join(", ")}`);
  const neverMatched = baseline.rules
    .map((r) => r.code)
    .filter((c) => !exercised.has(c));
  console.log(`  NEVER matched (${neverMatched.length}): ${neverMatched.join(", ")}`);

  console.log(`\n${"─".repeat(78)}`);
  console.log("CORRECTION CANDIDATES");
  console.log("─".repeat(78));

  for (const correction of CORRECTIONS) {
    const corrected = correction.apply(baseline);
    const after = population.map((c) =>
      gradeCanonicalCase({ ruleDefinition: corrected, batchCase: c })
    );

    let changed = 0;
    let up = 0;
    let down = 0;
    const transitions = new Map<string, number>();

    for (let i = 0; i < population.length; i += 1) {
      const b = before[i];
      const a = after[i];
      const same =
        b.matchedRuleCode === a.matchedRuleCode &&
        b.recommendation.priority === a.recommendation.priority &&
        b.recommendation.targetDays === a.recommendation.targetDays;
      if (same) continue;
      changed += 1;
      const dir = direction(
        b.recommendation.priority, a.recommendation.priority,
        b.recommendation.targetDays, a.recommendation.targetDays
      );
      if (dir === "urgency_increased") up += 1;
      if (dir === "urgency_decreased") down += 1;
      const key = `${b.matchedRuleCode ?? "default"} ${b.recommendation.priority}/${b.recommendation.targetDays ?? "-"}d → ${a.matchedRuleCode ?? "default"} ${a.recommendation.priority}/${a.recommendation.targetDays ?? "-"}d`;
      transitions.set(key, (transitions.get(key) ?? 0) + 1);
    }

    const unblocked = correction.unblocks.filter((c) => isReachableByIntent(corrected, c));
    const stillBlocked = correction.unblocks.filter((c) => !unblocked.includes(c));

    console.log(`\n${correction.id}  [${correction.strategy}]`);
    console.log(`  ${correction.description}`);
    console.log(`  Rules unblocked:      ${unblocked.join(", ") || "none"}`);
    if (stillBlocked.length > 0) {
      console.log(`  STILL BLOCKED:        ${stillBlocked.join(", ")}`);
    }
    console.log(`  Cases changed:        ${changed} of ${count} (${((changed / count) * 100).toFixed(2)}%)`);
    console.log(`  Urgency increased:    ${up}`);
    console.log(`  Urgency decreased:    ${down}`);
    if (transitions.size > 0) {
      console.log(`  Transitions:`);
      for (const [key, n] of [...transitions.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`     ${n.toString().padStart(6)}  ${key}`);
      }
    }
  }

  // Exact re-verification of the composite, not just the intent probe.
  const composite = CORRECTIONS.find((c) => c.id === "C6-COMPOSITE")!;
  const correctedDefinition = composite.apply(baseline);
  const recheck = analyseService("COLPOSCOPY", buildDomains(), correctedDefinition);
  const stillShadowed = recheck.filter((f) => f.classification === "SHADOWED");
  const stillUnreachable = recheck.filter(
    (f) => f.classification === "OPERATIONALLY_UNREACHABLE"
  );

  console.log(`\n${"─".repeat(78)}`);
  console.log("EXACT RE-VERIFICATION OF C6-COMPOSITE");
  console.log("─".repeat(78));
  console.log(`  Reachable:                  ${recheck.filter((f) => f.classification === "REACHABLE").length} of ${recheck.length}`);
  console.log(`  Still shadowed:             ${stillShadowed.length}`);
  for (const f of stillShadowed) {
    console.log(
      `     ${f.code} — ${f.intendedPriority}/${f.intendedTargetDays}d → ${f.actualPriority}/${f.actualTargetDays}d by ${f.actualWinner} [${f.urgencyDirection}]`
    );
  }
  console.log(`  Operationally unreachable:  ${stillUnreachable.length} (${stillUnreachable.map((f) => f.code).join(", ")})`);
  console.log(
    `  Urgency-changing remaining: ${stillShadowed.filter((f) => f.urgencyDirection !== "unchanged").length}`
  );

  console.log(`\n${"═".repeat(78)}`);
  console.log("LIMITATION");
  console.log("═".repeat(78));
  console.log(
    "This population is generated from lib/batch/realistic-dataset.ts archetypes and\n" +
    "reaches the evaluator only via buildBatchRuleFacts (Path A). No archetype sets\n" +
    "normalColposcopy or CIN1 histology, so the re-referral contexts these corrections\n" +
    "target are never present. Zero collateral change here is evidence of SAFETY, not\n" +
    "evidence that the corrections have no effect. Impact on the affected population\n" +
    "must be measured by replaying real historical referrals before activation."
  );
}

main();
