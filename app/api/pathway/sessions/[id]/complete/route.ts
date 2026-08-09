/**
 * POST /api/pathway/sessions/[id]/complete
 * Finalize the wizard: run the decision engine, create clinical records,
 * and mark the wizard session as complete.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  CytologyResult,
  HPVResult,
  HistologyResult,
  PathwayFigure,
  ColposcopicImpression as PrismaColposcopicImpression,
  ReferralPriority,
  ReferralType,
  RiskLevel,
  SampleType,
  SessionStatus,
  TZType,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { answersToInputFields, getVisibleAnswerMap } from "@/lib/wizard/steps";
import type { ClinicalInput } from "@/lib/engine/types";
import { addMonths } from "date-fns";
import { evaluateGradedDecision } from "@/lib/clinical-rules/graded-decision";

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
  const actorUserId = session.user.id;

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
  const rawAnswersMap: Record<string, string> = {};
  wizardSession.answers.forEach((a) => { rawAnswersMap[a.stepId] = a.answerValue; });
  const answersMap = getVisibleAnswerMap(rawAnswersMap);
  if (answersMap.consent_confirmed !== "true") {
    return NextResponse.json(
      { error: "Consent is required before data entry can continue." },
      { status: 409 }
    );
  }

  // ── Convert to ClinicalInput ──────────────────────────────────────────────
  const fieldMap = answersToInputFields(answersMap) as Record<string, unknown>;
  const structuredInput = fieldMap as Partial<ClinicalInput>;
  const patient = wizardSession.patient;
  const existingSession = patient.screeningSessions[0];
  const baseConsecutiveNegativeCoTestCount = 0;
  const baseConsecutiveLowGradeCount = 0;
  const baseUnsatisfactoryCytologyCount = 0;

  // Compute patient age in years from DOB
  const patientAgYears = patient.dateOfBirth
    ? Math.floor((new Date().getTime() - new Date(patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : undefined;

  const clinicalInput: ClinicalInput = {
    ...structuredInput,
    patientId: patient.id,
    patientAge: patientAgYears,
    isFirstTimeHPVTransition: structuredInput.isFirstTimeHPVTransition ?? patient.isFirstTimeHPVTransition,
    isPostHysterectomy: structuredInput.isPostHysterectomy ?? patient.isPostHysterectomy,
    atypicalEndometrialHistory:
      structuredInput.atypicalEndometrialHistory ??
      (patient.medicalHistory?.atypicalEndometrialHistory ?? false),
    immunocompromised:
      structuredInput.immunocompromised ??
      (patient.medicalHistory?.immunocompromised ?? false),
    isTestOfCure: structuredInput.isTestOfCure ?? false,
    // Clean wizard runs do not inherit previous session counters. Repeat stage
    // and Test of Cure stage must come from the current wizard answers.
    consecutiveNegativeCoTestCount: baseConsecutiveNegativeCoTestCount,
    consecutiveLowGradeCount: baseConsecutiveLowGradeCount,
    unsatisfactoryCytologyCount: baseUnsatisfactoryCytologyCount,
  };

  // ── Evaluate decision via the governed authority path ─────────────────────
  // legacy router → authority resolver → engine → adapter → provenance.
  // The resolver answers LEGACY today, so `graded.decision` IS the legacy
  // decision and the canonical evaluation is written as SHADOW alongside it.
  const graded = await evaluateGradedDecision({
    input: clinicalInput,
    subjectReference: patient.id,
    enteredBy: actorUserId,
    caseId: undefined,
    factSource: "REVIEWER_ENTRY",
    caseCreatedAt: wizardSession.startedAt,
  });

  const decision = graded.decision;
  const versionedShadow = graded.evaluationId
    ? { evaluationId: graded.evaluationId }
    : null;

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
      status: (
        decision.referralRequired
          ? "REFERRED"
          : decision.recallRequired
            ? "RECALLED"
            : "COMPLETE"
      ) as SessionStatus,
      activeModule: decision.figure as PathwayFigure,
      activeModuleVersion: decision.ruleVersion,
      currentRiskLevel: decision.riskLevel as RiskLevel,
      nextScreeningDue,
      recommendation: decision.recommendation,
      recommendationCode: decision.recommendationCode,
      consecutiveNegativeCoTestCount:
        decision.resetConsecutiveNegative ? 0 :
        decision.incrementConsecutiveNegative
          ? baseConsecutiveNegativeCoTestCount + 1
          : baseConsecutiveNegativeCoTestCount,
      consecutiveLowGradeCount:
        decision.resetConsecutiveLowGrade ? 0 :
        decision.incrementConsecutiveLowGrade
          ? baseConsecutiveLowGradeCount + 1
          : baseConsecutiveLowGradeCount,
      unsatisfactoryCytologyCount:
        decision.incrementUnsatisfactory
          ? baseUnsatisfactoryCytologyCount + 1
          : baseUnsatisfactoryCytologyCount,
    },
  });

  // ── Create TestResult ──────────────────────────────────────────────────────
  if (clinicalInput.hpvResult || clinicalInput.cytologyResult) {
    await prisma.testResult.create({
      data: {
        screeningSessionId: screeningSession.id,
        testDate: now,
        sampleType: clinicalInput.sampleType as SampleType | undefined,
        hpvResult: clinicalInput.hpvResult as HPVResult | undefined,
        hpv16_18: clinicalInput.hpvResult === "HPV_16_18",
        hpvOther:  clinicalInput.hpvResult === "HPV_OTHER",
        cytologyResult: clinicalInput.cytologyResult as CytologyResult | undefined,
        histologyResult: clinicalInput.histologyResult as HistologyResult | undefined,
        tzType: clinicalInput.tzType as TZType | undefined,
      },
    });
  }

  // ── Create ColposcopyFinding when structured colposcopy facts were captured ─
  const shouldPersistColposcopy =
    answersMap.has_colposcopy_findings === "true" ||
    clinicalInput.visibleLesion !== undefined ||
    clinicalInput.colposcopicImpression !== undefined ||
    clinicalInput.transformationZoneState !== undefined ||
    clinicalInput.mdmOutcome !== undefined;

  if (shouldPersistColposcopy) {
    await prisma.colposcopyFinding.create({
      data: {
        screeningSessionId: screeningSession.id,
        clinicianId: session.user.id,
        colposcopyDate: now,
        tzType: (clinicalInput.colposcopyTZType ?? clinicalInput.tzType) as TZType | undefined,
        visibleLesion: clinicalInput.visibleLesion ?? (
          clinicalInput.colposcopicImpression === "LSIL" ||
          clinicalInput.colposcopicImpression === "HSIL" ||
          clinicalInput.colposcopicImpression === "INVASION"
        ),
        colposcopicImpression: clinicalInput.colposcopicImpression as PrismaColposcopicImpression | undefined,
        biopsyTaken: answersMap.biopsy_taken === "true" || clinicalInput.biopsyResult !== undefined,
        biopsyResult: clinicalInput.biopsyResult as HistologyResult | undefined,
        mdmReviewRequired: decision.requiresMDMReview ?? (clinicalInput.mdmOutcome !== undefined),
        mdmOutcome: clinicalInput.mdmOutcome,
        notes: clinicalInput.transformationZoneState
          ? `Transformation zone state: ${clinicalInput.transformationZoneState}`
          : undefined,
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
        type: (decision.referralType as ReferralType | undefined) ?? ReferralType.COLPOSCOPY,
        priority: decision.referralPriority as ReferralPriority,
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
      pathwayFigure: decision.figure as PathwayFigure,
      riskLevel: decision.riskLevel as RiskLevel,
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
        ruleVersion: decision.ruleVersion,
        branchPath: decision.branchPath,
        outcome: decision.safetyOutcome,
        missingInformation: decision.missingInformation,
        externalDependencies: decision.externalDependencies,
        validationStatus: decision.validationStatus,
        patientId: patient.id,
        inputFacts: clinicalInput,
      }),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "FINAL_RECOMMENDATION_GENERATED",
      entity: "WizardSession",
      entityId: id,
      newValue: JSON.stringify({
        patientId: patient.id,
        wizardSessionId: id,
        screeningSessionId: screeningSession.id,
        decisionCode: decision.recommendationCode,
        figure: decision.figure,
        inputFacts: clinicalInput,
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
      determinedFigure: decision.figure as PathwayFigure,
      screeningSessionId: screeningSession.id,
      ruleEvaluationId: versionedShadow?.evaluationId ?? null,
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
    versionedShadow,
  });
}
