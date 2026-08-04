import {
  CLINICAL_RULE_ENGINE_CONTRACT_V2,
  CLINICAL_RULE_SUCCESSOR_SNAPSHOT_SCHEMA_VERSION,
  ClinicalRuleSnapshotSchema,
  type ClinicalRuleSnapshot,
  type ConditionExpression,
  type RuleDefinition,
} from "./schema";
import {
  buildSnapshotFromV21Package,
  type SourcePackageVerification,
} from "./source-package";

export const SUCCESSOR_PRODUCT_VERSION = "CG-NCSP-3.1.0" as const;
export const SUCCESSOR_PRODUCT_VERSION_PARTS = {
  major: 3,
  minor: 1,
  patch: 0,
} as const;

const fact = (
  name: string,
  operator: Extract<ConditionExpression, { type: "FACT" }>["operator"],
  value?: string | number | boolean | Array<string | number | boolean>
): ConditionExpression => ({
  type: "FACT",
  fact: name,
  operator,
  ...(value === undefined ? {} : { value }),
});
const eq = (name: string, value: string | number | boolean) =>
  fact(name, "EQ", value);
const oneOf = (name: string, values: Array<string | number | boolean>) =>
  fact(name, "IN", values);
const gte = (name: string, value: number) => fact(name, "GTE", value);
const lt = (name: string, value: number) => fact(name, "LT", value);
const all = (...expressions: ConditionExpression[]): ConditionExpression => ({
  type: "ALL",
  expressions,
});
const any = (...expressions: ConditionExpression[]): ConditionExpression => ({
  type: "ANY",
  expressions,
});

const HPV_DETECTED = ["HPV_16", "HPV_18", "HPV_16_18", "HPV_OTHER"];

function sourceReferences(rule: RuleDefinition) {
  return structuredClone(rule.sourceReferences);
}

function patchRule(
  snapshot: ClinicalRuleSnapshot,
  ruleId: string,
  patch: Partial<RuleDefinition>
) {
  const index = snapshot.rules.findIndex((rule) => rule.stableRuleId === ruleId);
  if (index < 0) throw new Error(`Successor patch references unknown rule ${ruleId}.`);
  snapshot.rules[index] = { ...snapshot.rules[index], ...structuredClone(patch) };
}

function synchronizeRuleNodes(snapshot: ClinicalRuleSnapshot) {
  const rules = new Map(snapshot.rules.map((rule) => [rule.stableRuleId, rule]));
  for (const node of snapshot.nodes) {
    if (node.linkedRuleIds.length !== 1) continue;
    const rule = rules.get(node.linkedRuleIds[0]);
    if (!rule) continue;
    node.requiredFacts = structuredClone(rule.requiredFacts);
    node.sourceReferences = structuredClone(rule.sourceReferences);
    node.reviewerRequirement = rule.reviewerRequirement;
    if (node.nodeType === "DECISION") {
      node.label = rule.sourceConditionText;
      node.shortLabel = rule.sourceConditionText;
    }
    if (node.stableNodeId.startsWith("node:outcome:")) {
      node.label = rule.provisionalOutcome;
      node.shortLabel = rule.provisionalOutcome;
      node.provisionalOutcome = rule.provisionalOutcome;
      node.timingDestination = rule.timingDestination;
    }
  }
}

