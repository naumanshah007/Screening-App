/**
 * Canonical pathway view model.
 *
 * The governed snapshot stores a four-level catalogue:
 *
 *   node:root (START)
 *     -> node:section:* (ROUTER)          15 governed sections
 *          -> node:rule:*   (DECISION)    203 governed rule conditions
 *               -> node:outcome:*         203 governed provisional outcomes
 *
 * Every `GraphView` other than `master` lists only the `rule -> outcome` pairs,
 * so a view rendered straight from `includedNodeIds` / `includedEdgeIds` is a
 * set of disconnected two-node fragments (23 fragments for Primary HPV
 * Screening, 40 for Hysterectomy) rather than a readable hierarchy.
 *
 * This module rebuilds the connected hierarchy for a view by walking the
 * governed parent edges that already exist in `snapshot.edges`. No clinical
 * relationship is invented: every edge emitted here is a governed edge, except
 * the single synthetic ENTRY node that carries the governed view title when a
 * view spans more than one governed section.
 */

import type {
  ClinicalRuleSnapshot,
  GraphEdge,
  GraphNode,
  GraphNodeType,
  GraphView,
  RuleDefinition,
  SafetyPriority,
  SourceReference,
} from "./schema";

/** Presentation role. Drives shape, weight and column placement. */
export type PathwayNodeKind = "ENTRY" | "GROUP" | "DECISION" | "OUTCOME";

/**
 * Clinical tone. Derived from the governed `visualCategory` so that the palette
 * follows clinical governance rather than a renderer-local guess.
 */
export type PathwayTone =
  | "ENTRY" // navy — pathway start / section
  | "DECISION" // teal — a governed rule condition
  | "ROUTINE" // green — return to routine screening, discharge
  | "MONITOR" // blue — repeat / timed recall
  | "REFERRAL" // indigo — specialist referral, MDM review
  | "REVIEW" // amber — clinician confirmation required
  | "URGENT"; // red — governed safety stop / override

export type PathwayNode = {
  id: string;
  kind: PathwayNodeKind;
  tone: PathwayTone;
  /** Depth from the pathway entry node. Entry = 0. */
  level: number;
  /** Short heading shown on the card. */
  title: string;
  /** Full governed wording. Shown in the detail drawer. */
  fullText: string;
  /** Governed rule id when this node is a rule condition or its outcome. */
  ruleId: string | null;
  /** Governed node type, retained for governance surfaces. */
  nodeType: GraphNodeType | null;
  clinicalRisk: SafetyPriority | null;
  /** Timing shown as a chip on outcome cards, e.g. "12 months". */
  timing: string | null;
  /**
   * Structured `label: value; label: value` conditions, split into facets.
   * The 21 Table 1 combinations differ only in their final clause, so a
   * truncated single paragraph renders four consecutive cards as identical
   * text. Rendering the facets keeps the discriminating clause visible.
   */
  facets: Array<{ label: string; value: string }> | null;
  /** True for the synthetic pathway entry node only. */
  synthetic: boolean;
  /** Number of governed outcome branches collapsed into a single node. */
  governedBranchCount: number;
  detail: PathwayNodeDetail | null;
};

export type PathwayNodeDetail = {
  section: string;
  pathwayStage: string;
  conditionExpression: RuleDefinition["conditionExpression"];
  sourceConditionText: string;
  provisionalOutcome: string;
  timingDestination: string;
  careSetting: string;
  automationBoundary: string;
  missingDataBehaviour: string;
  reviewerRequirement: string;
  safetyPriority: SafetyPriority;
  requiredFacts: string[];
  sourceReferences: SourceReference[];
  controllingSource: SourceReference;
  implementationNote: string;
  updateStatus: string;
  governedClassification: string | null;
  clinicianOnly: boolean;
  /**
   * Governed outcome branches. Eight rules carry 2-3 distinct governed
   * branches that the governed graph collapses into one outcome node; they are
   * surfaced here rather than silently dropped or silently expanded.
   */
  outcomeBranches: Array<{
    id: string;
    provisionalOutcome: string;
    timingDestination: string;
    careSetting: string;
    urgency: string | null;
    reviewerRequirement: string;
    clinicianOnly: boolean;
    sourceReferences: SourceReference[];
  }>;
};

export type PathwayEdge = {
  id: string;
  source: string;
  target: string;
  /** Governed edge label. */
  label: string;
  /**
   * Whether the label carries information a reader needs on the canvas.
   * The 203 `rule -> outcome` edges all read "Source condition met", so the
   * label is suppressed on the canvas and surfaced in the drawer instead.
   */
  showLabel: boolean;
  isSafetyOverride: boolean;
  synthetic: boolean;
};

