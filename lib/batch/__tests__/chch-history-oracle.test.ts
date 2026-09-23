/**
 * The 22 distinct history/context strings, as the oracle.
 *
 * `outputs/cervigrade-audit-20260923/history-context-22.md` is read at test time
 * and parsed, so this cannot drift from the audit: if a string in the dataset
 * stops matching the workbook, or a case moves between history groups, the test
 * fails against the document rather than against a second transcription.
 *
 * The second half asserts the MODELLING rule the audit is really about: a scoped
 * negative is not a positive claim. "No previous CIN" is not a normal screening
 * history, "No prior CIN recorded" is not "history sources unavailable", and
 * "subsequent normal follow-up" is not a formal discharge.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CHCH_SOURCE_EVIDENCE, chchSourceEvidence } from "../chch-source-records";
import { CHCH_PUBLIC_DATASET } from "../chch-public-dataset";

const ORACLE = join(
  __dirname,
  "..",
  "..",
  "..",
  "outputs",
  "cervigrade-audit-20260923",
  "history-context-22.md"
);

/** Parse the audit table into: exact history string → the case IDs carrying it. */
function oracleHistories(): Map<string, string[]> {
  const rows = readFileSync(ORACLE, "utf8")
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Exact source value") && !line.startsWith("|---"));
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const cells = row.split("|").map((cell) => cell.trim());
    const value = cells[1];
    const ids = (cells[2] ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    if (!value || ids.length === 0) continue;
    map.set(value, ids);
  }
  return map;
}

function caseFor(id: string) {
  const found = CHCH_PUBLIC_DATASET.find((c) => c.source.externalPatientId === id);
  assert.ok(found, `${id} missing from CHCH_PUBLIC_DATASET`);
  return found;
}

test("the audit records exactly 22 distinct history strings", () => {
  assert.equal(oracleHistories().size, 22);
});

test("every history string matches the audit, character for character", () => {
  for (const [value, ids] of oracleHistories()) {
    for (const id of ids) {
      assert.equal(
        chchSourceEvidence(id).relevantHistoryText,
        value,
        `${id}: history text does not match the audit oracle`
      );
    }
  }
});

test("every case is accounted for by exactly one history group", () => {
  const assigned = [...oracleHistories().values()].flat().sort();
  const all = CHCH_SOURCE_EVIDENCE.map((row) => row.caseId).sort();
  assert.deepEqual(assigned, all, "the audit's grouping must cover all 30 cases once each");
});

// ─── The modelling rule: a scoped negative is not a positive claim ──────────

test("'No previous CIN' does not become a normal screening history", () => {
  for (const id of ["chch-001", "chch-025", "chch-029"]) {
    const evidence = chchSourceEvidence(id);
    assert.equal(evidence.history.noPreviousCinStated, true, id);
    assert.equal(
      evidence.history.previousNormalScreeningResult,
      undefined,
      `${id}: absence of CIN is not a recorded normal result`
    );
    assert.notEqual(caseFor(id).priorScreeningHistory, "NEGATIVE_OR_NORMAL", id);
  }
});

test("'No previous abnormality' is a scoped negative, not a prior normal result", () => {
  for (const id of ["chch-004", "chch-006", "chch-011", "chch-021", "chch-026"]) {
    const evidence = chchSourceEvidence(id);
    assert.equal(evidence.history.noPreviousAbnormalityStated, true, id);
    assert.equal(evidence.history.previousNormalScreeningResult, undefined, id);
    assert.equal(caseFor(id).priorScreeningHistory, undefined, id);
  }
});

test("only a reported previous normal/negative RESULT sets the history category", () => {
  for (const id of ["chch-003", "chch-012", "chch-017", "chch-022", "chch-024"]) {
    assert.equal(chchSourceEvidence(id).history.previousNormalScreeningResult, true, id);
    assert.equal(caseFor(id).priorScreeningHistory, "NEGATIVE_OR_NORMAL", id);
  }
});

test("'No prior CIN recorded' is absent documentation, not absent history sources", () => {
  const evidence = chchSourceEvidence("chch-014");
  assert.equal(evidence.history.noPriorCinRecordedStated, true);
  assert.equal(evidence.history.noPreviousCinStated, undefined, "recorded absence is not absence");
  assert.equal(caseFor("chch-014").historySourceAvailable, undefined);
});

