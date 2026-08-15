/**
 * Phase 1C: what the intake screen does with a classification.
 *
 * The classification rules themselves are covered by unit and database tests.
 * What this locks is the workflow contract — the places where getting it wrong
 * would either lose a result or silently change a decision a clinician has
 * already made.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const PREVIEW = read("components/batch/BatchValidationPreview.tsx");
const PANEL = read("components/batch/BatchActionPanel.tsx");
const CLASSIFY_ROUTE = read("app/api/batch/episodes/classify/route.ts");
const PAGE = read("app/(app)/batch/BatchPageClient.tsx");
const PERSISTENCE = read("lib/batch/persistence.ts");
const GRADED = read("lib/clinical-rules/graded-decision.ts");

test("classification is a read, and cannot write", () => {
  assert.match(CLASSIFY_ROUTE, /export async function POST/);
  for (const forbidden of ["saveBatchRun", "recordEpisodeObservation", "prisma."]) {
    assert.ok(
      !CLASSIFY_ROUTE.includes(forbidden),
      `the classify endpoint must not persist anything (found ${forbidden})`
    );
  }
  assert.match(
    CLASSIFY_ROUTE,
    /if \(!session\?\.user\)/,
    "it reads episode history, so it must require a session"
  );
});

test("a failed classification is visible and blocks preparation until duplicate awareness is restored", () => {
  // File-first pilot intake cannot truthfully default an unavailable history
  // check to "everything is new". The rows remain visible and editable, while
  // only the preparation action is held.
  assert.match(
    PAGE,
    /setClassificationStatus\("error"\)/,
    "classification failure must become explicit UI state"
  );
  assert.match(
    PANEL,
    /disabled=\{selectedCount === 0 \|\| processing \|\| Boolean\(classificationUnavailableReason\)\}/,
    "preparation must wait for duplicate awareness"
  );
  assert.match(PANEL, /Episode history check required/);
});

test("already-decided cases are deselected by default, not removed or disabled", () => {
  assert.match(PREVIEW, /const blockedCaseIds = useMemo/);
  assert.match(
    PREVIEW,
    /if \(isDeselectedByDefault\(key\)\) return false;/,
    "a blocked row must start unselected"
  );
  // The row must still be in the table and still togglable.
  assert.doesNotMatch(
    PREVIEW,
    /disabled=\{isDeselectedByDefault/,
    "a blocked row must not be disabled — the reviewer may still choose it"
  );
  assert.match(
    PREVIEW,
    /setReviewerTouched\(\(prev\) => new Set\(prev\)\.add\(key\)\)/,
    "once the reviewer toggles a row, their choice must override the default"
  );
  assert.match(
    PREVIEW,
    /if \(reviewerTouched\.has\(key\)\) return false;/,
    "the default must yield to the reviewer"
  );
});

test("only a strong match can deselect; a resemblance never does", () => {
  // blockedCaseIds is built solely from `processable`, which the classifier sets
  // false only for COMPLETED and ALREADY_IN_REVIEW.
  assert.match(
    PREVIEW,
    /if \(!hint\.processable && hint\.caseId\) blocked\.add\(hint\.caseId\)/,
    "deselection must follow processable, not classification name-matching"
  );
  const CLASSIFIER = read("lib/batch/episode-classification.ts");
  assert.match(
    CLASSIFIER,
    /classification: "POSSIBLE_DUPLICATE",[\s\S]{0,400}processable: true/,
    "a possible duplicate must remain processable"
  );
});

test("the summary reports every arrival, not just the selection", () => {
  assert.match(PANEL, /episodeSummary\.received/);
  assert.match(PANEL, /already in review/);
  assert.match(PANEL, /possible duplicate/);
  assert.match(
    PANEL,
    /\.filter\(\(\[, count\]\) => count > 0\)/,
    "zero categories must not be printed as noise"
  );
});

test("a row chip explains the match in source terms", () => {
  assert.match(
    PREVIEW,
    /title=\{hint\.explanation\}/,
    "the chip must carry the explanation, which names the accession and facility"
  );
  assert.match(
    PREVIEW,
    /if \(!hint \|\| hint\.classification === "NEW"\) return null;/,
    "NEW needs no chip — on a first pull every row is new"
  );
});

test("an updated result appends to the evaluation chain and never overwrites", () => {
  assert.match(
    PERSISTENCE,
    /const supersedes = await findPriorEvaluationForEpisode\(/,
    "an amended result must find what it supersedes"
  );
  assert.match(
    PERSISTENCE,
    /previousEvaluationId: supersedes\.id/,
    "and link to it"
  );
  assert.match(
    PERSISTENCE,
    /regradeReason:\s*\n?\s*"Updated result received for the same episode/,
    "a linked evaluation requires a reason"
  );
  // It must never update or delete an existing evaluation.
  assert.ok(
    !/ruleEvaluation\.update|ruleEvaluation\.delete/.test(PERSISTENCE),
    "a prior evaluation must never be mutated — it is the decision that was acted on"
  );
  assert.match(
    GRADED,
    /previousEvaluationId: args\.previousEvaluationId,\s*\n\s*regradeReason: args\.regradeReason,/,
    "the link must reach the evaluator"
  );
});

test("an item can never supersede itself", () => {
  assert.match(
    PERSISTENCE,
    /id: \{ not: currentItemId \}/,
    "excluded explicitly, not left to depend on write ordering"
  );
});
