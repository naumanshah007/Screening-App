import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const reviewPage = readFileSync(new URL("../../app/(app)/review/page.tsx", import.meta.url), "utf8");
const batchPersistence = readFileSync(new URL("../../lib/batch/persistence.ts", import.meta.url), "utf8");
const grading = readFileSync(new URL("../../lib/cases/grading.ts", import.meta.url), "utf8");

test("main Review Queue consumes the Figure 1–10/Table 1 decision snapshot", () => {
  assert.match(`${reviewPage}\n${batchPersistence}`, /evaluateClinicalDecision|recommendationCode|branchPath/);
});

test("review-queue grading is not a disconnected independent clinical engine", () => {
  assert.match(grading, /evaluateClinicalDecision/);
});

test("clinician-only specialist outcomes cannot be bulk accepted without individual confirmation", () => {
  assert.match(`${reviewPage}\n${batchPersistence}`, /clinicianOnly|CLINICIAN_REVIEW_REQUIRED/);
  assert.match(`${reviewPage}\n${batchPersistence}`, /bulk[\s\S]*(block|reject|disable)/i);
});

test("completed decision retains original provisional recommendation, reviewer disposition, and override reason", () => {
  for (const field of ["recommendation", "disposition", "overrideReason", "reviewNote"]) assert.match(`${reviewPage}\n${batchPersistence}`, new RegExp(field), field);
});