test("a sample age is not a statement about history availability", () => {
  assert.equal(chchSourceEvidence("chch-008").history.sampleAgeDays, 18);
  assert.equal(caseFor("chch-008").historySourceAvailable, undefined);
});

test("previous and current HPV genotypes are held separately", () => {
  // chch-005: the source says "HPV positive 12 months earlier" — no genotype.
  const five = chchSourceEvidence("chch-005");
  assert.equal(five.hpvGenotype, "HPV_18", "the CURRENT result is HPV18");
  assert.equal(five.history.previousHpvGenotype, undefined, "the PREVIOUS genotype is unstated");
  assert.equal(five.history.previousHpvPositiveUnspecifiedGenotype, true);
  assert.equal(five.history.sameGenotypePersistence, undefined, "persistence is not established");

  // chch-013: the source says HPV16 was ALSO detected 12 months ago.
  const thirteen = chchSourceEvidence("chch-013");
  assert.equal(thirteen.hpvGenotype, "HPV_16");
  assert.equal(thirteen.history.previousHpvGenotype, "HPV_16");
  assert.equal(thirteen.history.sameGenotypePersistence, true);

  // chch-009: a PREVIOUS HPV16 with no current result at all.
  const nine = chchSourceEvidence("chch-009");
  assert.equal(nine.hpvGenotype, undefined);
  assert.equal(nine.hpvIsCurrentResult, false);
  assert.equal(nine.history.previousHpvGenotype, "HPV_16");
});

test("CIN2 and CIN3 are distinguished, and treatment is separate from both", () => {
  const seven = chchSourceEvidence("chch-007").history;
  assert.equal(seven.priorCin3, true);
  assert.equal(seven.priorCin2, undefined);
  assert.equal(seven.treatmentOccurred, true, "the source states treatment");
  assert.equal(seven.treatmentDatePrecision, "RELATIVE", "'three years ago' is not a date");
  assert.equal(seven.treatmentRelativeYears, 3);
  assert.equal(seven.postTreatmentSurveillance, true);

  const eighteen = chchSourceEvidence("chch-018").history;
  assert.equal(eighteen.priorCin2, true);
  assert.equal(eighteen.priorCin3, undefined);
  assert.equal(
    eighteen.treatmentOccurred,
    undefined,
    "CIN2 under surveillance says nothing about treatment"
  );
  assert.equal(eighteen.postColposcopySurveillance, true);
});

test("an undocumented outcome and incomplete documentation are different facts", () => {
  assert.equal(chchSourceEvidence("chch-010").history.unresolvedReferralOutcome, true);
  assert.equal(
    chchSourceEvidence("chch-019").history.followUpDocumentationIncomplete,
    true
  );
  assert.equal(
    chchSourceEvidence("chch-019").history.unresolvedReferralOutcome,
    undefined,
    "incomplete documentation is not an unresolved referral"
  );
  assert.equal(chchSourceEvidence("chch-009").history.overdueByMonths, 5);
});

test("subsequent normal follow-up is not a formal return to regular screening", () => {
  const evidence = chchSourceEvidence("chch-028").history;
  assert.equal(evidence.priorLowGradeResult, "ASC_US");
  assert.equal(evidence.priorLowGradeTiming, "SEVERAL_YEARS");
  assert.equal(evidence.subsequentNormalFollowUp, true);
  assert.notEqual(
    caseFor("chch-028").priorScreeningHistory,
    "LOW_GRADE_RETURNED_TO_REGULAR",
    "a narrative normal follow-up is not a recorded discharge decision"
  );
});

test("'no high-grade history' is not a prior normal result", () => {
  const evidence = chchSourceEvidence("chch-020").history;
  assert.equal(evidence.priorScreeningUpToDate, true);
  assert.equal(evidence.noHighGradeHistoryStated, true);
  assert.equal(evidence.previousNormalScreeningResult, undefined);
  assert.equal(caseFor("chch-020").priorScreeningHistory, undefined);
});
