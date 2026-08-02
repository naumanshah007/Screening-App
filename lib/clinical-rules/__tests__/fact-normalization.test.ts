import assert from "node:assert/strict";
import test from "node:test";

import { normalizeClinicalFactMap } from "../facts";

test("legacy HPV 16/18 and exact age are translated without losing the exit-test invariant", () => {
  const facts = normalizeClinicalFactMap({
    currentFigure: "FIGURE_3",
    patientAge: 72,
    hpvResult: "HPV_16_18",
  });
  assert.equal(facts.currentPathway, "FIGURE_3");
  assert.equal(facts.ageYears, 72);
  assert.equal(facts.hpvResult, "HPV_16_18");
  assert.equal(facts.isExitTest, true);
});

test("legacy false immune flag never becomes verified immune competent", () => {
  const facts = normalizeClinicalFactMap({
    currentFigure: "FIGURE_3",
    hpvResult: "NOT_DETECTED",
    immunocompromised: false,
  });
  assert.equal(Object.hasOwn(facts, "immuneClassification"), false);
});

test("missing sample type and missing treatment date remain absent", () => {
  const facts = normalizeClinicalFactMap({
    currentFigure: "FIGURE_6",
    hpvResult: "NOT_DETECTED",
    isTestOfCure: true,
  });
  assert.equal(Object.hasOwn(facts, "sampleType"), false);
  assert.equal(Object.hasOwn(facts, "treatmentDate"), false);
  assert.equal(Object.hasOwn(facts, "treatmentConfirmed"), false);
});

test("legacy SCC cytology is normalized to the malignant-cytology category", () => {
  const facts = normalizeClinicalFactMap({
    currentFigure: "FIGURE_3",
    cytologyResult: "SCC",
  });
  assert.equal(facts.cytologyResult, "DEFINITE_INVASIVE_CANCER");
});

test("existing canonical facts take precedence over legacy aliases", () => {
  const facts = normalizeClinicalFactMap({
    currentFigure: "FIGURE_3",
    currentPathway: "FIGURE_10",
    patientAge: 50,
    ageYears: 51,
  });
  assert.equal(facts.currentPathway, "FIGURE_10");
  assert.equal(facts.ageYears, 51);
});
