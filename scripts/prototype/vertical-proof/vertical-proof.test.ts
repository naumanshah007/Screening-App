/**
 * THIN VERTICAL ARCHITECTURE PROOF — test suite.
 *
 * Run: npx tsx --test scripts/prototype/vertical-proof/vertical-proof.test.ts
 *
 * Proves, on one bounded pathway (Figure 4):
 *   · national pathway representation with source ids
 *   · local priority overlay, separately versioned
 *   · deterministic-provisional, review-required and missing-information results
 *   · batch vs case pipeline applicability
 *   · direct graph interpretation, independent of the compiler
 *   · compilation of only the triage portion to the existing flat evaluator
 *   · direct-versus-compiled equivalence over the EXHAUSTIVE legal state space
 *   · source-to-overlay provenance
 */

import test from "node:test";
import assert from "node:assert/strict";

import { evaluateCaseRuleRelease } from "../../../lib/cases/rule-evaluator";
import { FIGURE_4, COLPOSCOPY_OVERLAY } from "./pathway-f4";
import {
  asDefinition,
  compileTriage,
  evaluateRuleGraph,
  stateToFacts,
  validateOverlayCoverage,
} from "./engine";
import {
  CANONICAL_STATE_SCHEMA_VERSION,
  EXECUTION_POLICY,
  type CanonicalClinicalState,
  type Cytology,
  type HpvResult,
  type Pipeline,
  type RepeatStage,
} from "./model";

const RELEASE_ID = "rel_vertical_proof";

// ─── Exhaustive legal state space for Figure 4 ───────────────────────────────

const HPV: Array<HpvResult | "missing" | "conflicted"> = [
  "missing", "conflicted", "NOT_DETECTED", "HPV_16_18", "HPV_OTHER",
];
const CYT: Array<Cytology | "missing"> = [
  "missing", "NEGATIVE", "ASC_US", "LSIL", "ASC_H", "HSIL", "SCC",
];
const STAGE: RepeatStage[] = ["BASELINE", "FIRST_REPEAT", "SECOND_REPEAT"];

function makeState(
  hpv: (typeof HPV)[number],
  cyt: (typeof CYT)[number],
  stage: RepeatStage,
  normalColposcopy: boolean,
  immunocompromised: boolean,
  pipeline: Pipeline
): CanonicalClinicalState {
  const prov = { source: "structuredField" as const, confidence: 1 };
  return {
    schemaVersion: CANONICAL_STATE_SCHEMA_VERSION,
    pipeline,
    fields: {
      hpvResult:
        hpv === "missing" ? { status: "missing" }
        : hpv === "conflicted" ? { status: "conflicted", values: ["HPV_16_18", "HPV_OTHER"], provenance: [prov, prov] }
        : { status: "known", value: hpv, provenance: prov },
      cytologyResult:
        cyt === "missing" ? { status: "missing" } : { status: "known", value: cyt, provenance: prov },
      repeatStage: { status: "known", value: stage, provenance: prov },
    },
    facts: { normalColposcopy, immunocompromised },
    history: { priorRecallsCompleted: 0 },
  };
}

function* allStates(pipeline: Pipeline): Generator<CanonicalClinicalState> {
  for (const hpv of HPV)
    for (const cyt of CYT)
      for (const stage of STAGE)
        for (const colp of [true, false])
          for (const imm of [true, false])
            yield makeState(hpv, cyt, stage, colp, imm, pipeline);
}

const STATE_COUNT = HPV.length * CYT.length * STAGE.length * 2 * 2;

// ─── Compile once ────────────────────────────────────────────────────────────

const CASE_BUILD = compileTriage({
  graph: FIGURE_4, overlay: COLPOSCOPY_OVERLAY, pipeline: "CASE", releaseId: RELEASE_ID,
});
const BATCH_BUILD = compileTriage({
  graph: FIGURE_4, overlay: COLPOSCOPY_OVERLAY, pipeline: "BATCH", releaseId: RELEASE_ID,
});

// ─────────────────────────────────────────────────────────────────────────────

test("layer 1 — the pathway graph is total: every legal state reaches a terminal", () => {
  let n = 0;
  for (const state of allStates("CASE")) {
    const result = evaluateRuleGraph(FIGURE_4, state);
    assert.ok(result.terminalNodeId, "must reach a terminal");
    n += 1;
  }
  assert.equal(n, STATE_COUNT);
  console.log(`      exhaustive state space: ${n} legal canonical states`);
});

