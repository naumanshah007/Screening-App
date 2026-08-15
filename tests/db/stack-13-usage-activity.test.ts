/** Phase 2B: correction-aware Usage & Activity read model. */

import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  applySchema,
  createIsolatedDatabase,
  seedRuleSet,
  seedVersion,
} from "./support/isolated-db";

const database = createIsolatedDatabase("usage-activity");
const RUN = `USAGE-ACTIVITY-${Date.now()}`;

type PrismaClient = typeof import("../../lib/prisma")["prisma"];
let prisma: PrismaClient;
let effectiveUsageCount: typeof import("../../lib/usage/usage-queries")["effectiveUsageCount"];
let rawUsageEvents: typeof import("../../lib/usage/usage-queries")["rawUsageEvents"];
let invalidatedUsageEvents: typeof import("../../lib/usage/usage-queries")["invalidatedUsageEvents"];
let getUsageIntegrityCounts: typeof import("../../lib/usage/usage-activity")["getUsageIntegrityCounts"];
let listUsageActivity: typeof import("../../lib/usage/usage-activity")["listUsageActivity"];
let getUsageMetrics: typeof import("../../lib/usage/usage-activity")["getUsageMetrics"];
let getEpisodeHistory: typeof import("../../lib/usage/usage-activity")["getEpisodeHistory"];
let resolveUsageDateRange: typeof import("../../lib/usage/usage-date-range")["resolveUsageDateRange"];

before(async () => {
  await applySchema(database.file);
  ({ prisma } = await import("../../lib/prisma"));
  ({ effectiveUsageCount, rawUsageEvents, invalidatedUsageEvents } = await import(
    "../../lib/usage/usage-queries"
  ));
  ({ getUsageIntegrityCounts, listUsageActivity, getUsageMetrics, getEpisodeHistory } =
    await import("../../lib/usage/usage-activity"));
  ({ resolveUsageDateRange } = await import("../../lib/usage/usage-date-range"));
});

after(async () => {
  await prisma?.$disconnect?.().catch(() => undefined);
  database.cleanup();
});

async function organisation(suffix: string) {
  return prisma.organisation.create({
    data: { key: `${RUN}-${suffix}`.toLowerCase(), name: `Usage activity ${suffix}` },
  });
}

function range(organisationId: string, from = "2026-01-01", to = "2027-01-01") {
  return {
    organisationId,
    from: new Date(`${from}T00:00:00.000Z`),
    toExclusive: new Date(`${to}T00:00:00.000Z`),
  };
}

test("the 61 raw / 27 invalidated fixture produces 34 effective events", async () => {
  const org = await organisation("correction-fixture");
  const episodes = Array.from({ length: 61 }, (_, index) => ({
    id: `${RUN}-fixture-episode-${index}`,
    organisationId: org.id,
    weakFingerprint: `${RUN}-fixture-weak-${index}`,
  }));
  await prisma.screeningEpisode.createMany({ data: episodes });
  await prisma.usageEvent.createMany({
    data: episodes.map((episode, index) => ({
      id: `${RUN}-fixture-usage-${index}`,
      organisationId: org.id,
      episodeId: episode.id,
      eventType: index % 4 === 1 ? "UPDATE_REEVALUATION" : "FIRST_TRIAGE",
      classification: index % 4 === 1 ? "UPDATED" : "NEW",
      source: index % 2 === 0 ? "FHIR" : "HL7",
      idempotencyKey: `${RUN}-fixture-key-${index}`,
      occurredAt: new Date(`2026-02-${String((index % 20) + 1).padStart(2, "0")}T12:00:00.000Z`),
    })),
  });
  await prisma.usageEventCorrection.createMany({
    data: Array.from({ length: 27 }, (_, offset) => {
      const index = 34 + offset;
      return {
        id: `${RUN}-fixture-correction-${index}`,
        usageEventId: `${RUN}-fixture-usage-${index}`,
        correctionType: "INVALIDATE" as const,
        reasonCode: "EPISODE_REGISTRATION_ROLLBACK" as const,
        reasonDetail: "Synthetic historical rollback fixture.",
        systemActor: "PHASE_2B_TEST",
        organisationId: org.id,
      };
    }),
  });

  const filters = range(org.id);
  const [raw, invalidated, effectiveCount, integrity, page] = await Promise.all([
    rawUsageEvents({ organisationId: org.id, take: 100 }),
    invalidatedUsageEvents({ organisationId: org.id, take: 100 }),
    effectiveUsageCount({ organisationId: org.id }),
    getUsageIntegrityCounts(filters),
    listUsageActivity({ ...filters, pageSize: 100 }),
  ]);

  assert.equal(raw.length, 61, "raw audit history remains accessible");
  assert.equal(invalidated.length, 27, "terminal correction evidence remains accessible");
  assert.equal(effectiveCount, 34);
  assert.deepEqual(integrity, { raw: 61, invalidated: 27, effective: 34 });
  assert.equal(page.total, 34, "the operational table never includes corrected events");
  assert.ok(page.rows.every((row) => Number(row.id.split("-").at(-1)) < 34));
});

