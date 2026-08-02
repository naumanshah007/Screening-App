import assert from "node:assert/strict";
import test from "node:test";

import { evaluateClinicalDecision } from "@/lib/engine/decision-engine";
import type { ClinicalInput } from "@/lib/engine/types";

import { evaluateClinicalSnapshot } from "../evaluator";
import { normalizeClinicalFactMap } from "../facts";
import { buildSnapshotFromV21Package } from "../source-package";

const snapshotPromise = buildSnapshotFromV21Package().then((built) => built.snapshot);

function legacyInput(overrides: Partial<ClinicalInput>): ClinicalInput {
  return {
    patientId: "shadow-comparison",
    patientAge: 40,
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    atypicalEndometrialHistory: false,
    immunocompromised: false,
    consecutiveNegativeCoTestCount: 0,
    consecutiveLowGradeCount: 0,
    unsatisfactoryCytologyCount: 0,
    ...overrides,
  };
}

const CASES: Array<{
  id: string;
  input: ClinicalInput;
  canonicalRule?: string;
  canonicalRecommendation: RegExp;
  legacyCode: string;
}> = [
  {
    id: "EXIT-TEST-HPV-DETECTED-AGE-72",
    input: legacyInput({
      patientAge: 72,
      currentFigure: "FIGURE_3",
      hpvResult: "HPV_16_18",
      sampleType: "LBC",
    }),
    canonicalRule: "F3-16",
    canonicalRecommendation: /colposcopy/i,
    legacyCode: "AGE-70-74-DEFERRED",
  },
  {
    id: "UNKNOWN-IMMUNE-STATUS-HPV-NOT-DETECTED",
    input: legacyInput({
      currentFigure: "FIGURE_3",
      hpvResult: "NOT_DETECTED",
      sampleType: "LBC",
    }),
    canonicalRecommendation: /insufficient governed executable rule coverage/i,
    legacyCode: "F3-HPV-NOT-DETECTED-5Y",
  },
  {
    id: "TEST-OF-CURE-MISSING-TREATMENT-ANCHOR",
    input: legacyInput({
      currentFigure: "FIGURE_6",
      isTestOfCure: true,
      testOfCureStatus: "REQUIRED",
      hpvResult: "NOT_DETECTED",
      cytologyResult: "NEGATIVE",
    }),
    canonicalRule: "F6-12",
    canonicalRecommendation: /request treatment records/i,
    legacyCode: "F6-FIRST-NEGATIVE-REPEAT-12M",
  },
  {
    id: "PREGNANCY-MALIGNANT-CYTOLOGY",
    input: legacyInput({
      currentFigure: "FIGURE_9",
      isPregnant: true,
      hpvResult: "HPV_16_18",
      cytologyResult: "SCC",
    }),
    canonicalRule: "F9-14",
    canonicalRecommendation: /urgent experienced colposcopy and oncology\/MDT/i,
    legacyCode: "F9-QUALIFYING-CYTOLOGY-REQUIRED",
  },
];

for (const comparison of CASES) {
  test(`shadow mismatch ${comparison.id} remains explicit`, async () => {
    const snapshot = await snapshotPromise;
    const canonical = evaluateClinicalSnapshot(
      snapshot,
      normalizeClinicalFactMap(
        comparison.input as unknown as Record<string, unknown>
      )
    );
    const legacy = evaluateClinicalDecision(comparison.input);

    assert.equal(canonical.matchedRules[0]?.stableRuleId, comparison.canonicalRule);
    assert.match(
      canonical.result.provisionalRecommendation,
      comparison.canonicalRecommendation
    );
    assert.equal(legacy.recommendationCode, comparison.legacyCode);
    assert.notEqual(
      canonical.result.provisionalRecommendation,
      legacy.recommendation,
      "a resolved shadow difference must not silently collapse"
    );
    assert.equal(canonical.result.mandatoryReviewerConfirmation, true);
  });
}