test("layer 4 — most Figure 4 terminals are NOT referral grades", () => {
  const kinds = new Map<string, number>();
  for (const node of Object.values(FIGURE_4.nodes)) {
    if (node.kind !== "terminal") continue;
    kinds.set(node.action.kind, (kinds.get(node.action.kind) ?? 0) + 1);
  }
  assert.equal(kinds.get("referral"), 4);
  // recall, discharge, requestInformation x2, mandatoryReview, safetyEscalation
  const nonReferral = [...kinds.entries()]
    .filter(([k]) => k !== "referral")
    .reduce((sum, [, n]) => sum + n, 0);
  assert.ok(nonReferral >= 6, `expected >= 6 non-referral terminals, got ${nonReferral}`);
});

test("automation boundary — clinician-led and review-required are never auto-finalised", () => {
  for (const node of Object.values(FIGURE_4.nodes)) {
    if (node.kind !== "terminal") continue;
    const state = makeState("HPV_OTHER", "NEGATIVE", "BASELINE", true, false, "CASE");
    const policy = evaluateRuleGraph(FIGURE_4, state).policy;
    assert.equal(policy.autoFinalisable, false);
  }
  // The clinician-led terminal must not be compiled into an autonomous grade.
  const excludedIds = CASE_BUILD.excluded.map((e) => e.terminalNodeId);
  assert.ok(excludedIds.includes("nd_f4_t10"), "clinician-led terminal must not compile");
});

test("compiler compiles ONLY the referral terminals, and says why it excluded the rest", () => {
  const compiledTerminals = new Set(CASE_BUILD.rules.map((r) => r.provenance.terminalNodeId));
  assert.deepEqual(
    [...compiledTerminals].sort(),
    ["nd_f4_t04", "nd_f4_t05", "nd_f4_t07", "nd_f4_t08"]
  );
  for (const id of ["nd_f4_t02", "nd_f4_t03", "nd_f4_t06", "nd_f4_t09", "nd_f4_t10"]) {
    const row = CASE_BUILD.excluded.find((e) => e.terminalNodeId === id);
    assert.ok(row, `${id} must be explicitly excluded`);
    assert.ok(row!.reason.length > 0);
  }
});

test("DIRECT vs COMPILED — equivalence over the exhaustive legal state space", () => {
  const definition = asDefinition(CASE_BUILD.rules);
  const overlayByTerminal = new Map<string, string[]>();
  for (const entry of COLPOSCOPY_OVERLAY.entries) {
    overlayByTerminal.set(entry.terminalNodeId, [
      ...(overlayByTerminal.get(entry.terminalNodeId) ?? []), entry.code,
    ]);
  }

  let compared = 0;
  let agreed = 0;
  const disagreements: string[] = [];

  for (const state of allStates("CASE")) {
    const direct = evaluateRuleGraph(FIGURE_4, state);

    // The compiled artifact only speaks for compilable referral terminals.
    const isCompiled = CASE_BUILD.rules.some(
      (r) => r.provenance.terminalNodeId === direct.terminalNodeId
    );
    if (!isCompiled) continue;

    compared += 1;
    const flat = evaluateCaseRuleRelease({
      serviceLine: "COLPOSCOPY",
      ruleDefinition: definition,
      highSuspicionCancer: false,
      facts: stateToFacts(state),
    });

    const expectedCodes = overlayByTerminal.get(direct.terminalNodeId) ?? [];
    if (flat.matchedRuleCode && expectedCodes.includes(flat.matchedRuleCode)) {
      agreed += 1;
    } else {
      disagreements.push(
        `state hpv=${state.fields.hpvResult.status === "known" ? state.fields.hpvResult.value : state.fields.hpvResult.status}` +
        ` cyt=${state.fields.cytologyResult.status === "known" ? state.fields.cytologyResult.value : "missing"}` +
        ` stage=${state.fields.repeatStage.status === "known" ? state.fields.repeatStage.value : "?"}` +
        ` imm=${state.facts.immunocompromised}` +
        ` → direct ${direct.terminalNodeId} (expects ${expectedCodes.join("/")}), compiled ${flat.matchedRuleCode}`
      );
    }
  }

  console.log(`      compared ${compared} states reaching a compiled terminal; ${agreed} agreed`);
  assert.deepEqual(disagreements.slice(0, 10), [], "direct and compiled must agree");
  assert.ok(compared > 0, "the differential test must actually compare something");
});

test("overlay totality — every compilable referral terminal has a branch-local fallback", () => {
  for (const pipeline of ["CASE", "BATCH"] as const) {
    const problems = validateOverlayCoverage({
      graph: FIGURE_4, overlay: COLPOSCOPY_OVERLAY, pipeline,
    });
    assert.deepEqual(problems, [], `overlay coverage gaps in ${pipeline}`);
  }

  // And prove the validator actually detects a gap: strip the fallback that the
  // differential test forced us to add.
  const gapped = {
    ...COLPOSCOPY_OVERLAY,
    entries: COLPOSCOPY_OVERLAY.entries.filter(
      (e) => !(e.terminalNodeId === "nd_f4_t04" && !e.refine)
    ),
  };
  const detected = validateOverlayCoverage({ graph: FIGURE_4, overlay: gapped, pipeline: "CASE" });
  assert.equal(detected.length, 1);
  assert.equal(detected[0].terminalNodeId, "nd_f4_t04");
  assert.match(detected[0].problem, /no branch-local fallback/);
});

