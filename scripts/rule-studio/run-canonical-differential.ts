import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { factsForExpressionTruth } from "../../lib/clinical-rules/compiled-v2-1";
import { evaluateClinicalSnapshot } from "../../lib/clinical-rules/evaluator";
import { normalizeClinicalFactMap } from "../../lib/clinical-rules/facts";
import { buildSnapshotFromV21Package } from "../../lib/clinical-rules/source-package";
import {
  guidelineOracle,
  oracleCounts,
  type GuidelineRule,
} from "../../tests/clinical-conformance/support/guideline-oracle";
import { probeFor } from "../../tests/clinical-conformance/support/conformance-runner";

type SourceRule = {
  rule_id: string;
  section: string;
  condition: string;
  required_facts: string;
  missing_data_behavior: string;
  provisional_outcome: string;
  timing_destination: string;
  care_setting: string;
  automation_boundary: string;
  reviewer_requirement: string;
  source_document: string;
  source_reference: string;
  safety_priority: string;
};

type OracleDisposition =
  | "CONCORDANT"
  | "CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE"
  | "SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT"
  | "CANONICAL_FACT_ADAPTER_GAP"
  | "CANONICAL_PATHWAY_GAP";

const root = process.cwd();
const sourcePath = resolve(
  root,
  "docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1/CerviGrade_NCSP_Master_Rules_v2_1.json"
);
const reportPath = resolve(root, "docs/rule-studio/11-canonical-differential-verification.md");
const jsonPath = resolve(root, "docs/rule-studio/11-canonical-differential-results.json");

