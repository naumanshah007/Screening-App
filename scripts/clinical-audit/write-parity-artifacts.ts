import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ClinicalInput } from "../../lib/engine/types";
import { guidelineOracle, oracleCounts, type GuidelineRule } from "../../tests/clinical-conformance/support/guideline-oracle";
import { actualActionClass, equivalent, probeFor } from "../../tests/clinical-conformance/support/conformance-runner";

const root = resolve(process.cwd());
type ImplementedEntry = { internalRuleId: string; file: string; line: number; function: string; accessibleThroughWizard: string; accessibleThroughBatch: string; accessibleThroughApi: string; storedInPersistence: string; visibleInReviewQueue: string; representedInExport: string };
const implemented = JSON.parse(readFileSync(resolve(root, "docs/clinical-audit/expanded-implemented-rules.json"), "utf8")) as ImplementedEntry[];
const implementedByCode = new Map(implemented.map((entry) => [entry.internalRuleId, entry]));

type Classification =
  | "EXACT_MATCH"
  | "MATCH_WITH_WORDING_DIFFERENCE"
  | "PARTIAL_IMPLEMENTATION"
  | "INCORRECT_CONDITION"
  | "INCORRECT_OUTPUT"
  | "INCORRECT_TIMING"
  | "INCORRECT_DESTINATION"
  | "INCORRECT_REVIEW_REQUIREMENT"
  | "MISSING_RULE"
  | "UNREACHABLE_RULE"
  | "UNSUPPORTED_BY_DATA_MODEL"
  | "UNSUPPORTED_BY_UI"
  | "NOT_PERSISTED"
  | "OBSOLETE_2023_RULE"
  | "UPDATED_RULE_NOT_IMPLEMENTED"
  | "CLINICAL_GOVERNANCE_REQUIRED"
  | "UNSOURCED_IMPLEMENTED_RULE"
  | "LOCAL_RULE_REQUIRES_GOVERNANCE"
  | "POSSIBLE_OVERREACH";

type ParityRow = {
  rowType: "GUIDELINE" | "IMPLEMENTED_ONLY";
  ruleId: string;
  source: string;
  page: number | null;
  classification: Classification;
  expectedAction: string;
  actualCode: string | null;
  actualAction: string | null;
  codeLocation: string | null;
  clinicalConsequence: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  goldenExecutable: boolean;
  goldenPass: boolean;
  missingDataPass: boolean | null;
  wizard: string;
  api: string;
  batch: string;
  persistence: string;
  reviewQueue: string;
  export: string;
};

function expectedMonths(rule: GuidelineRule): number | null {
  const match = rule.repeatInterval?.match(/^(\d+) months$/);
  return match ? Number(match[1]) : null;
}

function reviewBoundary(rule: GuidelineRule, decision: ReturnType<NonNullable<ReturnType<typeof probeFor>["evaluate"]>>): boolean {
  return !rule.clinicianOnly || decision.safetyOutcome === "CLINICIAN_REVIEW_REQUIRED" || decision.referralRequired === true || decision.requiresMDMReview === true;
}

function severityFor(rule: GuidelineRule, classification: Classification): ParityRow["severity"] {
  if (["EXACT_MATCH", "MATCH_WITH_WORDING_DIFFERENCE"].includes(classification)) return "LOW";
  const cancerSensitive = rule.actionClass.includes("ONCOLOGY") || rule.actionClass.includes("URGENT") || rule.branchConditions.some((item) => /cancer|invasion|SCC|adenocarcinoma/i.test(item));
  if (cancerSensitive && ["INCORRECT_OUTPUT", "UNSUPPORTED_BY_DATA_MODEL", "UPDATED_RULE_NOT_IMPLEMENTED"].includes(classification)) return "CRITICAL";
  if (["COLPOSCOPY", "TEST_OF_CURE", "CONTINUE_TOC", "TREATMENT", "COMMUNITY_TOC"].includes(rule.actionClass) || classification === "UNSUPPORTED_BY_DATA_MODEL") return "HIGH";
  return classification === "INCORRECT_TIMING" || classification === "INCORRECT_REVIEW_REQUIREMENT" ? "MEDIUM" : "HIGH";
}

function consequenceFor(rule: GuidelineRule, classification: Classification): string {
  if (["EXACT_MATCH", "MATCH_WITH_WORDING_DIFFERENCE"].includes(classification)) return "No material action mismatch demonstrated by the golden probe; provenance/reachability may still be partial.";
  if (classification === "UNSUPPORTED_BY_DATA_MODEL") return `Required source facts cannot be represented, so ${rule.actionClass} cannot be reproduced safely.`;
  if (classification === "UPDATED_RULE_NOT_IMPLEMENTED") return "The current engine identifies rule version business-figures-table1-v1 and has no explicit branch for the controlling 2026 update.";
  if (classification === "INCORRECT_REVIEW_REQUIREMENT") return "A clinician-led source decision can be exposed without the required explicit review boundary.";
  if (classification === "INCORRECT_TIMING") return "The implemented interval differs from the source interval and may delay or accelerate follow-up.";
  if (classification === "INCORRECT_DESTINATION") return "The implementation sends the case to a different service than the source pathway.";
  if (classification === "PARTIAL_IMPLEMENTATION") return "The golden action may match, but deleting a critical source fact still permits a non-stop output or end-to-end support is incomplete.";
  return `The implemented action does not match the source-derived ${rule.actionClass} outcome.`;
}

