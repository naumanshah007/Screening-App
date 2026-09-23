/**
 * The single authority-sensitive execution path.
 *
 *   1. the LEGACY ROUTER selects the pathway (always — canonical has no router)
 *   2. the authority resolver determines the within-pathway decision layer
 *   3. the selected decision engine executes
 *   4. the decision adapter normalises canonical output to ClinicalDecision
 *   5. provenance is persisted on an immutable RuleEvaluation
 *
 * Today step 2 always answers LEGACY, so step 3 returns the legacy decision
 * unchanged and the canonical evaluation is written as SHADOW alongside it. That
 * is the point of this phase: the wiring is real and exercised, and the switch
 * is in the off position.
 */

import type { ClinicalInput, ClinicalDecision } from "@/lib/engine/types";
import { evaluateClinicalDecision } from "@/lib/engine/decision-engine";
import {
  assertOverlayCompatibleWithAuthority,
  type GuidelineOverlay,
} from "@/lib/engine/overlay";
import { prisma } from "@/lib/prisma";

import {
  LEGACY_ENGINE_VERSION,
  resolveClinicalAuthority,
  type ClinicalAuthority,
} from "./authority";
import { canonicalToClinicalDecision, findDeEscalations } from "./decision-adapter";
import { canonicalClinicalFactsV2FromFlatFacts } from "./canonical-facts-v2";
import type { CanonicalClinicalFactsV2 } from "./canonical-facts-v2";
import { evaluateClinicalCase } from "./evaluator";
import { normalizeClinicalFactMap } from "./facts";
import { resolveShadowClinicalRuleVersion } from "./lifecycle";
import { applyPin, getBatchRunAuthorityPin, getCaseAuthorityPin } from "./pinning";
import { recordAuthorityComparison } from "./monitoring";
import { evaluationUnavailableDecision } from "./evaluation-unavailable";
import {
  evaluationStatusFor,
  type DecisionEnvelope,
} from "./decision-envelope";
import { referralPriorityProvenance } from "./priority-provenance";
import type { ClinicalEvaluationResult } from "./evaluator";

/**
 * Facts the legacy batch/wizard mappers assume rather than observe. Canonical
 * authority must never inherit them: a fabricated "examination completed" can
 * convert a safety stop into a recommendation.
 */
export const FABRICATED_LEGACY_FACT_NAMES = [
  "menstrualHistoryCaptured",
  "contraceptiveHistoryCaptured",
  "sexualHistoryCaptured",
  "speculumExamCompleted",
  "pelvicExamCompleted",
  "coTestCompleted",
  "oralContraceptiveAdjusted",
  "stiTreated",
] as const;

/** Strip the legacy work-up assumptions before building canonical facts. */
export function withoutFabricatedFacts(input: ClinicalInput): Record<string, unknown> {
  const stripped = { ...input } as Record<string, unknown>;
  for (const name of FABRICATED_LEGACY_FACT_NAMES) delete stripped[name];
  return stripped;
}

export type GradedDecision = {
  /** The clinically authoritative decision. */
  decision: ClinicalDecision;
  /** The legacy decision, always computed — it supplies routing. */
  legacyDecision: ClinicalDecision;
  authority: ClinicalAuthority;
  /** True when an existing case pin overrode the currently resolved authority. */
  pinned: boolean;
  authorityReason: string;
  evaluationId: string | null;
  /** Populated when the adapter had to flag a normalisation problem. */
  adapterNotices: string[];
  /**
   * The one authoritative envelope for this evaluation.
   *
   * Every consumer — batch persistence, the case drawer, a prepared run, a
   * regrade, a future interactive preview — reads this rather than assembling
   * its own view from the decision plus whatever else it happened to have.
   */
  envelope: DecisionEnvelope;
};

/** Attach the envelope to a graded result, so no return path can omit it. */
function withEnvelope(
  graded: Omit<GradedDecision, "envelope"> & {
    canonical?: ClinicalEvaluationResult | null;
    canonicalStopped?: boolean;
  }
): GradedDecision {
  const { canonical, canonicalStopped, ...rest } = graded;
  return { ...rest, envelope: buildEnvelope({ ...rest, canonical, canonicalStopped }) };
}

