import { PrismaClient, type BatchReviewDisposition, type Prisma, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import { createPrismaAdapter } from "../lib/config/database";
import { ENGINE_VERSION, processBatch } from "../lib/batch/processor";
import { isReviewRequired } from "../lib/batch/persistence";
import type { CanonicalBatchCase } from "../lib/batch/types";
import { buildDecisionPackageAuditPayload } from "../lib/decisions/package-audit";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const DEMO_PASSWORD = "CerviGradeDemo123!";
const DEMO_SOURCE_FILE = "phase-3a-demo-reset.json";
const DEMO_SOURCE_SYSTEM = "CerviGrade demo environment - synthetic intake";

type DemoUser = {
  key: string;
  name: string;
  email: string;
  role: UserRole;
};

const DEMO_USERS: DemoUser[] = [
  { key: "admin", name: "Demo Admin", email: "admin@cervigrade.test", role: "ADMIN" },
  { key: "coordinator", name: "Demo Coordinator", email: "coordinator@cervigrade.test", role: "COORDINATOR" },
  { key: "smo", name: "Demo SMO Reviewer", email: "smo@cervigrade.test", role: "SMO_REVIEWER" },
  { key: "gynae", name: "Demo Gynae Grader", email: "gynae@cervigrade.test", role: "GYNAE_GRADER" },
  { key: "integration", name: "Demo Integration Admin", email: "integration@cervigrade.test", role: "INTEGRATION_ADMIN" },
];

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function caseDate(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function demoCase(
  rowNumber: number,
  label: string,
  fields: Partial<CanonicalBatchCase>
): CanonicalBatchCase {
  const externalPatientId = `ZZA${String(1000 + rowNumber).slice(-4)}`;

  return {
    caseId: `phase-3a-demo-${rowNumber}`,
    label,
    patientName: fields.patientName ?? `Demo Patient ${rowNumber}`,
    nhi: fields.nhi ?? externalPatientId,
    gpPractice: fields.gpPractice ?? "Manukau Superclinic GP",
    receivedDate: fields.receivedDate ?? caseDate(rowNumber),
    source: {
      sourceType: "demo",
      sourceSystem: DEMO_SOURCE_SYSTEM,
      sourceFileName: DEMO_SOURCE_FILE,
      importedAt: new Date().toISOString(),
      rowNumber,
      externalPatientId,
      mappingVersion: "phase-3a-demo-reset-v1",
      engineVersion: ENGINE_VERSION,
    },
    patientAge: 42,
    ethnicityPrimary: "MAORI",
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
    consecutiveNegativeCoTestCount: 0,
    consecutiveLowGradeCount: 0,
    unsatisfactoryCytologyCount: 0,
    validationStatus: "valid",
    validationErrors: [],
    validationWarnings: [],
    ...fields,
  };
}

function buildDemoCases(): CanonicalBatchCase[] {
  return [
    demoCase(1, "Pending routine - HPV not detected", {
      patientName: "Aroha Demo",
      nhi: "ZZA1001",
      patientAge: 35,
      ethnicityPrimary: "MAORI",
      hpvResult: "NOT_DETECTED",
      sampleType: "LBC",
    }),
    demoCase(2, "Pending mandatory review - external history required", {
      patientName: "Sina Demo",
      nhi: "ZZA1002",
      patientAge: 44,
      ethnicityPrimary: "PACIFIC",
      isFirstTimeHPVTransition: true,
      priorHighGradeResult: true,
      historySourceAvailable: false,
    }),
    demoCase(3, "Pending urgent - HPV 16/18 + HSIL", {
      patientName: "Priya Demo",
      nhi: "ZZA1003",
      patientAge: 47,
      ethnicityPrimary: "ASIAN",
      hpvResult: "HPV_16_18",
      cytologyResult: "HSIL",
      sampleType: "LBC",
    }),
    demoCase(4, "Accepted - reviewer confirmed routine pathway", {
      patientName: "Mere Demo",
      nhi: "ZZA1004",
      patientAge: 39,
      ethnicityPrimary: "MAORI",
      hpvResult: "HPV_OTHER",
      cytologyResult: "NEGATIVE",
      sampleType: "LBC",
    }),
    demoCase(5, "Rejected - duplicate referral in source system", {
      patientName: "Emma Demo",
      nhi: "ZZA1005",
      patientAge: 52,
      ethnicityPrimary: "EUROPEAN",
      hpvResult: "NOT_DETECTED",
      sampleType: "LBC",
    }),
    demoCase(6, "Needs info - swab return visit evidence missing", {
      patientName: "Litia Demo",
      nhi: "ZZA1006",
      patientAge: 31,
      ethnicityPrimary: "PACIFIC",
      hpvResult: "HPV_OTHER",
      sampleType: "SWAB",
      swabReturnVisitCompleted: false,
    }),
  ];
}

async function upsertDemoUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: Record<string, { id: string; email: string; name: string | null; role: UserRole }> = {};

  for (const user of DEMO_USERS) {
    users[user.key] = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash,
        passwordChangeRequired: false,
      },
      create: {
        name: user.name,
        email: user.email,
        role: user.role,
        passwordHash,
        passwordChangeRequired: false,
      },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  return users;
}

function dispositionFor(caseId: string): {
  disposition: BatchReviewDisposition;
  reviewerKey?: "smo" | "gynae";
  reviewedAt?: Date;
  reviewNote?: string;
  overrideReason?: string;
} {
  switch (caseId) {
    case "phase-3a-demo-4":
      return {
        disposition: "ACCEPTED",
        reviewerKey: "smo",
        reviewedAt: hoursAgo(1.5),
        reviewNote: "Reviewer confirmation required; reviewer confirmed the provisional recommendation for demo.",
      };
    case "phase-3a-demo-5":
      return {
        disposition: "REJECTED",
        reviewerKey: "smo",
        reviewedAt: hoursAgo(1.2),
        reviewNote: "Duplicate referral already managed in the source-system demo record.",
        overrideReason: "Duplicate referral - not proceeding in demo queue.",
      };
    case "phase-3a-demo-6":
      return {
        disposition: "NEEDS_INFO",
        reviewerKey: "gynae",
        reviewedAt: hoursAgo(0.8),
        reviewNote: "Request return-visit evidence before confirming the pathway.",
      };
    default:
      return { disposition: "PENDING" };
  }
}

async function clearDemoBatchData() {
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entity: "DecisionPackage", action: { in: ["SIMULATED_PACKAGE_PREVIEW", "SIMULATED_PACKAGE_EXPORT"] } },
        { entity: "BatchRun" },
        { entity: "BatchReviewItem" },
      ],
    },
  });
  await prisma.batchReviewItem.deleteMany({});
  await prisma.batchRun.deleteMany({});
}

