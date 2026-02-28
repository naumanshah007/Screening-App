/**
 * GET /api/pathway/sessions/[id]
 * Get the current state of a wizard session including all answers and next step.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleSteps, getNextUnansweredStep, getWizardProgress } from "@/lib/wizard/steps";

export async function GET(
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
        select: {
          id: true,
          nhi: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          email: true,
          phone: true,
          isFirstTimeHPVTransition: true,
          isPostHysterectomy: true,
          gpPractice: { select: { name: true, id: true } },
          medicalHistory: {
            select: { atypicalEndometrialHistory: true, immunocompromised: true },
          },
        },
      },
      answers: { orderBy: { stepNumber: "asc" } },
      createdBy: { select: { name: true, email: true, role: true } },
    },
  });

  if (!wizardSession) {
    return NextResponse.json({ error: "Wizard session not found" }, { status: 404 });
  }

  // Rebuild answers map
  const answersMap: Record<string, string> = {};
  wizardSession.answers.forEach((a) => { answersMap[a.stepId] = a.answerValue; });

  const nextStep = getNextUnansweredStep(answersMap);
  const progress = getWizardProgress(answersMap);
  const visibleSteps = getVisibleSteps(answersMap).filter((s) => s.type !== "info");

  return NextResponse.json({
    session: {
      id: wizardSession.id,
      status: wizardSession.status,
      determinedFigure: wizardSession.determinedFigure,
      startedAt: wizardSession.startedAt,
      completedAt: wizardSession.completedAt,
      decisionJson: wizardSession.decisionJson
        ? JSON.parse(wizardSession.decisionJson)
        : null,
    },
    patient: wizardSession.patient,
    createdBy: wizardSession.createdBy,
    answers: wizardSession.answers,
    answersMap,
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
    allSteps: visibleSteps.map((s) => ({
      id: s.id,
      question: s.question,
      isAnswered: s.id in answersMap,
      isAutoFilled: wizardSession.answers.find((a) => a.stepId === s.id)?.isAutoFilled ?? false,
    })),
    isComplete: nextStep === null,
  });
}
