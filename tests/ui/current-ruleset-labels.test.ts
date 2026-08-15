/**
 * Clinician-facing authority wording must match reality.
 *
 * The dashboard previously said "not clinically authoritative" unconditionally.
 * Once CG-NCSP-3.1.0 became operative that sentence was false — it decides new
 * cases. These assertions lock the wording to the operative flag so the panel
 * cannot drift back into misdescribing the live system.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PANEL = readFileSync(
  join(ROOT, "components", "dashboard", "RulesetStatusPanel.tsx"),
  "utf8"
);

test("the non-authoritative claim is conditional on the operative flag", () => {
  assert.match(
    PANEL,
    /canonicalIsOperative[\s\S]{0,200}not clinically authoritative/,
    "the panel must only claim non-authoritative when the ruleset is not operative"
  );
  // The phrase may only appear as the false branch of the operative ternary.
  assert.match(
    PANEL,
    /canonicalIsOperative\s*\?\s*`\$\{modeLabel\} · deciding new cases`\s*:\s*`\$\{modeLabel\} · not clinically authoritative`/,
    "the wording must be selected by the operative flag, not stated outright"
  );
});

test("an operative governed ruleset is described in clinician-facing terms", () => {
  // "Canonical" is an internal architecture word; it must not be what a
  // clinician reads as the current authority.
  assert.match(
    PANEL,
    /"Current governed rules"/,
    "an operative ruleset must be labelled with clinician-facing wording"
  );
  assert.doesNotMatch(
    PANEL,
    /`Canonical \$\{authority\.canonicalVersion\}`/,
    "the current authority must not be labelled with the internal engine name"
  );
});

test("the evaluation heading switches when the ruleset is operative", () => {
  assert.match(
    PANEL,
    /canonicalIsOperative \? "Current ruleset" : "Ruleset evaluation"/,
    "the heading must distinguish the operative ruleset from a non-operative evaluation"
  );
});

test("operative means canonical authority plus a live evaluation mode", () => {
  // Guards the definition itself: a SHADOW or SIMULATION mode must never be
  // treated as operative, regardless of the resolved engine.
  assert.match(
    PANEL,
    /authority\.authorityEngine === "CANONICAL"[\s\S]{0,160}LIVE_PRODUCTION[\s\S]{0,60}LIVE_DEMO/,
    "operative must require canonical authority and a live evaluation mode"
  );
});
