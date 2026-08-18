import test from "node:test";
import assert from "node:assert/strict";

import { diffRuleReleases } from "@/lib/cases/rule-diff";
import type { CaseRuleReleaseDefinition } from "@/lib/cases/rule-policy";

function def(rules: CaseRuleReleaseDefinition["rules"]): CaseRuleReleaseDefinition {
  return {
    releaseKind: "coded-enterprise-v2",
    serviceLine: "COLPOSCOPY",
    sourceOfTruth: [],
    notes: [],
    defaultRecommendation: { priority: "INFO_REQUIRED", category: "x", outcome: "x", rationale: "x" },
    rules,
  };
}

const ruleA: CaseRuleReleaseDefinition["rules"][number] = {
  code: "A", title: "Rule A", impact: "", kind: "fact_any", factLabels: ["HPV 16/18"],
  recommendation: { priority: "P2", category: "c", outcome: "o", rationale: "r", targetDays: 30 },
};
const ruleB: CaseRuleReleaseDefinition["rules"][number] = {
  code: "B", title: "Rule B", impact: "", kind: "fact_any", factLabels: ["LSIL"],
  recommendation: { priority: "P3", category: "c", outcome: "o", rationale: "r", targetDays: 90 },
};

test("diff detects no changes for identical definitions", () => {
  const d = diffRuleReleases(def([ruleA, ruleB]), def([ruleA, ruleB]));
  assert.equal(d.hasChanges, false);
});

test("diff detects added and removed rules", () => {
  const d = diffRuleReleases(def([ruleA]), def([ruleA, ruleB]));
  assert.equal(d.added.length, 1);
  assert.equal(d.added[0].code, "B");
  const d2 = diffRuleReleases(def([ruleA, ruleB]), def([ruleA]));
  assert.equal(d2.removed.length, 1);
  assert.equal(d2.removed[0].code, "B");
});

test("diff detects a changed timeframe", () => {
  const changed = { ...ruleA, recommendation: { ...ruleA.recommendation, targetDays: 14 } };
  const d = diffRuleReleases(def([ruleA]), def([changed]));
  assert.equal(d.changed.length, 1);
  const tf = d.changed[0].changes.find((c) => c.field === "Timeframe (days)");
  assert.ok(tf);
  assert.equal(tf!.from, "30");
  assert.equal(tf!.to, "14");
});

test("diff flags reordering of shared rules", () => {
  const d = diffRuleReleases(def([ruleA, ruleB]), def([ruleB, ruleA]));
  assert.equal(d.reordered, true);
  assert.equal(d.hasChanges, true);
});
