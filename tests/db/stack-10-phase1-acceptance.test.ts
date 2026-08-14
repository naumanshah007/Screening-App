/**
 * Phase 1 acceptance.
 *
 * Three properties that were asserted in design but not all proven in behaviour.
 * One of them did not hold: withheld arrivals produced no observation at all,
 * because saveBatchRun only ever received the SELECTED cases. A correctly
 * suppressed result was therefore indistinguishable from a lost one — the exact
 * failure the observation log exists to prevent.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "@/lib/prisma";
import { classifyEpisode, strongFingerprint, weakFingerprint } from "@/lib/batch/episode-classification";
import { recordEpisodeObservation, type ClassifiedCase } from "@/lib/batch/episode-registry";
import {
  ensureDefaultOrganisation,
  requireCurrentOrganisationId,
} from "@/lib/organisation/current-organisation";

const RUN = `ACC1-${Date.now()}`;

async function context() {
  const previous = process.env.ORGANISATION_KEY;
  process.env.ORGANISATION_KEY = `${RUN}-org`;
  await ensureDefaultOrganisation();
  const organisationId = await requireCurrentOrganisationId();
  const actor = await prisma.user.findFirst({ select: { id: true } });
  return {
    organisationId,
    actorId: actor?.id ?? null,
    restore() {
      if (previous === undefined) delete process.env.ORGANISATION_KEY;
      else process.env.ORGANISATION_KEY = previous;
    },
  };
}

function identityFor(organisationId: string, accession: string) {
  return {
    organisationId,
    sourceFacility: "Awanui Labs — Auckland",
    sourceEpisodeKey: accession,
    nhi: `NHI${accession.slice(-4)}`,
    testType: "HPV_LBC",
    collectedOn: "2026-08-03",
  };
}

function classifiedFor(
  organisationId: string,
  accession: string,
  clinical: string,
  extra: Partial<ClassifiedCase> = {}
): ClassifiedCase {
  const identity = identityFor(organisationId, accession);
  return {
    index: 0,
    classification: "NEW",
    processable: true,
    matchedEpisodeId: null,
    explanation: "Not seen before.",
    strongFingerprint: strongFingerprint(identity),
    weakFingerprint: weakFingerprint(identity),
    clinicalPayloadDigest: clinical,
    rawPayloadDigest: `raw-${clinical}`,
    ...extra,
  };
}

// ─── (1) Every arrival leaves a trace ───────────────────────────────────────

test("37 arrivals produce 37 observations while only 34 become new work", async () => {
  // The headline acceptance number, exercised at the registry boundary that
  // saveBatchRun drives. 34 arrivals become review items; 3 are withheld and
  // must STILL be recorded.
  const ctx = await context();
  try {
    const created: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < 37; i++) {
        const accession = `${RUN}-BULK-${String(i).padStart(3, "0")}`;
        const withheld = i >= 34;
        const episodeId = await recordEpisodeObservation({
          tx,
          organisationId: ctx.organisationId,
          batchRunId: null,
          identity: identityFor(ctx.organisationId, accession),
          classified: classifiedFor(ctx.organisationId, accession, `v1:clinical-${i}`, {
            classification: withheld ? "ALREADY_IN_REVIEW" : "NEW",
            processable: !withheld,
            explanation: withheld
              ? `Already in the Review Queue — accession ${accession}.`
              : "Not seen before.",
          }),
          // The distinction under test: withheld arrivals carry no review item.
          batchReviewItemId: withheld ? null : `item-${i}`,
        });
        created.push(episodeId);
      }
    });

    try {
      const observations = await prisma.episodeObservation.findMany({
        where: { episodeId: { in: created } },
        select: { batchReviewItemId: true },
      });

      assert.equal(observations.length, 37, "every arrival must be on record");
      assert.equal(
        observations.filter((o) => o.batchReviewItemId !== null).length,
        34,
        "only the selected arrivals become new work"
      );
      assert.equal(
        observations.filter((o) => o.batchReviewItemId === null).length,
        3,
        "the withheld arrivals must still be traceable"
      );
    } finally {
      await prisma.screeningEpisode.deleteMany({ where: { id: { in: created } } });
    }
  } finally {
    ctx.restore();
  }
});

test("saveBatchRun accepts the arrivals it is not processing", async () => {
  // The plumbing that carries them. Without this parameter the withheld cases
  // never reach the registry, which is how the gap arose.
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const source = readFileSync(
    join(__dirname, "..", "..", "lib", "batch", "persistence.ts"),
    "utf8"
  );
  assert.match(source, /withheldCases\?: CanonicalBatchCase\[\]/);

  // Assert the intent, not the formatting.
  const block = source.slice(
    source.indexOf("Register every arrival against its clinical episode"),
    source.indexOf("await prisma.auditLog.create(")
  );
  assert.ok(block.length > 0, "the registration block must exist");
  assert.match(block, /recordEpisodeObservation\(\{/, "it must record observations");
  assert.match(
    block,
    /batchReviewItemId: persisted\?\.id \?\? null/,
    "a withheld arrival is recorded with no review item"
  );
  // Withheld arrivals must be re-routed and re-classified server-side, never
  // trusted from the client — a client-supplied classification could otherwise
  // suppress a case the server would have processed.
  assert.match(block, /processBatch\(withheldCases/);
  assert.match(block, /classifyIncomingCases\(\{ organisationId, items: withheldRouted\.results \}\)/);
});

// ─── (2) An update supersedes a stale review item ───────────────────────────

test("an update flags the still-open item without altering its decision", async () => {
  const ctx = await context();
  try {
    if (!ctx.actorId) return;

    const accession = `${RUN}-SUPERSEDE`;
    const episode = await prisma.screeningEpisode.create({
      data: {
        organisationId: ctx.organisationId,
        strongFingerprint: strongFingerprint(identityFor(ctx.organisationId, accession)),
        weakFingerprint: weakFingerprint(identityFor(ctx.organisationId, accession)),
        sourceEpisodeKey: accession,
        clinicalPayloadDigest: "v1:clinical-1",
      },
    });

    const run = await prisma.batchRun.create({
      data: {
        organisationId: ctx.organisationId,
        source: "HL7",
        engineVersion: "acceptance-test",
        totalCases: 2,
        pendingCount: 2,
        createdByUserId: ctx.actorId,
        items: {
          create: [
            {
              rowNumber: 1,
              figure: "FIGURE_3",
              riskLevel: "HIGH",
              recommendationCode: "ORIGINAL",
              recommendation: "Original recommendation",
              caseJson: "{}",
              inputJson: "{}",
              decisionJson: "{}",
              episodeId: episode.id,
              disposition: "PENDING",
            },
            {
              rowNumber: 2,
              figure: "FIGURE_3",
              riskLevel: "URGENT",
              recommendationCode: "AMENDED",
              recommendation: "Amended recommendation",
              caseJson: "{}",
              inputJson: "{}",
              decisionJson: "{}",
              episodeId: episode.id,
              disposition: "PENDING",
            },
          ],
        },
      },
      include: { items: { orderBy: { rowNumber: "asc" } } },
    });

    try {
      const [original, amended] = run.items;

      // What persistence does when an update arrives for a queued episode.
      await prisma.batchReviewItem.updateMany({
        where: {
          episodeId: episode.id,
          id: { not: amended.id },
          disposition: { in: ["PENDING", "NEEDS_INFO"] },
          supersededByItemId: null,
        },
        data: { supersededByItemId: amended.id, supersededAt: new Date() },
      });

      const after = await prisma.batchReviewItem.findUnique({ where: { id: original.id } });
      assert.equal(after?.supersededByItemId, amended.id, "the stale item must be flagged");
      assert.ok(after?.supersededAt, "and stamped");

      // Nothing about the original decision may change. It is the record of
      // what was known at the time, and a reviewer may still need to read it.
      assert.equal(after?.recommendationCode, "ORIGINAL");
      assert.equal(after?.recommendation, "Original recommendation");
      assert.equal(after?.riskLevel, "HIGH");
      assert.equal(after?.disposition, "PENDING", "the reviewer's own disposition is untouched");

      // The newer item is not itself flagged.
      const newer = await prisma.batchReviewItem.findUnique({ where: { id: amended.id } });
      assert.equal(newer?.supersededByItemId, null);
    } finally {
      await prisma.batchRun.delete({ where: { id: run.id } });
      await prisma.screeningEpisode.delete({ where: { id: episode.id } });
    }
  } finally {
    ctx.restore();
  }
});

test("registration is per-arrival, so one batch cannot roll back wholesale", async () => {
  /*
    Found in live verification, not by these tests.

    Registration originally wrapped the entire batch — every episode upsert,
    every observation, the re-routing of withheld cases and their classification
    — in ONE interactive transaction. On a 30-case run against a remote database
    that exceeded Prisma's interactive-transaction timeout and the whole thing
    rolled back: every review item kept a null episodeId, not a single
    observation was written, and the in-memory episode map survived the rollback
    and was then used to write usage events pointing at episodes that no longer
    existed.

    The unit tests passed throughout, because each of them opens one tiny
    transaction. Only volume against a real network exposed it.
  */
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const source = readFileSync(
    join(__dirname, "..", "..", "lib", "batch", "persistence.ts"),
    "utf8"
  );

  const block = source.slice(
    source.indexOf("Register every arrival against its clinical episode"),
    source.indexOf("await prisma.auditLog.create(")
  );
  assert.ok(block.length > 0);

  // Classification must not run inside a transaction — its own reads are what
  // made the block slow enough to time out.
  const txBodies = block.match(/prisma\.\$transaction\(async \(tx\) => \{[\s\S]*?\n {8}\}\)/g) ?? [];
  for (const body of txBodies) {
    assert.ok(
      !body.includes("classifyIncomingCases"),
      "classification must happen outside the transaction"
    );
    assert.ok(
      !body.includes("processBatch("),
      "re-routing must happen outside the transaction"
    );
  }

  // The episode map may only be populated after a write commits, so a rollback
  // cannot leave usage events pointing at episodes that do not exist.
  assert.match(
    block,
    /\/\/ Only after the write committed\.\s*\n\s*if \(persisted\) episodeIdByRow\.set/,
    "the map must be populated only from committed writes"
  );

  // A failure must be contained to one arrival.
  assert.match(
    block,
    /\} catch \(arrivalError\) \{[\s\S]{0,200}Episode registration failed for arrival/,
    "one arrival failing must not abandon the rest"
  );
});

test("a completed decision is never flagged as superseded", async () => {
  // The filter is deliberately PENDING/NEEDS_INFO only. A finished decision
  // stands: the amendment arrives as its own case for a clinician to consider,
  // and nothing retroactively marks the completed one.
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const source = readFileSync(
    join(__dirname, "..", "..", "lib", "batch", "persistence.ts"),
    "utf8"
  );
  assert.match(source, /disposition: \{ in: \["PENDING", "NEEDS_INFO"\] \}/);
  assert.ok(
    !/disposition: \{ in: \[[^\]]*"ACCEPTED"/.test(source),
    "an accepted decision must never be rewritten or flagged"
  );
});
