/**
 * A routing preview must never read as a settled clinical decision.
 *
 * A Pull Cases preview has been routed by the legacy engine but not evaluated by
 * the current governed ruleset. Four surfaces still presented it as decided:
 * the "Authoritative decision · Legacy engine" badge, an "Evaluated by the
 * authoritative Legacy engine" provenance line, a clinical Next action and
 * Referral value, and diagram wording claiming an outcome had been reached.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const DETAIL = readFileSync(
  join(ROOT, "components", "batch", "BatchResultDetail.tsx"),
  "utf8"
);
const COMPARISON = readFileSync(
  join(ROOT, "components", "clinical-rules", "AuthorityComparison.tsx"),
  "utf8"
);
const PREVIEW_STATE = readFileSync(
  join(ROOT, "lib", "batch", "preview-state.ts"),
  "utf8"
);
const ROUTE = readFileSync(
  join(ROOT, "app", "api", "batch", "process", "route.ts"),
  "utf8"
);

test("preview detection is shared between API and UI", () => {
  // A duplicated literal would let the two drift and silently reintroduce a
  // preview that reads as authoritative.
  assert.match(PREVIEW_STATE, /export const PREVIEW_PENDING_CODE/);
  assert.match(PREVIEW_STATE, /export function isRoutingPreview/);
  assert.match(ROUTE, /from "@\/lib\/batch\/preview-state"/);
  assert.match(DETAIL, /from "@\/lib\/batch\/preview-state"/);
  assert.match(COMPARISON, /from "@\/lib\/batch\/preview-state"/);
});

test("the badge does not call a preview an authoritative decision", () => {
  assert.match(
    COMPARISON,
    /legacyIsPreview \? "Routing preview" : "Authoritative decision"/,
    "a preview must be badged as a routing preview"
  );
  assert.match(
    COMPARISON,
    /legacyIsPreview \? "Awaiting governed evaluation" : "Legacy engine"/,
    "a preview must not be attributed to the legacy engine as decider"
  );
});

test("provenance does not claim a legacy evaluation for a preview", () => {
  assert.match(
    DETAIL,
    /isPreview\s*\?\s*"Pathway routed by"/,
    "a preview must describe routing, not evaluation"
  );
  // The legacy-evaluation wording must survive only for genuinely decided rows.
  assert.match(
    DETAIL,
    /"Evaluated by the authoritative Legacy engine"/,
    "historical legacy decisions must keep their truthful provenance"
  );
});

test("no clinical action is shown before governed evaluation", () => {
  assert.match(
    DETAIL,
    /state === "NOT_YET_EVALUATED"\s*\?\s*PREVIEW_PENDING_ACTION/,
    "the Why panel must be withheld until a governed rule has run"
  );
  assert.match(
    DETAIL,
    /state === "NOT_YET_EVALUATED"\s*\?\s*PREVIEW_PENDING_FIELD/,
    "the Decision panel must be withheld until a governed rule has run"
  );
});

test("the preview response is an allowlist, not a redacted object spread", () => {
  // A spread leaks by default: every new field on ClinicalDecision would reach
  // the browser until someone remembered to blank it. recallIntervalMonths,
  // recallRequired, referralRequired, nextScreeningIntervalMonths and riskLevel
  // all survived the old blanking list and were rendered by the drawer.
  const preview = ROUTE.slice(ROUTE.indexOf("const preview = {"), ROUTE.indexOf("return NextResponse.json(preview)"));
  assert.doesNotMatch(preview, /\.\.\.item\b/, "the preview must not spread the processed item");
  assert.doesNotMatch(preview, /\.\.\.item\.decision/, "the preview must not spread the decision");
  assert.doesNotMatch(preview, /\.\.\.result\b/, "the preview must not spread the batch result");

  for (const field of [
    "recommendation: PREVIEW_PENDING_TEXT",
    "recommendationCode: PREVIEW_PENDING_CODE",
    "nextAction: PREVIEW_PENDING_ACTION",
  ]) {
    assert.ok(preview.includes(field), `missing preview marker: ${field}`);
  }

  // The leak list, named explicitly so a reviewer can see what must stay out.
  for (const leaked of [
    "riskLevel",
    "referralRequired",
    "referralPriority",
    "referralType",
    "recallRequired",
    "recallIntervalMonths",
    "nextScreeningIntervalMonths",
    "requiresMDMReview",
  ]) {
    assert.ok(
      !preview.includes(leaked),
      `an unevaluated routing preview must not carry ${leaked}`
    );
  }
});

test("the preview banner does not announce a recommendation", () => {
  assert.match(
    DETAIL,
    /isPreview \? \([\s\S]{0,120}Routing preview<\/strong> · Governed recommendation pending/,
    "the banner must not claim a provisional recommendation exists"
  );
});

test("an unevaluated preview is the only thing called not yet evaluated", () => {
  // The workflow timeline that carried "Governed evaluation pending" is gone
  // from the clinician view. The state itself survives, and it is reached ONLY
  // through the preview marker — never for a case that has been evaluated.
  assert.match(
    DETAIL,
    /if \(isRoutingPreview\(decision\)\) return "NOT_YET_EVALUATED"/,
    "not-yet-evaluated must be keyed on the preview marker alone"
  );
  assert.doesNotMatch(
    DETAIL,
    /Governed evaluation pending/,
    "an evaluated case must never be described as pending evaluation"
  );
});

test("a preview shows no governed outcome and no clinical terminal", () => {
  assert.match(
    DETAIL,
    /NOT_YET_EVALUATED: "Not yet evaluated"/,
    "a preview has its own honest state label"
  );
  // The static diagram is gone entirely, and the decision path is derived only
  // from a persisted evaluation — which a preview does not have.
  assert.doesNotMatch(DETAIL, /FlowDiagram/, "no diagram may appear for a preview");
  assert.match(
    DETAIL,
    /traceSteps\.length > 0 && !isPreview/,
    "a preview must never render a decision path"
  );
});

test("internal shadow-evaluation wording is not shown for a preview", () => {
  assert.match(
    COMPARISON,
    /legacyIsPreview[\s\S]{0,120}Governed evaluation will run when this case is added to the Review Queue/,
    "a preview must plainly state when governed evaluation happens"
  );
  assert.match(
    COMPARISON,
    /No canonical shadow evaluation was recorded for this decision/,
    "the original wording must remain for genuinely decided rows"
  );
});