test("date, event-type and source filters constrain effective queries", async () => {
  const org = await organisation("filters");
  const episodes = ["fhir", "hl7", "corrected"].map((suffix) => ({
    id: `${RUN}-filter-${suffix}`,
    organisationId: org.id,
    weakFingerprint: `${RUN}-filter-${suffix}-weak`,
  }));
  await prisma.screeningEpisode.createMany({ data: episodes });
  await prisma.usageEvent.createMany({
    data: [
      {
        id: `${RUN}-filter-usage-fhir`,
        organisationId: org.id,
        episodeId: episodes[0]!.id,
        eventType: "FIRST_TRIAGE",
        classification: "NEW",
        source: "FHIR",
        rulesetVersion: "3.1.0",
        idempotencyKey: `${RUN}-filter-key-fhir`,
        occurredAt: new Date("2026-03-05T10:00:00.000Z"),
      },
      {
        id: `${RUN}-filter-usage-hl7`,
        organisationId: org.id,
        episodeId: episodes[1]!.id,
        eventType: "REGRADE",
        classification: "MANUAL_REGRADE",
        source: "HL7",
        rulesetVersion: "3.1.0",
        idempotencyKey: `${RUN}-filter-key-hl7`,
        occurredAt: new Date("2026-04-05T10:00:00.000Z"),
      },
      {
        id: `${RUN}-filter-usage-corrected`,
        organisationId: org.id,
        episodeId: episodes[2]!.id,
        eventType: "FIRST_TRIAGE",
        classification: "NEW",
        source: "FHIR",
        rulesetVersion: "3.1.0",
        idempotencyKey: `${RUN}-filter-key-corrected`,
        occurredAt: new Date("2026-03-06T10:00:00.000Z"),
      },
    ],
  });
  await prisma.usageEventCorrection.create({
    data: {
      usageEventId: `${RUN}-filter-usage-corrected`,
      correctionType: "INVALIDATE",
      reasonCode: "EPISODE_REGISTRATION_ROLLBACK",
      organisationId: org.id,
      systemActor: "PHASE_2B_TEST",
    },
  });

  const marchFhirFirstTriage = await listUsageActivity({
    ...range(org.id, "2026-03-01", "2026-04-01"),
    source: "FHIR",
    eventType: "FIRST_TRIAGE",
  });
  assert.equal(marchFhirFirstTriage.total, 1);
  assert.equal(marchFhirFirstTriage.rows[0]?.id, `${RUN}-filter-usage-fhir`);

  const regrades = await getUsageMetrics({
    ...range(org.id),
    eventType: "REGRADE",
  });
  assert.equal(regrades.manualRegrades, 1);
  assert.equal(regrades.firstTriages, 0);
});