export type PathwayGraph = {
  key: string;
  title: string;
  description: string;
  viewType: GraphView["viewType"];
  displayOrder: number;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  /** Governed section titles this view draws from. */
  sections: string[];
  counts: {
    decisions: number;
    outcomes: number;
    urgent: number;
    review: number;
    /** Governed nodes in the view definition, for governance parity checks. */
    governedNodes: number;
    governedEdges: number;
  };
  annotations: string[];
};

export type PathwaySummary = {
  key: string;
  title: string;
  /** Plain-language purpose, taken from the governed view description. */
  description: string;
  viewType: GraphView["viewType"];
  displayOrder: number;
  decisions: number;
  outcomes: number;
  urgent: number;
  review: number;
  sections: string[];
  /** Governed rule ids covered, used for search and for case-review linking. */
  ruleIds: string[];
};

const TONE_BY_NODE_TYPE: Record<GraphNodeType, PathwayTone> = {
  START: "ENTRY",
  ROUTER: "ENTRY",
  DECISION: "DECISION",
  ACTION: "MONITOR",
  REPEAT_TIMER: "MONITOR",
  SAFETY_STOP: "URGENT",
  CLINICIAN_REVIEW: "REVIEW",
  MDM_REVIEW: "REFERRAL",
  SPECIALIST_REFERRAL: "REFERRAL",
  SUBFLOW_LINK: "REFERRAL",
  TERMINAL: "ROUTINE",
  INFORMATION: "REVIEW",
};

const KIND_BY_NODE_TYPE: Record<GraphNodeType, PathwayNodeKind> = {
  START: "ENTRY",
  ROUTER: "GROUP",
  DECISION: "DECISION",
  ACTION: "OUTCOME",
  REPEAT_TIMER: "OUTCOME",
  SAFETY_STOP: "OUTCOME",
  CLINICIAN_REVIEW: "OUTCOME",
  MDM_REVIEW: "OUTCOME",
  SPECIALIST_REFERRAL: "OUTCOME",
  SUBFLOW_LINK: "OUTCOME",
  TERMINAL: "OUTCOME",
  INFORMATION: "OUTCOME",
};

export const PATHWAY_ENTRY_ID = "pathway:entry";

/** The governed edge label carried by every rule -> outcome connector. */
const UNIFORM_OUTCOME_EDGE_LABEL = "Source condition met";

function ruleIdForNode(node: GraphNode): string | null {
  if (node.linkedRuleIds.length === 1) return node.linkedRuleIds[0];
  return null;
}

/**
 * Trims a governed sentence to a card-sized heading without changing wording.
 * Full text always remains available on the node and in the drawer.
 */
export function cardTitle(text: string, limit = 104): string {
  const clean = text.trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(";"), cut.lastIndexOf(","));
  return `${(lastBreak > limit * 0.6 ? cut.slice(0, lastBreak) : cut).trimEnd()}…`;
}

const FACET_PATTERN = /^\s*([A-Za-z][A-Za-z /()-]{2,24}):\s*(.+)$/;

/**
 * Splits `Prior history: …; indication: …; specimen: …` into facets. Returns
 * null unless every semicolon-separated segment matches, so ordinary prose
 * containing a colon is left alone.
 */
export function splitFacets(text: string): Array<{ label: string; value: string }> | null {
  const segments = text.split(";");
  if (segments.length < 2) return null;
  const facets: Array<{ label: string; value: string }> = [];
  for (const segment of segments) {
    const match = FACET_PATTERN.exec(segment);
    if (!match) return null;
    const label = match[1].trim();
    facets.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value: match[2].trim(),
    });
  }
  return facets;
}

function timingFor(rule: RuleDefinition | undefined, node: GraphNode): string | null {
  const raw = node.timingDestination ?? rule?.timingDestination ?? "";
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "as specified by outcome") return null;
  return trimmed;
}

