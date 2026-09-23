/**
 * Decision adapter safety properties.
 *
 * The adapter is the only place a canonical result becomes the ClinicalDecision
 * the application acts on. These tests assert it cannot re-route, cannot
 * silently produce a null recall date, cannot turn the implementation's safety
 * severity into a participant's clinical risk, and cannot let a legacy referral,
 * priority or risk floor survive underneath a governed result.
 */

import test from "node:test";
import assert from "node:assert/strict";

import type { ClinicalDecision } from "../../engine/types";
import type { ClinicalEvaluationResult } from "../evaluator";
import { canonicalToClinicalDecision, findDeEscalations } from "../decision-adapter";
import { loadGovernedSnapshot } from "../governed-snapshot-store";
import { classifyTiming, isAutomaticallySchedulable } from "../governed-vocabulary";

function legacy(overrides: Partial<ClinicalDecision> = {}): ClinicalDecision {
  return {
    figure: "FIGURE_3",
    riskLevel: "LOW",
    recommendation: "Legacy recommendation",
    recommendationCode: "F3-HPV-NOT-DETECTED-5Y",
    nextAction: "Legacy next action",
    ...overrides,
  };
}

function canonical(overrides: Partial<ClinicalEvaluationResult> = {}): ClinicalEvaluationResult {
  return {
    ruleSetId: "rs",
    ruleVersionId: "rv",
    ruleVersionDisplay: "CG-NCSP-3.1.0",
    ruleSetChecksum: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    engineVersion: "canonical-graph-v2",
    matchedRuleIds: ["F3-01"],
    branchPath: ["node:root", "node:rule:F3-01"],
    provisionalRecommendation: "Canonical recommendation",
    safetyPriority: "LOW",
    riskLevel: "LOW",
    urgency: undefined,
    referralDestination: "Primary/community care or programme follow-up",
    repeatInterval: "5 years",
    missingInformation: [],
    mandatoryReviewerConfirmation: true,
    reviewerRequirement: "CLINICIAN_REVIEW",
    clinicianOnly: false,
    sourceReferences: [{ document: "NCSP", reference: "Figure 3" }],
    safetyNotices: [],
    ...overrides,
  };
}

// ── Routing is never adapted ────────────────────────────────────────────────

test("the adapter never changes the pathway chosen by the legacy router", () => {
  for (const figure of ["FIGURE_1", "FIGURE_7", "FIGURE_9", "FIGURE_10", "TABLE_1"] as const) {
    const { decision } = canonicalToClinicalDecision({
      canonical: canonical(),
      legacyDecision: legacy({ figure }),
    });
    assert.equal(decision.figure, figure);
    assert.deepEqual(findDeEscalations(decision, legacy({ figure })), []);
  }
});

test("the adapted branch path records the router prefix before the canonical path", () => {
  const { decision } = canonicalToClinicalDecision({
    canonical: canonical(),
    legacyDecision: legacy({ figure: "FIGURE_3", recommendationCode: "F3-1618-COLP" }),
    evaluationId: "eval-1",
  });
  assert.equal(decision.branchPath?.[0], "router:FIGURE_3");
  assert.equal(decision.branchPath?.[1], "router:F3-1618-COLP");
  assert.ok(decision.branchPath?.includes("node:rule:F3-01"));
  assert.ok(decision.branchPath?.includes("evaluation:eval-1"));
});

// ── Never de-escalate ───────────────────────────────────────────────────────

test("risk stays the router's own value and canonical never moves it", () => {
  const legacyUrgent = legacy({ riskLevel: "URGENT" });
  const { decision } = canonicalToClinicalDecision({
    canonical: canonical({ riskLevel: "LOW" }),
    legacyDecision: legacyUrgent,
  });
  assert.equal(decision.riskLevel, "URGENT");
  assert.deepEqual(findDeEscalations(decision, legacyUrgent), []);
});

test("a canonical non-referral destination does not inherit the legacy referral", () => {
  // Canonical is the authority for the decision. A legacy referral surviving
  // underneath it produced a governed-looking result whose referral, type and
  // priority all came from an engine that did not decide.
  const legacyReferral = legacy({
    referralRequired: true,
    referralType: "COLPOSCOPY",
    referralPriority: "P1",
  });
  const { decision } = canonicalToClinicalDecision({
    canonical: canonical({ referralDestination: "Primary/community care" }),
    legacyDecision: legacyReferral,
  });
  assert.equal(decision.referralRequired, false);
  assert.equal(decision.referralType, undefined);
  assert.equal(decision.referralPriority, undefined);
});

