/**
 * Prepare ONE evaluated CHCH run, ahead of a demonstration.
 *
 * WHY A PREPARED RUN
 * ------------------
 * The Pull Cases screen is a ROUTING PREVIEW. It has been routed but not
 * evaluated, it carries no recommendation by design, and it is not the clinical
 * result. Showing it as one was the mixed-authority defect. This script walks
 * the normal persistence path — `processBatch` → `saveBatchRun` →
 * `evaluateGradedDecision` — so the demonstration opens a run whose decisions
 * already exist, with the authority and rule version they were decided under
 * recorded against them.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It does not activate a ruleset, approve anything, or touch governance. If the
 * deployment has no active governed version, that is a real clinical-governance
 * prerequisite, and this script reports it rather than working around it. It
 * refuses to run against PRODUCTION.
 *
 * It also does not modify source data. If a case disagrees with the partner's
 * expected outcome, the disagreement is the result.
 *
 *   DATABASE_URL="file:./prisma/chch-eval.db" npx tsx scripts/demo/prepare-chch-evaluation-run.ts
 */

import { CHCH_PUBLIC_DATASET } from "@/lib/batch/chch-public-dataset";
import { processBatch } from "@/lib/batch/processor";
import { saveBatchRun, reconstructBatchCaseResult } from "@/lib/batch/persistence";
import { getRuntimeClinicalEnvironment, resolveClinicalAuthority } from "@/lib/clinical-rules/authority";
import { getDatabaseRuntimeSummary } from "@/lib/config/database";
import { prisma } from "@/lib/prisma";
import { presentableReferralPriority } from "@/lib/clinical-rules/priority-provenance";
import { evaluationStatusFor } from "@/lib/clinical-rules/decision-envelope";
import { CHCH_SOURCE_EVIDENCE } from "@/lib/batch/chch-source-records";

/** The cases walked through on stage. Every one must read honestly. */
const REHEARSAL = [
  "chch-001",
  "chch-002",
  "chch-003",
  "chch-007",
  "chch-008",
  "chch-009",
  "chch-010",
  "chch-016",
  "chch-018",
  "chch-020",
  "chch-025",
  "chch-027",
  "chch-030",
];

