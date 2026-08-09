/**
 * Read-only authority state for the UI.
 *
 * Answers, for display: which engine is clinically authoritative right now, and
 * what is the status of the canonical ruleset?
 *
 * SAFETY
 * ------
 * This never throws and never blocks a page render. Every failure path reports
 * LEGACY authority, because that is both the true default and the safe thing to
 * show: the UI must never imply canonical is authoritative when it is not.
 *
 * It also deliberately reports the canonical ruleset's REAL lifecycle status
 * (DRAFT today) rather than hiding it — a reviewer should be able to see that
 * CG-NCSP-3.1.0 exists, is being evaluated in shadow, and is not in force.
 */

import { prisma } from "@/lib/prisma";

import { getRuntimeClinicalEnvironment, LEGACY_ENGINE_VERSION, resolveClinicalAuthority } from "./authority";
import { NATIONAL_RULE_SET_KEY } from "./constants";

export type ClinicalAuthorityDisplay = {
  authorityEngine: "LEGACY" | "CANONICAL";
  /** Always the legacy router: CG-NCSP-3.1.0 has no router of its own. */
  routerEngine: string;
  /** The newest canonical version known, whatever its status. */
  canonicalVersion: string | null;
  canonicalStatus: string | null;
  canonicalChecksum: string | null;
  /** How canonical results are currently being recorded. */
  canonicalMode: "SHADOW" | "SIMULATION" | "LIVE_DEMO" | "LIVE_PRODUCTION" | "NOT_EVALUATED";
};

const LEGACY_ONLY: ClinicalAuthorityDisplay = {
  authorityEngine: "LEGACY",
  routerEngine: LEGACY_ENGINE_VERSION,
  canonicalVersion: null,
  canonicalStatus: null,
  canonicalChecksum: null,
  canonicalMode: "NOT_EVALUATED",
};

export async function getClinicalAuthorityDisplay(args?: {
  organisationKey?: string | null;
}): Promise<ClinicalAuthorityDisplay> {
  try {
    const authority = await resolveClinicalAuthority({
      organisationKey: args?.organisationKey,
      environment: getRuntimeClinicalEnvironment(),
    });

    // The newest canonical version, regardless of status, so the UI can show
    // "CG-NCSP-3.1.0 · DRAFT" rather than nothing at all.
    const version = await prisma.clinicalRuleVersion.findFirst({
      where: { ruleSet: { key: NATIONAL_RULE_SET_KEY } },
      orderBy: [
        { versionMajor: "desc" },
        { versionMinor: "desc" },
        { versionPatch: "desc" },
        { updatedAt: "desc" },
      ],
      select: { displayVersion: true, status: true, checksum: true },
    });

    if (!version) return { ...LEGACY_ONLY, authorityEngine: authority.authorityEngine };

    // The most recent evaluation tells us how canonical is actually being run.
    const latestEvaluation = await prisma.ruleEvaluation.findFirst({
      orderBy: { evaluatedAt: "desc" },
      select: { evaluationMode: true },
    });

    return {
      authorityEngine: authority.authorityEngine,
      routerEngine: authority.routerEngine,
      canonicalVersion: version.displayVersion,
      canonicalStatus: version.status,
      canonicalChecksum: version.checksum,
      canonicalMode: latestEvaluation?.evaluationMode ?? "NOT_EVALUATED",
    };
  } catch {
    // A display query must never break a clinical page.
    return LEGACY_ONLY;
  }
}
