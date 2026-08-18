import assert from "node:assert/strict";
import test from "node:test";

import { buildSuccessorSnapshotFromV21Package } from "../successor-v3-1";
import { buildPathwayGraph, listPathwaySummaries } from "../pathway-view-model";
import {
  NODE_HEIGHT_BOUNDS,
  NODE_WIDTH,
  estimateWrappedLines,
  layoutPathwayTree,
  rootNodeId,
  type PathwayLayout,
} from "../pathway-layout";
import type { PathwayNode } from "../pathway-view-model";

/**
 * Stand-in for the renderer's canvas measurement. Deterministic so layout
 * assertions do not depend on a browser.
 */
function measure(node: PathwayNode) {
  const width = NODE_WIDTH[node.kind];
  const bounds = NODE_HEIGHT_BOUNDS[node.kind];
  const lines = node.facets
    ? Math.min(3, node.facets.length)
    : estimateWrappedLines(node.title, width - 28, 6.4, node.kind === "DECISION" ? 3 : 3);
  const height = 42 + lines * 18 + (node.timing ? 21 : 0);
  return { width, height: Math.min(bounds.max, Math.max(bounds.min, height)) };
}

async function layouts() {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  return listPathwaySummaries(snapshot).map((summary) => {
    const graph = buildPathwayGraph(snapshot, summary.key);
    return { key: summary.key, graph, layout: layoutPathwayTree(graph, measure) };
  });
}

function overlaps(layout: PathwayLayout) {
  const boxes = [...layout.positions.entries()].map(([id, position]) => ({
    id,
    ...position,
    ...layout.sizes.get(id)!,
  }));
  const collisions: Array<[string, string]> = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      ) {
        collisions.push([a.id, b.id]);
      }
    }
  }
  return collisions;
}

test("no two nodes overlap in any governed view", async () => {
  for (const { key, layout } of await layouts()) {
    assert.deepEqual(overlaps(layout), [], `${key} must lay out without overlaps`);
  }
});

test("every node at the same depth shares one column", async () => {
  for (const { key, graph, layout } of await layouts()) {
    const columnByLevel = new Map<number, number>();
    for (const node of graph.nodes) {
      const x = layout.positions.get(node.id)!.x;
      const existing = columnByLevel.get(node.level);
      if (existing === undefined) columnByLevel.set(node.level, x);
      else assert.equal(x, existing, `${key}: level ${node.level} must be one column`);
    }
    assert.equal(columnByLevel.size, layout.columnX.length);
  }
});

test("columns advance left to right without overlapping", async () => {
  for (const { key, layout } of await layouts()) {
    for (let i = 1; i < layout.columnX.length; i += 1) {
      assert.ok(
        layout.columnX[i] > layout.columnX[i - 1],
        `${key}: column ${i} must sit right of column ${i - 1}`
      );
    }
  }
});

test("sibling spacing is bounded — no touching cards and no runaway gaps", async () => {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  for (const summary of listPathwaySummaries(snapshot)) {
    const graph = buildPathwayGraph(snapshot, summary.key);
    const layout = layoutPathwayTree(graph, measure);
    const decisions = graph.nodes
      .filter((node) => node.kind === "DECISION")
      .map((node) => ({
        y: layout.positions.get(node.id)!.y,
        height: layout.sizes.get(node.id)!.height,
      }))
      .sort((a, b) => a.y - b.y);

    for (let i = 1; i < decisions.length; i += 1) {
      const gap = decisions[i].y - (decisions[i - 1].y + decisions[i - 1].height);
      // Gaps vary by design: each decision's row is sized by whichever of the
      // decision or its outcome card is taller, and the shorter card is centred
      // in that row. What must hold is that rows never touch and never open up
      // an empty band.
      assert.ok(gap >= 18, `${summary.key}: sibling rows must not touch (saw ${gap})`);
      assert.ok(
        gap <= 96,
        `${summary.key}: sibling spacing must stay tight (saw ${gap})`
      );
    }
  }
});

test("a parent spanning a long list is aligned to its first child", async () => {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  const graph = buildPathwayGraph(snapshot, "pregnancy");
  const layout = layoutPathwayTree(graph, measure);
  const section = graph.nodes.find((node) => node.kind === "GROUP")!;
  const firstChild = graph.nodes.find((node) => node.ruleId === "F9-01" && node.kind === "DECISION")!;
  const sectionCentre =
    layout.positions.get(section.id)!.y + layout.sizes.get(section.id)!.height / 2;
  const childCentre =
    layout.positions.get(firstChild.id)!.y + layout.sizes.get(firstChild.id)!.height / 2;
  assert.ok(
    Math.abs(sectionCentre - childCentre) < 1,
    "a 14-child section heads its list instead of centring halfway down it"
  );
});

