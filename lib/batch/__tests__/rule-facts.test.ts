import test from "node:test";
import assert from "node:assert/strict";

import { buildBatchRuleFacts, gradeCanonicalCase } from "@/lib/batch/rule-facts";
import { getBaselineCaseRuleReleaseDefinition } from "@/lib/cases/rule-policy";
import type { CanonicalBatchCase } from "@/lib/batch/types";

const COLPO = getBaselineCaseRuleReleaseDefinition("COLPOSCOPY");

function makeCase(overrides: Partial<CanonicalBatchCase>): CanonicalBatchCase {
  return {
    caseId: "t",
    source: {
      sourceType: "hl7",
      sourceSystem: "test",
      mappingVersion: "v1",
      engineVersion: "v1",
      rowNumber: 1,
      importedAt: new Date().toISOString(),
    },
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
    consecutiveNegativeCoTestCount: 0,
    consecutiveLowGradeCount: 0,
    unsatisfactoryCytologyCount: 0,
    validationStatus: "valid",
    validationErrors: [],
    validationWarnings: [],
    ...overrides,
  };
}

test("rule-facts: HPV 16/18 + HSIL emits expected labels", () => {
  const facts = buildBatchRuleFacts(makeCase({ hpvResult: "HPV_16_18", cytologyResult: "HSIL" }));
  const labels = facts.map((f) => f.label);
  assert.ok(labels.includes("HPV 16/18"));
  assert.ok(labels.includes("HSIL"));
});

test("rule-facts: SCC cytology maps to cancer suspicion; immunocompromised flag", () => {
  const labels = buildBatchRuleFacts(makeCase({ cytologyResult: "SCC", immunocompromised: true })).map((f) => f.label);
  assert.ok(labels.includes("Cancer suspicion cytology"));
  assert.ok(labels.includes("Immune deficient"));
});

test("grade: SCC cytology escalates to high-suspicion P1_HSC", () => {
  const r = gradeCanonicalCase({ ruleDefinition: COLPO, batchCase: makeCase({ hpvResult: "HPV_16_18", cytologyResult: "SCC" }) });
  assert.equal(r.recommendation.priority, "P1_HSC");
});

test("grade: HPV 16/18 with negative cytology → P2 (COL-004)", () => {
  const r = gradeCanonicalCase({ ruleDefinition: COLPO, batchCase: makeCase({ hpvResult: "HPV_16_18", cytologyResult: "NEGATIVE" }) });
  assert.equal(r.recommendation.priority, "P2");
});

test("grade: HPV Other low-grade → routine P3", () => {
  const r = gradeCanonicalCase({ ruleDefinition: COLPO, batchCase: makeCase({ hpvResult: "HPV_OTHER", cytologyResult: "LSIL" }) });
  assert.equal(r.recommendation.priority, "P3");
});

test("grade: no actionable facts → default INFO_REQUIRED", () => {
  const r = gradeCanonicalCase({ ruleDefinition: COLPO, batchCase: makeCase({ hpvResult: "NOT_DETECTED" }) });
  assert.equal(r.recommendation.priority, "INFO_REQUIRED");
  assert.equal(r.matchedRuleCode, null);
});
