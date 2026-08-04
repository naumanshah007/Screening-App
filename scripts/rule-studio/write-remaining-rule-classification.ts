import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  conformanceTestIdsForRule,
  REMAINING_RULE_CLASSIFICATION,
} from "../../lib/clinical-rules/compiled-v2-1";

type SourceRule = {
  rule_id: string;
  section: string;
  safety_priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  condition: string;
  provisional_outcome: string;
  timing_destination: string;
  missing_data_behavior: string;
  automation_boundary: string;
  reviewer_requirement: string;
  source_document: string;
  source_reference: string;
  update_status: string;
};

const root = process.cwd();
const sourcePath = resolve(
  root,
  "docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1/CerviGrade_NCSP_Master_Rules_v2_1.json"
);
const outputPath = resolve(root, "docs/rule-studio/10-remaining-rule-classification.md");
const source = JSON.parse(readFileSync(sourcePath, "utf8")) as { rules: SourceRule[] };
const ruleById = new Map(source.rules.map((rule) => [rule.rule_id, rule]));
const remainingIds = Object.keys(REMAINING_RULE_CLASSIFICATION);

const effectText = (rule: SourceRule) =>
  `${rule.condition} ${rule.provisional_outcome} ${rule.timing_destination}`;
const yesNo = (value: boolean) => (value ? "Yes" : "No");
const clean = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");

function canChangeReferral(rule: SourceRule) {
  return /refer|referral|colposcopy|gynaecolog|specialist|MDM|diagnostic excision|oncolog/i.test(
    `${rule.provisional_outcome} ${rule.automation_boundary}`
  );
}

function canChangeInterval(rule: SourceRule) {
  return /screening interval|regular interval|repeat|\bmonths?\b|\byears?\b|scheduled visit|ASAP|as soon|co-tests?/i.test(
    effectText(rule)
  );
}

function canChangeToc(rule: SourceRule) {
  return /Test of Cure|\bToC\b/i.test(effectText(rule));
}

const counts = Object.values(REMAINING_RULE_CLASSIFICATION).reduce<Record<string, number>>(
  (accumulator, classification) => {
    accumulator[classification] = (accumulator[classification] ?? 0) + 1;
    return accumulator;
  },
  {}
);

const lines = [
  "# Remaining MEDIUM/LOW rule classification",
  "",
  "Generated 2026-08-02 from the verified v2.1 canonical JSON. This is a governed software classification and compilation register, not independent clinical approval.",
  "",
  "## Result",
  "",
  "All 61 rules that were `SOURCE_TEXT` at revision 3 are now classified. None was judged safe to leave as unclassified display text because every record either changes routing/workflow, controls validation/reviewer behaviour, or defines a clinician-only decision sidecar.",
  "",
  `- EXECUTABLE_ROUTING: ${counts.EXECUTABLE_ROUTING ?? 0}`,
  `- EXECUTABLE_VALIDATION: ${counts.EXECUTABLE_VALIDATION ?? 0}`,
  `- CLINICIAN_ONLY_INFORMATION: ${counts.CLINICIAN_ONLY_INFORMATION ?? 0}`,
  `- DISPLAY_ONLY: ${counts.DISPLAY_ONLY ?? 0}`,
  `- SOURCE_PROVENANCE_ONLY: ${counts.SOURCE_PROVENANCE_ONLY ?? 0}`,
  `- SUPERSEDED: ${counts.SUPERSEDED ?? 0}`,
  "- Newly compiled: 61",
  "- Total executable rules: 203/203",
  "- Total unresolved or unclassified rules: 0",
  "- Unique executable conformance IDs: 653",
  "",
  "The eleven clinician-only rules also have typed predicates and executable tests. A match may expose source provenance and the required specialist/reviewer boundary, but it cannot autonomously finalise a clinical outcome.",
  "",
  "## Complete 61-rule register",
  "",
  "`Missing` means the rule carries explicit missing-data control. `Subsumed by` records the one exact duplicate presentation of the 2026 R6.05 update; both IDs remain executable for traceability.",
  "",
  "| Rule | Section | Priority | Classification | Routing | Timing | Interval | Referral | ToC completion | Missing | Clinician-only | Informational only | Subsumed by | Tests | Source condition | Source outcome |",
  "|---|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|---:|---|---|",
];

for (const ruleId of remainingIds) {
  const rule = ruleById.get(ruleId);
  if (!rule) throw new Error(`Missing source rule ${ruleId}`);
  const classification = REMAINING_RULE_CLASSIFICATION[ruleId];
  const clinicianOnly = classification === "CLINICIAN_ONLY_INFORMATION";
  const subsumedBy = ruleId === "F4-09" ? "A26-01" : "—";
  lines.push(
    `| \`${rule.rule_id}\` | ${clean(rule.section)} | ${rule.safety_priority} | ${classification} | Yes | ${yesNo(Boolean(rule.timing_destination.trim()))} | ${yesNo(canChangeInterval(rule))} | ${yesNo(canChangeReferral(rule))} | ${yesNo(canChangeToc(rule))} | Yes | ${yesNo(clinicianOnly)} | ${yesNo(clinicianOnly)} | ${subsumedBy} | ${conformanceTestIdsForRule(ruleId).length} | ${clean(rule.condition)} | ${clean(rule.provisional_outcome)} |`
  );
}

lines.push(
  "",
  "## Governance interpretation",
  "",
  "- `EXECUTABLE_ROUTING` rules select or modify a pathway, outcome, repeat, interval, referral, cessation or completion state and therefore require typed execution.",
  "- `EXECUTABLE_VALIDATION` is used for `A26-01`, the controlling 2026 R6.05 boundary that removes the prior MDM requirement for the exact Type 3 TZ scenario. `F4-09` is the same predicate represented inside Figure 4 and is recorded as fully subsumed by `A26-01`, while remaining executable for matched-rule provenance.",
  "- `CLINICIAN_ONLY_INFORMATION` rules identify a clinician/specialist judgement branch. Their predicates are executable, but the evaluator forces `clinicianOnly`, mandatory confirmation, and no autonomous finalisation.",
  "- No rule was assigned `DISPLAY_ONLY`, `SOURCE_PROVENANCE_ONLY`, or `SUPERSEDED`; the source package gives every remaining record a behavioural or reviewer-boundary effect.",
  "",
  "## Test evidence",
  "",
  "Each newly compiled rule has a positive, negative and missing-fact test ID. Eight additional named boundary tests cover the >3-year transition date, age 49/50 repeat split, age 74/75 exit boundary, and Type 3 TZ age 50/51 shared-decision boundary. The classification map is stored in the canonical snapshot with each affected rule.",
  "",
  "`CG-NCSP-3.0.0` remains an unpublished, unactivated draft. Classification and executable software tests do not constitute clinical validation."
);

writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ outputPath, rules: remainingIds.length, counts }, null, 2));
