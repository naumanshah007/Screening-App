/**
 * Recall-capability census for CG-NCSP-3.1.0.
 *
 * Every governed rule falls into exactly one closed category, and the counts are
 * locked so a ruleset change cannot silently alter how many participants would
 * receive a machine-generated recall date.
 *
 * These counts are operational-governance evidence for the GOV-04 operating
 * point. They are a measurement, not a clinical judgement.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { loadGovernedSnapshot } from "../governed-snapshot-store";
import {
  classifyTiming,
  isAutomaticallySchedulable,
  urgencyFromTiming,
} from "../governed-vocabulary";
import { recallCapability, type RecallCapability } from "../../../scripts/rule-studio/timing-classification-report";

function census() {
  const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");
  const counts = new Map<RecallCapability, number>();
  for (const rule of snapshot.rules) {
    const capability = recallCapability(classifyTiming(rule.timingDestination));
    counts.set(capability, (counts.get(capability) ?? 0) + 1);
  }
  return { snapshot, counts };
}

test("every governed rule has exactly one recall capability", () => {
  const { snapshot, counts } = census();
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  assert.equal(total, snapshot.rules.length, "the classification must be total and non-overlapping");
  assert.equal(total, 203);
});

test("recall capability counts are locked", () => {
  const { counts } = census();
  // A change here is a change in how many participants can be recalled
  // automatically. It must be deliberate and re-reported to governance.
  assert.deepEqual(Object.fromEntries(counts), {
    AUTO_SCHEDULABLE_EXACT: 18,
    AUTO_SCHEDULABLE_BOUNDED: 2,
    CLINICIAN_TIMING_REQUIRED: 40,
    IMMEDIATE_OR_EVENT_DRIVEN: 60,
    NO_RECALL_DATE_APPLICABLE: 83,
  });
});

test("only 20 of 203 rules permit a machine-generated recall date", () => {
  const { counts } = census();
  const auto =
    (counts.get("AUTO_SCHEDULABLE_EXACT") ?? 0) + (counts.get("AUTO_SCHEDULABLE_BOUNDED") ?? 0);
  assert.equal(auto, 20);
  assert.ok(auto / 203 < 0.1, "under 10% of governed rules can be auto-scheduled");
});

test("capability and schedulability never disagree", () => {
  const { snapshot } = census();
  for (const rule of snapshot.rules) {
    const classification = classifyTiming(rule.timingDestination);
    const capability = recallCapability(classification);
    const expected =
      capability === "AUTO_SCHEDULABLE_EXACT" || capability === "AUTO_SCHEDULABLE_BOUNDED";
    assert.equal(
      isAutomaticallySchedulable(classification),
      expected,
      `${rule.stableRuleId}: capability ${capability} disagrees with schedulability`
    );
  }
});

test("no rule outside the auto categories yields an interval", () => {
  const { snapshot } = census();
  for (const rule of snapshot.rules) {
    const classification = classifyTiming(rule.timingDestination);
    if (recallCapability(classification) === "AUTO_SCHEDULABLE_EXACT") continue;
    if (recallCapability(classification) === "AUTO_SCHEDULABLE_BOUNDED") continue;
    assert.equal(
      "interval" in classification,
      false,
      `${rule.stableRuleId} must not carry an interval it does not state`
    );
  }
});

test("the governed timing text is always available for display", () => {
  // The UI must be able to show what the source actually says, even where no
  // date can be generated. `timingDestination` is a plain string on every rule.
  const { snapshot } = census();
  for (const rule of snapshot.rules) {
    assert.equal(typeof rule.timingDestination, "string", `${rule.stableRuleId} timing must be displayable`);
  }
});

test("urgency is defined for every rule without inventing one", () => {
  const { snapshot } = census();
  const urgencies = new Set<string>();
  for (const rule of snapshot.rules) {
    urgencies.add(urgencyFromTiming(classifyTiming(rule.timingDestination)));
  }
  // Only the closed vocabulary appears.
  for (const urgency of urgencies) {
    assert.ok(
      ["URGENT", "PROMPT", "ROUTINE", "NOT_STATED"].includes(urgency),
      `unexpected urgency ${urgency}`
    );
  }
});