function detailFor(rule: RuleDefinition | undefined): PathwayNodeDetail | null {
  if (!rule) return null;
  return {
    section: rule.section,
    pathwayStage: rule.pathwayStage,
    conditionExpression: structuredClone(rule.conditionExpression),
    sourceConditionText: rule.sourceConditionText,
    provisionalOutcome: rule.provisionalOutcome,
    timingDestination: rule.timingDestination,
    careSetting: rule.careSetting,
    automationBoundary: rule.automationBoundary,
    missingDataBehaviour: rule.missingDataBehaviour,
    reviewerRequirement: rule.reviewerRequirement,
    safetyPriority: rule.safetyPriority,
    requiredFacts: [...rule.requiredFacts],
    sourceReferences: rule.sourceReferences.map((reference) => ({ ...reference })),
    controllingSource: { ...rule.sourceReferences[0] },
    implementationNote: rule.implementationNote,
    updateStatus: rule.updateStatus,
    governedClassification: rule.governedClassification ?? null,
    clinicianOnly: rule.clinicianOnly ?? false,
    outcomeBranches: (rule.outcomeBranches ?? []).map((branch) => ({
      id: branch.id,
      provisionalOutcome: branch.provisionalOutcome,
      timingDestination: branch.timingDestination,
      careSetting: branch.careSetting,
      urgency: branch.urgency ?? null,
      reviewerRequirement: branch.reviewerRequirement,
      clinicianOnly: branch.clinicianOnly,
      sourceReferences: branch.sourceReferences.map((reference) => ({ ...reference })),
    })),
  };
}

type SnapshotIndex = {
  nodes: Map<string, GraphNode>;
  rules: Map<string, RuleDefinition>;
  parentEdgeOf: Map<string, GraphEdge>;
};

function indexSnapshot(snapshot: ClinicalRuleSnapshot): SnapshotIndex {
  const nodes = new Map(snapshot.nodes.map((node) => [node.stableNodeId, node]));
  const rules = new Map(snapshot.rules.map((rule) => [rule.stableRuleId, rule]));
  const parentEdgeOf = new Map<string, GraphEdge>();
  for (const edge of snapshot.edges) {
    // The governed graph is a tree: every node has at most one parent edge.
    if (!parentEdgeOf.has(edge.toNodeId)) parentEdgeOf.set(edge.toNodeId, edge);
  }
  return { nodes, rules, parentEdgeOf };
}

/**
 * Rebuilds a view as a connected hierarchy.
 *
 * Every node in `view.includedNodeIds` is kept, and each one is reconnected to
 * its governed ancestors so the result is a single tree rooted at one entry
 * node.
 */