async function createDemoRun(users: Awaited<ReturnType<typeof upsertDemoUsers>>) {
  const cases = buildDemoCases();
  const result = processBatch(cases);
  const counts: Record<BatchReviewDisposition, number> = {
    PENDING: 0,
    ACCEPTED: 0,
    REJECTED: 0,
    NEEDS_INFO: 0,
  };

  const items: Prisma.BatchReviewItemUncheckedCreateWithoutBatchRunInput[] = result.results.map((item) => {
    const c = item.case;
    const d = item.decision;
    const disposition = dispositionFor(c.caseId);
    counts[disposition.disposition] += 1;

    return {
      rowNumber: c.source.rowNumber,
      label: c.label ?? null,
      externalPatientId: c.source.externalPatientId ?? null,
      patientAge: c.patientAge ?? null,
      ethnicityPrimary: c.ethnicityPrimary ?? null,
      patientName: c.patientName ?? null,
      nhi: c.nhi ?? c.source.externalPatientId ?? null,
      gpPractice: c.gpPractice ?? null,
      receivedDate: c.receivedDate ? new Date(c.receivedDate) : null,
      figure: d.figure,
      riskLevel: d.riskLevel,
      recommendationCode: d.recommendationCode,
      recommendation: d.recommendation,
      referralPriority: d.referralPriority ?? null,
      referralType: d.referralType ?? null,
      safetyOutcome: d.safetyOutcome ?? null,
      reviewRequired: isReviewRequired(item),
      engineStatus: item.status,
      caseJson: JSON.stringify(c),
      inputJson: JSON.stringify(item.input),
      decisionJson: JSON.stringify(d),
      disposition: disposition.disposition,
      reviewedByUserId: disposition.reviewerKey ? users[disposition.reviewerKey].id : null,
      reviewedAt: disposition.reviewedAt ?? null,
      reviewNote: disposition.reviewNote ?? null,
      overrideReason: disposition.overrideReason ?? null,
    };
  });

  const run = await prisma.batchRun.create({
    data: {
      source: "DEMO",
      sourceSystem: DEMO_SOURCE_SYSTEM,
      sourceFileName: DEMO_SOURCE_FILE,
      engineVersion: result.engineVersion,
      totalCases: result.results.length,
      pendingCount: counts.PENDING,
      acceptedCount: counts.ACCEPTED,
      rejectedCount: counts.REJECTED,
      needsInfoCount: counts.NEEDS_INFO,
      reviewRequiredCount: result.results.filter(isReviewRequired).length,
      createdByUserId: users.coordinator.id,
      createdAt: hoursAgo(2),
      items: { create: items },
    },
    include: { items: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: users.coordinator.id,
      action: "CREATE",
      entity: "BatchRun",
      entityId: run.id,
      newValue: JSON.stringify({
        source: run.source,
        sourceSystem: run.sourceSystem,
        sourceFileName: run.sourceFileName,
        engineVersion: run.engineVersion,
        totalCases: run.totalCases,
        reviewRequiredCount: run.reviewRequiredCount,
        demoReset: true,
      }),
    },
  });

  const accepted = run.items.find((item) => item.disposition === "ACCEPTED");
  if (accepted) {
    const timestamp = new Date().toISOString();
    for (const audit of [
      { action: "SIMULATED_PACKAGE_PREVIEW" as const, format: "preview" as const },
      { action: "SIMULATED_PACKAGE_EXPORT" as const, format: "json" as const },
    ]) {
      await prisma.auditLog.create({
        data: {
          userId: users.integration.id,
          action: audit.action,
          entity: "DecisionPackage",
          entityId: accepted.id,
          exportEvent: true,
          ipAddress: "127.0.0.1",
          userAgent: "npm run demo:reset",
          newValue: JSON.stringify(
            buildDecisionPackageAuditPayload({
              action: audit.action,
              actorUserId: users.integration.id,
              batchReviewItemId: accepted.id,
              batchRunId: accepted.batchRunId,
              disposition: accepted.disposition,
              format: audit.format,
              timestamp,
            })
          ),
        },
      });
    }
  }

  return run;
}

async function main() {
  const users = await upsertDemoUsers();

  await clearDemoBatchData();
  const run = await createDemoRun(users);

  console.log("Demo reset complete");
  console.log(`Intake session: ${run.id}`);
  console.log(`Demo users: ${DEMO_USERS.map((user) => user.email).join(", ")}`);
  console.log(`Demo password: ${DEMO_PASSWORD}`);
  console.log("Seeded: 3 pending review items, 1 accepted, 1 rejected, 1 needs information, 2 simulated package audit events.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
