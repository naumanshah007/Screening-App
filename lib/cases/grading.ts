import type { Prisma, TriagePriority } from "@prisma/client";
import { differenceInYears } from "date-fns";

import type { OperationalState } from "@/lib/cases/operational";
import { prisma } from "@/lib/prisma";
import {
  evaluateCaseRuleRelease,
  type RuleEvaluationFact,
  type TraceMatch,
} from "@/lib/cases/rule-evaluator";
import { extractFactsFromText } from "@/lib/cases/fact-extraction";
import { getActiveCaseRuleSetRelease } from "@/lib/cases/rule-releases";
import { parseCaseRuleReleaseDefinition } from "@/lib/cases/rule-policy";

export type GradeRecommendationPayload = {
  caseId: string;
  serviceLine: "COLPOSCOPY" | "GYNAECOLOGY";
  generatedAt: string;
  generatedBy: string;
  ruleRelease?: {
    id: string;
    version: string;
    name: string;
    schemaVersion: string;
  };
  recommendation: {
    priority: TriagePriority;
    category: string;
    outcome: string;
    targetDays?: number;
  };
  operational: OperationalState;
  rationale: string[];
  warnings: string[];
  nextActions: string[];
  trace: TraceMatch[];
  safetyOutcome?: string;
  missingInformation?: string[];
  externalDependencies?: string[];
};

export type EvaluationFactPreview = {
  label: string;
  valueText: string;
  evidence: string;
  valueNumber?: number;
};

const gradingCaseInclude = {
  patient: {
    select: {
      dateOfBirth: true,
      firstName: true,
      lastName: true,
      nhi: true,
    },
  },
  summary: true,
  documents: {
    orderBy: { createdAt: "desc" },
  },
  extractedFacts: {
    include: {
      documentPage: {
        select: {
          pageNumber: true,
          document: {
            select: {
              fileName: true,
              type: true,
            },
          },
        },
      },
    },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
  },
} satisfies Prisma.ReferralCaseInclude;

type ReferralCaseForGrading = Prisma.ReferralCaseGetPayload<{
  include: typeof gradingCaseInclude;
}>;

