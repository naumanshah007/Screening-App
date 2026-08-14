import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import type { EpisodeClassification } from "@/lib/batch/episode-classification";
import { demoProvenance } from "@/lib/config/demo-mode";

/**
 * The usage ledger: what the platform did, recorded as fact.
 *
 * NOT A BILLING TABLE
 * -------------------
 * Nothing here knows a price, and no event carries a `billable` flag. The
 * separation is not tidiness — this ledger is append-only, so any commercial
 * opinion written into it would be permanent, and a contract that changed later
 * could only be honoured by rewriting history or by contradicting it. Facts go
 * here; policy is applied over them at invoice time.
 *
 * EXACTLY ONCE
 * ------------
 * Every event carries a deterministic `idempotencyKey` with a unique index
 * behind it. Writes use "create, ignore conflict", so a retried save, a
 * duplicated request or a re-run after a partial failure records the same event
 * once. For a first triage the key deliberately contains ONLY the organisation
 * and the episode — which turns "one first governed triage per episode, ever"
 * into something the database enforces rather than something the application
 * remembers to check.
 */

export const USAGE_EVENT_TYPES = [
  /** The commercial unit: first governed evaluation of a unique episode. */
  "FIRST_TRIAGE",
  /** New clinical information for an episode already triaged. */
  "UPDATE_REEVALUATION",
  /** A re-evaluation that is not driven by new source information. */
  "REGRADE",
  /** An arrival withheld because the episode was already handled. */
  "DUPLICATE_SUPPRESSED",
] as const;

export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number];

/** Manual regrades are not intake arrivals, so they carry an explicit factual
 * classification rather than pretending to have been NEW or UPDATED input. */
export type UsageEventClassification = EpisodeClassification | "MANUAL_REGRADE";

export const USAGE_EVENT_EPISODE_NOT_FOUND = "USAGE_EVENT_EPISODE_NOT_FOUND";
export const USAGE_EVENT_EPISODE_ORGANISATION_MISMATCH =
  "USAGE_EVENT_EPISODE_ORGANISATION_MISMATCH";

export class UsageEventIntegrityError extends Error {
  constructor(
    public readonly code:
      | typeof USAGE_EVENT_EPISODE_NOT_FOUND
      | typeof USAGE_EVENT_EPISODE_ORGANISATION_MISMATCH
  ) {
    super(code);
    this.name = "UsageEventIntegrityError";
  }
}

/**
 * Which event a classification produces, or null when it produces none.
 *
 * NEW and UPDATED both represent real governed evaluations and are metered;
 * they are distinguished so that policy can price them differently without the
 * ledger having to know whether it ever will.
 *
 * POSSIBLE_DUPLICATE is deliberately absent: it is advisory only, the case is
 * processed exactly like any other, and it produces whatever event its
 * evaluation produces — a maybe is not a category of work.
 */
export function usageEventTypeFor(args: {
  classification: EpisodeClassification;
  /** Whether this arrival actually produced a governed evaluation. */
  evaluated: boolean;
  /** Whether the episode already has a first triage on record. */
  episodeAlreadyTriaged: boolean;
}): UsageEventType | null {
  if (!args.evaluated) {
    // Withheld. Recorded so suppression is visible and countable — a service
    // asking "why is my volume lower than my sending volume?" is answered from
    // this, not from an absence.
    return args.classification === "COMPLETED" ||
      args.classification === "ALREADY_IN_REVIEW"
      ? "DUPLICATE_SUPPRESSED"
      : null;
  }

  if (args.classification === "UPDATED") return "UPDATE_REEVALUATION";
  // A second evaluation of an episode that was not flagged as updated is a
  // regrade — a re-run of the same information, not new information.
  if (args.episodeAlreadyTriaged) return "REGRADE";
  return "FIRST_TRIAGE";
}

/**
 * Deterministic identity of a usage event.
 *
 * FIRST_TRIAGE is keyed on the episode alone, so it can exist at most once per
 * episode however many times intake is retried. Every other type includes the
 * specific evaluation or item, because those genuinely can recur — an episode
 * may legitimately be amended twice.
 */
