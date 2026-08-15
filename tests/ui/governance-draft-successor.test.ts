/**
 * The approval centre must be able to reach the version it is meant to govern.
 *
 * THE DEFECT
 * ----------
 * The page resolved its version with `where: { displayVersion: "CG-NCSP-3.1.0" }`
 * — a literal. `recordClinicalGovernanceReview` refuses anything that is not a
 * DRAFT ("Governance interpretation may only revise a draft successor"), but
 * that literal always resolved to the ACTIVE version. The approval centre could
 * therefore only ever display the one version whose controls are permanently
 * disabled, and the formal 16-case register could not be completed at all: a
 * reviewer could create the required draft successor in Rule Studio and this
 * page would still not address it.
 *
 * WHAT MUST NOT REGRESS
 * ---------------------
 * Nothing here relaxes a governance rule. The server-side DRAFT requirement,
 * the checksum binding and the proposer-cannot-approve separation are unchanged
 * and are asserted below, because a routing fix that quietly let an approval be
 * recorded against a live version would be a clinical-safety defect.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const PAGE = read("app/(app)/governance/clinical/page.tsx");
const REVIEW = read("lib/clinical-rules/governance-review.ts");

test("the governed version is resolved, not hard-coded", () => {
  assert.doesNotMatch(
    PAGE,
    /where: \{ displayVersion: "CG-NCSP-3\.1\.0" \}/,
    "the approval centre must not be pinned to one version string"
  );
  assert.match(
    PAGE,
    /where: \{ ruleSetId: ruleSet\.id, status: "DRAFT" \}/,
    "it must look for a draft successor"
  );
  assert.match(
    PAGE,
    /const targetVersionId = draftSuccessor\?\.id \?\? fallback/,
    "a draft successor must take precedence over the current governed version"
  );
  assert.match(
    PAGE,
    /<HeaderMeta label="Review version" value=\{governingDraft \? version\.displayVersion : "None"\}/,
    "the summary must name the version actually being governed"
  );
});

test("the current governed summary names the deciding ruleset, not the draft", () => {
  // Once a draft exists these are different versions. Printing the draft's
  // identifier beside "ACTIVE" would state that an unapproved draft is
  // deciding cases.
  assert.match(
    PAGE,
    /const governedVersion = currentGoverned\?\.displayVersion \?\? "Not configured"/,
    "the current-rules summary must resolve from the current governed ruleset"
  );
  assert.match(
    PAGE,
    /currentGoverned\s*\? `Active for \$\{environmentLabel\}`/,
    "only the current governed ruleset may be labelled active"
  );
  assert.match(
    PAGE,
    /No governed version is active for new cases\./,
    "an unactivated draft must not be presented as the current governed rules"
  );
});

test("a page with no draft successor says so and names the next step", () => {
  assert.match(PAGE, /const governingDraft = version\.status === "DRAFT"/);
  assert.match(
    PAGE,
    /No draft successor exists, so no interpretation can be recorded\./,
    "the blocked state must be stated, not left as greyed-out controls"
  );
  assert.match(
    PAGE,
    /Create a new version from the immutable current rules/,
    "the notice must name the action that unblocks the register"
  );
});

test("the server-side governance rules are unchanged", () => {
  assert.match(
    REVIEW,
    /if \(version\.status !== "DRAFT"\) \{\s*throw new Error\(\s*"Governance interpretation may only revise a draft successor\."/,
    "only a draft successor may carry an interpretation"
  );
  assert.match(
    REVIEW,
    /if \(version\.revision !== args\.expectedRevision\)/,
    "the optimistic-revision check must remain"
  );
  assert.match(
    REVIEW,
    /checksum: version\.checksum/,
    "an interpretation must stay bound to the exact content it approved"
  );
});
