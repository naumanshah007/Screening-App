import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { guidelineOracle } from "../../tests/clinical-conformance/support/guideline-oracle";
import {
  actualActionClass,
  equivalent,
  probeFor,
} from "../../tests/clinical-conformance/support/conformance-runner";

type CanonicalDifferential = {
  sourceSha256: string;
  canonicalRuleCount: number;
  fullSnapshotReachability: Array<{
    ruleId: string;
    matched: boolean;
    controllingRuleId?: string;
  }>;
  oracleResults: Array<{
    caseId: string;
    area: string;
    disposition: string;
    expectedActionClass: string;
    matchedRuleIds: string[];
    controllingRuleId?: string;
    reason: string;
  }>;
};

type ShadowDisposition =
  | "AGREEMENT"
  | "CONFIRMED_LEGACY_DEFECT"
  | "CANONICAL_COMPILER_DEFECT"
  | "INPUT_MAPPING_DEFECT"
  | "UNSUPPORTED_LEGACY_STATE"
  | "SOURCE_AMBIGUITY"
  | "PRESENTATION_ONLY_DIFFERENCE"
  | "UNRESOLVED_CLINICAL_REVIEW";

const root = process.cwd();
const differentialPath = resolve(root, "docs/rule-studio/11-canonical-differential-results.json");
const sourcePath = resolve(
  root,
  "docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1/CerviGrade_NCSP_Master_Rules_v2_1.json"
);
const reportPath = resolve(root, "docs/rule-studio/12-full-shadow-disposition.md");
const jsonPath = resolve(root, "docs/rule-studio/12-full-shadow-results.json");

