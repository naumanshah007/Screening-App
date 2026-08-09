/**
 * Snapshot resolution for import.
 *
 * WHY
 * ---
 * The importer built exclusively from the external v2.1 source package. That
 * package is ~39 MB and is not in version control, so it does not exist on
 * Vercel — which meant CG-NCSP-3.1.0 could not be loaded into ANY deployed
 * environment. Visual QA on the Preview surfaced this: Rule Studio was empty,
 * the sidebar could not name the canonical ruleset, and no shadow evaluation
 * could ever be produced because there was no version to evaluate against.
 *
 * This resolver prefers the source package when it is present (so a governed
 * import from source keeps its full verification evidence), and falls back to
 * the committed, checksum-verified governed snapshot when it is not.
 *
 * SAFETY
 * ------
 * The fallback is not a shortcut around verification. The committed snapshot is
 * checksum-verified on load by `loadGovernedSnapshot`, and
 * `governed-snapshot-source-verification.test.ts` asserts it is byte-identical
 * to what the source package produces. What the fallback loses is the
 * *source-package* evidence (file checksums, QA correction counts), so the
 * verification record says plainly where the snapshot came from — a reviewer
 * must never be unable to tell.
 *
 * Publication remains gated on source verification: see
 * docs/canonical-cutover/13-source-artifact-and-reproducibility.md.
 */

import type { ClinicalRuleSnapshot } from "./schema";
import type { SourcePackageVerification } from "./source-package";
import {
  isSourcePackageAvailable,
  loadGovernedSnapshot,
  readGovernedSnapshotManifest,
  type GovernedSnapshotName,
} from "./governed-snapshot-store";

export type SnapshotOrigin = "SOURCE_PACKAGE" | "COMMITTED_GOVERNED_SNAPSHOT";

export type ResolvedImportSnapshot = {
  snapshot: ClinicalRuleSnapshot;
  verification: SourcePackageVerification;
  origin: SnapshotOrigin;
};

/**
 * Verification record for a snapshot loaded from the committed fixture.
 *
 * Every field that can only be established from the source package is marked
 * as such rather than fabricated with a plausible-looking value.
 */
function committedSnapshotVerification(
  snapshot: ClinicalRuleSnapshot,
  name: GovernedSnapshotName
): SourcePackageVerification {
  const manifest = readGovernedSnapshotManifest();
  const table1RuleCount = snapshot.importEvidence.table1RuleCount;
  const uniqueRuleCount = new Set(snapshot.rules.map((rule) => rule.stableRuleId)).size;

  return {
    sourceDirectory: "(committed governed snapshot — external source package not present)",
    sourceJsonPath: `lib/clinical-rules/governed-snapshots/${name}.json`,
    // The manifest records the source JSON hash that produced this snapshot, so
    // the provenance chain back to the source material is preserved.
    sourceJsonSha256: manifest.sourceJsonSha256,
    ruleCount: snapshot.rules.length,
    uniqueRuleCount,
    table1RuleCount,
    // Not establishable without the source package; reported as zero rather
    // than invented, and the origin field makes the reason explicit.
    qaCorrectionCount: 0,
    treeCoverageCount: snapshot.importEvidence.treeCoverageRuleIds.length,
    requiredFiles: [`lib/clinical-rules/governed-snapshots/${name}.json`],
    visualPackageDirectory: "(not verified from committed snapshot)",
    visualPackageVersion: snapshot.importEvidence.visualPackageVersion ?? "(not recorded)",
    visualVerificationStatus: "NOT_VERIFIED_FROM_COMMITTED_SNAPSHOT",
  } as SourcePackageVerification;
}

/**
 * Resolve a snapshot for import, preferring the external source package.
 *
 * `buildFromSource` is injected so this module does not import the heavy source
 * package reader when the fallback path is the one that runs.
 */
export async function resolveImportSnapshot(args: {
  name: GovernedSnapshotName;
  buildFromSource: () => Promise<{
    snapshot: ClinicalRuleSnapshot;
    verification: SourcePackageVerification;
  }>;
  /** An explicit source directory forces the source path and never falls back. */
  explicitSourceDirectory?: string;
}): Promise<ResolvedImportSnapshot> {
  if (args.explicitSourceDirectory || isSourcePackageAvailable()) {
    const built = await args.buildFromSource();
    return { ...built, origin: "SOURCE_PACKAGE" };
  }

  const snapshot = loadGovernedSnapshot(args.name);
  return {
    snapshot,
    verification: committedSnapshotVerification(snapshot, args.name),
    origin: "COMMITTED_GOVERNED_SNAPSHOT",
  };
}
