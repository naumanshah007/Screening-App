/**
 * Clinical authority pinning.
 *
 * POLICY (docs/canonical-cutover/03-historical-decision-policy.md)
 * ---------------------------------------------------------------
 * Every case is permanently pinned to the authority in force when it was FIRST
 * evaluated. A case cannot silently change clinical authority mid-workflow, and
 * an activation or a rollback never rewrites what an existing case decided.
 *
 * Change is possible only through an explicit, reviewer-authorised, reason-
 * bearing regrade that creates a NEW evaluation and never touches the original.
 *
 * NO SCHEMA CHANGE IS REQUIRED
 * ----------------------------
 * The pin is already representable:
 *
 *   - `RuleEvaluation` rows are immutable and carry `ruleVersionId`,
 *     `ruleVersionDisplay`, `rulesetChecksum`, `engineVersion` and
 *     `evaluationMode`.
 *   - `WizardSession.ruleEvaluationId` and `BatchReviewItem.ruleEvaluationId`
 *     link a case to its first evaluation.
 *   - `BatchRun.pinnedRuleVersionId` pins an entire run.
 *   - The ABSENCE of a clinically operative evaluation means legacy. Cases that
 *     predate canonical authority are legacy by construction, with no backfill
 *     and no migration.
 *
 * This module only reads and interprets that existing state.
 */

import type { RuleEvaluationMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { LEGACY_ENGINE_VERSION, type ClinicalAuthorityEngine } from "./authority";

/** Evaluation modes that are clinically operative — i.e. that establish a pin. */
const OPERATIVE_MODES: ReadonlySet<RuleEvaluationMode> = new Set([
  "LIVE_DEMO",
  "LIVE_PRODUCTION",
] as RuleEvaluationMode[]);

/**
 * SHADOW and SIMULATION evaluations are recorded for comparison and are
 * explicitly not clinically operative, so they never pin a case.
 */
export function isOperativeMode(mode: RuleEvaluationMode): boolean {
  return OPERATIVE_MODES.has(mode);
}

export type AuthorityPin = {
  authorityEngine: ClinicalAuthorityEngine;
  ruleVersionId: string | null;
  ruleVersionDisplay: string | null;
  rulesetChecksum: string | null;
  engineVersion: string;
  evaluationId: string | null;
  evaluationMode: RuleEvaluationMode | null;
  pinnedAt: Date | null;
  /** True when the pin was inferred from the absence of an operative evaluation. */
  inferredLegacy: boolean;
};

const LEGACY_PIN: AuthorityPin = {
  authorityEngine: "LEGACY",
  ruleVersionId: null,
  ruleVersionDisplay: null,
  rulesetChecksum: null,
  engineVersion: LEGACY_ENGINE_VERSION,
  evaluationId: null,
  evaluationMode: null,
  pinnedAt: null,
  inferredLegacy: true,
};

/**
 * The authority a case is pinned to.
 *
 * Reads the case's FIRST clinically operative evaluation. Regrades (which carry
 * `previousEvaluationId`) are later evaluations and do not move the pin — the
 * original decision keeps its own provenance, which is the whole point.
 *
 * Returns the legacy pin when no operative evaluation exists. This is the state
 * of every case in production today.
 */
export async function getCaseAuthorityPin(caseId: string): Promise<AuthorityPin> {
  const first = await prisma.ruleEvaluation.findFirst({
    where: { caseId, evaluationMode: { in: [...OPERATIVE_MODES] } },
    orderBy: { evaluatedAt: "asc" },
    select: {
      id: true,
      ruleVersionId: true,
      ruleVersionDisplay: true,
      rulesetChecksum: true,
      engineVersion: true,
      evaluationMode: true,
      evaluatedAt: true,
    },
  });

  if (!first) return LEGACY_PIN;

  return {
    authorityEngine: "CANONICAL",
    ruleVersionId: first.ruleVersionId,
    ruleVersionDisplay: first.ruleVersionDisplay,
    rulesetChecksum: first.rulesetChecksum,
    engineVersion: first.engineVersion,
    evaluationId: first.id,
    evaluationMode: first.evaluationMode,
    pinnedAt: first.evaluatedAt,
    inferredLegacy: false,
  };
}

/**
 * The authority a batch run is pinned to. A run started before an activation
 * completes entirely on its starting authority: a reviewer working one worklist
 * must never have two engines in one screen.
 */
export async function getBatchRunAuthorityPin(batchRunId: string): Promise<AuthorityPin> {
  const run = await prisma.batchRun.findUnique({
    where: { id: batchRunId },
    select: {
      engineVersion: true,
      pinnedRuleVersionId: true,
      pinnedRuleVersionDisplay: true,
      pinnedRulesetChecksum: true,
      createdAt: true,
      ruleEvaluations: {
        where: { evaluationMode: { in: [...OPERATIVE_MODES] } },
        orderBy: { evaluatedAt: "asc" },
        take: 1,
        select: { id: true, evaluationMode: true, evaluatedAt: true },
      },
    },
  });

  if (!run) return LEGACY_PIN;

  const operative = run.ruleEvaluations[0];
  if (!operative) {
    // The run has a pinned version recorded for shadow comparison, but no
    // clinically operative evaluation. Its authority is legacy.
    return {
      ...LEGACY_PIN,
      engineVersion: run.engineVersion || LEGACY_ENGINE_VERSION,
      pinnedAt: run.createdAt,
    };
  }

  return {
    authorityEngine: "CANONICAL",
    ruleVersionId: run.pinnedRuleVersionId,
    ruleVersionDisplay: run.pinnedRuleVersionDisplay,
    rulesetChecksum: run.pinnedRulesetChecksum,
    engineVersion: run.engineVersion,
    evaluationId: operative.id,
    evaluationMode: operative.evaluationMode,
    pinnedAt: operative.evaluatedAt,
    inferredLegacy: false,
  };
}

/**
 * Decide the authority to USE for an evaluation, given any existing pin.
 *
 * This is the guard that makes an activation affect new cases only: if the case
 * already carries a pin, the pin wins, whatever the current activation says.
 * The same guard makes a rollback leave canonical-window cases on canonical.
 */
export function applyPin<T extends { authorityEngine: ClinicalAuthorityEngine }>(
  resolved: T,
  pin: AuthorityPin | null
): { authority: T | AuthorityPin; pinned: boolean; reason: string } {
  // A pin exists only once a clinically operative evaluation has been written.
  // `inferredLegacy` marks the "no operative evaluation yet" case.
  const isPinned = pin !== null && !pin.inferredLegacy;
  if (isPinned) {
    return {
      authority: pin,
      pinned: true,
      reason:
        `Pinned to ${pin.ruleVersionDisplay ?? "legacy"} at first evaluation ` +
        `(${pin.pinnedAt?.toISOString() ?? "unknown time"}); the current activation does not apply to this case.`,
    };
  }
  return {
    authority: resolved,
    pinned: false,
    reason: "Not yet pinned; the current activation applies and this evaluation establishes the pin.",
  };
}
