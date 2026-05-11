import type { ServiceLine } from "@prisma/client";
import type { ReferralDocumentRecord } from "@/lib/cases/documents";

type ReadinessCheck = {
  label: string;
  passed: boolean;
  detail: string;
};

export type CaseDocumentReadiness = {
  stage: "NEEDS_EVIDENCE" | "READY_FOR_SUMMARY" | "READY_FOR_GRADING";
  headline: string;
  variant: "default" | "high" | "low" | "urgent";
  checks: ReadinessCheck[];
  blockers: string[];
  recommendations: string[];
  stats: {
    totalDocuments: number;
    narrativeDocuments: number;
    supportingDocuments: number;
    pdfDocuments: number;
    parsedDocuments: number;
    pendingDocuments: number;
    failedDocuments: number;
    factCount: number;
  };
};

function hasNarrativeDocument(documents: ReferralDocumentRecord[]) {
  return documents.some((document) =>
    ["REFERRAL", "CLINIC_LETTER", "DISCHARGE_SUMMARY"].includes(document.type)
  );
}

function countSupportingDocuments(
  documents: ReferralDocumentRecord[],
  serviceLine: ServiceLine
) {
  if (serviceLine === "COLPOSCOPY") {
    return documents.filter((document) =>
      ["LAB_RESULT", "REFERRAL", "CLINIC_LETTER"].includes(document.type)
    ).length;
  }

  return documents.filter((document) =>
    ["LAB_RESULT", "RADIOLOGY", "CLINIC_LETTER", "DISCHARGE_SUMMARY"].includes(
      document.type
    )
  ).length;
}

export function buildCaseDocumentReadiness(args: {
  serviceLine: ServiceLine;
  documents: ReferralDocumentRecord[];
  factCount: number;
  summaryStatus?: "DRAFT" | "REVIEWED" | "APPROVED" | null;
}) {
  const { serviceLine, documents, factCount, summaryStatus } = args;
  const hasApprovedSummary = summaryStatus === "APPROVED";

  const narrativeDocuments = documents.filter((document) =>
    ["REFERRAL", "CLINIC_LETTER", "DISCHARGE_SUMMARY"].includes(document.type)
  ).length;
  const supportingDocuments = countSupportingDocuments(documents, serviceLine);
  const pdfDocuments = documents.filter(
    (document) => document.mimeType === "application/pdf"
  ).length;
  const parsedDocuments = documents.filter(
    (document) => document.parseStatus === "COMPLETE"
  ).length;
  const pendingDocuments = documents.filter((document) =>
    ["PENDING", "PROCESSING"].includes(document.parseStatus)
  ).length;
  const failedDocuments = documents.filter(
    (document) => document.parseStatus === "FAILED"
  ).length;

  const checks: ReadinessCheck[] = [
    {
      label: "Evidence attached",
      passed: documents.length > 0,
      detail:
        documents.length > 0
          ? `${documents.length} document${documents.length === 1 ? "" : "s"} attached`
          : "Add at least one referral or supporting document",
    },
    {
      label: "Narrative source present",
      passed: hasNarrativeDocument(documents),
      detail: hasNarrativeDocument(documents)
        ? `${narrativeDocuments} referral / clinic narrative document${narrativeDocuments === 1 ? "" : "s"} available`
        : "Referral, clinic letter, or discharge summary still missing",
    },
    {
      label: "Document processing complete",
      passed: parsedDocuments > 0 && pendingDocuments === 0,
      detail:
        parsedDocuments > 0
          ? pendingDocuments === 0
            ? `${parsedDocuments} parsed document${parsedDocuments === 1 ? "" : "s"} ready`
            : `${pendingDocuments} document${pendingDocuments === 1 ? "" : "s"} still pending ingest`
          : "No parsed documents available yet",
    },
    {
      label: "Extracted clinical signal",
      passed: factCount > 0,
      detail:
        factCount > 0
          ? `${factCount} extracted fact${factCount === 1 ? "" : "s"} available`
          : "No extracted facts yet",
    },
    {
      label: "One-page summary approved",
      passed: hasApprovedSummary,
      detail:
        summaryStatus === "APPROVED"
          ? "Summary is approved for downstream grading"
          : summaryStatus === "REVIEWED"
            ? "Summary review is saved, but approval is still pending"
            : summaryStatus === "DRAFT"
              ? "Summary exists as a draft and still needs clinician approval"
              : "Generate the summary after evidence is ready",
    },
  ];

  const readyForSummary =
    documents.length > 0 &&
    hasNarrativeDocument(documents) &&
    parsedDocuments > 0 &&
    pendingDocuments === 0 &&
    factCount > 0;
  const readyForGrading = readyForSummary && hasApprovedSummary;

  const blockers = [
    documents.length === 0 ? "No documents are attached to the case." : "",
    !hasNarrativeDocument(documents)
      ? "No referral, clinic letter, or discharge summary is attached."
      : "",
    pendingDocuments > 0
      ? `${pendingDocuments} document${pendingDocuments === 1 ? "" : "s"} still need ingest to complete.`
      : "",
    failedDocuments > 0
      ? `${failedDocuments} document${failedDocuments === 1 ? "" : "s"} failed ingest and should be reviewed.`
      : "",
    factCount === 0 ? "No extracted facts are available for deterministic summary or grading." : "",
    readyForSummary && !summaryStatus
      ? "Evidence is ready, but the one-page summary has not been generated yet."
      : "",
    readyForSummary && summaryStatus && !hasApprovedSummary
      ? "Summary exists, but clinician approval is still required before grading."
      : "",
  ].filter(Boolean);

  const recommendations = [
    serviceLine === "GYNAECOLOGY" && supportingDocuments === 0
      ? "Attach radiology, lab, or prior clinic documents before final gynaecology grading when available."
      : "",
    serviceLine === "COLPOSCOPY" && supportingDocuments === 0
      ? "Attach HPV, cytology, histology, or clinic documentation if it exists outside the referral."
      : "",
    pdfDocuments === 0 && documents.length > 0
      ? "Current automation is strongest on PDFs, but image uploads can now be OCRed when needed."
      : "",
    !readyForSummary && parsedDocuments === 0
      ? "Auto-ingest runs for PDFs uploaded in this screen. Use manual ingest for older uploads or non-PDF files."
      : "",
  ].filter(Boolean);

  return {
    stage: readyForGrading
      ? "READY_FOR_GRADING"
      : readyForSummary
        ? "READY_FOR_SUMMARY"
        : "NEEDS_EVIDENCE",
    headline: readyForGrading
      ? "Case is ready for grading"
      : readyForSummary
        ? "Case is ready for summary generation"
        : "Case still needs evidence preparation",
    variant: readyForGrading
      ? "low"
      : readyForSummary
        ? "high"
        : blockers.length > 0
          ? "urgent"
          : "default",
    checks,
    blockers,
    recommendations,
    stats: {
      totalDocuments: documents.length,
      narrativeDocuments,
      supportingDocuments,
      pdfDocuments,
      parsedDocuments,
      pendingDocuments,
      failedDocuments,
      factCount,
    },
  } satisfies CaseDocumentReadiness;
}
