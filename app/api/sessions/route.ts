import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { evaluateClinicalDecision } from "@/lib/engine/decision-engine";
import type { ClinicalInput } from "@/lib/engine/types";

// POST /api/sessions - Create session + evaluate clinical decision
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const {
    patientId,
    hpvResult,
    cytologyResult,
    histologyResult,
    sampleType,
    tzType,
    testDate,
    labId,
    specimenId,
    currentFigure,
    colposcopicImpression,
    biopsyResult,
    colposcopyTZType,
    mdmOutcome,
  } = body;

  if (!patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 });
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { medicalHistory: true },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  // Get or find active session
  let activeSession = await prisma.screeningSession.findFirst({
    where: { patientId, status: "IN_PROGRESS" },
  });

  const userId = (session.user as { id?: string }).id!;

  if (!activeSession) {
    activeSession = await prisma.screeningSession.create({
      data: {
        patientId,
        createdById: userId,
        status: "IN_PROGRESS",
      },
    });
  }

  // Create test result if results provided
  let testResult = null;
  if (hpvResult || cytologyResult || histologyResult) {
    testResult = await prisma.testResult.create({
      data: {
        screeningSessionId: activeSession.id,
        testDate: testDate ? new Date(testDate) : new Date(),
        hpvResult,
        cytologyResult,
        histologyResult,
        sampleType,
        tzType,
        labId,
        specimenId,
      },
    });
  }

  // Build clinical input
  const clinicalInput: ClinicalInput = {
    patientId,
    isFirstTimeHPVTransition: patient.isFirstTimeHPVTransition,
    previousScreeningType: patient.previousScreeningType as "CYTOLOGY" | "HPV" | undefined,
    isPostHysterectomy: patient.isPostHysterectomy,
    atypicalEndometrialHistory: patient.medicalHistory?.atypicalEndometrialHistory ?? false,
    immunocompromised: patient.medicalHistory?.immunocompromised ?? false,
    hpvResult: hpvResult as ClinicalInput["hpvResult"],
    cytologyResult: cytologyResult as ClinicalInput["cytologyResult"],
    histologyResult: histologyResult as ClinicalInput["histologyResult"],
    sampleType: sampleType as ClinicalInput["sampleType"],
    tzType: tzType as ClinicalInput["tzType"],
    consecutiveNegativeCoTestCount: activeSession.consecutiveNegativeCoTestCount,
    consecutiveLowGradeCount: activeSession.consecutiveLowGradeCount,
    unsatisfactoryCytologyCount: activeSession.unsatisfactoryCytologyCount,
    currentFigure: currentFigure as ClinicalInput["currentFigure"],
    colposcopicImpression: colposcopicImpression as ClinicalInput["colposcopicImpression"],
    biopsyResult: biopsyResult as ClinicalInput["biopsyResult"],
    colposcopyTZType: colposcopyTZType as ClinicalInput["colposcopyTZType"],
    mdmOutcome,
  };

  // Evaluate clinical decision
  const decision = evaluateClinicalDecision(clinicalInput);

  // Build counter updates
  const counterUpdates: Record<string, number> = {};
  if (decision.incrementConsecutiveNegative) {
    counterUpdates.consecutiveNegativeCoTestCount = activeSession.consecutiveNegativeCoTestCount + 1;
  }
  if (decision.resetConsecutiveNegative) {
    counterUpdates.consecutiveNegativeCoTestCount = 0;
  }
  if (decision.incrementConsecutiveLowGrade) {
    counterUpdates.consecutiveLowGradeCount = activeSession.consecutiveLowGradeCount + 1;
  }
  if (decision.resetConsecutiveLowGrade) {
    counterUpdates.consecutiveLowGradeCount = 0;
  }
  if (decision.incrementUnsatisfactory) {
    counterUpdates.unsatisfactoryCytologyCount = activeSession.unsatisfactoryCytologyCount + 1;
  }
  if (decision.resetUnsatisfactory) {
    counterUpdates.unsatisfactoryCytologyCount = 0;
  }

  // Update session with decision
  const updatedSession = await prisma.screeningSession.update({
    where: { id: activeSession.id },
    data: {
      activeModule: decision.figure,
      currentRiskLevel: decision.riskLevel,
      recommendation: decision.recommendation,
      recommendationCode: decision.recommendationCode,
      nextScreeningDue: decision.recallIntervalMonths
        ? new Date(Date.now() + decision.recallIntervalMonths * 30 * 24 * 60 * 60 * 1000)
        : undefined,
      status: decision.referralRequired ? "REFERRED" : decision.recallRequired ? "RECALLED" : "IN_PROGRESS",
      ...counterUpdates,
    },
  });

  // Create pathway state history
  await prisma.pathwayStateHistory.create({
    data: {
      screeningSessionId: activeSession.id,
      fromState: activeSession.activeModule ?? undefined,
      toState: decision.figure,
      transitionReason: decision.rationale,
      triggeredByResultId: testResult?.id,
      createdByUserId: userId,
      pathwayFigure: decision.figure,
      riskLevel: decision.riskLevel,
    },
  });

  // Create referral if required
  let referral = null;
  if (decision.referralRequired && decision.referralType) {
    const targetDays: Record<string, number> = { P1: 20, P2: 42, P3: 84, P4: 168 };
    referral = await prisma.referral.create({
      data: {
        screeningSessionId: activeSession.id,
        type: decision.referralType,
        priority: decision.referralPriority ?? "P3",
        reason: decision.referralReason,
        targetDays: targetDays[decision.referralPriority ?? "P3"],
        status: "PENDING",
      },
    });
  }

  // Create recall if required
  let recall = null;
  if (decision.recallRequired && decision.recallIntervalMonths) {
    recall = await prisma.recall.create({
      data: {
        patientId,
        practiceId: patient.gpPracticeId ?? undefined,
        dueDate: new Date(Date.now() + decision.recallIntervalMonths * 30 * 24 * 60 * 60 * 1000),
        reason: decision.recommendation,
        status: "PENDING",
      },
    });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: "EVALUATE",
      entity: "ScreeningSession",
      entityId: activeSession.id,
      newValue: JSON.stringify({
        figure: decision.figure,
        riskLevel: decision.riskLevel,
        recommendationCode: decision.recommendationCode,
      }),
    },
  });

  return NextResponse.json({
    session: updatedSession,
    decision,
    testResult,
    referral,
    recall,
  });
}

// GET /api/sessions - List sessions
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");
  const status = searchParams.get("status");

  const sessions = await prisma.screeningSession.findMany({
    where: {
      ...(patientId ? { patientId } : {}),
      ...(status ? { status: status as "IN_PROGRESS" } : {}),
    },
    include: {
      patient: { select: { nhi: true, firstName: true, lastName: true } },
      testResults: { orderBy: { testDate: "desc" }, take: 1 },
      referrals: { where: { status: "PENDING" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ sessions });
}
