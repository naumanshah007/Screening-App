/**
 * DESIGN PROTOTYPE — executable golden fixture for the ordered rule graph.
 *
 * This is NOT shipped code. It exists to prove, before Phase 1 is approved,
 * that the proposed graph model + compiler actually produce the intended
 * behaviour on the cases that Phase 0b showed are currently broken.
 *
 * It specifically proves the four properties required of the design:
 *   1. HPV Other + immune deficiency + MISSING cytology follows the 3-month path.
 *   2. HPV Other + immune deficiency + ASC-US does NOT take the missing-cytology
 *      branch — the defect in the first draft of the example, where
 *      `absent "Normal cytology"` was wrongly used to mean "no cytology reported".
 *   3. Previous-normal-colposcopy and previous-LSIL contexts reach their own
 *      specific outcomes rather than being swallowed by a catch-all.
 *   4. A broad catch-all cannot take away any specific outcome's winning witness.
 *
 * Run: npx tsx --test scripts/prototype/rule-graph-golden.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import type { CaseRuleDefinition, CaseRuleReleaseDefinition } from "../../lib/cases/rule-policy";
import { evaluateCaseRuleRelease } from "../../lib/cases/rule-evaluator";

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL CLINICAL VOCABULARY — stable ids, never clinician-facing text
// ─────────────────────────────────────────────────────────────────────────────

type FieldId = "fld_cytology" | "fld_hpv" | "fld_context";
type ValueId = string;
type FactId = "fact_immune_deficient";

/** A single-valued clinical field and the fact label each value maps to. */
const FIELDS: Record<FieldId, { label: string; values: Record<ValueId, string> }> = {
  fld_hpv: {
    label: "HPV result",
    values: {
      val_hpv_1618: "HPV 16/18",
      val_hpv_other: "HPV Other",
      val_hpv_none: "HPV Not Detected",
    },
  },
  fld_cytology: {
    label: "Cytology result",
    values: {
      val_cyt_normal: "Normal cytology",
      val_cyt_ascus: "ASC-US",
      val_cyt_lsil: "LSIL",
      val_cyt_asch: "ASC-H",
      val_cyt_hsil: "HSIL",
      val_cyt_glandular: "Glandular abnormality",
      val_cyt_cancer: "Cancer suspicion cytology",
    },
  },
  fld_context: {
    label: "Referral context",
    values: {
      val_ctx_prev_normal_colp: "Previous normal colposcopy",
      val_ctx_prev_lsil: "Previous LSIL histology",
      val_ctx_post_treatment: "Post-treatment assessment",
    },
  },
};

