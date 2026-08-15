import type { BatchReviewDisposition } from "@prisma/client";

export type SimulatedPackageStatus = "SIMULATED_PACKAGE_READY";
export type DecisionPackageFormat = "csv" | "fhir" | "hl7" | "json";

export type DecisionPackageInput = {
  id: string;
  batchRunId: string;
  patientName: string | null;
  nhi: string | null;
  externalPatientId: string | null;
  patientAge: number | null;
  gpPractice: string | null;
  recommendation: string;
  recommendationCode: string;
  referralPriority: string | null;
  referralType: string | null;
  riskLevel: string;
  disposition: BatchReviewDisposition;
  reviewedAt: Date | string | null;
  reviewNote: string | null;
  overrideReason: string | null;
  authorityEngine: string;
  authorityReason: string | null;
  reviewedBy?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  ruleEvaluation?: {
    id: string;
    evaluationMode: string;
    ruleVersionDisplay: string;
    rulesetChecksum: string;
    engineVersion: string;
    matchedRuleIds: string;
    branchPath: string;
    provisionalRecommendation: string;
    missingInformation: string;
    reviewerRequirement: string;
    clinicianOnly: boolean;
    sourceReferences: string;
    evaluationTrace: string;
    canonicalInputSnapshot: string;
  } | null;
  batchRun: {
    id: string;
    source: string;
    sourceSystem: string | null;
    sourceFileName: string | null;
    engineVersion?: string;
    pinnedRuleVersionId?: string | null;
    pinnedRuleVersionDisplay?: string | null;
    pinnedRulesetChecksum?: string | null;
    createdAt: Date | string;
  };
};

export type SimulatedDecisionPackage = {
  status: SimulatedPackageStatus;
  generatedAt: string;
  summary: {
    title: string;
    patientDisplay: string;
    sourceSystem: string;
    intakeSessionId: string;
    finalReviewerDecision: string;
    reviewer: string;
    reviewedAt: string | null;
    safetyNotice: string;
    packageLabel: string;
    ruleVersion: string;
    rulesetChecksum: string;
    engineVersion: string;
  };
  pasUpdate: {
    title: "Demo PAS update";
    bookingStatus: string;
    priority: string;
    notes: string;
  };
  gpLetter: {
    title: "Demo GP/referrer letter";
    subject: string;
    body: string;
  };
  csvExportRow: Record<string, string>;
  fhirLikeJson: Record<string, unknown>;
  hl7StyleMessage: string;
  auditMetadata: {
    simulated: true;
    marker: "Simulated export package";
    packageLabel: "Integration-ready preview";
    itemId: string;
    batchRunId: string;
    sourceSystem: string;
    disposition: "ACCEPTED" | "REJECTED";
    generatedAt: string;
  };
  governedEvaluation: {
    authority: "OPERATIVE" | "COMPARISON_ONLY" | "SIMULATION_ONLY" | "NOT_OPERATIVE";
    authorityEngine: "CANONICAL" | "LEGACY";
    authorityReason: string | null;
    evaluationId: string;
    evaluationMode: string;
    ruleVersion: string;
    rulesetChecksum: string;
    engineVersion: string;
    provisionalRecommendation: string;
    matchedRuleIds: string[];
    branchPath: string[];
    sourceReferences: Array<{ document: string; reference: string }>;
    missingInformation: string[];
    reviewerRequirement: string;
    clinicianOnly: boolean;
    inputSnapshotStored: true;
    legacyComparisonStored: boolean;
  } | null;
};

export const PACKAGE_STATUS_LABEL = "SIMULATED_PACKAGE_READY";

export function isUrgentClinicalPriority(item: {
  riskLevel: string;
  referralPriority: string | null;
}) {
  return (
    item.riskLevel === "URGENT" ||
    item.referralPriority === "P1" ||
    item.referralPriority === "P1_HSC"
  );
}

export function formatDisposition(disposition: BatchReviewDisposition) {
  switch (disposition) {
    case "ACCEPTED":
      return "Accepted";
    case "REJECTED":
      return "Rejected";
    case "NEEDS_INFO":
      return "Needs information";
    default:
      return "Pending";
  }
}

function displayPatient(item: DecisionPackageInput) {
  return item.patientName ?? item.nhi ?? item.externalPatientId ?? `Case ${item.id}`;
}

function displayNhi(item: DecisionPackageInput) {
  return item.nhi ?? item.externalPatientId ?? "";
}

