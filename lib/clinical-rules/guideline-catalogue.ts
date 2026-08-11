/**
 * "Current Cervical Screening Guidelines" — the clinician-facing reading of the
 * governed canonical ruleset.
 *
 * ARCHITECTURE
 * ------------
 * Content comes from the committed, checksum-verified governed snapshot
 * (`governed-snapshot-store`), not from a runtime rebuild of the external v2.1
 * source package: a clean checkout must be able to render Guidelines.
 *
 * Authority comes from `getClinicalAuthorityDisplay()`, which resolves the real
 * activation state and fails safe to LEGACY. Nothing here decides authority, and
 * nothing here may imply canonical is clinically operative when it is not.
 *
 * INFORMATION ARCHITECTURE
 * ------------------------
 * Clinicians read one guideline system. The governed identifier
 * (CG-NCSP-3.1.0), revision, checksum, lifecycle and provenance are preserved
 * in full and remain reachable from the governance disclosure, Rule Studio and
 * audit — they are moved out of the primary reading path, never removed.
 */

import { prisma } from "@/lib/prisma";

import { getClinicalAuthorityDisplay, type ClinicalAuthorityDisplay } from "./authority-display";
import { NATIONAL_RULE_SET_KEY } from "./constants";
import {
  loadGovernedSnapshot,
  readGovernedSnapshotManifest,
  type GovernedSnapshotName,
} from "./governed-snapshot-store";
import { listPathwaySummaries, type PathwaySummary } from "./pathway-view-model";
import type { ClinicalRuleSnapshot } from "./schema";

/** The governed artefact the clinician-facing Guidelines surface reads. */
export const CURRENT_GUIDELINE_SNAPSHOT: GovernedSnapshotName = "cg-ncsp-3.1.0";

export const CURRENT_GUIDELINES_TITLE = "Current Cervical Screening Guidelines";
export const CURRENT_GUIDELINES_SUBTITLE =
  "National Cervical Screening Programme · HPV primary screening pathways";

export type GuidelineGovernance = {
  /** Internal governed identifier, e.g. CG-NCSP-3.1.0. Advanced disclosure only. */
  rulesetId: string;
  rulesetName: string;
  /** Lifecycle of the governed version as recorded, e.g. DRAFT. */
  lifecycle: string;
  /** How canonical results are currently recorded, e.g. SHADOW. */
  evaluationMode: string;
  checksum: string;
  sourcePackageVersion: string;
  sourceJsonSha256: string;
  counts: { rules: number; nodes: number; edges: number; views: number };
  sources: ClinicalRuleSnapshot["sources"];
  safetyNotices: string[];
};

export type GuidelineCatalogue = {
  title: string;
  subtitle: string;
  /** Real authority state. Never inferred from the UI. */
  authority: ClinicalAuthorityDisplay;
  /** True only when canonical is both authoritative AND recorded in a live mode. */
  canonicalIsAuthoritative: boolean;
  pathways: PathwaySummary[];
  governance: GuidelineGovernance;
};

/**
 * Canonical is only clinically operative when the resolved authority is
 * CANONICAL *and* evaluations are being written in a live mode. SHADOW and
 * SIMULATION are comparison artefacts.
 */
export function isCanonicalOperative(authority: ClinicalAuthorityDisplay): boolean {
  return (
    authority.authorityEngine === "CANONICAL" &&
    (authority.canonicalMode === "LIVE_PRODUCTION" || authority.canonicalMode === "LIVE_DEMO")
  );
}

/** The governed snapshot backing the guidelines. Cheap: cached by the store. */
export function getGuidelineSnapshot(): ClinicalRuleSnapshot {
  return loadGovernedSnapshot(CURRENT_GUIDELINE_SNAPSHOT);
}

export async function getGuidelineCatalogue(): Promise<GuidelineCatalogue> {
  const snapshot = getGuidelineSnapshot();
  const manifest = readGovernedSnapshotManifest();
  const authority = await getClinicalAuthorityDisplay();

  return {
    title: CURRENT_GUIDELINES_TITLE,
    subtitle: CURRENT_GUIDELINES_SUBTITLE,
    authority,
    canonicalIsAuthoritative: isCanonicalOperative(authority),
    pathways: listPathwaySummaries(snapshot),
    governance: {
      // Prefer the version recorded in the database; fall back to the artefact
      // so Guidelines still renders on a database-less environment.
      rulesetId: authority.canonicalVersion ?? snapshot.productRuleSet.displayVersion,
      rulesetName: snapshot.productRuleSet.name,
      lifecycle: authority.canonicalStatus ?? "Not recorded",
      evaluationMode: authority.canonicalMode,
      checksum:
        authority.canonicalChecksum ??
        manifest.artefacts[CURRENT_GUIDELINE_SNAPSHOT]?.checksum ??
        "",
      sourcePackageVersion: snapshot.sourcePackage.version,
      sourceJsonSha256: snapshot.sourcePackage.sourceJsonSha256,
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

export type GuidelineVersionHistoryEntry = {
  id: string;
  displayVersion: string;
  status: string;
  revision: number;
  updatedAt: string;
  evaluations: number;
  activeIn: string[];
};

/**
 * Every governed version, for the governance disclosure. History is never
 * merged or removed; it is simply not part of the clinical reading path.
 * Fails safe to an empty list: a governance query must not break the page.
 */
export async function listGuidelineVersionHistory(): Promise<GuidelineVersionHistoryEntry[]> {
  try {
    const ruleSet = await prisma.clinicalRuleSet.findUnique({
      where: { key: NATIONAL_RULE_SET_KEY },
      select: { id: true },
    });
    if (!ruleSet) return [];
    const versions = await prisma.clinicalRuleVersion.findMany({
      where: { ruleSetId: ruleSet.id },
      orderBy: [{ versionMajor: "desc" }, { versionMinor: "desc" }, { versionPatch: "desc" }],
      select: {
        id: true,
        displayVersion: true,
        status: true,
        revision: true,
        updatedAt: true,
        _count: { select: { evaluations: true } },
        activations: {
          where: { deactivatedAt: null },
          select: { environment: true },
        },
      },
    });
    return versions.map((version) => ({
      id: version.id,
      displayVersion: version.displayVersion,
      status: version.status,
      revision: version.revision,
      updatedAt: version.updatedAt.toISOString(),
      evaluations: version._count.evaluations,
      activeIn: version.activations.map((activation) => activation.environment),
    }));
  } catch {
    return [];
  }
}
