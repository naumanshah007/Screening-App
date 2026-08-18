/**
 * THIN VERTICAL ARCHITECTURE PROOF — direct interpreter + triage compiler.
 *
 * evaluateRuleGraph walks the pathway graph over a CanonicalClinicalState
 * directly. It does NOT compile, and it does NOT call evaluateCaseRuleRelease.
 * That independence is the point: it is the oracle the compiler is tested
 * against, so a compiler bug cannot hide behind a shared implementation.
 */

import type { CaseRuleDefinition, CaseRuleReleaseDefinition } from "../../../lib/cases/rule-policy";
import {
  EXECUTION_POLICY,
  fieldValue,
  type CanonicalClinicalState,
  type ClinicalAction,
  type AutomationBoundary,
  type Edge,
  type PathwayGraph,
  type Pipeline,
  type Predicate,
  type SourceProvenance,
  type TriageOverlay,
} from "./model";

// ─────────────────────────────────────────────────────────────────────────────
// DIRECT GRAPH INTERPRETER
// ─────────────────────────────────────────────────────────────────────────────

export type GraphResult = {
  terminalNodeId: string;
  action: ClinicalAction;
  boundary: AutomationBoundary;
  appliesTo: Pipeline[];
  provenance: SourceProvenance;
  nodePath: string[];
  edgePath: string[];
  /** What the runtime is permitted to do with this result. */
  policy: (typeof EXECUTION_POLICY)[AutomationBoundary];
};

function holds(p: Predicate, state: CanonicalClinicalState): boolean {
  switch (p.kind) {
    case "otherwise":
      return true;
    case "factPresent":
      return state.facts[p.fact] === true;
    case "factAbsent":
      return state.facts[p.fact] !== true;
    case "fieldMissing": {
      const f = state.fields[p.field];
      return f.status === "missing" || f.status === "notPerformed";
    }
    case "fieldKnown":
      return state.fields[p.field].status === "known";
    case "fieldConflicted":
      return state.fields[p.field].status === "conflicted";
    case "fieldEquals":
      return fieldValue(state.fields[p.field]) === p.value;
    case "fieldIn": {
      const v = fieldValue(state.fields[p.field]);
      return v !== undefined && p.values.includes(v as string);
    }
  }
}

