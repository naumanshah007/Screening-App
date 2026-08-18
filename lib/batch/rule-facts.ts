/**
 * Batch → rule-fact mapping.
 *
 * The admin-editable CaseRuleSetRelease rules match on human-readable fact
 * labels (e.g. "HPV 16/18", "HSIL", "Immune deficient"). The batch pipeline
 * works with structured CanonicalBatchCase fields. This module bridges the two,
 * mirroring `buildMappedFieldFacts` in lib/cases/grading.ts, so a pulled case
 * can be graded by the active rule release to produce a bookable triage grade.
 */

import type { CanonicalBatchCase } from "@/lib/batch/types";
import type { CaseRuleReleaseDefinition } from "@/lib/cases/rule-policy";
import {
  evaluateCaseRuleRelease,
  type RuleEvaluationFact,
  type RuleEvaluationResult,
} from "@/lib/cases/rule-evaluator";

function fact(label: string, valueText: string, detail: string): RuleEvaluationFact {
  return { label, valueText, evidence: `Lab/referral feed: ${detail}` };
}

/** Cytology enum → the fact labels the colposcopy ruleset recognises. */
function cytologyFacts(cytology: string | undefined): RuleEvaluationFact[] {
  switch (cytology) {
    case "NEGATIVE":
      return [fact("Normal cytology", "Negative", "cytology negative")];
    case "ASC_US":
      return [fact("ASC-US", "Detected", "cytology ASC-US")];
    case "LSIL":
      return [fact("LSIL", "Detected", "cytology LSIL")];
    case "ASC_H":
      return [fact("ASC-H", "Detected", "cytology ASC-H")];
    case "HSIL":
      return [fact("HSIL", "Detected", "cytology HSIL")];
    case "SCC":
      return [fact("Cancer suspicion cytology", "Detected", "cytology SCC")];
    case "AIS":
      return [fact("Glandular abnormality", "Detected", "cytology AIS")];
    case "AG1":
    case "AG2":
    case "AG3":
    case "AG4":
    case "AG5":
    case "AC1":
    case "AC2":
    case "AC3":
    case "AC4":
      return [fact("Glandular abnormality", "Detected", `cytology ${cytology}`)];
    default:
      return [];
  }
}

/** Histology enum → fact labels. */
function histologyFacts(histology: string | undefined): RuleEvaluationFact[] {
  switch (histology) {
    case "CIN2":
      return [fact("CIN2", "Detected", "histology CIN2")];
    case "CIN3":
      return [fact("CIN3", "Detected", "histology CIN3")];
    case "CIN1":
      return [fact("Previous LSIL histology", "Detected", "histology CIN1")];
    case "SCC":
    case "ADENOCARCINOMA":
      return [fact("Cancer suspicion cytology", "Detected", `histology ${histology}`)];
    default:
      return [];
  }
}

export function buildBatchRuleFacts(c: CanonicalBatchCase): RuleEvaluationFact[] {
  const facts: RuleEvaluationFact[] = [];

  // HPV
  if (c.hpvResult === "HPV_16_18") facts.push(fact("HPV 16/18", "Detected", "HPV 16/18 detected"));
  else if (c.hpvResult === "HPV_OTHER") facts.push(fact("HPV Other", "Detected", "HPV (other) detected"));
  else if (c.hpvResult === "NOT_DETECTED") facts.push(fact("HPV Not Detected", "Not detected", "HPV not detected"));

  // Cytology + histology
  facts.push(...cytologyFacts(c.cytologyResult));
  facts.push(...histologyFacts(c.histologyResult));

  // Clinical context flags
  if (c.immunocompromised) facts.push(fact("Immune deficient", "Yes", "immune deficient"));
  if (c.isTestOfCure || c.testOfCureStatus === "COMPLETE" || c.repeatContext === "TEST_OF_CURE") {
    facts.push(fact("Positive test of cure", "Yes", "test-of-cure re-referral"));
  }
  if (c.abnormalCervix) facts.push(fact("Abnormal appearance", "Yes", "abnormal cervical appearance"));
  if (c.normalColposcopy) facts.push(fact("Previous normal colposcopy", "Yes", "previous normal colposcopy"));
  if (c.previousHSILCIN23) facts.push(fact("CIN3", "History", "previous HSIL/CIN2-3"));
  if (c.repeatStage === "SECOND_REPEAT") facts.push(fact("Second HPV positive result", "Yes", "second repeat HPV"));

  return facts;
}

/** SCC/adenocarcinoma cytology or histology, or explicit suspicion → HSC flag. */
export function deriveBatchHighSuspicion(c: CanonicalBatchCase): boolean {
  return (
    c.cytologyResult === "SCC" ||
    c.histologyResult === "SCC" ||
    c.histologyResult === "ADENOCARCINOMA" ||
    c.suspicionOfCancer === true ||
    c.hasCancerSymptoms === true
  );
}

/** Grade a pulled case against a rule release definition (booking triage grade). */
export function gradeCanonicalCase(args: {
  ruleDefinition: CaseRuleReleaseDefinition;
  batchCase: CanonicalBatchCase;
}): RuleEvaluationResult {
  return evaluateCaseRuleRelease({
    serviceLine: args.ruleDefinition.serviceLine,
    ruleDefinition: args.ruleDefinition,
    highSuspicionCancer: deriveBatchHighSuspicion(args.batchCase),
    facts: buildBatchRuleFacts(args.batchCase),
  });
}
