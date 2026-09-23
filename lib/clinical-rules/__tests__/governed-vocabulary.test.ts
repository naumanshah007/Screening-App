/**
 * Proves the governed vocabulary is TOTAL over CG-NCSP-3.1.0 and that no
 * clinically meaningful output can be derived from prose.
 *
 * These tests change no clinical rule. They constrain how rule output is
 * normalised.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { loadGovernedSnapshot } from "../governed-snapshot-store";
import {
  BRANCH_URGENCY_VOCABULARY,
  CARE_SETTING_VOCABULARY,
  TIMING_VOCABULARY,
  UnmappedGovernedLiteralError,
  classifyBranchUrgency,
  conditionalUrgency,
  classifyDestination,
  classifyTiming,
  intervalToDays,
  intervalToMonths,
  isAutomaticallySchedulable,
  urgencyFromTiming,
} from "../governed-vocabulary";

async function snapshotLiterals() {
  const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");
  const timing = new Set<string>();
  const care = new Set<string>();
  const urgency = new Set<string>();
  for (const rule of snapshot.rules) {
    timing.add(rule.timingDestination);
    care.add(rule.careSetting);
    for (const branch of rule.outcomeBranches ?? []) {
      timing.add(branch.timingDestination);
      care.add(branch.careSetting);
      if (branch.urgency !== undefined) urgency.add(branch.urgency);
    }
  }
  return { snapshot, timing, care, urgency };
}

test("timing vocabulary is total over the governed snapshot", async () => {
  const { timing } = await snapshotLiterals();
  const unmapped = [...timing].filter((literal) => !(literal in TIMING_VOCABULARY));
  assert.deepEqual(
    unmapped,
    [],
    `Unmapped timingDestination literals. Every literal needs an explicit reviewed entry: ${JSON.stringify(unmapped)}`
  );
});

test("care setting vocabulary is total over the governed snapshot", async () => {
  const { care } = await snapshotLiterals();
  const unmapped = [...care].filter((literal) => !(literal in CARE_SETTING_VOCABULARY));
  assert.deepEqual(unmapped, [], `Unmapped careSetting literals: ${JSON.stringify(unmapped)}`);
});

test("branch urgency vocabulary is total over the governed snapshot", async () => {
  const { urgency } = await snapshotLiterals();
  const unmapped = [...urgency].filter((literal) => !(literal in BRANCH_URGENCY_VOCABULARY));
  assert.deepEqual(unmapped, [], `Unmapped urgency literals: ${JSON.stringify(unmapped)}`);
});

test("vocabulary carries no entries the governed snapshot never emits", async () => {
  const { timing, care } = await snapshotLiterals();
  // A stale entry is a latent hazard: it can silently absorb a literal a future
  // ruleset reintroduces with a different clinical meaning.
  const staleTiming = Object.keys(TIMING_VOCABULARY).filter((literal) => !timing.has(literal));
  const staleCare = Object.keys(CARE_SETTING_VOCABULARY).filter((literal) => !care.has(literal));
  assert.deepEqual(staleTiming, [], `Stale timing entries: ${JSON.stringify(staleTiming)}`);
  assert.deepEqual(staleCare, [], `Stale care setting entries: ${JSON.stringify(staleCare)}`);
});

test("an unmapped literal fails closed rather than defaulting", () => {
  assert.throws(
    () => classifyTiming("in a little while"),
    UnmappedGovernedLiteralError,
    "an unknown timing literal must raise, never return a default interval"
  );
  assert.throws(() => classifyDestination("somewhere clinical"), UnmappedGovernedLiteralError);
  assert.throws(() => classifyBranchUrgency("quite urgent"), UnmappedGovernedLiteralError);
});

test("absent branch urgency is NOT_STATED, not a guess", () => {
  assert.equal(classifyBranchUrgency(undefined), "NOT_STATED");
});

test("prose cannot produce an urgency: only the closed table can", async () => {
  const { snapshot } = await snapshotLiterals();
  // The former implementation regex-matched /immediate|urgent|P1/i over
  // `${timingDestination} ${provisionalOutcome}`. These rules contain those
  // words in their OUTCOME text while their governed TIMING states no urgency.
  // Under the closed table they must resolve to NOT_STATED or ROUTINE.
  const proseUrgentButTimingSilent = snapshot.rules.filter(
    (rule) =>
      /urgent|immediate/i.test(rule.provisionalOutcome) &&
      ["NONE", "NOT_A_TIMING", "EVENT_RELATIVE", "DEFERRED_TO_OUTCOME"].includes(
        classifyTiming(rule.timingDestination).kind
      )
  );
  assert.ok(
    proseUrgentButTimingSilent.length > 0,
    "expected at least one rule whose outcome prose says urgent while its governed timing does not"
  );
  for (const rule of proseUrgentButTimingSilent) {
    assert.equal(
      urgencyFromTiming(classifyTiming(rule.timingDestination)),
      "NOT_STATED",
      `${rule.stableRuleId}: outcome prose must not raise urgency`
    );
  }
});

test("changing outcome or rationale text cannot change urgency or timing", () => {
  // Urgency and timing are functions of the timing literal alone. Nothing about
  // outcome or rationale text is an input, so no text edit can move them.
  const before = classifyTiming("12 months");
  const after = classifyTiming("12 months");
  assert.deepEqual(before, after);
  assert.equal(urgencyFromTiming(before), "ROUTINE");
  // The same literal always yields the same urgency regardless of surrounding rule content.
  assert.equal(urgencyFromTiming(classifyTiming("Immediate")), "URGENT");
  assert.equal(urgencyFromTiming(classifyTiming("Urgent; within 2 weeks")), "PROMPT");
});

test("conditional timings never yield an automatic date", async () => {
  const { timing } = await snapshotLiterals();
  const conditionals = [...timing]
    .map((literal) => classifyTiming(literal))
    .filter((classification) => classification.kind === "CONDITIONAL");
  assert.ok(conditionals.length > 0, "expected conditional timings in the governed snapshot");
  for (const classification of conditionals) {
    assert.equal(isAutomaticallySchedulable(classification), false);
  }
});

test("a conditional timing states no urgency on the timing alone", async () => {
  // The timing string states a CONDITION. Reading an urgency out of it without
  // evaluating that condition asserted a patient-specific urgency on every case
  // the rule matched, which is what `conditionalUrgency` now decides per case.
  const { timing } = await snapshotLiterals();
  for (const literal of timing) {
    const classification = classifyTiming(literal);
    if (classification.kind !== "CONDITIONAL") continue;
    assert.equal(
      urgencyFromTiming(classification),
      "NOT_STATED",
      `${JSON.stringify(literal)} must not yield an urgency from the timing alone`
    );
  }
});

test("a conditional urgent limb applies only when the facts satisfy its condition", () => {
  const literal = "20 or 30 working days according to risk/history; urgent if invasive cytology";
  assert.equal(classifyTiming(literal).kind, "CONDITIONAL");

  // Negative cytology does not meet "urgent if invasive cytology".
  assert.equal(conditionalUrgency(literal, { cytologyResult: "NEGATIVE" }), "NOT_STATED");
  // Neither does a pending one: absent is not invasive.
  assert.equal(conditionalUrgency(literal, {}), "NOT_STATED");
  // An invasive cytology result does.
  assert.equal(
    conditionalUrgency(literal, { cytologyResult: "DEFINITE_INVASIVE_CANCER" }),
    "URGENT"
  );
});

test("an urgent limb still sets no automatic date", () => {
  const f914 = classifyTiming(
    "Urgent / within 2 weeks when invasion confirmed or strongly suspected"
  );
  assert.equal(f914.kind, "CONDITIONAL");
  assert.equal(isAutomaticallySchedulable(f914), false);
  assert.equal(conditionalUrgency(
    "Urgent / within 2 weeks when invasion confirmed or strongly suspected",
    { suspicionOfCancer: true }
  ), "URGENT");
});

test("a conditional timing that states no urgency stays NOT_STATED", () => {
  const immuneConditional = classifyTiming("5 years or 3 years if immune deficient");
  assert.equal(immuneConditional.kind, "CONDITIONAL");
  assert.equal(urgencyFromTiming(immuneConditional), "NOT_STATED");
});

test("only EXACT and BOUNDED_MAX are automatically schedulable", async () => {
  const { timing } = await snapshotLiterals();
  for (const literal of timing) {
    const classification = classifyTiming(literal);
    const schedulable = isAutomaticallySchedulable(classification);
    assert.equal(
      schedulable,
      classification.kind === "EXACT" || classification.kind === "BOUNDED_MAX",
      `${JSON.stringify(literal)} (${classification.kind}) schedulability is wrong`
    );
  }
});

test("ranges, multi-event schedules and event-anchored timings are never auto-scheduled", async () => {
  const { timing } = await snapshotLiterals();
  const notSchedulable = [...timing]
    .map(classifyTiming)
    .filter((c) => ["RANGE", "MULTI_EVENT", "EVENT_RELATIVE"].includes(c.kind));
  assert.ok(notSchedulable.length > 0);
  for (const classification of notSchedulable) {
    assert.equal(
      isAutomaticallySchedulable(classification),
      false,
      "choosing a point inside a range, a schedule, or an external anchor is a clinical decision"
    );
  }
});

test("interval conversion is exact and refuses lossy month conversion", () => {
  assert.equal(intervalToMonths({ value: 12, unit: "MONTHS" }), 12);
  assert.equal(intervalToMonths({ value: 5, unit: "YEARS" }), 60);
  assert.equal(intervalToMonths({ value: 1, unit: "YEARS" }), 12);
  // 2 weeks is not a whole number of months and must not be rounded to 0 or 1.
  assert.equal(intervalToMonths({ value: 2, unit: "WEEKS" }), null);
  assert.equal(intervalToDays({ value: 2, unit: "WEEKS" }), 14);
  assert.equal(intervalToDays({ value: 6, unit: "MONTHS" }), 180);
});

test("every EXACT timing converts to whole months without loss", async () => {
  const { timing } = await snapshotLiterals();
  for (const literal of timing) {
    const classification = classifyTiming(literal);
    if (classification.kind !== "EXACT") continue;
    assert.notEqual(
      intervalToMonths(classification.interval),
      null,
      `${JSON.stringify(literal)} must convert to whole months for the recall contract`
    );
  }
});
