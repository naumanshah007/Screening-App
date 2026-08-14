/**
 * Append technical-invalidity corrections for the preserved Phase 2 demo
 * orphan events. Dry-run by default. Applying requires all three explicit
 * confirmations and refuses a count other than the operator-confirmed value.
 *
 * No UsageEvent is updated or deleted, and no episode is fabricated.
 */
import { Prisma } from "@prisma/client";

import { isDemoModeEnabled } from "@/lib/config/demo-mode";
import { prisma } from "@/lib/prisma";
import { recordUsageEventCorrection } from "@/lib/usage/usage-corrections";
import { getUsageIntegrityReport } from "@/lib/usage/usage-integrity";

type OrphanUsageEvent = {
  id: string;
  organisationId: string;
  eventType: string;
};

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const expectedCount = Number(argument("expected-count"));
  const confirmation = argument("confirm");
  const deploymentSha = process.env.REMEDIATION_DEPLOYMENT_SHA?.trim();

  const before = await getUsageIntegrityReport();
  const rawUsageBefore = await prisma.usageEvent.count();
  const orphans = await prisma.$queryRaw<OrphanUsageEvent[]>(Prisma.sql`
    SELECT usage."id", usage."organisationId", usage."eventType"
    FROM "UsageEvent" usage
    LEFT JOIN "ScreeningEpisode" episode ON episode."id" = usage."episodeId"
    WHERE episode."id" IS NULL
    ORDER BY usage."occurredAt", usage."id"
  `);

  if (!apply) {
    console.log(
      JSON.stringify(
        { mode: "DRY_RUN", orphanCandidates: orphans.length, rawUsageBefore, before },
        null,
        2
      )
    );
    return;
  }

  if (!isDemoModeEnabled()) {
    throw new Error("Refusing remediation outside explicit DEMO_MODE.");
  }
  if (!Number.isInteger(expectedCount) || expectedCount < 1) {
    throw new Error("--expected-count=<positive integer> is required.");
  }
  if (confirmation !== "EPISODE_REGISTRATION_ROLLBACK") {
    throw new Error(
      "--confirm=EPISODE_REGISTRATION_ROLLBACK is required."
    );
  }
  if (!deploymentSha) {
    throw new Error("REMEDIATION_DEPLOYMENT_SHA is required for provenance.");
  }
  if (orphans.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} orphan usage events but re-query found ${orphans.length}; no corrections written.`
    );
  }
  const unexpectedTypes = orphans.filter(
    (orphan) => orphan.eventType !== "FIRST_TRIAGE"
  );
  if (unexpectedTypes.length > 0) {
    throw new Error(
      `Found ${unexpectedTypes.length} orphan events outside the known FIRST_TRIAGE defect shape; no corrections written.`
    );
  }

  let created = 0;
  let existing = 0;
  for (const orphan of orphans) {
    const wasCreated = await prisma.$transaction((tx) =>
      recordUsageEventCorrection({
        tx,
        usageEventId: orphan.id,
        organisationId: orphan.organisationId,
        correctionType: "INVALIDATE",
        reasonCode: "EPISODE_REGISTRATION_ROLLBACK",
        reasonDetail:
          "Technical defect during earlier episode-registration transaction rollback.",
        systemActor: "CERVIGRADE_PHASE2_TECHNICAL_REMEDIATION",
        metadata: {
          remediationId: "phase2-usage-integrity-closure-2026-08",
          defect: "EPISODE_REGISTRATION_TRANSACTION_ROLLBACK",
          deploymentSha,
        },
      })
    );
    if (wasCreated) created += 1;
    else existing += 1;
  }

  const rawUsageAfter = await prisma.usageEvent.count();
  const after = await getUsageIntegrityReport();
  const duplicateCorrections = await prisma.$queryRaw<Array<{ count: bigint | number }>>(
    Prisma.sql`
      SELECT COUNT(*) AS count
      FROM (
        SELECT "usageEventId", "correctionType"
        FROM "UsageEventCorrection"
        GROUP BY "usageEventId", "correctionType"
        HAVING COUNT(*) > 1
      ) duplicates
    `
  );

  console.log(
    JSON.stringify(
      {
        mode: "APPLY",
        candidates: orphans.length,
        correctionsCreated: created,
        exactRetriesAlreadyPresent: existing,
        rawUsageBefore,
        rawUsageAfter,
        rawHistoryPreserved: rawUsageBefore === rawUsageAfter,
        duplicateCorrectionGroups: Number(duplicateCorrections[0]?.count ?? 0),
        before,
        after,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
