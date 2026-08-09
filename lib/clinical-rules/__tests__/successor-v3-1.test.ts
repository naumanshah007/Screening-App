/**
 * Governed successor CG-NCSP-3.1.0.
 *
 * Split by dependency, so a clean checkout runs everything that does not
 * genuinely need the external source package:
 *
 *  - Build determinism (does the importer reproduce the snapshot from source?)
 *    requires the external package and SKIPS loudly without it.
 *  - Content and the 179-case corpus run against the committed governed
 *    snapshot, whose checksum is verified on load and whose byte-identity to the
 *    source rebuild is asserted by governed-snapshot-source-verification.test.ts.
 *
 * See docs/canonical-cutover/13-source-artifact-and-reproducibility.md.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { calculateRuleSnapshotChecksum } from "../checksum";
import { evaluateCanonicalClinicalFactsV2 } from "../evaluator";
import { isSourcePackageAvailable, loadGovernedSnapshot } from "../governed-snapshot-store";
import { buildSnapshotFromV21Package } from "../source-package";
import {
  SUCCESSOR_PRODUCT_VERSION,
  buildSuccessorSnapshotFromV21Package,
} from "../successor-v3-1";
import { canonicalV2Corpus } from "./support/canonical-v2-corpus";

const skipWithoutSource = isSourcePackageAvailable()
  ? false
  : "External v2.1 source package not present. See docs/canonical-cutover/13-source-artifact-and-reproducibility.md.";

test(
  "governed successor is deterministic and leaves the evaluated snapshot unchanged",
  { skip: skipWithoutSource },
  async () => {
    const base = await buildSnapshotFromV21Package();
    const first = await buildSuccessorSnapshotFromV21Package();
    const second = await buildSuccessorSnapshotFromV21Package();

    assert.equal(base.snapshot.productRuleSet.displayVersion, "CG-NCSP-3.0.0");
    assert.equal(
      calculateRuleSnapshotChecksum(base.snapshot),
      "2997a909b98f9d8960cc3697cf125d5b0e106d4f0be9a0ee789404e54486a96b"
    );
    assert.equal(first.snapshot.productRuleSet.displayVersion, SUCCESSOR_PRODUCT_VERSION);
    assert.equal(calculateRuleSnapshotChecksum(first.snapshot), calculateRuleSnapshotChecksum(second.snapshot));
    assert.notEqual(
      calculateRuleSnapshotChecksum(first.snapshot),
      calculateRuleSnapshotChecksum(base.snapshot)
    );
  }
);

test("governed successor snapshot shape is stable", () => {
  const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");
  assert.equal(snapshot.productRuleSet.displayVersion, SUCCESSOR_PRODUCT_VERSION);
  assert.equal(snapshot.schemaVersion, "3.1");
  assert.equal(snapshot.engineContractVersion, "canonical-graph-v2");
  assert.equal(snapshot.rules.length, 203);
  assert.equal(snapshot.nodes.length, 422);
  assert.equal(snapshot.edges.length, 421);
  assert.equal(snapshot.views.length, 12);
});

test("successor source-supported branches preserve specificity and clinician boundaries", () => {
  const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");
  const rules = new Map(snapshot.rules.map((rule) => [rule.stableRuleId, rule]));
  assert.equal(rules.get("F3-19")?.outcomeBranches?.length, 2);
  assert.ok((rules.get("F3-19")?.evaluationPriority ?? 0) > (rules.get("F3-22")?.evaluationPriority ?? 0));
  assert.equal(rules.get("F7-02")?.outcomeBranches?.[0].urgency, "URGENT");
  assert.match(rules.get("F5-04")?.provisionalOutcome ?? "", /observation is an option/i);
  assert.match(rules.get("F5-08")?.provisionalOutcome ?? "", /specialist surveillance sequence/i);
  assert.match(rules.get("F10-01")?.timingDestination ?? "", /without delay/i);
});

test("all 179 CanonicalClinicalFactsV2 fixtures select a governed branch", () => {
  const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");
  const failures: string[] = [];
  for (const fixture of canonicalV2Corpus) {
    const evaluated = evaluateCanonicalClinicalFactsV2(snapshot, fixture.canonicalFacts);
    const controllingRuleId = evaluated.result.matchedRuleIds[0];
    const expectedGovernedStop = ["SAFETY_STOP", "INCOMPLETE_RESULT"].includes(
      fixture.oracle.actionClass
    );
    if (
      (!controllingRuleId && !expectedGovernedStop) ||
      evaluated.result.branchPath.length < (expectedGovernedStop ? 2 : 4)
    ) {
      failures.push(
        `${fixture.caseId}: ${evaluated.result.provisionalRecommendation}; missing=${evaluated.result.missingInformation.join(",")}`
      );
    }
    assert.ok(evaluated.result.sourceReferences.length > 0, `${fixture.caseId}: missing source references`);
    assert.equal(evaluated.result.mandatoryReviewerConfirmation, true, fixture.caseId);
  }
  assert.deepEqual(failures, []);
  assert.equal(canonicalV2Corpus.length, 179, "the semantic corpus must remain 179 cases");
});
