/**
 * "Urgent" must mean one thing across the intake-to-review workflow.
 *
 * The intake summary counted urgent by risk level alone, while the Review Queue
 * and Command Centre count urgent risk OR a P1 referral priority. A Test of
 * Cure case carrying HIGH risk with a P1 referral was therefore urgent in one
 * screen and not urgent in the next, two clicks apart, with neither screen
 * saying which sense of the word it meant. An evaluator comparing the two
 * reasonably asks which number is wrong; the answer was "neither", which is the
 * worst kind of inconsistency to leave in a clinical tool.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

const STAT_CARDS = read("components/batch/BatchStatCards.tsx");
const PERSISTENCE = read("lib/batch/persistence.ts");

test("the intake summary counts urgent by risk OR P1 priority, matching the Review Queue", () => {
  assert.match(
    STAT_CARDS,
    /riskLevel === "URGENT"/,
    "urgent risk must count toward the urgent tally"
  );
  assert.match(
    STAT_CARDS,
    /referralPriority === "P1"/,
    "a P1 referral must count toward the urgent tally"
  );
  // P1_HSC is deliberately absent here: it is a booking-rules priority from
  // lib/cases and cannot occur on a ClinicalDecision, whose ReferralPriority is
  // P1..P4. The queue predicate accepts it because that column can also be
  // written by the booking path; matching it in this component would be dead
  // code, and the typechecker rejects it outright.
  assert.doesNotMatch(
    STAT_CARDS,
    /decision\.referralPriority === "P1_HSC"/,
    "P1_HSC is unreachable on a ClinicalDecision and must not be compared here"
  );
});

test("the Review Queue's urgent predicate still includes both risk and P1 priority", () => {
  // If this changes, the intake summary above has to change with it.
  assert.match(PERSISTENCE, /riskLevel: "URGENT"/);
  assert.match(PERSISTENCE, /referralPriority: \{ in: \["P1", "P1_HSC"\] \}/);
});

test("the intake summary no longer counts urgent by risk level alone", () => {
  assert.doesNotMatch(
    STAT_CARDS,
    /riskCounts/,
    "the old risk-level-only tally must not come back"
  );
});

test("the intake caption states which sense of urgent it means", () => {
  // The number alone is ambiguous; the caption has to disclose the predicate.
  assert.match(
    STAT_CARDS,
    /urgent \(risk or P1\)/,
    "the caption must say the count covers urgent risk or P1 priority"
  );
});
