/**
 * Phase 2 usage-ledger integrity closure (acceptance A–L).
 *
 * This suite owns a throwaway database. That lets it reproduce the one
 * historical defect shape (an orphan written before the new insert guard)
 * without weakening or polluting any shared test database.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { after, before } from "node:test";

import {
  applySchema,
  createIsolatedDatabase,
  seedRuleSet,
  seedVersion,
} from "./support/isolated-db";

const database = createIsolatedDatabase("usage-integrity");
const RUN = `USAGE-INTEGRITY-${Date.now()}`;

type PrismaClient = typeof import("../../lib/prisma")["prisma"];
type RecordUsageEvent = typeof import("../../lib/usage/usage-events")["recordUsageEvent"];
type RecordUsageEventCorrection =
  typeof import("../../lib/usage/usage-corrections")["recordUsageEventCorrection"];

let prisma: PrismaClient;
let recordUsageEvent: RecordUsageEvent;
let recordUsageEventCorrection: RecordUsageEventCorrection;
let rawUsageEvents: typeof import("../../lib/usage/usage-queries")["rawUsageEvents"];
let effectiveUsageEvents: typeof import("../../lib/usage/usage-queries")["effectiveUsageEvents"];
let invalidatedUsageEvents: typeof import("../../lib/usage/usage-queries")["invalidatedUsageEvents"];
let getUsageIntegrityReport: typeof import("../../lib/usage/usage-integrity")["getUsageIntegrityReport"];
let isPersistedManualRegradeRetry: typeof import("../../lib/usage/manual-regrade")["isPersistedManualRegradeRetry"];
let recordManualRegradeUsage: typeof import("../../lib/usage/manual-regrade")["recordManualRegradeUsage"];

before(async () => {
  await applySchema(database.file);
  ({ prisma } = await import("../../lib/prisma"));
  ({ recordUsageEvent } = await import("../../lib/usage/usage-events"));
  ({ recordUsageEventCorrection } = await import("../../lib/usage/usage-corrections"));
  ({ rawUsageEvents, effectiveUsageEvents, invalidatedUsageEvents } = await import(
    "../../lib/usage/usage-queries"
  ));
  ({ getUsageIntegrityReport } = await import("../../lib/usage/usage-integrity"));
  ({ isPersistedManualRegradeRetry, recordManualRegradeUsage } = await import(
    "../../lib/usage/manual-regrade"
  ));
});

after(async () => {
  await prisma?.$disconnect?.().catch(() => undefined);
  database.cleanup();
});

async function organisation(suffix: string) {
  return prisma.organisation.create({
    data: {
      key: `${RUN}-${suffix}`.toLowerCase(),
      name: `Synthetic organisation ${suffix}`,
    },
  });
}

async function episode(organisationId: string, suffix: string) {
  return prisma.screeningEpisode.create({
    data: {
      id: `${RUN}-${suffix}`,
      organisationId,
      weakFingerprint: `${RUN}-${suffix}-weak`,
    },
  });
}

async function usage(organisationId: string, episodeId: string, suffix: string) {
  const created = await prisma.$transaction((tx) =>
    recordUsageEvent({
      tx,
      organisationId,
      episodeId,
      eventType: "REGRADE",
      classification: "MANUAL_REGRADE",
      ruleEvaluationId: `${RUN}-${suffix}-evaluation`,
    })
  );
  assert.equal(created, true);
  return prisma.usageEvent.findFirstOrThrow({
    where: { organisationId, episodeId, ruleEvaluationId: `${RUN}-${suffix}-evaluation` },
  });
}

test("A: the database rejects usage for a missing episode with a stable error", async () => {
  const org = await organisation("db-missing");
  await assert.rejects(
    prisma.$executeRawUnsafe(
      `INSERT INTO "UsageEvent"
       ("id", "organisationId", "episodeId", "eventType", "classification", "idempotencyKey")
       VALUES (?, ?, ?, 'FIRST_TRIAGE', 'NEW', ?)`,
      `${RUN}-raw-missing`,
      org.id,
      `${RUN}-no-such-episode`,
      `${RUN}-raw-missing-key`
    ),
    /USAGE_EVENT_EPISODE_NOT_FOUND/
  );
});

test("B: the application write fails closed before inserting missing-episode usage", async () => {
  const org = await organisation("app-missing");
  await assert.rejects(
    prisma.$transaction((tx) =>
      recordUsageEvent({
        tx,
        organisationId: org.id,
        episodeId: `${RUN}-missing-app-episode`,
        eventType: "FIRST_TRIAGE",
        classification: "NEW",
      })
    ),
    /USAGE_EVENT_EPISODE_NOT_FOUND/
  );
  assert.equal(await prisma.usageEvent.count({ where: { organisationId: org.id } }), 0);
});

test("C: a valid same-organisation episode permits usage insertion", async () => {
  const org = await organisation("valid");
  const ep = await episode(org.id, "valid");
  const created = await prisma.$transaction((tx) =>
    recordUsageEvent({
      tx,
      organisationId: org.id,
      episodeId: ep.id,
      eventType: "FIRST_TRIAGE",
      classification: "NEW",
    })
  );
  assert.equal(created, true);
  assert.equal(await prisma.usageEvent.count({ where: { episodeId: ep.id } }), 1);
});

test("the database and application both reject cross-organisation usage", async () => {
  const owner = await organisation("episode-owner");
  const other = await organisation("cross-org-writer");
  const ep = await episode(owner.id, "cross-org");

  await assert.rejects(
    prisma.$transaction((tx) =>
      recordUsageEvent({
        tx,
        organisationId: other.id,
        episodeId: ep.id,
        eventType: "FIRST_TRIAGE",
        classification: "NEW",
      })
    ),
    /USAGE_EVENT_EPISODE_ORGANISATION_MISMATCH/
  );
  await assert.rejects(
    prisma.$executeRawUnsafe(
      `INSERT INTO "UsageEvent"
       ("id", "organisationId", "episodeId", "eventType", "classification", "idempotencyKey")
       VALUES (?, ?, ?, 'FIRST_TRIAGE', 'NEW', ?)`,
      `${RUN}-raw-cross-org`,
      other.id,
      ep.id,
      `${RUN}-raw-cross-org-key`
    ),
    /USAGE_EVENT_EPISODE_ORGANISATION_MISMATCH/
  );
});

test("D–H: a correction is immutable, terminal, idempotent and audit-visible", async () => {
  const org = await organisation("correction");
  const ep = await episode(org.id, "correction");
  const event = await usage(org.id, ep.id, "correction");
  const correction = {
    usageEventId: event.id,
    organisationId: org.id,
    correctionType: "INVALIDATE" as const,
    reasonCode: "EPISODE_REGISTRATION_ROLLBACK" as const,
    reasonDetail: "Technical defect during earlier episode-registration transaction rollback.",
    systemActor: "CERVIGRADE_PHASE2_TEST_REMEDIATION",
    metadata: {
      remediationId: `${RUN}-correction`,
      defect: "EPISODE_REGISTRATION_TRANSACTION_ROLLBACK" as const,
      deploymentSha: "test-sha",
    },
  };

  assert.equal(
    await prisma.$transaction((tx) => recordUsageEventCorrection({ tx, ...correction })),
    true
  );
  assert.equal(
    await prisma.$transaction((tx) => recordUsageEventCorrection({ tx, ...correction })),
    false,
    "an exact retry must converge on the existing correction"
  );
  assert.equal(
    await prisma.usageEventCorrection.count({ where: { usageEventId: event.id } }),
    1
  );

  await assert.rejects(
    prisma.$transaction((tx) =>
      recordUsageEventCorrection({
        tx,
        ...correction,
        reasonDetail: "A different terminal explanation must not replace the first.",
      })
    ),
    /USAGE_EVENT_ALREADY_INVALIDATED_DIFFERENTLY/
  );

  const row = await prisma.usageEventCorrection.findFirstOrThrow({
    where: { usageEventId: event.id },
  });
  await assert.rejects(
    prisma.$executeRawUnsafe(
      `UPDATE "UsageEventCorrection" SET "reasonDetail" = 'changed' WHERE "id" = ?`,
      row.id
    ),
    /Usage event corrections are immutable/
  );
  await assert.rejects(
    prisma.$executeRawUnsafe(`DELETE FROM "UsageEventCorrection" WHERE "id" = ?`, row.id),
    /Usage event corrections are immutable/
  );

  const [raw, effective, invalidated] = await Promise.all([
    rawUsageEvents({ organisationId: org.id }),
    effectiveUsageEvents({ organisationId: org.id }),
    invalidatedUsageEvents({ organisationId: org.id }),
  ]);
  assert.equal(raw.length, 1, "raw audit history keeps the original event");
  assert.equal(raw[0]?.corrections.length, 1, "raw history includes its correction");
  assert.equal(effective.length, 0, "effective usage excludes terminal invalidations");
  assert.equal(invalidated.length, 1, "the invalidated audit view exposes the fact");
  assert.equal(invalidated[0]?.corrections[0]?.id, row.id);
});

test("I: FIRST_TRIAGE remains unique per organisation and episode", async () => {
  const org = await organisation("first-triage");
  const ep = await episode(org.id, "first-triage");
  const first = await prisma.$transaction((tx) =>
    recordUsageEvent({
      tx,
      organisationId: org.id,
      episodeId: ep.id,
      eventType: "FIRST_TRIAGE",
      classification: "NEW",
      ruleEvaluationId: `${RUN}-first-eval`,
    })
  );
  const retry = await prisma.$transaction((tx) =>
    recordUsageEvent({
      tx,
      organisationId: org.id,
      episodeId: ep.id,
      eventType: "FIRST_TRIAGE",
      classification: "NEW",
      ruleEvaluationId: `${RUN}-second-eval`,
    })
  );
  assert.deepEqual([first, retry], [true, false]);
  assert.equal(
    await prisma.usageEvent.count({ where: { episodeId: ep.id, eventType: "FIRST_TRIAGE" } }),
    1
  );
});

test("J: EpisodeObservation foreign-key integrity remains enabled", async () => {
  const foreignKeys = await prisma.$queryRawUnsafe<Array<{ foreign_keys: bigint | number }>>(
    "PRAGMA foreign_keys"
  );
  assert.equal(Number(foreignKeys[0]?.foreign_keys), 1);
  await assert.rejects(
    prisma.$executeRawUnsafe(
      `INSERT INTO "EpisodeObservation"
       ("id", "episodeId", "classification", "explanation")
       VALUES (?, ?, 'NEW', 'Synthetic FK test')`,
      `${RUN}-orphan-observation`,
      `${RUN}-no-observation-episode`
    ),
    /FOREIGN KEY constraint failed/i
  );
});

test("episodes referenced by usage or observations cannot be deleted", async () => {
  const org = await organisation("episode-delete");
  const usageEpisode = await episode(org.id, "delete-usage");
  await usage(org.id, usageEpisode.id, "delete-usage");
  await assert.rejects(
    prisma.$executeRawUnsafe(`DELETE FROM "ScreeningEpisode" WHERE "id" = ?`, usageEpisode.id),
    /SCREENING_EPISODE_HAS_HISTORY/
  );

  const observedEpisode = await episode(org.id, "delete-observation");
  await prisma.episodeObservation.create({
    data: {
      episodeId: observedEpisode.id,
      classification: "NEW",
      explanation: "Synthetic arrival evidence",
    },
  });
  await assert.rejects(
    prisma.$executeRawUnsafe(`DELETE FROM "ScreeningEpisode" WHERE "id" = ?`, observedEpisode.id),
    /SCREENING_EPISODE_HAS_HISTORY/
  );
});

test("the integrity service distinguishes raw historical defects from corrected defects", async () => {
  const org = await organisation("historical-orphan");
  const beforeReport = await getUsageIntegrityReport();

  // Reproduce a row written by the old deployment, then restore the shipped
  // trigger immediately. The production migration never drops this trigger.
  const trigger = await prisma.$queryRawUnsafe<Array<{ sql: string }>>(
    `SELECT "sql" FROM sqlite_master
     WHERE "type" = 'trigger' AND "name" = 'UsageEvent_episode_exists_insert'`
  );
  assert.ok(trigger[0]?.sql);
  await prisma.$executeRawUnsafe(`DROP TRIGGER "UsageEvent_episode_exists_insert"`);
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "UsageEvent"
       ("id", "organisationId", "episodeId", "eventType", "classification", "idempotencyKey")
       VALUES (?, ?, ?, 'FIRST_TRIAGE', 'NEW', ?)`,
      `${RUN}-historical-orphan`,
      org.id,
      `${RUN}-rolled-back-episode`,
      `${RUN}-historical-orphan-key`
    );
  } finally {
    await prisma.$executeRawUnsafe(trigger[0]!.sql);
  }

  const uncorrected = await getUsageIntegrityReport();
  assert.equal(
    uncorrected.usageEventsWithMissingEpisode,
    beforeReport.usageEventsWithMissingEpisode + 1
  );
  assert.equal(
    uncorrected.uncorrectedInvalidUsageEvents,
    beforeReport.uncorrectedInvalidUsageEvents + 1
  );

  await prisma.$transaction((tx) =>
    recordUsageEventCorrection({
      tx,
      usageEventId: `${RUN}-historical-orphan`,
      organisationId: org.id,
      correctionType: "INVALIDATE",
      reasonCode: "EPISODE_REGISTRATION_ROLLBACK",
      reasonDetail: "Technical defect during earlier episode-registration transaction rollback.",
      systemActor: "CERVIGRADE_PHASE2_TEST_REMEDIATION",
    })
  );

  const corrected = await getUsageIntegrityReport();
  assert.equal(
    corrected.usageEventsWithMissingEpisode,
    beforeReport.usageEventsWithMissingEpisode + 1,
    "raw orphan evidence must remain physically present"
  );
  assert.equal(
    corrected.uncorrectedInvalidUsageEvents,
    beforeReport.uncorrectedInvalidUsageEvents,
    "the terminal correction resolves effective integrity"
  );
  assert.equal(corrected.episodeObservationsWithMissingEpisode, 0);
  assert.equal(corrected.duplicateFirstTriageGroups, 0);
});

test("K–L: a persisted manual regrade produces exactly one usage fact on retry", async () => {
  const org = await organisation("manual-regrade");
  const ep = await episode(org.id, "manual-regrade");
  const actor = await prisma.user.create({
    data: { email: `${RUN}-regrader@example.test`, name: "Synthetic Regrader", role: "ADMIN" },
  });
  const ruleSet = await seedRuleSet(prisma as never);
  const seededVersion = await seedVersion(prisma as never, {
    ruleSetId: ruleSet.id,
    displayVersion: `${RUN}-RULES-1.0.0`,
    status: "PUBLISHED",
    checksum: `${RUN}-checksum`,
  });
  const version = await prisma.clinicalRuleVersion.findUniqueOrThrow({
    where: { id: seededVersion.id },
  });
  const evaluationBase = {
    ruleSetId: ruleSet.id,
    ruleVersionId: version.id,
    ruleVersionDisplay: version.displayVersion,
    rulesetChecksum: version.checksum ?? `${RUN}-checksum`,
    engineVersion: "canonical-graph-v2",
    evaluationMode: "LIVE_DEMO" as const,
    canonicalInputSnapshot: "{}",
    matchedRuleIds: "[]",
    branchPath: "[]",
    provisionalRecommendation: "Synthetic governed recommendation",
    riskLevel: "LOW",
    missingInformation: "[]",
    reviewerRequirement: "MANDATORY_CLINICIAN_CONFIRMATION",
    sourceReferences: "[]",
    evaluationTrace: "[]",
  };
  const original = await prisma.ruleEvaluation.create({ data: evaluationBase });
  const run = await prisma.batchRun.create({
    data: {
      organisationId: org.id,
      source: "MANUAL",
      engineVersion: "canonical-graph-v2",
      totalCases: 1,
      pendingCount: 1,
      createdByUserId: actor.id,
      items: {
        create: {
          rowNumber: 1,
          episodeId: ep.id,
          figure: "SYNTHETIC",
          riskLevel: "LOW",
          recommendationCode: "SYNTHETIC",
          recommendation: "Synthetic governed recommendation",
          ruleEvaluationId: original.id,
          caseJson: "{}",
          inputJson: "{}",
          decisionJson: "{}",
          authorityEngine: "CANONICAL",
        },
      },
    },
    include: { items: true },
  });
  const item = run.items[0]!;
  const reason = "Controlled synthetic manual regrade";
  const regrade = await prisma.ruleEvaluation.create({
    data: {
      ...evaluationBase,
      batchRunId: run.id,
      previousEvaluationId: original.id,
      regradeReason: reason,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.batchReviewItem.update({
      where: { id: item.id },
      data: { ruleEvaluationId: regrade.id },
    });
    assert.equal(
      await recordManualRegradeUsage({
        tx,
        organisationId: org.id,
        episodeId: ep.id,
        batchReviewItemId: item.id,
        ruleEvaluationId: regrade.id,
        batchRunId: run.id,
        rulesetVersion: version.displayVersion,
        rulesetChecksum: version.checksum,
        source: run.source,
      }),
      true
    );
  });

  assert.equal(
    isPersistedManualRegradeRetry({
      evaluation: regrade,
      targetRuleVersionId: version.id,
      reason,
    }),
    true
  );
  assert.equal(
    await prisma.$transaction((tx) =>
      recordManualRegradeUsage({
        tx,
        organisationId: org.id,
        episodeId: ep.id,
        batchReviewItemId: item.id,
        ruleEvaluationId: regrade.id,
        batchRunId: run.id,
        rulesetVersion: version.displayVersion,
        rulesetChecksum: version.checksum,
        source: run.source,
      })
    ),
    false,
    "retrying the immutable evaluation must be a no-op"
  );

  const events = await prisma.usageEvent.findMany({
    where: { episodeId: ep.id, eventType: "REGRADE", ruleEvaluationId: regrade.id },
  });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.classification, "MANUAL_REGRADE");
});

test("migration closure is additive and never rebuilds immutable history tables", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20260815120000_usage_integrity_closure/migration.sql"
    ),
    "utf8"
  );
  for (const table of [
    "UsageEvent",
    "RuleEvaluation",
    "AuditLog",
    "ScreeningEpisode",
  ]) {
    assert.doesNotMatch(sql, new RegExp(`DROP\\s+TABLE\\s+"?${table}`, "i"));
    assert.doesNotMatch(sql, new RegExp(`ALTER\\s+TABLE\\s+"?${table}`, "i"));
  }
  assert.match(sql, /CREATE TABLE "UsageEventCorrection"/);
  assert.match(sql, /CREATE TRIGGER "UsageEvent_episode_exists_insert"/);
  assert.match(sql, /CREATE TRIGGER "ScreeningEpisode_history_restrict_delete"/);
});
