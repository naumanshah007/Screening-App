import { prisma } from "@/lib/prisma";

export type SummarySection = {
  id: string;
  title: string;
  bullets: string[];
};

export type ClinicalSummaryPayload = {
  caseId: string;
  serviceLine: "COLPOSCOPY" | "GYNAECOLOGY";
  generatedAt: string;
  generatedBy: string;
  warnings: string[];
  nextActions: string[];
  sections: SummarySection[];
};

const storedClinicalSummaryInclude = {
  approvedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} as const;

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatDocumentType(type: string) {
  switch (type) {
    case "REFERRAL":
      return "Referral";
    case "CLINIC_LETTER":
      return "Clinic letter";
    case "DISCHARGE_SUMMARY":
      return "Discharge summary";
    case "LAB_RESULT":
      return "Lab result";
    case "RADIOLOGY":
      return "Radiology";
    default:
      return "Other document";
  }
}

function buildSummaryMarkdown(payload: ClinicalSummaryPayload) {
  const lines: string[] = [
    `# ${payload.serviceLine === "COLPOSCOPY" ? "Colposcopy" : "Gynaecology"} Case Summary`,
    "",
    `Generated: ${payload.generatedAt}`,
    "",
  ];

  if (payload.warnings.length > 0) {
    lines.push("## Warnings");
    for (const warning of payload.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  for (const section of payload.sections) {
    lines.push(`## ${section.title}`);
    for (const bullet of section.bullets) {
      lines.push(`- ${bullet}`);
    }
    lines.push("");
  }

  if (payload.nextActions.length > 0) {
    lines.push("## Next Actions");
    for (const action of payload.nextActions) {
      lines.push(`- ${action}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function makeFindingBullet(args: {
  label: string;
  valueText: string;
  documentName: string;
  pageNumber: number;
  confidence?: number | null;
}) {
  const confidenceText =
    args.confidence !== null && args.confidence !== undefined
      ? ` (${Math.round(args.confidence * 100)}%)`
      : "";
  return `${args.label}: ${args.valueText}${confidenceText} from ${args.documentName} page ${args.pageNumber}`;
}

export async function getStoredClinicalSummary(caseId: string) {
  return prisma.clinicalSummary.findUnique({
    where: { caseId },
    include: storedClinicalSummaryInclude,
  });
}

export async function generateClinicalSummary(args: {
  caseId: string;
  generatedByUserId: string;
  generatedByLabel: string;
}) {
  const referralCase = await prisma.referralCase.findUnique({
    where: { id: args.caseId },
    include: {
      patient: {
        select: {
          id: true,
          nhi: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gpPractice: {
            select: {
              name: true,
            },
          },
        },
      },
      assignedTo: {
        select: {
          name: true,
          email: true,
        },
      },
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
      documents: {
        include: {
          pages: {
            include: {
              facts: true,
            },
            orderBy: {
              pageNumber: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
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
    },
  });

  if (!referralCase) {
    throw new Error("Referral case not found");
  }

  const documents = referralCase.documents;
  const facts = referralCase.extractedFacts;
  const parsedDocuments = documents.filter((document) => document.parseStatus === "COMPLETE");
  const failedDocuments = documents.filter((document) => document.parseStatus === "FAILED");

  const overviewBullets = unique([
    `Patient: ${referralCase.patient.firstName} ${referralCase.patient.lastName} (${referralCase.patient.nhi})`,
    `Service line: ${referralCase.serviceLine === "COLPOSCOPY" ? "Colposcopy" : "Gynaecology"}`,
    `Referral reason: ${referralCase.referralReason ?? "Not recorded"}`,
    `Priority: ${referralCase.currentPriority ?? "Not set"}`,
    `Category: ${referralCase.currentCategory ?? "Not set"}`,
    `Received: ${referralCase.receivedAt.toLocaleString("en-NZ")}`,
    `Assigned to: ${referralCase.assignedTo?.name ?? "Unassigned"}`,
    `Created by: ${referralCase.createdBy.name ?? referralCase.createdBy.email ?? "Unknown user"}`,
    referralCase.referralSource ? `Referral source: ${referralCase.referralSource}` : "",
    referralCase.externalCaseId ? `External case id: ${referralCase.externalCaseId}` : "",
    referralCase.highSuspicionCancer ? "High suspicion cancer flag is active" : "",
    referralCase.smoOnly ? "SMO-only review flag is active" : "",
  ]);

  const evidenceBullets = unique([
    documents.length > 0
      ? `${documents.length} document${documents.length === 1 ? "" : "s"} attached`
      : "No documents attached",
    parsedDocuments.length > 0
      ? `${parsedDocuments.length} document${parsedDocuments.length === 1 ? "" : "s"} parsed successfully`
      : "No successfully parsed documents yet",
    facts.length > 0
      ? `${facts.length} extracted fact${facts.length === 1 ? "" : "s"} available`
      : "No extracted facts available",
    ...documents.map(
      (document) =>
        `${formatDocumentType(document.type)}: ${document.fileName} (${document.parseStatus.toLowerCase()})`
    ),
  ]);

  const keyFindingBullets = unique(
    facts.slice(0, 12).map((fact) =>
      makeFindingBullet({
        label: fact.label,
        valueText: fact.valueText,
        documentName: fact.documentPage.document.fileName,
        pageNumber: fact.documentPage.pageNumber,
        confidence: fact.confidence,
      })
    )
  );

  const missingInformation: string[] = [];

  if (documents.length === 0) {
    missingInformation.push("No referral package has been uploaded.");
  }
  if (referralCase.serviceLine === "GYNAECOLOGY") {
    const hasRadiology = documents.some((document) => document.type === "RADIOLOGY");
    const hasLab = documents.some((document) => document.type === "LAB_RESULT");
    const hasClinicContext = documents.some((document) =>
      ["CLINIC_LETTER", "DISCHARGE_SUMMARY"].includes(document.type)
    );
    const hasEndometrialThickness = facts.some(
      (fact) => fact.label === "Endometrial thickness"
    );
    const hasCa125 = facts.some((fact) => fact.label === "CA-125");
    const hasBleedingSignal = facts.some((fact) =>
      ["Postmenopausal bleeding", "Abnormal uterine bleeding"].includes(fact.label)
    );
    const hasOvarianSignal = facts.some((fact) =>
      ["Ovarian cyst", "Ovarian cyst size"].includes(fact.label)
    );

    if (!hasRadiology) {
      missingInformation.push("No radiology or ultrasound document is attached.");
    }
    if (!hasClinicContext) {
      missingInformation.push("No clinic letter or discharge summary is attached.");
    }
    if (hasBleedingSignal && !hasEndometrialThickness) {
      missingInformation.push("Bleeding-related referral without extracted endometrial thickness.");
    }
    if (hasOvarianSignal && !hasCa125 && !hasLab) {
      missingInformation.push("Ovarian/adnexal signal without tumour marker evidence.");
    }
  } else {
    const hasCervicalResult = facts.some((fact) =>
      ["CERVICAL_RESULT", "HISTOLOGY"].includes(fact.factType)
    );
    const hasReferralDocument = documents.some((document) => document.type === "REFERRAL");

    if (!hasReferralDocument) {
      missingInformation.push("No referral document is attached.");
    }
    if (!hasCervicalResult) {
      missingInformation.push("No HPV, cytology, or histology result was extracted.");
    }
  }

  const warnings = unique([
    failedDocuments.length > 0
      ? `${failedDocuments.length} document${failedDocuments.length === 1 ? "" : "s"} failed parse and may need OCR support.`
      : "",
    facts.length === 0
      ? "Summary has limited clinical signal because no extracted facts are available."
      : "",
    documents.length > 0 && parsedDocuments.length === 0
      ? "All uploaded documents are still pending or failed parse."
      : "",
  ]);

  const nextActions = unique([
    documents.length === 0 ? "Upload the referral package before grading." : "",
    failedDocuments.length > 0 ? "Review failed documents and rerun ingest or add OCR support." : "",
    missingInformation.length > 0 ? "Resolve key evidence gaps before final grading." : "",
    missingInformation.length === 0 && facts.length > 0
      ? "Evidence set is sufficient for an initial clinician grading review."
      : "",
  ]);

  const payload: ClinicalSummaryPayload = {
    caseId: referralCase.id,
    serviceLine: referralCase.serviceLine,
    generatedAt: new Date().toLocaleString("en-NZ"),
    generatedBy: args.generatedByLabel,
    warnings,
    nextActions,
    sections: [
      {
        id: "overview",
        title: "Referral Overview",
        bullets: overviewBullets,
      },
      {
        id: "evidence",
        title: "Evidence Coverage",
        bullets: evidenceBullets,
      },
      {
        id: "findings",
        title: "Key Extracted Findings",
        bullets:
          keyFindingBullets.length > 0
            ? keyFindingBullets
            : ["No extracted findings are available yet."],
      },
      {
        id: "gaps",
        title: "Missing Information",
        bullets:
          missingInformation.length > 0
            ? missingInformation
            : ["No major evidence gaps were detected by the current ruleset."],
      },
    ],
  };

  const renderedMarkdown = buildSummaryMarkdown(payload);

  const summary = await prisma.clinicalSummary.upsert({
    where: { caseId: referralCase.id },
    update: {
      status: "DRAFT",
      summaryJson: JSON.stringify(payload),
      renderedMarkdown,
      generatedBy: args.generatedByLabel,
      approvedByUserId: null,
      approvedAt: null,
    },
    create: {
      caseId: referralCase.id,
      status: "DRAFT",
      summaryJson: JSON.stringify(payload),
      renderedMarkdown,
      generatedBy: args.generatedByLabel,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: args.generatedByUserId,
      action: "GENERATE",
      entity: "ClinicalSummary",
      entityId: summary.id,
      newValue: JSON.stringify({
        caseId: referralCase.id,
        warningCount: warnings.length,
        factCount: facts.length,
        documentCount: documents.length,
      }),
    },
  });

  return summary;
}

export async function reviewClinicalSummary(args: {
  caseId: string;
  actorUserId: string;
  actorLabel: string;
  renderedMarkdown: string;
  action: "review" | "approve";
}) {
  const existingSummary = await prisma.clinicalSummary.findUnique({
    where: { caseId: args.caseId },
    include: storedClinicalSummaryInclude,
  });

  if (!existingSummary) {
    throw new Error("Clinical summary not found");
  }

  const nextMarkdown = args.renderedMarkdown.trim();
  if (!nextMarkdown) {
    throw new Error("Summary markdown is required");
  }

  const nextStatus = args.action === "approve" ? "APPROVED" : "REVIEWED";
  const approvedAt = args.action === "approve" ? new Date() : null;

  const summary = await prisma.clinicalSummary.update({
    where: { caseId: args.caseId },
    data: {
      renderedMarkdown: nextMarkdown,
      status: nextStatus,
      approvedByUserId: args.action === "approve" ? args.actorUserId : null,
      approvedAt,
    },
    include: storedClinicalSummaryInclude,
  });

  await prisma.auditLog.create({
    data: {
      userId: args.actorUserId,
      action: args.action === "approve" ? "APPROVE" : "REVIEW",
      entity: "ClinicalSummary",
      entityId: summary.id,
      oldValue: JSON.stringify({
        status: existingSummary.status,
        approvedByUserId: existingSummary.approvedByUserId,
        approvedAt: existingSummary.approvedAt,
        renderedMarkdown: existingSummary.renderedMarkdown,
      }),
      newValue: JSON.stringify({
        status: summary.status,
        approvedByUserId: summary.approvedByUserId,
        approvedAt: summary.approvedAt,
        renderedMarkdown: summary.renderedMarkdown,
        actorLabel: args.actorLabel,
      }),
    },
  });

  return summary;
}

export function parseClinicalSummaryPayload(summaryJson: string): ClinicalSummaryPayload {
  return JSON.parse(summaryJson) as ClinicalSummaryPayload;
}
