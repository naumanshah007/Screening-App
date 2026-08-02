import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_CLINICAL_FACTS_V2_SCHEMA_ID,
  CanonicalClinicalFactsV2Schema,
  canonicalClinicalFactsV2FromFlatFacts,
  canonicalClinicalFactsV2JsonSchema,
  canonicalClinicalFactsV2ToFactMap,
} from "../canonical-facts-v2";
import { evaluateCanonicalClinicalFactsV2 } from "../evaluator";
import { buildSuccessorSnapshotFromV21Package } from "../successor-v3-1";
import {
  canonicalV2Corpus,
  legacyInputGapCaseIds,
} from "./support/canonical-v2-corpus";

test("CanonicalClinicalFactsV2 preserves explicit status and provenance", async () => {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  const input = CanonicalClinicalFactsV2Schema.parse({
    schemaId: CANONICAL_CLINICAL_FACTS_V2_SCHEMA_ID,
    subjectReference: "SYNTHETIC-STATUS",
    capturedAt: "2026-08-03T00:00:00.000Z",
    facts: {
      currentPathway: {
        value: "FIGURE_3",
        status: "KNOWN",
        source: "REVIEWER_ENTRY",
        recordedAt: "2026-08-03T00:00:00.000Z",
        enteredBy: "reviewer-1",
        verifiedBy: "reviewer-2",
        verificationStatus: "REVIEWER_VERIFIED",
        sourceDocumentId: "synthetic-record-1",
      },
      hpvResult: {
        status: "UNKNOWN",
        source: "LAB_RESULT",
        recordedAt: "2026-08-03T00:00:00.000Z",
        enteredBy: "lab-interface",
        verificationStatus: "SOURCE_VERIFIED",
      },
    },
  });
  const converted = canonicalClinicalFactsV2ToFactMap(input, snapshot);
  assert.equal(converted.factMap.currentPathway, "FIGURE_3");
  assert.equal("hpvResult" in converted.factMap, false);
  assert.ok(converted.diagnostics.factsMissing.includes("hpvResult"));
  assert.equal(converted.diagnostics.provenance.hpvResult, "LAB_RESULT");
});

test("unknown facts never become false and conflicting facts force review", async () => {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  const input = CanonicalClinicalFactsV2Schema.parse({
    schemaId: CANONICAL_CLINICAL_FACTS_V2_SCHEMA_ID,
    subjectReference: "SYNTHETIC-CONFLICT",
    capturedAt: "2026-08-03T00:00:00.000Z",
    facts: {
      currentPathway: {
        value: "FIGURE_3",
        status: "KNOWN",
        source: "SYNTHETIC_DEMO",
        recordedAt: "2026-08-03T00:00:00.000Z",
        enteredBy: "test",
        verificationStatus: "UNVERIFIED",
      },
      hpvResult: {
        status: "CONFLICTING",
        source: "LAB_RESULT",
        recordedAt: "2026-08-03T00:00:00.000Z",
        enteredBy: "test",
        verificationStatus: "CONFLICTING",
      },
    },
  });
  const evaluated = evaluateCanonicalClinicalFactsV2(snapshot, input);
  assert.deepEqual(evaluated.result.matchedRuleIds, []);
  assert.match(evaluated.result.provisionalRecommendation, /Conflicting canonical clinical facts/);
  assert.deepEqual(evaluated.result.factDiagnostics?.factsConflicting, ["hpvResult"]);
});

test("flat adapter records only supplied facts and publishes JSON Schema", () => {
  const adapted = canonicalClinicalFactsV2FromFlatFacts({
    subjectReference: "SYNTHETIC-ADAPTER",
    facts: { explicitFalse: false, explicitZero: 0, absent: undefined },
    recordedAt: "2026-08-03T00:00:00.000Z",
  });
  assert.equal(adapted.facts.explicitFalse.value, false);
  assert.equal(adapted.facts.explicitZero.value, 0);
  assert.equal("absent" in adapted.facts, false);
  assert.equal(canonicalClinicalFactsV2JsonSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
});

test("all 179 source-oracle cases have validated native V2 fixtures", () => {
  assert.equal(canonicalV2Corpus.length, 179);
  assert.equal(legacyInputGapCaseIds.length, 18);
  for (const fixture of canonicalV2Corpus) {
    assert.doesNotThrow(() => CanonicalClinicalFactsV2Schema.parse(fixture.canonicalFacts), fixture.caseId);
  }
});
