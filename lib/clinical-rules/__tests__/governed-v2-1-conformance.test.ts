import assert from "node:assert/strict";
import test from "node:test";

import {
  compiledHighRiskRuleIds,
  conformanceTestIdsForRule,
  EXECUTABLE_CONFORMANCE_TEST_IDS,
  factsForExpressionTruth,
  governedCompilationForRule,
  missingFactCaseForExpression,
} from "../compiled-v2-1";
import {
  evaluateClinicalSnapshot,
  evaluateConditionExpression,
} from "../evaluator";
import { buildSnapshotFromV21Package } from "../source-package";
import { validateClinicalRuleSnapshot } from "../validation";

const builtPromise = buildSnapshotFromV21Package();

test("governed compilation covers every HIGH and CRITICAL v2.1 rule exactly once", async () => {
  const { snapshot } = await builtPromise;
  const highRiskRuleIds = snapshot.rules
    .filter((rule) => ["HIGH", "CRITICAL"].includes(rule.safetyPriority))
    .map((rule) => rule.stableRuleId)
    .sort();
  assert.equal(highRiskRuleIds.length, 139);
  const compiledHighRiskIds = compiledHighRiskRuleIds()
    .filter((ruleId) => highRiskRuleIds.includes(ruleId))
    .sort();
  assert.deepEqual(compiledHighRiskIds, highRiskRuleIds);
  assert.deepEqual(
    compiledHighRiskRuleIds().filter((ruleId) => !highRiskRuleIds.includes(ruleId)).sort(),
    ["F3-01", "F3-02", "F3-15"]
  );
  assert.equal(EXECUTABLE_CONFORMANCE_TEST_IDS.size, 462);
});

for (const ruleId of compiledHighRiskRuleIds()) {
  test(`CG-V21-${ruleId}-POSITIVE`, async () => {
    const { snapshot } = await builtPromise;
    const rule = snapshot.rules.find((candidate) => candidate.stableRuleId === ruleId);
    assert.ok(rule, `${ruleId} is absent from the v2.1 source snapshot`);
    const facts = factsForExpressionTruth(rule.conditionExpression, "TRUE");
    const evaluated = evaluateConditionExpression(rule.conditionExpression, facts);
    assert.equal(evaluated.result, "TRUE", `${ruleId}: ${JSON.stringify(facts)}`);

    const isolated = evaluateClinicalSnapshot({ ...snapshot, rules: [rule] }, facts);
    assert.equal(isolated.matchedRules[0]?.stableRuleId, ruleId);
    assert.equal(isolated.result.provisionalRecommendation, rule.provisionalOutcome);
    assert.deepEqual(isolated.result.sourceReferences, rule.sourceReferences);
    assert.equal(isolated.result.mandatoryReviewerConfirmation, true);
    if (/clinician|mdm|specialist/i.test(`${rule.automationBoundary} ${rule.reviewerRequirement}`)) {
      assert.equal(isolated.result.clinicianOnly, true, ruleId);
    }
    if (/urgent|oncology|cancer/i.test(`${rule.provisionalOutcome} ${rule.timingDestination}`)) {
      assert.ok(
        isolated.result.urgency === "URGENT" || isolated.result.clinicianOnly,
        `${ruleId} must retain an urgent or clinician-only boundary`
      );
    }
  });

  test(`CG-V21-${ruleId}-NEGATIVE`, async () => {
    const { snapshot } = await builtPromise;
    const rule = snapshot.rules.find((candidate) => candidate.stableRuleId === ruleId)!;
    const facts = factsForExpressionTruth(rule.conditionExpression, "FALSE");
    const evaluated = evaluateConditionExpression(rule.conditionExpression, facts);
    assert.equal(evaluated.result, "FALSE", `${ruleId}: ${JSON.stringify(facts)}`);
  });

  test(`CG-V21-${ruleId}-MISSING`, async () => {
    const { snapshot } = await builtPromise;
    const rule = snapshot.rules.find((candidate) => candidate.stableRuleId === ruleId)!;
    const missingCase = missingFactCaseForExpression(rule.conditionExpression);
    const evaluated = evaluateConditionExpression(rule.conditionExpression, missingCase.facts);
    assert.equal(
      evaluated.result,
      "UNKNOWN",
      `${ruleId}: deleting ${missingCase.missingFact} must not collapse unknown to false`
    );
    assert.match(rule.missingDataBehaviour, /unknown|missing|request|review|stop/i);
  });

  for (const boundaryCase of governedCompilationForRule(ruleId)?.boundaryCases ?? []) {
    test(`CG-V21-${ruleId}-${boundaryCase.idSuffix}`, async () => {
      const { snapshot } = await builtPromise;
      const rule = snapshot.rules.find((candidate) => candidate.stableRuleId === ruleId)!;
      const evaluated = evaluateConditionExpression(
        rule.conditionExpression,
        boundaryCase.facts
      );
      assert.equal(
        evaluated.result,
        boundaryCase.expected,
        `${ruleId}: ${JSON.stringify(boundaryCase.facts)}`
      );
    });
  }

  test(`registered test IDs match executable cases for ${ruleId}`, async () => {
    const { snapshot } = await builtPromise;
    const rule = snapshot.rules.find((candidate) => candidate.stableRuleId === ruleId)!;
    assert.deepEqual(rule.executableTestIds, conformanceTestIdsForRule(ruleId));
    assert.ok(rule.executableTestIds.every((testId) => EXECUTABLE_CONFORMANCE_TEST_IDS.has(testId)));
  });
}

test("all governed v2.1 publication blockers are removed without activation", async () => {
  const { snapshot } = await builtPromise;
  const report = validateClinicalRuleSnapshot(snapshot);
  assert.equal(report.valid, true);
  assert.equal(report.counts.errors, 0);
  assert.equal(report.issues.filter((issue) => issue.code === "HIGH_RISK_RULE_NOT_EXECUTABLE").length, 0);
  assert.equal(report.issues.filter((issue) => issue.code === "HIGH_RISK_TEST_MISSING").length, 0);
  assert.equal(report.issues.filter((issue) => issue.code === "HIGH_RISK_TEST_UNREGISTERED").length, 0);
});
