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

test("clinical governance and Production activation have a dedicated guarded workspace", () => {
  const sidebar = read("components/layout/Sidebar.tsx");
  const permissions = read("lib/auth/permissions.ts");
  const page = read("app/(app)/governance/clinical/page.tsx");
  const panel = read("components/clinical-rules/ActivationGovernancePanel.tsx");
  assert.ok(sidebar.includes('/governance/clinical", "Clinical Governance & Activation'));
  assert.ok(permissions.includes('prefix: "/governance/clinical"'));
  assert.ok(page.includes("CLINICAL_GOVERNANCE_CASES"));
  assert.ok(page.includes("ACTIVATION_GATE_DEFINITIONS"));
  assert.ok(page.includes("ClinicalRuleVersionActions"));
  assert.ok(panel.includes("Activate Production authority"));
  assert.ok(panel.includes("Roll back Production to Legacy"));
  assert.ok(panel.includes("REQUEST CHANGE"));
});

test("the app layout resolves authority for display", () => {
  const layout = read("app/(app)/layout.tsx");
  assert.ok(layout.includes("getClinicalAuthorityDisplay"));
  assert.ok(layout.includes("clinicalAuthority={clinicalAuthority}"));
});

test("the decision detail renders the authority comparison", () => {
  const detail = read("components/batch/BatchResultDetail.tsx");
  assert.ok(detail.includes("AuthorityComparison"));
  assert.ok(detail.includes("canonicalIsOperative"));
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

test("a legitimate live evaluation mode becomes the canonical primary card", () => {
  const comparison = read("components/clinical-rules/AuthorityComparison.tsx");
  assert.ok(comparison.includes("Provisional clinical recommendation"));
  assert.ok(comparison.includes("Technical provenance"));
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

/*
 * These assertions were rewritten when Guidelines became a server-rendered,
 * canonical-first surface. The GUARANTEES are unchanged and are now checked
 * where they actually live:
 *
 *   - the legacy router is still documented, but as technical provenance on its
 *     own route rather than as a tab a clinician must choose between;
 *   - authority still comes from resolved runtime state, now server-side via
 *     `getClinicalAuthorityDisplay()` instead of a client fetch of
 *     `/api/clinical-rules/status`;
 *   - the governed identifier and checksum are still shown, in the governance
 *     disclosure rather than the page header.
 */

test("the Guidelines surface separates governed guidance from the technical router", () => {
  const router = read("app/(app)/guidelines/technical-router/page.tsx");
  assert.ok(
    router.includes("Legacy pathway router reference"),
    "the legacy router reference must still exist"
  );
  assert.ok(
    router.includes("not present Legacy recommendation trees as current clinical guidance"),
    "the router page must keep its scope boundary"
  );

  const home = read("app/(app)/guidelines/GuidelinesHome.tsx");
  assert.ok(
    home.includes("/guidelines/technical-router"),
    "Guidelines must still reach the router reference"
  );
  assert.ok(
    home.includes("Legacy pathway router reference"),
    "the router reference must be named, not hidden"
  );
});

test("the Guidelines surface derives clinical authority from live state", () => {
  const catalogue = read("lib/clinical-rules/guideline-catalogue.ts");
  assert.ok(
    catalogue.includes("getClinicalAuthorityDisplay"),
    "authority must be resolved, never hard-coded"
  );
  assert.ok(
    catalogue.includes("isCanonicalOperative"),
    "canonical must only read as operative in a live evaluation mode"
  );
  assert.equal(
    /authorityEngine\s*[:=]\s*"CANONICAL"/.test(read("app/(app)/guidelines/GuidelinesHome.tsx")),
    false,
    "the Guidelines UI must not assert an authority engine of its own"
  );

  const home = read("app/(app)/guidelines/GuidelinesHome.tsx");
  assert.ok(home.includes("ClinicalAuthorityBadge"), "authority provenance must be displayed");
  assert.ok(home.includes("canonicalIsAuthoritative"), "the UI must react to real authority");
});

test("the Guidelines surface still exposes the governed ruleset identity", () => {
  const catalogue = read("lib/clinical-rules/guideline-catalogue.ts");
  assert.ok(catalogue.includes("CG-NCSP-3.1.0"), "the governed artefact must be named");

  const home = read("app/(app)/guidelines/GuidelinesHome.tsx");
  assert.ok(home.includes("Ruleset ID"), "the internal identifier must remain reachable");
  assert.ok(home.includes("checksum"), "the checksum must remain reachable");
  assert.ok(home.includes("Version history"), "version history must not be removed");
});

test("the Guidelines page links to Rule Studio for the canonical ruleset", () => {
  const home = read("app/(app)/guidelines/GuidelinesHome.tsx");
  assert.ok(home.includes("/rules/clinical"));
});

test("Guidelines renders governed pathways through the shared renderer", () => {
  // One graph system: Guidelines, Rule Studio and Case Review must not drift
  // back to separate renderers.
  const pathway = read("app/(app)/guidelines/[pathway]/page.tsx");
  assert.ok(pathway.includes("PathwayViewer"));
  assert.ok(pathway.includes("buildPathwayGraph"));

  const studio = read("app/(app)/rules/clinical/[id]/page.tsx");
  assert.ok(
    studio.includes("PathwayWorkspace"),
    "Rule Studio must use the shared renderer for its graph surface"
  );

  const evidence = read("components/batch/CanonicalShadowEvidence.tsx");
  assert.ok(
    evidence.includes("/guidelines/pathway-for-rule/"),
    "Case Review must open the governed pathway for its controlling rule"
  );
});

// ── 6. Display resolver is fail-safe ───────────────────────────────────────

test("the authority display resolver fails safe to LEGACY", () => {
  const display = read("lib/clinical-rules/authority-display.ts");
  assert.ok(display.includes("LEGACY_ONLY"));
  assert.ok(display.includes("catch"), "a display query must never break a clinical page");
});

// ── 7. Authority-bearing pages must never be served from a build-time render ─

test("pages that report clinical authority are force-dynamic", () => {
  // A statically rendered authority indicator would report whatever was true at
  // build time. On the Preview this made Rule Studio appear empty even after the
  // governed ruleset had been imported.
  for (const path of [
    "app/(app)/layout.tsx",
    "app/(app)/rules/clinical/page.tsx",
    "app/(app)/rules/clinical/[id]/page.tsx",
    // Guidelines became server-rendered and now reports resolved authority.
    "app/(app)/guidelines/page.tsx",
    "app/(app)/guidelines/[pathway]/page.tsx",
  ]) {
    assert.ok(
      read(path).includes('export const dynamic = "force-dynamic"'),
      `${path} must not be statically rendered: it reports live clinical authority state`
    );
  }
});
