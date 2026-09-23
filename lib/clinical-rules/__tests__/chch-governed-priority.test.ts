/**
 * Priority and risk on the CHCH path, evaluated against the committed ruleset.
 *
 * THREE DEFECTS THESE LOCK
 * ------------------------
 * 1. F3-03's timing reads "20 or 30 working days according to risk/history;
 *    urgent if invasive cytology". The urgent limb was applied unconditionally,
 *    so all twelve F3-03 cases became P1 — including cases whose cytology was
 *    negative, pending, missing or low-grade, none of which is invasive.
 *
 * 2. The controlling rule's `safetyPriority` was mapped into the participant's
 *    clinical risk, so CRITICAL — which means "no governed rule covers this
 *    case" — became an URGENT patient.
 *
 * 3. Where canonical stopped, the legacy referral, priority and risk survived
 *    underneath the governed result and were displayed as though governed.
 *
 * This runs the real 30 cases against the committed CG-NCSP-3.1.0 snapshot. It
 * is an offline evaluation, not an activated clinical decision.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CHCH_PUBLIC_DATASET } from "@/lib/batch/chch-public-dataset";
import { canonicalFactsForCase, mapCanonicalToClinicalInput } from "@/lib/batch/processor";
import { evaluateClinicalDecision } from "@/lib/engine/decision-engine";
import { canonicalClinicalFactsV2ToFactMap } from "../canonical-facts-v2";
import { canonicalToClinicalDecision } from "../decision-adapter";
import { evaluateCanonicalClinicalFactsV2 } from "../evaluator";
import { loadGovernedSnapshot } from "../governed-snapshot-store";

const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");

function evaluate(caseId: string) {
  const batchCase = CHCH_PUBLIC_DATASET.find(
    (c) => c.source.externalPatientId === caseId
  );
  assert.ok(batchCase, `${caseId} missing from CHCH_PUBLIC_DATASET`);
  const input = mapCanonicalToClinicalInput(batchCase);
  const legacyDecision = evaluateClinicalDecision(input);
  const facts = canonicalFactsForCase({
    batchCase,
    input,
    currentPathway: legacyDecision.figure,
  });
  const evaluated = evaluateCanonicalClinicalFactsV2(snapshot, facts);
  const adapted = canonicalToClinicalDecision({
    canonical: {
      ruleSetId: "rs",
      ruleVersionId: "rv",
      ruleVersionDisplay: "CG-NCSP-3.1.0",
      ruleSetChecksum: "0".repeat(64),
      engineVersion: "canonical-graph-v2",
      ...evaluated.result,
    },
    legacyDecision,
  });
  return {
    legacyDecision,
    canonical: evaluated.result,
    adapted,
    factMap: canonicalClinicalFactsV2ToFactMap(facts, snapshot).factMap,
  };
}

const ALL_IDS = CHCH_PUBLIC_DATASET.map((c) => c.source.externalPatientId!);

test("no CHCH case is given P1 by a conditional urgent limb it does not meet", () => {
  for (const id of ALL_IDS) {
    const { adapted, factMap } = evaluate(id);
    if (adapted.decision.referralPriority !== "P1") continue;
    // A P1 is only legitimate here if the facts establish invasive cytology.
    assert.ok(
      ["SCC", "SUSPICIOUS_INVASIVE_CANCER", "DEFINITE_INVASIVE_CANCER"].includes(
        String(factMap.cytologyResult ?? "")
      ),
      `${id} was made P1 without invasive cytology (${String(factMap.cytologyResult)})`
    );
  }
});

test("the twelve F3-03 cases no longer become urgent on the rule's wording alone", () => {
  const f303 = ALL_IDS.filter((id) => evaluate(id).canonical.matchedRuleIds[0] === "F3-03");
  assert.ok(f303.length > 0, "the CHCH set must still exercise F3-03");
  for (const id of f303) {
    const { canonical, adapted } = evaluate(id);
    assert.equal(
      canonical.repeatInterval,
      "20 or 30 working days according to risk/history; urgent if invasive cytology"
    );
    assert.equal(canonical.unresolvedUrgentLimb, true, `${id} must record the unresolved limb`);
    assert.notEqual(
      adapted.decision.referralPriority,
      "P1",
      `${id}: no invasive cytology, so the urgent limb does not apply`
    );
    assert.ok(
      adapted.adapterNotices.some((notice) => notice.includes("urgent limb")),
      `${id}: the evidence must explain why no urgency was applied`
    );
  }
});

test("HSIL is not invasive cytology and does not satisfy the urgent limb", () => {
  // chch-003 and chch-014 are HPV16/18 with HSIL. HSIL is high-grade, not
  // invasive, and the source's urgent limb says "invasive cytology".
  for (const id of ["chch-003", "chch-014"]) {
    const { adapted, factMap } = evaluate(id);
    assert.equal(factMap.cytologyResult, "HSIL");
    assert.notEqual(adapted.decision.referralPriority, "P1", id);
  }
});

test("a software safety severity never becomes a participant's clinical risk", () => {
  for (const id of ALL_IDS) {
    const { canonical, adapted, legacyDecision } = evaluate(id);
    // The severity is still recorded as technical evidence...
    assert.ok(canonical.safetyPriority, `${id} must record an implementation severity`);
    assert.equal(adapted.safetyPriority, canonical.safetyPriority);
    // ...and never reaches the participant's risk level.
    assert.equal(
      adapted.decision.riskLevel,
      legacyDecision.riskLevel,
      `${id}: canonical states no participant risk, so risk must be the router's`
    );
    if (canonical.safetyPriority === "CRITICAL") {
      assert.notEqual(
        adapted.decision.riskLevel,
        "URGENT",
        `${id}: a coverage gap is not an urgent patient`
      );
    }
  }
});

test("a governed stop inherits no legacy referral, priority or recall", () => {
  const stopped = ALL_IDS.filter((id) => evaluate(id).adapted.canonicalStopped);
  assert.ok(stopped.length > 0, "the CHCH set must still produce governed stops");
  for (const id of stopped) {
    const { adapted, legacyDecision } = evaluate(id);
    assert.equal(adapted.decision.referralRequired, false, id);
    assert.equal(adapted.decision.referralPriority, undefined, id);
    assert.equal(adapted.decision.referralType, undefined, id);
    assert.equal(adapted.decision.recallRequired, false, id);
    assert.equal(adapted.decision.recallIntervalMonths, undefined, id);
    // The legacy values still exist as comparison evidence; they just do not
    // become the governed result.
    assert.ok(legacyDecision.recommendationCode);
  }
});

test("the governed evaluation sees the precise genotype the source reported", () => {
  for (const [id, expected] of [
    ["chch-001", "HPV_16"],
    ["chch-002", "HPV_18"],
    ["chch-004", "HPV_OTHER"],
  ] as const) {
    assert.equal(evaluate(id).factMap.hpvResult, expected, id);
  }
});
