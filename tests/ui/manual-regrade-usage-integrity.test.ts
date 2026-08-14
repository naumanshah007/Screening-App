/** Phase 2 manual-regrade metering integration (acceptance M–N). */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");
const read = (relativePath: string) =>
  readFileSync(join(ROOT, relativePath), "utf8");

const ROUTE = read("app/api/batch/runs/[id]/clinical-regrade/route.ts");
const BUTTON = read("components/clinical-rules/ClinicalRuleRegradeButton.tsx");
const METERING = read("lib/usage/manual-regrade.ts");

test("M: opening, editing and cancelling the regrade control never meters usage", () => {
  assert.equal(
    (BUTTON.match(/fetch\(/g) ?? []).length,
    1,
    "the only write request must be the explicit regrade submission"
  );
  assert.match(BUTTON, /async function regrade\(\)[\s\S]*?await fetch\(/);
  assert.match(BUTTON, /onClick=\{\(\) => setOpen\(\(value\) => !value\)\}/);
  assert.doesNotMatch(BUTTON, /recordManualRegradeUsage|recordUsageEvent/);
});

test("M: failed evaluation cannot reach the usage append", () => {
  const newEvaluationPath = ROUTE.slice(ROUTE.indexOf("const next = await evaluateClinicalCase"));
  const evaluateAt = newEvaluationPath.indexOf("const next = await evaluateClinicalCase");
  const persistAt = newEvaluationPath.indexOf("await tx.batchReviewItem.update");
  const meterAt = newEvaluationPath.indexOf("await recordManualRegradeUsage");
  const catchAt = newEvaluationPath.indexOf("} catch (error)");

  assert.ok(evaluateAt >= 0);
  assert.ok(persistAt > evaluateAt, "the immutable evaluation must succeed before item persistence");
  assert.ok(meterAt > persistAt, "metering must follow the successful item persistence");
  assert.ok(catchAt > meterAt, "a thrown evaluation exits to the failure response before metering");
  assert.match(
    ROUTE,
    /MANUAL_REGRADE_EPISODE_REQUIRED[\s\S]*?requireUsageEventEpisode[\s\S]*?for \(const item of run\.items\)/,
    "episode integrity must be preflighted before any evaluator call"
  );
});

test("N: metering records facts only and contains no clinical decision behaviour", () => {
  assert.match(METERING, /eventType: "REGRADE"/);
  assert.match(METERING, /classification: "MANUAL_REGRADE"/);
  assert.doesNotMatch(
    METERING,
    /evaluateClinicalCase|recommendation|riskLevel|urgency|safetyOutcome|matchedRuleIds/,
    "usage metering must not contain or alter any clinical predicate or output"
  );
  assert.doesNotMatch(METERING, /price|amount|cost|currency|billable/i);
});
