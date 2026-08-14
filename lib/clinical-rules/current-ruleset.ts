import type { RuleActivationEnvironment } from "@prisma/client";

import { getRuntimeClinicalEnvironment } from "@/lib/clinical-rules/authority";
import { NATIONAL_RULE_SET_KEY } from "@/lib/clinical-rules/constants";
import { prisma } from "@/lib/prisma";

/**
 * The CURRENT GOVERNED RULESET.
 *
 * WHAT THIS IS
 * ------------
 * A named read of the one fact clinicians and reviewers actually care about:
 * which governed ruleset decides a NEW case right now. Today that resolves to
 * CG-NCSP-3.1.0; after a future release it resolves to CG-NCSP-3.2.0 or later,
 * with no code change and no rewriting of history.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not a new authority concept sitting beside the existing ones, and it
 * introduces no new table. The pointer *is* the ACTIVE RuleSetActivation row
 * for the environment — the same record the authority resolver reads. This
 * module only gives that record a name and a stable shape, so callers stop
 * hardwiring a version string.
 *
 * WHY IT ONLY DESCRIBES NEW CASES
 * -------------------------------
 * An existing case resolves its authority from its own pin, never from this
 * pointer (see lib/clinical-rules/pinning.ts). Moving the pointer therefore
 * cannot re-decide a case that already has a clinical decision — which is what
 * makes a future version bump safe.
 */

export type CurrentGovernedRuleset = {
  ruleVersionId: string;
  displayVersion: string;
  checksum: string;
  revision: number;
  environment: RuleActivationEnvironment;
  organisationKey: string | null;
  activatedAt: Date;
};

/**
 * Resolve the ruleset that governs new cases in this environment.
 *
 * Returns null when no governed ruleset is active, which is a legitimate state
 * meaning "the legacy engine still decides new cases" — callers must handle it
 * rather than assuming a canonical ruleset exists.
 */
export async function getCurrentGovernedRuleset(args: {
  environment?: RuleActivationEnvironment;
  organisationKey?: string | null;
} = {}): Promise<CurrentGovernedRuleset | null> {
  const environment = args.environment ?? getRuntimeClinicalEnvironment();
  const organisationKey = args.organisationKey ?? null;

  const ruleSet = await prisma.clinicalRuleSet.findUnique({
    where: { key: NATIONAL_RULE_SET_KEY },
    select: { id: true },
  });
  if (!ruleSet) return null;

  // Organisation-specific activation wins over the global one, matching the
  // precedence the authority resolver already applies.
  const activation =
    (organisationKey
      ? await prisma.ruleSetActivation.findFirst({
          where: {
            ruleSetId: ruleSet.id,
            environment,
            organisationKey,
            deactivatedAt: null,
          },
          orderBy: { activatedAt: "desc" },
        })
      : null) ??
    (await prisma.ruleSetActivation.findFirst({
      where: {
        ruleSetId: ruleSet.id,
        environment,
        organisationKey: null,
        deactivatedAt: null,
      },
      orderBy: { activatedAt: "desc" },
    }));

  if (!activation) return null;

  const version = await prisma.clinicalRuleVersion.findUnique({
    where: { id: activation.ruleVersionId },
    select: {
      id: true,
      displayVersion: true,
      checksum: true,
      revision: true,
    },
  });

  // A checksum is required: an activation pointing at an unchecksummed version
  // cannot be trusted to identify what actually ran, so it is treated as no
  // current governed ruleset rather than a partially-known one.
  if (!version?.checksum) return null;

  return {
    ruleVersionId: version.id,
    displayVersion: version.displayVersion,
    checksum: version.checksum,
    revision: version.revision,
    environment,
    organisationKey: activation.organisationKey,
    activatedAt: activation.activatedAt,
  };
}

// The clinician-facing labels now live in ./labels, which is import-free so
// client components can use them without pulling Prisma into the bundle. They
// are re-exported here because this module is where callers look for anything
// describing the current governed ruleset.
export {
  CURRENT_GUIDELINES_LABEL,
  CURRENT_RULES_LABEL,
} from "@/lib/clinical-rules/labels";