async function main() {
  const environment = getRuntimeClinicalEnvironment();
  if (environment === "PRODUCTION") {
    throw new Error(
      "Refusing to run: the clinical environment resolves to PRODUCTION. This " +
        "script prepares a demonstration run and must never write to production."
    );
  }

  const database = getDatabaseRuntimeSummary();
  console.log(`Clinical environment : ${environment}`);
  console.log(`Database             : ${database.displayTarget}`);

  const actor = await prisma.user.findUnique({ where: { email: "chchadmin@cs.nz" } });
  if (!actor) {
    throw new Error(
      "The CHCH evaluator account does not exist in this database. Run " +
        "`npm run demo:chch:provision` against it first."
    );
  }

  const authority = await resolveClinicalAuthority({ environment });
  console.log(`Authority            : ${authority.authorityEngine}`);
  console.log(`Ruleset              : ${authority.ruleSetVersion ?? "(none active)"}`);
  if (authority.authorityEngine !== "CANONICAL") {
    console.log(
      "\nNOTE: no governed ruleset is active in this environment, so the " +
        "authority resolver selects LEGACY. That is a clinical-governance " +
        "prerequisite, not a defect to hide. The run below is prepared under " +
        "the authority that is actually configured, and every case records " +
        "which engine decided it.\n"
    );
  }

  const result = processBatch(CHCH_PUBLIC_DATASET, {
    includeWarnings: true,
    includeInvalid: false,
  });

  const run = await saveBatchRun({
    result,
    actorUserId: actor.id,
    sourceSystem: "CHCH Public",
    intakeSourceType: "chchPublic",
    parseManifest: {
      schemaVersion: 1,
      sourceRecordCount: CHCH_PUBLIC_DATASET.length,
      parsedRecordCount: CHCH_PUBLIC_DATASET.length,
      skippedRecordCount: 0,
      preparedRecordCount: CHCH_PUBLIC_DATASET.length,
      warnings: [],
      errors: [],
      detectedColumns: [],
      unmappedColumns: [],
    },
  });

  console.log(`\nPrepared run ${run.id} — ${run.items.length} cases\n`);
  console.log("Open it at /batch/runs/" + run.id + "\n");

  // ── 30-case reconciliation ────────────────────────────────────────────────
  const byExternalId = new Map(run.items.map((item) => [item.externalPatientId, item]));
  console.log("case      | authority | decision");
  console.log("----------|-----------|----------------------------------------");
  for (const [id, item] of [...byExternalId.entries()].sort()) {
    console.log(
      `${(id ?? "?").padEnd(9)} | ${(item.authorityEngine ?? "-").padEnd(9)} | ` +
        `${item.recommendationCode} — ${item.recommendation.slice(0, 60)}`
    );
  }

  // ── 30-case automated reconciliation ─────────────────────────────────────
  const expectedIds = CHCH_SOURCE_EVIDENCE.map((row) => row.caseId);
  const actualIds = [...byExternalId.keys()].filter(Boolean).sort() as string[];
  const reconciliation: string[] = [];
  if (actualIds.length !== 30) reconciliation.push(`expected 30 cases, found ${actualIds.length}`);
  if (new Set(actualIds).size !== actualIds.length) reconciliation.push("duplicate case IDs present");
  for (const id of expectedIds) {
    if (!byExternalId.has(id)) reconciliation.push(`${id} missing from the run`);
  }
  for (const id of actualIds) {
    if (!expectedIds.includes(id)) reconciliation.push(`${id} is not a CHCH case`);
  }
  for (const [id, item] of byExternalId) {
    const r = reconstructBatchCaseResult(item as Parameters<typeof reconstructBatchCaseResult>[0]);
    if (!r.case.sourceEvidence) reconciliation.push(`${id}: no source evidence`);
    if (item.nhi) reconciliation.push(`${id}: synthetic ID in the NHI column`);
    if (presentableReferralPriority(item)) reconciliation.push(`${id}: unsupported priority presentable`);
    if (item.recommendationCode !== r.decision.recommendationCode) {
      reconciliation.push(`${id}: summary/decisionJson disagree`);
    }
  }
  console.log(
    `\n30-CASE RECONCILIATION: ${reconciliation.length === 0 ? "PASS (30/30)" : "FAIL"}`
  );
  reconciliation.slice(0, 12).forEach((problem) => console.log("  ", problem));

  // ── Rehearsal checks ──────────────────────────────────────────────────────
  console.log("\nRehearsal cases\n===============");
  for (const id of REHEARSAL) {
    const item = byExternalId.get(id);
    if (!item) {
      console.log(`${id}: MISSING FROM RUN`);
      continue;
    }
    const reconstructed = reconstructBatchCaseResult(
      item as Parameters<typeof reconstructBatchCaseResult>[0]
    );
    const evidence = reconstructed.case.sourceEvidence;
    const decision = reconstructed.decision;
    const problems: string[] = [];

    // The persisted summary columns and the decision snapshot must agree: the
    // drawer reads the snapshot and the worklist reads the columns.
    if (item.recommendationCode !== decision.recommendationCode) {
      problems.push(
        `summary/decisionJson disagree (${item.recommendationCode} vs ${decision.recommendationCode})`
      );
    }
    if ((item.referralPriority ?? null) !== (decision.referralPriority ?? null)) {
      problems.push("referral priority differs between the columns and the snapshot");
    }
    if (!evidence) problems.push("no source evidence survived persistence");
    if (item.nhi) problems.push("a synthetic case ID reached the NHI column");
    if (reconstructed.case.identifierKind !== "SYNTHETIC_CASE") {
      problems.push("the case identifier is not declared synthetic");
    }
    if (presentableReferralPriority(item)) {
      problems.push(`unsupported priority ${item.referralPriority} is presentable`);
    }
    if (decision.riskLevel !== "NOT_ASSESSED" && item.authorityEngine === "CANONICAL") {
      problems.push(`canonical result carries patient risk ${decision.riskLevel}`);
    }

    console.log(`\n${id} — ${item.patientName ?? "?"} · ${item.patientAge ?? "?"}`);
    if (evidence) {
      console.log(`  Screen   : ${evidence.screenCircumstanceText}`);
      console.log(`  HPV      : ${evidence.hpvResultText} [${evidence.hpvGenotype ?? "no current result"}]`);
      console.log(`  Cytology : ${evidence.cytologyFollowUpText} [${evidence.cytologyState}]`);
      console.log(`  History  : ${evidence.relevantHistoryText}`);
    }
    console.log(`  Status   : ${evaluationStatusFor({ decision, engineStatus: reconstructed.status })}`);
    console.log(`  Decision : ${decision.recommendation}`);
    console.log(`  Priority : ${decision.referralPriority ?? "none stated"}`);
    console.log(`  Missing  : ${(decision.missingInformation ?? []).join(", ") || "none"}`);
    console.log(`  Checks   : ${problems.length === 0 ? "OK" : problems.join("; ")}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
