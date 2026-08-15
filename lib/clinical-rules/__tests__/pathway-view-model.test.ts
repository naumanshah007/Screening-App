import assert from "node:assert/strict";
import test from "node:test";

import { loadGovernedSnapshot } from "../governed-snapshot-store";
import {
  PATHWAY_ENTRY_ID,
  buildPathwayGraph,
  descendantsOf,
  edgeIdsForChain,
  findPathwayForRule,
  listPathwaySummaries,
  pathToNode,
  searchPathwayNodes,
  splitFacets,
  type PathwayGraph,
} from "../pathway-view-model";

/**
 * The committed, checksum-verified governed artefact — the same one the
 * application loads. Deliberately not the external v2.1 source package: a clean
 * checkout must be able to run these tests.
 */
function snapshot() {
  return loadGovernedSnapshot("cg-ncsp-3.1.0");
}

function componentCount(graph: PathwayGraph) {
  const adjacency = new Map<string, string[]>();
  const link = (from: string, to: string) => {
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  };
  for (const edge of graph.edges) {
    link(edge.source, edge.target);
    link(edge.target, edge.source);
  }
  const seen = new Set<string>();
  let components = 0;
  for (const node of graph.nodes) {
    if (seen.has(node.id)) continue;
    components += 1;
    const stack = [node.id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!seen.has(next)) stack.push(next);
      }
    }
  }
  return components;
}

test("governed snapshot keeps its published counts", async () => {
  const built = snapshot();
  assert.equal(built.productRuleSet.displayVersion, "CG-NCSP-3.1.0");
  assert.equal(built.rules.length, 203);
  assert.equal(built.nodes.length, 422);
  assert.equal(built.edges.length, 421);
  assert.equal(built.views.length, 12);
});

test("every governed view renders as one connected tree", async () => {
  const built = snapshot();
  const summaries = listPathwaySummaries(built);
  assert.equal(summaries.length, built.views.length);
  for (const summary of summaries) {
    const graph = buildPathwayGraph(built, summary.key);
    assert.ok(graph.nodes.length > 0, `${summary.key} must render nodes`);
    assert.ok(graph.edges.length > 0, `${summary.key} must render edges`);
    assert.equal(
      componentCount(graph),
      1,
      `${summary.key} must be a single connected component`
    );
    // A tree: every node except the root has exactly one parent edge.
    const parents = new Map<string, number>();
    for (const edge of graph.edges) {
      parents.set(edge.target, (parents.get(edge.target) ?? 0) + 1);
    }
    const roots = graph.nodes.filter((node) => !parents.has(node.id));
    assert.equal(roots.length, 1, `${summary.key} must have exactly one root`);
    for (const [, count] of parents) assert.equal(count, 1);
    assert.equal(graph.edges.length, graph.nodes.length - 1);
  }
});

test("pathway views reconstruct the hierarchy the view definition omits", async () => {
  const built = snapshot();
  const view = built.views.find((candidate) => candidate.key === "primary-hpv-screening")!;
  const graph = buildPathwayGraph(built, "primary-hpv-screening");

  // The stored view is 46 nodes / 23 edges, i.e. 23 disconnected pairs.
  assert.equal(view.includedNodeIds.length, 46);
  assert.equal(view.includedEdgeIds.length, 23);

  // Rebuilt: entry + 2 governed sections + 23 decisions + 23 outcomes.
  assert.equal(graph.nodes.length, 49);
  assert.equal(graph.counts.decisions, 23);
  assert.equal(graph.counts.outcomes, 23);
  assert.deepEqual(
    graph.nodes.filter((node) => node.level === 1).map((node) => node.title),
    ["Figure 3", "Immune-deficiency classifier"]
  );
});

test("only the pathway entry node is synthetic; every edge is governed or entry-attached", async () => {
  const built = snapshot();
  const governedEdgeIds = new Set(built.edges.map((edge) => edge.stableEdgeId));
  for (const summary of listPathwaySummaries(built)) {
    const graph = buildPathwayGraph(built, summary.key);
    const synthetic = graph.nodes.filter((node) => node.synthetic);
    if (summary.viewType === "MASTER") {
      assert.equal(synthetic.length, 0, "master uses the governed START node");
    } else {
      assert.equal(synthetic.length, 1);
      assert.equal(synthetic[0].id, PATHWAY_ENTRY_ID);
    }
    for (const edge of graph.edges) {
      if (edge.synthetic) {
        assert.equal(edge.source, PATHWAY_ENTRY_ID);
        continue;
      }
      assert.ok(
        governedEdgeIds.has(edge.id),
        `${summary.key}: ${edge.id} must be a governed edge`
      );
    }
  }
});

