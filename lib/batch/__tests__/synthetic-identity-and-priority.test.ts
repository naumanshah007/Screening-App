/**
 * Two things that must never escape the evaluation build.
 *
 * 1. A synthetic case identifier presented as an NHI. Historical CHCH rows were
 *    persisted while `nhi` fell back to the external patient ID, so the column
 *    still holds "chch-001" for every one of them. The fix for new writes did
 *    nothing for those rows, and the drawer keyed its NHI label on the mere
 *    presence of that column.
 *
 * 2. An unsupported P1/P2 leaving through an export. Hiding it in the drawer
 *    left it in the decision package, the simulated PAS update, the CSV and the
 *    Completed Decisions table, where it reads as a booking instruction.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { reconstructBatchCaseResult } from "../persistence";
import {
  isSupportedUrgentPriority,
  presentableReferralPriority,
} from "@/lib/clinical-rules/priority-provenance";
import {
  buildSimulatedDecisionPackage,
  isUrgentClinicalPriority,
} from "@/lib/decisions/package-generator";

const ROOT = join(__dirname, "..", "..", "..");
const DETAIL = readFileSync(
  join(ROOT, "components", "batch", "BatchResultDetail.tsx"),
  "utf8"
);

// ─── Historical rows: identity and source inputs ────────────────────────────

/** A row exactly as the pre-fix code persisted it: chch-001 in the NHI column. */
function historicalChchItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    rowNumber: 1,
    label: "First HPV screen — HPV 16 positive, cytology pending",
    externalPatientId: "chch-001",
    patientName: "Aroha T.",
    patientAge: 34,
    // The defect: the synthetic case ID was promoted into the NHI column.
    nhi: "chch-001",
    gpPractice: null,
    receivedDate: null,
    sourceEpisodeKey: null,
    sourceFacility: null,
    testType: null,
    collectedOn: null,
    engineStatus: "success",
    authorityEngine: "LEGACY",
    authorityReason: null,
    legacyDecisionJson: null,
    ruleEvaluation: null,
    // caseJson from before source evidence existed.
    caseJson: JSON.stringify({
      caseId: "uuid-1",
      source: {
        sourceType: "chchPublic",
        rowNumber: 1,
        importedAt: "2026-09-22T09:00:00.000Z",
        mappingVersion: "chch-public-v1",
        engineVersion: "business-figures-table1-v1",
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
    }),
    inputJson: JSON.stringify({ hpvResult: "HPV_16_18", sampleType: "LBC" }),
    decisionJson: JSON.stringify({
      figure: "FIGURE_3",
      riskLevel: "HIGH",
      recommendation: "Refer to colposcopy.",
      recommendationCode: "F3-1618-COLP",
      nextAction: "Refer.",
      referralPriority: "P2",
    }),
    ...overrides,
  };
}

test("a historical chch row is reconstructed as a case ID, never an NHI", () => {
  const result = reconstructBatchCaseResult(
    historicalChchItem() as Parameters<typeof reconstructBatchCaseResult>[0]
  );
  assert.equal(
    result.case.nhi,
    undefined,
    "a synthetic case identifier must not survive as an NHI, whatever column it landed in"
  );
  assert.equal(result.case.identifierKind, "SYNTHETIC_CASE");
  assert.equal(result.case.source.externalPatientId, "chch-001");
  // The stored clinical decision is untouched by the read-side correction.
  assert.equal(result.decision.recommendationCode, "F3-1618-COLP");
  assert.equal(result.decision.referralPriority, "P2");
});