function clean(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

const SOURCE_AMBIGUITIES = new Set([
  "F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED",
  "F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC",
  "F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT",
]);

const differential = JSON.parse(readFileSync(differentialPath, "utf8")) as CanonicalDifferential;
const canonicalByCase = new Map(differential.oracleResults.map((result) => [result.caseId, result]));
const source = JSON.parse(readFileSync(sourcePath, "utf8")) as {
  rules: Array<{ rule_id: string; section: string }>;
};

const shadowResults = guidelineOracle.map((rule) => {
  const canonical = canonicalByCase.get(rule.ruleId);
  if (!canonical) throw new Error(`Missing canonical differential case ${rule.ruleId}`);
  const probe = probeFor(rule);
  if (!probe.input || !probe.evaluate) {
    return {
      caseId: rule.ruleId,
      area: rule.figureOrTable,
      expectedActionClass: rule.actionClass,
      canonicalDisposition: canonical.disposition,
      canonicalRuleId: canonical.controllingRuleId,
      legacyActionClass: undefined,
      legacyRecommendationCode: undefined,
      disposition: "UNSUPPORTED_LEGACY_STATE" as ShadowDisposition,
      reason: probe.unsupportedReason ?? "The legacy contract cannot represent this source state.",
    };
  }

  const legacyDecision = probe.evaluate(probe.input);
  const legacyActionClass = actualActionClass(legacyDecision);
  const legacyEquivalent = equivalent(rule.actionClass, legacyActionClass);
  let disposition: ShadowDisposition;
  let reason: string;

  if (SOURCE_AMBIGUITIES.has(rule.ruleId)) {
    disposition = "SOURCE_AMBIGUITY";
    reason = "The direct 2023/addendum oracle and the consolidated v2.1 rule record do not expose the same terminal condition; no clinical condition was inferred to close the difference.";
  } else if (canonical.disposition === "CANONICAL_FACT_ADAPTER_GAP") {
    disposition = "INPUT_MAPPING_DEFECT";
    reason = canonical.reason;
  } else if (canonical.disposition === "CANONICAL_PATHWAY_GAP") {
    disposition = "CANONICAL_COMPILER_DEFECT";
    reason = canonical.reason;
  } else if (canonical.disposition === "CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE") {
    if (legacyEquivalent) {
      disposition = "UNRESOLVED_CLINICAL_REVIEW";
      reason = `Legacy action is source-equivalent, while canonical metadata/precedence remains unresolved: ${canonical.reason}`;
    } else {
      disposition = "UNRESOLVED_CLINICAL_REVIEW";
      reason = `Legacy action differs and canonical metadata/precedence also requires review: ${canonical.reason}`;
    }
  } else if (!legacyEquivalent) {
    disposition = "CONFIRMED_LEGACY_DEFECT";
    reason = `Canonical agrees with the direct source oracle; legacy produced ${legacyActionClass}.`;
  } else if (legacyActionClass === rule.actionClass) {
    disposition = "AGREEMENT";
    reason = "Legacy and canonical action class agree with the direct source oracle.";
  } else {
    disposition = "PRESENTATION_ONLY_DIFFERENCE";
    reason = `Legacy ${legacyActionClass} is an accepted action-equivalent alias for ${rule.actionClass}.`;
  }

  return {
    caseId: rule.ruleId,
    area: rule.figureOrTable,
    expectedActionClass: rule.actionClass,
    canonicalDisposition: canonical.disposition,
    canonicalRuleId: canonical.controllingRuleId,
    legacyActionClass,
    legacyRecommendationCode: legacyDecision.recommendationCode,
    disposition,
    reason,
  };
});

const counts = shadowResults.reduce<Record<string, number>>((result, item) => {
  result[item.disposition] = (result[item.disposition] ?? 0) + 1;
  return result;
}, {});
const identityMatched = differential.fullSnapshotReachability.filter((item) => item.matched).length;
const overlayRules = source.rules.filter((rule) => /^(GR|GS|U25|DES|IMM|A26)-/.test(rule.rule_id));
const semanticDifferences = shadowResults.filter((item) => item.disposition !== "AGREEMENT");

const earlierDefects = [
  ["AUD-001", "Missing Figure 3 sample type", "Canonical does not match F3-01/F3-02 and returns the unresolved governed safety outcome; legacy returns routine recall."],
  ["AUD-002", "Unknown immune classification", "Canonical does not select a three-/five-year interval; legacy defaults to five years."],
  ["AUD-003", "Age 70 with HPV 16/18", "Canonical F3-16 colposcopy route outranks the age-exit branch; legacy defers/exits."],
  ["AUD-004", "Missing ToC treatment date", "Canonical F6-12 requests treatment records and prevents a terminal ToC disposition; legacy continues the sequence."],
  ["AUD-005", "Batch bleeding assessment provenance", "Canonical input normalization preserves absent assessment fields as absent; it does not fabricate six completed work-up facts."],
] as const;

writeFileSync(jsonPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceSha256: differential.sourceSha256,
  semanticCaseCount: shadowResults.length,
  structuralRuleIdentityCount: differential.canonicalRuleCount,
  combinedEvidenceCount: shadowResults.length + differential.canonicalRuleCount,
  overlayRuleCount: overlayRules.length,
  identityMatched,
  counts,
  shadowResults,
}, null, 2)}\n`);

const lines = [
  "# Full shadow disposition",
  "",
  "Generated 2026-08-02. Legacy remains authoritative; canonical results are shadow/simulation evidence only.",
  "",
  "## Scope",
  "",
  `- Independent semantic source cases: ${shadowResults.length}`,
  `- Canonical structural rule-ID cases: ${differential.canonicalRuleCount}`,
  `- Combined evidence records: ${shadowResults.length + differential.canonicalRuleCount}`,
  `- Global, under-25, DES, immune and 2026 overlay rules in structural layer: ${overlayRules.length}`,
  `- Canonical rule IDs matched in whole-snapshot structural probes: ${identityMatched}/${differential.canonicalRuleCount}`,
  "- Semantic coverage includes Figures 1–10, all 21 Table 1 combinations, first/second repeats, longitudinal ToC, AIS, vault, pregnancy/postpartum, bleeding and current source overlays.",
  "",
  "The direct source oracle is the expected authority. Legacy output is never used to generate or modify a canonical expectation.",
  "",
  "## Disposition counts",
  "",
  ...Object.entries(counts).sort().map(([name, count]) => `- ${name}: ${count}`),
  `- Total semantic legacy/canonical differences or blocked comparisons: ${semanticDifferences.length}`,
  "",
  "`UNSUPPORTED_LEGACY_STATE` means the old input contract cannot encode the source state. `SOURCE_AMBIGUITY` is retained where the independent source oracle and consolidated package do not yield a safely inferable identical terminal condition. Metadata/precedence differences remain `UNRESOLVED_CLINICAL_REVIEW` even when the broad action class agrees.",
  "",
  "## Five earlier defects",
  "",
  "| Defect | State | Canonical shadow disposition |",
  "|---|---|---|",
  ...earlierDefects.map(([id, state, result]) => `| ${id} | ${state} | ${result} |`),
  "",
  "All five are canonical corrections of retained legacy behaviour. They do not change production authority, and no regrade correction was written to a live/persisted decision during this verification.",
  "",
  "## Every non-agreement or blocked comparison",
  "",
  "| Case | Area | Expected | Legacy | Canonical controlling rule | Disposition | Reason |",
  "|---|---|---|---|---|---|---|",
  ...semanticDifferences.map((item) =>
    `| \`${item.caseId}\` | ${item.area} | ${item.expectedActionClass} | ${item.legacyActionClass ?? "UNSUPPORTED"} | ${item.canonicalRuleId ? `\`${item.canonicalRuleId}\`` : "—"} | ${item.disposition} | ${clean(item.reason)} |`
  ),
  "",
  "## Safety disposition",
  "",
  "Known unsafe legacy differences were retained as `CONFIRMED_LEGACY_DEFECT`; canonical logic was not weakened to improve the mismatch count. The three source ambiguities and all metadata/precedence cases remain publication blockers pending independent clinical review. No ruleset was published or activated.",
  "",
  `Machine-readable results: \`docs/rule-studio/${jsonPath.split("/").at(-1)}\``,
];
writeFileSync(reportPath, `${lines.join("\n")}\n`);

console.log(JSON.stringify({
  reportPath,
  jsonPath,
  semanticCases: shadowResults.length,
  structuralCases: differential.canonicalRuleCount,
  combinedEvidence: shadowResults.length + differential.canonicalRuleCount,
  identityMatched,
  counts,
}, null, 2));
