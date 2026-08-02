import assert from "node:assert/strict";
import test from "node:test";

import { calculateRuleSnapshotChecksum, deterministicJson } from "../checksum";
import { diffClinicalRuleSnapshots } from "../diff";
import { evaluateClinicalSnapshot } from "../evaluator";
import { ClinicalRuleSnapshotSchema, type ClinicalRuleSnapshot } from "../schema";
import { buildSnapshotFromV21Package } from "../source-package";
import { validateClinicalRuleSnapshot } from "../validation";

let snapshotPromise: Promise<ClinicalRuleSnapshot> | undefined;

function sourceSnapshot() {
  snapshotPromise ??= buildSnapshotFromV21Package().then((built) => built.snapshot);
  return snapshotPromise;
}

test("v2.1 import projection contains all source rules, Table 1 rows, QA closures and views", async () => {
  const snapshot = await sourceSnapshot();
  assert.equal(snapshot.rules.length, 203);
  assert.equal(new Set(snapshot.rules.map((rule) => rule.stableRuleId)).size, 203);
  assert.equal(snapshot.rules.filter((rule) => rule.stableRuleId.startsWith("T1-")).length, 21);
  assert.deepEqual(Object.keys(snapshot.qaClosure),
    Array.from({ length: 18 }, (_, index) => `QA-${String(index + 1).padStart(2, "0")}`));
  assert.equal(snapshot.nodes.length, 422);
  assert.equal(snapshot.edges.length, 421);
  assert.equal(snapshot.views.length, 12);
  assert.equal(snapshot.views.filter((view) => view.viewType === "MASTER").length, 1);
});

test("every projected graph view resolves to the same canonical node and edge collections", async () => {
  const snapshot = await sourceSnapshot();
  const nodeIds = new Set(snapshot.nodes.map((node) => node.stableNodeId));
  const edgeIds = new Set(snapshot.edges.map((edge) => edge.stableEdgeId));
  for (const view of snapshot.views) {
    assert.ok(view.includedNodeIds.every((nodeId) => nodeIds.has(nodeId)), view.key);
    assert.ok(view.includedEdgeIds.every((edgeId) => edgeIds.has(edgeId)), view.key);
    assert.ok(view.includedNodeIds.every((nodeId) => view.layout[nodeId]), view.key);
  }
  const pathwayRuleIds = new Set(
    snapshot.nodes
      .filter((node) => snapshot.views.some((view) => view.viewType !== "MASTER" && view.includedNodeIds.includes(node.stableNodeId)))
      .flatMap((node) => node.linkedRuleIds)
  );
  assert.equal(pathwayRuleIds.size, 203);
});

test("v2.1.1 verified visual memberships and metadata are reconciled exactly", async () => {
  const snapshot = await sourceSnapshot();
  assert.equal(snapshot.importEvidence.visualPackageVersion, "2.1.1");
  assert.equal(snapshot.importEvidence.visualVerificationStatus, "PASS");
  assert.equal(snapshot.importEvidence.visualPackageFiles?.length, 73);

  const expectedRuleCounts: Record<string, number> = {
    "global-router-safety": 28,
    "transition-hpv-primary": 13,
    "primary-hpv-screening": 23,
    "low-grade-post-colposcopy": 18,
    "high-grade-post-colposcopy": 18,
    "hsil-treatment-test-of-cure": 17,
    "glandular-ais": 19,
    "hysterectomy-vaginal-vault": 40,
    pregnancy: 14,
    "bleeding-safety-overrides": 15,
  };
  for (const [viewKey, expectedRuleCount] of Object.entries(expectedRuleCounts)) {
    const view = snapshot.views.find((candidate) => candidate.key === viewKey)!;
    const ruleIds = snapshot.nodes
      .filter(
        (node) =>
          node.stableNodeId.startsWith("node:rule:") &&
          view.includedNodeIds.includes(node.stableNodeId)
      )
      .flatMap((node) => node.linkedRuleIds);
    assert.equal(new Set(ruleIds).size, expectedRuleCount, viewKey);
    assert.equal(view.visualSource?.packageVersion, "2.1.1", viewKey);
    assert.match(view.visualSource?.verificationStatus ?? "", /^VERIFIED_/, viewKey);
    assert.equal(
      view.includedNodeIds.every((nodeId) => Boolean(view.layout[nodeId])),
      true,
      viewKey
    );
  }

  const tableView = snapshot.views.find(
    (view) => view.key === "hysterectomy-vaginal-vault"
  )!;
  const tableRuleIds = snapshot.nodes
    .filter(
      (node) =>
        node.stableNodeId.startsWith("node:rule:T1-") &&
        tableView.includedNodeIds.includes(node.stableNodeId)
    )
    .flatMap((node) => node.linkedRuleIds);
  assert.equal(new Set(tableRuleIds).size, 21);
  assert.ok(
    tableView.visualSource?.sourceFiles.some((file) =>
      file.endsWith("08b_table1_21_cell_matrix.svg")
    )
  );
});