function buildEvidenceLine(args: {
  label: string;
  valueText: string;
  documentName: string;
  pageNumber: number;
}) {
  return `${args.label}: ${args.valueText} from ${args.documentName} page ${args.pageNumber}`;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeCode(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function buildStructuredEvidence(source: string, detail: string) {
  return `${source}: ${detail}`;
}

function addRuleFact(
  facts: RuleEvaluationFact[],
  seen: Set<string>,
  fact: RuleEvaluationFact
) {
  const key = `${fact.label}|${fact.valueText}|${fact.evidence}`;
  if (seen.has(key)) return;
  seen.add(key);
  facts.push(fact);
}

function buildMappedFieldFacts(referralCase: ReferralCaseForGrading) {
  const facts: RuleEvaluationFact[] = [];
  const seen = new Set<string>();

  const addMappedFact = (
    label: string,
    valueText: string,
    sourceLabel: string,
    valueNumber?: number
  ) => {
    addRuleFact(facts, seen, {
      label,
      valueText,
      valueNumber,
      evidence: buildStructuredEvidence(sourceLabel, `${label}: ${valueText}`),
    });
  };

  const fctStatus = normalizeCode(referralCase.fctStatus);
  const hpvTestResult = normalizeCode(referralCase.hpvTestResult);
  const hpvType = normalizeCode(referralCase.hpvType);
  const cytologySample = normalizeCode(referralCase.cytologySample);
  const referrerReasonCode = normalizeCode(referralCase.referrerReasonCode);
  const gynaecologyCategory = normalizeCode(referralCase.gynaecologyCategory);
  const referralType = normalizeCode(referralCase.referralType);

  if (referralCase.patient.dateOfBirth) {
    const age = differenceInYears(new Date(), referralCase.patient.dateOfBirth);
    if (age < 16) {
      addMappedFact("Patient under 16", "Present", "Patient record");
    }
  }

  if (hpvTestResult === "hpv_16_18") {
    addMappedFact("HPV 16/18", "Positive", "Colposcopy triage field");
  } else if (hpvTestResult === "hpv_other") {
    addMappedFact("HPV Other", "Positive", "Colposcopy triage field");
  }

  if (hpvType === "post_treatment") {
    addMappedFact("Post-treatment assessment", "Structured selection", "Colposcopy triage field");
  } else if (hpvType === "surveillance") {
    addMappedFact("HPV surveillance", "Structured selection", "Colposcopy triage field");
  } else if (hpvType === "other") {
    addMappedFact("Other clinical assessment", "Structured selection", "Colposcopy triage field");
  }

  if (
    referralType === "toc" &&
    ["hpv_16_18", "hpv_other"].includes(hpvTestResult)
  ) {
    addMappedFact(
      "Positive test of cure",
      "Structured referral",
      "Colposcopy triage field"
    );
  }

  if (cytologySample === "asc_us") {
    addMappedFact("ASC-US", "Detected", "Colposcopy triage field");
  } else if (cytologySample === "lsil") {
    addMappedFact("LSIL", "Detected", "Colposcopy triage field");
  } else if (cytologySample === "asc_h") {
    addMappedFact("ASC-H", "Detected", "Colposcopy triage field");
  } else if (cytologySample === "hsil") {
    addMappedFact("HSIL", "Detected", "Colposcopy triage field");
  } else if (cytologySample === "scc") {
    addMappedFact(
      "Cancer suspicion cytology",
      "Detected",
      "Colposcopy triage field"
    );
  } else if (cytologySample === "glandular") {
    addMappedFact("Glandular abnormality", "Detected", "Colposcopy triage field");
  } else if (cytologySample === "borderline") {
    addMappedFact("Borderline cytology", "Detected", "Colposcopy triage field");
  }

  if (referrerReasonCode === "abnormal_appearance") {
    addMappedFact("Abnormal appearance", "Structured reason", "Referrer reason");
  } else if (referrerReasonCode === "endorsed_colposcopy") {
    addMappedFact(
      "Endorsed referral on colposcopy",
      "Structured reason",
      "Referrer reason"
    );
  } else if (referrerReasonCode === "hpv_post_treatment") {
    addMappedFact(
      "Post-treatment assessment",
      "Structured reason",
      "Referrer reason"
    );
  } else if (referrerReasonCode === "hpv_surveillance") {
    addMappedFact("HPV surveillance", "Structured reason", "Referrer reason");
  } else if (referrerReasonCode === "other") {
    addMappedFact("Other clinical assessment", "Structured reason", "Referrer reason");
  }

  if (gynaecologyCategory === "aub") {
    addMappedFact("Abnormal uterine bleeding", "Structured category", "Gynaecology category");
  } else if (gynaecologyCategory === "fibroids") {
    addMappedFact("Fibroids", "Structured category", "Gynaecology category");
  } else if (gynaecologyCategory === "ovarian_mass") {
    addMappedFact("Ovarian cyst", "Structured category", "Gynaecology category");
  } else if (gynaecologyCategory === "pmb") {
    addMappedFact("Postmenopausal bleeding", "Structured category", "Gynaecology category");
  } else if (gynaecologyCategory === "pelvic_pain") {
    addMappedFact("Pelvic pain", "Structured category", "Gynaecology category");
  } else if (gynaecologyCategory === "urogynaecology") {
    addMappedFact("Urogynaecology", "Structured category", "Gynaecology category");
  } else if (gynaecologyCategory === "cervical_polyp") {
    addMappedFact("Cervical polyp", "Structured category", "Gynaecology category");
  } else if (gynaecologyCategory === "tubal_ligation") {
    addMappedFact("Tubal ligation", "Structured category", "Gynaecology category");
  } else if (gynaecologyCategory === "pcos") {
    addMappedFact("PCOS", "Structured category", "Gynaecology category");
  } else if (gynaecologyCategory === "fertility") {
    addMappedFact("Fertility", "Structured category", "Gynaecology category");
  } else if (gynaecologyCategory === "paediatric") {
    addMappedFact("Paediatric gynaecology", "Structured category", "Gynaecology category");
  }

  if (referralCase.ussAvailable) {
    addMappedFact("Ultrasound scan", "Available", "Gynaecology triage field");
  }

  if (fctStatus === "confirmed_cancer" || fctStatus === "high_suspicion") {
    addMappedFact("Cancer suspicion cytology", "Structured FCT escalation", "FCT status");
  }

  return facts;
}

function buildStructuredTextFacts(referralCase: ReferralCaseForGrading) {
  const facts: RuleEvaluationFact[] = [];
  const seen = new Set<string>();

  const textSources = [
    { sourceLabel: "Referral reason", text: referralCase.referralReason },
    { sourceLabel: "Triage notes", text: referralCase.triageNotes },
    { sourceLabel: "Internal triage notes", text: referralCase.internalTriageNotes },
    { sourceLabel: "USS findings", text: referralCase.ussFindings },
    { sourceLabel: "Assessment of referral", text: referralCase.assessmentOfReferral },
    { sourceLabel: "Booking priority note", text: referralCase.bookingPriorityNote },
  ];

  for (const source of textSources) {
    if (!source.text?.trim()) continue;

    const extractedFacts = extractFactsFromText(source.text);
    for (const fact of extractedFacts) {
      addRuleFact(facts, seen, {
        label: fact.label,
        valueText: fact.valueText,
        valueNumber: fact.valueNumber,
        evidence: buildStructuredEvidence(
          source.sourceLabel,
          fact.sourceQuote
            ? `${fact.label}: ${fact.valueText} (${fact.sourceQuote})`
            : `${fact.label}: ${fact.valueText}`
        ),
      });
    }
  }

  return facts;
}

function buildEvaluationFacts(referralCase: ReferralCaseForGrading) {
  const facts: RuleEvaluationFact[] = [];
  const seen = new Set<string>();

  for (const fact of referralCase.extractedFacts) {
    addRuleFact(facts, seen, {
      label: fact.label,
      valueText: fact.valueText,
      valueNumber: fact.valueNumber,
      evidence: buildEvidenceLine({
        label: fact.label,
        valueText: fact.valueText,
        documentName: fact.documentPage.document.fileName,
        pageNumber: fact.documentPage.pageNumber,
      }),
    });
  }

  for (const fact of buildMappedFieldFacts(referralCase)) {
    addRuleFact(facts, seen, fact);
  }

  for (const fact of buildStructuredTextFacts(referralCase)) {
    addRuleFact(facts, seen, fact);
  }

  return facts;
}

function toEvaluationFactPreview(facts: RuleEvaluationFact[]): EvaluationFactPreview[] {
  return facts.map((fact) => ({
    label: fact.label,
    valueText: fact.valueText,
    valueNumber: fact.valueNumber ?? undefined,
    evidence: fact.evidence,
  }));
}

function deriveHighSuspicionCancer(referralCase: ReferralCaseForGrading) {
  return (
    referralCase.highSuspicionCancer ||
    ["confirmed_cancer", "high_suspicion"].includes(
      normalizeCode(referralCase.fctStatus)
    )
  );
}

function buildPayloadMarkdown(payload: GradeRecommendationPayload) {
  const lines = [
    `# ${payload.serviceLine === "COLPOSCOPY" ? "Colposcopy" : "Gynaecology"} Rule Decision`,
    "",
    `Generated: ${payload.generatedAt}`,
    ...(payload.ruleRelease
      ? [`Rule release: ${payload.ruleRelease.name} (v${payload.ruleRelease.version})`]
      : []),
    `Recommendation: ${payload.recommendation.priority} · ${payload.recommendation.category}`,
    `Outcome: ${payload.recommendation.outcome}`,
    `Workflow: ${payload.operational.workflow}`,
    ...(payload.operational.requiresSmoReview ? ["SMO review: required"] : []),
    "",
    "## Rationale",
    ...payload.rationale.map((line) => `- ${line}`),
  ];

  if (payload.warnings.length > 0) {
    lines.push("", "## Warnings", ...payload.warnings.map((line) => `- ${line}`));
  }

  if (payload.nextActions.length > 0) {
    lines.push("", "## Next Actions", ...payload.nextActions.map((line) => `- ${line}`));
  }

  lines.push("", "## Rule Trace");
  for (const item of payload.trace) {
    lines.push(
      `- ${item.code}: ${item.title} -> ${item.matched ? "matched" : "not matched"} (${item.impact})`
    );
    for (const evidence of item.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }

  return lines.join("\n");
}

export function parseGradeRecommendationPayload(json: string) {
  return JSON.parse(json) as GradeRecommendationPayload;
}

export async function getCaseEvaluationFactsPreview(caseId: string) {
  const referralCase = await prisma.referralCase.findUnique({
    where: { id: caseId },
    include: gradingCaseInclude,
  });

  if (!referralCase) {
    return null;
  }

  return toEvaluationFactPreview(buildEvaluationFacts(referralCase));
}

export async function getStoredRuleDecision(caseId: string) {
  return prisma.ruleDecision.findUnique({
    where: { caseId },
    include: {
      ruleSetRelease: {
        select: {
          id: true,
          serviceLine: true,
          version: true,
          name: true,
          schemaVersion: true,
          isActive: true,
        },
      },
    },
  });
}

export async function generateRuleDecision(args: {
  caseId: string;
  generatedByUserId: string;
  generatedByLabel: string;
}) {
  const referralCase = await prisma.referralCase.findUnique({
    where: { id: args.caseId },
    include: gradingCaseInclude,
  });

  if (!referralCase) {
    throw new Error("Referral case not found");
  }

  const activeRuleSetRelease = await getActiveCaseRuleSetRelease(
    referralCase.serviceLine
  );

  if (!activeRuleSetRelease) {
    throw new Error("No active case rule release is published for this service");
  }

  const evaluationFacts = buildEvaluationFacts(referralCase);
  const documents = referralCase.documents;
  const hasSummary = Boolean(referralCase.summary);
  const hasApprovedSummary = referralCase.summary?.status === "APPROVED";
  const highSuspicionCancer = deriveHighSuspicionCancer(referralCase);

  const provisionalWarnings = unique([
    !hasSummary ? "No clinical summary has been generated for this case yet." : "",
    hasSummary && !hasApprovedSummary
      ? "Clinical summary exists but has not been clinician-approved yet."
      : "",
    documents.length === 0 ? "No supporting documents are attached to the case." : "",
    documents.some((document) => document.parseStatus === "FAILED")
      ? "One or more attached documents failed parse and may hide relevant evidence."
      : "",
  ]);

  if (!hasSummary) {
    throw new Error("Generate a clinical summary before evaluating rules");
  }

  if (!hasApprovedSummary) {
    throw new Error("Approve the clinical summary before evaluating rules");
  }

  const ruleDefinition = parseCaseRuleReleaseDefinition({
    serviceLine: referralCase.serviceLine,
    definitionJson: activeRuleSetRelease.definitionJson,
  });
  const evaluation = evaluateCaseRuleRelease({
    serviceLine: referralCase.serviceLine,
    ruleDefinition,
    highSuspicionCancer,
    facts: evaluationFacts,
  });

  const priority: TriagePriority = evaluation.recommendation.priority;
  const category = evaluation.recommendation.category;
  const outcome = evaluation.recommendation.outcome;
  const operational = evaluation.operational;
  const rationale = evaluation.rationale;
  const trace = evaluation.trace;

  const evidenceLines = unique(evaluationFacts.slice(0, 20).map((fact) => fact.evidence));

  const nextActions = unique([
    priority === "INFO_REQUIRED"
      ? "Review the referral package and add missing documents before final grading."
      : "",
    !hasSummary
      ? "Generate the clinical summary after updating evidence."
      : !hasApprovedSummary
        ? "Approve the clinical summary before confirming the deterministic recommendation."
        : "",
    documents.some((document) => document.parseStatus === "FAILED")
      ? "Review failed document parses and re-run ingest or OCR where needed."
      : "",
    priority !== "INFO_REQUIRED"
      ? "Clinician should confirm whether the provisional rule-based recommendation matches service guidelines."
      : "",
  ]);

  const payload: GradeRecommendationPayload = {
    caseId: referralCase.id,
    serviceLine: referralCase.serviceLine,
    generatedAt: new Date().toLocaleString("en-NZ"),
    generatedBy: args.generatedByLabel,
    ruleRelease: {
      id: activeRuleSetRelease.id,
      version: activeRuleSetRelease.version,
      name: activeRuleSetRelease.name,
      schemaVersion: activeRuleSetRelease.schemaVersion,
    },
    recommendation: {
      priority,
      category,
      outcome,
      targetDays: evaluation.recommendation.targetDays,
    },
    operational,
    rationale: unique(rationale),
    warnings: provisionalWarnings,
    nextActions,
    trace,
  };

  const evidenceJson = JSON.stringify({
    lines: evidenceLines,
  });
  const traceJson = JSON.stringify(payload);

  const ruleDecision = await prisma.ruleDecision.upsert({
    where: { caseId: referralCase.id },
    update: {
      ruleSetReleaseId: activeRuleSetRelease.id,
      priority,
      category,
      outcome,
      rationale: buildPayloadMarkdown(payload),
      evidenceJson,
      traceJson,
      generatedBy: args.generatedByLabel,
    },
    create: {
      caseId: referralCase.id,
      ruleSetReleaseId: activeRuleSetRelease.id,
      priority,
      category,
      outcome,
      rationale: buildPayloadMarkdown(payload),
      evidenceJson,
      traceJson,
      generatedBy: args.generatedByLabel,
    },
  });

  await prisma.referralCase.update({
    where: { id: referralCase.id },
    data: {
      smoOnly: operational.requiresSmoReview,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: args.generatedByUserId,
      action: "EVALUATE",
      entity: "RuleDecision",
      entityId: ruleDecision.id,
      newValue: JSON.stringify({
        caseId: referralCase.id,
        ruleSetReleaseId: activeRuleSetRelease.id,
        ruleSetVersion: activeRuleSetRelease.version,
        priority,
        category,
        outcome,
        workflow: operational.workflow,
        requiresSmoReview: operational.requiresSmoReview,
      }),
    },
  });

  return ruleDecision;
}
