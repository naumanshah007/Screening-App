/**
 * Pull Cases preview must never present a Legacy clinical recommendation.
 *
 * THE DEFECT THIS LOCKS
 * ---------------------
 * /api/batch/process ran the legacy engine and returned its recommendation
 * straight to the Pull Cases UI. Nothing was persisted, so no governed
 * evaluation had happened — yet the screen showed an authoritative Legacy
 * decision (e.g. F10-CANCER-SYMPTOMS-URGENT-GYN) while the rest of the
 * application reported CG-NCSP-3.1.0 as the clinical authority.
 *
 * The endpoint now returns routing and validation only. The governed
 * recommendation is produced at persistence time by
 * saveBatchRun → evaluateGradedDecision.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const ROUTE = readFileSync(
  join(ROOT, "app", "api", "batch", "process", "route.ts"),
  "utf8"
);
const RUNS_ROUTE = readFileSync(
  join(ROOT, "app", "api", "batch", "runs", "route.ts"),
  "utf8"
);

test("the preview route does not return the raw engine result", () => {
  assert.doesNotMatch(
    ROUTE,
    /return NextResponse\.json\(result\)/,
    "the unredacted legacy engine result must never be returned to the client"
  );
  assert.match(
    ROUTE,
    /previewOnly: true/,
    "the response must declare itself a preview"
  );
});

test("the preview redacts the legacy recommendation server-side", () => {
  assert.match(
    ROUTE,
    /recommendation: PREVIEW_PENDING_TEXT/,
    "the legacy recommendation text must be replaced before leaving the server"
  );
  assert.match(
    ROUTE,
    /recommendationCode: PREVIEW_PENDING_CODE/,
    "the legacy recommendation code must be replaced before leaving the server"
  );
});

test("the preview implies no clinical action", () => {
  // A preview with a priority or a repeat interval reads as a decision even
  // without a recommendation string.
  assert.match(ROUTE, /referralPriority: null/, "no referral priority in a preview");
  assert.match(ROUTE, /referralType: null/, "no referral type in a preview");
  assert.match(ROUTE, /repeatInterval: null/, "no timing interval in a preview");
});

test("the preview route persists nothing and evaluates nothing governed", () => {
  // Strip comments first: the file legitimately *names* these in prose to
  // explain where governed evaluation happens. What must be absent is a call.
  const code = ROUTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(
    code,
    /saveBatchRun\(|evaluateGradedDecision\(|prisma\./,
    "the preview must remain side-effect free; governed evaluation happens on persistence"
  );
});

test("the persistence path still produces the governed recommendation", () => {
  // Guards against 'fixing' the preview by moving the defect into the save path.
  assert.match(
    RUNS_ROUTE,
    /saveBatchRun\(/,
    "adding to the Review Queue must go through saveBatchRun"
  );
});

test("the preview timestamp is generated at request time, not module load", () => {
  // A module-load timestamp was presented as the case's import time, making a
  // months-old record look freshly pulled.
  assert.match(
    ROUTE,
    /previewGeneratedAt: new Date\(\)\.toISOString\(\)/,
    "the preview must stamp when the preview was generated, inside the handler"
  );
});