export function buildPathwayGraph(
  snapshot: ClinicalRuleSnapshot,
  viewKey: string
): PathwayGraph {
  const view = snapshot.views.find((candidate) => candidate.key === viewKey);
  if (!view) throw new Error(`Unknown governed pathway view: ${viewKey}`);
  const index = indexSnapshot(snapshot);

  // 1. Collect the governed closure: every included node plus its ancestors.
  const closure = new Set<string>();
  for (const nodeId of view.includedNodeIds) {
    let cursor: string | undefined = nodeId;
    while (cursor && !closure.has(cursor)) {
      closure.add(cursor);
      cursor = index.parentEdgeOf.get(cursor)?.fromNodeId;
    }
  }

  // 2. Governed edges wholly inside the closure. These are the only clinical
  //    relationships drawn.
  const governedEdges = snapshot.edges.filter(
    (edge) => closure.has(edge.fromNodeId) && closure.has(edge.toNodeId)
  );

  // 3. A view that pulls from several governed sections has several roots once
  //    `node:root` is trimmed away, so it gets one synthetic entry node holding
  //    the governed view title. A single-section view is already a tree.
  const isMaster = view.viewType === "MASTER";
  // For non-master views the global `node:root` adds a level without adding
  // meaning, so it is replaced by the pathway entry node.
  const trimGlobalRoot = !isMaster && closure.has("node:root");
  const visible = new Set(closure);
  if (trimGlobalRoot) visible.delete("node:root");

  const topLevel = [...visible].filter((id) => {
    const parent = index.parentEdgeOf.get(id)?.fromNodeId;
    return !parent || !visible.has(parent);
  });

  const needsSyntheticEntry = !isMaster;
  const nodes: PathwayNode[] = [];
  const edges: PathwayEdge[] = [];

  if (needsSyntheticEntry) {
    nodes.push({
      id: PATHWAY_ENTRY_ID,
      kind: "ENTRY",
      tone: "ENTRY",
      level: 0,
      title: view.title,
      fullText: view.description,
      ruleId: null,
      nodeType: null,
      clinicalRisk: null,
      timing: null,
      facets: null,
      synthetic: true,
      governedBranchCount: 0,
      detail: null,
    });
  }

  // 4. Emit governed nodes in governed order.
  //
  // Order is walked breadth-first from the top-level nodes, following
  // `snapshot.edges` in its stored sequence. Sorting by id instead would put
  // Figure 10 before Figure 2 and F3-10 before F3-02, which misrepresents the
  // clinical sequence.
  const childrenInGovernedOrder = new Map<string, string[]>();
  for (const edge of governedEdges) {
    if (!visible.has(edge.fromNodeId) || !visible.has(edge.toNodeId)) continue;
    const list = childrenInGovernedOrder.get(edge.fromNodeId);
    if (list) list.push(edge.toNodeId);
    else childrenInGovernedOrder.set(edge.fromNodeId, [edge.toNodeId]);
  }

  const levelOf = new Map<string, number>();
  const orderedIds: string[] = [];
  const queued = new Set<string>();
  const queue = [...topLevel];
  for (const id of queue) queued.add(id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    orderedIds.push(id);
    for (const child of childrenInGovernedOrder.get(id) ?? []) {
      if (queued.has(child)) continue;
      queued.add(child);
      queue.push(child);
    }
  }
  // Anything unreachable from a top-level node (should not occur) still emits.
  for (const id of visible) if (!queued.has(id)) orderedIds.push(id);

  for (const id of orderedIds) {
    const node = index.nodes.get(id);
    if (!node) continue;
    const parentId = index.parentEdgeOf.get(id)?.fromNodeId;
    const parentLevel =
      parentId && visible.has(parentId) ? levelOf.get(parentId) ?? 0 : needsSyntheticEntry ? 0 : -1;
    const level = parentLevel + 1;
    levelOf.set(id, level);

    const ruleId = ruleIdForNode(node);
    const rule = ruleId ? index.rules.get(ruleId) : undefined;
    const kind = KIND_BY_NODE_TYPE[node.nodeType];
    const sourceText = node.shortLabel || node.label;
    const facets = kind === "DECISION" ? splitFacets(sourceText) : null;
    nodes.push({
      id,
      kind,
      tone: TONE_BY_NODE_TYPE[node.nodeType],
      level,
      title: cardTitle(sourceText),
      facets,
      fullText: node.label,
      ruleId,
      nodeType: node.nodeType,
      clinicalRisk: node.clinicalRisk,
      timing: kind === "OUTCOME" ? timingFor(rule, node) : null,
      synthetic: false,
      governedBranchCount: rule?.outcomeBranches?.length ?? 0,
      detail: detailFor(rule),
    });
  }

  // 5. Emit governed edges, then attach orphan top-level nodes to the entry.
  //
  // A label earns canvas space only when it says something the target card does
  // not already say. In this dataset it never does: `rule -> outcome` edges all
  // read "Source condition met", `section -> rule` edges carry the rule id, and
  // `root -> section` edges carry the section title. The governed label is kept
  // on the edge and surfaced on the highlighted path and in the drawer instead
  // of being stamped 203 times across the canvas.
  for (const edge of governedEdges) {
    if (!visible.has(edge.fromNodeId) || !visible.has(edge.toNodeId)) continue;
    const target = index.nodes.get(edge.toNodeId);
    const duplicatesTarget =
      edge.label === UNIFORM_OUTCOME_EDGE_LABEL ||
      edge.label === target?.shortLabel ||
      (target ? ruleIdForNode(target) === edge.label : false);
    edges.push({
      id: edge.stableEdgeId,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      label: edge.label,
      showLabel: !duplicatesTarget,
      isSafetyOverride: edge.isSafetyOverride,
      synthetic: false,
    });
  }

  if (needsSyntheticEntry) {
    for (const id of topLevel) {
      const node = index.nodes.get(id);
      if (!node) continue;
      edges.push({
        id: `synthetic:${PATHWAY_ENTRY_ID}->${id}`,
        // The governed section title, when the child is a section router.
        label: node.nodeType === "ROUTER" ? node.shortLabel : view.title,
        source: PATHWAY_ENTRY_ID,
        target: id,
        showLabel: false,
        isSafetyOverride: false,
        synthetic: true,
      });
    }
  }

  const sections = [...visible]
    .map((id) => index.nodes.get(id))
    .filter((node): node is GraphNode => Boolean(node) && node!.nodeType === "ROUTER")
    .map((node) => node.shortLabel);

  const decisions = nodes.filter((node) => node.kind === "DECISION");
  const outcomes = nodes.filter((node) => node.kind === "OUTCOME");

  return {
    key: view.key,
    title: view.title,
    description: view.description,
    viewType: view.viewType,
    displayOrder: view.displayOrder,
    nodes,
    edges,
    sections: [...new Set(sections)],
    counts: {
      decisions: decisions.length,
      outcomes: outcomes.length,
      urgent: outcomes.filter((node) => node.tone === "URGENT").length,
      review: outcomes.filter((node) => node.tone === "REVIEW").length,
      governedNodes: view.includedNodeIds.length,
      governedEdges: view.includedEdgeIds.length,
    },
    annotations: [...(view.annotations ?? [])],
  };
}

