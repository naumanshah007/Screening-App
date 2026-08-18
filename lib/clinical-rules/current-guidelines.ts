/**
 * Resolves "Current Cervical Screening Guidelines" for clinical users.
 *
 * Clinicians are shown one guideline system. The governed identifier
 * (CG-NCSP-3.1.0), revision, checksum, lifecycle and provenance are preserved
 * and remain reachable from governance surfaces — they are moved out of the
 * primary reading path, not removed.
 *
 * Authority is derived at request time from rule-set activations, never
 * hard-coded, so promoting the canonical engine to production authority
 * changes the labelling without another redesign.
 */

import { prisma } from "@/lib/prisma";
import { NATIONAL_RULE_SET_KEY } from "./constants";
import {
  getClinicalRuleVersionSnapshot,
  resolveActiveClinicalRuleVersion,
  resolveShadowClinicalRuleVersion,
} from "./lifecycle";
import { listPathwaySummaries, type PathwaySummary } from "./pathway-view-model";
import type { ClinicalRuleSnapshot } from "./schema";

export type GuidelineAuthorityState =
  | "PRODUCTION_AUTHORITY"
  | "OPERATIONAL_AUTHORITY"
  | "PARALLEL_VALIDATION";

export type GuidelineAuthority = {
  state: GuidelineAuthorityState;
  environment: string | null;
  /** Short, clinician-readable status. */
  label: string;
  /** One sentence explaining what the status means for the reader. */
  description: string;
  /** True when this guideline set decides the recommendation a user acts on. */
  decidesRecommendations: boolean;
};

export type CurrentGuidelines = {
  /** Clinician-facing name. The internal id never leads. */
  title: string;
  subtitle: string;
  authority: GuidelineAuthority;
  pathways: PathwaySummary[];
  snapshot: ClinicalRuleSnapshot;
  governance: {
    versionId: string;
    rulesetId: string;
    rulesetName: string;
    revision: number;
    checksum: string | null;
    lifecycle: string;
    sourcePackageVersion: string;
    sourceJsonSha256: string;
    updatedAt: Date;
    parentVersion: string | null;
    sourceSummary: string;
    counts: { rules: number; nodes: number; edges: number; views: number };
    sources: ClinicalRuleSnapshot["sources"];
    safetyNotices: string[];
  };
};

export const CURRENT_GUIDELINES_TITLE = "Current Cervical Screening Guidelines";

function describeAuthority(
  activeProduction: boolean,
  activeOperational: boolean,
  environment: string | null
): GuidelineAuthority {
  if (activeProduction) {
    return {
      state: "PRODUCTION_AUTHORITY",
      environment,
      label: "In clinical use",
      description:
        "These guidelines produce the provisional recommendations shown in case review.",
      decidesRecommendations: true,
    };
  }
  if (activeOperational) {
    return {
      state: "OPERATIONAL_AUTHORITY",
      environment,
      label: "Active in this environment",
      description:
        "These guidelines produce the provisional recommendations shown in this environment.",
      decidesRecommendations: true,
    };
  }
  return {
    state: "PARALLEL_VALIDATION",
    environment: null,
    label: "In parallel validation",
    description:
      "This is the current governed guideline content. It runs alongside the existing grading engine for comparison, so case recommendations are still produced by that engine.",
    decidesRecommendations: false,
  };
}

/**
 * The governed version a clinician should read today: the activated version
 * where one exists, otherwise the newest governed version.
 */
export async function getCurrentGuidelines(): Promise<CurrentGuidelines | null> {
  const [production, operational] = await Promise.all([
    resolveActiveClinicalRuleVersion({ environment: "PRODUCTION" }).catch(() => null),
    resolveActiveClinicalRuleVersion({ environment: "DEMO" }).catch(() => null),
  ]);
  const version = production ?? operational ?? (await resolveShadowClinicalRuleVersion());
  if (!version) return null;

  const { snapshot } = await getClinicalRuleVersionSnapshot(version.id);
  const authority = describeAuthority(
    Boolean(production),
    Boolean(operational),
    production ? "PRODUCTION" : operational ? "DEMO" : null
  );

  return {
    title: CURRENT_GUIDELINES_TITLE,
    subtitle: "National Cervical Screening Programme · HPV primary screening pathways",
    authority,
    pathways: listPathwaySummaries(snapshot),
    snapshot,
    governance: {
      versionId: version.id,
      rulesetId: version.displayVersion,
      rulesetName: version.ruleSet.name,
      revision: version.revision,
      checksum: version.checksum,
      lifecycle: version.status,
      sourcePackageVersion: snapshot.sourcePackage.version,
      sourceJsonSha256: snapshot.sourcePackage.sourceJsonSha256,
      updatedAt: version.updatedAt,
      parentVersion: version.parentVersion?.displayVersion ?? null,
      sourceSummary: version.sourceGuidelineSummary,
      counts: {
        rules: snapshot.rules.length,
        nodes: snapshot.nodes.length,
        edges: snapshot.edges.length,
        views: snapshot.views.length,
      },
      sources: snapshot.sources,
      safetyNotices: [...snapshot.safetyNotices],
    },
  };
}

/**
 * Every governed version, for the governance surface. History is never merged
 * or removed; it is simply not part of the clinical reading path.
 */
export async function listGuidelineVersionHistory() {
  const ruleSet = await prisma.clinicalRuleSet.findUnique({
    where: { key: NATIONAL_RULE_SET_KEY },
  });
  if (!ruleSet) return [];
  return prisma.clinicalRuleVersion.findMany({
    where: { ruleSetId: ruleSet.id },
    orderBy: [{ versionMajor: "desc" }, { versionMinor: "desc" }, { versionPatch: "desc" }],
    select: {
      id: true,
      displayVersion: true,
      status: true,
      revision: true,
      checksum: true,
      updatedAt: true,
      changeSummary: true,
      _count: { select: { evaluations: true } },
      activations: {
        where: { deactivatedAt: null },
        select: { environment: true, isDefault: true },
      },
    },
  });
}