test("source facility, ruleset, episode activity and review status filters use stored evidence", async () => {
  const org = await organisation("operational-filters");
  const actor = await prisma.user.create({
    data: {
      email: `${RUN}-operational@example.test`,
      name: "Operational filter actor",
      role: "ADMIN",
    },
  });
  const episodes = await Promise.all(
    [
      ["pending", "Facility A"],
      ["accepted", "Facility B"],
    ].map(([suffix, sourceFacility]) =>
      prisma.screeningEpisode.create({
        data: {
          id: `${RUN}-operational-${suffix}`,
          organisationId: org.id,
          weakFingerprint: `${RUN}-operational-${suffix}-weak`,
          sourceFacility,
          observations: {
            create: {
              classification: "NEW",
              explanation: "Stored source arrival.",
              observedAt: new Date("2026-06-10T09:00:00.000Z"),
            },
          },
        },
      })
    )
  );
  const run = await prisma.batchRun.create({
    data: {
      organisationId: org.id,
      source: "FHIR",
      sourceSystem: "Connector A",
      engineVersion: "canonical-graph-v2",
      totalCases: 2,
      pendingCount: 1,
      acceptedCount: 1,
      createdByUserId: actor.id,
      items: {
        create: episodes.map((episode, index) => ({
          rowNumber: index + 1,
          episodeId: episode.id,
          figure: "SYNTHETIC",
          riskLevel: "LOW",
          recommendationCode: "SYNTHETIC",
          recommendation: "Synthetic only",
          caseJson: "{}",
          inputJson: "{}",
          decisionJson: "{}",
          disposition: index === 0 ? ("PENDING" as const) : ("ACCEPTED" as const),
        })),
      },
    },
    include: { items: true },
  });
  await prisma.usageEvent.createMany({
    data: run.items.map((item, index) => ({
      id: `${RUN}-operational-usage-${index}`,
      organisationId: org.id,
      episodeId: episodes[index]!.id,
      eventType: index === 0 ? "FIRST_TRIAGE" : "REGRADE",
      classification: index === 0 ? "NEW" : "MANUAL_REGRADE",
      batchReviewItemId: item.id,
      batchRunId: run.id,
      rulesetVersion: index === 0 ? "3.1.0" : "3.2.0",
      idempotencyKey: `${RUN}-operational-key-${index}`,
      occurredAt: new Date("2026-06-10T09:05:00.000Z"),
    })),
  });

  const filters = range(org.id, "2026-06-01", "2026-07-01");
  const [pending, facility, regrade, metrics] = await Promise.all([
    listUsageActivity({ ...filters, reviewStatus: "PENDING" }),
    listUsageActivity({ ...filters, source: "Facility A" }),
    listUsageActivity({
      ...filters,
      rulesetVersion: "3.2.0",
      episodeActivity: "MANUAL_REGRADE",
    }),
    getUsageMetrics(filters),
  ]);
  assert.equal(pending.total, 1);
  assert.equal(pending.rows[0]?.reviewStatus, "PENDING");
  assert.equal(facility.total, 1, "source facility participates in the source filter");
  assert.equal(regrade.total, 1);
  assert.equal(regrade.rows[0]?.rulesetVersion, "3.2.0");
  assert.equal(metrics.arrivals, 2);
  assert.equal(metrics.inReview, 1);
  assert.equal(metrics.completed, 1);
});