/** Cards for the Guidelines home page, ordered as governance orders them. */
export function listPathwaySummaries(snapshot: ClinicalRuleSnapshot): PathwaySummary[] {
  const index = indexSnapshot(snapshot);
  return [...snapshot.views]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((view) => {
      const included = view.includedNodeIds
        .map((id) => index.nodes.get(id))
        .filter((node): node is GraphNode => Boolean(node));
      const decisions = included.filter((node) => node.nodeType === "DECISION");
      const outcomes = included.filter(
        (node) => KIND_BY_NODE_TYPE[node.nodeType] === "OUTCOME"
      );
      const sections = new Set<string>();
      for (const node of decisions) {
        const parent = index.parentEdgeOf.get(node.stableNodeId)?.fromNodeId;
        const parentNode = parent ? index.nodes.get(parent) : undefined;
        if (parentNode?.nodeType === "ROUTER") sections.add(parentNode.shortLabel);
      }
      return {
        key: view.key,
        title: view.title,
        description: view.description,
        viewType: view.viewType,
        displayOrder: view.displayOrder,
        decisions: decisions.length,
        outcomes: outcomes.length,
        urgent: outcomes.filter((node) => TONE_BY_NODE_TYPE[node.nodeType] === "URGENT").length,
        review: outcomes.filter((node) => TONE_BY_NODE_TYPE[node.nodeType] === "REVIEW").length,
        sections: [...sections],
        ruleIds: decisions.flatMap((node) => node.linkedRuleIds),
      };
    });
}

/**
 * The clinical pathway view that best explains a rule, used to open Case Review
 * on the right diagram. Prefers a specific PATHWAY/OVERLAY view over the
 * 203-rule master map.
 */
export function findPathwayForRule(
  snapshot: ClinicalRuleSnapshot,
  ruleId: string
): string | null {
  const nodeIds = new Set(
    snapshot.nodes
      .filter((node) => node.linkedRuleIds.includes(ruleId))
      .map((node) => node.stableNodeId)
  );
  if (nodeIds.size === 0) return null;
  const candidates = [...snapshot.views]
    .filter((view) => view.viewType !== "MASTER")
    .sort((a, b) => a.displayOrder - b.displayOrder);
  for (const view of candidates) {
    if (view.includedNodeIds.some((id) => nodeIds.has(id))) return view.key;
  }
  const master = snapshot.views.find((view) => view.viewType === "MASTER");
  return master?.key ?? null;
}

/** Root-to-node path, used to highlight how the guideline reached an outcome. */
export function pathToNode(graph: PathwayGraph, nodeId: string): string[] {
  const parentOf = new Map<string, string>();
  for (const edge of graph.edges) {
    if (!parentOf.has(edge.target)) parentOf.set(edge.target, edge.source);
  }
  const chain: string[] = [];
  const guard = new Set<string>();
  let cursor: string | undefined = nodeId;
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    chain.unshift(cursor);
    cursor = parentOf.get(cursor);
  }
  return chain;
}

/** Every node reachable from `nodeId`, used to highlight downstream outcomes. */
export function descendantsOf(graph: PathwayGraph, nodeId: string): string[] {
  const children = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = children.get(edge.source);
    if (list) list.push(edge.target);
    else children.set(edge.source, [edge.target]);
  }
  const out: string[] = [];
  const stack = [...(children.get(nodeId) ?? [])];
  const seen = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    out.push(current);
    stack.push(...(children.get(current) ?? []));
  }
  return out;
}

/** Edge ids on the path between consecutive nodes of `chain`. */
export function edgeIdsForChain(graph: PathwayGraph, chain: string[]): Set<string> {
  const wanted = new Set<string>();
  for (let i = 0; i < chain.length - 1; i += 1) {
    const edge = graph.edges.find(
      (candidate) => candidate.source === chain[i] && candidate.target === chain[i + 1]
    );
    if (edge) wanted.add(edge.id);
  }
  return wanted;
}

/** Case-insensitive search across governed clinical wording and rule ids. */
export function searchPathwayNodes(graph: PathwayGraph, query: string): Set<string> {
  const needle = query.trim().toLowerCase();
  if (!needle) return new Set();
  const hits = new Set<string>();
  for (const node of graph.nodes) {
    const haystack = [
      node.title,
      node.fullText,
      node.ruleId ?? "",
      node.detail?.provisionalOutcome ?? "",
      node.detail?.sourceConditionText ?? "",
      node.detail?.pathwayStage ?? "",
      node.detail?.section ?? "",
      node.timing ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (haystack.includes(needle)) hits.add(node.id);
  }
  return hits;
}