const FACTS: Record<FactId, string> = {
  fact_immune_deficient: "Immune deficient",
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPED PREDICATES — clinical fields and flat facts are distinct kinds
// ─────────────────────────────────────────────────────────────────────────────

type Predicate =
  | { kind: "factPresent"; factId: FactId }
  | { kind: "factAbsent"; factId: FactId }
  | { kind: "fieldIn"; fieldId: FieldId; valueIds: ValueId[] }
  /** No value of this field is present at all — "not reported". */
  | { kind: "fieldMissing"; fieldId: FieldId }
  | { kind: "otherwise" };

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH — every control-flow transition is an edge, with a role
// ─────────────────────────────────────────────────────────────────────────────

type EdgeRole = "decisionBranch" | "otherwise";

type Edge = {
  id: string;
  from: string;
  to: string;
  label: string;
  role: EdgeRole;
  predicate: Predicate;
  priority: number;
};

type Node =
  | { id: string; kind: "start"; label: string }
  | { id: string; kind: "decision"; label: string }
  | {
      id: string;
      kind: "outcome" | "fallback";
      code: string;
      label: string;
      impact: string;
      spec: CaseRuleDefinition["recommendation"];
    };

type Graph = {
  rootId: string;
  nodes: Record<string, Node>;
  edges: Record<string, Edge>;
};

const GRAPH: Graph = {
  rootId: "nd_start",
  nodes: {
    nd_start: { id: "nd_start", kind: "start", label: "Colposcopy referral received" },
    nd_ctx: { id: "nd_ctx", kind: "decision", label: "Referral context?" },
    nd_hpv_rr: { id: "nd_hpv_rr", kind: "decision", label: "HPV result? (re-referral)" },
    nd_hpv_pri: { id: "nd_hpv_pri", kind: "decision", label: "HPV result? (primary)" },
    nd_imm: { id: "nd_imm", kind: "decision", label: "Immune deficient?" },
    nd_imm_cyt: { id: "nd_imm_cyt", kind: "decision", label: "Cytology? (immune deficient)" },

    nd_out_035: {
      id: "nd_out_035", kind: "outcome", code: "COL-035",
      label: "Colposcopy within 6 months",
      impact: "Previous normal colposcopy re-referral, HPV 16/18",
      spec: {
        priority: "P3", targetDays: 180,
        category: "Previous normal colposcopy re-referral — 6 months",
        outcome: "Colposcopy within 6 months",
        rationale: "Re-referral following previous normal colposcopy with HPV 16/18.",
      },
    },
    nd_out_041: {
      id: "nd_out_041", kind: "outcome", code: "COL-041",
      label: "Colposcopy within 6 months",
      impact: "Previous LSIL histology re-referral, HPV 16/18",
      spec: {
        priority: "P3", targetDays: 180,
        category: "Previous LSIL histology re-referral — 6 months",
        outcome: "Colposcopy within 6 months",
        rationale: "Re-referral following previous LSIL histology with HPV 16/18.",
      },
    },
    nd_out_027: {
      id: "nd_out_027", kind: "outcome", code: "COL-027",
      label: "Colposcopy within 3 months",
      impact: "Immune-deficient HPV Other, cytology not reported",
      spec: {
        priority: "P3", targetDays: 90,
        category: "Immune-deficient HPV Other — 3 months",
        outcome: "Colposcopy within 3 months",
        rationale: "Immune-deficient patient, HPV Other, no cytology result reported.",
      },
    },
    nd_out_028: {
      id: "nd_out_028", kind: "outcome", code: "COL-028",
      label: "Colposcopy within 6 months",
      impact: "Immune-deficient HPV Other, normal or low-grade cytology",
      spec: {
        priority: "P3", targetDays: 180,
        category: "Immune-deficient HPV Other — 6 months",
        outcome: "Colposcopy within 6 months",
        rationale: "Immune-deficient patient, HPV Other, normal or low-grade cytology.",
      },
    },
    // COL-017 is deliberately absent pending the clinical adjudication recorded
    // in §15 question 1 of the design document. Its intent (30-day fallback vs
    // defect) is unresolved, so encoding either reading here would prejudge it.
    nd_out_004: {
      id: "nd_out_004", kind: "outcome", code: "COL-004",
      label: "High-priority colposcopy within 30 days",
      impact: "Broad HPV 16/18 catch-all — the rule that shadows the specific ones today",
      spec: {
        priority: "P2", targetDays: 30,
        category: "HPV 16/18 positive referral",
        outcome: "High-priority colposcopy within 30 days",
        rationale: "HPV 16/18 positivity detected; no more specific pathway applied.",
      },
    },
    nd_fallback: {
      id: "nd_fallback", kind: "fallback", code: "COL-FALLBACK",
      label: "Insufficient evidence",
      impact: "Nothing matched — route to clinician review",
      spec: {
        priority: "INFO_REQUIRED",
        category: "Insufficient evidence",
        outcome: "Request more information before final grading",
        rationale: "No pathway matched the available evidence.",
      },
    },
  },

  edges: {
    ed_start: {
      id: "ed_start", from: "nd_start", to: "nd_ctx", label: "",
      role: "decisionBranch", predicate: { kind: "otherwise" }, priority: 10,
    },

    // Context split — re-referral contexts are evaluated BEFORE the primary path,
    // which is what stops the broad HPV 16/18 catch-all from swallowing them.
    ed_ctx_rr: {
      id: "ed_ctx_rr", from: "nd_ctx", to: "nd_hpv_rr", label: "Re-referral context",
      role: "decisionBranch", priority: 10,
      predicate: {
        kind: "fieldIn", fieldId: "fld_context",
        valueIds: ["val_ctx_prev_normal_colp", "val_ctx_prev_lsil"],
      },
    },
    ed_ctx_primary: {
      id: "ed_ctx_primary", from: "nd_ctx", to: "nd_hpv_pri", label: "Anything else",
      role: "otherwise", predicate: { kind: "otherwise" }, priority: 999,
    },

    // Re-referral subtree
    ed_rr_prev_colp: {
      id: "ed_rr_prev_colp", from: "nd_hpv_rr", to: "nd_out_035",
      label: "Previous normal colposcopy", role: "decisionBranch", priority: 10,
      predicate: { kind: "fieldIn", fieldId: "fld_context", valueIds: ["val_ctx_prev_normal_colp"] },
    },
    ed_rr_prev_lsil: {
      id: "ed_rr_prev_lsil", from: "nd_hpv_rr", to: "nd_out_041",
      label: "Previous LSIL histology", role: "decisionBranch", priority: 20,
      predicate: { kind: "fieldIn", fieldId: "fld_context", valueIds: ["val_ctx_prev_lsil"] },
    },
    ed_rr_other: {
      id: "ed_rr_other", from: "nd_hpv_rr", to: "nd_fallback", label: "Anything else",
      role: "otherwise", predicate: { kind: "otherwise" }, priority: 999,
    },

    // Primary subtree
    ed_pri_imm: {
      id: "ed_pri_imm", from: "nd_hpv_pri", to: "nd_imm", label: "HPV Other",
      role: "decisionBranch", priority: 10,
      predicate: { kind: "fieldIn", fieldId: "fld_hpv", valueIds: ["val_hpv_other"] },
    },
    ed_pri_1618: {
      id: "ed_pri_1618", from: "nd_hpv_pri", to: "nd_out_004", label: "HPV 16/18",
      role: "decisionBranch", priority: 20,
      predicate: { kind: "fieldIn", fieldId: "fld_hpv", valueIds: ["val_hpv_1618"] },
    },
    ed_pri_other: {
      id: "ed_pri_other", from: "nd_hpv_pri", to: "nd_fallback", label: "Anything else",
      role: "otherwise", predicate: { kind: "otherwise" }, priority: 999,
    },

    // Immune deficiency
    ed_imm_yes: {
      id: "ed_imm_yes", from: "nd_imm", to: "nd_imm_cyt", label: "Immune deficient",
      role: "decisionBranch", priority: 10,
      predicate: { kind: "factPresent", factId: "fact_immune_deficient" },
    },
    ed_imm_no: {
      id: "ed_imm_no", from: "nd_imm", to: "nd_fallback", label: "Anything else",
      role: "otherwise", predicate: { kind: "otherwise" }, priority: 999,
    },

    // THE FIX. "No cytology reported" is fieldMissing(cytology) — every cytology
    // value absent — NOT `absent "Normal cytology"`, which would also be true for
    // an ASC-US or LSIL case and would swallow the low-grade branch.
    ed_cyt_missing: {
      id: "ed_cyt_missing", from: "nd_imm_cyt", to: "nd_out_027",
      label: "No cytology reported", role: "decisionBranch", priority: 10,
      predicate: { kind: "fieldMissing", fieldId: "fld_cytology" },
    },
    ed_cyt_lowgrade: {
      id: "ed_cyt_lowgrade", from: "nd_imm_cyt", to: "nd_out_028",
      label: "Normal or low-grade cytology", role: "decisionBranch", priority: 20,
      predicate: {
        kind: "fieldIn", fieldId: "fld_cytology",
        valueIds: ["val_cyt_normal", "val_cyt_ascus", "val_cyt_lsil"],
      },
    },
    ed_cyt_other: {
      id: "ed_cyt_other", from: "nd_imm_cyt", to: "nd_fallback", label: "Anything else",
      role: "otherwise", predicate: { kind: "otherwise" }, priority: 999,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPILER — ordered depth-first walk into the existing first-match format
// ─────────────────────────────────────────────────────────────────────────────

type PathCondition = {
  all: string[];
  any: string[][];
  absent: string[];
};

function applyPredicate(acc: PathCondition, p: Predicate): PathCondition {
  switch (p.kind) {
    case "otherwise":
      return acc;
    case "factPresent":
      return { ...acc, all: [...acc.all, FACTS[p.factId]] };
    case "factAbsent":
      return { ...acc, absent: [...acc.absent, FACTS[p.factId]] };
    case "fieldIn": {
      const labels = p.valueIds.map((v) => FIELDS[p.fieldId].values[v]);
      return labels.length === 1
        ? { ...acc, all: [...acc.all, labels[0]] }
        : { ...acc, any: [...acc.any, labels] };
    }
    case "fieldMissing": {
      // Every value of the field must be absent. This is the distinction the
      // first draft of the design got wrong.
      const allValues = Object.values(FIELDS[p.fieldId].values);
      return { ...acc, absent: [...acc.absent, ...allValues] };
    }
  }
}

type CompiledRule = CaseRuleDefinition & {
  provenance: { terminalNodeId: string; nodePath: string[]; edgePath: string[]; instanceId: string };
};

function compile(graph: Graph): CompiledRule[] {
  const rules: CompiledRule[] = [];
  let expansionIndex = 0;

  const outgoing = (nodeId: string) =>
    Object.values(graph.edges)
      .filter((e) => e.from === nodeId)
      .sort((a, b) => a.priority - b.priority);

  const walk = (
    nodeId: string,
    cond: PathCondition,
    nodePath: string[],
    edgePath: string[]
  ) => {
    const node = graph.nodes[nodeId];
    if (node.kind === "outcome" || node.kind === "fallback") {
      // Cross-product expansion when a path accumulates >1 `any` group, since
      // the target evaluator's compound kind supports only one.
      const anyCombos: string[][] = cond.any.length <= 1
        ? [[]]
        : cond.any.slice(1).reduce<string[][]>(
            (acc, group) => acc.flatMap((prefix) => group.map((g) => [...prefix, g])),
            [[]]
          );

      for (const extra of anyCombos) {
        expansionIndex += 1;
        rules.push({
          code: node.code,
          title: node.label,
          impact: node.impact,
          kind: "compound",
          allFactLabels: [...cond.all, ...extra],
          anyFactLabels: cond.any[0] ? [...cond.any[0]] : undefined,
          absentFactLabels: cond.absent.length ? [...new Set(cond.absent)] : undefined,
          recommendation: node.spec,
          provenance: {
            terminalNodeId: node.id,
            nodePath: [...nodePath, node.id],
            edgePath,
            instanceId: `${node.id}::${edgePath.join(">")}::${expansionIndex}`,
          },
        } as CompiledRule);
      }
      return;
    }

    for (const edge of outgoing(nodeId)) {
      walk(
        edge.to,
        applyPredicate(cond, edge.predicate),
        [...nodePath, nodeId],
        [...edgePath, edge.id]
      );
    }
  };

  walk(graph.rootId, { all: [], any: [], absent: [] }, [], []);
  return rules;
}

function asDefinition(rules: CompiledRule[]): CaseRuleReleaseDefinition {
  return {
    releaseKind: "coded-enterprise-v2",
    serviceLine: "COLPOSCOPY",
    sourceOfTruth: ["Design prototype fixture"],
    notes: [],
    defaultRecommendation: {
      priority: "INFO_REQUIRED",
      category: "Insufficient evidence",
      outcome: "Request more information before final grading",
      rationale: "No rule matched.",
    },
    rules: rules as unknown as CaseRuleDefinition[],
  };
}

function grade(definition: CaseRuleReleaseDefinition, labels: string[]) {
  return evaluateCaseRuleRelease({
    serviceLine: "COLPOSCOPY",
    ruleDefinition: definition,
    highSuspicionCancer: false,
    facts: labels.map((label) => ({
      label, valueText: "present", evidence: `${label} (golden fixture)`,
    })),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN TESTS
// ─────────────────────────────────────────────────────────────────────────────

const COMPILED = compile(GRAPH);
const DEFINITION = asDefinition(COMPILED);

test("compiles deterministically", () => {
  const again = compile(GRAPH);
  assert.equal(JSON.stringify(again), JSON.stringify(COMPILED));
});

test("property 1 — immune-deficient HPV Other with MISSING cytology takes the 3-month path", () => {
  const result = grade(DEFINITION, ["HPV Other", "Immune deficient"]);
  assert.equal(result.matchedRuleCode, "COL-027");
  assert.equal(result.recommendation.targetDays, 90);
});

test("property 2 — immune-deficient HPV Other with ASC-US does NOT take the missing-cytology branch", () => {
  const result = grade(DEFINITION, ["HPV Other", "Immune deficient", "ASC-US"]);
  assert.equal(
    result.matchedRuleCode,
    "COL-028",
    "ASC-US must reach the low-grade branch; this is the defect the first draft contained"
  );
  assert.equal(result.recommendation.targetDays, 180);

  // LSIL behaves the same way.
  const lsil = grade(DEFINITION, ["HPV Other", "Immune deficient", "LSIL"]);
  assert.equal(lsil.matchedRuleCode, "COL-028");
});

test("property 3 — re-referral contexts reach their own specific outcomes", () => {
  const prevColp = grade(DEFINITION, ["Previous normal colposcopy", "HPV 16/18"]);
  assert.equal(prevColp.matchedRuleCode, "COL-035");
  assert.equal(prevColp.recommendation.targetDays, 180);

  const prevLsil = grade(DEFINITION, ["Previous LSIL histology", "HPV 16/18"]);
  assert.equal(prevLsil.matchedRuleCode, "COL-041");
  assert.equal(prevLsil.recommendation.targetDays, 180);
});

test("property 4 — the broad HPV 16/18 catch-all keeps its own witness but takes none away", () => {
  // The catch-all still works for a plain primary-screening case...
  const plain = grade(DEFINITION, ["HPV 16/18"]);
  assert.equal(plain.matchedRuleCode, "COL-004");
  assert.equal(plain.recommendation.targetDays, 30);

  // ...and every other outcome node still has a winning witness.
  const winners = new Set<string>();
  const probes: string[][] = [
    ["HPV Other", "Immune deficient"],
    ["HPV Other", "Immune deficient", "ASC-US"],
    ["Previous normal colposcopy", "HPV 16/18"],
    ["Previous LSIL histology", "HPV 16/18"],
    ["HPV 16/18"],
  ];
  for (const probe of probes) {
    const code = grade(DEFINITION, probe).matchedRuleCode;
    if (code) winners.add(code);
  }
  for (const code of ["COL-027", "COL-028", "COL-035", "COL-041", "COL-004"]) {
    assert.ok(winners.has(code), `${code} lost its winning witness`);
  }
});

test("every compiled rule carries a unique instance id and full provenance", () => {
  const ids = COMPILED.map((r) => r.provenance.instanceId);
  assert.equal(new Set(ids).size, ids.length, "instance ids must be unique");
  for (const rule of COMPILED) {
    assert.ok(rule.provenance.terminalNodeId.length > 0);
    assert.ok(rule.provenance.nodePath.length > 0);
  }
});

test("regression guard — the naive `absent Normal cytology` encoding would fail property 2", () => {
  // Reproduce the first draft's mistake and prove the golden test catches it.
  const broken = asDefinition(
    COMPILED.map((rule) =>
      rule.provenance.terminalNodeId === "nd_out_027"
        ? ({ ...rule, absentFactLabels: ["Normal cytology"] } as CompiledRule)
        : rule
    )
  );
  const result = grade(broken, ["HPV Other", "Immune deficient", "ASC-US"]);
  assert.equal(
    result.matchedRuleCode,
    "COL-027",
    "the broken encoding should mis-route ASC-US — if this ever stops being true, the guard is stale"
  );
});