test("a governed safety stop carries no referral, priority or recall from legacy", () => {
  const legacyReferral = legacy({
    riskLevel: "HIGH",
    referralRequired: true,
    referralType: "COLPOSCOPY",
    referralPriority: "P2",
    recallIntervalMonths: 12,
  });
  const { decision, canonicalStopped } = canonicalToClinicalDecision({
    canonical: canonical({ matchedRuleIds: [], referralDestination: "Colposcopy service" }),
    legacyDecision: legacyReferral,
  });
  assert.equal(canonicalStopped, true);
  assert.equal(decision.referralRequired, false, "a stop reached no referral");
  assert.equal(decision.referralPriority, undefined, "a legacy P2 must not survive a stop");
  assert.equal(decision.recallRequired, false);
  assert.equal(decision.recallIntervalMonths, undefined);
  assert.equal(decision.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
});

test("referral priority comes from the governed urgency, not from a legacy floor", () => {
  const legacyP1 = legacy({ referralRequired: true, referralType: "COLPOSCOPY", referralPriority: "P1" });
  const { decision } = canonicalToClinicalDecision({
    // "5 years" is ROUTINE, which maps to P3.
    canonical: canonical({ referralDestination: "Colposcopy service", repeatInterval: "5 years" }),
    legacyDecision: legacyP1,
  });
  assert.equal(decision.referralPriority, "P3");
});

test("the implementation safety severity never becomes the participant's risk", () => {
  // CRITICAL means "a software mistake in this rule would be dangerous" — most
  // often that no governed rule covers the case at all. Mapping it to URGENT
  // turned a coverage gap into an urgent patient.
  const { decision, safetyPriority } = canonicalToClinicalDecision({
    canonical: canonical({
      safetyPriority: "CRITICAL",
      riskLevel: "CRITICAL",
      referralDestination: "Colposcopy service",
      repeatInterval: "12 months",
    }),
    legacyDecision: legacy({ riskLevel: "LOW" }),
  });
  assert.equal(decision.riskLevel, "LOW", "risk stays the router's; canonical states no patient risk");
  assert.notEqual(decision.riskLevel, "URGENT");
  assert.equal(safetyPriority, "CRITICAL", "the severity is still recorded, as technical evidence");
});

test("an unresolved conditional urgent limb is explained, not applied", () => {
  const { decision, adapterNotices } = canonicalToClinicalDecision({
    canonical: canonical({
      referralDestination: "Colposcopy service",
      repeatInterval:
        "20 or 30 working days according to risk/history; urgent if invasive cytology",
      unresolvedUrgentLimb: true,
    }),
    legacyDecision: legacy({ referralRequired: true, referralPriority: "P2" }),
  });
  assert.equal(decision.referralPriority, undefined, "no urgency was established, so no priority");
  assert.ok(
    adapterNotices.some((notice) => notice.includes("urgent limb")),
    "the evidence must say why no urgency was applied"
  );
});

test("findDeEscalations guards routing, which is the only thing legacy supplies", () => {
  assert.deepEqual(
    findDeEscalations(legacy({ figure: "FIGURE_1" }), legacy({ figure: "FIGURE_3" })),
    ["pathway changed FIGURE_3 → FIGURE_1"]
  );
  // Risk, priority and referral are deliberately no longer compared: all three
  // are governed outputs now, and comparing them reinstated the legacy floor
  // through the back door.
  assert.deepEqual(
    findDeEscalations(legacy({ riskLevel: "LOW" }), legacy({ riskLevel: "HIGH" })),
    []
  );
  assert.deepEqual(
    findDeEscalations(legacy({ referralPriority: "P3" }), legacy({ referralPriority: "P1" })),
    []
  );
  assert.deepEqual(
    findDeEscalations(legacy({ referralRequired: false }), legacy({ referralRequired: true })),
    []
  );
});

// ── Recall dates are never silently null ────────────────────────────────────

test("an exact interval produces a recall in whole months", () => {
  const { decision, timingRequiresClinicianDetermination } = canonicalToClinicalDecision({
    canonical: canonical({ repeatInterval: "5 years" }),
    legacyDecision: legacy(),
  });
  assert.equal(decision.recallRequired, true);
  assert.equal(decision.recallIntervalMonths, 60);
  assert.equal(decision.nextScreeningIntervalMonths, 60);
  assert.equal(timingRequiresClinicianDetermination, false);
});

test("a non-schedulable timing sets NO recall date and raises a clinician determination", () => {
  for (const literal of [
    "6-8 weeks", // RANGE
    "6 and 18 months", // MULTI_EVENT
    "6 months post-treatment", // EVENT_RELATIVE
    "5 years or 3 years if immune deficient", // CONDITIONAL
  ]) {
    const { decision, timingRequiresClinicianDetermination, adapterNotices } =
      canonicalToClinicalDecision({
        canonical: canonical({ repeatInterval: literal }),
        legacyDecision: legacy(),
      });
    assert.equal(decision.recallIntervalMonths, undefined, `${literal} must not produce a recall interval`);
    assert.equal(decision.recallRequired, false);
    assert.equal(timingRequiresClinicianDetermination, true, `${literal} must require clinician determination`);
    assert.equal(decision.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
    assert.ok(
      adapterNotices.some((notice) => notice.includes(literal)),
      `${literal} must be explained in the adapter notices`
    );
  }
});

test("an unmapped timing literal is a safety stop, never a default interval", () => {
  const { decision, adapterNotices } = canonicalToClinicalDecision({
    canonical: canonical({ repeatInterval: "sometime soon" }),
    legacyDecision: legacy(),
  });
  assert.equal(decision.recallIntervalMonths, undefined);
  assert.equal(decision.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
  assert.ok(adapterNotices.some((notice) => notice.includes("Unmapped governed timingDestination")));
});

test("an unmapped care setting routes to reviewer workflow, never to a referral", () => {
  const { decision, adapterNotices } = canonicalToClinicalDecision({
    canonical: canonical({ referralDestination: "the clinic down the road" }),
    legacyDecision: legacy(),
  });
  assert.equal(decision.referralType, undefined);
  assert.ok(adapterNotices.some((notice) => notice.includes("Unmapped governed careSetting")));
});

// ── Safety stops ────────────────────────────────────────────────────────────

test("missing information becomes an INSUFFICIENT_INFORMATION stop", () => {
  const { decision } = canonicalToClinicalDecision({
    canonical: canonical({ missingInformation: ["preTreatmentHpvGenotype"], matchedRuleIds: [] }),
    legacyDecision: legacy(),
  });
  assert.equal(decision.safetyOutcome, "INSUFFICIENT_INFORMATION");
  assert.deepEqual(decision.missingInformation, ["preTreatmentHpvGenotype"]);
});

test("no matched rule yields an explicit safety-stop code, never an empty code", () => {
  const { decision } = canonicalToClinicalDecision({
    canonical: canonical({ matchedRuleIds: [] }),
    legacyDecision: legacy(),
  });
  assert.equal(decision.recommendationCode, "CANONICAL-SAFETY-STOP");
  assert.equal(decision.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
});

test("every canonical decision requires clinical confirmation", () => {
  const { decision } = canonicalToClinicalDecision({
    canonical: canonical(),
    legacyDecision: legacy(),
  });
  assert.equal(decision.validationStatus, "REQUIRES_CLINICAL_CONFIRMATION");
});

test("provenance carries the canonical version and checksum prefix", () => {
  const { decision } = canonicalToClinicalDecision({
    canonical: canonical(),
    legacyDecision: legacy(),
  });
  assert.equal(decision.ruleVersion, "CG-NCSP-3.1.0");
  assert.match(decision.rationale ?? "", /canonical CG-NCSP-3\.1\.0/);
  assert.match(decision.rationale ?? "", /legacy router/);
});

// ── Whole-snapshot property ─────────────────────────────────────────────────

test("no rule in the governed snapshot can produce a recall date it did not state", async () => {
  const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");
  for (const rule of snapshot.rules) {
    const { decision } = canonicalToClinicalDecision({
      canonical: canonical({
        matchedRuleIds: [rule.stableRuleId],
        repeatInterval: rule.timingDestination,
        referralDestination: rule.careSetting,
      }),
      legacyDecision: legacy(),
    });
    const classification = classifyTiming(rule.timingDestination);
    if (isAutomaticallySchedulable(classification)) continue;
    assert.equal(
      decision.recallIntervalMonths,
      undefined,
      `${rule.stableRuleId} (${JSON.stringify(rule.timingDestination)}) produced a recall interval it does not state`
    );
  }
});

test("no rule in the governed snapshot re-routes a case off its legacy pathway", async () => {
  const snapshot = loadGovernedSnapshot("cg-ncsp-3.1.0");
  const legacyHigh = legacy({
    riskLevel: "URGENT",
    referralRequired: true,
    referralType: "COLPOSCOPY",
    referralPriority: "P1",
  });
  for (const rule of snapshot.rules) {
    const { decision } = canonicalToClinicalDecision({
      canonical: canonical({
        matchedRuleIds: [rule.stableRuleId],
        riskLevel: rule.safetyPriority,
        repeatInterval: rule.timingDestination,
        referralDestination: rule.careSetting,
      }),
      legacyDecision: legacyHigh,
    });
    assert.deepEqual(
      findDeEscalations(decision, legacyHigh),
      [],
      `${rule.stableRuleId} moved the case off its legacy pathway`
    );
  }
});
