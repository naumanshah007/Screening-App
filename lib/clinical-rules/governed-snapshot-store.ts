/**
 * Loader for the committed, checksummed governed clinical snapshots.
 *
 * WHY
 * ---
 * The v2.1 source package (~39 MB: graph JSON, posters, contact sheets) is not
 * in version control. Before this module, a clean checkout could not build the
 * canonical snapshot and ~900 clinical-rules tests failed — so the suite only
 * passed on a machine that happened to have an undocumented local folder.
 *
 * WHAT THIS IS
 * ------------
 * The *derived* governed snapshot — the machine-readable artefact the
 * application actually consumes — committed as a fixture with its checksum.
 * It is DERIVED, never authored: `scripts/rule-studio/export-governed-snapshot.ts`
 * regenerates it, and the source-verification suite rebuilds from the external
 * package and asserts byte-identity, so the fixture cannot silently drift from
 * the source it claims to represent.
 *
 * This is snapshot *input data* (the ruleset), not expected outcomes. No
 * expected clinical result is generated from the engine under test.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Not a replacement for source verification. Proving the snapshot matches the
 * NCSP source material still requires the external package. That suite is
 * skipped, loudly, when the package is absent — never silently passed.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { calculateRuleSnapshotChecksum } from "./checksum";
import { parseSnapshot, type ClinicalRuleSnapshot } from "./schema";

const SNAPSHOT_DIRECTORY = path.join(process.cwd(), "lib/clinical-rules/governed-snapshots");

export type GovernedSnapshotName = "cg-ncsp-3.0.0" | "cg-ncsp-3.1.0";

export type GovernedSnapshotManifest = {
  sourcePackageVersion: string;
  sourceJsonSha256: string;
  artefacts: Record<string, { checksum: string; rules: number; bytes: number }>;
};

export function readGovernedSnapshotManifest(): GovernedSnapshotManifest {
  return JSON.parse(
    readFileSync(path.join(SNAPSHOT_DIRECTORY, "manifest.json"), "utf8")
  ) as GovernedSnapshotManifest;
}

const cache = new Map<GovernedSnapshotName, ClinicalRuleSnapshot>();

/**
 * Load a committed governed snapshot and verify its checksum against the
 * manifest. A checksum mismatch throws: a hand-edited ruleset fixture must never
 * be usable.
 */
export function loadGovernedSnapshot(name: GovernedSnapshotName): ClinicalRuleSnapshot {
  const cached = cache.get(name);
  if (cached) return cached;

  const raw = readFileSync(path.join(SNAPSHOT_DIRECTORY, `${name}.json`), "utf8");
  const snapshot = parseSnapshot(JSON.parse(raw));

  const expected = readGovernedSnapshotManifest().artefacts[name]?.checksum;
  const actual = calculateRuleSnapshotChecksum(snapshot);
  if (!expected) {
    throw new Error(`Governed snapshot ${name} is not listed in the snapshot manifest.`);
  }
  if (actual !== expected) {
    throw new Error(
      `Governed snapshot ${name} checksum mismatch: manifest ${expected}, computed ${actual}. ` +
        "Regenerate with `npm run rules:export:snapshot`; never hand-edit a governed snapshot."
    );
  }

  cache.set(name, snapshot);
  return snapshot;
}

/** True when the external v2.1 source package is available for source verification. */
export function isSourcePackageAvailable(): boolean {
  const candidates = [
    path.join(process.cwd(), "docs/clinical-rules/source-v2.1"),
    path.join(
      process.cwd(),
      "docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1"
    ),
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(path.join(candidate, "CerviGrade_NCSP_Master_Rules_v2_1.json"));
      return true;
    } catch {
      // Try the next known package location.
    }
  }
  return false;
}
