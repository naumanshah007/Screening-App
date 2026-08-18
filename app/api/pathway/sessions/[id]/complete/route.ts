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
import { evaluateClinicalDecision } from "@/lib/engine/decision-engine";
import { answersToInputFields, getVisibleAnswerMap } from "@/lib/wizard/steps";
import type { ClinicalInput } from "@/lib/engine/types";
import { addMonths } from "date-fns";
import { canAccessWizardSession } from "@/lib/wizard/access";
import { evaluateClinicalCase } from "@/lib/clinical-rules/evaluator";
import { resolveShadowClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";
import { canonicalClinicalFactsV2FromFlatFacts } from "@/lib/clinical-rules/canonical-facts-v2";
import { normalizeClinicalFactMap } from "@/lib/clinical-rules/facts";

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
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const actorUserId = user.id;

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
  if (!canAccessWizardSession(user, wizardSession.createdById)) {
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

  // ── Evaluate decision ─────────────────────────────────────────────────────
  const decision = evaluateClinicalDecision(clinicalInput);
  const shadowVersion = await resolveShadowClinicalRuleVersion();
  const canonicalWizardInput = { ...clinicalInput } as Record<string, unknown>;
  // A suspected OCP contribution or an identified STI does not prove that a
  // clinician adjusted treatment. Those completion facts remain absent until
  // explicitly documented.
  delete canonicalWizardInput.oralContraceptiveAdjusted;
  delete canonicalWizardInput.stiTreated;
  const canonicalFactsV2 = canonicalClinicalFactsV2FromFlatFacts({
    subjectReference: patient.id,
    facts: normalizeClinicalFactMap({
      ...canonicalWizardInput,
      currentPathway: decision.figure,
    }),
    source: "REVIEWER_ENTRY",
    enteredBy: actorUserId,
  });
  const versionedShadow = shadowVersion
    ? await evaluateClinicalCase({
        canonicalFactsV2,
        ruleVersionId: shadowVersion.id,
        evaluationMode: "SHADOW",
        legacyInput: clinicalInput,
      }).catch(async (error) => {
        await prisma.auditLog.create({
          data: {
            userId: actorUserId,
            action: "CLINICAL_RULE_SHADOW_FAILED",
            entity: "WizardSession",
            entityId: id,
            severity: "ERROR",
            newValue: JSON.stringify({
              ruleVersionId: shadowVersion.id,
              message: error instanceof Error ? error.message : String(error),
            }),
          },
        });
        return null;
      })
    : null;

  const patientResponse = {
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    name: `${patient.firstName} ${patient.lastName}`,
    nhi: patient.nhi,
    dateOfBirth: patient.dateOfBirth,
    email: patient.email,
  };

  if (req.nextUrl.searchParams.get("preview") === "true") {
    return NextResponse.json({
      preview: true,
      decision,
      screeningSessionId: "",
      referral: null,
      recall: null,
      patient: patientResponse,
      versionedShadow,
    });
  }

  if (decision.safetyOutcome || decision.validationStatus !== "IMPLEMENTED") {
    return NextResponse.json(
      {
        error: "This recommendation requires additional information or clinical review and cannot be finalised from the manual pathway.",
        decision,
      },
      { status: 409 }
    );
  }

  // Claim finalisation before creating any clinical records. This compare-and-set
  // makes duplicate browser requests and concurrent retries harmless.
  const finalizationMarker = JSON.stringify({
    finalizing: true,
    claimedBy: actorUserId,
    claimedAt: new Date().toISOString(),
  });
  const claim = await prisma.wizardSession.updateMany({
    where: { id, status: "IN_PROGRESS", decisionJson: null },
    data: { decisionJson: finalizationMarker },
  });
  if (claim.count !== 1) {
    const current = await prisma.wizardSession.findUnique({
      where: { id },
      select: { status: true, decisionJson: true },
    });
    if (current?.status === "COMPLETE" && current.decisionJson) {
      return NextResponse.json({
        alreadyComplete: true,
        decision: JSON.parse(current.decisionJson),
      });
    }
    return NextResponse.json(
      { error: "This assessment is already being finalised. Please wait and retry." },
      { status: 409 }
    );
  }

  // ── Create a fresh ScreeningSession for this wizard completion ───────────
  // Each wizard run produces its own clinical record (counters carry forward from
  // the patient's latest session, but a new record is always created).
  const now = new Date();
  const nextScreeningDue = decision.recallIntervalMonths
    ? addMonths(now, decision.recallIntervalMonths)
    : null;

  try {
    const persisted = await prisma.$transaction(async (tx) => {
  const screeningSession = await tx.screeningSession.create({
    data: {
      patientId: patient.id,
      createdById: actorUserId,
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
    await tx.testResult.create({
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
    await tx.colposcopyFinding.create({
      data: {
        screeningSessionId: screeningSession.id,
        clinicianId: actorUserId,
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
    referral = await tx.referral.create({
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
    recall = await tx.recall.create({
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
  await tx.pathwayStateHistory.create({
    data: {
      screeningSessionId: screeningSession.id,
      fromState: existingSession?.activeModule ?? null,
      toState: decision.figure,
      transitionReason: decision.recommendationCode,
      createdByUserId: actorUserId,
      pathwayFigure: decision.figure as PathwayFigure,
      riskLevel: decision.riskLevel as RiskLevel,
    },
  });

  // ── AuditLog ──────────────────────────────────────────────────────────────
  await tx.auditLog.create({
    data: {
      userId: actorUserId,
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

  await tx.auditLog.create({
    data: {
      userId: actorUserId,
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

  // ── Mark wizard complete in the same transaction as all clinical records ─
  await tx.wizardSession.update({
    where: { id },
    data: {
      status: "COMPLETE",
      completedAt: now,
      decisionJson: JSON.stringify(decision),
      determinedFigure: decision.figure as PathwayFigure,
      screeningSessionId: screeningSession.id,
      ruleEvaluationId: versionedShadow?.evaluationId ?? null,
    },
  });

  return {
    decision,
    screeningSessionId: screeningSession.id,
    referral,
    recall,
  };
    });

  return NextResponse.json({
    ...persisted,
    patient: patientResponse,
    versionedShadow,
  });
  } catch (error) {
    // The clinical transaction rolled back. Release only our own claim so the
    // user can retry safely; never clear a completed decision.
    await prisma.wizardSession.updateMany({
      where: { id, status: "IN_PROGRESS", decisionJson: finalizationMarker },
      data: { decisionJson: null },
    });
    throw error;
  }
}
