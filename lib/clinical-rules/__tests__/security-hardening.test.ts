import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateConditionExpression,
  MAX_CONDITION_EVALUATION_DEPTH,
} from "../evaluator";
import {
  ClinicalRuleSnapshotSchema,
  type ConditionExpression,
} from "../schema";
import { loadGovernedSnapshot } from "../governed-snapshot-store";
import { validateClinicalRuleSnapshot } from "../validation";

test("condition evaluation rejects excessive recursion without executing source text", () => {
  let expression: ConditionExpression = {
    type: "FACT",
    fact: "safeFact",
    operator: "EQ",
    value: true,
  };
  for (let depth = 0; depth < MAX_CONDITION_EVALUATION_DEPTH + 2; depth += 1) {
    expression = { type: "NOT", expression };
  }
  assert.throws(
    () => evaluateConditionExpression(expression, { safeFact: true }),
    /governed evaluation depth limit/
  );
});

test("snapshot schema enforces graph denial-of-service collection limits", async () => {
  const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");
  const oversized = {
    ...snapshot,
    views: Array.from({ length: 101 }, (_, index) => ({
      ...snapshot.views[0]!,
      key: `oversized-${index}`,
      displayOrder: index,
    })),
  };
  const parsed = ClinicalRuleSnapshotSchema.safeParse(oversized);
  assert.equal(parsed.success, false);
});

test("unexpected graph cycles and duplicate stable IDs remain publication blockers", async () => {
  const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");
  const changed = structuredClone(snapshot);
  changed.rules[1]!.stableRuleId = changed.rules[0]!.stableRuleId;
  changed.edges.push({
    ...changed.edges[0]!,
    stableEdgeId: "edge:security-cycle",
    fromNodeId: changed.edges[0]!.toNodeId,
    toNodeId: changed.edges[0]!.fromNodeId,
    allowsCycle: false,
  });
  const report = validateClinicalRuleSnapshot(changed);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((issue) => issue.code === "DUPLICATE_RULE_ID"));
  assert.ok(report.issues.some((issue) => issue.code === "UNEXPECTED_CYCLE"));
});
