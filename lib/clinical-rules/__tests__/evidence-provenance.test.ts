/**
 * Evidence provenance, and the one rule that makes it load-bearing.
 *
 * Provenance that only DESCRIBES a fact changes nothing: an assumed sample type
 * labelled SYNTHETIC_DEMO was still the fact that satisfied F3-03 and produced
 * every HPV16/18 referral. The rule that matters is structural — an ASSUMED fact
 * is never KNOWN, so it never enters the evaluated fact map, so it cannot
 * satisfy a governed predicate.
 *
 * The schema enforces that directly, which is why it is tested here rather than
 * only at the call site.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CanonicalFactV2Schema,
  canonicalClinicalFactsV2FromFlatFacts,
  canonicalClinicalFactsV2ToFactMap,
} from "../canonical-facts-v2";
import { loadGovernedSnapshot } from "../governed-snapshot-store";
import {
  TIMING_VOCABULARY,
  classifyTiming,
  conditionalUrgency,
  urgencyFromTiming,
} from "../governed-vocabulary";
import { CHCH_PUBLIC_DATASET } from "@/lib/batch/chch-public-dataset";
import { canonicalFactsForCase, mapCanonicalToClinicalInput } from "@/lib/batch/processor";

const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");

test("the schema refuses an ASSUMED fact that claims to be KNOWN", () => {
  assert.throws(
    () =>
      CanonicalFactV2Schema.parse({
        value: "LBC",
        status: "KNOWN",
        source: "SYNTHETIC_DEMO",
        evidenceClass: "ASSUMED",
        recordedAt: new Date().toISOString(),
        enteredBy: "test",
        verificationStatus: "UNVERIFIED",
        corrections: [],
      }),
    /ASSUMED fact may never be KNOWN/,
    "an assumption that can be evaluated is not an assumption, it is a claim"
  );
});

test("a non-KNOWN fact may not carry an evaluable value", () => {
  assert.throws(
    () =>
      CanonicalFactV2Schema.parse({
        value: "LBC",
        status: "NOT_RECORDED",
        source: "SYNTHETIC_DEMO",
        recordedAt: new Date().toISOString(),
        enteredBy: "test",
        verificationStatus: "UNVERIFIED",
        corrections: [],
      }),
    /must not carry a value/
  );
});

test("evidence class, source and verification are three separate questions", () => {
  const facts = canonicalClinicalFactsV2FromFlatFacts({
    subjectReference: "case-1",
    facts: { hpvResult: "HPV_16", sampleType: "LBC", eventStage: "INITIAL" },
    source: "PRIOR_RECORD",
    enteredBy: "test",
    assumedFacts: new Set(["sampleType"]),
    sourceFacts: { hpvResult: "Sheet1!E4" },
    derivedFacts: { eventStage: "chch-public-v2" },
  });
  assert.equal(facts.facts.hpvResult.evidenceClass, "SOURCE");
  assert.equal(facts.facts.hpvResult.sourceCell, "Sheet1!E4");
  assert.equal(facts.facts.hpvResult.source, "PRIOR_RECORD", "who supplied it is a separate axis");
  assert.equal(facts.facts.hpvResult.verificationStatus, "UNVERIFIED", "so is whether it was checked");

  assert.equal(facts.facts.eventStage.evidenceClass, "DERIVED");
  assert.equal(facts.facts.eventStage.derivation, "chch-public-v2");

  assert.equal(facts.facts.sampleType.evidenceClass, "ASSUMED");
  assert.equal(facts.facts.sampleType.status, "NOT_RECORDED");
  assert.equal(facts.facts.sampleType.value, undefined);
});

test("an unclassified fact is not silently relabelled as source evidence", () => {
  const facts = canonicalClinicalFactsV2FromFlatFacts({
    subjectReference: "case-1",
    facts: { hpvResult: "HPV_16" },
    source: "PRIOR_RECORD",
    enteredBy: "test",
  });
  assert.equal(
    facts.facts.hpvResult.evidenceClass,
    undefined,
    "a caller that classified nothing must not have its facts promoted to SOURCE"
  );
});

test("no ASSUMED fact on any CHCH case reaches the evaluated fact map", () => {
  for (const batchCase of CHCH_PUBLIC_DATASET) {
    const facts = canonicalFactsForCase({
      batchCase,
      input: mapCanonicalToClinicalInput(batchCase),
      currentPathway: "FIGURE_3",
    });
    const { factMap } = canonicalClinicalFactsV2ToFactMap(facts, snapshot);
    for (const [name, fact] of Object.entries(facts.facts)) {
      if (fact.evidenceClass !== "ASSUMED") continue;
      assert.equal(
        factMap[name],
        undefined,
        `${batchCase.source.externalPatientId}: assumed ${name} must not be evaluable`
      );
    }
  }
});

test("unknown never becomes false, zero, normal or negative on a CHCH case", () => {
  // The specific silent conversions the rulebook names.
  const forbidden: Record<string, unknown[]> = {
    sampleType: ["LBC"],
    cervixPresent: [true],
    isPostHysterectomy: [false],
    immunocompromised: [false],
    immuneClassification: ["IMMUNE_COMPETENT"],
    consecutiveQualifyingNegativeCoTests: [0],
    consecutiveLowGradeCytologyResults: [0],
    consecutiveUnsatisfactoryCount: [0],
    isFirstCytologyToHpvTransition: [false],
    isActiveHsilTestOfCure: [false],
  };
  for (const batchCase of CHCH_PUBLIC_DATASET) {
    const facts = canonicalFactsForCase({
      batchCase,
      input: mapCanonicalToClinicalInput(batchCase),
      currentPathway: "FIGURE_3",
    });
    const { factMap } = canonicalClinicalFactsV2ToFactMap(facts, snapshot);
    for (const [name, values] of Object.entries(forbidden)) {
      if (factMap[name] === undefined) continue;
      assert.ok(
        !values.includes(factMap[name]),
        `${batchCase.source.externalPatientId}: ${name} was evaluated as ${JSON.stringify(factMap[name])}, which the source never stated`
      );
    }
  }
});

// ─── Conditional timing: completeness ───────────────────────────────────────

test("no conditional timing yields urgency from its wording alone", () => {
  for (const [literal, classification] of Object.entries(TIMING_VOCABULARY)) {
    if (classification.kind !== "CONDITIONAL") continue;
    assert.equal(
      urgencyFromTiming(classification),
      "NOT_STATED",
      `${JSON.stringify(literal)} must not assert urgency without evaluating its condition`
    );
  }
});

test("a conditional urgent limb needs facts, and absent facts never escalate", () => {
  // Every conditional literal that records an urgent limb, evaluated against an
  // EMPTY fact set. None may escalate: with nothing known, nothing is
  // established, and failing upward to an urgent patient is a fabricated claim.
  const withUrgentLimb = Object.entries(TIMING_VOCABULARY).filter(
    ([, classification]) =>
      classification.kind === "CONDITIONAL" && Boolean(classification.escalatesWhen)
  );
  assert.ok(withUrgentLimb.length > 0, "the vocabulary must still contain urgent limbs");
  for (const [literal] of withUrgentLimb) {
    assert.equal(
      conditionalUrgency(literal, {}),
      "NOT_STATED",
      `${JSON.stringify(literal)} escalated on no evidence at all`
    );
  }
});

test("every conditional timing routes to clinician determination, not a default date", () => {
  for (const [literal, classification] of Object.entries(TIMING_VOCABULARY)) {
    if (classification.kind !== "CONDITIONAL") continue;
    assert.equal(classifyTiming(literal).kind, "CONDITIONAL");
  }
});
