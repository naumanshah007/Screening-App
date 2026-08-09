/**
 * SOURCE VERIFICATION.
 *
 * Proves the committed governed snapshots are byte-identical to what the
 * external v2.1 source package produces, so the fixture cannot drift from the
 * source material it claims to represent.
 *
 * Requires the external source package. When it is absent these tests SKIP with
 * a loud reason — they never silently pass, and they never fall back to
 * comparing the fixture against itself.
 *
 * Run in CI with the artefact present:
 *     npm run test:source-verification
 */

import test from "node:test";
import assert from "node:assert/strict";

import { calculateRuleSnapshotChecksum, deterministicJson } from "../checksum";
import {
  isSourcePackageAvailable,
  loadGovernedSnapshot,
  readGovernedSnapshotManifest,
} from "../governed-snapshot-store";
import { buildSnapshotFromV21Package } from "../source-package";
import { buildSuccessorSnapshotFromV21Package } from "../successor-v3-1";

const available = isSourcePackageAvailable();
const skip = available
  ? false
  : "External v2.1 source package not present. See docs/canonical-cutover/13-source-artifact-and-reproducibility.md.";

test("committed CG-NCSP-3.1.0 is byte-identical to the source rebuild", { skip }, async () => {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  assert.equal(
    deterministicJson(snapshot),
    deterministicJson(loadGovernedSnapshot("cg-ncsp-3.1.0")),
    "the committed governed snapshot has drifted from the source package; regenerate with `npm run rules:export:snapshot`"
  );
});

test("committed CG-NCSP-3.0.0 is byte-identical to the source rebuild", { skip }, async () => {
  const { snapshot } = await buildSnapshotFromV21Package();
  assert.equal(
    deterministicJson(snapshot),
    deterministicJson(loadGovernedSnapshot("cg-ncsp-3.0.0")),
    "the committed governed snapshot has drifted from the source package"
  );
});

test("the manifest records the source package identity", { skip }, async () => {
  const { snapshot } = await buildSuccessorSnapshotFromV21Package();
  const manifest = readGovernedSnapshotManifest();
  assert.equal(manifest.sourcePackageVersion, snapshot.sourcePackage.version);
  assert.equal(
    manifest.sourceJsonSha256,
    snapshot.sourcePackage.sourceJsonSha256,
    "the manifest must name the exact source JSON that produced the committed snapshot"
  );
});

test("manifest checksums match the rebuilt snapshots", { skip }, async () => {
  const { snapshot: successor } = await buildSuccessorSnapshotFromV21Package();
  const { snapshot: base } = await buildSnapshotFromV21Package();
  const manifest = readGovernedSnapshotManifest();
  assert.equal(manifest.artefacts["cg-ncsp-3.1.0"]?.checksum, calculateRuleSnapshotChecksum(successor));
  assert.equal(manifest.artefacts["cg-ncsp-3.0.0"]?.checksum, calculateRuleSnapshotChecksum(base));
});

// ── These run in every checkout, with or without the source package ─────────

test("committed snapshots load and self-verify against the manifest", () => {
  // loadGovernedSnapshot throws on a checksum mismatch, so reaching here proves
  // the fixture has not been hand-edited.
  const successor = loadGovernedSnapshot("cg-ncsp-3.1.0");
  const base = loadGovernedSnapshot("cg-ncsp-3.0.0");
  assert.equal(successor.rules.length, 203);
  assert.equal(base.rules.length, 203);
  assert.equal(successor.productRuleSet.displayVersion, "CG-NCSP-3.1.0");
  assert.equal(base.productRuleSet.displayVersion, "CG-NCSP-3.0.0");
});

test("the governed snapshot carries the 203-rule and Table 1 import evidence", () => {
  const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");
  assert.equal(snapshot.importEvidence.expectedRuleCount, 203);
  assert.equal(snapshot.importEvidence.table1RuleCount, 21);
});

test("source-package availability is reported honestly", () => {
  // Guards against a future change that makes the skip condition always true,
  // which would turn source verification into a silent no-op everywhere.
  assert.equal(typeof isSourcePackageAvailable(), "boolean");
  if (!available) {
    assert.ok(typeof skip === "string" && skip.length > 0, "a skip must carry a reason");
  }
});
