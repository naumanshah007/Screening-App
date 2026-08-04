/**
 * Three-way comparison harness — legacy-engine emitter.
 *
 * Runs the legacy decision engine of THIS worktree over the 179 independent
 * source-oracle probes and emits a JSON record per case.
 *
 * The same file is placed in both the reproduced-production worktree (fb933c3)
 * and the candidate worktree (8eed086). The oracle and the probe builder are the
 * shared measuring instrument; the engine binding differs per worktree, which is
 * exactly the quantity under comparison. No engine code is modified in either
 * worktree.
 *
 * Read-only: no database access, no network, no writes outside the output file.
 *
 * Run: npx tsx scripts/comparison/emit-legacy.ts <systemLabel> <outFile>
 */

import { writeFileSync } from "node:fs";

import { guidelineOracle } from "../../tests/clinical-conformance/support/guideline-oracle";
import { probeFor, actualActionClass } from "../../tests/clinical-conformance/support/conformance-runner";

const systemLabel = process.argv[2] ?? "UNKNOWN_SYSTEM";
const outFile = process.argv[3] ?? "legacy-emission.json";

type Emission = {
  caseId: string;
  figureOrTable: string;
  page: number;
  recommendationNumbers: string[];
  expectedActionClass: string;
  expectedTiming: string | null;
  expectedDestination: string | null;
  expectedReferralRequired: boolean;
  expectedClinicianOnly: boolean;
  executable: boolean;
  unsupportedReason: string | null;
  error: string | null;
  actual: null | {
    recommendationCode: string;
    actionClass: string;
    riskLevel: string;
    figure: string;
    referralRequired: boolean;
    referralType: string | null;
    referralPriority: string | null;
    nextScreeningIntervalMonths: number | null;
    recallIntervalMonths: number | null;
    requiresMDMReview: boolean;
    safetyOutcome: string | null;
    missingInformation: string[];
    externalDependencies: string[];
    branchPath: string[];
    validationStatus: string | null;
    ruleVersion: string | null;
  };
};

const emissions: Emission[] = [];

for (const rule of guidelineOracle) {
  const probe = probeFor(rule);

  const record: Emission = {
    caseId: rule.ruleId,
    figureOrTable: rule.figureOrTable,
    page: rule.page,
    recommendationNumbers: rule.recommendationNumbers ?? [],
    expectedActionClass: rule.actionClass,
    expectedTiming: (rule as { expectedTiming?: string }).expectedTiming ?? null,
    expectedDestination: (rule as { referralDestination?: string }).referralDestination ?? null,
    expectedReferralRequired: Boolean(rule.referralRequired),
    expectedClinicianOnly: Boolean((rule as { clinicianOnly?: boolean }).clinicianOnly),
    executable: false,
    unsupportedReason: probe.unsupportedReason ?? null,
    error: null,
    actual: null,
  };

  if (!probe.input || !probe.evaluate) {
    emissions.push(record);
    continue;
  }

  try {
    const decision = probe.evaluate(probe.input);
    record.executable = true;
    record.actual = {
      recommendationCode: decision.recommendationCode,
      actionClass: actualActionClass(decision),
      riskLevel: String(decision.riskLevel),
      figure: String(decision.figure),
      referralRequired: Boolean(decision.referralRequired),
      referralType: decision.referralType ? String(decision.referralType) : null,
      referralPriority: decision.referralPriority ? String(decision.referralPriority) : null,
      nextScreeningIntervalMonths: decision.nextScreeningIntervalMonths ?? null,
      recallIntervalMonths: decision.recallIntervalMonths ?? null,
      requiresMDMReview: Boolean(decision.requiresMDMReview),
      safetyOutcome: decision.safetyOutcome ? String(decision.safetyOutcome) : null,
      missingInformation: decision.missingInformation ?? [],
      externalDependencies: decision.externalDependencies ?? [],
      branchPath: decision.branchPath ?? [],
      validationStatus: decision.validationStatus ?? null,
      ruleVersion: decision.ruleVersion ?? null,
    };
  } catch (error) {
    record.error = error instanceof Error ? error.message : String(error);
  }

  emissions.push(record);
}

const executable = emissions.filter((e) => e.executable).length;
const unsupported = emissions.filter((e) => !e.executable && e.unsupportedReason).length;
const errored = emissions.filter((e) => e.error).length;

writeFileSync(
  outFile,
  JSON.stringify(
    { system: systemLabel, generatedAt: new Date().toISOString(), total: emissions.length, executable, unsupported, errored, emissions },
    null,
    2
  )
);

console.log(`[${systemLabel}] cases=${emissions.length} executable=${executable} unsupported=${unsupported} errored=${errored} -> ${outFile}`);
