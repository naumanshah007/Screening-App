import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { evaluateClinicalDecision } from "../decision-engine";
import { applyGuidelineOverlay, overlayRelaxesSafety, type GuidelineOverlay } from "../overlay";
import { GUIDELINE_RULE_CATALOG } from "../rule-catalog";
import { baseInput } from "./helpers";

const here = dirname(fileURLToPath(import.meta.url));
const engineSource = readFileSync(join(here, "..", "decision-engine.ts"), "utf8");

// ── Invariant: no overlay (or disabled) === current engine behaviour ────────

test("no overlay leaves decisions identical", () => {
  const input = baseInput({ patientAge: 25, hpvResult: "NOT_DETECTED" });
  const withNone = evaluateClinicalDecision(input);
  assert.equal(withNone.recommendationCode, "F3-HPV-NOT-DETECTED-5Y");
  assert.equal(withNone.recallIntervalMonths, 60);
  assert.equal((withNone.branchPath ?? []).includes("ADMIN_OVERLAY_APPLIED"), false);
});

test("disabled overlay entry is a no-op", () => {
  const input = baseInput({ patientAge: 25, hpvResult: "NOT_DETECTED" });
  const overlay: GuidelineOverlay = {
    enabled: true,
    entries: { "F3-HPV-NOT-DETECTED-5Y": { disabled: true, recallIntervalMonths: 24 } },
  };
  const d = evaluateClinicalDecision(input, overlay);
  assert.equal(d.recallIntervalMonths, 60);
});

test("overlay disabled globally is a no-op", () => {
  const input = baseInput({ patientAge: 25, hpvResult: "NOT_DETECTED" });
  const overlay: GuidelineOverlay = { enabled: false, entries: { "F3-HPV-NOT-DETECTED-5Y": { recallIntervalMonths: 36 } } };
  assert.equal(evaluateClinicalDecision(input, overlay).recallIntervalMonths, 60);
});

// ── Allowed edits apply ─────────────────────────────────────────────────────

test("overlay can change a recall interval and wording", () => {
  const input = baseInput({ patientAge: 25, hpvResult: "NOT_DETECTED" });
  const overlay: GuidelineOverlay = {
    enabled: true,
    entries: { "F3-HPV-NOT-DETECTED-5Y": { recallIntervalMonths: 36, recommendation: "Local policy: 3-year recall." } },
  };
  const d = evaluateClinicalDecision(input, overlay);
  assert.equal(d.recallIntervalMonths, 36);
  assert.equal(d.nextScreeningIntervalMonths, 36);
  assert.equal(d.recommendation, "Local policy: 3-year recall.");
  assert.ok((d.branchPath ?? []).includes("ADMIN_OVERLAY_APPLIED"));
});

test("overlay can raise referral priority on a referring branch", () => {
  const input = baseInput({ patientAge: 30, hpvResult: "HPV_16_18" });
  const base = evaluateClinicalDecision(input);
  assert.equal(base.referralType, "COLPOSCOPY");
  const overlay: GuidelineOverlay = { enabled: true, entries: { [base.recommendationCode]: { referralPriority: "P1" } } };
  const d = evaluateClinicalDecision(input, overlay);
  assert.equal(d.referralPriority, "P1");
  assert.equal(d.referralType, "COLPOSCOPY"); // destination unchanged
});

test("overlay requireReview forces clinician review and never lowers risk", () => {
  const input = baseInput({ patientAge: 25, hpvResult: "NOT_DETECTED" });
  const overlay: GuidelineOverlay = { enabled: true, entries: { "F3-HPV-NOT-DETECTED-5Y": { requireReview: true } } };
  const d = evaluateClinicalDecision(input, overlay);
  assert.equal(d.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
  assert.equal(d.validationStatus, "REQUIRES_CLINICAL_CONFIRMATION");
  assert.equal(d.riskLevel, "HIGH"); // raised from LOW
});

test("overlay appends extra warnings without dropping existing ones", () => {
  const input = baseInput({ patientAge: 30, hpvResult: "HPV_16_18" }); // has a warning about cytology
  const base = evaluateClinicalDecision(input);
  const overlay: GuidelineOverlay = { enabled: true, entries: { [base.recommendationCode]: { extraWarnings: ["Local audit note"] } } };
  const d = evaluateClinicalDecision(input, overlay);
  assert.ok((d.clinicalWarnings ?? []).includes("Local audit note"));
  assert.ok((d.clinicalWarnings ?? []).length >= (base.clinicalWarnings ?? []).length + 1);
});

// ── Safety rails: overlay can never re-route or de-escalate ──────────────────

test("overlay cannot change figure or referral destination", () => {
  const input = baseInput({ patientAge: 30, hpvResult: "HPV_16_18" });
  const base = evaluateClinicalDecision(input);
  // Even if a malformed entry included disallowed fields, they are ignored by type + ALLOWED_FIELDS.
  const overlay = {
    enabled: true,
    entries: { [base.recommendationCode]: { referralPriority: "P2", figure: "FIGURE_1", referralType: "GYNAECOLOGY" } },
  } as unknown as GuidelineOverlay;
  const d = evaluateClinicalDecision(input, overlay);
  assert.equal(d.figure, base.figure);
  assert.equal(d.referralType, "COLPOSCOPY");
});

test("overlay cannot lower the risk level below the code default", () => {
  const input = baseInput({ patientAge: 30, hpvResult: "HPV_16_18" }); // HIGH
  const base = evaluateClinicalDecision(input);
  assert.equal(base.riskLevel, "HIGH");
  const overlay = { enabled: true, entries: { [base.recommendationCode]: { riskLevel: "LOW" } } } as unknown as GuidelineOverlay;
  const d = evaluateClinicalDecision(input, overlay);
  assert.equal(d.riskLevel, "HIGH");
});

test("overlayRelaxesSafety flags longer recall and lower priority", () => {
  const lowRecall = evaluateClinicalDecision(baseInput({ patientAge: 25, hpvResult: "NOT_DETECTED" }));
  assert.equal(overlayRelaxesSafety(lowRecall, { recallIntervalMonths: 84 }), true); // 84 > 60
  assert.equal(overlayRelaxesSafety(lowRecall, { recallIntervalMonths: 36 }), false);

  const referral = evaluateClinicalDecision(baseInput({ patientAge: 30, hpvResult: "HPV_16_18" }));
  assert.equal(overlayRelaxesSafety(referral, { referralPriority: "P4" }), true);
  assert.equal(overlayRelaxesSafety(referral, { requireReview: true }), false);
});

// ── Catalog drift guard: every catalog code must be real ─────────────────────

test("every catalog code exists as a literal in the engine (no phantoms/typos)", () => {
  for (const entry of GUIDELINE_RULE_CATALOG) {
    assert.ok(
      engineSource.includes(`"${entry.code}"`),
      `Catalog code ${entry.code} not found in decision-engine.ts`
    );
  }
});

test("catalog has no duplicate codes", () => {
  const codes = GUIDELINE_RULE_CATALOG.map((e) => e.code);
  assert.equal(new Set(codes).size, codes.length);
});

// ── applyGuidelineOverlay is pure (does not mutate input decision) ───────────

test("applyGuidelineOverlay does not mutate the input decision", () => {
  const base = evaluateClinicalDecision(baseInput({ patientAge: 25, hpvResult: "NOT_DETECTED" }));
  const snapshot = JSON.stringify(base);
  applyGuidelineOverlay(base, { enabled: true, entries: { [base.recommendationCode]: { recallIntervalMonths: 12 } } });
  assert.equal(JSON.stringify(base), snapshot);
});