const rows: ParityRow[] = [];
for (const rule of guidelineOracle) {
  const probe = probeFor(rule);
  if (!probe.input || !probe.evaluate) {
    const classification: Classification = rule.effectiveRuleVersion.startsWith("2026") ? "UPDATED_RULE_NOT_IMPLEMENTED" : "UNSUPPORTED_BY_DATA_MODEL";
    rows.push({ rowType: "GUIDELINE", ruleId: rule.ruleId, source: `${rule.figureOrTable} ${rule.recommendationNumbers.join(", ")}`, page: rule.page, classification, expectedAction: rule.expectedAction, actualCode: null, actualAction: probe.unsupportedReason ?? null, codeLocation: null, clinicalConsequence: consequenceFor(rule, classification), severity: severityFor(rule, classification), goldenExecutable: false, goldenPass: false, missingDataPass: null, wizard: "NO", api: "NO", batch: "NO", persistence: "NO", reviewQueue: "NO", export: "NO" });
    continue;
  }

  const decision = probe.evaluate(probe.input);
  const actualClass = actualActionClass(decision);
  const actionMatch = equivalent(rule.actionClass, actualClass);
  const referralMatch = !rule.referralRequired || decision.referralRequired === true;
  const interval = expectedMonths(rule);
  const timingMatch = interval === null || decision.recallIntervalMonths === interval;
  const reviewMatch = reviewBoundary(rule, decision);
  let missingDataPass: boolean | null = null;
  if (probe.missingKey) {
    const missingInput = { ...probe.input };
    delete (missingInput as Partial<ClinicalInput>)[probe.missingKey];
    const missingDecision = probe.evaluate(missingInput);
    missingDataPass = missingDecision.safetyOutcome === "INSUFFICIENT_INFORMATION" || missingDecision.safetyOutcome === "EXTERNAL_HISTORY_REQUIRED" || missingDecision.safetyOutcome === "CLINICIAN_REVIEW_REQUIRED" || missingDecision.requiresMDMReview === true;
  }

  let classification: Classification;
  if (rule.effectiveRuleVersion.startsWith("2026") && decision.ruleVersion !== rule.effectiveRuleVersion) classification = "UPDATED_RULE_NOT_IMPLEMENTED";
  else if (!actionMatch) classification = rule.clinicianOnly && !reviewMatch ? "INCORRECT_REVIEW_REQUIREMENT" : "INCORRECT_OUTPUT";
  else if (!referralMatch) classification = "INCORRECT_DESTINATION";
  else if (!timingMatch) classification = "INCORRECT_TIMING";
  else if (!reviewMatch) classification = "INCORRECT_REVIEW_REQUIREMENT";
  else if (missingDataPass === false) classification = "PARTIAL_IMPLEMENTATION";
  else classification = decision.recommendationCode === rule.ruleId ? "EXACT_MATCH" : "MATCH_WITH_WORDING_DIFFERENCE";

  const code = implementedByCode.get(decision.recommendationCode);
  rows.push({ rowType: "GUIDELINE", ruleId: rule.ruleId, source: `${rule.figureOrTable} ${rule.recommendationNumbers.join(", ")}`, page: rule.page, classification, expectedAction: rule.expectedAction, actualCode: decision.recommendationCode, actualAction: `${actualClass}: ${decision.nextAction}`, codeLocation: code ? `${code.file}:${code.line} (${code.function})` : "lib/engine/decision-engine.ts (dynamic/helper output)", clinicalConsequence: consequenceFor(rule, classification), severity: severityFor(rule, classification), goldenExecutable: true, goldenPass: actionMatch && referralMatch && timingMatch && reviewMatch, missingDataPass, wizard: code?.accessibleThroughWizard ?? "PARTIAL", api: code?.accessibleThroughApi ?? "PARTIAL", batch: code?.accessibleThroughBatch ?? "PARTIAL", persistence: code?.storedInPersistence ?? "PARTIAL", reviewQueue: code?.visibleInReviewQueue ?? "PARTIAL", export: code?.representedInExport ?? "PARTIAL" });
}

