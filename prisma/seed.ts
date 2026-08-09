import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  createPrismaAdapter,
  isRemoteLibSqlUrl,
  resolveDatabaseUrl,
} from "../lib/config/database";
import { isProductionDeployment, readDemoSeedPassword } from "../lib/database/bootstrap";

// Prisma v7 uses the same adapter/runtime configuration as the app.
const adapter = createPrismaAdapter();
const prisma = new PrismaClient({ adapter });

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function demoRulePayload(args: {
  caseId: string;
  serviceLine: "COLPOSCOPY" | "GYNAECOLOGY";
  generatedBy: string;
  priority: string | null;
  category: string;
  outcome: string;
  workflow: string;
  rationale: string[];
  trace: Array<{
    code: string;
    title: string;
    impact: string;
    matched: boolean;
    evidence: string[];
  }>;
  warnings?: string[];
  nextActions?: string[];
  safetyOutcome?: string;
  missingInformation?: string[];
  externalDependencies?: string[];
}) {
  return {
    caseId: args.caseId,
    serviceLine: args.serviceLine,
    generatedAt: new Date().toLocaleString("en-NZ"),
    generatedBy: args.generatedBy,
    ruleRelease: {
      id: "demo-active-release",
      version: "demo-validated-mvp",
      name: `${args.serviceLine === "COLPOSCOPY" ? "Colposcopy" : "Gynaecology"} demo rule release`,
      schemaVersion: "1.0",
    },
    recommendation: {
      priority: args.priority,
      category: args.category,
      outcome: args.outcome,
    },
    operational: {
      workflow: args.workflow,
      requiresSmoReview: ["P1_HSC", "P2_HSC"].includes(args.priority ?? ""),
      reason: args.workflow === "BOOKABLE" ? null : args.outcome,
    },
    rationale: args.rationale,
    warnings: args.warnings ?? [],
    nextActions: args.nextActions ?? [
      "Clinician should confirm whether the provisional rule-based recommendation matches service guidelines.",
    ],
    trace: args.trace,
    safetyOutcome: args.safetyOutcome,
    missingInformation: args.missingInformation,
    externalDependencies: args.externalDependencies,
  };
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  if (isProductionDeployment()) {
    throw new Error("Demo seed is prohibited in Production.");
  }
  if (isRemoteLibSqlUrl(databaseUrl)) {
    throw new Error("Local demo seed is prohibited against a remote/shared database.");
  }
  const demoPassword = readDemoSeedPassword();
  if (!demoPassword) {
    throw new Error("DEMO_SEED_PASSWORD (minimum 12 characters) is required for local demo seeding.");
  }
  // ── Practices ─────────────────────────────────────────────────────────────
  const practice = await prisma.gPPractice.upsert({
    where: { hpiNumber: "G00001" },
    update: {},
    create: {
      name: "Auckland City Medical Centre",
      address: "123 Queen Street, Auckland 1010",
      dhbRegion: "Auckland",
      hpiNumber: "G00001",
    },
  });

  const cmPractice = await prisma.gPPractice.upsert({
    where: { hpiNumber: "G00042" },
    update: {},
    create: {
      name: "Manukau SuperClinic",
      address: "901 Great South Road, Manukau 2104",
      dhbRegion: "Counties Manukau",
      hpiNumber: "G00042",
    },
  });

  const papakuraPractice = await prisma.gPPractice.upsert({
    where: { hpiNumber: "G00088" },
    update: {},
    create: {
      name: "Papakura Family Health",
      address: "55 Broadway, Papakura 2110",
      dhbRegion: "Counties Manukau",
      hpiNumber: "G00088",
    },
  });

  // ── Users — operator-supplied local-only demo password ────────────────────
  const pw = await bcrypt.hash(demoPassword, 10);

  const userDefs = [
    { email: "admin@cs.nz", name: "System Admin", role: "ADMIN" as const, gpPracticeId: null },
    { email: "clinician@cs.nz", name: "Dr. Sarah Smith", role: "GP" as const, gpPracticeId: practice.id },
    { email: "coordinator@cs.nz", name: "Jane Coordinator", role: "COORDINATOR" as const, gpPracticeId: null },
    { email: "specialist@cs.nz", name: "Dr. James Colposcopy", role: "COLPOSCOPIST" as const, gpPracticeId: practice.id },
    // Enterprise demo users
    { email: "colpo.cns@cs.nz", name: "Nurse Kelly Chen", role: "COLPO_CNS" as const, gpPracticeId: null },
    { email: "gynae.grader@cs.nz", name: "Dr. Priya Sharma", role: "GYNAE_GRADER" as const, gpPracticeId: null },
    { email: "smo@cs.nz", name: "Dr. Jasveen Kaur", role: "SMO_REVIEWER" as const, gpPracticeId: null },
    { email: "integration.admin@cs.nz", name: "Alicia Integration", role: "INTEGRATION_ADMIN" as const, gpPracticeId: null },
    { email: "gp.manukau@cs.nz", name: "Dr. Aroha Te Ahu", role: "GP" as const, gpPracticeId: cmPractice.id },
  ];

  const createdUsers: Record<string, string> = {};
  for (const u of userDefs) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash: pw,
        passwordChangeRequired: false,
        passwordChangedAt: daysAgo(21),
        passwordExpiresAt: daysFromNow(69),
        role: u.role,
        name: u.name,
        twoFAEnabled: false,
        twoFASecret: null,
        twoFARecoveryCodesJson: null,
        failedAttempts: 0,
        lockedUntil: null,
        ...(u.gpPracticeId ? { gpPracticeId: u.gpPracticeId } : {}),
      },
      create: {
        email: u.email,
        name: u.name,
        passwordHash: pw,
        passwordChangeRequired: false,
        passwordChangedAt: daysAgo(21),
        passwordExpiresAt: daysFromNow(69),
        role: u.role,
        twoFAEnabled: false,
        ...(u.gpPracticeId ? { gpPracticeId: u.gpPracticeId } : {}),
      },
    });
    createdUsers[u.email] = user.id;
  }

  // ── Sample patients (legacy + enterprise demo) ────────────────────────────
  const patientDefs = [
    { nhi: "ZZZ0001", firstName: "Mary", lastName: "Johnson", dateOfBirth: new Date("1985-03-15"), gpPracticeId: practice.id },
    { nhi: "ZZZ0002", firstName: "Patricia", lastName: "Williams", dateOfBirth: new Date("1978-07-22"), gpPracticeId: practice.id, isFirstTimeHPVTransition: true, previousScreeningType: "CYTOLOGY" as const },
    { nhi: "ZZZ0003", firstName: "Linda", lastName: "Brown", dateOfBirth: new Date("1962-11-08"), gpPracticeId: practice.id, isPostHysterectomy: true },
    // Enterprise demo patients
    { nhi: "CMH1001", firstName: "Hine", lastName: "Tūhoe", dateOfBirth: new Date("1990-06-12"), gpPracticeId: cmPractice.id },
    { nhi: "CMH1002", firstName: "Anika", lastName: "Prasad", dateOfBirth: new Date("1975-02-28"), gpPracticeId: cmPractice.id },
    { nhi: "CMH1003", firstName: "Mei", lastName: "Wong", dateOfBirth: new Date("1988-09-14"), gpPracticeId: papakuraPractice.id },
    { nhi: "CMH1004", firstName: "Sarai", lastName: "Tanielu", dateOfBirth: new Date("1956-04-03"), gpPracticeId: cmPractice.id },
    { nhi: "CMH1005", firstName: "Aroha", lastName: "Kerehoma", dateOfBirth: new Date("1982-11-20"), gpPracticeId: papakuraPractice.id },
    { nhi: "CMH1006", firstName: "Fatima", lastName: "Hassan", dateOfBirth: new Date("1970-08-07"), gpPracticeId: cmPractice.id },
    { nhi: "CMH1007", firstName: "Rachel", lastName: "Clarke", dateOfBirth: new Date("1993-01-15"), gpPracticeId: papakuraPractice.id },
    { nhi: "CMH1008", firstName: "Deepa", lastName: "Nair", dateOfBirth: new Date("1965-12-30"), gpPracticeId: cmPractice.id },
  ];

  const createdPatients: Record<string, string> = {};
  for (const p of patientDefs) {
    const { gpPracticeId, ...rest } = p;
    const patient = await prisma.patient.upsert({
      where: { nhi: p.nhi },
      update: {},
      create: { ...rest, gpPracticeId, medicalHistory: { create: {} } },
    });
    createdPatients[p.nhi] = patient.id;
  }

  // ── Enterprise Referral Cases ─────────────────────────────────────────────

  const cnsId = createdUsers["colpo.cns@cs.nz"];
  const gradeId = createdUsers["gynae.grader@cs.nz"];
  const smoId = createdUsers["smo@cs.nz"];
  const adminId = createdUsers["admin@cs.nz"];
  const integrationAdminId = createdUsers["integration.admin@cs.nz"];
  const gpId = createdUsers["gp.manukau@cs.nz"];

  const existingDemoCases = await prisma.referralCase.findMany({
    where: { externalCaseId: { startsWith: "DEMO-" } },
    select: { id: true },
  });
  const existingDemoCaseIds = existingDemoCases.map((referralCase) => referralCase.id);
  if (existingDemoCaseIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: existingDemoCaseIds } },
    });
    await prisma.referralCase.deleteMany({
      where: { id: { in: existingDemoCaseIds } },
    });
  }

  async function addDemoDocument(args: {
    caseId: string;
    uploadedByUserId: string;
    fileName: string;
    type: "REFERRAL" | "LAB_RESULT" | "CLINIC_LETTER" | "RADIOLOGY";
    extractedText: string;
    facts: Array<{
      factType: string;
      label: string;
      valueText: string;
      valueNumber?: number;
      confidence?: number;
      sourceQuote?: string;
    }>;
  }) {
    const document = await prisma.referralDocument.create({
      data: {
        caseId: args.caseId,
        type: args.type,
        fileName: args.fileName,
        storageKey: `demo/${args.caseId}/${args.fileName}`,
        mimeType: "application/pdf",
        byteSize: 184_320,
        uploadedByUserId: args.uploadedByUserId,
        ocrStatus: "COMPLETE",
        parseStatus: "COMPLETE",
        pageCount: 1,
      },
    });
    const page = await prisma.documentPage.create({
      data: {
        documentId: document.id,
        pageNumber: 1,
        extractedText: args.extractedText,
      },
    });
    for (const fact of args.facts) {
      await prisma.extractedFact.create({
        data: {
          caseId: args.caseId,
          documentPageId: page.id,
          factType: fact.factType,
          label: fact.label,
          valueText: fact.valueText,
          valueNumber: fact.valueNumber,
          confidence: fact.confidence ?? 0.92,
          sourceQuote: fact.sourceQuote,
        },
      });
    }
  }

  await prisma.accessCertification.deleteMany({
    where: {
      systemName: "NCSR",
      userId: {
        in: [adminId, cnsId, smoId].filter(Boolean),
      },
    },
  });

  await prisma.accessCertification.createMany({
    data: [
      {
        userId: adminId,
        systemName: "NCSR",
        certificationType: "CONFIDENTIALITY_AND_SAFETY",
        completedAt: daysAgo(45),
        expiresAt: daysFromNow(320),
        active: true,
        notes: "Demo admin certification for restricted registry validation.",
      },
      {
        userId: cnsId,
        systemName: "NCSR",
        certificationType: "CONFIDENTIALITY_AND_SAFETY",
        completedAt: daysAgo(70),
        expiresAt: daysFromNow(180),
        active: true,
        notes: "Demo CNS certification for live NCSR pull workflow.",
      },
      {
        userId: smoId,
        systemName: "NCSR",
        certificationType: "CONFIDENTIALITY_AND_SAFETY",
        completedAt: daysAgo(350),
        expiresAt: daysFromNow(12),
        active: true,
        notes: "Demo SMO certification approaching expiry to surface governance warnings.",
      },
    ],
  });

  await prisma.integrationValidation.deleteMany({
    where: {
      integrationId: {
        in: ["database", "storage", "ai", "ncsr"],
      },
    },
  });

  await prisma.integrationValidation.createMany({
    data: [
      {
        integrationId: "database",
        environment: "demo",
        outcome: "WARNING",
        summary: "Managed database cutover was validated in a controlled demo environment.",
        notes:
          "Local development still uses a file-backed runtime, so production cutover remains a separate step.",
        validatedAt: daysAgo(14),
        expiresAt: daysFromNow(90),
        validatedByUserId: integrationAdminId,
      },
      {
        integrationId: "storage",
        environment: "demo",
        outcome: "WARNING",
        summary: "Upload and download workflow was validated through the provider abstraction.",
        notes:
          "Azure-backed validation is still required before production deployment because local fallback remains active in development.",
        validatedAt: daysAgo(10),
        expiresAt: daysFromNow(60),
        validatedByUserId: integrationAdminId,
      },
      {
        integrationId: "ai",
        environment: "demo",
        outcome: "WARNING",
        summary: "AI assist flow was reviewed in recommendation mode only.",
        notes:
          "Live provider governance and patient-data approval remain outstanding before production use.",
        validatedAt: daysAgo(7),
        expiresAt: daysFromNow(30),
        validatedByUserId: adminId,
      },
    ],
  });
  // ── COLPOSCOPY CASES ──────────────────────────────────────────────────────

  // Case 1: HPV 16/18 + HSIL → GRADED as P1_HSC
  const colpo1 = await prisma.referralCase.create({
    data: {
      patientId: createdPatients["CMH1001"],
      serviceLine: "COLPOSCOPY",
      status: "BOOKED",
      receivedAt: daysAgo(8),
      referralSource: "Manukau SuperClinic",
      externalCaseId: "DEMO-01-CLEAN-COLPO",
      referralReason: "Demo clean colposcopy case — HPV 16/18 detected with HSIL cytology",
      currentPriority: "P1_HSC",
      currentCategory: "High suspicion cancer",
      assignedToUserId: cnsId,
      createdByUserId: gpId,
      highSuspicionCancer: true,
      smoOnly: true,
      targetDueAt: daysFromNow(2),
      bookedForAt: daysFromNow(1),
      bookedAt: daysAgo(1),
      bookingNotes: "Demo booking: urgent colposcopy slot held at Middlemore Colposcopy Clinic.",
      triageNotes: "Urgent colposcopy required. HPV 16 detected on primary screen. Cytology shows HSIL. FCT pathway activated.",
      fctStatus: "high_suspicion",
      hpvTestResult: "hpv_16_18",
      hpvType: "primary_screening",
      cytologySample: "hsil",
      referrerReasonCode: "hpv_primary",
      assessmentOfReferral: "urgent",
      ovestinInstruction: "",
      ncsrNoteAdded: true,
    },
  });

  // Add rule decision for colpo1
  await prisma.ruleDecision.create({
    data: {
      caseId: colpo1.id,
      priority: "P1_HSC",
      category: "High suspicion cancer",
      outcome: "Urgent colposcopy senior review",
      rationale: "HPV 16/18 detected with HSIL cytology — triggers urgent FCT pathway.",
      evidenceJson: JSON.stringify({
        lines: [
          "HPV 16/18: Positive from demo HPV/cytology report page 1",
          "HSIL: Detected from demo HPV/cytology report page 1",
          "FCT status: high suspicion from structured colposcopy triage field",
        ],
      }),
      traceJson: JSON.stringify(demoRulePayload({
        caseId: colpo1.id,
        serviceLine: "COLPOSCOPY",
        generatedBy: "seeded demo rule engine",
        priority: "P1_HSC",
        category: "High suspicion cancer",
        outcome: "Urgent colposcopy senior review",
        workflow: "BOOKABLE",
        rationale: [
          "HPV 16/18 detected with HSIL cytology.",
          "High suspicion cancer/FCT pathway is active.",
          "Clinician confirmation remains required before patient-facing action.",
        ],
        trace: [
          {
            code: "DEMO-COL-HSC",
            title: "High suspicion colposcopy route",
            impact: "Urgent senior colposcopy review",
            matched: true,
            evidence: ["HPV 16/18 positive", "HSIL cytology", "FCT pathway active"],
          },
        ],
      })),
      generatedBy: "rule-engine-v2",
    },
  });

  await prisma.clinicianDecision.create({
    data: {
      caseId: colpo1.id,
      decidedByUserId: smoId,
      finalPriority: "P1_HSC",
      finalCategory: "High suspicion cancer",
      finalOutcome: "Urgent colposcopy within 10 days — FCT pathway confirmed",
      notes: "Agreed with rule recommendation. Patient to be seen urgently.",
    },
  });

  // Case 2: HPV Other + LSIL → READY_FOR_GRADING
  const colpo2 = await prisma.referralCase.create({
    data: {
      patientId: createdPatients["CMH1003"],
      serviceLine: "COLPOSCOPY",
      status: "NEEDS_MORE_INFO",
      receivedAt: daysAgo(5),
      referralSource: "Papakura Family Health",
      externalCaseId: "DEMO-02-MISSING-HISTORY",
      referralReason: "Demo safety stop — HPV other with low-grade cytology, but prior high-grade/Test of Cure history cannot be verified",
      currentPriority: "INFO_REQUIRED",
      currentCategory: "External history required",
      assignedToUserId: cnsId,
      createdByUserId: gpId,
      targetDueAt: daysFromNow(85),
      triageNotes: "Demo/manual history review required. NCSR is not live in this environment; do not infer prior high-grade or Test of Cure status.",
      hpvTestResult: "hpv_other",
      hpvType: "primary_screening",
      cytologySample: "lsil",
      referrerReasonCode: "hpv_primary",
      assessmentOfReferral: "appropriate",
    },
  });

  await prisma.ruleDecision.create({
    data: {
      caseId: colpo2.id,
      priority: "INFO_REQUIRED",
      category: "External history required",
      outcome: "External history required before pathway can be completed",
      rationale: "Prior high-grade/Test of Cure history cannot be verified in the demo environment.",
      evidenceJson: JSON.stringify({
        lines: [
          "HPV Other: Positive from demo HPV/cytology report page 1",
          "LSIL: Detected from demo HPV/cytology report page 1",
          "NCSR/history: unavailable in demo/manual review required",
        ],
      }),
      traceJson: JSON.stringify(demoRulePayload({
        caseId: colpo2.id,
        serviceLine: "COLPOSCOPY",
        generatedBy: "seeded demo rule engine",
        priority: "INFO_REQUIRED",
        category: "External history required",
        outcome: "External history required before pathway can be completed",
        workflow: "NEEDS_MORE_INFO",
        rationale: [
          "The supplied transition pathways depend on prior high-grade/Test of Cure and screening-history status.",
          "NCSR is not live in this demo environment, so the system stops rather than guessing.",
        ],
        warnings: [
          "External history/NCSR dependency is unresolved.",
        ],
        nextActions: [
          "Coordinator: request NCSR or local screening-history confirmation.",
          "Clinician reviewer: confirm prior high-grade/Test of Cure status before final routing.",
        ],
        safetyOutcome: "EXTERNAL_HISTORY_REQUIRED",
        missingInformation: [
          "screeningHistoryKnown",
          "previousHighGrade",
          "testOfCureStatus",
        ],
        externalDependencies: [
          "NCSR history",
          "local screening record",
        ],
        trace: [
          {
            code: "DEMO-HISTORY-STOP",
            title: "External history required",
            impact: "Stops routing until prior history is confirmed",
            matched: true,
            evidence: ["NCSR unavailable", "prior high-grade/Test of Cure status unknown"],
          },
        ],
      })),
      generatedBy: "rule-engine-v2",
    },
  });

  // Case 3: Abnormal cervical appearance → NEW
  await prisma.referralCase.create({
    data: {
      patientId: createdPatients["CMH1005"],
      serviceLine: "COLPOSCOPY",
      status: "NEW",
      receivedAt: daysAgo(1),
      referralSource: "Papakura Family Health",
      referralReason: "Abnormal cervical appearance at screening visit",
      currentPriority: null,
      currentCategory: null,
      assignedToUserId: null,
      createdByUserId: gpId,
      triageNotes: "GP noted abnormal-looking cervix during routine screening. Urgent assessment needed.",
      referrerReasonCode: "abnormal_appearance",
      hpvTestResult: "not_detected",
      cytologySample: "negative",
    },
  });

  // Case 4: HPV 16/18 + Normal cytology → BOOKED
  const colpo4 = await prisma.referralCase.create({
    data: {
      patientId: createdPatients["CMH1007"],
      serviceLine: "COLPOSCOPY",
      status: "BOOKED",
      receivedAt: daysAgo(20),
      referralSource: "Papakura Family Health",
      externalCaseId: "DEMO-03-CLINICIAN-OVERRIDE",
      referralReason: "Demo clinician override case — HPV 16/18 detected, cytology normal, post-menopausal symptoms noted",
      currentPriority: "P3",
      currentCategory: "HPV 16/18 positive referral",
      assignedToUserId: cnsId,
      createdByUserId: gpId,
      targetDueAt: daysFromNow(10),
      bookedForAt: daysFromNow(5),
      bookedAt: daysAgo(3),
      bookingNotes: "Booked at Middlemore Colposcopy Clinic",
      triageNotes: "System initially suggested P2 HPV 16/18 pathway. Clinician changed final route after reviewing symptoms and local clinic capacity; override reason is documented for audit.",
      hpvTestResult: "hpv_16_18",
      hpvType: "primary_screening",
      cytologySample: "negative",
      referrerReasonCode: "hpv_primary",
      assessmentOfReferral: "appropriate",
      ovestinInstruction: "2_nights",
    },
  });

  await prisma.ruleDecision.create({
    data: {
      caseId: colpo4.id,
      priority: "P2",
      category: "HPV 16/18 positive referral",
      outcome: "High-priority colposcopy review",
      rationale: "HPV 16/18 positivity detected.",
      evidenceJson: JSON.stringify({
        lines: [
          "HPV 16/18: Positive from demo HPV/cytology report page 1",
          "Cytology: Negative from demo HPV/cytology report page 1",
          "Symptoms: post-menopausal discomfort noted in referral",
        ],
      }),
      traceJson: JSON.stringify(demoRulePayload({
        caseId: colpo4.id,
        serviceLine: "COLPOSCOPY",
        generatedBy: "seeded demo rule engine",
        priority: "P2",
        category: "HPV 16/18 positive referral",
        outcome: "High-priority colposcopy review",
        workflow: "BOOKABLE",
        rationale: [
          "HPV 16/18 detected.",
          "Cytology is negative, but HPV 16/18 pathway still requires colposcopy review.",
        ],
        trace: [
          {
            code: "DEMO-COL-1618",
            title: "HPV 16/18 colposcopy route",
            impact: "High-priority colposcopy review",
            matched: true,
            evidence: ["HPV 16/18 positive", "cytology negative"],
          },
        ],
      })),
      generatedBy: "rule-engine-v2",
    },
  });

  await prisma.clinicianDecision.create({
    data: {
      caseId: colpo4.id,
      decidedByUserId: cnsId,
      finalPriority: "P3",
      finalCategory: "HPV 16/18 positive referral",
      finalOutcome: "Clinician override: routine colposcopy booking with documented local review plan",
      overrideReason: "Demo override: clinician reviewed symptoms, local capacity, and referral notes and changed priority for demonstration of auditable override workflow.",
      notes: "Override is intentionally seeded for demo. Ovestin prescribed as patient is post-menopausal.",
    },
  });

  // ── GYNAECOLOGY CASES ─────────────────────────────────────────────────────

  // Case 5: PMB with ET >= 5mm → GRADED as P1_HSC (RAC clinic)
  const gynae1 = await prisma.referralCase.create({
    data: {
      patientId: createdPatients["CMH1004"],
      serviceLine: "GYNAECOLOGY",
      status: "GRADED",
      receivedAt: daysAgo(6),
      referralSource: "Manukau SuperClinic",
      referralReason: "Post-menopausal bleeding with thickened endometrium",
      currentPriority: "P1_HSC",
      currentCategory: "Postmenopausal bleeding",
      assignedToUserId: gradeId,
      createdByUserId: gpId,
      highSuspicionCancer: true,
      smoOnly: true,
      targetDueAt: daysFromNow(14),
      triageNotes: "68yo female. Multiple episodes of PMB. USS shows ET 8mm. No previous gynaecological history.",
      gynaecologyCategory: "pmb",
      ussAvailable: true,
      ussFindings: "Endometrial thickness 8mm. No adnexal abnormality.",
    },
  });

  await prisma.ruleDecision.create({
    data: {
      caseId: gynae1.id,
      priority: "P1_HSC",
      category: "Postmenopausal bleeding",
      outcome: "High suspicion cancer clinic / rapid access review",
      rationale: "Postmenopausal bleeding with endometrial thickness >= 5mm triggers HSC pathway.",
      evidenceJson: JSON.stringify({ matchedRules: ["GYN-003"], factCount: 2, endometrialThickness: 8 }),
      traceJson: JSON.stringify([
        { code: "GYN-001", matched: false, reason: "Not flagged as HSC at intake" },
        { code: "GYN-002", matched: false, reason: "USS available" },
        { code: "GYN-003", matched: true, reason: "PMB with ET 8mm >= 5mm threshold" },
      ]),
      generatedBy: "rule-engine-v2",
    },
  });

  await prisma.clinicianDecision.create({
    data: {
      caseId: gynae1.id,
      decidedByUserId: smoId,
      finalPriority: "P1_HSC",
      finalCategory: "Postmenopausal bleeding",
      finalOutcome: "Rapid Access Clinic — hysteroscopy within 2 weeks",
      notes: "Agreed with rule. Booking RAC clinic. Community pipelle not feasible — patient preference for in-clinic assessment.",
    },
  });

  // Case 6: Large fibroids with mass symptoms → READY_FOR_GRADING
  const gynae2 = await prisma.referralCase.create({
    data: {
      patientId: createdPatients["CMH1002"],
      serviceLine: "GYNAECOLOGY",
      status: "GRADED",
      receivedAt: daysAgo(12),
      referralSource: "Manukau SuperClinic",
      externalCaseId: "DEMO-04-GYNAE-SUMMARY",
      referralReason: "Demo gynaecology summary case — large fibroids with urinary symptoms and heavy bleeding",
      currentPriority: "P2",
      currentCategory: "Fibroids with mass symptoms",
      assignedToUserId: gradeId,
      createdByUserId: gpId,
      targetDueAt: daysFromNow(21),
      triageNotes: "49yo female. USS shows multiple fibroids, largest 6cm intramural. Heavy menstrual bleeding with iron deficiency. Urinary frequency and incomplete emptying.",
      gynaecologyCategory: "fibroids",
      ussAvailable: true,
      ussFindings: "Multiple fibroids. Largest 6cm intramural. ET 10mm. No adnexal pathology.",
    },
  });

  await prisma.ruleDecision.create({
    data: {
      caseId: gynae2.id,
      priority: "P2",
      category: "Fibroids with mass symptoms",
      outcome: "Semi-urgent gynaecology review",
      rationale: "Fibroids >= 3cm with mass symptoms (urinary, bleeding).",
      evidenceJson: JSON.stringify({
        lines: [
          "Fibroids: Multiple fibroids from demo pelvic ultrasound page 1",
          "Fibroid size: 6cm from demo pelvic ultrasound page 1",
          "Mass symptoms: urinary frequency and incomplete emptying from referral letter page 1",
        ],
      }),
      traceJson: JSON.stringify(demoRulePayload({
        caseId: gynae2.id,
        serviceLine: "GYNAECOLOGY",
        generatedBy: "seeded demo rule engine",
        priority: "P2",
        category: "Fibroids with mass symptoms",
        outcome: "Semi-urgent gynaecology review",
        workflow: "BOOKABLE",
        rationale: [
          "Pelvic ultrasound is available.",
          "Largest fibroid is 6cm with urinary mass symptoms and heavy bleeding.",
          "This demonstrates the gynaecology workflow beyond cervical screening.",
        ],
        trace: [
          {
            code: "DEMO-GYN-FIBROID",
            title: "Fibroids with mass symptoms",
            impact: "Semi-urgent gynaecology review",
            matched: true,
            evidence: ["fibroid 6cm", "urinary symptoms", "heavy menstrual bleeding"],
          },
        ],
      })),
      generatedBy: "rule-engine-v2",
    },
  });

  await prisma.clinicianDecision.create({
    data: {
      caseId: gynae2.id,
      decidedByUserId: gradeId,
      finalPriority: "P2",
      finalCategory: "Fibroids with mass symptoms",
      finalOutcome: "Semi-urgent gynaecology review",
      notes: "Accepted seeded recommendation for demo. USS and symptoms are sufficient for workbench review.",
    },
  });

  // Case 7: AUB without USS → REJECTED
  await prisma.referralCase.create({
    data: {
      patientId: createdPatients["CMH1006"],
      serviceLine: "GYNAECOLOGY",
      status: "REJECTED",
      receivedAt: daysAgo(15),
      referralSource: "Manukau SuperClinic",
      referralReason: "Heavy menstrual bleeding for 6 months",
      currentPriority: "REJECT",
      currentCategory: "Abnormal uterine bleeding",
      assignedToUserId: gradeId,
      createdByUserId: gpId,
      triageNotes: "AUB referral without pelvic ultrasound. Rejected per guideline — GP asked to re-refer with USS. Letter sent to GP.",
      gynaecologyCategory: "aub",
      ussAvailable: false,
    },
  });

  // Case 8: Ovarian cyst with elevated CA-125 → GRADED P2_HSC
  const gynae4 = await prisma.referralCase.create({
    data: {
      patientId: createdPatients["CMH1008"],
      serviceLine: "GYNAECOLOGY",
      status: "GRADED",
      receivedAt: daysAgo(10),
      referralSource: "Manukau SuperClinic",
      referralReason: "Complex ovarian cyst with elevated CA-125",
      currentPriority: "P2_HSC",
      currentCategory: "Concerning ovarian/adnexal mass",
      assignedToUserId: smoId,
      createdByUserId: gpId,
      highSuspicionCancer: false,
      smoOnly: true,
      targetDueAt: daysFromNow(20),
      triageNotes: "59yo female. USS shows complex left ovarian cyst 5cm. CA-125 elevated at 72 (normal <35). CT chest/abdomen/pelvis ordered.",
      gynaecologyCategory: "ovarian_mass",
      ussAvailable: true,
      ussFindings: "Complex left ovarian cyst 5cm with solid component. Right ovary normal. No free fluid.",
    },
  });

  await prisma.ruleDecision.create({
    data: {
      caseId: gynae4.id,
      priority: "P2_HSC",
      category: "Concerning ovarian/adnexal mass",
      outcome: "SMO review with HSC-monitored semi-urgent pathway",
      rationale: "Ovarian cyst with elevated CA-125 (72 >= 35) triggers HSC-monitored pathway.",
      evidenceJson: JSON.stringify({ matchedRules: ["GYN-005"], factCount: 2, ca125: 72 }),
      traceJson: JSON.stringify([
        { code: "GYN-001", matched: false, reason: "No HSC flag at intake" },
        { code: "GYN-005", matched: true, reason: "Ovarian cyst with CA-125 72 >= 35" },
      ]),
      generatedBy: "rule-engine-v2",
    },
  });

  await prisma.clinicianDecision.create({
    data: {
      caseId: gynae4.id,
      decidedByUserId: smoId,
      finalPriority: "P2_HSC",
      finalCategory: "Concerning ovarian/adnexal mass",
      finalOutcome: "SMO review — CT ordered. Await CT before booking. HSC tracked.",
      notes: "Complex cyst with elevated markers. CT chest/abdomen/pelvis ordered. Will reassess once imaging available. Possible referral to FCT team if frankly malignant on CT.",
      overrideReason: null,
    },
  });

  // Add investigations for the ovarian cyst case
  await prisma.caseInvestigation.create({
    data: {
      caseId: gynae4.id,
      type: "CA-125",
      result: "72 U/mL (elevated, normal <35)",
      notes: "Ordered by GP prior to referral",
    },
  });

  await prisma.caseInvestigation.create({
    data: {
      caseId: gynae4.id,
      type: "CT Chest/Abdomen/Pelvis",
      result: null,
      notes: "Ordered by SMO reviewer — awaiting result",
    },
  });

  await prisma.caseInvestigation.create({
    data: {
      caseId: gynae4.id,
      type: "Pelvic Ultrasound",
      result: "Complex left ovarian cyst 5cm with solid component",
      notes: "Performed at Manukau Radiology",
    },
  });

  await addDemoDocument({
    caseId: colpo1.id,
    uploadedByUserId: gpId,
    fileName: "demo-colpo-clean-hpv-cytology.pdf",
    type: "LAB_RESULT",
    extractedText: "HPV 16 detected. Cytology: HSIL. Referral notes: high suspicion/FCT pathway requested.",
    facts: [
      { factType: "HPV", label: "HPV 16/18", valueText: "Positive", sourceQuote: "HPV 16 detected" },
      { factType: "CYTOLOGY", label: "HSIL", valueText: "Detected", sourceQuote: "Cytology: HSIL" },
      { factType: "TRIAGE", label: "FCT pathway", valueText: "High suspicion", sourceQuote: "high suspicion/FCT pathway requested" },
    ],
  });

  await addDemoDocument({
    caseId: colpo2.id,
    uploadedByUserId: gpId,
    fileName: "demo-colpo-missing-history-referral.pdf",
    type: "REFERRAL",
    extractedText: "HPV Other detected with LSIL cytology. Prior high-grade and Test of Cure status not available from local notes. NCSR check required.",
    facts: [
      { factType: "HPV", label: "HPV Other", valueText: "Positive", sourceQuote: "HPV Other detected" },
      { factType: "CYTOLOGY", label: "LSIL", valueText: "Detected", sourceQuote: "LSIL cytology" },
      { factType: "HISTORY", label: "External history", valueText: "NCSR required", sourceQuote: "Prior high-grade and Test of Cure status not available" },
    ],
  });

  await addDemoDocument({
    caseId: colpo4.id,
    uploadedByUserId: gpId,
    fileName: "demo-colpo-override-hpv-cytology.pdf",
    type: "LAB_RESULT",
    extractedText: "HPV 16/18 detected. Cytology negative. Referral notes post-menopausal discomfort and request for clinical review.",
    facts: [
      { factType: "HPV", label: "HPV 16/18", valueText: "Positive", sourceQuote: "HPV 16/18 detected" },
      { factType: "CYTOLOGY", label: "Cytology negative", valueText: "Negative", sourceQuote: "Cytology negative" },
      { factType: "SYMPTOMS", label: "Post-menopausal symptoms", valueText: "Present", sourceQuote: "post-menopausal discomfort" },
    ],
  });

  await addDemoDocument({
    caseId: gynae2.id,
    uploadedByUserId: gpId,
    fileName: "demo-gynae-fibroids-uss.pdf",
    type: "RADIOLOGY",
    extractedText: "Pelvic ultrasound: multiple fibroids, largest 6cm intramural. Endometrium 10mm. No adnexal pathology. Symptoms: urinary frequency and heavy bleeding.",
    facts: [
      { factType: "IMAGING", label: "Fibroids", valueText: "Multiple fibroids", sourceQuote: "multiple fibroids" },
      { factType: "IMAGING", label: "Largest fibroid", valueText: "6cm", valueNumber: 6, sourceQuote: "largest 6cm intramural" },
      { factType: "SYMPTOMS", label: "Mass symptoms", valueText: "Urinary frequency", sourceQuote: "urinary frequency and heavy bleeding" },
    ],
  });

  // ── Clinical summaries for graded cases ──────────────────────────────────

  await prisma.clinicalSummary.create({
    data: {
      caseId: colpo1.id,
      status: "APPROVED",
      summaryJson: JSON.stringify({
        sections: [
          { id: "referral", title: "Referral overview", bullets: ["Demo clean colposcopy case referred from Manukau SuperClinic.", "HPV 16 detected on primary screening with HSIL cytology."] },
          { id: "findings", title: "Key findings", bullets: ["HPV 16/18 positive.", "HSIL cytology.", "No known immunodeficiency documented."] },
          { id: "recommendation", title: "Recommendation", bullets: ["Urgent colposcopy senior review.", "FCT pathway active.", "Clinician final decision has accepted the provisional recommendation."] },
        ],
        warnings: [],
        nextActions: ["Proceed with booked urgent colposcopy appointment."],
        generatedBy: "seeded demo summary",
      }),
      renderedMarkdown: "## Referral Overview\n29yo female referred from Manukau SuperClinic. HPV 16 detected on primary screening. Cytology shows HSIL.\n\n## Key Findings\n- HPV 16 positive\n- HSIL on cytology\n- No prior colposcopy history\n- No known immunodeficiency\n\n## Recommendation\nUrgent colposcopy within 10 days. FCT pathway activated.",
      generatedBy: "summary-engine-v1",
      approvedByUserId: smoId,
      approvedAt: daysAgo(7),
    },
  });

  await prisma.clinicalSummary.create({
    data: {
      caseId: colpo2.id,
      status: "APPROVED",
      summaryJson: JSON.stringify({
        sections: [
          { id: "referral", title: "Referral overview", bullets: ["Demo missing-history case with HPV Other and LSIL cytology.", "Prior high-grade/Test of Cure history cannot be verified from local demo data."] },
          { id: "safety", title: "Safety stop", bullets: ["NCSR is not live in this demo environment.", "External history or local screening record is required before final routing."] },
        ],
        warnings: ["External history/NCSR dependency unresolved."],
        nextActions: ["Coordinator to request NCSR or local screening-history confirmation."],
        generatedBy: "seeded demo summary",
      }),
      renderedMarkdown: "## Referral Overview\nDemo missing-history case with HPV Other and LSIL cytology.\n\n## Safety Stop\n- NCSR is not live in this demo environment\n- External history/local screening record required before final routing",
      generatedBy: "summary-engine-v1",
      approvedByUserId: cnsId,
      approvedAt: daysAgo(4),
    },
  });

  await prisma.clinicalSummary.create({
    data: {
      caseId: colpo4.id,
      status: "APPROVED",
      summaryJson: JSON.stringify({
        sections: [
          { id: "referral", title: "Referral overview", bullets: ["Demo clinician override case.", "HPV 16/18 detected with negative cytology."] },
          { id: "decision", title: "Decision context", bullets: ["A P2 provisional recommendation was generated for reviewer confirmation.", "Clinician changed the final decision and recorded an override reason."] },
        ],
        warnings: ["Override is seeded for demonstration of auditable clinician control."],
        nextActions: ["Review override reason and booking/SLA panel."],
        generatedBy: "seeded demo summary",
      }),
      renderedMarkdown: "## Referral Overview\nDemo clinician override case. HPV 16/18 detected with negative cytology.\n\n## Decision Context\n- Provisional recommendation differs from final clinician decision\n- Override reason is documented for audit",
      generatedBy: "summary-engine-v1",
      approvedByUserId: cnsId,
      approvedAt: daysAgo(3),
    },
  });

  await prisma.clinicalSummary.create({
    data: {
      caseId: gynae1.id,
      status: "APPROVED",
      summaryJson: JSON.stringify({
        sections: [
          { id: "referral", title: "Referral overview", bullets: ["68yo female with multiple episodes of post-menopausal bleeding.", "USS shows endometrial thickness 8mm."] },
          { id: "findings", title: "Key findings", bullets: ["PMB x3 episodes over 2 months.", "ET 8mm, above 5mm threshold.", "No adnexal abnormality on USS."] },
          { id: "recommendation", title: "Recommendation", bullets: ["P1_HSC rapid access clinic.", "Hysteroscopy recommended within 2 weeks."] },
        ],
        warnings: [],
        nextActions: ["Book Rapid Access Clinic appointment."],
        generatedBy: "seeded demo summary",
      }),
      renderedMarkdown: "## Referral Overview\n68yo female. Multiple episodes of PMB. USS shows ET 8mm.\n\n## Key Findings\n- PMB x3 episodes over 2 months\n- ET 8mm (threshold >= 5mm)\n- No adnexal abnormality\n\n## Missing Information\n- No previous pipelle/endometrial biopsy\n\n## Recommendation\nP1_HSC — Rapid Access Clinic. Hysteroscopy within 2 weeks.",
      generatedBy: "summary-engine-v1",
      approvedByUserId: smoId,
      approvedAt: daysAgo(5),
    },
  });

  await prisma.clinicalSummary.create({
    data: {
      caseId: gynae2.id,
      status: "APPROVED",
      summaryJson: JSON.stringify({
        sections: [
          { id: "referral", title: "Referral overview", bullets: ["Demo gynaecology summary case for fibroids.", "Heavy menstrual bleeding with urinary frequency and incomplete emptying."] },
          { id: "evidence", title: "Evidence", bullets: ["Pelvic ultrasound available.", "Multiple fibroids; largest 6cm intramural.", "No adnexal pathology."] },
          { id: "recommendation", title: "Recommendation", bullets: ["Semi-urgent gynaecology review.", "Shows the product supports gynaecology referral grading as well as colposcopy."] },
        ],
        warnings: [],
        nextActions: ["Proceed to gynaecology review workbench and booking route."],
        generatedBy: "seeded demo summary",
      }),
      renderedMarkdown: "## Referral Overview\nDemo gynaecology summary case for fibroids.\n\n## Evidence\n- Pelvic ultrasound available\n- Multiple fibroids; largest 6cm\n- Urinary symptoms and heavy bleeding\n\n## Recommendation\nSemi-urgent gynaecology review.",
      generatedBy: "summary-engine-v1",
      approvedByUserId: gradeId,
      approvedAt: daysAgo(6),
    },
  });

  // ── Audit log entries ────────────────────────────────────────────────────

  const auditEntries = [
    { userId: gpId, action: "CREATE", entity: "ReferralCase", entityId: colpo1.id, newValue: JSON.stringify({ demoCase: "DEMO-01-CLEAN-COLPO" }) },
    { userId: cnsId, action: "APPROVE", entity: "ClinicalSummary", entityId: colpo1.id, newValue: JSON.stringify({ status: "APPROVED", demoCase: "clean colposcopy" }) },
    { userId: cnsId, action: "EVALUATE", entity: "RuleDecision", entityId: colpo1.id, newValue: JSON.stringify({ ruleVersion: "demo-validated-mvp", branchPath: ["DEMO-COL-HSC"], outcome: "Urgent colposcopy senior review" }) },
    { userId: smoId, action: "APPROVE", entity: "ClinicianDecision", entityId: colpo1.id, newValue: JSON.stringify({ finalOutcome: "accepted", override: false }) },
    { userId: gpId, action: "CREATE", entity: "ReferralCase", entityId: colpo2.id, newValue: JSON.stringify({ demoCase: "DEMO-02-MISSING-HISTORY" }) },
    { userId: cnsId, action: "EVALUATE", entity: "RuleDecision", entityId: colpo2.id, newValue: JSON.stringify({ safetyOutcome: "EXTERNAL_HISTORY_REQUIRED", missingFacts: ["screeningHistoryKnown", "previousHighGrade", "testOfCureStatus"], externalDependencies: ["NCSR history", "local screening record"] }) },
    { userId: gpId, action: "CREATE", entity: "ReferralCase", entityId: colpo4.id, newValue: JSON.stringify({ demoCase: "DEMO-03-CLINICIAN-OVERRIDE" }) },
    { userId: cnsId, action: "EVALUATE", entity: "RuleDecision", entityId: colpo4.id, newValue: JSON.stringify({ provisionalPriority: "P2", branchPath: ["DEMO-COL-1618"] }) },
    { userId: cnsId, action: "APPROVE", entity: "ClinicianDecision", entityId: colpo4.id, newValue: JSON.stringify({ finalPriority: "P3", override: true, overrideReason: "Demo override reason recorded" }) },
    { userId: gpId, action: "CREATE", entity: "ReferralCase", entityId: gynae1.id },
    { userId: gradeId, action: "EVALUATE", entity: "RuleDecision", entityId: gynae1.id },
    { userId: smoId, action: "APPROVE", entity: "ClinicianDecision", entityId: gynae1.id },
    { userId: gpId, action: "CREATE", entity: "ReferralCase", entityId: gynae2.id, newValue: JSON.stringify({ demoCase: "DEMO-04-GYNAE-SUMMARY" }) },
    { userId: gradeId, action: "APPROVE", entity: "ClinicalSummary", entityId: gynae2.id, newValue: JSON.stringify({ status: "APPROVED", demoCase: "gynaecology summary" }) },
    { userId: gradeId, action: "EVALUATE", entity: "RuleDecision", entityId: gynae2.id, newValue: JSON.stringify({ ruleVersion: "demo-validated-mvp", branchPath: ["DEMO-GYN-FIBROID"], outcome: "Semi-urgent gynaecology review" }) },
  ];

  for (const entry of auditEntries) {
    await prisma.auditLog.create({ data: entry });
  }

  await prisma.securityIncident.deleteMany({
    where: {
      title: {
        in: [
          "Accounts currently locked",
          "Admin credential recovery activity",
        ],
      },
    },
  });

  await prisma.securityIncident.createMany({
    data: [
      {
        title: "Accounts currently locked",
        summary:
          "One or more accounts are currently locked and need review or recovery support.",
        severity: "URGENT",
        status: "OPEN",
        dueAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        sourcePreset: "locked-accounts",
        sourceEntity: "SecurityEvent",
        sourceAction: "LOGIN_LOCKED",
        openedByUserId: integrationAdminId,
      },
      {
        title: "Admin credential recovery activity",
        summary:
          "Recent password or 2FA resets were issued and should be reviewed as part of routine governance.",
        severity: "INFO",
        status: "UNDER_REVIEW",
        dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
        lastReminderAt: daysAgo(1),
        sourcePreset: "credential-recovery",
        sourceEntity: "UserPassword",
        openedByUserId: adminId,
        assignedToUserId: integrationAdminId,
        acknowledgedAt: daysAgo(1),
      },
    ],
  });

  console.log("\n✓ Seed complete — operator-supplied password applied (not echoed)\n");
  console.log("  Email                    Role              Notes");
  console.log("  ──────────────────────────────────────────────────────────────────");
  console.log("  admin@cs.nz              ADMIN             System administrator");
  console.log("  clinician@cs.nz          GP                Auckland GP");
  console.log("  coordinator@cs.nz        COORDINATOR       Booking coordinator");
  console.log("  specialist@cs.nz         COLPOSCOPIST      Colposcopy specialist");
  console.log("  colpo.cns@cs.nz          COLPO_CNS         Colposcopy clinical nurse");
  console.log("  gynae.grader@cs.nz       GYNAE_GRADER      Gynaecology grader");
  console.log("  smo@cs.nz                SMO_REVIEWER      Senior Medical Officer");
  console.log("  integration.admin@cs.nz  INTEGRATION_ADMIN Integration readiness admin");
  console.log("  gp.manukau@cs.nz         GP                Counties Manukau GP");
  console.log("\n  NCSR certification demo state:");
  console.log("  admin@cs.nz              Certified");
  console.log("  colpo.cns@cs.nz          Certified");
  console.log("  smo@cs.nz                Certified · expires soon");
  console.log("  integration.admin@cs.nz  Missing certification");
  console.log("\n  Integration validation demo state:");
  console.log("  database                 Warning record on file");
  console.log("  storage                  Warning record on file");
  console.log("  ai                       Warning record on file");
  console.log("  ncsr                     No formal validation recorded");
  console.log("\n  Security incident demo state:");
  console.log("  Accounts currently locked          Open / overdue / unassigned");
  console.log("  Admin credential recovery activity Under review / due soon / assigned");
  console.log("\n  Enterprise demo cases:");
  console.log("  DEMO-01-CLEAN-COLPO            Clean booked colposcopy case");
  console.log("  DEMO-02-MISSING-HISTORY        External history/NCSR safety stop");
  console.log("  DEMO-03-CLINICIAN-OVERRIDE     Clinician override with audit trail");
  console.log("  DEMO-04-GYNAE-SUMMARY          Gynaecology summary/workbench case\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
