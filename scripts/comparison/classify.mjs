/**
 * Three-way clinical comparison classifier.
 *
 * Joins System A (reproduced production fb933c3), System B (candidate legacy
 * 8eed086) and System C (CG-NCSP-3.1.0 SIMULATION) on the independent
 * 179-case source oracle and assigns exactly one primary classification per
 * case, plus secondary flags.
 *
 * Expected outcomes come only from the oracle. No expected value is derived
 * from any of the three systems.
 */

import { readFileSync, writeFileSync } from "node:fs";

const SP = "/private/tmp/claude-501/-Users-nauman-Documents-Screening/50a6cb2d-2867-47c1-b165-ef025e51c769/scratchpad";

const A = JSON.parse(readFileSync(`${SP}/system-a.json`, "utf8"));
const B = JSON.parse(readFileSync(`${SP}/system-b.json`, "utf8"));
const C = JSON.parse(readFileSync(`${SP}/system-c.json`, "utf8"));

// ── Explicit alias registry ────────────────────────────────────────────────
// Only presentation-level synonyms. Every pair the brief forbids conflating is
// deliberately ABSENT, and asserted absent below.
const ALIASES = {
  SPECIALIST_FOLLOW_UP: ["SPECIALIST_FOLLOW_UP", "COLPOSCOPY"],
  COMMUNITY_TOC: ["COMMUNITY_TOC", "TEST_OF_CURE"],
  NO_MDM_CONTINUE_F4: ["NO_MDM_CONTINUE_F4", "REPEAT_HPV", "SECOND_REPEAT_HPV"],
  NO_COLPOSCOPY: ["NO_COLPOSCOPY", "ROUTINE_SCREENING", "ROUTINE_RECALL"],
  GLANDULAR_SPECIALIST_ROUTE: ["GLANDULAR_SPECIALIST_ROUTE", "COLPOSCOPY"],
};

// Non-equivalences that must never be collapsed, per the comparison brief.
const FORBIDDEN_PAIRS = [
  ["COLPOSCOPY", "URGENT_COLPOSCOPY"],
  ["GYNAECOLOGY", "URGENT_GYNAECOLOGY"],
  ["FIGURE_5_COTEST_SURVEILLANCE", "TEST_OF_CURE"],
  ["TREATMENT", "TOC_COMPLETE"],
  ["MANDATORY_REVIEWER_CONFIRMATION", "CLINICIAN_ONLY"],
  ["ROUTINE_RECALL", "NO_FURTHER_SCREENING"],
];

for (const [x, y] of FORBIDDEN_PAIRS) {
  const xs = ALIASES[x] ?? [x];
  const ys = ALIASES[y] ?? [y];
  if (xs.includes(y) || ys.includes(x)) {
    throw new Error(`Alias registry violates a required non-equivalence: ${x} <-> ${y}`);
  }
}

const matches = (expected, actual) => {
  if (expected === actual) return true;
  return (ALIASES[expected] ?? []).includes(actual);
};
const matchesAny = (expected, actualList) => actualList.some((a) => matches(expected, a));

const byId = (payload) => new Map(payload.emissions.map((e) => [e.caseId, e]));
const a = byId(A), b = byId(B), c = byId(C);

const CATEGORIES = [
  "THREE_WAY_EXACT_AGREEMENT",
  "PRODUCTION_AND_CURRENT_LEGACY_AGREE",
  "PRODUCTION_DIFFERS_FROM_CURRENT_LEGACY",
  "CANDIDATE_FIXES_CONFIRMED_LEGACY_DEFECT",
  "CANDIDATE_ADDS_PREVIOUSLY_UNSUPPORTED_STATE",
  "CANDIDATE_SAFETY_IMPROVEMENT",
  "PRESENTATION_ALIAS_ONLY",
  "DEPLOYED_INPUT_CONTRACT_GAP",
  "GOV04_CLINICIAN_ONLY_OVERRESTRICTION",
  "CANDIDATE_REGRESSION",
  "SOURCE_ORACLE_CONFLICT",
  "REQUIRES_CLINICAL_REVIEW",
  "UNEXPLAINED",
];

const rows = [];