/** Assemble the authoritative envelope from one completed evaluation. */
function buildEnvelope(args: {
  decision: ClinicalDecision;
  legacyDecision: ClinicalDecision;
  authority: ClinicalAuthority;
  pinned: boolean;
  authorityReason: string;
  evaluationId: string | null;
  adapterNotices: string[];
  canonical?: ClinicalEvaluationResult | null;
  canonicalStopped?: boolean;
}): DecisionEnvelope {
  const { canonical } = args;
  const status = evaluationStatusFor({
    decision: args.decision,
    canonicalStopped: args.canonicalStopped,
  });
  const matchedRuleIds = canonical?.matchedRuleIds ?? [];
  return {
    status,
    decision: args.decision,
    // The operative evaluation's own words, never the legacy engine's.
    reason:
      status === "EVALUATION_UNAVAILABLE"
        ? "No governed evaluation produced a result for this case."
        : canonical?.provisionalRecommendation ?? args.decision.recommendation,
    missingInformation: args.decision.missingInformation ?? canonical?.missingInformation ?? [],
    authority: args.authority.authorityEngine,
    authorityReason: args.authorityReason,
    pinned: args.pinned,
    pin: {
      ruleVersionId: canonical?.ruleVersionId ?? null,
      ruleVersionDisplay: canonical?.ruleVersionDisplay ?? null,
      rulesetChecksum: canonical?.ruleSetChecksum ?? null,
      engineVersion: canonical?.engineVersion ?? null,
      routerEngine: args.authority.routerEngine ?? null,
    },
    evaluationId: args.evaluationId,
    matchedRuleIds,
    controllingRuleId: matchedRuleIds[0] ?? null,
    trace: canonical?.branchPath ?? [],
    sourceReferences: canonical?.sourceReferences ?? [],
    // Set only where a priority survived the provenance gate.
    priorityProvenance: referralPriorityProvenance({
      authorityEngine: args.authority.authorityEngine,
      referralPriority: args.decision.referralPriority ?? null,
    }),
    legacyComparison: {
      recommendation: args.legacyDecision.recommendation,
      recommendationCode: args.legacyDecision.recommendationCode,
      figure: args.legacyDecision.figure,
      riskLevel: args.legacyDecision.riskLevel,
      referralPriority: args.legacyDecision.referralPriority ?? null,
      clinicalWarnings: args.legacyDecision.clinicalWarnings ?? [],
    },
    adapterNotices: args.adapterNotices,
  };
}


/**
 * What to return when the governed evaluation did not produce a result.
 *
 * Under LEGACY authority the legacy decision IS the configured authority, and
 * the canonical run alongside it was only a shadow comparison — so a shadow
 * failure changes nothing and the legacy decision legitimately stands.
 *
 * Under CANONICAL authority it is the opposite: the authority did not decide,
 * and returning the legacy recommendation would present a non-authoritative
 * engine's clinical text as the governed result. That becomes one explicit
 * unavailable state instead.
 */
function unresolvedGovernedDecision(args: {
  authority: ClinicalAuthority;
  legacyDecision: ClinicalDecision;
  reason: string;
}): { decision: ClinicalDecision; authority: ClinicalAuthority; reason: string } {
  if (args.authority.authorityEngine !== "CANONICAL") {
    return {
      decision: args.legacyDecision,
      authority: args.authority,
      reason: `${args.reason} Legacy is the configured authority; its decision stands.`,
    };
  }
  return {
    decision: evaluationUnavailableDecision({
      figure: args.legacyDecision.figure,
      reason: args.reason,
    }),
    // The authority is unchanged: canonical is still the authority, it simply
    // produced no result. Relabelling the row LEGACY would claim a legacy
    // evaluation took place as the authority, which is what this prevents.
    authority: args.authority,
    reason: args.reason,
  };
}

