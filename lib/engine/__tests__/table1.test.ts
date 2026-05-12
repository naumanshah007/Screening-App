import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTable1 } from "../decision-engine";
import { baseInput } from "./helpers";

const total = { isPostHysterectomy: true, hysterectomyType: "TOTAL" as const };

test("Table 1 negative/returned regular history with no pathology needs no further screening", () => {
  const decision = evaluateTable1(baseInput({
    ...total,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
    hysterectomyIndication: "BENIGN_GYNAECOLOGICAL_DISEASE",
    hysterectomySpecimenPathology: "NO_CERVICAL_PATHOLOGY",
    screeningHistoryKnown: true,
  }));

  assert.equal(decision.recommendationCode, "T1-NEG-RETURNED-NO-PATH-NO-FURTHER");
});

test("Table 1 previous ASC-US/LSIL not returned with low-grade specimen follows Figure 3 after HPV test", () => {
  const decision = evaluateTable1(baseInput({
    ...total,
    priorScreeningHistory: "LOW_GRADE_NOT_RETURNED_TO_REGULAR",
    hysterectomyIndication: "BENIGN_GYNAECOLOGICAL_DISEASE",
    hysterectomySpecimenPathology: "LSIL_CIN1",
  }));

  assert.equal(decision.recommendationCode, "T1-LOWGRADE-NOT-RETURNED-LSIL-HPV");
});

test("Table 1 complete vs incomplete high-grade excision routes to ToC or colposcopy", () => {
  const complete = evaluateTable1(baseInput({
    ...total,
    priorScreeningHistory: "HIGH_GRADE_TOC_COMPLETE",
    hysterectomySpecimenPathology: "HSIL_CIN23",
    excisionStatus: "COMPLETE",
  }));
  const incomplete = evaluateTable1(baseInput({
    ...total,
    priorScreeningHistory: "HIGH_GRADE_TOC_COMPLETE",
    hysterectomySpecimenPathology: "AIS",
    excisionStatus: "INCOMPLETE",
  }));

  assert.equal(complete.recommendationCode, "T1-HSIL-AIS-COMPLETE-TOC");
  assert.equal(incomplete.recommendationCode, "T1-HSIL-AIS-INCOMPLETE-COLP");
});

test("Table 1 incomplete Test of Cure with no/low-grade pathology continues Test of Cure", () => {
  const decision = evaluateTable1(baseInput({
    ...total,
    priorScreeningHistory: "HIGH_GRADE_TOC_INCOMPLETE",
    hysterectomySpecimenPathology: "LSIL_CIN1",
  }));

  assert.equal(decision.recommendationCode, "T1-INCOMPLETE-TOC-NO-PATH-LOWGRADE-TOC");
});

test("Table 1 no known screening history with no/low-grade pathology schedules HPV at 6 months post hysterectomy", () => {
  const decision = evaluateTable1(baseInput({
    ...total,
    priorScreeningHistory: "NO_KNOWN_SCREENING_HISTORY",
    hysterectomySpecimenPathology: "NO_CERVICAL_PATHOLOGY",
  }));

  assert.equal(decision.recommendationCode, "T1-NO-HISTORY-NO-PATH-LOWGRADE-HPV-6M");
});

test("Table 1 untreated/incompletely treated HSIL/AIS with low-grade pathology routes to Test of Cure", () => {
  const decision = evaluateTable1(baseInput({
    ...total,
    priorScreeningHistory: "HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED",
    hysterectomySpecimenPathology: "LSIL_CIN1",
  }));

  assert.equal(decision.recommendationCode, "T1-UNTREATED-HSIL-AIS-NO-PATH-LOWGRADE-TOC");
});

test("Table 1 unknown high-grade excision status requires review rather than guessing", () => {
  const decision = evaluateTable1(baseInput({
    ...total,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
    hysterectomySpecimenPathology: "HSIL_CIN23",
    excisionStatus: "UNKNOWN",
  }));

  assert.equal(decision.recommendationCode, "T1-HSIL-AIS-EXCISION-UNKNOWN-REVIEW");
  assert.equal(decision.safetyOutcome, "INSUFFICIENT_INFORMATION");
});
