/**
 * Deterministic tidy-tree layout for governed pathway graphs.
 *
 * `buildPathwayGraph` guarantees a single connected tree, so a general graph
 * layout engine is not needed and actively hurts: the previous studio ran ELK
 * `layered` with `separateConnectedComponents` + `PACKED_RECT`, which packed the
 * view's disconnected rule/outcome fragments into a rectangle and produced the
 * scattered, mostly-empty canvases this replaces.
 *
 * A tidy tree gives properties a general engine cannot promise here:
 *   - zero edge crossings, structurally;
 *   - every node at a given depth sharing one x column;
 *   - vertical space allocated in proportion to subtree size;
 *   - stable output for the same input, so layout is unit-testable.
 *
 * Flow is left-to-right. The governed views are wide and shallow (depth 3, up
 * to 40 siblings), so columns of decisions read as a clinical list while
 * top-to-bottom would produce a canvas ~11,000px wide for one pathway.
 */

import type { PathwayGraph, PathwayNode, PathwayNodeKind } from "./pathway-view-model";

export type NodeSize = { width: number; height: number };
export type NodePosition = { x: number; y: number };

export type PathwayLayout = {
  positions: Map<string, NodePosition>;
  sizes: Map<string, NodeSize>;
  /** Left edge of each depth column, so headers can align to the graph. */
  columnX: number[];
  width: number;
  height: number;
};

export type LayoutOptions = {
  /** Horizontal gap between depth columns. */
  columnGap?: number;
  /** Vertical gap between siblings sharing a parent. */
  siblingGap?: number;
  /**
   * Extra vertical gap between top-level branches (the governed sections), so
   * sections read as separate lanes rather than one undifferentiated stack.
   */
  branchGap?: number;
  padding?: number;
  /**
   * When the distance between a parent's first and last child exceeds this,
   * the parent is aligned to its first child instead of centred.
   */
  topAlignSpan?: number;
};

const DEFAULTS = {
  columnGap: 48,
  siblingGap: 18,
  branchGap: 38,
  padding: 32,
  /**
   * A parent whose children span more than this reads better as a heading above
   * its list than as a node centred halfway down a 2,700px column, where it is
   * off-screen for most of the scroll. Tight fan-outs keep the centred
   * org-chart look. Measured on the span, not the child count: a pathway entry
   * with two sections can still span the whole diagram.
   */
  topAlignSpan: 320,
} satisfies Required<LayoutOptions>;

/**
 * Uniform card widths per role. Fixed widths are deliberate: varying widths by
 * text length is what made the previous graphs look unbalanced.
 */
export const NODE_WIDTH: Record<PathwayNodeKind, number> = {
  // Entry and section cards carry short labels, so they are narrower: the
  // clinical text columns should own the horizontal budget.
  ENTRY: 176,
  GROUP: 168,
  DECISION: 324,
  OUTCOME: 324,
};

/** Card heights are driven by wrapped text, so they are measured, not assumed. */
export const NODE_HEIGHT_BOUNDS: Record<PathwayNodeKind, { min: number; max: number }> = {
  ENTRY: { min: 86, max: 132 },
  GROUP: { min: 64, max: 96 },
  DECISION: { min: 84, max: 148 },
  OUTCOME: { min: 84, max: 156 },
};

export function rootNodeId(graph: PathwayGraph): string {
  const hasParent = new Set(graph.edges.map((edge) => edge.target));
  const root = graph.nodes.find((node) => !hasParent.has(node.id));
  return root?.id ?? graph.nodes[0]?.id ?? "";
}

function childrenIndex(graph: PathwayGraph): Map<string, string[]> {
  const order = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const children = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = children.get(edge.source);
    if (list) list.push(edge.target);
    else children.set(edge.source, [edge.target]);
  }
  // Governed order: nodes are emitted in governed edge order, so sorting by
  // emission index preserves the rule sequence (F3-01, F3-02, …).
  for (const list of children.values()) {
    list.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  }
  return children;
}

