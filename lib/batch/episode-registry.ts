import type { Prisma } from "@prisma/client";

import {
  classifyEpisode,
  strongFingerprint,
  weakFingerprint,
  type ClassificationResult,
  type EpisodeIdentity,
  type KnownEpisode,
} from "@/lib/batch/episode-classification";
import { clinicalPayloadDigest, rawPayloadDigest } from "@/lib/batch/source-identity";
import type { BatchCaseResult } from "@/lib/batch/types";
import { prisma } from "@/lib/prisma";

/**
 * Reads and writes the episode register.
 *
 * The decision itself lives in episode-classification.ts, which is pure. This
 * module only supplies it with what is already on record and persists what came
 * back — so the rules stay directly testable and the database work stays boring.
 */

/** Identity of an arriving case, from what the adapter carried through. */
export function identityForCase(
  organisationId: string,
  item: BatchCaseResult
): EpisodeIdentity {
  const source = item.case.source;
  return {
    organisationId,
    sourceFacility: source.sourceFacility ?? source.sourceSystem ?? null,
    sourceEpisodeKey: source.sourceEpisodeKey ?? null,
    nhi: item.case.nhi ?? source.externalPatientId ?? null,
    testType: source.testType ?? null,
    collectedOn: source.collectedOn ?? item.case.receivedDate ?? null,
  };
}

/**
 * Is an episode decided, or queued?
 *
 * Derived from the review items that belong to it rather than stored as a
 * status on the episode, so it cannot drift from the reviewer's actual
 * disposition. `PENDING` on a persisted item means it is in the queue;
 * `ACCEPTED` or `REJECTED` means a clinician has finished with it.
 */
const EPISODE_STATE_SELECT = {
  id: true,
  clinicalPayloadDigest: true,
  sourceEpisodeKey: true,
  sourceFacility: true,
  collectedOn: true,
  lastSeenAt: true,
} satisfies Prisma.ScreeningEpisodeSelect;

async function toKnownEpisode(
  episode: Prisma.ScreeningEpisodeGetPayload<{ select: typeof EPISODE_STATE_SELECT }>
): Promise<KnownEpisode> {
  const items = await prisma.batchReviewItem.findMany({
    where: { episodeId: episode.id },
    select: { disposition: true },
  });

  return {
    episodeId: episode.id,
    isCompleted: items.some(
      (item) => item.disposition === "ACCEPTED" || item.disposition === "REJECTED"
    ),
    isAwaitingReview: items.some(
      (item) => item.disposition === "PENDING" || item.disposition === "NEEDS_INFO"
    ),
    clinicalPayloadDigest: episode.clinicalPayloadDigest,
    sourceEpisodeKey: episode.sourceEpisodeKey,
    sourceFacility: episode.sourceFacility,
    collectedOn: episode.collectedOn,
    lastSeenAt: episode.lastSeenAt,
  };
}

export type ClassifiedCase = ClassificationResult & {
  /** Index of the case within the incoming batch. */
  index: number;
  strongFingerprint: string | null;
  weakFingerprint: string;
  clinicalPayloadDigest: string;
  rawPayloadDigest: string;
};

/**
 * Classify a whole incoming batch against what is already on record.
 *
 * READ-ONLY. Safe to call from the preview path, which persists nothing — so
 * the intake screen can show the counts before anything is committed.
 */
export async function classifyIncomingCases(args: {
  organisationId: string;
  items: BatchCaseResult[];
}): Promise<ClassifiedCase[]> {
  const results: ClassifiedCase[] = [];

  for (const [index, item] of args.items.entries()) {
    const identity = identityForCase(args.organisationId, item);
    const strong = strongFingerprint(identity);
    const weak = weakFingerprint(identity);
    const clinical = clinicalPayloadDigest(item.input);

    const strongEpisode = strong
      ? await prisma.screeningEpisode.findUnique({
          where: { strongFingerprint: strong },
          select: EPISODE_STATE_SELECT,
        })
      : null;

    // Resemblance is only consulted when there is no deterministic match, and
    // never when the arriving case carries its own accession number: if it does
    // and nothing matched it, this is a different specimen, not a maybe.
    const weakEpisodes =
      !strongEpisode && !strong
        ? await prisma.screeningEpisode.findMany({
            where: { organisationId: args.organisationId, weakFingerprint: weak },
            select: EPISODE_STATE_SELECT,
            orderBy: { lastSeenAt: "desc" },
            take: 3,
          })
        : [];

    const classification = classifyEpisode({
      identity,
      clinicalPayloadDigest: clinical,
      strongMatch: strongEpisode ? await toKnownEpisode(strongEpisode) : null,
      weakMatches: await Promise.all(weakEpisodes.map(toKnownEpisode)),
    });

    results.push({
      ...classification,
      index,
      strongFingerprint: strong,
      weakFingerprint: weak,
      clinicalPayloadDigest: clinical,
      rawPayloadDigest: rawPayloadDigest(item.case),
    });
  }

  return results;
}

/**
 * Record an arrival: upsert the episode, then append an observation.
 *
 * The observation is appended for EVERY arrival, including ones that were not
 * turned into a reviewable case. That is the point — a result that arrived and
 * was correctly skipped must still leave a trace, or it is indistinguishable
 * from one that was lost.
 *
 * The episode's `clinicalPayloadDigest` advances only when a case was actually
 * created from the arrival. A skipped duplicate must not move the baseline that
 * future arrivals are compared against, or the next genuine amendment would be
 * measured from content no clinician ever saw.
 */
export async function recordEpisodeObservation(args: {
  tx: Prisma.TransactionClient;
  organisationId: string;
  batchRunId: string | null;
  identity: EpisodeIdentity;
  classified: ClassifiedCase;
  batchReviewItemId: string | null;
}): Promise<string> {
  const { tx, classified, identity } = args;

  const existing = classified.matchedEpisodeId
    ? await tx.screeningEpisode.findUnique({ where: { id: classified.matchedEpisodeId } })
    : classified.strongFingerprint
      ? await tx.screeningEpisode.findUnique({
          where: { strongFingerprint: classified.strongFingerprint },
        })
      : null;

  const collectedOn = identity.collectedOn ? new Date(identity.collectedOn) : null;
  const advanceDigest = args.batchReviewItemId !== null;

  const episode = existing
    ? await tx.screeningEpisode.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          ...(advanceDigest
            ? { clinicalPayloadDigest: classified.clinicalPayloadDigest }
            : {}),
        },
      })
    : await tx.screeningEpisode.create({
        data: {
          organisationId: args.organisationId,
          strongFingerprint: classified.strongFingerprint,
          weakFingerprint: classified.weakFingerprint,
          sourceEpisodeKey: identity.sourceEpisodeKey ?? null,
          sourceFacility: identity.sourceFacility ?? null,
          nhi: identity.nhi ?? null,
          testType: identity.testType ?? null,
          collectedOn: collectedOn && !Number.isNaN(collectedOn.getTime()) ? collectedOn : null,
          clinicalPayloadDigest: advanceDigest ? classified.clinicalPayloadDigest : null,
        },
      });

  await tx.episodeObservation.create({
    data: {
      episodeId: episode.id,
      batchRunId: args.batchRunId,
      classification: classified.classification,
      explanation: classified.explanation,
      batchReviewItemId: args.batchReviewItemId,
      rawPayloadDigest: classified.rawPayloadDigest,
      clinicalPayloadDigest: classified.clinicalPayloadDigest,
    },
  });

  return episode.id;
}
