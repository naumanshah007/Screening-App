/**
 * Fabrication boundary for the authority-sensitive execution path.
 *
 * Database-free: exercises the pure helpers the orchestrator uses to build
 * canonical facts, which is where fabrication would enter.
 */

import test from "node:test";
import assert from "node:assert/strict";

import type { ClinicalInput } from "../../engine/types";
import {
  FABRICATED_LEGACY_FACT_NAMES,
  withoutFabricatedFacts,
} from "../graded-decision";
import { canonicalClinicalFactsV2FromFlatFacts } from "../canonical-facts-v2";
import { normalizeClinicalFactMap } from "../facts";

function bleedingInput(): ClinicalInput {
  return {
    patientId: "p1",
    patientAge: 42,
    isFirstTimeHPVTransition: false,
    hasAbnormalVaginalBleeding: true,
    stiIdentified: true,
    suspectOralContraceptiveProblem: true,
    // The legacy bleeding mapper sets all of these.
    menstrualHistoryCaptured: true,
    contraceptiveHistoryCaptured: true,
    sexualHistoryCaptured: true,
    speculumExamCompleted: true,
    pelvicExamCompleted: true,
    coTestCompleted: true,
    oralContraceptiveAdjusted: true,
    stiTreated: true,
  } as ClinicalInput;
}

test("withoutFabricatedFacts removes every legacy work-up assumption", () => {
  const stripped = withoutFabricatedFacts(bleedingInput());
  for (const name of FABRICATED_LEGACY_FACT_NAMES) {
    assert.equal(name in stripped, false, `${name} must be stripped`);
  }
});

test("withoutFabricatedFacts preserves genuine observations", () => {
  const stripped = withoutFabricatedFacts(bleedingInput());
  assert.equal(stripped.stiIdentified, true, "a recorded observation must survive");
  assert.equal(stripped.hasAbnormalVaginalBleeding, true);
  assert.equal(stripped.patientAge, 42);
});

test("no fabricated fact survives into the canonical fact set", () => {
  const facts = canonicalClinicalFactsV2FromFlatFacts({
    subjectReference: "p1",
    facts: normalizeClinicalFactMap({
      ...withoutFabricatedFacts(bleedingInput()),
      currentPathway: "FIGURE_10",
    }),
    source: "REVIEWER_ENTRY",
    enteredBy: "user-1",
    routerEngine: "business-figures-table1-v1",
  }).facts;

  let fabricated = 0;
  for (const name of FABRICATED_LEGACY_FACT_NAMES) if (name in facts) fabricated += 1;
  assert.equal(fabricated, 0, "fabricated clinical facts = 0");
});

test("the orchestrator's pathway fact is router-derived", () => {
  const facts = canonicalClinicalFactsV2FromFlatFacts({
    subjectReference: "p1",
    facts: normalizeClinicalFactMap({
      ...withoutFabricatedFacts(bleedingInput()),
      currentPathway: "FIGURE_10",
    }),
    source: "REVIEWER_ENTRY",
    enteredBy: "user-1",
    routerEngine: "business-figures-table1-v1",
  }).facts;

  assert.equal(facts.currentPathway?.source, "DERIVED_ROUTER");
  assert.equal(facts.currentPathway?.enteredBy, "business-figures-table1-v1");
  // The clinician's own entries keep their provenance.
  assert.equal(facts.stiIdentified?.source, "REVIEWER_ENTRY");
  assert.equal(facts.stiIdentified?.enteredBy, "user-1");
});

test("the fabricated-fact list matches the legacy mapper's assumptions", () => {
  // Guards against the list drifting from lib/batch/processor.ts.
  assert.deepEqual([...FABRICATED_LEGACY_FACT_NAMES], [
    "menstrualHistoryCaptured",
    "contraceptiveHistoryCaptured",
    "sexualHistoryCaptured",
    "speculumExamCompleted",
    "pelvicExamCompleted",
    "coTestCompleted",
    "oralContraceptiveAdjusted",
    "stiTreated",
  ]);
});