export function evaluateRuleGraph(
  graph: PathwayGraph,
  state: CanonicalClinicalState
): GraphResult {
  if (state.schemaVersion !== graph.canonicalStateSchemaVersion) {
    throw new Error(
      `Canonical state schema mismatch: graph expects ${graph.canonicalStateSchemaVersion}, got ${state.schemaVersion}`
    );
  }

  const outgoing = (nodeId: string): Edge[] =>
    Object.values(graph.edges)
      .filter((e) => e.from === nodeId)
      .sort((a, b) => a.priority - b.priority);

  const nodePath: string[] = [];
  const edgePath: string[] = [];
  let currentId = graph.rootId;
  let guard = 0;

  for (;;) {
    if (guard++ > 1000) throw new Error("cycle detected while interpreting graph");
    const node = graph.nodes[currentId];
    if (!node) throw new Error(`unknown node ${currentId}`);
    nodePath.push(node.id);

    if (node.kind === "terminal") {
      return {
        terminalNodeId: node.id,
        action: node.action,
        boundary: node.boundary,
        appliesTo: node.appliesTo,
        provenance: node.provenance,
        nodePath,
        edgePath,
        policy: EXECUTION_POLICY[node.boundary],
      };
    }

    const edges = outgoing(node.id);
    const taken = edges.find((e) => holds(e.predicate, state));
    if (!taken) {
      // Branch totality violation — every decision must have a reachable
      // otherwise. The validator catches this statically; this is the runtime
      // backstop so a case can never leak silently.
      throw new Error(`branch totality violated at ${node.id}: no edge matched`);
    }
    edgePath.push(taken.id);
    currentId = taken.to;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIAGE COMPILER — compiles ONLY the referral terminals, for ONE pipeline
// ─────────────────────────────────────────────────────────────────────────────

export type CompiledRule = CaseRuleDefinition & {
  provenance: {
    compiledRuleInstanceId: string;
    terminalNodeId: string;
    nodePath: string[];
    edgePath: string[];
    sourceRuleIds: string[];
    sourceVersion: string;
    controllingAddendumRuleIds?: string[];
    localOverlayRuleIds: string[];
    localPolicyVersion: string;
    compilerVersion: string;
  };
};

export const COMPILER_VERSION = "vertical-proof-1.0.0";

/** Canonical-state predicate → flat fact labels the current evaluator understands. */
const FIELD_LABELS: Record<string, Record<string, string>> = {
  hpvResult: {
    NOT_DETECTED: "HPV Not Detected",
    HPV_16_18: "HPV 16/18",
    HPV_OTHER: "HPV Other",
  },
  cytologyResult: {
    NEGATIVE: "Normal cytology",
    ASC_US: "ASC-US",
    LSIL: "LSIL",
    ASC_H: "ASC-H",
    HSIL: "HSIL",
    SCC: "Cancer suspicion cytology",
  },
  repeatStage: {
    SECOND_REPEAT: "Second HPV positive result",
  },
};

const FACT_LABELS: Record<string, string> = {
  normalColposcopy: "Previous normal colposcopy",
  immunocompromised: "Immune deficient",
};

type PathCondition = { all: string[]; any: string[][]; absent: string[] };

function applyToCondition(acc: PathCondition, p: Predicate): PathCondition {
  switch (p.kind) {
    case "otherwise":
    case "fieldKnown":
    case "fieldConflicted":
      return acc;
    case "factPresent":
      return { ...acc, all: [...acc.all, FACT_LABELS[p.fact]] };
    case "factAbsent":
      return { ...acc, absent: [...acc.absent, FACT_LABELS[p.fact]] };
    case "fieldEquals": {
      const label = FIELD_LABELS[p.field]?.[p.value];
      return label ? { ...acc, all: [...acc.all, label] } : acc;
    }
    case "fieldIn": {
      const labels = p.values.map((v) => FIELD_LABELS[p.field]?.[v]).filter(Boolean) as string[];
      if (labels.length === 0) return acc;
      return labels.length === 1
        ? { ...acc, all: [...acc.all, labels[0]] }
        : { ...acc, any: [...acc.any, labels] };
    }
    case "fieldMissing": {
      // Every value of the field absent — the §4.4 correction.
      const labels = Object.values(FIELD_LABELS[p.field] ?? {});
      return { ...acc, absent: [...acc.absent, ...labels] };
    }
  }
}

export type CompileReport = {
  rules: CompiledRule[];
  /** Terminals deliberately NOT compiled, with the reason. */
  excluded: Array<{ terminalNodeId: string; reason: string; boundary: AutomationBoundary }>;
};

/**
 * Overlay totality — the same branch-local-fallback rule that applies to graph
 * siblings applies to overlay entries. Every compilable referral terminal must
 * have exactly one unrefined fallback entry, or some state reaching that
 * terminal compiles to nothing and silently falls through to the default.
 *
 * This exists because the direct-vs-compiled differential test found precisely
 * that gap on terminal nd_f4_t04.
 */
export function validateOverlayCoverage(args: {
  graph: PathwayGraph;
  overlay: TriageOverlay;
  pipeline: Pipeline;
}): Array<{ terminalNodeId: string; problem: string }> {
  const problems: Array<{ terminalNodeId: string; problem: string }> = [];

  for (const node of Object.values(args.graph.nodes)) {
    if (node.kind !== "terminal") continue;
    if (node.action.kind !== "referral") continue;
    if (!EXECUTION_POLICY[node.boundary].compilable) continue;
    if (!node.appliesTo.includes(args.pipeline)) continue;

    const entries = args.overlay.entries.filter((e) => e.terminalNodeId === node.id);
    if (entries.length === 0) {
      problems.push({ terminalNodeId: node.id, problem: "no overlay entry prices this referral" });
      continue;
    }
    const fallbacks = entries.filter((e) => !e.refine || e.refine.length === 0);
    if (fallbacks.length === 0) {
      problems.push({
        terminalNodeId: node.id,
        problem: `all ${entries.length} overlay entries are refined; no branch-local fallback, so some states compile to nothing`,
      });
    } else if (fallbacks.length > 1) {
      problems.push({
        terminalNodeId: node.id,
        problem: `${fallbacks.length} unrefined fallback entries — ambiguous`,
      });
    }
  }

  return problems;
}

export function compileTriage(args: {
  graph: PathwayGraph;
  overlay: TriageOverlay;
  pipeline: Pipeline;
  releaseId: string;
}): CompileReport {
  const { graph, overlay, pipeline, releaseId } = args;
  const rules: CompiledRule[] = [];
  const excluded: CompileReport["excluded"] = [];
  let expansionIndex = 0;

  const outgoing = (nodeId: string) =>
    Object.values(graph.edges)
      .filter((e) => e.from === nodeId)
      .sort((a, b) => a.priority - b.priority);

  const walk = (nodeId: string, cond: PathCondition, nodePath: string[], edgePath: string[]) => {
    const node = graph.nodes[nodeId];
    if (node.kind !== "terminal") {
      for (const edge of outgoing(nodeId)) {
        walk(edge.to, applyToCondition(cond, edge.predicate), [...nodePath, nodeId], [...edgePath, edge.id]);
      }
      return;
    }

    const policy = EXECUTION_POLICY[node.boundary];

    if (!policy.compilable) {
      excluded.push({ terminalNodeId: node.id, boundary: node.boundary, reason: `boundary ${node.boundary} is not compilable — needs a human` });
      return;
    }
    if (node.action.kind !== "referral") {
      excluded.push({ terminalNodeId: node.id, boundary: node.boundary, reason: `action ${node.action.kind} is not a referral grade — needs the workflow executor` });
      return;
    }
    if (!node.appliesTo.includes(pipeline)) {
      excluded.push({ terminalNodeId: node.id, boundary: node.boundary, reason: `not declared for pipeline ${pipeline}` });
      return;
    }

    const entries = overlay.entries.filter((e) => e.terminalNodeId === node.id);
    if (entries.length === 0) {
      excluded.push({ terminalNodeId: node.id, boundary: node.boundary, reason: "no local overlay entry prices this referral" });
      return;
    }

    for (const entry of entries) {
      const refined = (entry.refine ?? []).reduce(applyToCondition, cond);
      const anyCombos: string[][] =
        refined.any.length <= 1
          ? [[]]
          : refined.any.slice(1).reduce<string[][]>(
              (acc, group) => acc.flatMap((prefix) => group.map((g) => [...prefix, g])),
              [[]]
            );

      for (const extra of anyCombos) {
        expansionIndex += 1;
        rules.push({
          code: entry.code,
          title: node.label,
          impact: entry.rationale,
          kind: "compound",
          allFactLabels: [...refined.all, ...extra],
          anyFactLabels: refined.any[0] ? [...refined.any[0]] : undefined,
          absentFactLabels: refined.absent.length ? [...new Set(refined.absent)] : undefined,
          recommendation: {
            priority: entry.priority,
            targetDays: entry.targetDays,
            category: entry.category,
            outcome: entry.outcome,
            rationale: entry.rationale,
          },
          provenance: {
            compiledRuleInstanceId: `${releaseId}::${node.id}::${edgePath.join(">")}::${expansionIndex}`,
            terminalNodeId: node.id,
            nodePath: [...nodePath, node.id],
            edgePath,
            sourceRuleIds: node.provenance.sourceRuleIds,
            sourceVersion: node.provenance.sourceVersion,
            controllingAddendumRuleIds: node.provenance.controllingAddendumRuleIds,
            localOverlayRuleIds: [entry.code],
            localPolicyVersion: entry.localPolicyVersion,
            compilerVersion: COMPILER_VERSION,
          },
        } as CompiledRule);
      }
    }
  };

  walk(graph.rootId, { all: [], any: [], absent: [] }, [], []);
  return { rules, excluded };
}

export function asDefinition(rules: CompiledRule[]): CaseRuleReleaseDefinition {
  return {
    releaseKind: "coded-enterprise-v2",
    serviceLine: "COLPOSCOPY",
    sourceOfTruth: ["Figure 4 pathway graph + local colposcopy overlay"],
    notes: [],
    defaultRecommendation: {
      priority: "INFO_REQUIRED",
      category: "Insufficient evidence",
      outcome: "Request more information before final grading",
      rationale: "No compiled triage rule matched; the pathway may require the workflow executor.",
    },
    rules: rules as unknown as CaseRuleDefinition[],
  };
}

/** Canonical state → the flat fact list the current evaluator consumes. */
export function stateToFacts(state: CanonicalClinicalState) {
  const labels: string[] = [];
  for (const [field, map] of Object.entries(FIELD_LABELS)) {
    const v = fieldValue(state.fields[field as keyof CanonicalClinicalState["fields"]]);
    if (v && map[v as string]) labels.push(map[v as string]);
  }
  for (const [fact, label] of Object.entries(FACT_LABELS)) {
    if (state.facts[fact as keyof CanonicalClinicalState["facts"]]) labels.push(label);
  }
  return labels.map((label) => ({
    label,
    valueText: "present",
    evidence: `${label} (canonical state)`,
  }));
}