const implementedOnly: Array<[string, Classification, string, ParityRow["severity"]]> = [
  ["AGE-70-74-DEFERRED", "POSSIBLE_OVERREACH", "Unconditional age routing precedes current HPV-result management and intercepts HPV 16/18.", "CRITICAL"],
  ["AGE-75-DISCHARGE", "POSSIBLE_OVERREACH", "Age-only discharge is not conditioned on the negative exit-test/history requirements.", "CRITICAL"],
  ["F3-INAD-3M", "UNSOURCED_IMPLEMENTED_RULE", "The source says invalid/unsuitable HPV may be repeated without delay/as soon as practicable; the code fixes a three-month interval.", "HIGH"],
  ["ENGINE-REFERRAL-PRIORITIES", "LOCAL_RULE_REQUIRES_GOVERNANCE", "P1/P2 priorities are embedded throughout the national-pathway engine without an approved local booking source in the package.", "MEDIUM"],
  ["F7-DETERMINISTIC-SPECIALIST-OUTPUTS", "POSSIBLE_OVERREACH", "MDM, biopsy, excision, and oncology-dependent branches are represented as terminal codes that need explicit clinician-only governance.", "HIGH"],
  ["F10-FIXED-2-MONTH-RECALL", "MATCH_WITH_WORDING_DIFFERENCE", "The source states 6–8 weeks while the code stores two months; display/provenance should preserve the exact source range.", "LOW"],
];
for (const [ruleId, classification, consequence, severity] of implementedOnly) {
  const code = implementedByCode.get(ruleId);
  rows.push({ rowType: "IMPLEMENTED_ONLY", ruleId, source: "No exact supplied national/local source for the implemented formulation", page: null, classification, expectedAction: "Requires source reconciliation or clinical governance.", actualCode: ruleId, actualAction: consequence, codeLocation: code ? `${code.file}:${code.line}` : "multiple engine branches", clinicalConsequence: consequence, severity, goldenExecutable: false, goldenPass: false, missingDataPass: null, wizard: code?.accessibleThroughWizard ?? "PARTIAL", api: code?.accessibleThroughApi ?? "PARTIAL", batch: code?.accessibleThroughBatch ?? "PARTIAL", persistence: code?.storedInPersistence ?? "PARTIAL", reviewQueue: code?.visibleInReviewQueue ?? "PARTIAL", export: code?.representedInExport ?? "PARTIAL" });
}

function csv(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
const headers = Object.keys(rows[0]) as Array<keyof ParityRow>;
writeFileSync(resolve(root, "docs/clinical-audit/complete-rule-parity.csv"), `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csv(row[header])).join(",")).join("\n")}\n`, "utf8");

const classificationCounts = rows.reduce<Record<string, number>>((result, row) => {
  result[row.classification] = (result[row.classification] ?? 0) + 1;
  return result;
}, {});
const severityCounts = rows.filter((row) => row.rowType === "GUIDELINE" && !["EXACT_MATCH", "MATCH_WITH_WORDING_DIFFERENCE"].includes(row.classification)).reduce<Record<string, number>>((result, row) => {
  result[row.severity] = (result[row.severity] ?? 0) + 1;
  return result;
}, {});
const md = [
  "# Complete rule-to-code parity matrix",
  "",
  `Compared **${guidelineOracle.length}** source-derived canonical branches with **${implemented.length}** distinct current engine output/safety codes. Six implemented-only governance/overreach rows are appended.`,
  "",
  "## Classification totals",
  "",
  "| Classification | Rows |",
  "|---|---:|",
  ...Object.entries(classificationCounts).sort().map(([key, value]) => `| ${key} | ${value} |`),
  "",
  "## Mismatch severity totals (guideline rows only)",
  "",
  "| Severity | Rows |",
  "|---|---:|",
  ...Object.entries(severityCounts).map(([key, value]) => `| ${key} | ${value} |`),
  "",
  "## Matrix",
  "",
  "| Guideline/current rule | Source | Classification | Actual code | Severity | Golden | Missing-data stop | Consequence |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map((row) => `| \`${row.ruleId}\` | ${row.source} | ${row.classification} | ${row.actualCode ? `\`${row.actualCode}\`` : "—"} | ${row.severity} | ${row.goldenExecutable ? row.goldenPass ? "pass" : "fail" : "unsupported"} | ${row.missingDataPass === null ? "n/a" : row.missingDataPass ? "pass" : "fail"} | ${row.clinicalConsequence} |`),
  "",
  "The machine-readable CSV includes channel/persistence/review/export reachability and exact code locations. A matching golden action does not imply end-to-end clinical correctness when required data can be defaulted, provenance is missing, or a later source version is not represented.",
  "",
].join("\n");
writeFileSync(resolve(root, "docs/clinical-audit/09-complete-rule-parity-matrix.md"), md, "utf8");

console.log(JSON.stringify({ oracleCounts, oracleRules: guidelineOracle.length, implementedOutputs: implemented.length, matrixRows: rows.length, classificationCounts, severityCounts }, null, 2));
