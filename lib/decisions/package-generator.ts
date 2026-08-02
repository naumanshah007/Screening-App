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
  reviewedBy?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
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
    disposition: Exclude<BatchReviewDisposition, "PENDING">;
    generatedAt: string;
  };
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

function bookingStatusFor(disposition: Exclude<BatchReviewDisposition, "PENDING">) {
  switch (disposition) {
    case "ACCEPTED":
      return "Demo PAS update prepared for booking queue review";
    case "REJECTED":
      return "Demo PAS update prepared to mark referral not proceeding";
    case "NEEDS_INFO":
      return "Demo PAS update prepared to request additional information";
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
  };
}

function fhirLikeJson(item: DecisionPackageInput, generatedAt: string) {
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

  return [
    `MSH|^~\\&|CERVIGRADE|DEMO|PAS|DEMO|${timestamp}||ORU^R01|${item.id}|P|2.4`,
    `PID|||${identifier}||${patient}`,
    `OBR|1|${item.batchRunId}|${item.id}|CERVIGRADE^HL7-style preview`,
    `OBX|1|TX|DECISION^Reviewer decision||${decision}`,
    `OBX|2|TX|RECOMMENDATION^Original recommendation||${recommendation}`,
    `OBX|3|TX|NOTE^Reason or note||${note}`,
    `OBX|4|TX|RULEVERSION^Clinical rule version||${(item.batchRun.pinnedRuleVersionDisplay ?? "legacy-unversioned").replaceAll("|", " ")}`,
    `OBX|5|TX|RULECHECKSUM^Ruleset checksum||${(item.batchRun.pinnedRulesetChecksum ?? "").replaceAll("|", " ")}`,
    "NTE|1|L|Simulated export package. Integration-ready preview. Reviewer confirmation required. Not for direct clinical action.",
  ].join("\n");
}

export function buildSimulatedDecisionPackage(
  item: DecisionPackageInput,
  generatedAt = new Date().toISOString()
): SimulatedDecisionPackage {
  if (item.disposition === "PENDING") {
    throw new Error("Only completed decisions can have simulated export packages.");
  }

  const disposition = item.disposition as Exclude<BatchReviewDisposition, "PENDING">;
  const patient = displayPatient(item);
  const decision = formatDisposition(disposition);
  const source = sourceSystem(item);
  const reason = item.overrideReason ?? item.reviewNote ?? "No additional note recorded.";

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
  };
}

export function serialiseCsvRow(row: Record<string, string>) {
  const headers = Object.keys(row);
  const escape = (value: string) =>
    value.includes(",") || value.includes('"') || value.includes("\n")
      ? `"${value.replaceAll('"', '""')}"`
      : value;

  return [
    headers.join(","),
    headers.map((header) => escape(row[header] ?? "")).join(","),
  ].join("\n");
}
