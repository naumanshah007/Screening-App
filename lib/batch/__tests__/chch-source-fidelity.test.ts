/**
 * Source fidelity of the CHCH Public evaluation set.
 *
 * These cases are an external evaluation oracle: a clinician supplied both the
 * facts and the behaviour they expect. That makes the dataset uniquely easy to
 * corrupt, because any disagreement can be removed by editing the input until
 * the engine produces the expected answer. Each test below pins a fact to what
 * the source actually says, so that a future edit made to regain agreement
 * fails here instead of passing silently.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CHCH_PUBLIC_DATASET } from "../chch-public-dataset";
import { CHCH_PUBLIC_ASSUMPTIONS, unapprovedAssumptions } from "../chch-public-assumptions";
import { processBatch } from "../processor";

function caseFor(id: string) {
  const found = CHCH_PUBLIC_DATASET.find((c) => c.source.externalPatientId === id);
  assert.ok(found, `${id} missing from CHCH_PUBLIC_DATASET`);
  return found;
}

function decisionFor(id: string) {
  const c = caseFor(id);
  const result = processBatch([c], { includeWarnings: true, includeInvalid: true }).results[0];
  assert.ok(result, `${id} produced no result`);
  return result.decision;
}

test("the dataset is exactly the 30 supplied cases, chch-001 to chch-030", () => {
  assert.equal(CHCH_PUBLIC_DATASET.length, 30);

  const ids = CHCH_PUBLIC_DATASET.map((c) => c.source.externalPatientId);
  const expected = Array.from({ length: 30 }, (_, i) => `chch-${String(i + 1).padStart(3, "0")}`);
  assert.deepEqual(ids, expected);

  assert.equal(new Set(ids).size, 30, "case IDs must be unique");
});

test("a previous HPV16/18 result is never recorded as previous high-grade disease", () => {
  // The rulebook defines Figure 2 entry by previous possible/definite HSIL and
  // atypical glandular cells (F2-01). HPV 16/18 appears only as a current-result
  // rule (F3-03). Promoting the genotype to high-grade disease routes a case
  // into a pathway whose entry criteria it does not meet.
  for (const id of ["chch-009", "chch-010", "chch-019"]) {
    const c = caseFor(id);
    assert.equal(
      c.previousHpv1618Episode,
      true,
      `${id} reports a previous HPV16/18 result and should record it as such`
    );
    assert.notEqual(
      c.priorHighGradeResult,
      true,
      `${id}: the source reports a previous HPV16/18 screening result, not high-grade cytology or histology`
    );
    assert.notEqual(c.previousHSILCIN23, true, `${id}: no HSIL/CIN2-3 is reported in the source`);
  }
});

test("chch-010 stops for the undocumented referral outcome rather than closing the episode", () => {
  const c = caseFor("chch-010");
  // "outcome not documented" is unknown, which is not false — false would
  // assert the colposcopy did not happen.
  assert.equal(c.colposcopyCompletedForLastRecommendation, undefined);

  const decision = decisionFor("chch-010");
  assert.equal(decision.recommendationCode, "F3-PREVIOUS-HPV1618-OUTCOME-REQUIRED");
  assert.equal(decision.safetyOutcome, "EXTERNAL_HISTORY_REQUIRED");
  assert.notEqual(
    decision.recommendationCode,
    "F3-HPV-NOT-DETECTED-5Y",
    "a negative HPV result must not close an episode whose referral outcome is unknown"
  );
});

test("chch-009 cannot be graded without a current sample", () => {
  const c = caseFor("chch-009");
  assert.equal(c.hpvResult, undefined, "the source states no new sample was taken");

  const decision = decisionFor("chch-009");
  assert.equal(decision.recommendationCode, "F3-HPV-REQUIRED");
  assert.equal(decision.safetyOutcome, "INSUFFICIENT_INFORMATION");
});

test("chch-007 carries only the Test of Cure facts the source states", () => {
  const c = caseFor("chch-007");
  // "Post-treatment surveillance" + "treated CIN3 three years ago".
  assert.equal(c.isTestOfCure, true);
  assert.equal(c.repeatContext, "TEST_OF_CURE");
  // How far through Test of Cure is not stated anywhere in the source.
  assert.equal(c.testOfCureStage, undefined, "the source does not say which Test of Cure test this is");
  assert.equal(c.testOfCureStatus, undefined, "the source does not report Test of Cure progress");

  assert.equal(decisionFor("chch-007").figure, "FIGURE_6");
});

test("chch-018 does not assume treatment the source never states", () => {
  const c = caseFor("chch-018");
  // "Previous CIN2; surveillance episode" — high-grade history is stated,
  // treatment is not, and Test of Cure presupposes treatment.
  assert.equal(c.previousHSILCIN23, true);
  assert.notEqual(c.isTestOfCure, true, "the source says surveillance, not treated");
  assert.notEqual(c.repeatContext, "TEST_OF_CURE");
  assert.equal(c.testOfCureStatus, undefined);

  // Unknown treatment status must produce a stop, not a terminal recommendation.
  const decision = decisionFor("chch-018");
  assert.equal(decision.safetyOutcome, "EXTERNAL_HISTORY_REQUIRED");
});

test("no case reaches a routine recall while carrying an unresolved high-grade or HPV16/18 history", () => {
  // GS-01: never generate routine recall from a default or an unknown.
  const routineCodes = new Set(["F3-HPV-NOT-DETECTED-5Y", "F3-HPV-NOT-DETECTED-IC-3Y"]);

  for (const c of CHCH_PUBLIC_DATASET) {
    const decision = processBatch([c], { includeWarnings: true, includeInvalid: true }).results[0]
      ?.decision;
    if (!decision || !routineCodes.has(decision.recommendationCode ?? "")) continue;

    const unresolvedEpisode =
      c.previousHpv1618Episode === true && c.colposcopyCompletedForLastRecommendation !== true;
    const unresolvedHighGrade =
      (c.priorHighGradeResult === true || c.previousHSILCIN23 === true) &&
      c.testOfCureStatus !== "COMPLETE" &&
      c.priorScreeningHistory !== "HIGH_GRADE_TOC_COMPLETE";

    assert.equal(
      unresolvedEpisode || unresolvedHighGrade,
      false,
      `${c.source.externalPatientId} returns a routine recall while carrying unresolved history`
    );
  }
});

test("every dataset assumption is declared and none is self-approved", () => {
  assert.ok(CHCH_PUBLIC_ASSUMPTIONS.length > 0);

  for (const a of CHCH_PUBLIC_ASSUMPTIONS) {
    assert.ok(a.field.length > 0);
    assert.ok(a.basis.length > 20, `${a.field}: an assumption needs a stated basis`);
    assert.ok(
      a.consequenceIfWrong.length > 20,
      `${a.field}: an assumption needs its clinical consequence stated`
    );
    assert.ok(a.rulesAffected.length > 0, `${a.field}: name the rules it affects`);
  }

  // Engineering does not approve clinical assumptions. If this ever fails,
  // check who set the flag and on what authority.
  assert.equal(
    unapprovedAssumptions().length,
    CHCH_PUBLIC_ASSUMPTIONS.length,
    "dataset assumptions must be approved by a clinician, not in code"
  );
});
