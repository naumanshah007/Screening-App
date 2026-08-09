import assert from "node:assert/strict";
import test from "node:test";

import { ClinicalRulesEvaluationBodySchema } from "../../../app/api/clinical-rules/evaluate/route";
import { canonicalV2Corpus } from "./support/canonical-v2-corpus";

test("evaluation API remains backward compatible with legacy fact maps", () => {
  const parsed = ClinicalRulesEvaluationBodySchema.parse({
    facts: { currentPathway: "FIGURE_3", hpvResult: "NOT_DETECTED" },
    ruleVersionId: "legacy-compatible-version",
  });
  assert.ok(parsed.facts);
  assert.equal(parsed.canonicalFactsV2, undefined);
});

test("evaluation API accepts explicitly pinned CanonicalClinicalFactsV2", () => {
  const parsed = ClinicalRulesEvaluationBodySchema.parse({
    canonicalFactsV2: canonicalV2Corpus[0].canonicalFacts,
    ruleVersionId: "successor-version",
    evaluationMode: "SIMULATION",
  });
  assert.equal(parsed.canonicalFactsV2?.schemaId, "canonical-clinical-facts-v2");
});

test("evaluation API rejects ambiguous representations and unpinned V2 inputs", () => {
  const canonicalFactsV2 = canonicalV2Corpus[0].canonicalFacts;
  assert.equal(
    ClinicalRulesEvaluationBodySchema.safeParse({ canonicalFactsV2 }).success,
    false
  );
  assert.equal(
    ClinicalRulesEvaluationBodySchema.safeParse({
      facts: {},
      canonicalFactsV2,
      ruleVersionId: "successor-version",
    }).success,
    false
  );
});