test("episode history shows only recorded activity and preserves linked evaluations", async () => {
  const org = await organisation("history");
  const episode = await prisma.screeningEpisode.create({
    data: {
      id: `${RUN}-history-episode`,
      organisationId: org.id,
      weakFingerprint: `${RUN}-history-weak`,
      sourceEpisodeKey: "SPECIMEN-DEMO-42",
      sourceFacility: "Synthetic Lab",
      observations: {
        create: {
          classification: "UPDATED",
          explanation: "A governed clinical field changed.",
          observedAt: new Date("2026-05-02T10:00:00.000Z"),
        },
      },
      firstSeenAt: new Date("2026-05-01T10:00:00.000Z"),
    },
  });
  const ruleSet = await seedRuleSet(prisma as never);
  const version = await seedVersion(prisma as never, {
    ruleSetId: ruleSet.id,
    displayVersion: "3.1.0-PHASE2B",
    status: "PUBLISHED",
  });
  const evaluationBase = {
    ruleSetId: ruleSet.id,
    ruleVersionId: version.id,
    ruleVersionDisplay: "3.1.0-PHASE2B",
    rulesetChecksum: "phase2b-checksum",
    engineVersion: "canonical-graph-v2",
    evaluationMode: "LIVE_DEMO" as const,
    canonicalInputSnapshot: "{}",
    matchedRuleIds: "[]",
    branchPath: "[]",
    provisionalRecommendation: "Synthetic only",
    riskLevel: "LOW",
    missingInformation: "[]",
    reviewerRequirement: "MANDATORY_CLINICIAN_CONFIRMATION",
    sourceReferences: "[]",
    evaluationTrace: "[]",
  };
  const first = await prisma.ruleEvaluation.create({
    data: { ...evaluationBase, evaluatedAt: new Date("2026-05-01T10:05:00.000Z") },
  });
  const successor = await prisma.ruleEvaluation.create({
    data: {
      ...evaluationBase,
      previousEvaluationId: first.id,
      regradeReason: "Updated result received.",
      evaluatedAt: new Date("2026-05-02T10:05:00.000Z"),
    },
  });
  await prisma.usageEvent.createMany({
    data: [
      {
        organisationId: org.id,
        episodeId: episode.id,
        eventType: "FIRST_TRIAGE",
        classification: "NEW",
        ruleEvaluationId: first.id,
        rulesetVersion: "3.1.0-PHASE2B",
        idempotencyKey: `${RUN}-history-first`,
        occurredAt: new Date("2026-05-01T10:05:00.000Z"),
      },
      {
        organisationId: org.id,
        episodeId: episode.id,
        eventType: "UPDATE_REEVALUATION",
        classification: "UPDATED",
        ruleEvaluationId: successor.id,
        rulesetVersion: "3.1.0-PHASE2B",
        idempotencyKey: `${RUN}-history-update`,
        occurredAt: new Date("2026-05-02T10:05:00.000Z"),
      },
    ],
  });

  const history = await getEpisodeHistory({ organisationId: org.id, episodeId: episode.id });
  assert.ok(history);
  assert.equal(history.episodeReference, "SPECIMEN-DEMO-42");
  assert.deepEqual(
    history.evaluations.map((evaluation) => evaluation.id),
    [first.id, successor.id]
  );
  assert.ok(history.events.some((event) => event.title === "Episode received"));
  assert.ok(history.events.some((event) => event.title === "Updated result received"));
  assert.ok(history.events.some((event) => event.title === "First triage"));
  assert.ok(history.events.some((event) => event.title === "Updated result"));
  assert.ok(!history.events.some((event) => event.title === "Review completed"));
});

test("date presets use inclusive app calendar days with an exclusive end instant", () => {
  const now = new Date("2026-08-15T03:00:00.000Z");
  const today = resolveUsageDateRange({ preset: "today" }, now);
  assert.equal(today.fromDate, "2026-08-15");
  assert.equal(today.from.toISOString(), "2026-08-14T12:00:00.000Z");
  assert.equal(today.toExclusive.toISOString(), "2026-08-15T12:00:00.000Z");

  const lastSeven = resolveUsageDateRange({ preset: "7d" }, now);
  assert.equal(lastSeven.fromDate, "2026-08-09");
  assert.equal(lastSeven.toDate, "2026-08-15");
});