for (const [caseId, ao] of a) {
  const bo = b.get(caseId);
  const co = c.get(caseId);
  const expected = ao.expectedActionClass;

  const aClass = ao.actual?.actionClass ?? null;
  const bClass = bo?.actual?.actionClass ?? null;
  const cClasses = co?.actionClasses ?? [];

  const aOk = ao.executable && matches(expected, aClass);
  const bOk = bo?.executable && matches(expected, bClass);
  const cOk = co?.executable && matchesAny(expected, cClasses);

  const abIdentical = ao.executable && bo?.executable && aClass === bClass;
  const abEquivalent = ao.executable && bo?.executable && (aClass === bClass || matches(aClass, bClass) || matches(bClass, aClass));

  const flags = [];
  let primary;

  if (!ao.executable) {
    // Production cannot express this state at all.
    if (cOk) primary = "CANDIDATE_ADDS_PREVIOUSLY_UNSUPPORTED_STATE";
    else primary = "DEPLOYED_INPUT_CONTRACT_GAP";
    flags.push("DEPLOYED_INPUT_CONTRACT_GAP");
    if (!bo?.executable) flags.push("CURRENT_LEGACY_ALSO_CANNOT_EXPRESS");
  } else if (!abIdentical && !abEquivalent) {
    primary = "PRODUCTION_DIFFERS_FROM_CURRENT_LEGACY";
    if (aOk && !bOk) flags.push("CANDIDATE_REGRESSION_VS_PRODUCTION");
    if (!aOk && bOk) flags.push("CURRENT_LEGACY_CORRECTS_PRODUCTION");
  } else if (aOk && bOk && cOk) {
    primary = abIdentical ? "THREE_WAY_EXACT_AGREEMENT" : "PRESENTATION_ALIAS_ONLY";
  } else if (aOk && bOk && !cOk) {
    // Both legacy engines match the source; canonical does not.
    const cSafety = co?.actual?.provisionalRecommendation ?? "";
    if (/insufficient|missing|obtain/i.test(cSafety) || (co?.actual?.missingInformation ?? []).length > 0) {
      primary = "CANDIDATE_SAFETY_IMPROVEMENT";
      flags.push("CANONICAL_STOPS_WHERE_LEGACY_ACTS");
    } else if (co?.actual?.clinicianOnly) {
      primary = "GOV04_CLINICIAN_ONLY_OVERRESTRICTION";
    } else {
      primary = "CANDIDATE_REGRESSION";
    }
  } else if (!aOk && !bOk && cOk) {
    primary = "CANDIDATE_FIXES_CONFIRMED_LEGACY_DEFECT";
    flags.push("CONFIRMED_LEGACY_DEFECT_PRESENT_IN_PRODUCTION");
  } else if (!aOk && !bOk && !cOk) {
    primary = "REQUIRES_CLINICAL_REVIEW";
    flags.push("NO_SYSTEM_MATCHES_SOURCE");
  } else {
    primary = "UNEXPLAINED";
  }

  if (co?.actual?.clinicianOnly && !ao.expectedClinicianOnly && primary !== "GOV04_CLINICIAN_ONLY_OVERRESTRICTION") {
    flags.push("GOV04_CLINICIAN_ONLY_OVERRESTRICTION_SECONDARY");
  }

  rows.push({
    caseId,
    figureOrTable: ao.figureOrTable,
    page: ao.page,
    recommendationNumbers: ao.recommendationNumbers,
    expectedActionClass: expected,
    productionExecutable: ao.executable,
    productionActionClass: aClass,
    productionCode: ao.actual?.recommendationCode ?? null,
    productionRisk: ao.actual?.riskLevel ?? null,
    productionSafetyOutcome: ao.actual?.safetyOutcome ?? null,
    currentLegacyExecutable: Boolean(bo?.executable),
    currentLegacyActionClass: bClass,
    currentLegacyCode: bo?.actual?.recommendationCode ?? null,
    canonicalActionClasses: cClasses,
    canonicalRecommendation: co?.actual?.provisionalRecommendation ?? null,
    canonicalTiming: co?.actual?.repeatInterval ?? null,
    canonicalDestination: co?.actual?.referralDestination ?? null,
    canonicalReviewerRequirement: co?.actual?.reviewerRequirement ?? null,
    canonicalClinicianOnly: Boolean(co?.actual?.clinicianOnly),
    canonicalMatchedRule: (co?.actual?.matchedRuleIds ?? [])[0] ?? null,
    productionMatchesSource: aOk,
    currentLegacyMatchesSource: bOk,
    canonicalMatchesSource: cOk,
    classification: primary,
    flags,
  });
}

const totals = Object.fromEntries(CATEGORIES.map((k) => [k, rows.filter((r) => r.classification === k).length]));

const summary = {
  generatedAt: new Date().toISOString(),
  systems: { A: A.system, B: B.system, C: C.system },
  canonicalChecksum: C.rulesetChecksum,
  canonicalEvaluationMode: C.evaluationMode,
  corpusSize: rows.length,
  productionExecutable: rows.filter((r) => r.productionExecutable).length,
  productionInputContractGaps: rows.filter((r) => !r.productionExecutable).length,
  sourceAgreement: {
    productionMatchesSource: rows.filter((r) => r.productionMatchesSource).length,
    currentLegacyMatchesSource: rows.filter((r) => r.currentLegacyMatchesSource).length,
    canonicalMatchesSource: rows.filter((r) => r.canonicalMatchesSource).length,
  },
  productionVsCurrentLegacy: {
    identical: rows.filter((r) => r.productionExecutable && r.currentLegacyExecutable && r.productionActionClass === r.currentLegacyActionClass).length,
    differing: rows.filter((r) => r.classification === "PRODUCTION_DIFFERS_FROM_CURRENT_LEGACY").length,
  },
  totals,
};

writeFileSync(`${SP}/three-way-results.json`, JSON.stringify({ summary, rows }, null, 2));

const header = Object.keys(rows[0]).join(",");
const csv = [header, ...rows.map((r) => Object.values(r).map((v) => {
  const s = Array.isArray(v) ? v.join(" | ") : String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(","))].join("\n");
writeFileSync(`${SP}/three-way-results.csv`, csv);

console.log(JSON.stringify(summary, null, 2));
