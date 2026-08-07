/**
 * Provenance and fabrication guards for batch → CanonicalClinicalFactsV2.
 *
 * Two distinct hazards are covered:
 *
 *  1. PROVENANCE. `currentPathway` is produced by the legacy router, not
 *     observed or entered. Recording it as PRIOR_RECORD or REVIEWER_ENTRY would
 *     assert in an immutable clinical record that a source system or a clinician
 *     supplied a value that software derived.
 *
 *  2. FABRICATION. The legacy batch mapper sets eight clinical work-up facts to
 *     `true` for every bleeding case, and derives two treatment-completion facts
 *     from mere suspicion. Those are legacy assumptions. Canonical authority must
 *     never inherit them: a fabricated "examination completed" can convert a
 *     safety stop into a recommendation.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { processBatch, ENGINE_VERSION } from "../processor";
import type { CanonicalBatchCase } from "../types";

/** The eight work-up facts the legacy bleeding mapper fabricates, plus the two derived from suspicion. */
const FABRICATED_LEGACY_FACTS = [
  "menstrualHistoryCaptured",
  "contraceptiveHistoryCaptured",
  "sexualHistoryCaptured",
  "speculumExamCompleted",
  "pelvicExamCompleted",
  "coTestCompleted",
  "oralContraceptiveAdjusted",
  "stiTreated",
] as const;

function bleedingCase(overrides: Partial<CanonicalBatchCase> = {}): CanonicalBatchCase {
  return {
    caseId: "case-1",
    patientAge: 42,
    isFirstTimeHPVTransition: false,
    validationStatus: "valid",
    hasAbnormalVaginalBleeding: true,
    bleedingType: "POST_COITAL",
    suspectOralContraceptiveProblem: true,
    stiIdentified: true,
    source: {
      sourceType: "demo",
      mappingVersion: "v1",
      importedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    },
    ...overrides,
  } as CanonicalBatchCase;
}

test("the legacy input still carries its work-up assumptions", () => {
  // Guards the premise of this test file: if the legacy mapper stops fabricating,
  // the stripping below is no longer load-bearing and this file should be revisited.
  const { results } = processBatch([bleedingCase()]);
  const input = results[0].input as unknown as Record<string, unknown>;
  assert.equal(input.speculumExamCompleted, true);
  assert.equal(input.coTestCompleted, true);
  assert.equal(input.stiTreated, true);
});

test("no fabricated work-up fact reaches the canonical fact set", () => {
  const { results } = processBatch([bleedingCase()]);
  const facts = results[0].canonicalFactsV2?.facts ?? {};
  for (const name of FABRICATED_LEGACY_FACTS) {
    assert.equal(
      name in facts,
      false,
      `${name} is fabricated by the legacy bleeding mapper and must not reach canonical facts`
    );
  }
});

test("fabricated facts count is zero across a mixed batch", () => {
  const cases = [
    bleedingCase({ caseId: "a" }),
    bleedingCase({ caseId: "b", stiIdentified: false, suspectOralContraceptiveProblem: false }),
    bleedingCase({ caseId: "c", hasAbnormalVaginalBleeding: false }),
  ];
  const { results } = processBatch(cases);
  let fabricated = 0;
  for (const result of results) {
    for (const name of FABRICATED_LEGACY_FACTS) {
      if (result.canonicalFactsV2?.facts?.[name]) fabricated += 1;
    }
  }
  assert.equal(fabricated, 0, "fabricated clinical facts = 0");
});

test("a genuine source value is preserved, not stripped", () => {
  // stiIdentified is a real observation and must survive; stiTreated is the
  // fabricated completion fact and must not.
  const { results } = processBatch([bleedingCase()]);
  const facts = results[0].canonicalFactsV2?.facts ?? {};
  assert.equal(facts.stiIdentified?.value, true, "a recorded observation must be preserved");
  assert.equal("stiTreated" in facts, false, "a completion inferred from suspicion must not be asserted");
});

test("currentPathway is recorded as DERIVED_ROUTER, never as source or reviewer data", () => {
  const { results } = processBatch([bleedingCase()]);
  const pathway = results[0].canonicalFactsV2?.facts?.currentPathway;
  assert.ok(pathway, "currentPathway must be present: canonical rules require it");
  assert.equal(pathway.source, "DERIVED_ROUTER");
  assert.notEqual(pathway.source, "PRIOR_RECORD");
  assert.notEqual(pathway.source, "REVIEWER_ENTRY");
});

test("the router-derived fact names its router rather than a person", () => {
  const { results } = processBatch([bleedingCase()]);
  const pathway = results[0].canonicalFactsV2?.facts?.currentPathway;
  assert.equal(pathway?.enteredBy, ENGINE_VERSION);
});

test("every other fact keeps the source system's provenance", () => {
  const { results } = processBatch([bleedingCase()]);
  const facts = results[0].canonicalFactsV2?.facts ?? {};
  const nonRouter = Object.entries(facts).filter(([name]) => name !== "currentPathway");
  assert.ok(nonRouter.length > 0);
  for (const [name, fact] of nonRouter) {
    assert.equal(fact.source, "PRIOR_RECORD", `${name} should retain the batch source provenance`);
  }
});

test("no canonical fact is ever recorded as verified by the import", () => {
  const { results } = processBatch([bleedingCase()]);
  for (const [name, fact] of Object.entries(results[0].canonicalFactsV2?.facts ?? {})) {
    assert.equal(
      fact.verificationStatus,
      "UNVERIFIED",
      `${name} must not claim verification the import cannot perform`
    );
  }
});
