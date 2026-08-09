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

import { resolveClinicalAuthority, type ClinicalAuthority } from "./authority";
import { canonicalToClinicalDecision, findDeEscalations } from "./decision-adapter";
import { canonicalClinicalFactsV2FromFlatFacts } from "./canonical-facts-v2";
import { evaluateClinicalCase } from "./evaluator";
import { normalizeClinicalFactMap } from "./facts";
import { resolveShadowClinicalRuleVersion } from "./lifecycle";
import { applyPin, getCaseAuthorityPin } from "./pinning";
import { recordAuthorityComparison } from "./monitoring";

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
};

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
  overlay?: GuidelineOverlay;
}): Promise<GradedDecision> {
  // ── 1. Legacy router. Always. ─────────────────────────────────────────────
  const legacyDecision = evaluateClinicalDecision(args.input, args.overlay);

  // ── 2. Authority, honouring any existing pin ──────────────────────────────
  const resolved = await resolveClinicalAuthority({
    organisationKey: args.organisationKey,
    environment: args.environment,
    caseId: args.caseId,
  });
  const pin = args.caseId ? await getCaseAuthorityPin(args.caseId) : null;
  const { pinned, reason: authorityReason } = applyPin(resolved, pin);

  // A pinned case keeps the authority it was first decided under. Since the only
  // pin that can exist today is legacy, this can only ever hold canonical back.
  const authority: ClinicalAuthority =
    pinned && pin?.authorityEngine === "LEGACY"
      ? { ...resolved, authorityEngine: "LEGACY", evaluationMode: "SHADOW" }
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
    return {
      decision: legacyDecision,
      legacyDecision,
      authority,
      pinned,
      authorityReason: `${authorityReason} No canonical rule version available; legacy decision stands.`,
      evaluationId: null,
      adapterNotices: [],
    };
  }

  const canonicalFactsV2 = canonicalClinicalFactsV2FromFlatFacts({
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

  // A canonical failure never escalates an engine: legacy stands.
  if (!evaluated) {
    return {
      decision: legacyDecision,
      legacyDecision,
      authority: { ...authority, authorityEngine: "LEGACY" },
      pinned,
      authorityReason: `${authorityReason} Canonical evaluation failed; legacy decision stands.`,
      evaluationId: null,
      adapterNotices: [],
    };
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
    return {
      decision: legacyDecision,
      legacyDecision,
      authority: { ...authority, authorityEngine: "LEGACY" },
      pinned,
      authorityReason: `${authorityReason} Canonical adapter failed; legacy decision stands.`,
      evaluationId: evaluated.evaluationId,
      adapterNotices: [],
    };
  }

  await recordAuthorityComparison({
    evaluationId: evaluated.evaluationId,
    caseId: args.caseId,
    legacy: legacyDecision,
    canonical: evaluated.result,
    adapted: adapted.decision,
  });

  if (authority.authorityEngine !== "CANONICAL") {
    return {
      decision: legacyDecision,
      legacyDecision,
      authority,
      pinned,
      authorityReason,
      evaluationId: evaluated.evaluationId,
      adapterNotices: adapted.adapterNotices,
    };
  }

  // ── 5. Final guardrail: the adapter may never relax a safety control ──────
  const deEscalations = findDeEscalations(adapted.decision, legacyDecision);
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
    return {
      decision: legacyDecision,
      legacyDecision,
      authority: { ...authority, authorityEngine: "LEGACY" },
      pinned,
      authorityReason: `${authorityReason} Canonical decision blocked for de-escalating a safety control (${deEscalations.join(
        "; "
      )}); legacy decision stands.`,
      evaluationId: evaluated.evaluationId,
      adapterNotices: adapted.adapterNotices,
    };
  }

  return {
    decision: adapted.decision,
    legacyDecision,
    authority,
    pinned,
    authorityReason,
    evaluationId: evaluated.evaluationId,
    adapterNotices: adapted.adapterNotices,
  };
}
