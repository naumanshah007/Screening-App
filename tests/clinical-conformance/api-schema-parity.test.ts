import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const types = readFileSync(new URL("../../lib/engine/types.ts", import.meta.url), "utf8");
const batchTypes = readFileSync(new URL("../../lib/batch/types.ts", import.meta.url), "utf8");
const batchValidation = readFileSync(new URL("../../lib/batch/validation.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../../app/api/pathway/sessions/[id]/complete/route.ts", import.meta.url), "utf8");

test("API/engine contract represents immune status as true/false/unknown", () => {
  assert.match(types, /immunocompromised\?:\s*boolean|immunocompromised:\s*boolean\s*\|\s*undefined/);
  assert.doesNotMatch(batchValidation, /immunocompromised:\s*booleanCoerce\.default\(false\)/);
});

test("API/engine contract includes DES exposure and its specialist provenance", () => {
  assert.match(types, /diethylstilbestrol|desExposure/i);
  assert.match(batchTypes, /diethylstilbestrol|desExposure/i);
  assert.match(api, /diethylstilbestrol|desExposure/i);
});

test("API contract carries exact date of birth/age-at-event rather than only rounded integer age", () => {
  assert.match(types, /dateOfBirth/);
  assert.match(types, /screeningDate|testDate|eventDate/);
});

test("API/batch contract distinguishes invalid from unsuitable HPV results", () => {
  assert.match(types, /"INVALID"/);
  assert.match(types, /"UNSUITABLE"/);
  assert.match(batchTypes, /"INVALID"/);
  assert.match(batchTypes, /"UNSUITABLE"/);
});

test("API contract carries AIS margin, pre-treatment HPV, cancer history, and clinician-source provenance", () => {
  for (const field of ["marginStatus", "preTreatmentHpv", "gynaecologicalCancerHistory", "biopsySource", "mdmSource"]) assert.match(`${types}\n${api}`, new RegExp(field, "i"), field);
});
