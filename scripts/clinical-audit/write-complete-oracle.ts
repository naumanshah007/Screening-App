import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { guidelineOracle, oracleCounts, type SourceArea } from "../../tests/clinical-conformance/support/guideline-oracle";

const root = resolve(process.cwd());
const jsonPath = resolve(root, "docs/clinical-audit/complete-guideline-oracle.json");
const markdownPath = resolve(root, "docs/clinical-audit/07-complete-guideline-oracle.md");
mkdirSync(dirname(jsonPath), { recursive: true });

writeFileSync(jsonPath, `${JSON.stringify(guidelineOracle, null, 2)}\n`, "utf8");

const order: SourceArea[] = [
  "Figure 1", "Figure 2", "Figure 3", "Figure 4", "Figure 5", "Figure 6",
  "Figure 7", "Figure 8", "Table 1", "Figure 9", "Figure 10",
];

const lines: string[] = [
  "# Complete source-derived NCSP guideline oracle",
  "",
  "Generated from the visually verified June 2023 final v1.1 guideline, with the February 2026 addendum applied only to its named scenarios and the March 2026 immune-deficiency v1.0.1 guidance applied to current immune classification/periodicity. The prior extraction report was used only as a secondary contradiction check. No expected outcome was derived from CerviGrade production code.",
  "",
  "## Counting convention",
  "",
  "A canonical branch is one distinct source condition vector ending in an action, recall/repeat interval, referral, clinician-only decision, incomplete-result state, or safety stop. Source-listed cytology categories, sample types, repeat stages, inclusive age thresholds, and immune-status outcomes remain separate even when they converge on the same action. Table 1 has one object for each of its 21 displayed history/pathology cells.",
  "",
  "| Source | Canonical terminal branches | Printed page | PDF page |",
  "|---|---:|---:|---:|",
  ...order.map((source) => {
    const first = guidelineOracle.find((rule) => rule.figureOrTable === source)!;
    return `| ${source} | ${oracleCounts[source]} | ${first.page} | ${first.pdfPage} |`;
  }),
  `| **Total** | **${guidelineOracle.length}** |  |  |`,
  "",
  "## Source controls and safety interpretation",
  "",
  "- The June 2023 guideline remains the base source for unaffected pathways.",
  "- Addendum v1.0 controls updated R6.05, R8.03, R8.06, R9.14, and the specified screening-after-gynaecological-cancer scenarios.",
  "- Immune-deficiency guidance v1.0.1 controls current classification and the three-year regular interval. Its case-by-case categories remain clinician-led rather than Boolean defaults.",
  "- Visible-lesion assessment, histology/biopsy interpretation, MDM/MDT outcomes, suspected invasion, and specialist treatment choices are clinician-led unless the source provides a deterministic routing action.",
  "- `localBookingPriority` is null throughout because the supplied package contains no approved local booking rule document.",
  "",
];

for (const source of order) {
  lines.push(`## ${source}`, "", "| Rule ID | Source condition | Expected action | Timing | Review | Current source |", "|---|---|---|---|---|---|");
  for (const rule of guidelineOracle.filter((candidate) => candidate.figureOrTable === source)) {
    const sourceLabel = rule.effectiveRuleVersion === "2023-v1.1" ? "2023 v1.1" : rule.effectiveRuleVersion;
    lines.push(`| \`${rule.ruleId}\` | ${rule.branchConditions.join("; ")} | ${rule.expectedAction} | ${rule.guidelineTimeframe ?? "—"} | ${rule.clinicianOnly ? "clinician-only" : rule.mandatoryClinicianReview ? "mandatory confirmation" : "provisional deterministic"} | ${sourceLabel} |`);
  }
  lines.push("");
}

lines.push(
  "## Machine-readable contract",
  "",
  "`complete-guideline-oracle.json` contains the full required schema for every object: source/version/page/recommendations, effective version, entry/exclusion/required/conditional facts, branch conditions, action/referral/timing, booking-priority separation, clinician-review flags, missing-data behaviour, rationale, supersession, and source ambiguity.",
  "",
  "This is an audit oracle for executable comparison. It is not clinical validation and must remain subject to formal clinical-governance review before product remediation or use.",
  ""
);

writeFileSync(markdownPath, lines.join("\n"), "utf8");
console.log(JSON.stringify({ rules: guidelineOracle.length, counts: oracleCounts, jsonPath, markdownPath }, null, 2));
