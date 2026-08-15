import assert from "node:assert/strict";
import test from "node:test";

import { minimizePersistedBatchCase } from "@/lib/batch/persistence";
import type { CanonicalBatchCase } from "@/lib/batch/types";

test("caseJson minimisation removes duplicate identity but retains clinical inputs", () => {
  const source: CanonicalBatchCase = {
    caseId: "case-1",
    patientName: "Synthetic Person",
    nhi: "ZZZ0001",
    gpPractice: "Synthetic Practice",
    receivedDate: "2026-08-15T00:00:00.000Z",
    source: {
      sourceType: "json",
      sourceSystem: "synthetic-source",
      sourceFileName: "synthetic.json",
      importedAt: "2026-08-15T00:00:00.000Z",
      rowNumber: 1,
      externalPatientId: "ZZZ0001",
      mappingVersion: "test-v1",
      engineVersion: "test-engine",
      sourceEpisodeKey: "specimen-1",
      sourceFacility: "Synthetic Lab",
      testType: "HPV",
      collectedOn: "2026-08-14T00:00:00.000Z",
    },
    patientAge: 41,
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
    hpvResult: "HPV_16_18",
    consecutiveNegativeCoTestCount: 0,
    consecutiveLowGradeCount: 0,
    unsatisfactoryCytologyCount: 0,
    validationStatus: "valid",
    validationErrors: [],
    validationWarnings: [],
  };

  const minimized = minimizePersistedBatchCase(source);
  assert.equal(minimized.patientName, undefined);
  assert.equal(minimized.nhi, undefined);
  assert.equal(minimized.source.externalPatientId, undefined);
  assert.equal(minimized.source.sourceEpisodeKey, undefined);
  assert.equal(minimized.hpvResult, "HPV_16_18");
  assert.equal(minimized.patientAge, 41);
  assert.equal(minimized.source.sourceFileName, "synthetic.json");
});
