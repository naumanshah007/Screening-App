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
    /isPreview\s*\?\s*PREVIEW_PENDING_ACTION/,
    "next action must be withheld until a governed rule has run"
  );
  assert.match(
    DETAIL,
    /isPreview \? \(\s*PREVIEW_PENDING_FIELD/,
    "referral must be withheld until a governed rule has run"
  );
});

test("the pathway diagram does not claim an outcome was reached", () => {
  assert.match(
    DETAIL,
    /No governed outcome has been determined yet/,
    "preview diagram wording must not assert a reached outcome"
  );
});

test("the API redacts every clinical field it previously leaked", () => {
  for (const field of [
    "recommendation: PREVIEW_PENDING_TEXT",
    "recommendationCode: PREVIEW_PENDING_CODE",
    "nextAction: PREVIEW_PENDING_ACTION",
    "referralPriority: null",
    "referralType: null",
    "repeatInterval: null",
  ]) {
    assert.match(ROUTE, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing: ${field}`);
  }
});

test("the preview banner does not announce a recommendation", () => {
  assert.match(
    DETAIL,
    /isPreview \? \([\s\S]{0,120}Routing preview<\/strong> · Governed recommendation pending/,
    "the banner must not claim a provisional recommendation exists"
  );
});

test("the workflow step does not claim provisional output", () => {
  assert.match(
    DETAIL,
    /isPreview[\s\S]{0,60}"Governed evaluation pending"/,
    "the workflow caption must state that governed evaluation is pending"
  );
  assert.match(
    DETAIL,
    /isPreview \? "Routing complete" : "Decision support run"/,
    "the workflow step must be labelled routing, not decision support"
  );
});

test("a preview shows no governed outcome and no clinical terminal", () => {
  // Superseded the single mixed trace: routing and governed evaluation are now
  // separate sections. The guarantee is unchanged — a preview must not present
  // a clinical terminal, because none has been determined.
  assert.match(
    DETAIL,
    /preview\s*\?\s*\[decision\.figure \?\? "Pathway", PREVIEW_PENDING_FIELD\]/,
    "a preview trace must stop at the routed figure plus a pending marker"
  );
  assert.match(
    DETAIL,
    /preview\s*\?\s*"Governed evaluation"\s*:\s*"Provisional outcome"/,
    "the final trace step must not be called an outcome in a preview"
  );
  assert.match(
    DETAIL,
    /isPreview && \(\s*<DrawerSection title="Governed evaluation">/,
    "a preview must show governed evaluation as pending, not as a result"
  );
  assert.match(
    DETAIL,
    /Pending — generated when this case is added to the Review Queue\./,
    "the preview must say when the governed evaluation happens"
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
