/**
 * POST /api/pathway/sessions
 * Start or resume a wizard session for a patient.
 * Clean starts intentionally do not import prior answers or clinical result state.
 */

import { NextRequest, NextResponse } from "next/server";
import { PathwayFigure } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autofillFromPatient } from "@/lib/wizard/autofill";
import { getVisibleSteps, getNextUnansweredStep } from "@/lib/wizard/steps";
import { canUseManualPathway } from "@/lib/wizard/access";

type StartMode = "clean" | "import" | "resume";

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (!canUseManualPathway(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { patientId?: string; mode?: StartMode };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.patientId) {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  }
  const mode: StartMode = body.mode ?? "clean";
  if (!["clean", "import", "resume"].includes(mode)) {
    return NextResponse.json({ error: "mode must be clean, import, or resume" }, { status: 400 });
  }

  const patient = await prisma.patient.findUnique({
    where: { id: body.patientId },
    select: { id: true, firstName: true, lastName: true, nhi: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  if (mode === "resume") {
    const existing = await prisma.wizardSession.findFirst({
      where: {
        patientId: body.patientId,
        createdById: user.id,
        status: "IN_PROGRESS",
      },
      orderBy: { startedAt: "desc" },
      include: { answers: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "No incomplete assessment found for this patient" }, { status: 404 });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ASSESSMENT_RESUMED",
        entity: "WizardSession",
        entityId: existing.id,
        newValue: JSON.stringify({
          patientId: body.patientId,
          wizardSessionId: existing.id,
          previousAnswersRetained: true,
        }),
      },
    });

    return NextResponse.json({
      sessionId: existing.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientNhi: patient.nhi,
      mode,
      resumed: true,
      confidence: "partial",
      summary: ["Existing incomplete assessment resumed."],
      detectedFigure: existing.determinedFigure ?? undefined,
      nextStep: null,
      totalSteps: 0,
      autoFilledCount: existing.answers.filter((a) => a.isAutoFilled).length,
      isComplete: false,
    });
  }

  const autofill = mode === "import"
    ? await autofillFromPatient(body.patientId)
    : {
        answers: [],
        confidence: "none" as const,
        detectedFigure: undefined,
        summary: ["Clean assessment started. Previous answers were not imported."],
      };

  // Build answers map for step computation
  const answersMap: Record<string, string> = {};
  autofill.answers.forEach((a) => { answersMap[a.stepId] = a.answerValue; });

  // Create wizard session
  const wizardSession = await prisma.wizardSession.create({
    data: {
      patientId: body.patientId,
      createdById: user.id,
      status: "IN_PROGRESS",
      determinedFigure:
        (autofill.detectedFigure as PathwayFigure | undefined) ?? undefined,
      answers: {
        create: autofill.answers.map((a) => ({
          stepId: a.stepId,
          questionText: a.questionText,
          answerValue: a.answerValue,
          answerLabel: a.answerLabel,
          isAutoFilled: true,
          stepNumber: a.stepNumber,
        })),
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "NEW_ASSESSMENT_STARTED",
      entity: "WizardSession",
      entityId: wizardSession.id,
      newValue: JSON.stringify({
        patientId: body.patientId,
        wizardSessionId: wizardSession.id,
        mode,
        copiedPreviousAnswers: mode === "import",
        autoFilledCount: autofill.answers.length,
      }),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: mode === "import" ? "PREVIOUS_SESSION_IMPORTED" : "PREVIOUS_SESSION_NOT_IMPORTED",
      entity: "WizardSession",
      entityId: wizardSession.id,
      newValue: JSON.stringify({
        patientId: body.patientId,
        wizardSessionId: wizardSession.id,
        copiedPreviousAnswers: mode === "import",
        autoFilledStepIds: autofill.answers.map((a) => a.stepId),
      }),
    },
  });

  // Determine next step
  const nextStep = getNextUnansweredStep(answersMap);

  // Count visible non-info steps for progress
  const visibleSteps = getVisibleSteps(answersMap).filter((s) => s.type !== "info");
  const totalSteps = visibleSteps.length;
  const autoFilledCount = autofill.answers.length;

  return NextResponse.json({
    sessionId: wizardSession.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    patientNhi: patient.nhi,
    confidence: autofill.confidence,
    mode,
    summary: autofill.summary,
    detectedFigure: autofill.detectedFigure,
    nextStep: nextStep
      ? {
          id: nextStep.id,
          question: nextStep.question,
          hint: nextStep.hint,
          type: nextStep.type,
          options: nextStep.options,
        }
      : null,
    totalSteps,
    autoFilledCount,
    isComplete: autofill.confidence === "complete" && nextStep === null,
  });
}
