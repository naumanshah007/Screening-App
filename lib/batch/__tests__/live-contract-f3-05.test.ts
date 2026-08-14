/**
 * Live contract: HPV Other + HSIL + LBC at baseline must reach F3-05.
 *
 * THE DEFECT THIS LOCKS
 * ---------------------
 * A live case (Age 30 / HPV OTHER / HSIL / LBC / FIGURE_3) evaluated under
 * CG-NCSP-3.1.0 returned CANONICAL-SAFETY-STOP with matchedRuleIds = [], while
 * the conformance corpus proved F3-05 matches the same clinical picture.
 *
 * Root cause: F3-05 requires eq("eventStage", "INITIAL"). canonicalEventStage()
 * derives eventStage from `repeatStage`, and returns undefined when it is
 * absent, so `eventStage` never entered the governed fact map. Batch intake
 * never declared a repeat stage for baseline records, so no rule requiring an
 * event stage could ever match. The corpus fixtures supply eventStage
 * explicitly — which is precisely why the corpus passed while live intake did
 * not, and why this test exercises the intake path instead of a hand-built
 * fixture.
 *
 * The fix is in the synthetic source, not the fact adapter: the adapter must
 * keep its contract of never fabricating absent clinical facts, so a real feed
 * that genuinely omits repeat context still reaches the safety stop.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { normalizeClinicalFactMap } from "@/lib/clinical-rules/facts";
import { generateRealisticCases } from "@/lib/batch/realistic-dataset";

test("baseline intake records carry an event stage", () => {
  const cases = generateRealisticCases({
    connector: "hl7",
    count: 40,
    rangeStart: new Date("2026-01-01T00:00:00.000Z"),
    rangeEnd: new Date("2026-06-30T00:00:00.000Z"),
  });

  assert.ok(cases.length > 0, "generator must produce cases");

  const withoutStage = cases.filter(
    (c) => (c as { repeatStage?: string }).repeatStage === undefined
  );
  assert.deepEqual(
    withoutStage.map((c) => c.caseId),
    [],
    "every generated record must declare its repeat stage; an absent stage " +
      "silently removes eventStage from the governed facts"
  );
});

test("a baseline repeat stage normalises to eventStage INITIAL", () => {
  const facts = normalizeClinicalFactMap({
    currentPathway: "FIGURE_3",
    repeatStage: "BASELINE",
    hpvResult: "HPV_OTHER",
    cytologyResult: "HSIL",
    sampleType: "LBC",
    patientAge: 30,
  } as never);

  assert.equal(
    (facts as Record<string, unknown>).eventStage,
    "INITIAL",
    "a baseline record must produce eventStage INITIAL for the governed rules"
  );
});

test("an absent repeat stage still yields no event stage", () => {
  // The safety stop must not be weakened globally: a source that genuinely does
  // not say whether this is a baseline or a repeat cannot have baseline rules
  // applied to it.
  const facts = normalizeClinicalFactMap({
    currentPathway: "FIGURE_3",
    hpvResult: "HPV_OTHER",
    cytologyResult: "HSIL",
    sampleType: "LBC",
    patientAge: 30,
  } as never);

  assert.equal(
    (facts as Record<string, unknown>).eventStage,
    undefined,
    "an unknown repeat stage must stay absent rather than defaulting to INITIAL"
  );
});

test("the governed HPV Other + HSIL picture normalises to F3-05 inputs", () => {
  const facts = normalizeClinicalFactMap({
    currentPathway: "FIGURE_3",
    repeatStage: "BASELINE",
    hpvResult: "HPV_OTHER",
    cytologyResult: "HSIL",
    sampleType: "LBC",
    patientAge: 30,
  } as never) as Record<string, unknown>;

  // Every field F3-05's predicate reads must be present and correctly valued.
  assert.equal(facts.currentPathway, "FIGURE_3");
  assert.equal(facts.eventStage, "INITIAL");
  assert.equal(facts.hpvResult, "HPV_OTHER");
  assert.equal(facts.cytologyResult, "HSIL");
});
