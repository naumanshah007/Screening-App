/**
 * Phase 1B: the episode register, end to end.
 *
 * The pure classification rules are covered in
 * lib/batch/__tests__/episode-classification.test.ts. What this adds is the
 * behaviour that only shows up once state is persisted and read back:
 *
 *   - the second arrival of an episode is recognised at all;
 *   - a skipped arrival still leaves a trace, so a suppressed result can never
 *     be mistaken for a lost one;
 *   - a skipped arrival does not move the baseline that the NEXT arrival is
 *     compared against.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "@/lib/prisma";
import {
  classifyEpisode,
  strongFingerprint,
  weakFingerprint,
} from "@/lib/batch/episode-classification";
import { recordEpisodeObservation, type ClassifiedCase } from "@/lib/batch/episode-registry";
import {
  ensureDefaultOrganisation,
  requireCurrentOrganisationId,
} from "@/lib/organisation/current-organisation";

const RUN = `EPI-${Date.now()}`;

async function context() {
  const previous = process.env.ORGANISATION_KEY;
  process.env.ORGANISATION_KEY = `${RUN}-org`;
  await ensureDefaultOrganisation();
  const organisationId = await requireCurrentOrganisationId();
  return {
    organisationId,
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
    nhi: "ZAB1042",
    testType: "HPV_LBC",
    collectedOn: "2026-08-03",
  };
}

function classifiedFrom(
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

test("a second arrival of the same specimen is recognised", async () => {
  const ctx = await context();
  try {
    const accession = `${RUN}-ACC-A`;
    const identity = identityFor(ctx.organisationId, accession);

    // First arrival, turned into a case.
    await prisma.$transaction(async (tx) => {
      await recordEpisodeObservation({
        tx,
        organisationId: ctx.organisationId,
        batchRunId: null,
        identity,
        classified: classifiedFrom(ctx.organisationId, accession, "v1:clinical-1"),
        batchReviewItemId: "item-1",
      });
    });

    const stored = await prisma.screeningEpisode.findUnique({
      where: { strongFingerprint: strongFingerprint(identity)! },
    });
    assert.ok(stored, "the episode must be findable by its deterministic identity");
    assert.equal(stored.clinicalPayloadDigest, "v1:clinical-1");
    // Identifiers kept in clear, so a match can be explained rather than asserted.
    assert.equal(stored.sourceEpisodeKey, accession);
    assert.equal(stored.sourceFacility, "Awanui Labs — Auckland");

    // Second arrival, unchanged content, already decided.
    const again = classifyEpisode({
      identity,
      clinicalPayloadDigest: "v1:clinical-1",
      strongMatch: {
        episodeId: stored.id,
        isCompleted: true,
        isAwaitingReview: false,
        clinicalPayloadDigest: stored.clinicalPayloadDigest,
        sourceEpisodeKey: stored.sourceEpisodeKey,
        sourceFacility: stored.sourceFacility,
        collectedOn: stored.collectedOn,
        lastSeenAt: stored.lastSeenAt,
      },
    });
    assert.equal(again.classification, "COMPLETED");
    assert.equal(again.processable, false);

    await prisma.screeningEpisode.delete({ where: { id: stored.id } });
  } finally {
    ctx.restore();
  }
});

test("an arrival that is not reprocessed still leaves a trace", async () => {
  // The safety record. Without this row, a correctly-suppressed duplicate is
  // indistinguishable from a result that was lost — and "what happened to the
  // result we sent you?" is the first question asked.
  const ctx = await context();
  try {
    const accession = `${RUN}-ACC-B`;
    const identity = identityFor(ctx.organisationId, accession);

    let episodeId = "";
    await prisma.$transaction(async (tx) => {
      episodeId = await recordEpisodeObservation({
        tx,
        organisationId: ctx.organisationId,
        batchRunId: null,
        identity,
        classified: classifiedFrom(ctx.organisationId, accession, "v1:clinical-1"),
        batchReviewItemId: "item-1",
      });
    });

    await prisma.$transaction(async (tx) => {
      await recordEpisodeObservation({
        tx,
        organisationId: ctx.organisationId,
        batchRunId: null,
        identity,
        classified: classifiedFrom(ctx.organisationId, accession, "v1:clinical-1", {
          classification: "COMPLETED",
          processable: false,
          matchedEpisodeId: episodeId,
          explanation: `Already reviewed and completed — accession ${accession}.`,
        }),
        // Not turned into a case.
        batchReviewItemId: null,
      });
    });

    const observations = await prisma.episodeObservation.findMany({
      where: { episodeId },
      orderBy: { observedAt: "asc" },
    });
    assert.equal(observations.length, 2, "both arrivals must be on record");
    assert.equal(observations[1].classification, "COMPLETED");
    assert.equal(observations[1].batchReviewItemId, null, "no case was created");
    assert.match(
      observations[1].explanation,
      new RegExp(accession),
      "the trace must say why, in the source's own terms"
    );

    await prisma.screeningEpisode.delete({ where: { id: episodeId } });
  } finally {
    ctx.restore();
  }
});

test("a skipped arrival does not move the comparison baseline", async () => {
  // If a duplicate that was never reviewed advanced the stored digest, the next
  // genuine amendment would be measured against content no clinician ever saw —
  // and could be silently classified as unchanged.
  const ctx = await context();
  try {
    const accession = `${RUN}-ACC-C`;
    const identity = identityFor(ctx.organisationId, accession);

    let episodeId = "";
    await prisma.$transaction(async (tx) => {
      episodeId = await recordEpisodeObservation({
        tx,
        organisationId: ctx.organisationId,
        batchRunId: null,
        identity,
        classified: classifiedFrom(ctx.organisationId, accession, "v1:clinical-1"),
        batchReviewItemId: "item-1",
      });
    });

    await prisma.$transaction(async (tx) => {
      await recordEpisodeObservation({
        tx,
        organisationId: ctx.organisationId,
        batchRunId: null,
        identity,
        classified: classifiedFrom(ctx.organisationId, accession, "v1:clinical-2", {
          classification: "COMPLETED",
          processable: false,
          matchedEpisodeId: episodeId,
        }),
        batchReviewItemId: null,
      });
    });

    const episode = await prisma.screeningEpisode.findUnique({ where: { id: episodeId } });
    assert.equal(
      episode?.clinicalPayloadDigest,
      "v1:clinical-1",
      "the baseline must remain the content a clinician actually saw"
    );

    await prisma.screeningEpisode.delete({ where: { id: episodeId } });
  } finally {
    ctx.restore();
  }
});

test("two organisations never share an episode", async () => {
  const ctx = await context();
  try {
    const accession = `${RUN}-ACC-D`;
    const mine = strongFingerprint(identityFor(ctx.organisationId, accession));
    const theirs = strongFingerprint(identityFor("some-other-org", accession));
    assert.notEqual(mine, theirs, "the same accession at two customers is two episodes");
  } finally {
    ctx.restore();
  }
});

test("deleting an episode takes its observations with it", async () => {
  const ctx = await context();
  try {
    const accession = `${RUN}-ACC-E`;
    let episodeId = "";
    await prisma.$transaction(async (tx) => {
      episodeId = await recordEpisodeObservation({
        tx,
        organisationId: ctx.organisationId,
        batchRunId: null,
        identity: identityFor(ctx.organisationId, accession),
        classified: classifiedFrom(ctx.organisationId, accession, "v1:clinical-1"),
        batchReviewItemId: "item-1",
      });
    });

    await prisma.screeningEpisode.delete({ where: { id: episodeId } });
    assert.equal(
      await prisma.episodeObservation.count({ where: { episodeId } }),
      0,
      "observations must not outlive the episode they describe"
    );
  } finally {
    ctx.restore();
  }
});