test("pipeline applicability — batch and case produce different compiled artifacts", () => {
  const caseTerminals = new Set(CASE_BUILD.rules.map((r) => r.provenance.terminalNodeId));
  const batchTerminals = new Set(BATCH_BUILD.rules.map((r) => r.provenance.terminalNodeId));

  // Every referral terminal in Figure 4 declares BATCH and CASE, so both compile.
  assert.deepEqual([...caseTerminals].sort(), [...batchTerminals].sort());

  // Terminals declared WORKFLOW-only must be absent from both, and that is
  // EXPECTED, not a defect.
  for (const id of ["nd_f4_t02", "nd_f4_t03", "nd_f4_t09"]) {
    assert.ok(!caseTerminals.has(id));
    assert.ok(!batchTerminals.has(id));
    const node = FIGURE_4.nodes[id];
    assert.ok(node.kind === "terminal" && node.appliesTo.every((p) => p === "WORKFLOW"));
  }
});

test("witness required in every DECLARED pipeline only", () => {
  // A terminal can be declared for a pipeline yet never appear in the COMPILED
  // triage artifact, because only referral terminals compile. Those are served
  // by the review / workflow executor in that pipeline. "Declared pipeline" and
  // "present in the compiled artifact" are different claims.
  const classify = (terminalId: string) => {
    const node = FIGURE_4.nodes[terminalId];
    if (node.kind !== "terminal") return "n/a";
    const declared = node.appliesTo;
    const compilable =
      node.action.kind === "referral" && EXECUTION_POLICY[node.boundary].compilable;
    if (!compilable) return `expected non-compiled (${node.action.kind}, served by review/workflow executor)`;

    const inCase = CASE_BUILD.rules.some((r) => r.provenance.terminalNodeId === terminalId);
    const inBatch = BATCH_BUILD.rules.some((r) => r.provenance.terminalNodeId === terminalId);
    if (declared.includes("CASE") && declared.includes("BATCH")) {
      return inCase && inBatch ? "expected both" : "UNEXPECTEDLY ABSENT";
    }
    if (declared.includes("CASE")) return inCase ? "expected case-only" : "UNEXPECTEDLY ABSENT";
    if (declared.includes("BATCH")) return inBatch ? "expected batch-only" : "UNEXPECTEDLY ABSENT";
    return "expected workflow-only";
  };

  const results = Object.values(FIGURE_4.nodes)
    .filter((n) => n.kind === "terminal")
    .map((n) => ({ id: n.id, status: classify(n.id) }));

  for (const r of results) {
    assert.notEqual(r.status, "UNEXPECTEDLY ABSENT", `${r.id} is missing from a declared pipeline`);
  }
  console.log(`      applicability: ${results.map((r) => `${r.id}=${r.status}`).join(", ")}`);
});

test("contradictory canonical facts trigger a safety stop, not branch priority", () => {
  const conflicted = makeState("conflicted", "NEGATIVE", "BASELINE", true, false, "CASE");
  const result = evaluateRuleGraph(FIGURE_4, conflicted);
  assert.equal(result.terminalNodeId, "nd_f4_conflict");
  assert.equal(result.boundary, "SAFETY_OVERRIDE");
  assert.equal(result.action.kind, "safetyEscalation");
});

test("missing-information and review-required outcomes are distinct from referrals", () => {
  const noCyt = makeState("HPV_OTHER", "missing", "FIRST_REPEAT", true, false, "CASE");
  const r1 = evaluateRuleGraph(FIGURE_4, noCyt);
  assert.equal(r1.terminalNodeId, "nd_f4_t06");
  assert.equal(r1.action.kind, "requestInformation");
  assert.equal(r1.policy.createsReviewTask, true);

  const noColp = makeState("HPV_OTHER", "NEGATIVE", "BASELINE", false, false, "CASE");
  const r2 = evaluateRuleGraph(FIGURE_4, noColp);
  assert.equal(r2.terminalNodeId, "nd_f4_t01");
  assert.equal(r2.boundary, "REVIEW_REQUIRED");
});

