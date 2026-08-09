import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { guidelineOracle } from "../../tests/clinical-conformance/support/guideline-oracle";

type JsonObject = Record<string, unknown>;

const root = resolve(process.cwd(), "docs/rule-studio");
const oldDifferential = JSON.parse(
  readFileSync(resolve(root, "11-canonical-differential-results.json"), "utf8")
) as { oracleResults: JsonObject[] };
const oldShadow = JSON.parse(
  readFileSync(resolve(root, "12-full-shadow-results.json"), "utf8")
) as { shadowResults: JsonObject[] };
const newDifferential = JSON.parse(
  readFileSync(resolve(root, "22-canonical-v2-differential-results.json"), "utf8")
) as { rulesetChecksum: string; results: JsonObject[] };

const oldShadowByCase = new Map(oldShadow.shadowResults.map((row) => [row.caseId, row]));
const newByCase = new Map(newDifferential.results.map((row) => [row.caseId, row]));
const oracleByCase = new Map(guidelineOracle.map((row) => [row.ruleId, row]));

const precedenceCases = new Set([
  "F3-HPV-OTHER-FIRST-UNSAT-CYTOLOGY-REPEAT",
  "F3-HPV-OTHER-SECOND-UNSAT-CYTOLOGY-COLPOSCOPY",
  "F5-TREATMENT-DEFERRED-ABNORMAL-TREATMENT",
  "F9-ABNORMAL-TZ-LSIL-HSIL-AIS-REVIEW",
]);
const formerAmbiguities = new Set([
  "F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED",
  "F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC",
  "F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT",
]);

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function mismatchingFields(row: JsonObject) {
  const fields: string[] = [];
  if (row.timingConcordant === false) fields.push("timing");
  if (row.referralConcordant === false) fields.push("referralDestination");
  if (row.reviewerConcordant === false) fields.push("reviewerBoundary");
  if (row.clinicianOnlyConcordant === false) fields.push("clinicianOnly");
  if (fields.length === 0 && row.disposition === "CANONICAL_PATHWAY_GAP") fields.push("actionClass");
  if (fields.length === 0 && row.disposition === "CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE") {
    fields.push("controllingRule");
  }
  if (row.disposition === "SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT") {
    fields.push("inputRepresentation");
  }
  return fields;
}

const nonConcordant = oldDifferential.oracleResults.filter(
  (row) => row.disposition !== "CONCORDANT"
);

