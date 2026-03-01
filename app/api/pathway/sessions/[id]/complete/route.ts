/**
 * POST /api/pathway/sessions/[id]/complete
 * Finalize the wizard: run the decision engine, create clinical records,
 * and mark the wizard session as complete.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateClinicalDecision } from "@/lib/engine/decision-engine";
import { answersToInputFields } from "@/lib/wizard/steps";
import type { ClinicalInput } from "@/lib/engine/types";
import { addMonths, addDays } from "date-fns";

// Priority → target working days mapping
const PRIORITY_DAYS: Record<string, number> = {
  P1: 20,
  P2: 42,
  P3: 84,
  P4: 168,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const wizardSession = await prisma.wizardSession.findUnique({
    where: { id },
    include: {
      patient: {
        include: {
          medicalHistory: true,
          screeningSessions: {
            where: { status: { in: ["IN_PROGRESS", "RECALLED"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      answers: { orderBy: { stepNumber: "asc" } },
    },
  });

  if (!wizardSession) {
    return NextResponse.json({ error: "Wizard session not found" }, { status: 404 });
  }
  if (wizardSession.status === "COMPLETE") {
    // Return existing decision if already complete
    return NextResponse.json({
      alreadyComplete: true,
      decision: wizardSession.decisionJson
        ? JSON.parse(wizardSession.decisionJson)
        : null,
    });
  }

  // ── Build answers map ─────────────────────────────────────────────────────
  const answersMap: Record<string, string> = {};
  wizardSession.answers.forEach((a) => { answersMap[a.stepId] = a.answerValue; });

  // ── Convert to ClinicalInput ──────────────────────────────────────────────
  const fieldMap = answersToInputFields(answersMap) as Record<string, unknown>;
  const patient = wizardSession.patient;
  const existingSession = patient.screeningSessions[0];

  // Compute patient age in years from DOB
  const patientAgYears = patient.dateOfBirth
    ? Math.floor((new Date().getTime() - new Date(patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : undefined;

  const clinicalInput: ClinicalInput = {
    patientId:                patient.id,
    patientAge:               patientAgYears,
    isFirstTimeHPVTransition: (fieldMap.isFirstTimeHPVTransition as boolean) ?? patient.isFirstTimeHPVTransition,
    isPostHysterectomy:       (fieldMap.isPostHysterectomy as boolean) ?? patient.isPostHysterectomy,
    atypicalEndometrialHistory: (fieldMap.atypicalEndometrialHistory as boolean) ?? (patient.medicalHistory?.atypicalEndometrialHistory ?? false),
    immunocompromised:        (fieldMap.immunocompromised as boolean) ?? (patient.medicalHistory?.immunocompromised ?? false),
    sampleType:               fieldMap.sampleType as ClinicalInput["sampleType"],
    hpvResult:                fieldMap.hpvResult as ClinicalInput["hpvResult"],
    cytologyResult:           fieldMap.cytologyResult as ClinicalInput["cytologyResult"],
    histologyResult:          fieldMap.histologyResult as ClinicalInput["histologyResult"],
    tzType:                   fieldMap.tzType as ClinicalInput["tzType"],
    colposcopicImpression:    fieldMap.colposcopicImpression as ClinicalInput["colposcopicImpression"],
    biopsyResult:             fieldMap.biopsyResult as ClinicalInput["biopsyResult"],
    isPregnant:               fieldMap.isPregnant as boolean | undefined,
    hasAbnormalVaginalBleeding: fieldMap.hasAbnormalVaginalBleeding as boolean | undefined,
    abnormalCervix:           fieldMap.abnormalCervix as boolean | undefined,
    suspicionOfCancer:        fieldMap.suspicionOfCancer as boolean | undefined,
    suspectOralContraceptiveProblem: fieldMap.suspectOralContraceptiveProblem as boolean | undefined,
    stiIdentified:            fieldMap.stiIdentified as boolean | undefined,
    bleedingResolved:         fieldMap.bleedingResolved as boolean | undefined,
    mdmOutcome:               fieldMap.mdmOutcome as string | undefined,
    // Test of Cure flag — routes engine to Figure 6
    isTestOfCure:             (fieldMap.isTestOfCure as boolean | undefined) ?? false,
    // Counters from existing session
    consecutiveNegativeCoTestCount: existingSession?.consecutiveNegativeCoTestCount ?? 0,
    consecutiveLowGradeCount:       existingSession?.consecutiveLowGradeCount ?? 0,
    unsatisfactoryCytologyCount:    existingSession?.unsatisfactoryCytologyCount ?? 0,
  };

  // ── Evaluate decision ─────────────────────────────────────────────────────
  const decision = evaluateClinicalDecision(clinicalInput);

  // ── Create a fresh ScreeningSession for this wizard completion ───────────
  // Each wizard run produces its own clinical record (counters carry forward from
  // the patient's latest session, but a new record is always created).
  const now = new Date();
  const nextScreeningDue = decision.recallIntervalMonths
    ? addMonths(now, decision.recallIntervalMonths)
    : null;

  const screeningSession = await prisma.screeningSession.create({
    data: {
      patientId: patient.id,
      createdById: session.user.id,
      status: decision.referralRequired ? "REFERRED" : decision.recallRequired ? "RECALLED" : "COMPLETE",
      activeModule: decision.figure as any,
      currentRiskLevel: decision.riskLevel as any,
      nextScreeningDue,
      recommendation: decision.recommendation,
      recommendationCode: decision.recommendationCode,
      consecutiveNegativeCoTestCount:
        decision.resetConsecutiveNegative ? 0 :
        decision.incrementConsecutiveNegative
          ? (existingSession?.consecutiveNegativeCoTestCount ?? 0) + 1
          : existingSession?.consecutiveNegativeCoTestCount ?? 0,
      consecutiveLowGradeCount:
        decision.resetConsecutiveLowGrade ? 0 :
        decision.incrementConsecutiveLowGrade
          ? (existingSession?.consecutiveLowGradeCount ?? 0) + 1
          : existingSession?.consecutiveLowGradeCount ?? 0,
      unsatisfactoryCytologyCount:
        decision.incrementUnsatisfactory
          ? (existingSession?.unsatisfactoryCytologyCount ?? 0) + 1
          : existingSession?.unsatisfactoryCytologyCount ?? 0,
    },
  });

  // ── Create TestResult ──────────────────────────────────────────────────────
  if (clinicalInput.hpvResult || clinicalInput.cytologyResult) {
    await prisma.testResult.create({
      data: {
        screeningSessionId: screeningSession.id,
        testDate: now,
        sampleType: clinicalInput.sampleType as any ?? undefined,
        hpvResult: clinicalInput.hpvResult as any ?? undefined,
        hpv16_18: clinicalInput.hpvResult === "HPV_16_18",
        hpvOther:  clinicalInput.hpvResult === "HPV_OTHER",
        cytologyResult: clinicalInput.cytologyResult as any ?? undefined,
        histologyResult: clinicalInput.histologyResult as any ?? undefined,
        tzType: clinicalInput.tzType as any ?? undefined,
      },
    });
  }

  // ── Create Referral ───────────────────────────────────────────────────────
  let referral = null;
  if (decision.referralRequired && decision.referralPriority) {
    const targetDays = PRIORITY_DAYS[decision.referralPriority] ?? 84;
    referral = await prisma.referral.create({
      data: {
        screeningSessionId: screeningSession.id,
        type: (decision.referralType as any) ?? "COLPOSCOPY",
        priority: decision.referralPriority as any,
        status: "PENDING",
        reason: decision.referralReason ?? decision.recommendation,
        targetDays,
      },
    });
  }

  // ── Create Recall ─────────────────────────────────────────────────────────
  let recall = null;
  if (decision.recallRequired && decision.recallIntervalMonths && patient.gpPracticeId) {
    recall = await prisma.recall.create({
      data: {
        patientId: patient.id,
        practiceId: patient.gpPracticeId,
        status: "PENDING",
        dueDate: addMonths(now, decision.recallIntervalMonths),
        reason: decision.recommendation,
      },
    });
  }

  // ── PathwayStateHistory ────────────────────────────────────────────────────
  await prisma.pathwayStateHistory.create({
    data: {
      screeningSessionId: screeningSession.id,
      fromState: existingSession?.activeModule ?? null,
      toState: decision.figure,
      transitionReason: decision.recommendationCode,
      createdByUserId: session.user.id,
      pathwayFigure: decision.figure as any,
      riskLevel: decision.riskLevel as any,
    },
  });

  // ── AuditLog ──────────────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "WIZARD_COMPLETE",
      entity: "WizardSession",
      entityId: id,
      newValue: JSON.stringify({
        decisionCode: decision.recommendationCode,
        figure: decision.figure,
        riskLevel: decision.riskLevel,
        patientId: patient.id,
      }),
    },
  });

  // ── Mark wizard complete (atomic: only if still IN_PROGRESS) ─────────────
  // Using updateMany with a status filter prevents duplicate-completion race conditions.
  // If two requests arrive concurrently, only one will find status=IN_PROGRESS and succeed;
  // the other will silently match 0 rows without throwing a unique constraint error.
  await prisma.wizardSession.updateMany({
    where: { id, status: { not: "COMPLETE" } },
    data: {
      status: "COMPLETE",
      completedAt: now,
      decisionJson: JSON.stringify(decision),
      determinedFigure: decision.figure as any,
      screeningSessionId: screeningSession.id,
    },
  });

  return NextResponse.json({
    decision,
    screeningSessionId: screeningSession.id,
    referral,
    recall,
    patient: {
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      nhi: patient.nhi,
      dateOfBirth: patient.dateOfBirth,
      email: patient.email,
    },
  });
}