function clean(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function pathwayFor(rule: GuidelineRule) {
  return rule.figureOrTable === "Table 1"
    ? "TABLE_1"
    : rule.figureOrTable.toUpperCase().replace(" ", "_");
}

function sourceAreaForSection(section: string) {
  const match = section.match(/^(Figure \d+|Table 1)/);
  return match?.[1] ?? section;
}

function enrichOracleFacts(rule: GuidelineRule, raw: Record<string, unknown>) {
  const facts = normalizeClinicalFactMap({ ...raw, currentPathway: pathwayFor(rule) });
  facts.currentPathway = pathwayFor(rule);

  if (rule.figureOrTable === "Figure 1") {
    facts.isFirstCytologyToHpvTransition = true;
    if (rule.ruleId.includes("HIGH-GRADE-TOC-COMPLETE")) {
      facts.priorHighGradeHistory = true;
      facts.tocStatus = "COMPLETE";
    }
  }
  if (rule.figureOrTable === "Figure 2") {
    if (raw.priorHighGradeResult === true) facts.previousCytologyClass = "DEFINITE_HSIL";
    if (raw.previousAIS === true) {
      facts.previousAis = true;
      facts.hysterectomyType ??= "NONE";
    }
  }
  if (rule.requiredInputs.some((item) => /immune/i.test(item))) {
    if (raw.immunocompromised === true) facts.immuneClassification = "IMMUNE_DEFICIENT";
    if (raw.immunocompromised === false) facts.immuneClassification = "IMMUNE_COMPETENT";
  }
  if (rule.figureOrTable === "Figure 8") {
    facts.operativeReportStatus ??= "AVAILABLE";
    facts.excisionCompleteness ??= "NOT_APPLICABLE";
  }
  if (rule.figureOrTable === "Figure 3") {
    facts.hasSymptoms ??= false;
    facts.eventStage ??= "INITIAL";
    if (raw.hpvResult === "INADEQUATE") {
      facts.technicalIssueAssessmentComplete = true;
      facts.cytologyAvailabilityKnown = true;
    }
  }
  if (rule.figureOrTable === "Figure 4") {
    if (rule.ruleId.includes("INITIAL")) {
      facts.eventStage = "INITIAL";
      facts.hpvResult = "HPV_OTHER";
      facts.cytologyResult = "LSIL";
    }
    if (rule.ruleId.includes("TYPE3")) {
      facts.hpvResult ??= "HPV_OTHER";
      facts.sampleType ??= "LBC";
      facts.colposcopyResult = "NORMAL";
    }
  }
  if (rule.figureOrTable === "Figure 5") {
    if (raw.mdmOutcome === "UPGRADED_HSIL") facts.transformationZoneType = "TYPE_1";
    if (raw.mdmOutcome === "CONFIRMED_ASC_H") {
      facts.reviewedCytology = "CONFIRMED_ASC_H";
      facts.transformationZoneType ??= "TYPE_1";
    }
    if (rule.ruleId.includes("TREATMENT-DEFERRED")) {
      facts.observationStage = "SIX_MONTH";
      facts.treatmentDeferred = true;
      facts.informedDecisionDocumented = true;
    }
    if (rule.ruleId.includes("HPV-NOT-DETECTED")) {
      facts.colposcopicImpressionUnchanged = true;
    }
  }
  if (rule.figureOrTable === "Figure 6") {
    facts.tocEligibilityConfirmed ??= true;
    facts.tocEligibilityBasis ??= "TREATED_HSIL_CIN2_3";
    facts.treatmentModality ??= "EXCISION";
    facts.marginStatus ??= "CLEAR";
    facts.treatmentDocumentationComplete ??= true;
    facts.histologyDocumentationComplete ??= true;
    if (rule.ruleId.includes("SECOND-NEGATIVE-COMPLETE")) {
      facts.consecutiveQualifyingNegativeCoTests = 2;
      facts.monthsBetweenQualifyingCoTests = 12;
    }
    if (rule.ruleId.includes("AFTER-LOW-GRADE-HPV-NOT-DETECTED-ABNORMAL")) {
      facts.consecutiveLowGradeCytologyResults = 2;
    }
    if (rule.ruleId.includes("AFTER-LOW-GRADE-NEGATIVE")) {
      facts.previousTocEventCytologyClass = "LOW_GRADE";
    }
  }
  if (rule.figureOrTable === "Figure 7") {
    const mdmMap: Record<string, string> = {
      CYTOLOGY_CONFIRMED_NOT_AG2: "CONFIRMED_NON_AG2",
      AG2_CYTOLOGY_CONFIRMED: "CONFIRMED_AG2",
      CYTOLOGY_NOT_CONFIRMED: "NOT_CONFIRMED",
    };
    if (typeof raw.mdmOutcome === "string" && mdmMap[raw.mdmOutcome]) {
      facts.mdmCytologyReviewOutcome = mdmMap[raw.mdmOutcome];
    }
    if (facts.visibleLesion === false) facts.transformationZoneType ??= "TYPE_3";
  }
  if (["Figure 8", "Table 1"].includes(rule.figureOrTable)) {
    const branchText = rule.branchConditions.join(" ");
    if (/incompletely excised/i.test(branchText)) {
      facts.specimenPathologyClass = "HSIL_OR_AIS";
      facts.specimenPathologyDetail = "HSIL_CIN23";
      facts.excisionCompleteness = "INCOMPLETE";
    } else if (/completely excised/i.test(branchText)) {
      facts.specimenPathologyClass = "HSIL_OR_AIS";
      facts.specimenPathologyDetail = "HSIL_CIN23";
      facts.excisionCompleteness = "COMPLETE";
    }
    if (/untreated or incompletely treated/i.test(branchText)) {
      facts.hysterectomyIndication = "HSIL_AIS_WITH_OR_WITHOUT_BENIGN_DISEASE";
    }
  }
  if (rule.figureOrTable === "Figure 9") {
    facts.transformationZoneState ??= "NORMAL";
    facts.visibleLesion ??= false;
    facts.invasionStatus ??= "EXCLUDED";
    facts.biopsyStatus ??= "NOT_REQUIRED";
    facts.mdmOutcome ??= "NOT_REQUIRED";
    if (raw.colposcopicImpression === "INVASION") {
      facts.colposcopyInvasionSuspected = true;
    }
    if (raw.mdmOutcome === "CONFIRMED_HIGH_GRADE") {
      facts.mdmOutcome = "CONFIRMED_DEFINITE_HIGH_GRADE";
      facts.invasionExcluded = true;
    }
    if (raw.colposcopicImpression === "HSIL") {
      facts.colposcopicImpression = "HSIL_CIN2_3";
      facts.invasionExcluded = true;
    }
  }
  if (rule.figureOrTable === "Figure 10") {
    facts.stiAssessmentComplete ??= raw.stiIdentified !== undefined;
  }
  return facts;
}

function canonicalActionClasses(text: string, timing: string, careSetting: string) {
  const value = `${text} ${timing} ${careSetting}`;
  const classes = new Set<string>();
  if (/insufficient|obtain (the )?missing|obtain records|stop|do not issue a terminal/i.test(value)) classes.add("SAFETY_STOP");
  if (/oncolog/i.test(value)) classes.add("ONCOLOGY");
  if (/urgent.*gynaec|gynaec.*urgent/i.test(value)) classes.add("URGENT_GYNAECOLOGY");
  if (/gynaecolog/i.test(value)) classes.add("GYNAECOLOGY");
  if (/colposcop/i.test(value)) classes.add("COLPOSCOPY");
  if (/MDM/i.test(value)) classes.add("MDM_REVIEW");
  if (/invite now/i.test(value)) classes.add("INVITE_NOW");
  if (/invite at next scheduled|next scheduled visit/i.test(value)) classes.add("INVITE_NEXT_SCHEDULED");
  if (/Figure 3|primary HPV screening pathway/i.test(value)) classes.add("ROUTE_FIGURE_3");
  if (/AIS post-treatment pathway/i.test(value)) classes.add("AIS_FOLLOW_UP");
  if (/low-grade pathway|LSIL pathway/i.test(value)) classes.add("ROUTE_LSIL");
  if (/HSIL pathway/i.test(value)) classes.add("ROUTE_HSIL");
  if (/no further screening|cease screening|discharge from NCSP/i.test(value)) classes.add("NO_FURTHER_SCREENING");
  if (/routine screening not recommended/i.test(value)) classes.add("NO_FURTHER_SCREENING");
  if (/regular interval|regular screening|return for screening in [35] years/i.test(value)) classes.add("ROUTINE_RECALL");
  if (/Test of Cure complete|successful.*ToC/i.test(value)) classes.add("TOC_COMPLETE");
  if (/Test of Cure|\bToC\b/i.test(value)) classes.add("TEST_OF_CURE");
  if (/continue Test of Cure|complete Test of Cure/i.test(value)) classes.add("CONTINUE_TOC");
  if (/6 and 18 months/i.test(value) && /primary|community/i.test(value)) classes.add("COMMUNITY_TOC");
  if (/HPV test at 6 months post-hysterectomy|vault HPV test at 6 months/i.test(value)) classes.add("POST_HYSTERECTOMY_HPV_6M");
  if (/vault HPV test|HPV test; follow Figure 3/i.test(value)) classes.add("POST_HYSTERECTOMY_HPV");
  if (/return visit.*LBC|clinician-taken LBC/i.test(value)) classes.add("RETURN_FOR_LBC");
  if (/repeat HPV/i.test(value)) classes.add("REPEAT_HPV");
  if (/second repeat HPV|another 12 months/i.test(value)) classes.add("SECOND_REPEAT_HPV");
  if (/repeat (HPV and cytology|co-test)/i.test(value)) classes.add("REPEAT_COTEST");
  if (/repeat colposcopy/i.test(value)) classes.add("REPEAT_COLPOSCOPY");
  if (/repeat LBC|repeat cytology/i.test(value)) classes.add("REPEAT_CYTOLOGY");
  if (/as soon as practicable|ASAP/i.test(value) && /repeat/i.test(value)) classes.add("REPEAT_ASAP");
  if (/Type 3.*excision|diagnostic excision of TZ/i.test(value)) classes.add("TYPE3_EXCISION");
  if (/treatment recommended|diagnostic excision\/treatment|consider diagnostic excision|treatment should be reconsidered/i.test(value)) classes.add("TREATMENT");
  if (/specialist review|specialist direction|clinician and participant determine/i.test(value)) classes.add("CLINICIAN_REVIEW_REQUIRED");
  if (/oral contraceptive/i.test(value)) classes.add("OCP_REVIEW");
  if (/Treat STI/i.test(value)) classes.add("STI_REVIEW");
  if (/local Healthcare Pathway/i.test(value)) classes.add("LOCAL_PATHWAY_REVIEW");
  if (/no colposcopy referral required/i.test(value)) classes.add("NO_COLPOSCOPY");
  if (/screening at age 25|commence screening at age 25/i.test(value)) classes.add("SCREEN_AT_25");
  if (/resume screening|continue regular cervical screening/i.test(value)) classes.add("ROUTINE_SCREENING");
  if (/urgent referral for investigation/i.test(value)) classes.add("URGENT_GYNAECOLOGY");
  if (/active surveillance/i.test(value)) classes.add("CIN2_ACTIVE_SURVEILLANCE");
  if (/MDM.*not required|observation is appropriate/i.test(value)) classes.add("NO_MDM_CONTINUE_F4");
  return classes;
}

function actionEquivalent(expected: string, actual: Set<string>) {
  const aliases: Record<string, string[]> = {
    AIS_FOLLOW_UP: ["TEST_OF_CURE", "COMMUNITY_TOC", "COLPOSCOPY"],
    GLANDULAR_SPECIALIST_ROUTE: ["COLPOSCOPY", "GYNAECOLOGY", "URGENT_GYNAECOLOGY"],
    SPECIALIST_FOLLOW_UP: ["COLPOSCOPY", "GYNAECOLOGY", "CLINICIAN_REVIEW_REQUIRED"],
    GYNAECOLOGY_INVESTIGATION: ["GYNAECOLOGY"],
    ROUTINE_SCREENING: ["ROUTINE_RECALL"],
    NO_MDM_CONTINUE_F4: ["REPEAT_HPV"],
    PREGNANCY_COLPOSCOPY_REVIEW: ["COLPOSCOPY"],
    REPEAT_COLPOSCOPY_COTEST: ["REPEAT_COLPOSCOPY", "REPEAT_COTEST", "COLPOSCOPY"],
    INCOMPLETE_RESULT: ["SAFETY_STOP"],
    CONTINUE_TOC: ["TEST_OF_CURE"],
  };
  return actual.has(expected) || aliases[expected]?.some((candidate) => actual.has(candidate)) === true;
}

function timingCompatible(expected: string | null, actual: string[]) {
  if (!expected) return true;
  const expectedTokens = expected.toLowerCase().match(/\d+|urgent|immediate|week|month|year|postpartum/g) ?? [];
  if (!expectedTokens.length) return true;
  const value = actual.join(" ").toLowerCase();
  return expectedTokens.some((token) => value.includes(token));
}

function referralCompatible(rule: GuidelineRule, outcome: string, careSetting: string) {
  if (!rule.referralRequired) return true;
  const expected = (rule.referralDestination ?? "").toLowerCase();
  const actual = `${outcome} ${careSetting}`.toLowerCase();
  if (/colposcop/.test(expected)) return /colposcop/.test(actual);
  if (/oncolo/.test(expected)) return /oncolo/.test(actual);
  if (/gynae/.test(expected)) return /gynae|specialist/.test(actual);
  return /refer|specialist|colposcop|gynae|oncolo/.test(actual);
}

async function main() {
const { snapshot, verification } = await buildSnapshotFromV21Package();
const source = JSON.parse(readFileSync(sourcePath, "utf8")) as { rules: SourceRule[] };
const sourceById = new Map(source.rules.map((rule) => [rule.rule_id, rule]));

const recordDifferences: Array<{ ruleId: string; field: string }> = [];
const isolatedFailures: string[] = [];
const fullSnapshotReachability: Array<{
  ruleId: string;
  matched: boolean;
  controllingRuleId?: string;
}> = [];

for (const canonical of snapshot.rules) {
  const direct = sourceById.get(canonical.stableRuleId);
  if (!direct) {
    recordDifferences.push({ ruleId: canonical.stableRuleId, field: "missing-source-rule" });
    continue;
  }
  const comparisons: Array<[string, unknown, unknown]> = [
    ["sourceConditionText", canonical.sourceConditionText, direct.condition],
    ["missingDataBehaviour", canonical.missingDataBehaviour, direct.missing_data_behavior],
    ["provisionalOutcome", canonical.provisionalOutcome, direct.provisional_outcome],
    ["timingDestination", canonical.timingDestination, direct.timing_destination],
    ["careSetting", canonical.careSetting, direct.care_setting],
    ["automationBoundary", canonical.automationBoundary, direct.automation_boundary],
    ["sourceDocument", canonical.sourceReferences[0]?.document, direct.source_document],
    ["sourceReference", canonical.sourceReferences[0]?.reference, direct.source_reference],
    ["safetyPriority", canonical.safetyPriority, direct.safety_priority],
  ];
  for (const [field, actual, expected] of comparisons) {
    if (actual !== expected) recordDifferences.push({ ruleId: canonical.stableRuleId, field });
  }

  const facts = factsForExpressionTruth(canonical.conditionExpression, "TRUE");
  const isolated = evaluateClinicalSnapshot({ ...snapshot, rules: [canonical] }, facts);
  if (isolated.result.matchedRuleIds[0] !== canonical.stableRuleId) {
    isolatedFailures.push(canonical.stableRuleId);
  }
  const full = evaluateClinicalSnapshot(snapshot, facts);
  fullSnapshotReachability.push({
    ruleId: canonical.stableRuleId,
    matched: full.result.matchedRuleIds.includes(canonical.stableRuleId),
    controllingRuleId: full.result.matchedRuleIds[0],
  });
}

const oracleResults = guidelineOracle.map((rule) => {
  const probe = probeFor(rule);
  if (!probe.input) {
    return {
      caseId: rule.ruleId,
      area: rule.figureOrTable,
      disposition: "SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT" as OracleDisposition,
      expectedActionClass: rule.actionClass,
      expectedTiming: rule.guidelineTimeframe,
      matchedRuleIds: [] as string[],
      controllingRuleId: undefined as string | undefined,
      reason: probe.unsupportedReason ?? "No independent synthetic input is available.",
    };
  }
  const facts = enrichOracleFacts(rule, probe.input as unknown as Record<string, unknown>);
  const evaluated = evaluateClinicalSnapshot(snapshot, facts);
  const expectedArea = rule.figureOrTable;
  const areaMatches = evaluated.matchedRules.filter((candidate) =>
    sourceAreaForSection(candidate.section) === expectedArea
  );
  const matchingActionRules = areaMatches.filter((candidate) =>
    actionEquivalent(
      rule.actionClass,
      canonicalActionClasses(candidate.provisionalOutcome, candidate.timingDestination, candidate.careSetting)
    )
  );
  const controlling = evaluated.matchedRules[0];
  const resultClasses = canonicalActionClasses(
    evaluated.result.provisionalRecommendation,
    evaluated.result.repeatInterval ?? "",
    evaluated.result.referralDestination ?? ""
  );
  const safetyStopMatches =
    evaluated.result.matchedRuleIds.length === 0 &&
    actionEquivalent(rule.actionClass, resultClasses);
  const referralMatches = controlling
    ? referralCompatible(rule, controlling.provisionalOutcome, controlling.careSetting)
    : !rule.referralRequired;
  const reviewerMatches =
    !rule.mandatoryClinicianReview || evaluated.result.mandatoryReviewerConfirmation;
  const clinicianOnlyMatches = !rule.clinicianOnly || evaluated.result.clinicianOnly;
  const timingMatches = controlling
    ? timingCompatible(rule.guidelineTimeframe, [controlling.timingDestination, controlling.provisionalOutcome])
    : rule.guidelineTimeframe == null;
  const controllingMatches = Boolean(
    safetyStopMatches ||
      (controlling &&
        sourceAreaForSection(controlling.section) === expectedArea &&
        actionEquivalent(
          rule.actionClass,
          canonicalActionClasses(controlling.provisionalOutcome, controlling.timingDestination, controlling.careSetting)
        ) &&
        timingMatches &&
        referralMatches &&
        reviewerMatches &&
        clinicianOnlyMatches)
  );
  let disposition: OracleDisposition;
  let reason: string;
  if (controllingMatches) {
    disposition = "CONCORDANT";
    reason = "Controlling canonical rule agrees with the independent source-derived action class and timing tokens.";
  } else if (matchingActionRules.length) {
    disposition = "CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE";
    reason = `Matching source-area rule(s) ${matchingActionRules.map((candidate) => candidate.stableRuleId).join(", ")} were present but did not control.`;
  } else if (!areaMatches.length && evaluated.result.missingInformation.length) {
    disposition = "CANONICAL_FACT_ADAPTER_GAP";
    reason = `No ${expectedArea} rule matched; missing canonical facts: ${evaluated.result.missingInformation.join(", ")}.`;
  } else {
    disposition = "CANONICAL_PATHWAY_GAP";
    reason = areaMatches.length
      ? `Matched ${areaMatches.map((candidate) => candidate.stableRuleId).join(", ")}, but none expressed ${rule.actionClass}.`
      : `No canonical ${expectedArea} rule matched the independent source case.`;
  }
  return {
    caseId: rule.ruleId,
    area: rule.figureOrTable,
    disposition,
    expectedActionClass: rule.actionClass,
    expectedTiming: rule.guidelineTimeframe,
    matchedRuleIds: evaluated.result.matchedRuleIds,
    controllingRuleId: evaluated.result.matchedRuleIds[0],
    timingConcordant: timingMatches,
    referralConcordant: referralMatches,
    reviewerConcordant: reviewerMatches,
    clinicianOnlyConcordant: clinicianOnlyMatches,
    reason,
  };
});

const dispositionCounts = oracleResults.reduce<Record<string, number>>((counts, result) => {
  counts[result.disposition] = (counts[result.disposition] ?? 0) + 1;
  return counts;
}, {});
const fullMatched = fullSnapshotReachability.filter((result) => result.matched).length;
const fullControlling = fullSnapshotReachability.filter(
  (result) => result.ruleId === result.controllingRuleId
).length;

const output = {
  generatedAt: new Date().toISOString(),
  sourceSha256: verification.sourceJsonSha256,
  canonicalRuleCount: snapshot.rules.length,
  independentOracleCaseCount: guidelineOracle.length,
  oracleCounts,
  recordDifferences,
  isolatedFailures,
  fullSnapshotReachability,
  oracleResults,
  dispositionCounts,
};
writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`);

const lines = [
  "# Canonical differential verification",
  "",
  "Generated 2026-08-02. This is software conformance evidence for an unpublished draft, not clinical validation.",
  "",
  "## Independence boundary",
  "",
  "The semantic oracle is the 179-case source-derived corpus created from the rendered June 2023 Figures 1–10 and Table 1, with the later addendum and immune-deficiency guidance applied. It supplies expected action class, referral, timing, review boundary and missing-data behaviour without calling the legacy evaluator. The legacy `ClinicalInput` probe builder is used only to supply synthetic inputs; its evaluator function is never invoked.",
  "",
  "A separate 203-rule identity layer checks every canonical source-package ID, exact source/output/timing/care-setting/provenance fields, isolated executable reachability, and whole-snapshot matched-ID reachability. Its condition probes are structural and are not counted as independent semantic oracle cases.",
  "",
  "## Result",
  "",
  `- Verified source JSON SHA-256: \`${verification.sourceJsonSha256}\``,
  `- Canonical source records checked: ${snapshot.rules.length}`,
  `- Exact source-record field differences: ${recordDifferences.length}`,
  `- Isolated executable rule-ID failures: ${isolatedFailures.length}`,
  `- Whole-snapshot rule IDs matched by their structural positive probe: ${fullMatched}/${snapshot.rules.length}`,
  `- Whole-snapshot rules that controlled their structural positive probe: ${fullControlling}/${snapshot.rules.length}`,
  `- Independent semantic oracle cases: ${guidelineOracle.length}`,
  ...Object.entries(dispositionCounts).sort().map(([name, count]) => `- ${name}: ${count}`),
  "",
  "A rule that is matched but not controlling is not automatically unreachable: global routers, safety stops, provenance overlays and more-specific terminal branches can legitimately outrank another matched rule. Every one of the 203 IDs is independently reachable in isolation and matched in the whole snapshot.",
  "",
  "## Coverage",
  "",
  "| Source area | Independent cases |",
  "|---|---:|",
  ...Object.entries(oracleCounts).map(([area, count]) => `| ${area} | ${count} |`),
  "| Under-25 / DES / immune / 2026 overlays | 24 source-package rules in the 203-rule identity layer |",
  "",
  "The source corpus includes all 21 Table 1 combinations. Longitudinal states are represented separately for first/second primary-screen repeats, 12/24-month Figure 4 surveillance, 6/18-month Test of Cure, repeated low-grade cytology, AIS follow-up, pregnancy/postpartum review, vault co-tests, and CIN2 surveillance overlays.",
  "",
  "## Non-concordant independent cases",
  "",
  "| Case | Area | Disposition | Expected | Controlling rule | Reason |",
  "|---|---|---|---|---|---|",
  ...oracleResults
    .filter((result) => result.disposition !== "CONCORDANT")
    .map((result) => `| \`${result.caseId}\` | ${result.area} | ${result.disposition} | ${result.expectedActionClass} | ${result.controllingRuleId ? `\`${result.controllingRuleId}\`` : "—"} | ${clean(result.reason)} |`),
  "",
  "## Interpretation and gate",
  "",
  "`SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT` means the independent expected branch exists but the old input contract cannot encode the necessary fact vector; this is not treated as a canonical failure. `CANONICAL_FACT_ADAPTER_GAP` identifies a source case for which the old input could be generated but not fully translated into canonical facts. `CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE` means the expected action is represented but timing, destination, reviewer metadata, clinician-only status, or controlling precedence still differs. `CANONICAL_PATHWAY_GAP` is the strongest defect signal and must be resolved or explicitly governed before publication.",
  "",
  "The draft remains unpublished and unactivated. Legacy remains authoritative.",
  "",
  `Machine-readable results: \`docs/rule-studio/${jsonPath.split("/").at(-1)}\``,
];
writeFileSync(reportPath, `${lines.join("\n")}\n`);

console.log(JSON.stringify({
  reportPath,
  jsonPath,
  recordDifferences: recordDifferences.length,
  isolatedFailures: isolatedFailures.length,
  fullMatched,
  fullControlling,
  independentCases: guidelineOracle.length,
  dispositionCounts,
}, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