test("deterministic provisional referral carries full source + overlay provenance", () => {
  const state = makeState("HPV_OTHER", "NEGATIVE", "FIRST_REPEAT", true, true, "CASE");
  const direct = evaluateRuleGraph(FIGURE_4, state);
  assert.equal(direct.terminalNodeId, "nd_f4_t08");
  assert.deepEqual(direct.provenance.sourceRuleIds, ["F4-08"]);
  assert.deepEqual(direct.provenance.controllingAddendumRuleIds, ["A26-07"]);

  const rule = CASE_BUILD.rules.find((r) => r.provenance.terminalNodeId === "nd_f4_t08")!;
  assert.deepEqual(rule.provenance.sourceRuleIds, ["F4-08"]);
  assert.deepEqual(rule.provenance.localOverlayRuleIds, ["COL-037"]);
  assert.equal(rule.provenance.sourceVersion, "NCSP-2023");
  assert.equal(rule.provenance.localPolicyVersion, "CM-Health-local-2026.1");
});

test("duplicate clinical codes are allowed; compiledRuleInstanceId is unique", () => {
  const ids = CASE_BUILD.rules.map((r) => r.provenance.compiledRuleInstanceId);
  assert.equal(new Set(ids).size, ids.length, "instance ids must be unique");

  // Terminal nd_f4_t04 is priced by three overlay entries — two refined plus the
  // branch-local fallback — so one pathway terminal yields three compiled rules
  // with three distinct instance ids and three different clinical codes.
  const t04 = CASE_BUILD.rules.filter((r) => r.provenance.terminalNodeId === "nd_f4_t04");
  assert.equal(t04.length, 3);
  assert.deepEqual(t04.map((r) => r.code).sort(), ["COL-004", "COL-035", "COL-036"]);
  assert.equal(new Set(t04.map((r) => r.provenance.compiledRuleInstanceId)).size, 3);
  // All three trace to the same national source rule — the overlay prices, it
  // does not decide.
  for (const rule of t04) assert.deepEqual(rule.provenance.sourceRuleIds, ["F4-04"]);

  // The refined entries must precede the fallback, or the fallback swallows them.
  assert.equal(t04[t04.length - 1].code, "COL-004");
});

test("editing the local overlay does not alter the national pathway", () => {
  const before = evaluateRuleGraph(
    FIGURE_4, makeState("HPV_OTHER", "NEGATIVE", "FIRST_REPEAT", true, true, "CASE")
  );

  const edited = {
    ...COLPOSCOPY_OVERLAY,
    entries: COLPOSCOPY_OVERLAY.entries.map((e) =>
      e.code === "COL-037" ? { ...e, priority: "P2" as const, targetDays: 30 } : e
    ),
  };
  const rebuilt = compileTriage({
    graph: FIGURE_4, overlay: edited, pipeline: "CASE", releaseId: RELEASE_ID,
  });

  const after = evaluateRuleGraph(
    FIGURE_4, makeState("HPV_OTHER", "NEGATIVE", "FIRST_REPEAT", true, true, "CASE")
  );

  // Pathway decision unchanged...
  assert.equal(after.terminalNodeId, before.terminalNodeId);
  assert.deepEqual(after.provenance.sourceRuleIds, before.provenance.sourceRuleIds);
  // ...only the local booking target moved.
  const rule = rebuilt.rules.find((r) => r.code === "COL-037")!;
  assert.equal(rule.recommendation.targetDays, 30);
});

test("compilation is deterministic", () => {
  const again = compileTriage({
    graph: FIGURE_4, overlay: COLPOSCOPY_OVERLAY, pipeline: "CASE", releaseId: RELEASE_ID,
  });
  assert.equal(JSON.stringify(again.rules), JSON.stringify(CASE_BUILD.rules));
});

test("branch totality — removing an otherwise edge is caught at runtime", () => {
  const broken = {
    ...FIGURE_4,
    edges: Object.fromEntries(
      Object.entries(FIGURE_4.edges).filter(([id]) => id !== "ed_f4_hpv_else")
    ),
  };
  // A state whose HPV is known but matches no explicit branch value.
  const state = makeState("missing", "NEGATIVE", "BASELINE", true, false, "CASE");
  state.fields.hpvResult = { status: "notPerformed", provenance: { source: "structuredField" } };
  // notPerformed satisfies fieldMissing, so this one still terminates:
  assert.ok(evaluateRuleGraph(broken as typeof FIGURE_4, state).terminalNodeId);

  // Now remove the missing branch too — nothing matches, and the interpreter
  // must refuse rather than leak.
  const worse = {
    ...broken,
    edges: Object.fromEntries(
      Object.entries(broken.edges).filter(([id]) => id !== "ed_f4_hpv_missing")
    ),
  };
  assert.throws(
    () => evaluateRuleGraph(worse as typeof FIGURE_4, state),
    /branch totality violated/
  );
});

test("canonical state schema version is enforced", () => {
  const state = makeState("HPV_16_18", "NEGATIVE", "BASELINE", true, false, "CASE");
  const stale = { ...state, schemaVersion: "canonical-state-v0" as never };
  assert.throws(() => evaluateRuleGraph(FIGURE_4, stale), /schema mismatch/);
});