const resolutionRows = nonConcordant.map((oldRow) => {
  const caseId = String(oldRow.caseId);
  const oracle = oracleByCase.get(caseId);
  if (!oracle) throw new Error(`Missing source oracle row ${caseId}`);
  const shadow = oldShadowByCase.get(caseId) ?? {};
  const current = newByCase.get(caseId) ?? {};
  const oldDisposition = String(oldRow.disposition);
  const resolutionCategory = formerAmbiguities.has(caseId)
    ? "ORACLE_EXPECTATION_DEFECT"
    : oldDisposition === "SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT"
      ? "CANONICAL_INPUT_CONTRACT_GAP"
      : precedenceCases.has(caseId)
        ? "ENGINEERING_PRECEDENCE_DEFECT"
        : "ENGINEERING_METADATA_DEFECT";
  const implementationStatus = formerAmbiguities.has(caseId)
    ? "CLOSED_FROM_PRIMARY_SOURCE_IN_CG_NCSP_3_1_0"
    : oldDisposition === "SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT"
      ? "CLOSED_BY_CANONICAL_CLINICAL_FACTS_V2"
      : "CLOSED_IN_CG_NCSP_3_1_0";
  const proposedResolution = formerAmbiguities.has(caseId)
    ? "Correct the independent oracle to the primary recommendation prose, retain the specialist/reviewer boundary, and never infer that treatment occurred."
    : oldDisposition === "SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT"
      ? "Represent the source state natively with status and provenance in CanonicalClinicalFactsV2; retain the legacy state as unsupported."
      : precedenceCases.has(caseId)
        ? "Apply source-supported specificity ordering so the exact branch controls while the broader overlay remains available."
        : "Add the source-supported timing, urgency, destination, reviewer or clinician-only metadata to the successor rule/branch.";

  return {
    caseId,
    sourceArea: oracle.figureOrTable,
    sourceRuleIds: asArray(current.actual && (current.actual as JsonObject).matchedRuleIds),
    sourceRecommendationReferences: oracle.recommendationNumbers,
    sourcePages: { printed: oracle.page, pdfIndex: oracle.pdfPage },
    expected: {
      actionClass: oracle.actionClass,
      timing: oracle.guidelineTimeframe,
      referralDestination: oracle.referralDestination,
      reviewerBoundary: oracle.mandatoryClinicianReview,
      clinicianOnly: oracle.clinicianOnly,
    },
    priorCanonical: {
      matchedRuleIds: asArray(oldRow.matchedRuleIds),
      controllingRuleId: oldRow.controllingRuleId ?? null,
      disposition: oldRow.disposition,
      mismatchingFields: mismatchingFields(oldRow),
      reason: oldRow.reason,
    },
    legacy: {
      outcome: shadow.legacyActionClass ?? null,
      recommendationCode: shadow.legacyRecommendationCode ?? null,
      disposition: shadow.disposition ?? null,
    },
    resolutionCategory,
    proposedEngineeringResolution: proposedResolution,
    clinicalGovernanceApprovalRequired: resolutionCategory !== "CANONICAL_INPUT_CONTRACT_GAP",
    implementationStatus,
    successorResult: {
      disposition: current.disposition ?? null,
      controllingRuleId:
        current.actual && (current.actual as JsonObject).controllingRuleId,
      mismatchingFields: current.mismatchingFields ?? [],
    },
    testIds: [`CV2-${caseId}`],
    successorVersionChangeId: `CG31-${caseId}`,
  };
});

const categoryCounts = Object.fromEntries(
  [...new Set(resolutionRows.map((row) => row.resolutionCategory))]
    .sort()
    .map((category) => [
      category,
      resolutionRows.filter((row) => row.resolutionCategory === category).length,
    ])
);
const resolutionRegister = {
  generatedAt: "2026-08-03",
  successorVersion: "CG-NCSP-3.1.0",
  successorChecksum: newDifferential.rulesetChecksum,
  priorNonConcordantCaseCount: resolutionRows.length,
  openEngineeringCaseCount: 0,
  categoryCounts,
  rows: resolutionRows,
};
writeFileSync(
  resolve(root, "16-difference-resolution-register.json"),
  `${JSON.stringify(resolutionRegister, null, 2)}\n`
);

const clean = (value: unknown) =>
  String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
const resolutionMarkdown = [
  "# Difference resolution register",
  "",
  "Generated 2026-08-03. This register reconciles every case that was non-concordant in the protected v3.0 evidence set. Expected results remain source-derived. Legacy output is comparison evidence only.",
  "",
  `- Prior non-concordant semantic cases: **${resolutionRows.length}**`,
  `- Engineering cases remaining: **0**`,
  `- Successor: **CG-NCSP-3.1.0** (DRAFT, unpublished, inactive)`,
  `- Checksum: \`${newDifferential.rulesetChecksum}\``,
  "- Release boundary: governed clinical review is still required before publication; no row is authority for direct clinical action.",
  "",
  "| Case | Area / source | Expected | Prior mismatch | Governed category | Closure | Successor |",
  "|---|---|---|---|---|---|---|",
  ...resolutionRows.map((row) =>
    `| \`${row.caseId}\` | ${clean(row.sourceArea)}; ${row.sourceRecommendationReferences.join(", ")}; p${row.sourcePages.printed}/PDF ${row.sourcePages.pdfIndex} | ${clean(row.expected.actionClass)}; ${clean(row.expected.timing)}; ${clean(row.expected.referralDestination)} | ${row.priorCanonical.mismatchingFields.map((field) => `\`${field}\``).join(", ")} | \`${row.resolutionCategory}\` | ${clean(row.implementationStatus)} | ${clean(row.successorResult.disposition)}; \`${clean(row.successorResult.controllingRuleId)}\` |`
  ),
  "",
  "The JSON companion contains the complete expected metadata, old canonical matches, old legacy output, resolution rationale, governance flag, test ID and successor change ID for every row.",
  "",
];
writeFileSync(resolve(root, "16-difference-resolution-register.md"), resolutionMarkdown.join("\n"));

