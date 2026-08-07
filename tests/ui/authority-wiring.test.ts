/**
 * Proves the authority layer is actually REACHABLE from the running app, and
 * that nothing in the UI can imply canonical is authoritative while it is not.
 *
 * These are source-level structural assertions. They exist because the previous
 * phase built the components and the orchestrator but mounted neither, so every
 * behavioural test passed while the application was unchanged.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

// ── 1. The real execution path uses the orchestrator ───────────────────────

test("the pathway completion route invokes the authority orchestrator", () => {
  const route = read("app/api/pathway/sessions/[id]/complete/route.ts");
  assert.ok(
    route.includes("evaluateGradedDecision"),
    "the live clinical route must go through the authority path"
  );
});

test("the pathway route no longer calls the legacy engine directly", () => {
  const route = read("app/api/pathway/sessions/[id]/complete/route.ts");
  assert.equal(
    /evaluateClinicalDecision\s*\(/.test(route),
    false,
    "routing must happen inside the orchestrator, not be duplicated in the route"
  );
});

test("the orchestrator still calls the legacy router, and never bypasses it", () => {
  const orchestrator = read("lib/clinical-rules/graded-decision.ts");
  assert.ok(
    orchestrator.includes("evaluateClinicalDecision(args.input"),
    "the legacy router must run first for every evaluation"
  );
});

test("no route can select LIVE_PRODUCTION directly", () => {
  for (const path of [
    "app/api/pathway/sessions/[id]/complete/route.ts",
    "lib/clinical-rules/graded-decision.ts",
    "lib/batch/persistence.ts",
  ]) {
    assert.equal(
      /evaluationMode:\s*["'`]LIVE_PRODUCTION["'`]/.test(read(path)),
      false,
      `${path} must not hard-code LIVE_PRODUCTION`
    );
  }
});

// ── 2. The authority UI is mounted ─────────────────────────────────────────

test("the persistent authority indicator is mounted in the sidebar", () => {
  const sidebar = read("components/layout/Sidebar.tsx");
  assert.ok(sidebar.includes("ActiveClinicalAuthorityIndicator"));
  assert.ok(sidebar.includes("clinicalAuthority"));
});

test("the app layout resolves authority for display", () => {
  const layout = read("app/(app)/layout.tsx");
  assert.ok(layout.includes("getClinicalAuthorityDisplay"));
  assert.ok(layout.includes("clinicalAuthority={clinicalAuthority}"));
});

test("the decision detail renders the authority comparison", () => {
  const detail = read("components/batch/BatchResultDetail.tsx");
  assert.ok(detail.includes("AuthorityComparison"));
  assert.ok(detail.includes("canonicalStatus=\"DRAFT\""));
});

// ── 3. The UI cannot imply canonical is active ─────────────────────────────

test("the authority badge only shows canonical for a live evaluation mode", () => {
  const badge = read("components/clinical-rules/ClinicalAuthorityBadge.tsx");
  // Canonical is displayed as the authority only when BOTH the engine is
  // canonical AND the evaluation mode is operative.
  assert.ok(badge.includes('evaluationMode === "LIVE_PRODUCTION" || evaluationMode === "LIVE_DEMO"'));
  assert.ok(badge.includes("isCanonicalAuthority && isOperative"));
});

test("no UI component labels a DRAFT canonical ruleset as ACTIVE or PUBLISHED", () => {
  for (const path of [
    "components/clinical-rules/ClinicalAuthorityBadge.tsx",
    "components/clinical-rules/AuthorityComparison.tsx",
  ]) {
    const source = read(path);
    // The words may appear as data (a status value passed in) but must never be
    // a hard-coded label the component asserts about canonical.
    assert.equal(
      /(ACTIVE|PUBLISHED|AUTHORITATIVE)\s*<\/span>/.test(source.replace(/\{[^}]*\}/g, "")),
      false,
      `${path} must not hard-code an active/published canonical label`
    );
  }
});

test("the comparison labels the canonical block as not authoritative", () => {
  const comparison = read("components/clinical-rules/AuthorityComparison.tsx");
  assert.ok(comparison.includes("Canonical shadow — not authoritative"));
  assert.ok(comparison.includes("Authoritative decision"));
  assert.ok(comparison.includes("Legacy engine"));
});

test("legacy and canonical recommendations render in separate blocks", () => {
  const comparison = read("components/clinical-rules/AuthorityComparison.tsx");
  assert.ok(comparison.includes("legacy.recommendation"));
  assert.ok(comparison.includes("shadow.provisionalRecommendation"));
  assert.ok(comparison.includes("Shadow difference detected"));
});

test("an unexpected live evaluation mode is surfaced, not hidden", () => {
  const comparison = read("components/clinical-rules/AuthorityComparison.tsx");
  assert.ok(comparison.includes("Unexpected live mode"));
});

// ── 4. Timing UX (Phase 7) ─────────────────────────────────────────────────

test("the comparison never fabricates a due date", () => {
  const comparison = read("components/clinical-rules/AuthorityComparison.tsx");
  assert.ok(comparison.includes("isAutomaticallySchedulable"));
  assert.ok(comparison.includes("Clinician timing required"));
  // The raw governed text is retained for the reviewer.
  assert.ok(comparison.includes("source states"));
});

test("a non-schedulable timing is never rendered as a blank", () => {
  const comparison = read("components/clinical-rules/AuthorityComparison.tsx");
  // Every branch of TimingLine returns visible text.
  assert.ok(comparison.includes("Follow-up: not stated by this rule"));
});

// ── 5. Guidelines labelling (Phase 4) ──────────────────────────────────────

test("the Guidelines page names the rules system behind each tab", () => {
  const guidelines = read("app/(app)/guidelines/page.tsx");
  assert.ok(guidelines.includes("Operational referral grading · Case Rule Release"));
  assert.ok(guidelines.includes("Legacy pathway router reference"));
});

test("the Guidelines page states CG-NCSP-3.1.0 is DRAFT and not represented there", () => {
  const guidelines = read("app/(app)/guidelines/page.tsx");
  assert.ok(guidelines.includes("CG-NCSP-3.1.0"));
  assert.ok(guidelines.includes("DRAFT · shadow/simulation only"));
  assert.ok(
    guidelines.includes("not represented on this page"),
    "the page must not let a reader assume these trees are the canonical ruleset"
  );
});

test("the Guidelines page links to Rule Studio for the canonical ruleset", () => {
  const guidelines = read("app/(app)/guidelines/page.tsx");
  assert.ok(guidelines.includes("/rules/clinical"));
});

// ── 6. Display resolver is fail-safe ───────────────────────────────────────

test("the authority display resolver fails safe to LEGACY", () => {
  const display = read("lib/clinical-rules/authority-display.ts");
  assert.ok(display.includes("LEGACY_ONLY"));
  assert.ok(display.includes("catch"), "a display query must never break a clinical page");
});
