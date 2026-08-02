import { deterministicJson } from "./checksum";
import type {
  ClinicalRuleSnapshot,
  GraphEdge,
  GraphNode,
  RuleDefinition,
} from "./schema";

type ChangedField = {
  field: string;
  before: unknown;
  after: unknown;
};

function changedFields<T extends object>(before: T, after: T, ignored: string[] = []) {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: ChangedField[] = [];
  for (const field of fields) {
    if (ignored.includes(field)) continue;
    const beforeValue = (before as Record<string, unknown>)[field];
    const afterValue = (after as Record<string, unknown>)[field];
    if (deterministicJson(beforeValue) !== deterministicJson(afterValue)) {
      changes.push({ field, before: beforeValue, after: afterValue });
    }
  }
  return changes;
}

function collectionDiff<T extends object>(
  before: T[],
  after: T[],
  id: (item: T) => string,
  ignored: string[] = []
) {
  const beforeMap = new Map(before.map((item) => [id(item), item]));
  const afterMap = new Map(after.map((item) => [id(item), item]));
  const added = after.filter((item) => !beforeMap.has(id(item)));
  const removed = before.filter((item) => !afterMap.has(id(item)));
  const changed = after.flatMap((item) => {
    const previous = beforeMap.get(id(item));
    if (!previous) return [];
    const fields = changedFields(previous, item, ignored);
    return fields.length ? [{ id: id(item), fields }] : [];
  });
  return { added, removed, changed };
}

export function diffClinicalRuleSnapshots(
  before: ClinicalRuleSnapshot,
  after: ClinicalRuleSnapshot
) {
  const rules = collectionDiff<RuleDefinition>(
    before.rules,
    after.rules,
    (rule) => rule.stableRuleId
  );
  const nodes = collectionDiff<GraphNode>(
    before.nodes,
    after.nodes,
    (node) => node.stableNodeId
  );
  const edges = collectionDiff<GraphEdge>(
    before.edges,
    after.edges,
    (edge) => edge.stableEdgeId
  );
  const views = collectionDiff(before.views, after.views, (view) => view.key, ["layout"]);
  const layoutChanges = after.views.flatMap((view) => {
    const previous = before.views.find((candidate) => candidate.key === view.key);
    if (!previous || deterministicJson(previous.layout) === deterministicJson(view.layout)) return [];
    return [{ viewKey: view.key, before: previous.layout, after: view.layout }];
  });

  const changedRuleFields = new Set(rules.changed.flatMap((rule) => rule.fields.map((field) => field.field)));
  const clinicalFields = [
    "conditionExpression",
    "requiredFacts",
    "missingDataBehaviour",
    "provisionalOutcome",
    "timingDestination",
    "reviewerRequirement",
    "safetyPriority",
  ];
  const sourceFields = ["sourceReferences", "sourceConditionText"];
  return {
    summary: {
      rulesAdded: rules.added.length,
      rulesRemoved: rules.removed.length,
      rulesChanged: rules.changed.length,
      nodesAdded: nodes.added.length,
      nodesRemoved: nodes.removed.length,
      nodesChanged: nodes.changed.length,
      edgesAdded: edges.added.length,
      edgesRemoved: edges.removed.length,
      edgesChanged: edges.changed.length,
      viewsChanged: views.changed.length,
      layoutViewsChanged: layoutChanges.length,
      hasClinicalLogicChanges: clinicalFields.some((field) => changedRuleFields.has(field)),
      hasSourceChanges: sourceFields.some((field) => changedRuleFields.has(field)),
      layoutOnly:
        layoutChanges.length > 0 &&
        rules.added.length === 0 &&
        rules.removed.length === 0 &&
        rules.changed.length === 0 &&
        nodes.added.length === 0 &&
        nodes.removed.length === 0 &&
        nodes.changed.length === 0 &&
        edges.added.length === 0 &&
        edges.removed.length === 0 &&
        edges.changed.length === 0 &&
        views.changed.length === 0,
    },
    rules,
    nodes,
    edges,
    views,
    layoutChanges,
  };
}