function displayReviewer(item: DecisionPackageInput) {
  return item.reviewedBy?.name ?? item.reviewedBy?.email ?? "Reviewer";
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function sourceSystem(item: DecisionPackageInput) {
  return item.batchRun.sourceSystem ?? item.batchRun.sourceFileName ?? item.batchRun.source;
}

function parseJsonArray<T>(value: string | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function governedEvaluation(item: DecisionPackageInput): SimulatedDecisionPackage["governedEvaluation"] {
  const evaluation = item.ruleEvaluation;
  if (!evaluation) return null;
  let legacyComparisonStored = false;
  try {
    const trace = JSON.parse(evaluation.evaluationTrace) as { legacyComparison?: unknown };
    legacyComparisonStored = trace.legacyComparison != null;
  } catch {
    legacyComparisonStored = false;
  }
  const authorityEngine = item.authorityEngine === "CANONICAL" ? "CANONICAL" : "LEGACY";
  const authority = evaluation.evaluationMode === "SHADOW"
    ? "COMPARISON_ONLY"
    : evaluation.evaluationMode === "SIMULATION"
      ? "SIMULATION_ONLY"
      : authorityEngine === "CANONICAL" &&
          (evaluation.evaluationMode === "LIVE_DEMO" || evaluation.evaluationMode === "LIVE_PRODUCTION")
        ? "OPERATIVE"
        : "NOT_OPERATIVE";
  return {
    authority,
    authorityEngine,
    authorityReason: item.authorityReason,
    evaluationId: evaluation.id,
    evaluationMode: evaluation.evaluationMode,
    ruleVersion: evaluation.ruleVersionDisplay,
    rulesetChecksum: evaluation.rulesetChecksum,
    engineVersion: evaluation.engineVersion,
    provisionalRecommendation: evaluation.provisionalRecommendation,
    matchedRuleIds: parseJsonArray<string>(evaluation.matchedRuleIds),
    branchPath: parseJsonArray<string>(evaluation.branchPath),
    sourceReferences: parseJsonArray<{ document: string; reference: string }>(evaluation.sourceReferences),
    missingInformation: parseJsonArray<string>(evaluation.missingInformation),
    reviewerRequirement: evaluation.reviewerRequirement,
    clinicianOnly: evaluation.clinicianOnly,
    inputSnapshotStored: true,
    legacyComparisonStored,
  };
}

function bookingStatusFor(disposition: "ACCEPTED" | "REJECTED") {
  switch (disposition) {
    case "ACCEPTED":
      return "Demo PAS update prepared for booking queue review";
    case "REJECTED":
      return "Demo PAS update prepared to mark referral not proceeding";
  }
}

function gpLetterBody(item: DecisionPackageInput) {
  const patient = displayPatient(item);
  const decision = formatDisposition(item.disposition);
  const reason = item.overrideReason ?? item.reviewNote ?? "No additional note recorded.";
  return [
    "Demo GP/referrer letter",
    "",
    `Patient: ${patient}`,
    displayNhi(item) ? `NHI/source identifier: ${displayNhi(item)}` : null,
    `Reviewer decision: ${decision}`,
    `Original recommendation: ${item.recommendation}`,
    `Clinical rule version: ${item.batchRun.pinnedRuleVersionDisplay ?? "Legacy unversioned clinical path"}`,
    `Ruleset checksum: ${item.batchRun.pinnedRulesetChecksum ?? "Not available for legacy evaluation"}`,
    `Reviewer note: ${reason}`,
    "",
    "This is a simulated export package preview prepared from a reviewer-confirmed decision.",
    "Reviewer confirmation required. Not for direct clinical action.",
  ]
    .filter(Boolean)
    .join("\n");
}

function csvRow(item: DecisionPackageInput, generatedAt: string) {
  const evaluation = governedEvaluation(item);
  return {
    package_status: PACKAGE_STATUS_LABEL,
    simulated_export_package: "true",
    package_label: "Integration-ready preview",
    csv_export_label: "CSV export",
    batch_review_item_id: item.id,
    intake_session_id: item.batchRunId,
    source_system: sourceSystem(item),
    patient_name: item.patientName ?? "",
    nhi_or_source_id: displayNhi(item),
    age: item.patientAge == null ? "" : String(item.patientAge),
    gp_referrer: item.gpPractice ?? "",
    original_recommendation_code: item.recommendationCode,
    original_recommendation: item.recommendation,
    clinical_rule_version: item.batchRun.pinnedRuleVersionDisplay ?? "legacy-unversioned",
    clinical_rule_version_id: item.batchRun.pinnedRuleVersionId ?? "",
    clinical_ruleset_checksum: item.batchRun.pinnedRulesetChecksum ?? "",
    engine_version: item.batchRun.engineVersion ?? "business-figures-table1-v1",
    final_reviewer_decision: formatDisposition(item.disposition),
    reviewer: displayReviewer(item),
    reviewed_at: iso(item.reviewedAt) ?? "",
    reason_or_note: item.overrideReason ?? item.reviewNote ?? "",
    generated_at: generatedAt,
    safety_notice: "Reviewer confirmation required. Not for direct clinical action.",
    governed_evaluation_authority: evaluation?.authority ?? "not-recorded",
    governed_evaluation_mode: evaluation?.evaluationMode ?? "",
    governed_evaluation_authority_engine: evaluation?.authorityEngine ?? item.authorityEngine,
    governed_evaluation_authority_reason: evaluation?.authorityReason ?? item.authorityReason ?? "",
    governed_evaluation_id: evaluation?.evaluationId ?? "",
    governed_evaluation_rule_version: evaluation?.ruleVersion ?? "",
    governed_evaluation_checksum: evaluation?.rulesetChecksum ?? "",
    governed_evaluation_matched_rules: evaluation?.matchedRuleIds.join(";") ?? "",
    governed_evaluation_branch_path: evaluation?.branchPath.join(" > ") ?? "",
    governed_evaluation_missing_facts: evaluation?.missingInformation.join(";") ?? "",
    governed_evaluation_reviewer_requirement: evaluation?.reviewerRequirement ?? "",
  };
}

function fhirLikeJson(item: DecisionPackageInput, generatedAt: string) {
  const evaluation = governedEvaluation(item);
  return {
    resourceType: "Bundle",
    type: "collection",
    meta: {
      profile: ["FHIR-like preview"],
      tag: [
        { system: "https://cervigrade.example/demo", code: "simulated-export-package" },
        { system: "https://cervigrade.example/demo", code: "integration-ready-preview" },
      ],
    },
    timestamp: generatedAt,
    entry: [
      {
        resource: {
          resourceType: "Patient",
          identifier: displayNhi(item)
            ? [{ system: "urn:nz:nhi-or-source-id", value: displayNhi(item) }]
            : [],
          name: item.patientName ? [{ text: item.patientName }] : [],
        },
      },
      {
        resource: {
          resourceType: "Task",
          status: "requested",
          intent: "order",
          description: "FHIR-like integration-ready preview for a simulated export package. Reviewer confirmation required. Not for direct clinical action.",
          code: {
            text: `Reviewer decision: ${formatDisposition(item.disposition)}`,
          },
          businessStatus: {
            text: PACKAGE_STATUS_LABEL,
          },
          note: [
            { text: `Original recommendation: ${item.recommendation}` },
            { text: `Clinical rule version: ${item.batchRun.pinnedRuleVersionDisplay ?? "Legacy unversioned clinical path"}` },
            { text: `Ruleset checksum: ${item.batchRun.pinnedRulesetChecksum ?? "Not available for legacy evaluation"}` },
            { text: evaluation ? `Governed evaluation (${evaluation.authority}, ${evaluation.evaluationMode}): ${evaluation.ruleVersion}; ${evaluation.rulesetChecksum}; matched ${evaluation.matchedRuleIds.join(", ") || "governance stop"}` : "Governed evaluation: not recorded" },
            { text: evaluation ? `Governed branch path: ${evaluation.branchPath.join(" > ")}` : "Governed branch path: not recorded" },
            { text: item.overrideReason ?? item.reviewNote ?? "No reviewer note recorded." },
          ],
        },
      },
    ],
  };
}

function hl7StyleMessage(item: DecisionPackageInput, generatedAt: string) {
  const patient = displayPatient(item).replaceAll("|", " ");
  const identifier = displayNhi(item).replaceAll("|", " ");
  const decision = formatDisposition(item.disposition).replaceAll("|", " ");
  const recommendation = item.recommendation.replaceAll("|", " ");
  const note = (item.overrideReason ?? item.reviewNote ?? "No reviewer note recorded.").replaceAll("|", " ");
  const timestamp = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
  const evaluation = governedEvaluation(item);

  return [
    `MSH|^~\\&|CERVIGRADE|DEMO|PAS|DEMO|${timestamp}||ORU^R01|${item.id}|P|2.4`,
    `PID|||${identifier}||${patient}`,
    `OBR|1|${item.batchRunId}|${item.id}|CERVIGRADE^HL7-style preview`,
    `OBX|1|TX|DECISION^Reviewer decision||${decision}`,
    `OBX|2|TX|RECOMMENDATION^Original recommendation||${recommendation}`,
    `OBX|3|TX|NOTE^Reason or note||${note}`,
    `OBX|4|TX|RULEVERSION^Clinical rule version||${(item.batchRun.pinnedRuleVersionDisplay ?? "legacy-unversioned").replaceAll("|", " ")}`,
    `OBX|5|TX|RULECHECKSUM^Ruleset checksum||${(item.batchRun.pinnedRulesetChecksum ?? "").replaceAll("|", " ")}`,
    `OBX|6|TX|GOVAUTH^Governed evaluation authority||${evaluation?.authority ?? "not-recorded"}`,
    `OBX|7|TX|GOVMODE^Governed evaluation mode||${evaluation?.evaluationMode ?? ""}`,
    `OBX|8|TX|GOVRULES^Governed evaluation rules||${(evaluation?.matchedRuleIds.join(",") ?? "").replaceAll("|", " ")}`,
    `OBX|9|TX|GOVPATH^Governed evaluation branch path||${(evaluation?.branchPath.join(" > ") ?? "").replaceAll("|", " ")}`,
    "NTE|1|L|Simulated export package. Integration-ready preview. Reviewer confirmation required. Not for direct clinical action.",
  ].join("\n");
}

export function buildSimulatedDecisionPackage(
  item: DecisionPackageInput,
  generatedAt = new Date().toISOString()
): SimulatedDecisionPackage {
  if (item.disposition !== "ACCEPTED" && item.disposition !== "REJECTED") {
    throw new Error("Only completed decisions can have simulated export packages.");
  }

  const disposition = item.disposition;
  const patient = displayPatient(item);
  const decision = formatDisposition(disposition);
  const source = sourceSystem(item);
  const reason = item.overrideReason ?? item.reviewNote ?? "No additional note recorded.";
  const evaluation = governedEvaluation(item);

  return {
    status: PACKAGE_STATUS_LABEL,
    generatedAt,
    summary: {
      title: "Preview integration-ready package",
      patientDisplay: patient,
      sourceSystem: source,
      intakeSessionId: item.batchRunId,
      finalReviewerDecision: decision,
      reviewer: displayReviewer(item),
      reviewedAt: iso(item.reviewedAt),
      safetyNotice: "Reviewer confirmation required. Not for direct clinical action.",
      packageLabel: "Integration-ready preview prepared from reviewer-confirmed decision.",
      ruleVersion: item.batchRun.pinnedRuleVersionDisplay ?? "Legacy unversioned clinical path",
      rulesetChecksum: item.batchRun.pinnedRulesetChecksum ?? "Not available for legacy evaluation",
      engineVersion: item.batchRun.engineVersion ?? "business-figures-table1-v1",
    },
    pasUpdate: {
      title: "Demo PAS update",
      bookingStatus: bookingStatusFor(disposition),
      priority: item.referralPriority ?? item.riskLevel,
      notes: [
        "Simulated export package preview only.",
        `Final reviewer decision: ${decision}.`,
        `Reason or note: ${reason}`,
      ].join(" "),
    },
    gpLetter: {
      title: "Demo GP/referrer letter",
      subject: `CerviGrade simulated export for ${patient}`,
      body: gpLetterBody(item),
    },
    csvExportRow: csvRow(item, generatedAt),
    fhirLikeJson: fhirLikeJson(item, generatedAt),
    hl7StyleMessage: hl7StyleMessage(item, generatedAt),
    auditMetadata: {
      simulated: true,
      marker: "Simulated export package",
      packageLabel: "Integration-ready preview",
      itemId: item.id,
      batchRunId: item.batchRunId,
      sourceSystem: source,
      disposition,
      generatedAt,
    },
    governedEvaluation: evaluation,
  };
}

export function serialiseCsvRow(row: Record<string, string>) {
  const headers = Object.keys(row);
  const escape = (value: string) => {
    const neutralised = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return neutralised.includes(",") || neutralised.includes('"') || neutralised.includes("\n")
      ? `"${neutralised.replaceAll('"', '""')}"`
      : neutralised;
  };

  return [
    headers.join(","),
    headers.map((header) => escape(row[header] ?? "")).join(","),
  ].join("\n");
}
