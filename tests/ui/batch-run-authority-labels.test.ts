/**
 * Batch run header must not invert authority.
 *
 * THE DEFECT THIS LOCKS
 * ---------------------
 * The run header hardcoded "Legacy engine (authoritative)" against the router
 * version and "Versioned shadow (not authoritative)" against the governed
 * ruleset. Once a run's items were decided by the governed ruleset that was
 * exactly backwards — it named the router as the clinical authority and the
 * ruleset that produced every recommendation as a non-authoritative shadow.
 *
 * A reviewer reading that header would conclude a canonical decision was a
 * legacy one, which is precisely the mixed-authority confusion this work exists
 * to remove.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PAGE = readFileSync(
  join(ROOT, "app", "(app)", "batch", "runs", "[id]", "page.tsx"),
  "utf8"
);

test("authority labels are conditional, never hardcoded", () => {
  assert.doesNotMatch(
    PAGE,
    /label="Legacy engine \(authoritative\)"/,
    "the router must not be unconditionally labelled the clinical authority"
  );
  assert.doesNotMatch(
    PAGE,
    /label="Versioned shadow \(not authoritative\)"/,
    "the governed ruleset must not be unconditionally labelled a non-authoritative shadow"
  );
  assert.match(
    PAGE,
    /runIsCanonical/,
    "the header must decide its labelling from the run's actual authority"
  );
});

test("a canonical run names the governed ruleset as authoritative", () => {
  assert.match(
    PAGE,
    /runIsCanonical\s*\?\s*"Current governed rules \(authoritative\)"/,
    "a canonical run must name the governed ruleset as the authority"
  );
  assert.match(
    PAGE,
    /runIsCanonical\s*\?\s*"Pathway routing \(not the recommendation authority\)"/,
    "a canonical run must describe the legacy engine as routing only"
  );
});

test("run authority is derived from persisted item state", () => {
  // Not from the presence of a pinned version — a run can carry a pinned
  // version while its items were still decided by the legacy engine, which is
  // exactly how the original defect presented.
  assert.match(
    PAGE,
    /run\.items\.every\([\s\S]{0,160}authorityEngine === "CANONICAL"[\s\S]{0,80}ruleEvaluationId/,
    "canonical status must require every item to record a governed evaluation"
  );
  assert.match(
    PAGE,
    /run\.items\.length > 0/,
    "an empty run must not be reported as canonical"
  );
});

test("a historical run keeps its truthful previous-rules labelling", () => {
  // The false branch must still exist: historical runs must identify the
  // previous grading rules as authoritative without surfacing internal labels.
  assert.match(
    PAGE,
    /:\s*"Previous grading rules \(authoritative\)"/,
    "a non-canonical run must still identify its actual grading authority"
  );
});