export async function evaluateGradedDecision(args: {
  input: ClinicalInput;
  subjectReference: string;
  enteredBy: string;
  organisationKey?: string | null;
  environment?: ClinicalAuthority["environment"];
  caseId?: string;
  batchRunId?: string;
  factSource?: Parameters<typeof canonicalClinicalFactsV2FromFlatFacts>[0]["source"];
  recordedAt?: string;
  caseCreatedAt?: Date;
  canonicalFactsV2?: CanonicalClinicalFactsV2;
  overlay?: GuidelineOverlay;
  /**
   * The evaluation this one supersedes, when an amended result has arrived for
   * an episode that was already evaluated.
   *
   * Supplying it creates a linked successor; it never mutates or replaces the
   * earlier record, which stays readable and stays the decision that was acted
   * on at the time. `regradeReason` is required alongside it.
   */
  previousEvaluationId?: string;
  regradeReason?: string;
}): Promise<GradedDecision> {
  // ── 1. Legacy router. Always. ─────────────────────────────────────────────
  const legacyDecision = evaluateClinicalDecision(args.input, args.overlay);

  // ── 2. Authority, honouring any existing pin ──────────────────────────────
  const resolved = await resolveClinicalAuthority({
    organisationKey: args.organisationKey,
    environment: args.environment,
    caseId: args.caseId,
    caseCreatedAt: args.caseCreatedAt,
  });
  const pin = args.caseId
    ? await getCaseAuthorityPin(args.caseId)
    : args.batchRunId
      ? await getBatchRunAuthorityPin(args.batchRunId)
      : null;
  const applied = applyPin(resolved, pin);
  const pinned = applied.pinned;
  const authorityReason = applied.reason;
  const authority: ClinicalAuthority =
    pinned && pin
      ? pin.authorityEngine === "CANONICAL" && pin.ruleVersionId
        ? {
            ...resolved,
            authorityEngine: "CANONICAL",
            evaluationMode: pin.evaluationMode ?? resolved.evaluationMode,
            ruleSetVersionId: pin.ruleVersionId,
            ruleSetVersion: pin.ruleVersionDisplay,
            ruleSetChecksum: pin.rulesetChecksum,
            routerEngine: LEGACY_ENGINE_VERSION,
            reason: authorityReason,
          }
        : { ...resolved, authorityEngine: "LEGACY", evaluationMode: "SHADOW", reason: authorityReason }
      : resolved;

  // An enabled legacy-keyed overlay cannot apply under canonical authority and
  // must not be silently dropped.
  assertOverlayCompatibleWithAuthority({
    overlay: args.overlay,
    authorityEngine: authority.authorityEngine,
  });

  // ── 3. Canonical evaluation ───────────────────────────────────────────────
  // Under legacy authority this still runs, as a SHADOW comparison.
  const version =
    authority.authorityEngine === "CANONICAL" && authority.ruleSetVersionId
      ? { id: authority.ruleSetVersionId }
      : await resolveShadowClinicalRuleVersion();

  if (!version) {
    const unresolved = unresolvedGovernedDecision({
      authority,
      legacyDecision,
      reason: "No governed rule version is available to evaluate this case.",
    });
    return withEnvelope({
      decision: unresolved.decision,
      legacyDecision,
      authority: unresolved.authority,
      pinned,
      authorityReason: `${authorityReason} ${unresolved.reason}`,
      evaluationId: null,
      adapterNotices: [],
    });
  }

  const canonicalFactsV2 = args.canonicalFactsV2 ?? canonicalClinicalFactsV2FromFlatFacts({
    subjectReference: args.subjectReference,
    facts: normalizeClinicalFactMap({
      ...withoutFabricatedFacts(args.input),
      // Router output re-entered as an input fact. Provenance is forced to
      // DERIVED_ROUTER by ROUTER_DERIVED_FACTS.
      currentPathway: legacyDecision.figure,
    }),
    source: args.factSource ?? "REVIEWER_ENTRY",
    enteredBy: args.enteredBy,
    recordedAt: args.recordedAt,
    routerEngine: authority.routerEngine,
  });

  const evaluated = await evaluateClinicalCase({
    canonicalFactsV2,
    ruleVersionId: version.id,
    evaluationMode: authority.evaluationMode,
    organisationKey: args.organisationKey ?? undefined,
    legacyInput: args.input,
    caseId: args.caseId,
    batchRunId: args.batchRunId,
    // An updated result links to the evaluation it succeeds. The prior
    // evaluation is preserved and remains readable — RuleEvaluation is
    // append-only at the database level, so this can only ever add a record,
    // never replace one. A regrade reason is mandatory whenever a link is
    // supplied, which is why both travel together.
    previousEvaluationId: args.previousEvaluationId,
    regradeReason: args.regradeReason,
  }).catch(async (error) => {
    await prisma.auditLog
      .create({
        data: {
          action: "CLINICAL_RULE_EVALUATION_FAILED",
          entity: "RuleEvaluation",
          severity: "ERROR",
          newValue: JSON.stringify({
            ruleVersionId: version.id,
            authorityEngine: authority.authorityEngine,
            message: error instanceof Error ? error.message : String(error),
          }),
        },
      })
      .catch(() => undefined);
    return null;
  });

  if (!evaluated) {
    const unresolved = unresolvedGovernedDecision({
      authority,
      legacyDecision,
      reason: "The governed evaluation failed to run for this case.",
    });
    return withEnvelope({
      decision: unresolved.decision,
      legacyDecision,
      authority: unresolved.authority,
      pinned,
      authorityReason: `${authorityReason} ${unresolved.reason}`,
      evaluationId: null,
      adapterNotices: [],
    });
  }

  // ── 4. Adapter — always computed for monitoring, but only authoritative
  // when the governed authority selector says CANONICAL. ────────────────────
  let adapted: ReturnType<typeof canonicalToClinicalDecision> | null = null;
  try {
    adapted = canonicalToClinicalDecision({
      canonical: evaluated.result,
      legacyDecision,
      evaluationId: evaluated.evaluationId,
    });
  } catch (error) {
    await prisma.auditLog
      .create({
        data: {
          action: "CLINICAL_AUTHORITY_ADAPTER_FAILED",
          entity: "RuleEvaluation",
          entityId: evaluated.evaluationId,
          severity: "ERROR",
          newValue: JSON.stringify({
            caseId: args.caseId ?? null,
            message: error instanceof Error ? error.message : String(error),
          }),
        },
      })
      .catch(() => undefined);
  }

  if (!adapted) {
    const unresolved = unresolvedGovernedDecision({
      authority,
      legacyDecision,
      reason: "The governed result could not be normalised into a decision.",
    });
    return withEnvelope({
      decision: unresolved.decision,
      legacyDecision,
      authority: unresolved.authority,
      pinned,
      authorityReason: `${authorityReason} ${unresolved.reason}`,
      evaluationId: evaluated.evaluationId,
      adapterNotices: [],
    });
  }

  await recordAuthorityComparison({
    evaluationId: evaluated.evaluationId,
    caseId: args.caseId,
    legacy: legacyDecision,
    canonical: evaluated.result,
    adapted: adapted.decision,
  });

  if (authority.authorityEngine !== "CANONICAL") {
    // Legacy is the configured authority, so the legacy decision IS the result.
    // The canonical run alongside it is shadow comparison, and is recorded as
    // such rather than being presented as the governed answer.
    return withEnvelope({
      decision: legacyDecision,
      legacyDecision,
      authority,
      pinned,
      authorityReason,
      evaluationId: evaluated.evaluationId,
      adapterNotices: adapted.adapterNotices,
    });
  }

  // ── 5. Final guardrail: the adapter may never relax a safety control ──────
  //
  // Scoped to evaluations that REACHED an outcome. A governed safety stop looks
  // like a de-escalation against a legacy referral — no referral, no priority —
  // but it is the more conservative result, not the weaker one, and reverting it
  // to the legacy recommendation is exactly the silent legacy fallback this
  // phase exists to remove. A stop is recorded and kept.
  const deEscalations = adapted.canonicalStopped
    ? []
    : findDeEscalations(adapted.decision, legacyDecision);
  if (deEscalations.length > 0) {
    await prisma.auditLog
      .create({
        data: {
          action: "CLINICAL_AUTHORITY_DEESCALATION_BLOCKED",
          entity: "RuleEvaluation",
          entityId: evaluated.evaluationId,
          severity: "ERROR",
          newValue: JSON.stringify({ deEscalations, caseId: args.caseId }),
        },
      })
      .catch(() => undefined);
    return withEnvelope({
      decision: legacyDecision,
      legacyDecision,
      authority: { ...authority, authorityEngine: "LEGACY" },
      pinned,
      authorityReason: `${authorityReason} Canonical decision blocked for de-escalating a safety control (${deEscalations.join(
        "; "
      )}); legacy decision stands.`,
      evaluationId: evaluated.evaluationId,
      adapterNotices: adapted.adapterNotices,
    });
  }

  return withEnvelope({
    decision: adapted.decision,
    legacyDecision,
    authority,
    pinned,
    authorityReason,
    evaluationId: evaluated.evaluationId,
    adapterNotices: adapted.adapterNotices,
    canonical: evaluated.result,
    canonicalStopped: adapted.canonicalStopped,
  });
}
