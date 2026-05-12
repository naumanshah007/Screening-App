/**
 * POST /api/pathway/sessions/[id]/answer
 * Submit an answer for a wizard step.
 * Returns the next step and whether the wizard is complete.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getNextUnansweredStep,
  getWizardProgress,
  getVisibleSteps,
  getStepById,
  getInvalidatedAnswerStepIds,
} from "@/lib/wizard/steps";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  let body: { stepId?: string; answerValue?: string; answerLabel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.stepId || body.answerValue === undefined || !body.answerLabel) {
    return NextResponse.json(
      { error: "stepId, answerValue, and answerLabel are required" },
      { status: 400 }
    );
  }

  const wizardSession = await prisma.wizardSession.findUnique({
    where: { id },
    include: { answers: { orderBy: { stepNumber: "asc" } } },
  });

  if (!wizardSession) {
    return NextResponse.json({ error: "Wizard session not found" }, { status: 404 });
  }
  if (wizardSession.status === "COMPLETE") {
    return NextResponse.json({ error: "Wizard session already complete" }, { status: 409 });
  }

  const step = getStepById(body.stepId);
  if (!step) {
    return NextResponse.json({ error: "Unknown step ID" }, { status: 400 });
  }

  // Build current answers map (before this new answer)
  const answersMap: Record<string, string> = {};
  wizardSession.answers.forEach((a) => { answersMap[a.stepId] = a.answerValue; });

  // Determine step number (position in visible steps)
  const visibleSteps = getVisibleSteps(answersMap).filter((s) => s.type !== "info");
  const stepNumber = visibleSteps.findIndex((s) => s.id === body.stepId);

  // Upsert the answer (allow changing answers)
  await prisma.wizardAnswer.upsert({
    where: {
      wizardSessionId_stepId: { wizardSessionId: id, stepId: body.stepId! },
    },
    create: {
      wizardSessionId: id,
      stepId: body.stepId!,
      questionText: step.question,
      answerValue: body.answerValue!,
      answerLabel: body.answerLabel!,
      isAutoFilled: false,
      stepNumber: stepNumber >= 0 ? stepNumber : wizardSession.answers.length,
    },
    update: {
      answerValue: body.answerValue!,
      answerLabel: body.answerLabel!,
      isAutoFilled: false,
    },
  });

  // Update answers map with new answer
  answersMap[body.stepId!] = body.answerValue!;

  const toRemove = getInvalidatedAnswerStepIds(
    Object.fromEntries(
      wizardSession.answers.map((a) => [a.stepId, a.answerValue])
    ),
    body.stepId,
    body.answerValue
  );

  if (toRemove.length > 0) {
    await prisma.wizardAnswer.deleteMany({
      where: { wizardSessionId: id, stepId: { in: toRemove } },
    });
    toRemove.forEach((sid) => delete answersMap[sid]);
  }

  const nextStep = getNextUnansweredStep(answersMap);
  const progress = getWizardProgress(answersMap);
  const isComplete = nextStep === null;
  const refreshedVisibleSteps = getVisibleSteps(answersMap).filter((s) => s.type !== "info");

  if (body.stepId === "consent_confirmed" && body.answerValue === "true") {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONSENT_CONFIRMED",
        entity: "WizardSession",
        entityId: id,
        newValue: JSON.stringify({
          patientId: wizardSession.patientId,
          wizardSessionId: id,
          consentConfirmed: true,
        }),
      },
    });
  }

  // Update the wizard session's determined figure
  const figureMap: Record<string, string> = {
    true_: "FIGURE_8",
  };
  void figureMap; // used below

  return NextResponse.json({
    success: true,
    nextStep: nextStep
      ? {
          id: nextStep.id,
          question: nextStep.question,
          hint: nextStep.hint,
          type: nextStep.type,
          options: nextStep.options,
        }
      : null,
    progress,
    isComplete,
    removedSteps: toRemove,
    answersMap,
    allSteps: refreshedVisibleSteps.map((s) => ({
      id: s.id,
      question: s.question,
      isAnswered: s.id in answersMap,
      isAutoFilled: false,
    })),
  });
}