test("a genuine NHI is left alone", () => {
  const result = reconstructBatchCaseResult(
    historicalChchItem({
      externalPatientId: "EXT-9",
      nhi: "ABC1234",
      caseJson: JSON.stringify({
        caseId: "uuid-2",
        source: {
          sourceType: "csv",
          rowNumber: 1,
          importedAt: "2026-09-22T09:00:00.000Z",
          mappingVersion: "csv-v1",
          engineVersion: "business-figures-table1-v1",
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
      }),
    }) as Parameters<typeof reconstructBatchCaseResult>[0]
  );
  assert.equal(result.case.nhi, "ABC1234", "a real NHI must be preserved");
  assert.notEqual(result.case.identifierKind, "SYNTHETIC_CASE");
});

test("the drawer keys its NHI label on identifier kind, not column presence", () => {
  assert.match(
    DETAIL,
    /const identifierIsNhi = c\.identifierKind === "NHI" \|\| Boolean\(c\.nhi\)/,
    "the label must require the identifier to actually be an NHI"
  );
  assert.match(DETAIL, /identifierIsNhi \? "NHI" : "Case"/);
});

test("a case without source evidence shows no source inputs at all", () => {
  // The previous fallback listed ClinicalInput values under "Source inputs", so
  // a row whose source said "HPV 16 positive" displayed "HPV 16 18" under the
  // caption "Exactly as the source states them".
  const section = DETAIL.slice(
    DETAIL.indexOf("const sourceInputs"),
    DETAIL.indexOf("// ── 4. Why")
  );
  assert.doesNotMatch(
    section,
    /inp\?\.hpvResult|inp\?\.cytologyResult/,
    "engine values must never be pushed into Source inputs"
  );
  assert.ok(
    DETAIL.includes("No source record is held for this case."),
    "the empty state must say so plainly"
  );
});

// ─── Priority provenance ────────────────────────────────────────────────────

test("a priority with no governed provenance is not presentable", () => {
  assert.equal(
    presentableReferralPriority({ authorityEngine: "LEGACY", referralPriority: "P1" }),
    null,
    "a legacy genotype-only P1 has no cited policy behind it"
  );
  assert.equal(
    presentableReferralPriority({ authorityEngine: "CANONICAL", referralPriority: "P1" }),
    "P1"
  );
  assert.equal(
    presentableReferralPriority({ authorityEngine: "CANONICAL", referralPriority: null }),
    null
  );
});

test("urgency is never inferred from risk level or safety severity", () => {
  assert.equal(
    isSupportedUrgentPriority({ authorityEngine: "LEGACY", referralPriority: "P1" }),
    false
  );
  assert.equal(
    isUrgentClinicalPriority({
      riskLevel: "URGENT",
      referralPriority: null,
      authorityEngine: "LEGACY",
    }),
    false,
    "a legacy routing URGENT is not a booking urgency"
  );
  assert.equal(
    isUrgentClinicalPriority({
      riskLevel: "NOT_ASSESSED",
      referralPriority: "P1",
      authorityEngine: "CANONICAL",
    }),
    true
  );
});

test("an unsupported priority does not reach the export package or PAS update", () => {
  const pkg = buildSimulatedDecisionPackage({
    id: "item-1",
    batchRunId: "run-1",
    patientName: "Aroha T.",
    nhi: null,
    externalPatientId: "chch-001",
    patientAge: 34,
    gpPractice: null,
    recommendation: "Refer to colposcopy.",
    recommendationCode: "F3-1618-COLP",
    // The legacy genotype-only priority, exactly as it is still persisted.
    referralPriority: "P2",
    referralType: "COLPOSCOPY",
    riskLevel: "HIGH",
    disposition: "ACCEPTED",
    reviewedAt: new Date("2026-09-23T02:30:00.000Z"),
    reviewNote: null,
    overrideReason: null,
    authorityEngine: "LEGACY",
    authorityReason: null,
    reviewedBy: { id: "r1", name: "Reviewer", email: "r@example.com", role: "GYNAE_GRADER" },
    batchRun: {
      source: "chchPublic",
      sourceSystem: "CHCH Public",
      engineVersion: "business-figures-table1-v1",
      pinnedRuleVersionDisplay: null,
      pinnedRuleVersionId: null,
      pinnedRulesetChecksum: null,
    },
  } as Parameters<typeof buildSimulatedDecisionPackage>[0]);

  assert.notEqual(pkg.pasUpdate.priority, "P2", "a legacy priority must not become a PAS priority");
  assert.notEqual(
    pkg.pasUpdate.priority,
    "HIGH",
    "and the risk level must not be published as one either"
  );
  assert.equal(pkg.pasUpdate.priority, "Not stated");

  const csv = JSON.stringify(pkg.csvExportRow);
  assert.ok(!csv.includes('"P2"'), "the CSV row must not carry an unsupported priority");
});