test("nodes are emitted in governed order, not alphabetical order", async () => {
  const built = snapshot();
  const master = buildPathwayGraph(built, "master");
  assert.deepEqual(
    master.nodes.filter((node) => node.level === 1).map((node) => node.title),
    [
      "Global Router & Safety",
      "Figure 1",
      "Figure 2",
      "Figure 3",
      "Figure 4",
      "Figure 5",
      "Figure 6",
      "Figure 7",
      "Table 1",
      "Figure 8",
      "Figure 9",
      "Figure 10",
      "Special populations",
      "2026 overlays",
      "Immune-deficiency classifier",
    ]
  );

  // Rule order must not sort F3-10 before F3-02.
  const primary = buildPathwayGraph(built, "primary-hpv-screening");
  const ruleIds = primary.nodes
    .filter((node) => node.level === 2)
    .map((node) => node.ruleId);
  assert.deepEqual(ruleIds.slice(0, 4), ["F3-01", "F3-02", "F3-03", "F3-04"]);
  assert.equal(ruleIds[9], "F3-10");
});

test("clinical wording is carried through unchanged", async () => {
  const built = snapshot();
  const rules = new Map(built.rules.map((rule) => [rule.stableRuleId, rule]));
  const graph = buildPathwayGraph(built, "master");
  let checked = 0;
  for (const node of graph.nodes) {
    if (node.kind !== "DECISION" || !node.ruleId) continue;
    const rule = rules.get(node.ruleId)!;
    assert.equal(node.fullText, rule.sourceConditionText);
    assert.equal(node.detail?.provisionalOutcome, rule.provisionalOutcome);
    assert.equal(node.detail?.timingDestination, rule.timingDestination);
    assert.equal(node.detail?.safetyPriority, rule.safetyPriority);
    assert.equal(node.detail?.reviewerRequirement, rule.reviewerRequirement);
    checked += 1;
  }
  assert.equal(checked, 203);
});

test("missing-information behaviour is preserved on every decision", async () => {
  const built = snapshot();
  const graph = buildPathwayGraph(built, "master");
  const decisions = graph.nodes.filter((node) => node.kind === "DECISION");
  assert.equal(decisions.length, 203);
  for (const node of decisions) {
    assert.ok(
      node.detail && node.detail.missingDataBehaviour.trim().length > 0,
      `${node.ruleId} must retain its missing-data behaviour`
    );
  }
});

test("governed outcome branches are surfaced, not dropped or invented", async () => {
  const built = snapshot();
  const graph = buildPathwayGraph(built, "master");
  const withBranches = graph.nodes.filter(
    (node) => node.kind === "DECISION" && node.governedBranchCount > 1
  );
  assert.equal(withBranches.length, 8);
  for (const node of withBranches) {
    const rule = built.rules.find((candidate) => candidate.stableRuleId === node.ruleId)!;
    assert.equal(node.detail?.outcomeBranches.length, rule.outcomeBranches?.length);
    for (const [index, branch] of (node.detail?.outcomeBranches ?? []).entries()) {
      assert.equal(branch.provisionalOutcome, rule.outcomeBranches![index].provisionalOutcome);
    }
  }
  // The governed graph still stores one outcome node per rule.
  assert.equal(graph.counts.outcomes, 203);
});

test("terminal outcomes carry a tone and never sit above a decision", async () => {
  const built = snapshot();
  const graph = buildPathwayGraph(built, "master");
  const parentOf = new Map(graph.edges.map((edge) => [edge.target, edge.source]));
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const outcomes = graph.nodes.filter((node) => node.kind === "OUTCOME");
  assert.equal(outcomes.length, 203);
  for (const outcome of outcomes) {
    const parent = byId.get(parentOf.get(outcome.id)!);
    assert.equal(parent?.kind, "DECISION");
    assert.ok(descendantsOf(graph, outcome.id).length === 0, "outcomes are terminal");
  }
  assert.equal(graph.counts.urgent, 16);
});

