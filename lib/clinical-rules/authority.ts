/**
 * Governed clinical authority resolution.
 *
 * This is the single place that answers one question: for this organisation and
 * this case, which engine's recommendation is clinically authoritative?
 *
 * ARCHITECTURE
 * ------------
 * The legacy engine (`lib/engine/decision-engine.ts`) always runs and always
 * performs routing: age eligibility gates, Figure selection, and the
 * Figure 10 / Figure 9 / Table 1 / hysterectomy precedence chain. CG-NCSP-3.1.0
 * has no router — `currentPathway` is one of its required *input* facts — so the
 * legacy router is retained permanently and is never bypassed.
 *
 * What this resolver selects is the **within-pathway decision layer** only:
 *
 *     legacy router → pathway → [ THIS RESOLVER ] → legacy or canonical
 *                                                    recommendation
 *
 * SAFETY PROPERTIES (each is covered by a test)
 * ---------------------------------------------
 *  1. The default is LEGACY. Absence of configuration, absence of an activation
 *     row, a database error, or an unknown environment all resolve to LEGACY.
 *  2. No flag defaults to canonical. `CLINICAL_AUTHORITY_LIVE_PRODUCTION` must
 *     be explicitly enabled AND a PRODUCTION activation must exist.
 *  3. Canonical *live* authority is currently unreachable: the production
 *     activation path in `lifecycle.ts` still refuses to create a PRODUCTION
 *     activation. This resolver is therefore inert in production today, by
 *     construction rather than by convention.
 *  4. Resolution is never cached for clinical use. See "cache" below.
 */

