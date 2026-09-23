/**
 * The CHCH source rows are an oracle, and this file is what makes them one.
 *
 * The dataset's whole failure mode is that any disagreement between the engine
 * and the partner's expected answer can be removed by editing the INPUT until
 * the expected answer appears. Every assertion below pins an input to what the
 * workbook actually says, so an edit made to regain agreement fails here rather
 * than passing quietly.
 *
 * Source: CerviGrade_SurveyGrid_30_Synthetic_Patients.xlsx, Sheet1!A4:I33.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CHCH_SOURCE_EVIDENCE,
  chchSourceEvidence,
  chchWorksheetRow,
} from "../chch-source-records";
import { CHCH_PUBLIC_DATASET } from "../chch-public-dataset";
import {
  canonicalHpvFactValue,
  currentCytologyResult,
  isHpv16Or18,
  legacyHpvResult,
  type SourceCytologyState,
} from "../source-evidence";
import { canonicalFactsForCase, mapCanonicalToClinicalInput } from "../processor";
import { minimizePersistedBatchCase } from "../persistence";

function caseFor(id: string) {
  const found = CHCH_PUBLIC_DATASET.find((c) => c.source.externalPatientId === id);
  assert.ok(found, `${id} missing from CHCH_PUBLIC_DATASET`);
  return found;
}

// ─── 1. The 30 source rows, exactly ─────────────────────────────────────────

test("there are exactly 30 source rows, chch-001 to chch-030, on worksheet rows 4-33", () => {
  assert.equal(CHCH_SOURCE_EVIDENCE.length, 30);
  CHCH_SOURCE_EVIDENCE.forEach((row, index) => {
    assert.equal(row.caseId, `chch-${String(index + 1).padStart(3, "0")}`);
    // The header is worksheet row 3, so the first case is row 4 — not row 1,
    // and not the case ordinal.
    assert.equal(row.locator?.row, index + 4);
    assert.equal(chchWorksheetRow(index + 1), index + 4);
  });
});

test("the four source text columns are held verbatim for every case", () => {
  for (const row of CHCH_SOURCE_EVIDENCE) {
    for (const field of [
      row.screenCircumstanceText,
      row.hpvResultText,
      row.cytologyFollowUpText,
      row.relevantHistoryText,
    ]) {
      assert.equal(typeof field, "string");
      assert.ok(field.length > 0, `${row.caseId} has an empty source cell`);
      assert.equal(field, field.trim(), `${row.caseId} source text must not be re-trimmed`);
    }
  }
});

test("a sample of exact source cells matches the workbook", () => {
  const expected: Record<string, [string, string, string, string]> = {
    // caseId: [circumstance, hpv, cytology/follow-up, history]
    "chch-001": ["First HPV screen", "HPV 16 positive", "Cytology pending", "No previous CIN"],
    "chch-007": [
      "Post-treatment surveillance",
      "HPV 16 positive",
      "Negative cytology",
      "Treated CIN3 three years ago",
    ],
    "chch-009": [
      "Overdue follow-up",
      "HPV 16 positive (previous)",
      "No new sample",
      "Follow-up overdue by 5 months",
    ],
    "chch-010": [
      "Current routine screen",
      "HPV not detected",
      "Current screen negative",
      "Previous HPV16 positive; colposcopy outcome not documented",
    ],
    "chch-027": [
      "Follow-up screen",
      "HPV not detected",
      "Negative cytology previously",
      "Previous non-16/18 hrHPV positive; follow-up now HPV negative",
    ],
  };
  for (const [caseId, [circumstance, hpv, cytology, history]] of Object.entries(expected)) {
    const row = chchSourceEvidence(caseId);
    assert.equal(row.screenCircumstanceText, circumstance);
    assert.equal(row.hpvResultText, hpv);
    assert.equal(row.cytologyFollowUpText, cytology);
    assert.equal(row.relevantHistoryText, history);
  }
});

test("every case carries its source evidence and 22 distinct histories survive", () => {
  for (const c of CHCH_PUBLIC_DATASET) {
    assert.ok(c.sourceEvidence, `${c.source.externalPatientId} lost its source evidence`);
    assert.equal(c.sourceEvidence?.caseId, c.source.externalPatientId);
  }
  const histories = new Set(
    CHCH_SOURCE_EVIDENCE.map((row) => row.relevantHistoryText)
  );
  assert.equal(histories.size, 22, "the workbook has 22 distinct history/context strings");
});

// ─── 2. HPV16 vs HPV18 survives the whole pipeline ──────────────────────────

test("HPV16 and HPV18 are recorded separately, never as one grouped value", () => {
  const sixteen = ["chch-001", "chch-003", "chch-007", "chch-011", "chch-013", "chch-015", "chch-018"];
  const eighteen = ["chch-002", "chch-005", "chch-008", "chch-012", "chch-014", "chch-016", "chch-019"];
  for (const id of sixteen) assert.equal(chchSourceEvidence(id).hpvGenotype, "HPV_16", id);
  for (const id of eighteen) assert.equal(chchSourceEvidence(id).hpvGenotype, "HPV_18", id);
  // No CHCH row reports a grouped 16-or-18 result, so none may claim one.
  for (const row of CHCH_SOURCE_EVIDENCE) {
    assert.notEqual(row.hpvGenotype, "HPV_16_OR_18_UNSPECIFIED", row.caseId);
  }
});

test("the grouped legacy value is a projection at the engine boundary only", () => {
  for (const id of ["chch-001", "chch-002"]) {
    const c = caseFor(id);
    // The legacy engine has no HPV_16/HPV_18 member, so it sees the group...
    assert.equal(c.hpvResult, "HPV_16_18");
    assert.equal(mapCanonicalToClinicalInput(c).hpvResult, "HPV_16_18");
    // ...while the precise genotype is still on the case.
    assert.equal(c.sourceEvidence?.hpvGenotype, id === "chch-001" ? "HPV_16" : "HPV_18");
  }
  assert.equal(legacyHpvResult("HPV_16"), "HPV_16_18");
  assert.equal(legacyHpvResult("HPV_18"), "HPV_16_18");
  assert.equal(legacyHpvResult("HPV_16_OR_18_UNSPECIFIED"), "HPV_16_18");
  assert.equal(legacyHpvResult("HPV_OTHER"), "HPV_OTHER");
  assert.equal(legacyHpvResult("NOT_DETECTED"), "NOT_DETECTED");
});

test("a grouped source report never means both genotypes were detected", () => {
  assert.equal(canonicalHpvFactValue("HPV_16_OR_18_UNSPECIFIED"), "HPV_16_18");
  assert.equal(canonicalHpvFactValue("HPV_16"), "HPV_16");
  assert.equal(canonicalHpvFactValue("HPV_18"), "HPV_18");
  // The helper groups all three for a rule predicate without merging them.
  assert.ok(isHpv16Or18("HPV_16"));
  assert.ok(isHpv16Or18("HPV_18"));
  assert.ok(isHpv16Or18("HPV_16_OR_18_UNSPECIFIED"));
  assert.ok(!isHpv16Or18("HPV_OTHER"));
  assert.ok(!isHpv16Or18(undefined));
});

test("the governed evaluation receives the precise genotype, not the group", () => {
  for (const [id, expected] of [
    ["chch-001", "HPV_16"],
    ["chch-002", "HPV_18"],
    ["chch-004", "HPV_OTHER"],
    ["chch-020", "NOT_DETECTED"],
  ] as const) {
    const c = caseFor(id);
    const facts = canonicalFactsForCase({
      batchCase: c,
      input: mapCanonicalToClinicalInput(c),
      currentPathway: "FIGURE_3",
    });
    assert.equal(facts.facts.hpvResult?.value, expected, id);
  }
});

test("the precise genotype survives persistence minimisation", () => {
  const c = caseFor("chch-002");
  const stored = minimizePersistedBatchCase(c);
  assert.equal(stored.sourceEvidence?.hpvGenotype, "HPV_18");
  // Round-tripped through JSON exactly as it is persisted.
  const roundTripped = JSON.parse(JSON.stringify(stored));
  assert.equal(roundTripped.sourceEvidence.hpvGenotype, "HPV_18");
  // Identity is held in dedicated columns, not duplicated inside the JSON.
  assert.equal(roundTripped.sourceEvidence.patientName, undefined);
  assert.equal(roundTripped.sourceEvidence.age, undefined);
});

test("chch-009's previous HPV16 result is not carried as a current one", () => {
  const evidence = chchSourceEvidence("chch-009");
  assert.equal(evidence.hpvIsCurrentResult, false);
  assert.equal(evidence.hpvGenotype, undefined);
  assert.equal(caseFor("chch-009").hpvResult, undefined);
});

// ─── 3. Cytology states ─────────────────────────────────────────────────────

test("every distinct cytology state in the source is represented", () => {
  const expected: Record<string, SourceCytologyState> = {
    "chch-001": "PENDING",
    "chch-002": "AVAILABLE",
    "chch-008": "MISSING",
    "chch-009": "NO_CURRENT_SAMPLE",
    "chch-010": "UNSPECIFIED",
    "chch-016": "UNSATISFACTORY",
    "chch-021": "NOT_REQUIRED",
    "chch-022": "NOT_REQUIRED",
    "chch-023": "NOT_REQUIRED",
    "chch-024": "NOT_REQUIRED",
    "chch-027": "PRIOR_ONLY",
    "chch-028": "NOT_REQUIRED",
    "chch-030": "NOT_REQUIRED",
  };
  for (const [id, state] of Object.entries(expected)) {
    assert.equal(chchSourceEvidence(id).cytologyState, state, id);
  }
  // All eight states are covered by the dataset plus the AVAILABLE rows.
  const present = new Set(CHCH_SOURCE_EVIDENCE.map((row) => row.cytologyState));
  for (const state of [
    "AVAILABLE",
    "PENDING",
    "MISSING",
    "NOT_REQUIRED",
    "NO_CURRENT_SAMPLE",
    "PRIOR_ONLY",
    "UNSATISFACTORY",
    "UNSPECIFIED",
  ] as const) {
    assert.ok(present.has(state), `no CHCH case exercises the ${state} cytology state`);
  }
});

test("only a genuine current result populates the engine's cytologyResult", () => {
  for (const id of ["chch-001", "chch-008", "chch-009", "chch-010", "chch-021", "chch-027"]) {
    assert.equal(
      caseFor(id).cytologyResult,
      undefined,
      `${id} has no current cytology result and must not carry one`
    );
  }
  assert.equal(caseFor("chch-002").cytologyResult, "NEGATIVE");
  assert.equal(caseFor("chch-003").cytologyResult, "HSIL");
  assert.equal(caseFor("chch-016").cytologyResult, "UNSATISFACTORY");
});

test("chch-027's previous negative cytology never becomes a current result", () => {
  const evidence = chchSourceEvidence("chch-027");
  assert.equal(evidence.cytologyState, "PRIOR_ONLY");
  assert.equal(evidence.priorCytologyResult, "NEGATIVE");
  assert.equal(evidence.cytologyResult, undefined);
  assert.equal(currentCytologyResult(evidence), undefined);
  assert.equal(caseFor("chch-027").cytologyResult, undefined);
});

test("chch-010's 'Current screen negative' is not read as negative cytology", () => {
  const evidence = chchSourceEvidence("chch-010");
  assert.equal(evidence.cytologyFollowUpText, "Current screen negative");
  assert.equal(evidence.cytologyState, "UNSPECIFIED");
  assert.equal(caseFor("chch-010").cytologyResult, undefined);
});

// ─── 4. History is not strengthened ─────────────────────────────────────────

test("chch-001's 'No previous CIN' does not become a normal screening history", () => {
  const c = caseFor("chch-001");
  assert.notEqual(c.priorScreeningHistory, "NEGATIVE_OR_NORMAL");
  assert.equal(c.priorScreeningHistory, undefined);
  assert.notEqual(c.screeningHistoryKnown, true);
});

test("chch-005 records a prior HPV episode without claiming HPV18 persistence", () => {
  const c = caseFor("chch-005");
  // The source says "HPV positive 12 months earlier" — genotype unspecified.
  assert.notEqual(c.previousHpv1618Episode, true);
  assert.doesNotMatch(c.label ?? "", /persistent/i, "the label must not claim persistence");
  // chch-013 is the contrast: it says HPV16 was ALSO detected 12 months ago.
  assert.equal(caseFor("chch-013").previousHpv1618Episode, true);
});

test("chch-008's sample age is not read as history availability", () => {
  const c = caseFor("chch-008");
  assert.equal(c.historySourceAvailable, undefined);
  assert.notEqual(c.historySourceAvailable, true);
  assert.equal(chchSourceEvidence("chch-008").relevantHistoryText, "Sample collected 18 days ago");
});

test("chch-014's 'No prior CIN recorded' is not read as history unavailable", () => {
  const c = caseFor("chch-014");
  assert.equal(c.historySourceAvailable, undefined);
  assert.notEqual(c.historySourceAvailable, false);
});

test("chch-019 invents neither a first repeat nor HPV18 persistence", () => {
  const c = caseFor("chch-019");
  // "Routine screening" states no ordinal and no interval.
  assert.notEqual(c.repeatStage, "FIRST_REPEAT");
  assert.equal(c.repeatContext, undefined);
  // The previous HPV18 result is recorded as an HPV episode, not as disease.
  assert.equal(c.previousHpv1618Episode, true);
  assert.notEqual(c.priorHighGradeResult, true);
  assert.notEqual(c.previousHSILCIN23, true);
  // "follow-up documentation incomplete" is not "history sources unavailable".
  assert.equal(c.historySourceAvailable, undefined);
  assert.doesNotMatch(c.label ?? "", /persistent/i);
});

test("chch-028's normal follow-up is not a formal return to regular screening", () => {
  const c = caseFor("chch-028");
  assert.notEqual(c.priorScreeningHistory, "LOW_GRADE_RETURNED_TO_REGULAR");
  assert.equal(c.priorScreeningHistory, undefined);
  // The ASC-US itself IS stated and is retained.
  assert.equal(c.priorLowGradeResult, true);
});

test("the 009, 010 and 018 safety fixes are retained", () => {
  for (const id of ["chch-009", "chch-010", "chch-019"]) {
    const c = caseFor(id);
    assert.equal(c.previousHpv1618Episode, true, id);
    assert.notEqual(c.priorHighGradeResult, true, id);
    assert.notEqual(c.previousHSILCIN23, true, id);
  }
  // chch-010: the colposcopy outcome is undocumented, which is unknown, not
  // false. false would assert the colposcopy did not happen.
  assert.equal(caseFor("chch-010").colposcopyCompletedForLastRecommendation, undefined);
  // chch-018: CIN2 is stated, treatment is not, so Test of Cure is not assumed.
  const eighteen = caseFor("chch-018");
  assert.equal(eighteen.previousHSILCIN23, true);
  assert.notEqual(eighteen.isTestOfCure, true);
  assert.equal(eighteen.repeatContext, undefined);
});

test("chch-007 keeps treated CIN3 without an invented treatment date or stage", () => {
  const c = caseFor("chch-007");
  assert.equal(c.previousHSILCIN23, true);
  assert.equal(c.priorHighGradeResult, true);
  assert.equal(c.isTestOfCure, true);
  // "three years ago" is a relative statement. No exact date, no ordinal.
  assert.equal(c.testOfCureStage, undefined);
  assert.equal(c.testOfCureStatus, undefined);
  assert.equal(
    mapCanonicalToClinicalInput(c).treatmentDate,
    undefined,
    "an exact treatment date must never be manufactured"
  );
});

test("no case is given immune competence to obtain a five-year recall", () => {
  for (const c of CHCH_PUBLIC_DATASET) {
    const facts = canonicalFactsForCase({
      batchCase: c,
      input: mapCanonicalToClinicalInput(c),
      currentPathway: "FIGURE_3",
    });
    assert.equal(
      facts.facts.immuneClassification,
      undefined,
      `${c.source.externalPatientId}: a legacy false flag must not become verified immune competence`
    );
  }
});

// ─── 5. Identity ────────────────────────────────────────────────────────────

test("a chch case identifier is declared synthetic and never stored as an NHI", () => {
  for (const c of CHCH_PUBLIC_DATASET) {
    assert.equal(c.identifierKind, "SYNTHETIC_CASE");
    assert.equal(c.nhi, undefined, `${c.source.externalPatientId} must not carry an NHI`);
    assert.match(c.source.externalPatientId ?? "", /^chch-\d{3}$/);
    // Persistence writes `nhi` only for an identifier that IS an NHI, so the
    // stored value for these cases is null.
    assert.notEqual(c.identifierKind, "NHI");
  }
});

// ─── 6. Labels are built from the source, not the other way round ───────────

test("every label is assembled from the case's own source cells", () => {
  for (const c of CHCH_PUBLIC_DATASET) {
    const evidence = c.sourceEvidence!;
    assert.ok(
      c.label?.includes(evidence.screenCircumstanceText) &&
        c.label?.includes(evidence.hpvResultText),
      `${evidence.caseId}: the label must be derived from the source row`
    );
  }
});