test("red is reserved for governed safety stops", async () => {
  const built = snapshot();
  const graph = buildPathwayGraph(built, "master");
  const urgent = graph.nodes.filter((node) => node.tone === "URGENT");
  assert.equal(urgent.length, 16);
  for (const node of urgent) assert.equal(node.nodeType, "SAFETY_STOP");
});

test("root-to-node path explains how an outcome is reached", async () => {
  const built = snapshot();
  const graph = buildPathwayGraph(built, "primary-hpv-screening");
  const chain = pathToNode(graph, "node:outcome:F3-03");
  assert.deepEqual(chain, [
    PATHWAY_ENTRY_ID,
    "node:section:figure-3",
    "node:rule:F3-03",
    "node:outcome:F3-03",
  ]);
  assert.equal(edgeIdsForChain(graph, chain).size, 3);
});

test("search matches rule ids and clinical wording", async () => {
  const built = snapshot();
  const graph = buildPathwayGraph(built, "primary-hpv-screening");
  assert.ok(searchPathwayNodes(graph, "F3-03").has("node:rule:F3-03"));
  assert.ok(searchPathwayNodes(graph, "colposcopy").size > 0);
  assert.equal(searchPathwayNodes(graph, "   ").size, 0);
  assert.equal(searchPathwayNodes(graph, "zzzz-no-such-term").size, 0);
});

test("a rule resolves to a specific pathway rather than the master map", async () => {
  const built = snapshot();
  assert.equal(findPathwayForRule(built, "F3-03"), "primary-hpv-screening");
  assert.equal(findPathwayForRule(built, "F9-01"), "pregnancy");
  assert.equal(findPathwayForRule(built, "T1-01"), "hysterectomy-vaginal-vault");
  assert.equal(findPathwayForRule(built, "NOT-A-RULE"), null);
});

test("structured conditions split into facets so Table 1 rows stay distinguishable", async () => {
  const built = snapshot();
  const graph = buildPathwayGraph(built, "hysterectomy-vaginal-vault");
  const faceted = graph.nodes.filter((node) => node.facets);
  assert.ok(faceted.length >= 18);
  for (const node of faceted) assert.equal(node.facets?.length, 3);

  // The last facet is the discriminating clause between T1-01..T1-04.
  const tails = ["T1-01", "T1-02", "T1-03", "T1-04"].map((ruleId) => {
    const node = graph.nodes.find((candidate) => candidate.ruleId === ruleId && candidate.kind === "DECISION")!;
    return node.facets?.[2].value;
  });
  assert.equal(new Set(tails).size, 4, "each Table 1 row must be visually distinct");

  // Ordinary prose is left alone.
  assert.equal(splitFacets("Any abnormal vaginal bleeding or cancer concern"), null);
  assert.equal(splitFacets("Refer to colposcopy: urgent"), null);
});

test("edge labels are suppressed only when they repeat the target card", async () => {
  const built = snapshot();
  const graph = buildPathwayGraph(built, "master");
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const edge of graph.edges) {
    if (!edge.showLabel) continue;
    const target = byId.get(edge.target);
    assert.notEqual(edge.label, "Source condition met");
    assert.notEqual(edge.label, target?.ruleId);
  }
  // Every governed label is still retained on the edge for the drawer.
  for (const edge of graph.edges) assert.ok(edge.label.length > 0);
});

test("pathway summaries drive the Guidelines cards", async () => {
  const built = snapshot();
  const summaries = listPathwaySummaries(built);
  assert.equal(summaries.length, 12);
  assert.deepEqual(
    summaries.map((summary) => summary.displayOrder),
    Array.from({ length: 12 }, (_, index) => index)
  );
  const primary = summaries.find((summary) => summary.key === "primary-hpv-screening")!;
  assert.equal(primary.decisions, 23);
  assert.equal(primary.urgent, 5);
  assert.ok(primary.ruleIds.includes("F3-03"));
  assert.ok(primary.description.length > 0);
});

test("an unknown view key is rejected rather than silently rendered empty", async () => {
  const built = snapshot();
  assert.throws(() => buildPathwayGraph(built, "no-such-view"), /Unknown governed pathway view/);
});