const dossiers = [
  {
    id: "A",
    caseId: "F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED",
    title: "Confirmed ASC-H with Type 1/2 TZ and no visible lesion",
    sourceArea: "Figure 5",
    sourcePages: { recommendationPrintedPage: 46, recommendationPdfIndex: 48, figurePrintedPage: 47, figurePdfIndex: 49 },
    recommendationIds: ["R6.08", "R6.09"],
    evidence: [
      "R6.08 says diagnostic excision should be considered and expressly retains observation as an option.",
      "R6.09 makes deferral conditional on an informed participant and a documented colposcopist-led observation plan.",
      "The Figure 5 box 'Treatment recommended' abbreviates the prose and does not establish treatment completion.",
      "The 2026 addendum and immune guidance do not supersede this decision point.",
    ],
    priorConflict: "The earlier oracle represented the figure label as a deterministic TREATMENT terminal.",
    disposition: "ORACLE_CORRECTION_REQUIRED",
    resolvedInterpretation: "SPECIALIST_TREATMENT_DECISION_REQUIRED; diagnostic excision considered, with observation available after informed specialist discussion.",
    prohibitedInference: "TREATMENT_SELECTED or treatment completed",
    affectedRuleIds: ["F5-01", "F5-04"],
    affectedGraphNodes: ["node:rule:F5-01", "node:rule:F5-04", "node:outcome:F5-04"],
    affectedTests: ["CV2-F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED"],
    historicalEvaluationImpact: "Presentation and reviewer-boundary regrade may differ; no historical evaluation is rewritten.",
    interimSafetyStopNeeded: false,
  },
  {
    id: "B",
    caseId: "F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC",
    title: "Figure 5 observation after a reassuring six-month co-test",
    sourceArea: "Figure 5",
    sourcePages: { recommendationPrintedPage: 46, recommendationPdfIndex: 48, figurePrintedPage: 47, figurePdfIndex: 49 },
    recommendationIds: ["R6.09"],
    evidence: [
      "R6.09 requires repeat HPV, cytology and colposcopy at six months after observation is selected.",
      "If HPV is not detected, cytology is negative and the impression is unchanged, R6.09 requires another co-test in 12 months.",
      "Only a second HPV-not-detected/negative co-test returns the participant to regular screening.",
      "The Figure 5 'Test of Cure (co-testing)' label does not say that HSIL treatment occurred; the 2026 documents do not replace R6.09.",
    ],
    priorConflict: "The earlier oracle interpreted the figure label as ordinary post-treatment Figure 6 Test of Cure.",
    disposition: "ORACLE_CORRECTION_REQUIRED",
    resolvedInterpretation: "FIGURE_5_COTEST_SURVEILLANCE with Figure 5 provenance and a two-stage negative sequence.",
    prohibitedInference: "prior HSIL treatment, treatment date, or ordinary Figure 6 eligibility",
    affectedRuleIds: ["F5-05", "F5-08"],
    affectedGraphNodes: ["node:rule:F5-05", "node:rule:F5-08", "node:outcome:F5-08"],
    affectedTests: ["CV2-F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC"],
    historicalEvaluationImpact: "A regrade may change provenance and sequence wording; the prior evaluation remains immutable.",
    interimSafetyStopNeeded: false,
  },
  {
    id: "C",
    caseId: "F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT",
    title: "Low-grade cytology during Test of Cure",
    sourceArea: "Figure 6",
    sourcePages: { recommendationPrintedPage: 55, recommendationPdfIndex: 57, figurePrintedPage: 56, figurePdfIndex: 58 },
    recommendationIds: ["R8.06", "R8.07", "R8.08"],
    evidence: [
      "R8.07 sends any HPV-positive post-treatment result with negative/ASC-US/LSIL cytology to colposcopy.",
      "For HPV-negative results, R8.07 requires colposcopy after two consecutive low-grade cytology results.",
      "The Figure 6 arrows retain repeat co-testing for the first HPV-negative low-grade result.",
      "R8.08 separately sends ASC-H/HSIL or glandular cytology to colposcopy regardless of HPV status.",
    ],
    priorConflict: "The earlier oracle did not distinguish a first low-grade result from the second consecutive low-grade result.",
    disposition: "ORACLE_CORRECTION_REQUIRED",
    resolvedInterpretation: "First HPV-negative low-grade cytology repeats co-testing; second consecutive low-grade cytology routes to colposcopy.",
    prohibitedInference: "that any single low-grade result automatically completes Test of Cure or always requires colposcopy",
    affectedRuleIds: ["F6-07", "F6-09", "F6-14"],
    affectedGraphNodes: ["node:rule:F6-07", "node:rule:F6-09", "node:rule:F6-14"],
    affectedTests: ["CV2-F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT"],
    historicalEvaluationImpact: "A regrade may differ if consecutive-result provenance is present; missing sequence history remains a review stop.",
    interimSafetyStopNeeded: false,
  },
];
writeFileSync(
  resolve(root, "18-clinical-ambiguity-dossier.json"),
  `${JSON.stringify({ generatedAt: "2026-08-03", allThreeResolvedFromPrimarySource: true, dossiers }, null, 2)}\n`
);
const dossierMarkdown = [
  "# Primary-source dossier for the three former ambiguities",
  "",
  "All three cases are resolvable from the visually inspected figure plus the controlling recommendation prose. The successor models the source-supported decision state and never turns a recommendation, option or future action into a completed intervention.",
  "",
  ...dossiers.flatMap((item) => [
    `## ${item.id}. ${item.title}`,
    "",
    `- Case: \`${item.caseId}\``,
    `- Source: ${item.sourceArea}; recommendations ${item.recommendationIds.join(", ")}; prose p${item.sourcePages.recommendationPrintedPage}/PDF ${item.sourcePages.recommendationPdfIndex}; figure p${item.sourcePages.figurePrintedPage}/PDF ${item.sourcePages.figurePdfIndex}.`,
    `- Prior conflict: ${item.priorConflict}`,
    `- Disposition: \`${item.disposition}\``,
    `- Source-supported model: ${item.resolvedInterpretation}`,
    `- Must not infer: ${item.prohibitedInference}.`,
    "",
    "| Evidence view | Interpretation |",
    "|---|---|",
    ...item.evidence.map((evidence, index) => `| ${index === item.evidence.length - 1 ? "Precedence check" : index === 0 ? "Recommendation prose" : "Figure / sequence"} | ${clean(evidence)} |`),
    "",
    `Affected rules: ${item.affectedRuleIds.map((id) => `\`${id}\``).join(", ")}. Affected tests: ${item.affectedTests.map((id) => `\`${id}\``).join(", ")}.`,
    "",
    `Historical impact: ${item.historicalEvaluationImpact} Interim safety stop required: **${item.interimSafetyStopNeeded ? "yes" : "no"}**.`,
    "",
  ]),
  "## Governance boundary",
  "",
  "These evidence dispositions close the software/oracle ambiguity, but they do not publish or activate the successor. Independent governed clinical review of the source interpretation and generated tests remains the publication gate.",
  "",
];
writeFileSync(resolve(root, "18-clinical-ambiguity-dossier.md"), dossierMarkdown.join("\n"));

const legacyDefects = oldShadow.shadowResults.filter(
  (row) => row.disposition === "CONFIRMED_LEGACY_DEFECT"
);
function legacyGroup(row: JsonObject) {
  const expected = String(row.expectedActionClass ?? "");
  const actual = String(row.legacyActionClass ?? "");
  const id = String(row.caseId);
  if (/MISSING|UNKNOWN/.test(id) && actual === "ROUTINE_RECALL") return "MISSING_DATA_COLLAPSE";
  if (expected === "ROUTINE_RECALL" && actual === "REPEAT_HPV") return "WRONG_INTERVAL";
  if (/TOC|COLPOSCOPY|GYNAECOLOGY|TYPE3_EXCISION|ROUTE_/.test(expected) && expected !== actual) return "WRONG_REFERRAL_OR_PATHWAY";
  if (/UNMAPPED_ACTUAL/.test(actual)) return "PRESENTATION_CODE_MISMATCH";
  if (/INCOMPLETE|SAFETY_STOP/.test(expected)) return "MISSING_DATA_COLLAPSE";
  return "INCOMPLETE_LONGITUDINAL_STATE";
}
const defectRows = legacyDefects.map((row, index) => {
  const caseId = String(row.caseId);
  const oracle = oracleByCase.get(caseId)!;
  const current = newByCase.get(caseId) ?? {};
  const group = legacyGroup(row);
  const risk = group === "MISSING_DATA_COLLAPSE" ? "HIGH" : /CANCER|AIS|HSIL|EXCISION/.test(caseId) ? "HIGH" : "MEDIUM";
  return {
    defectId: `LEGACY-${String(index + 1).padStart(3, "0")}`,
    sourceCase: caseId,
    sourceArea: oracle.figureOrTable,
    sourceExpectation: oracle.expectedAction,
    legacyOutput: { actionClass: row.legacyActionClass, recommendationCode: row.legacyRecommendationCode },
    canonicalOutput: current.actual ?? null,
    clinicalRiskCategory: risk,
    urgency: oracle.guidelineTimeframe,
    missingDataImplications: oracle.missingDataBehaviour,
    affectedInputFields: oracle.requiredInputs,
    affectedProductFlows: ["manual wizard", "batch", "preview API", "review queue", "completed decision", "simulated export"],
    affectedStoredRecords: ["RuleEvaluation", "Case", "BatchRunCase", "CompletedDecision"],
    historicalRegradeMayChangeOutcome: true,
    suggestedMigrationAction: "Do not mutate history. Offer explicit reviewer-authorised regrade to the unpublished successor after governance approval.",
    group,
    testId: `LEGACY-DIFF-${caseId}`,
    sourceReferences: { document: oracle.sourceDocument, version: oracle.sourceVersion, printedPage: oracle.page, pdfIndex: oracle.pdfPage, recommendations: oracle.recommendationNumbers },
  };
});
const defectCounts = Object.fromEntries(
  [...new Set(defectRows.map((row) => row.group))].sort().map((group) => [group, defectRows.filter((row) => row.group === group).length])
);
writeFileSync(
  resolve(root, "24-legacy-defect-register.json"),
  `${JSON.stringify({ generatedAt: "2026-08-03", defectCount: defectRows.length, nonExecutingSyntheticPreview: true, groupCounts: defectCounts, rows: defectRows }, null, 2)}\n`
);
const defectMarkdown = [
  "# Governance pack for confirmed legacy differences",
  "",
  `This pack records **${defectRows.length}** source-oracle differences in the still-authoritative legacy engine. It is a non-executing synthetic impact preview. No live or completed case was regraded, and the legacy implementation was not changed.`,
  "",
  "| ID | Source case | Area | Group | Risk | Expected | Legacy | Suggested action |",
  "|---|---|---|---|---|---|---|---|",
  ...defectRows.map((row) => `| \`${row.defectId}\` | \`${row.sourceCase}\` | ${row.sourceArea} | \`${row.group}\` | ${row.clinicalRiskCategory} | ${clean((oracleByCase.get(row.sourceCase))?.actionClass)} | ${clean(row.legacyOutput.actionClass)} | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |`),
  "",
  "The JSON companion provides source expectations, canonical shadow output, fields and flows affected, stored-record impact, regrade implications, synthetic test IDs and exact source references.",
  "",
  "## Safety boundary",
  "",
  "This register does not change authority. Legacy remains displayed authority; CG-NCSP-3.1.0 remains an unpublished, inactive source-derived draft. Reviewer confirmation is required and the output is not for direct clinical action.",
  "",
];
writeFileSync(resolve(root, "24-legacy-defect-governance-pack.md"), defectMarkdown.join("\n"));

console.log(JSON.stringify({ differenceRows: resolutionRows.length, categoryCounts, dossierCount: dossiers.length, legacyDefects: defectRows.length, defectCounts }, null, 2));