test("a tight fan-out keeps the centred org-chart look", async () => {
  const graph = {
    key: "synthetic",
    title: "Synthetic",
    description: "",
    viewType: "PATHWAY" as const,
    displayOrder: 0,
    sections: [],
    annotations: [],
    counts: {
      decisions: 2,
      outcomes: 0,
      urgent: 0,
      review: 0,
      governedNodes: 3,
      governedEdges: 2,
    },
    nodes: [
      { id: "root", kind: "ENTRY", tone: "ENTRY", level: 0, title: "Root", fullText: "Root", ruleId: null, nodeType: null, clinicalRisk: null, timing: null, facets: null, synthetic: true, governedBranchCount: 0, detail: null },
      { id: "a", kind: "DECISION", tone: "DECISION", level: 1, title: "A", fullText: "A", ruleId: "A", nodeType: "DECISION", clinicalRisk: "LOW", timing: null, facets: null, synthetic: false, governedBranchCount: 0, detail: null },
      { id: "b", kind: "DECISION", tone: "DECISION", level: 1, title: "B", fullText: "B", ruleId: "B", nodeType: "DECISION", clinicalRisk: "LOW", timing: null, facets: null, synthetic: false, governedBranchCount: 0, detail: null },
    ] as PathwayNode[],
    edges: [
      { id: "e1", source: "root", target: "a", label: "x", showLabel: false, isSafetyOverride: false, synthetic: false },
      { id: "e2", source: "root", target: "b", label: "y", showLabel: false, isSafetyOverride: false, synthetic: false },
    ],
  };
  const layout = layoutPathwayTree(graph, measure);
  const centre = (id: string) =>
    layout.positions.get(id)!.y + layout.sizes.get(id)!.height / 2;
  assert.ok(Math.abs(centre("root") - (centre("a") + centre("b")) / 2) < 1);
});

test("layout is deterministic for the same input", async () => {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  const graph = buildPathwayGraph(snapshot, "hysterectomy-vaginal-vault");
  const first = layoutPathwayTree(graph, measure);
  const second = layoutPathwayTree(graph, measure);
  assert.equal(first.width, second.width);
  assert.equal(first.height, second.height);
  for (const [id, position] of first.positions) {
    assert.deepEqual(second.positions.get(id), position);
  }
});

test("vertical space is allocated in proportion to subtree size", async () => {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  const big = layoutPathwayTree(
    buildPathwayGraph(snapshot, "hysterectomy-vaginal-vault"),
    measure
  );
  const small = layoutPathwayTree(buildPathwayGraph(snapshot, "pregnancy"), measure);
  // 40 decisions versus 14 — the taller pathway must reserve more height.
  assert.ok(big.height > small.height * 2);
  // Width is driven by depth, which both share.
  assert.equal(big.width, small.width);
});

test("root is the single node without a parent", async () => {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  for (const summary of listPathwaySummaries(snapshot)) {
    const graph = buildPathwayGraph(snapshot, summary.key);
    const root = rootNodeId(graph);
    assert.ok(root.length > 0);
    assert.ok(!graph.edges.some((edge) => edge.target === root));
  }
});

test("nothing is laid out above or left of the padding line", async () => {
  for (const { key, layout } of await layouts()) {
    for (const [id, position] of layout.positions) {
      assert.ok(position.x >= 0, `${key}: ${id} x must be positive`);
      assert.ok(position.y >= 0, `${key}: ${id} y must be positive`);
      assert.ok(
        position.x + layout.sizes.get(id)!.width <= layout.width,
        `${key}: ${id} must fit inside the reported width`
      );
      assert.ok(
        position.y + layout.sizes.get(id)!.height <= layout.height,
        `${key}: ${id} must fit inside the reported height`
      );
    }
  }
});

test("card widths are uniform per role", async () => {
  for (const { key, graph, layout } of await layouts()) {
    for (const node of graph.nodes) {
      assert.equal(
        layout.sizes.get(node.id)!.width,
        NODE_WIDTH[node.kind],
        `${key}: ${node.id} must use the standard width for its role`
      );
    }
  }
});
