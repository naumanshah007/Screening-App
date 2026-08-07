/**
 * Timing classification census for CG-NCSP-3.1.0.
 *
 * Produces exact counts of how many governed rules can carry a machine-generated
 * recall date and how many require a clinician to set the follow-up. This is
 * operational-governance evidence for the GOV-04 operating-point decision, not a
 * clinical judgement.
 *
 *     npm run rules:report:timing
 */

import { loadGovernedSnapshot } from "../../lib/clinical-rules/governed-snapshot-store";
import {
  classifyTiming,
  isAutomaticallySchedulable,
  urgencyFromTiming,
  type TimingClassification,
} from "../../lib/clinical-rules/governed-vocabulary";

/** The workflow-facing category. Closed vocabulary; every rule gets exactly one. */
export type RecallCapability =
  | "AUTO_SCHEDULABLE_EXACT"
  | "AUTO_SCHEDULABLE_BOUNDED"
  | "CLINICIAN_TIMING_REQUIRED"
  | "IMMEDIATE_OR_EVENT_DRIVEN"
  | "NO_RECALL_DATE_APPLICABLE";

export function recallCapability(classification: TimingClassification): RecallCapability {
  switch (classification.kind) {
    case "EXACT":
      return "AUTO_SCHEDULABLE_EXACT";
    case "BOUNDED_MAX":
      return "AUTO_SCHEDULABLE_BOUNDED";
    case "RANGE":
    case "MULTI_EVENT":
    case "CONDITIONAL":
      return "CLINICIAN_TIMING_REQUIRED";
    case "IMMEDIATE":
    case "EVENT_RELATIVE":
      return "IMMEDIATE_OR_EVENT_DRIVEN";
    case "NOT_A_TIMING":
    case "DEFERRED_TO_OUTCOME":
    case "NONE":
      return "NO_RECALL_DATE_APPLICABLE";
  }
}

export function printTimingCensus() {
  const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");

  const byCapability = new Map<RecallCapability, string[]>();
  const byKind = new Map<TimingClassification["kind"], number>();
  const bySection = new Map<string, Map<RecallCapability, number>>();

  for (const rule of snapshot.rules) {
    const classification = classifyTiming(rule.timingDestination);
    const capability = recallCapability(classification);

    byCapability.set(capability, [...(byCapability.get(capability) ?? []), rule.stableRuleId]);
    byKind.set(classification.kind, (byKind.get(classification.kind) ?? 0) + 1);

    const section = bySection.get(rule.section) ?? new Map();
    section.set(capability, (section.get(capability) ?? 0) + 1);
    bySection.set(rule.section, section);

    // Invariants: no prose parsing, no silent null, no invented timing.
    const schedulable = isAutomaticallySchedulable(classification);
    const expectedSchedulable =
      capability === "AUTO_SCHEDULABLE_EXACT" || capability === "AUTO_SCHEDULABLE_BOUNDED";
    if (schedulable !== expectedSchedulable) {
      throw new Error(`${rule.stableRuleId}: capability and schedulability disagree`);
    }
  }

  const total = snapshot.rules.length;
  console.log(`CG-NCSP-3.1.0 — ${total} governed rules\n`);

  console.log("Recall capability:");
  const order: RecallCapability[] = [
    "AUTO_SCHEDULABLE_EXACT",
    "AUTO_SCHEDULABLE_BOUNDED",
    "CLINICIAN_TIMING_REQUIRED",
    "IMMEDIATE_OR_EVENT_DRIVEN",
    "NO_RECALL_DATE_APPLICABLE",
  ];
  for (const capability of order) {
    const ids = byCapability.get(capability) ?? [];
    console.log(
      `  ${capability.padEnd(28)} ${String(ids.length).padStart(4)}  ${((ids.length / total) * 100).toFixed(1).padStart(5)}%`
    );
  }

  const autoTotal =
    (byCapability.get("AUTO_SCHEDULABLE_EXACT") ?? []).length +
    (byCapability.get("AUTO_SCHEDULABLE_BOUNDED") ?? []).length;
  console.log(
    `\n  Machine-generated recall date permitted: ${autoTotal}/${total} (${((autoTotal / total) * 100).toFixed(1)}%)`
  );
  console.log(
    `  Clinician must set the follow-up:        ${(byCapability.get("CLINICIAN_TIMING_REQUIRED") ?? []).length}/${total}`
  );

  console.log("\nUnderlying timing classification:");
  for (const [kind, count] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${kind.padEnd(22)} ${String(count).padStart(4)}`);
  }

  console.log("\nRules that can carry an automatic recall date:");
  for (const capability of ["AUTO_SCHEDULABLE_EXACT", "AUTO_SCHEDULABLE_BOUNDED"] as const) {
    for (const id of byCapability.get(capability) ?? []) {
      const rule = snapshot.rules.find((r) => r.stableRuleId === id)!;
      const classification = classifyTiming(rule.timingDestination);
      console.log(
        `  ${id.padEnd(10)} ${capability.padEnd(26)} ${JSON.stringify(rule.timingDestination)} → ${urgencyFromTiming(classification)}`
      );
    }
  }

  console.log("\nBy section (auto / clinician / immediate-or-event / not applicable):");
  for (const [section, counts] of [...bySection.entries()].sort()) {
    const auto =
      (counts.get("AUTO_SCHEDULABLE_EXACT") ?? 0) + (counts.get("AUTO_SCHEDULABLE_BOUNDED") ?? 0);
    console.log(
      `  ${section.padEnd(46)} ${String(auto).padStart(3)} / ${String(counts.get("CLINICIAN_TIMING_REQUIRED") ?? 0).padStart(3)} / ${String(counts.get("IMMEDIATE_OR_EVENT_DRIVEN") ?? 0).padStart(3)} / ${String(counts.get("NO_RECALL_DATE_APPLICABLE") ?? 0).padStart(3)}`
    );
  }
}

// Only run when invoked directly, so the classification can be imported by tests
// without producing output or side effects.
if (process.argv[1] && process.argv[1].endsWith("timing-classification-report.ts")) {
  printTimingCensus();
}
