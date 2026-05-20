/**
 * Safety-wording guard tests.
 *
 * These tests pin down the critical safety labels so that risky wording
 * does not regress into the product. They scan rendered-component-source
 * files in the batch surface for forbidden strings.
 *
 * If you genuinely need to change the wording (e.g. translation, rephrasing),
 * update both the file AND this test together — that is the point.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

// ─── Forbidden phrases ──────────────────────────────────────────────────────

const FORBIDDEN_IN_BATCH_UI: Array<{ phrase: string; reason: string }> = [
  { phrase: "Batch Decision Engine", reason: "implies autonomous engine; use 'Batch Decision Support'" },
  { phrase: "automated pass",        reason: "implies autonomous processing; use 'provisional batch recommendations'" },
  { phrase: "need action today",     reason: "implies autonomous prioritisation; use 'provisional priority for reviewer'" },
  { phrase: "Configuration Ready",   reason: "overclaims connector readiness; use 'Adapter pattern defined · not connected'" },
  { phrase: "production ready",      reason: "this is a prototype under clinical validation" },
  { phrase: "production-ready",      reason: "this is a prototype under clinical validation" },
  { phrase: "automated clinical decision", reason: "this is decision support, not autonomous care" },
];

const BATCH_UI_FILES = [
  "app/(app)/batch/BatchPageClient.tsx",
  "components/batch/BatchActionQueue.tsx",
  "components/batch/BatchDataTable.tsx",
  "components/batch/BatchEngineTrustPanel.tsx",
  "components/batch/BatchResultDetail.tsx",
  "components/batch/BatchValidationPreview.tsx",
  "components/batch/IntegrationReadinessPanel.tsx",
  "lib/batch/integration-types.ts",
];

for (const file of BATCH_UI_FILES) {
  test(`safety-wording: ${file} avoids forbidden phrases`, () => {
    const contents = read(file);
    for (const { phrase, reason } of FORBIDDEN_IN_BATCH_UI) {
      assert.equal(
        contents.includes(phrase),
        false,
        `${file} contains forbidden phrase "${phrase}" — ${reason}`
      );
    }
  });
}

// ─── Required safety language must be present somewhere in the batch UI ────

const REQUIRED_LANGUAGE: Array<{ phrase: string; files: string[] }> = [
  { phrase: "Provisional",                files: ["components/batch/BatchValidationPreview.tsx", "components/batch/BatchResultDetail.tsx"] },
  { phrase: "Reviewer confirmation",      files: ["components/batch/BatchEngineTrustPanel.tsx"] },
  { phrase: "reviewer confirmation",      files: ["components/batch/BatchValidationPreview.tsx"] },
  { phrase: "Not for direct clinical action", files: ["components/batch/BatchValidationPreview.tsx", "components/batch/BatchResultDetail.tsx"] },
  { phrase: "Decision-support",           files: ["components/batch/BatchResultDetail.tsx"] },
  { phrase: "Batch Decision Support",     files: ["app/(app)/batch/BatchPageClient.tsx"] },
];

for (const { phrase, files } of REQUIRED_LANGUAGE) {
  for (const file of files) {
    test(`safety-wording: ${file} contains required phrase "${phrase}"`, () => {
      const contents = read(file);
      assert.ok(
        contents.includes(phrase),
        `${file} should contain "${phrase}" as a reviewer/safety affordance`
      );
    });
  }
}

// ─── Integration panel must flag not-connected status ──────────────────────

test("integration panel makes 'not connected to live systems' explicit", () => {
  const panel = read("components/batch/IntegrationReadinessPanel.tsx");
  assert.ok(
    panel.includes("Not connected") || panel.includes("not connected"),
    "IntegrationReadinessPanel must explicitly say connectors are not connected to live systems"
  );
});

test("connector status label rebrands 'configuration ready' as 'adapter defined · not connected'", () => {
  const types = read("lib/batch/integration-types.ts");
  assert.ok(types.includes("Adapter pattern defined"));
  assert.ok(types.includes("not connected"));
  assert.equal(types.includes('"configuration_ready"'), false);
});