export function layoutPathwayTree(
  graph: PathwayGraph,
  measure: (node: PathwayNode) => NodeSize,
  options: LayoutOptions = {}
): PathwayLayout {
  const { columnGap, siblingGap, branchGap, padding, topAlignSpan } = {
    ...DEFAULTS,
    ...options,
  };
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const children = childrenIndex(graph);
  const root = rootNodeId(graph);

  const sizes = new Map<string, NodeSize>();
  for (const node of graph.nodes) sizes.set(node.id, measure(node));

  // Column x positions: one column per depth, width = widest card in it.
  const maxLevel = graph.nodes.reduce((max, node) => Math.max(max, node.level), 0);
  const columnWidth: number[] = Array.from({ length: maxLevel + 1 }, () => 0);
  for (const node of graph.nodes) {
    columnWidth[node.level] = Math.max(columnWidth[node.level], sizes.get(node.id)!.width);
  }
  const columnX: number[] = [];
  let cursorX = padding;
  for (let level = 0; level <= maxLevel; level += 1) {
    columnX.push(cursorX);
    cursorX += columnWidth[level] + columnGap;
  }

  const gapBelow = (parentId: string) =>
    parentId === root ? Math.max(siblingGap, branchGap) : siblingGap;

  // Phase 1 — bottom-up: vertical space each subtree needs.
  const blockHeight = new Map<string, number>();
  const computeBlock = (id: string): number => {
    const cached = blockHeight.get(id);
    if (cached !== undefined) return cached;
    const own = sizes.get(id)?.height ?? 0;
    const kids = children.get(id) ?? [];
    let total = own;
    if (kids.length > 0) {
      const gap = gapBelow(id);
      let sum = 0;
      for (const kid of kids) sum += computeBlock(kid);
      sum += gap * (kids.length - 1);
      total = Math.max(own, sum);
    }
    blockHeight.set(id, total);
    return total;
  };
  computeBlock(root);

  // Phase 2 — top-down: assign each subtree its band, centre parents on children.
  const positions = new Map<string, NodePosition>();
  const centreY = new Map<string, number>();

  const place = (id: string, top: number) => {
    const node = nodeById.get(id);
    const size = sizes.get(id)!;
    const block = blockHeight.get(id) ?? size.height;
    const kids = children.get(id) ?? [];

    if (kids.length === 0) {
      const centre = top + block / 2;
      centreY.set(id, centre);
      positions.set(id, {
        x: columnX[node?.level ?? 0],
        y: centre - size.height / 2,
      });
      return;
    }

    const gap = gapBelow(id);
    const kidsTotal =
      kids.reduce((sum, kid) => sum + (blockHeight.get(kid) ?? 0), 0) + gap * (kids.length - 1);
    // Centre the children inside this subtree's band when the parent card is
    // taller than its children need.
    let cursor = top + Math.max(0, (block - kidsTotal) / 2);
    for (const kid of kids) {
      place(kid, cursor);
      cursor += (blockHeight.get(kid) ?? 0) + gap;
    }

    const first = centreY.get(kids[0])!;
    const last = centreY.get(kids[kids.length - 1])!;
    // Long lists get a heading-style parent aligned to the first child; tight
    // fan-outs stay centred between first and last.
    const centre = last - first > topAlignSpan ? first : (first + last) / 2;
    centreY.set(id, centre);
    positions.set(id, {
      x: columnX[node?.level ?? 0],
      y: centre - size.height / 2,
    });
  };

  place(root, padding);

  // Normalise so nothing sits above the padding line.
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [id, position] of positions) {
    minY = Math.min(minY, position.y);
    maxY = Math.max(maxY, position.y + (sizes.get(id)?.height ?? 0));
  }
  const shift = Number.isFinite(minY) ? padding - minY : 0;
  if (shift !== 0) {
    for (const position of positions.values()) position.y += shift;
    maxY += shift;
  }

  return {
    positions,
    sizes,
    columnX,
    width: cursorX - columnGap + padding,
    height: (Number.isFinite(maxY) ? maxY : 0) + padding,
  };
}

/**
 * Text measurement shared by the renderer and the layout, so a card's height
 * always matches the text it actually shows.
 */
export function estimateWrappedLines(
  text: string,
  availableWidth: number,
  averageCharWidth: number,
  maxLines: number
): number {
  if (!text) return 1;
  const perLine = Math.max(8, Math.floor(availableWidth / averageCharWidth));
  return Math.min(maxLines, Math.max(1, Math.ceil(text.length / perLine)));
}
