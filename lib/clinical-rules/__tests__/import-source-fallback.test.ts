/**
 * The canonical ruleset must be loadable in an environment that does not have
 * the external source package — otherwise it cannot exist in any deployed
 * database, which is exactly what visual QA found on the Preview.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveImportSnapshot } from "../import-source";
import { isSourcePackageAvailable } from "../governed-snapshot-store";

test("import falls back to the committed governed snapshot when the source package is absent", async () => {
  let sourceBuildCalled = false;
  const resolved = await resolveImportSnapshot({
    name: "cg-ncsp-3.1.0",
    // Returns the committed snapshot so the assertion works in both
    // environments; what is under test is WHICH path the resolver chooses.
    buildFromSource: async () => {
      sourceBuildCalled = true;
      const { buildSuccessorSnapshotFromV21Package } = await import("../successor-v3-1");
      return buildSuccessorSnapshotFromV21Package();
    },
  });

  assert.equal(resolved.snapshot.rules.length, 203);
  assert.equal(resolved.snapshot.productRuleSet.displayVersion, "CG-NCSP-3.1.0");

  if (isSourcePackageAvailable()) {
    // With the artefact present the source path is preferred, and that is correct.
    assert.equal(resolved.origin, "SOURCE_PACKAGE");
    assert.equal(sourceBuildCalled, true);
    return;
  }

  // Without it, the deployed condition, the committed fixture is used instead
  // of failing — this is what makes the ruleset loadable on Vercel at all.
  assert.equal(resolved.origin, "COMMITTED_GOVERNED_SNAPSHOT");
  assert.equal(sourceBuildCalled, false);
});

test("the committed-snapshot verification says plainly where the snapshot came from", async () => {
  if (isSourcePackageAvailable()) return; // covered by the source-verification suite
  const resolved = await resolveImportSnapshot({
    name: "cg-ncsp-3.1.0",
    buildFromSource: async () => {
      throw new Error("unreachable");
    },
  });
  assert.match(resolved.verification.sourceDirectory, /committed governed snapshot/i);
  assert.equal(
    resolved.verification.visualVerificationStatus,
    "NOT_VERIFIED_FROM_COMMITTED_SNAPSHOT",
    "a reviewer must be able to tell that source-package evidence is absent"
  );
  // Provenance back to the source material is preserved via the manifest hash.
  assert.match(resolved.verification.sourceJsonSha256, /^[a-f0-9]{64}$/);
});

test("an explicit source directory never falls back", async () => {
  let called = false;
  await assert.rejects(
    () =>
      resolveImportSnapshot({
        name: "cg-ncsp-3.1.0",
        explicitSourceDirectory: "/nonexistent/path",
        buildFromSource: async () => {
          called = true;
          throw new Error("explicit source missing");
        },
      }),
    /explicit source missing/
  );
  assert.equal(called, true, "an explicit source directory must be honoured, not silently replaced");
});

test("the demo bootstrap route refuses on a production deployment", () => {
  const route = readFileSync("app/api/clinical-rules/bootstrap-demo/route.ts", "utf8");
  assert.ok(route.includes("isProductionDeployment()"));
  assert.ok(route.includes("not available on a production deployment"));
});

test("the demo bootstrap route creates drafts only and never publishes or activates", () => {
  const route = readFileSync("app/api/clinical-rules/bootstrap-demo/route.ts", "utf8");
  for (const forbidden of [
    "publishClinicalRuleVersion",
    "activateClinicalRuleVersion",
    "approveClinicalRuleVersion",
    "LIVE_PRODUCTION",
  ]) {
    assert.equal(route.includes(forbidden), false, `bootstrap must never call ${forbidden}`);
  }
  assert.ok(route.includes('publicationStatus: "UNPUBLISHED"'));
  assert.ok(route.includes('activationStatus: "INACTIVE"'));
  assert.ok(route.includes('clinicalAuthority: "LEGACY"'));
});