export function usageIdempotencyKey(args: {
  organisationId: string;
  episodeId: string;
  eventType: UsageEventType;
  ruleEvaluationId?: string | null;
  batchReviewItemId?: string | null;
}): string {
  const scope =
    args.eventType === "FIRST_TRIAGE"
      ? ""
      : `:${args.ruleEvaluationId ?? args.batchReviewItemId ?? "unknown"}`;

  return createHash("sha256")
    .update(`${args.organisationId}:${args.episodeId}:${args.eventType}${scope}`)
    .digest("hex");
}

export type RecordUsageEventArgs = {
  tx: Prisma.TransactionClient;
  organisationId: string;
  episodeId: string;
  eventType: UsageEventType;
  classification: UsageEventClassification;
  batchReviewItemId?: string | null;
  ruleEvaluationId?: string | null;
  batchRunId?: string | null;
  rulesetVersion?: string | null;
  rulesetChecksum?: string | null;
  source?: string | null;
};

/**
 * Application-side fail-closed check for the same invariant enforced by the
 * database INSERT triggers. Keeping both layers is deliberate: callers get a
 * stable semantic error before an INSERT, while raw SQL and future code paths
 * remain protected by the database as the final authority.
 */
export async function requireUsageEventEpisode(args: {
  tx: Prisma.TransactionClient;
  organisationId: string;
  episodeId: string;
}): Promise<void> {
  const episode = await args.tx.screeningEpisode.findUnique({
    where: { id: args.episodeId },
    select: { organisationId: true },
  });

  if (!episode) {
    throw new UsageEventIntegrityError(USAGE_EVENT_EPISODE_NOT_FOUND);
  }
  if (episode.organisationId !== args.organisationId) {
    throw new UsageEventIntegrityError(
      USAGE_EVENT_EPISODE_ORGANISATION_MISMATCH
    );
  }
}

/**
 * Append one usage event, at most once.
 *
 * INSERT, THEN TOLERATE THE CONFLICT
 * ----------------------------------
 * Deliberately not an upsert. The ledger carries an immutability trigger, so an
 * upsert would issue an UPDATE against an existing row and abort — and it would
 * be the wrong intent anyway: a repeat must leave the original event exactly as
 * it was written, not refresh it.
 *
 * A duplicate is therefore a no-op, not an error. The caller's job is to report
 * what happened; being told twice must never fail the clinical work that
 * prompted the report.
 *
 * Returns whether a new row was written — false meaning "already counted".
 */
export async function recordUsageEvent(args: RecordUsageEventArgs): Promise<boolean> {
  await requireUsageEventEpisode(args);

  const idempotencyKey = usageIdempotencyKey({
    organisationId: args.organisationId,
    episodeId: args.episodeId,
    eventType: args.eventType,
    ruleEvaluationId: args.ruleEvaluationId,
    batchReviewItemId: args.batchReviewItemId,
  });

  try {
    await args.tx.usageEvent.create({
      data: {
        organisationId: args.organisationId,
        episodeId: args.episodeId,
        eventType: args.eventType,
        classification: args.classification,
        batchReviewItemId: args.batchReviewItemId ?? null,
        ruleEvaluationId: args.ruleEvaluationId ?? null,
        batchRunId: args.batchRunId ?? null,
        rulesetVersion: args.rulesetVersion ?? null,
        rulesetChecksum: args.rulesetChecksum ?? null,
        source: args.source ?? null,
        isDemo: demoProvenance().isDemo,
        idempotencyKey,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintViolation(error)) return false;
    throw error;
  }
}

/** A duplicate write, as opposed to a genuine failure that must surface. */
function isUniqueConstraintViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code === "P2002") return true;
  // The driver adapter surfaces the raw SQLite message in some paths.
  const message = error instanceof Error ? error.message : "";
  return /UNIQUE constraint failed/i.test(message);
}