test("visual reconciliation does not alter source condition text or outcomes", async () => {
  const snapshot = await sourceSnapshot();
  for (const rule of snapshot.rules) {
    const decision = snapshot.nodes.find(
      (node) => node.stableNodeId === `node:rule:${rule.stableRuleId}`
    );
    assert.equal(decision?.label, rule.sourceConditionText, rule.stableRuleId);
    const outcome = snapshot.nodes.find(
      (node) => node.stableNodeId === `node:outcome:${rule.stableRuleId}`
    );
    assert.equal(outcome?.provisionalOutcome, rule.provisionalOutcome, rule.stableRuleId);
  }
});

test("snapshot checksums are deterministic across object key order", async () => {
  const snapshot = await sourceSnapshot();
  const reordered = JSON.parse(deterministicJson(snapshot));
  assert.equal(calculateRuleSnapshotChecksum(snapshot), calculateRuleSnapshotChecksum(reordered));
  assert.match(calculateRuleSnapshotChecksum(snapshot), /^[a-f0-9]{64}$/);
});

test("governed HIGH/CRITICAL compilation passes the publication validator", async () => {
  const snapshot = await sourceSnapshot();
  const report = validateClinicalRuleSnapshot(snapshot);
  assert.equal(report.valid, true);
  assert.equal(report.counts.errors, 0);
  assert.equal(report.issues.filter((issue) => issue.code === "HIGH_RISK_RULE_NOT_EXECUTABLE").length, 0);
  assert.equal(report.issues.filter((issue) => issue.code === "HIGH_RISK_TEST_MISSING").length, 0);
  assert.equal(report.issues.filter((issue) => issue.category === "STRUCTURAL").length, 0);
});

test("arbitrary executable condition types are rejected", async () => {
  const snapshot = structuredClone(await sourceSnapshot()) as unknown as Record<string, unknown>;
  const rules = snapshot.rules as Array<Record<string, unknown>>;
  rules[0]!.conditionExpression = { type: "JAVASCRIPT", source: "return true" };
  assert.equal(ClinicalRuleSnapshotSchema.safeParse(snapshot).success, false);
});

test("typed fact expressions match deterministically and retain mandatory review", async () => {
  const snapshot = structuredClone(await sourceSnapshot());
  const first = snapshot.rules[0]!;
  first.conditionExpression = { type: "FACT", fact: "hasSymptoms", operator: "EQ", value: true };
  first.executableTestIds = ["synthetic-GR-01-positive"];
  const decisionNode = snapshot.nodes.find((node) => node.stableNodeId === `node:rule:${first.stableRuleId}`)!;
  decisionNode.label = first.sourceConditionText;
  const evaluated = evaluateClinicalSnapshot(snapshot, { hasSymptoms: true });
  assert.equal(evaluated.matchedRules[0]?.stableRuleId, first.stableRuleId);
  assert.equal(evaluated.result.mandatoryReviewerConfirmation, true);
  assert.equal(evaluated.result.provisionalRecommendation, first.provisionalOutcome);
});

test("missing facts remain unknown and route to clinician review", async () => {
  const snapshot = structuredClone(await sourceSnapshot());
  const first = snapshot.rules[0]!;
  first.conditionExpression = { type: "FACT", fact: "criticalFact", operator: "EQ", value: true };
  const evaluated = evaluateClinicalSnapshot(snapshot, {});
  assert.equal(evaluated.result.clinicianOnly, true);
  assert.equal(evaluated.result.mandatoryReviewerConfirmation, true);
  assert.ok(evaluated.result.missingInformation.includes("criticalFact"));
  assert.doesNotMatch(evaluated.result.provisionalRecommendation, /routine recall/i);
});

test("version diff distinguishes layout-only movement from clinical changes", async () => {
  const before = await sourceSnapshot();
  const after = structuredClone(before);
  after.views[0]!.layout["node:root"] = { x: 123, y: 456 };
  const diff = diffClinicalRuleSnapshots(before, after);
  assert.equal(diff.summary.layoutOnly, true);
  assert.equal(diff.summary.layoutViewsChanged, 1);
  assert.equal(diff.summary.hasClinicalLogicChanges, false);
});

test("clinical safety invariants detect an age 70–74 HPV-detected regression", async () => {
  const snapshot = structuredClone(await sourceSnapshot());
  const exitRule = snapshot.rules.find((rule) => rule.stableRuleId === "F3-16")!;
  exitRule.provisionalOutcome = "Routine recall";
  const outcomeNode = snapshot.nodes.find((node) => node.stableNodeId === "node:outcome:F3-16")!;
  outcomeNode.label = exitRule.provisionalOutcome;
  outcomeNode.provisionalOutcome = exitRule.provisionalOutcome;
  const report = validateClinicalRuleSnapshot(snapshot);
  assert.ok(report.issues.some((issue) => issue.code === "EXIT_TEST_DETECTED_COLPOSCOPY_INVARIANT"));
});

test("structural validation rejects dangling graph edges", async () => {
  const snapshot = structuredClone(await sourceSnapshot());
  snapshot.edges[0]!.toNodeId = "node:does-not-exist";
  const report = validateClinicalRuleSnapshot(snapshot);
  assert.ok(report.issues.some((issue) => issue.code === "DANGLING_EDGE"));
});