function applyReleaseHardeningPatches(snapshot: ClinicalRuleSnapshot) {
  const f3_19 = snapshot.rules.find((rule) => rule.stableRuleId === "F3-19")!;
  patchRule(snapshot, "F3-19", {
    evaluationPriority: 900,
    conditionExpression: all(
      eq("currentPathway", "FIGURE_3"),
      eq("hpvResult", "HPV_OTHER"),
      eq("cytologyAdequacy", "UNSATISFACTORY"),
      fact("consecutiveUnsatisfactoryCount", "EXISTS")
    ),
    outcomeBranches: [
      {
        id: "second-consecutive-colposcopy",
        conditionExpression: gte("consecutiveUnsatisfactoryCount", 2),
        provisionalOutcome:
          "Refer to colposcopy after two consecutive unsatisfactory cytology results.",
        timingDestination: "Without avoidable delay",
        careSetting: "Colposcopy service",
        urgency: "PROMPT",
        reviewerRequirement: "MANDATORY_CLINICIAN_CONFIRMATION",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f3_19),
      },
      {
        id: "first-unsatisfactory-repeat",
        conditionExpression: lt("consecutiveUnsatisfactoryCount", 2),
        provisionalOutcome:
          "Repeat LBC cytology no sooner than 6 weeks and no later than 3 months.",
        timingDestination: "6 weeks to 3 months",
        careSetting: "Primary/community care or programme follow-up",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f3_19),
      },
    ],
  });
  patchRule(snapshot, "F3-22", {
    conditionExpression: all(
      eq("currentPathway", "FIGURE_3"),
      oneOf("eventStage", ["INITIAL", "FIRST_REPEAT", "SECOND_REPEAT"]),
      any(
        oneOf("hpvValidity", ["INVALID", "UNSUITABLE"]),
        oneOf("cytologyResult", [
          "ATYPICAL_ENDOMETRIAL",
          "MALIGNANT_ENDOMETRIAL",
        ])
      )
    ),
  });

  patchRule(snapshot, "F2-02", {
    timingDestination:
      "6 and 18 months when HPV-detected AIS has clear excision margins",
    careSetting:
      "Colposcopy or primary/community care according to current R9.14",
    clinicianOnly: false,
  });
  patchRule(snapshot, "F2-05", {
    timingDestination: "As soon as practicable",
  });

  const f3_05 = snapshot.rules.find((rule) => rule.stableRuleId === "F3-05")!;
  patchRule(snapshot, "F3-05", {
    outcomeBranches: [
      {
        id: "squamous-high-grade-colposcopy",
        conditionExpression: oneOf("cytologyResult", ["ASC_H", "HSIL"]),
        provisionalOutcome: "Refer to colposcopy.",
        timingDestination: "According to the colposcopy referral risk category",
        careSetting: "Colposcopy service",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f3_05),
      },
      {
        id: "ais-colposcopy-route",
        conditionExpression: eq("cytologyResult", "AIS"),
        provisionalOutcome: "Refer to colposcopy under the AIS pathway.",
        timingDestination: "Referral",
        careSetting: "Colposcopy service",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f3_05),
      },
      {
        id: "glandular-specialist-route",
        conditionExpression: oneOf("cytologyResult", [
          "AG1",
          "AG3",
          "AG4",
          "AG5",
          "AC1",
          "AC3",
          "AC4",
        ]),
        provisionalOutcome:
          "Refer to colposcopy or the applicable glandular specialist pathway.",
        timingDestination:
          "Urgent where invasive glandular disease is suspected or definite",
        careSetting: "Colposcopy or specialist gynaecology",
        urgency: "PROMPT",
        reviewerRequirement: "SPECIALIST_REVIEW",
        clinicianOnly: true,
        sourceReferences: sourceReferences(f3_05),
      },
    ],
  });
  patchRule(snapshot, "F3-20", {
    timingDestination: "Urgent; within 2 weeks",
    clinicianOnly: false,
  });
  patchRule(snapshot, "F3-04", {
    reviewerRequirement: "CLINICIAN_REVIEW",
    clinicianOnly: false,
  });
  const f3_10 = snapshot.rules.find((rule) => rule.stableRuleId === "F3-10")!;
  patchRule(snapshot, "F3-10", {
    clinicianOnly: false,
    outcomeBranches: [
      {
        id: "squamous-high-grade-colposcopy",
        conditionExpression: oneOf("cytologyResult", ["ASC_H", "HSIL"]),
        provisionalOutcome: "Refer to colposcopy.",
        timingDestination: "Referral",
        careSetting: "Colposcopy service",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f3_10),
      },
      {
        id: "ais-colposcopy-route",
        conditionExpression: eq("cytologyResult", "AIS"),
        provisionalOutcome: "Refer to colposcopy under the AIS pathway.",
        timingDestination: "Referral",
        careSetting: "Colposcopy service",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f3_10),
      },
      {
        id: "glandular-specialist-route",
        conditionExpression: oneOf("cytologyResult", [
          "AG1",
          "AG3",
          "AG4",
          "AG5",
          "AC1",
          "AC3",
          "AC4",
        ]),
        provisionalOutcome: "Refer to colposcopy/specialist pathway.",
        timingDestination: "Urgent where invasive glandular disease is suspected",
        careSetting: "Colposcopy or specialist gynaecology",
        urgency: "PROMPT",
        reviewerRequirement: "SPECIALIST_REVIEW",
        clinicianOnly: true,
        sourceReferences: sourceReferences(f3_10),
      },
    ],
  });

  patchRule(snapshot, "F5-04", { evaluationPriority: 730 });
  patchRule(snapshot, "F5-05", { evaluationPriority: 710 });
  for (const ruleId of ["F5-06", "F5-07", "F5-08"]) {
    patchRule(snapshot, ruleId, { evaluationPriority: 760 });
  }
  patchRule(snapshot, "F5-04", {
    evaluationPriority: 730,
    careSetting: "Colposcopy/specialist decision service",
  });
  patchRule(snapshot, "F5-02", { clinicianOnly: true });

  const f4_04 = snapshot.rules.find((rule) => rule.stableRuleId === "F4-04")!;
  patchRule(snapshot, "F4-04", {
    outcomeBranches: [
      {
        id: "squamous-high-grade-colposcopy",
        conditionExpression: oneOf("cytologyResult", ["ASC_H", "HSIL"]),
        provisionalOutcome: "Refer to colposcopy.",
        timingDestination: "Referral",
        careSetting: "Colposcopy service",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f4_04),
      },
      {
        id: "ais-colposcopy-route",
        conditionExpression: eq("cytologyResult", "AIS"),
        provisionalOutcome: "Refer to colposcopy under the AIS pathway.",
        timingDestination: "Referral",
        careSetting: "Colposcopy service",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f4_04),
      },
      {
        id: "glandular-specialist-route",
        conditionExpression: oneOf("cytologyResult", [
          "AG1",
          "AG3",
          "AG4",
          "AG5",
          "AC1",
          "AC3",
          "AC4",
        ]),
        provisionalOutcome:
          "Refer to colposcopy or the applicable glandular specialist pathway.",
        timingDestination: "Referral",
        careSetting: "Colposcopy or specialist gynaecology",
        reviewerRequirement: "SPECIALIST_REVIEW",
        clinicianOnly: true,
        sourceReferences: sourceReferences(f4_04),
      },
    ],
  });
  patchRule(snapshot, "F4-06", {
    timingDestination: "Repeat in 12 months (24 months post-discharge)",
  });
  const f4_07 = snapshot.rules.find((rule) => rule.stableRuleId === "F4-07")!;
  patchRule(snapshot, "F4-07", {
    outcomeBranches: [
      {
        id: "immune-competent-five-year-recall",
        conditionExpression: eq("immuneClassification", "IMMUNE_COMPETENT"),
        provisionalOutcome: "Return to regular screening in 5 years.",
        timingDestination: "5 years",
        careSetting: "Primary/community care or programme follow-up",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f4_07),
      },
      {
        id: "immune-deficient-three-year-recall",
        conditionExpression: eq("immuneClassification", "IMMUNE_DEFICIENT"),
        provisionalOutcome: "Return for screening in 3 years.",
        timingDestination: "3 years",
        careSetting: "Primary/community care or programme follow-up",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f4_07),
      },
    ],
  });
  patchRule(snapshot, "F4-09", {
    timingDestination: "12-month repeat under Figure 4 surveillance",
    reviewerRequirement: "CLINICIAN_REVIEW",
    clinicianOnly: false,
  });
  patchRule(snapshot, "F4-15", {
    careSetting: "Urgent colposcopy/specialist assessment",
    clinicianOnly: false,
  });

  patchRule(snapshot, "F6-06", {
    evaluationPriority: 820,
    conditionExpression: all(
      eq("currentPathway", "FIGURE_6"),
      eq("isTestOfCureEvent", true),
      eq("hpvResult", "NOT_DETECTED"),
      oneOf("cytologyResult", ["ASC_US", "LSIL"]),
      lt("consecutiveLowGradeCytologyResults", 2)
    ),
  });
  patchRule(snapshot, "F6-07", { evaluationPriority: 830 });
  patchRule(snapshot, "F6-08", {
    timingDestination: "12 months between qualifying co-tests",
  });

  const f7_02 = snapshot.rules.find((rule) => rule.stableRuleId === "F7-02")!;
  patchRule(snapshot, "F7-02", {
    outcomeBranches: [
      {
        id: "malignant-glandular-urgent-colposcopy",
        conditionExpression: oneOf("cytologyResult", ["AC1", "AC3", "AC4"]),
        provisionalOutcome:
          "Urgently refer to a colposcopist to assess and confirm adenocarcinoma; after confirmation, refer to gynaecological oncology.",
        timingDestination: "Urgent",
        careSetting: "Urgent colposcopy and gynaecological oncology",
        urgency: "URGENT",
        reviewerRequirement: "SPECIALIST_REVIEW",
        clinicianOnly: true,
        sourceReferences: [
          {
            document: "NCSP Clinical Practice Guidelines June 2023 v1.1",
            reference: "Figure 7; R9.10",
          },
        ],
      },
      {
        id: "other-glandular-colposcopy",
        conditionExpression: oneOf("cytologyResult", [
          "AG1",
          "AG3",
          "AG4",
          "AG5",
          "AIS",
        ]),
        provisionalOutcome: f7_02.provisionalOutcome,
        timingDestination: f7_02.timingDestination,
        careSetting: f7_02.careSetting,
        reviewerRequirement: f7_02.reviewerRequirement,
        clinicianOnly: true,
        sourceReferences: sourceReferences(f7_02),
      },
    ],
  });
  patchRule(snapshot, "F7-07", {
    careSetting: "Specialist colposcopy/excisional treatment service",
  });
  patchRule(snapshot, "F9-06", {
    timingDestination: "6 months or 6-12 weeks postpartum",
    careSetting: "Experienced pregnancy colposcopy service",
  });
  patchRule(snapshot, "F9-05", {
    timingDestination: "6 months, or 6-12 weeks postpartum",
  });
  patchRule(snapshot, "F9-03", { clinicianOnly: true });
  patchRule(snapshot, "F9-04", { clinicianOnly: true });
  patchRule(snapshot, "F9-07", {
    timingDestination:
      "Urgent gynaecological oncology review; within 2 weeks when invasive disease is indicated",
  });

  patchRule(snapshot, "F10-01", {
    timingDestination: "Without delay",
    careSetting: "Urgent specialist gynaecology",
    clinicianOnly: true,
  });
  patchRule(snapshot, "F10-04", {
    timingDestination: "Review 6-8 weeks after clinician-led treatment/investigation",
  });
  patchRule(snapshot, "F10-07", {
    timingDestination: "After the 6-8 week reassessment",
    clinicianOnly: true,
  });
  patchRule(snapshot, "F10-08", {
    timingDestination: "Review 6-8 weeks after recorded STI treatment",
  });
  patchRule(snapshot, "F10-09", {
    timingDestination:
      "Review at 6-8 weeks if a clinician records local treatment; otherwise referral is not delayed",
  });
  patchRule(snapshot, "F10-03", { clinicianOnly: false });
  patchRule(snapshot, "F10-11", { clinicianOnly: true });
  const f10_06 = snapshot.rules.find((rule) => rule.stableRuleId === "F10-06")!;
  patchRule(snapshot, "F10-06", {
    outcomeBranches: [
      {
        id: "under-25-screen-at-25",
        conditionExpression: lt("ageYears", 25),
        provisionalOutcome:
          "Commence screening at age 25; do not automatically trigger an immediate Figure 3 test.",
        timingDestination: "At age 25",
        careSetting: "Primary/community care or programme follow-up",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f10_06),
      },
      {
        id: "age-25-plus-resume-due-date",
        conditionExpression: gte("ageYears", 25),
        provisionalOutcome:
          "Resume screening according to the participant's current due date; do not automatically trigger an immediate Figure 3 test.",
        timingDestination: "According to the current screening due date",
        careSetting: "Primary/community care or programme follow-up",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(f10_06),
      },
    ],
  });

  patchRule(snapshot, "T1-19", {
    timingDestination: "6 months post-hysterectomy",
  });

  const a26_08 = snapshot.rules.find((rule) => rule.stableRuleId === "A26-08")!;
  patchRule(snapshot, "A26-08", {
    outcomeBranches: [
      {
        id: "abnormal-during-toc-colposcopy",
        conditionExpression: all(
          eq("cancerFollowUpPhase", "DURING_TOC"),
          any(
            oneOf("hpvResult", HPV_DETECTED),
            fact("cytologyResult", "NOT_IN", ["NEGATIVE"])
          )
        ),
        provisionalOutcome:
          "Refer to colposcopy for HPV detection or abnormal cytology during Test of Cure.",
        timingDestination: "Without delay",
        careSetting: "Colposcopy service",
        urgency: "PROMPT",
        reviewerRequirement: "SPECIALIST_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(a26_08),
      },
      {
        id: "post-toc-hpv-figure-3",
        conditionExpression: all(
          eq("cancerFollowUpPhase", "AFTER_TOC"),
          oneOf("hpvResult", HPV_DETECTED)
        ),
        provisionalOutcome:
          "Follow the HPV primary screening pathway in Figure 3 after completed Test of Cure.",
        timingDestination: "According to Figure 3",
        careSetting: "Primary/community care or programme follow-up",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(a26_08),
      },
      {
        id: "toc-complete-regular-screening",
        conditionExpression: all(
          eq("cancerFollowUpPhase", "AFTER_TOC"),
          eq("tocStatus", "COMPLETE")
        ),
        provisionalOutcome:
          "Return to regular cervical screening after successful treatment and completed Test of Cure.",
        timingDestination: "Regular screening interval",
        careSetting: "Primary/community care or programme follow-up",
        reviewerRequirement: "CLINICIAN_REVIEW",
        clinicianOnly: false,
        sourceReferences: sourceReferences(a26_08),
      },
    ],
  });
  patchRule(snapshot, "A26-04", { clinicianOnly: true });
  patchRule(snapshot, "A26-09", { clinicianOnly: false });
  patchRule(snapshot, "F6-12", {
    reviewerRequirement: "CLINICIAN_REVIEW",
    clinicianOnly: false,
  });

  synchronizeRuleNodes(snapshot);
}

export async function buildSuccessorSnapshotFromV21Package(
  sourceDirectory?: string
): Promise<{
  snapshot: ClinicalRuleSnapshot;
  verification: SourcePackageVerification;
}> {
  const built = await buildSnapshotFromV21Package(sourceDirectory);
  const snapshot = structuredClone(built.snapshot);
  snapshot.schemaVersion = CLINICAL_RULE_SUCCESSOR_SNAPSHOT_SCHEMA_VERSION;
  snapshot.engineContractVersion = CLINICAL_RULE_ENGINE_CONTRACT_V2;
  snapshot.productRuleSet.displayVersion = SUCCESSOR_PRODUCT_VERSION;
  snapshot.productRuleSet.name = "CerviGrade NCSP Rule Set v3.1.0";
  applyReleaseHardeningPatches(snapshot);
  return {
    snapshot: ClinicalRuleSnapshotSchema.parse(snapshot),
    verification: built.verification,
  };
}