import type { RuleActivationEnvironment, RuleEvaluationMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { NATIONAL_RULE_SET_KEY } from "./constants";

/** Which engine's recommendation is authoritative for the within-pathway decision. */
export type ClinicalAuthorityEngine = "LEGACY" | "CANONICAL";

/** How an activation was matched, for audit and display. */
export type ActivationScope = "ORGANISATION" | "GLOBAL" | "NONE";

export type ClinicalAuthority = {
  authorityEngine: ClinicalAuthorityEngine;
  /** The evaluation mode any canonical evaluation must be written with. */
  evaluationMode: RuleEvaluationMode;
  environment: RuleActivationEnvironment;
  organisationKey: string | null;
  ruleSetVersionId: string | null;
  ruleSetVersion: string | null;
  ruleSetChecksum: string | null;
  activationId: string | null;
  activationScope: ActivationScope;
  activationTimestamp: Date | null;
  /** The legacy engine identifier. Always populated: the router is always legacy. */
  routerEngine: string;
  /** Human-readable explanation of why this authority was selected. Persisted with the decision. */
  reason: string;
};

/** Resolve the activation environment from the running deployment, never from a UI hint. */
export function getRuntimeClinicalEnvironment(): RuleActivationEnvironment {
  if (process.env.VERCEL_ENV === "production") return "PRODUCTION";
  if (process.env.VERCEL_ENV === "preview") return "VALIDATION";
  if (process.env.NODE_ENV === "test") return "TEST";
  return "DEMO";
}

/** The legacy engine identity, matching `lib/batch/processor.ts` ENGINE_VERSION. */
export const LEGACY_ENGINE_VERSION = "business-figures-table1-v1";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

/**
 * The single environment gate for live canonical clinical authority.
 *
 * This is deliberately a separate switch from the existence of an activation
 * row. Turning it on is not sufficient to make canonical authoritative — an
 * ACTIVE activation must also exist — and creating an activation is not
 * sufficient either. Both are required, and both are auditable.
 *
 * Default: OFF. Never defaults on, in any environment.
 */
export function isLiveProductionAuthorityEnabled(): boolean {
  const raw = process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION;
  if (raw === undefined) return false;
  return TRUE_VALUES.has(raw.trim().toLowerCase());
}

/** The legacy authority result. Every failure path returns this. */
function legacyAuthority(args: {
  environment: RuleActivationEnvironment;
  organisationKey: string | null;
  reason: string;
}): ClinicalAuthority {
  return {
    authorityEngine: "LEGACY",
    // A legacy-authority run still writes its canonical evaluation as SHADOW:
    // it is recorded for comparison and is explicitly not clinically operative.
    evaluationMode: "SHADOW",
    environment: args.environment,
    organisationKey: args.organisationKey,
    ruleSetVersionId: null,
    ruleSetVersion: null,
    ruleSetChecksum: null,
    activationId: null,
    activationScope: "NONE",
    activationTimestamp: null,
    routerEngine: LEGACY_ENGINE_VERSION,
    reason: args.reason,
  };
}

/**
 * Resolve the authoritative decision layer.
 *
 * `caseCreatedAt` and `caseId` are accepted so that callers pin authority at
 * case initiation (see `lib/clinical-rules/pinning.ts`). This function resolves
 * the authority that a *new* case would receive; it never re-resolves authority
 * for a case that already carries a pin.
 *
 * NO CACHING. The previous implementation cached the active version for 30
 * seconds in process memory. On a multi-instance serverless deployment that
 * produces a window in which different instances apply different clinical
 * authorities to different participants, and it makes a rollback take effect
 * unevenly. Clinical authority resolution is one indexed query on a table with
 * single-digit row counts; correctness is worth far more than the query.
 */
export async function resolveClinicalAuthority(args: {
  organisationKey?: string | null;
  environment?: RuleActivationEnvironment;
  caseCreatedAt?: Date;
  caseId?: string;
}): Promise<ClinicalAuthority> {
  const environment = args.environment ?? getRuntimeClinicalEnvironment();
  const organisationKey = args.organisationKey ?? null;

  // Gate 1: live canonical authority in PRODUCTION requires an explicit switch.
  if (environment === "PRODUCTION" && !isLiveProductionAuthorityEnabled()) {
    return legacyAuthority({
      environment,
      organisationKey,
      reason:
        "Legacy authority: live production clinical authority is not enabled (CLINICAL_AUTHORITY_LIVE_PRODUCTION is off).",
    });
  }

  let activation: {
    id: string;
    ruleVersionId: string;
    activatedAt: Date;
    organisationKey: string | null;
  } | null = null;
  let scope: ActivationScope = "NONE";

  try {
    const ruleSet = await prisma.clinicalRuleSet.findUnique({
      where: { key: NATIONAL_RULE_SET_KEY },
      select: { id: true },
    });
    if (!ruleSet) {
      return legacyAuthority({
        environment,
        organisationKey,
        reason: "Legacy authority: the national clinical rule set is not present.",
      });
    }

    // Gate 2: resolver precedence — organisation-specific, then global.
    if (organisationKey) {
      activation = await prisma.ruleSetActivation.findFirst({
        where: {
          ruleSetId: ruleSet.id,
          organisationKey,
          environment,
          isDefault: true,
          deactivatedAt: null,
        },
        orderBy: { activatedAt: "desc" },
        select: { id: true, ruleVersionId: true, activatedAt: true, organisationKey: true },
      });
      if (activation) scope = "ORGANISATION";
    }

    if (!activation) {
      activation = await prisma.ruleSetActivation.findFirst({
        where: {
          ruleSetId: ruleSet.id,
          organisationKey: null,
          environment,
          isDefault: true,
          deactivatedAt: null,
        },
        orderBy: { activatedAt: "desc" },
        select: { id: true, ruleVersionId: true, activatedAt: true, organisationKey: true },
      });
      if (activation) scope = "GLOBAL";
    }
  } catch (error) {
    // A resolution failure must never escalate an engine. Fail to legacy.
    await prisma.auditLog
      .create({
        data: {
          action: "CLINICAL_AUTHORITY_RESOLUTION_FAILED",
          entity: "RuleSetActivation",
          severity: "ERROR",
          newValue: JSON.stringify({
            environment,
            organisationKey,
            message: error instanceof Error ? error.message : String(error),
          }),
        },
      })
      .catch(() => undefined);
    return legacyAuthority({
      environment,
      organisationKey,
      reason: `Legacy authority: clinical authority resolution failed (${
        error instanceof Error ? error.message : String(error)
      }).`,
    });
  }

  // Gate 3: no activation means legacy. This is the state today.
  if (!activation) {
    return legacyAuthority({
      environment,
      organisationKey,
      reason: `Legacy authority: no ACTIVE clinical rule activation for environment ${environment}.`,
    });
  }

  const version = await prisma.clinicalRuleVersion.findUnique({
    where: { id: activation.ruleVersionId },
    select: { id: true, displayVersion: true, checksum: true, status: true },
  });

  // Gate 4: the activated version must still be ACTIVE and checksummed.
  if (!version || version.status !== "ACTIVE" || !version.checksum) {
    return legacyAuthority({
      environment,
      organisationKey,
      reason:
        "Legacy authority: the activated clinical rule version is not ACTIVE or has no published checksum.",
    });
  }

  // New-cases-only activation: a workflow created before the activation keeps
  // Legacy authority even if it is completed afterwards. Existing immutable
  // evaluations are handled by pinning; this timestamp gate covers in-flight
  // workflows that have not yet produced an operative evaluation.
  if (args.caseCreatedAt && args.caseCreatedAt < activation.activatedAt) {
    return legacyAuthority({
      environment,
      organisationKey,
      reason: `Legacy authority: this workflow predates the canonical activation at ${activation.activatedAt.toISOString()}.`,
    });
  }

  return {
    authorityEngine: "CANONICAL",
    evaluationMode: environment === "PRODUCTION" ? "LIVE_PRODUCTION" : "LIVE_DEMO",
    environment,
    organisationKey,
    ruleSetVersionId: version.id,
    ruleSetVersion: version.displayVersion,
    ruleSetChecksum: version.checksum,
    activationId: activation.id,
    activationScope: scope,
    activationTimestamp: activation.activatedAt,
    routerEngine: LEGACY_ENGINE_VERSION,
    reason: `Canonical authority: ${version.displayVersion} active for ${
      scope === "ORGANISATION" ? `organisation ${activation.organisationKey}` : "all organisations"
    } in ${environment}. Pathway routing remains legacy (${LEGACY_ENGINE_VERSION}).`,
  };
}

/**
 * Describes the authority for display, without a database read, from a stored
 * pin. Used by the UI provenance badges.
 */
export function describeAuthority(authority: Pick<ClinicalAuthority, "authorityEngine" | "ruleSetVersion">): string {
  return authority.authorityEngine === "CANONICAL" && authority.ruleSetVersion
    ? `Canonical ${authority.ruleSetVersion}`
    : "Legacy";
}
