/**
 * POST /api/pathway/sessions
 * Start a new wizard session for a patient.
 * Runs auto-fill from existing patient data and creates the WizardSession.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autofillFromPatient } from "@/lib/wizard/autofill";
import { getVisibleSteps, getNextUnansweredStep, WIZARD_STEPS } from "@/lib/wizard/steps";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: { patientId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.patientId) {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  }

  const patient = await prisma.patient.findUnique({
    where: { id: body.patientId },
    select: { id: true, firstName: true, lastName: true, nhi: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  // Run auto-fill from existing records
  const autofill = await autofillFromPatient(body.patientId);

  // Build answers map for step computation
  const answersMap: Record<string, string> = {};
  autofill.answers.forEach((a) => { answersMap[a.stepId] = a.answerValue; });

  // Create wizard session
  const wizardSession = await prisma.wizardSession.create({
    data: {
      patientId: body.patientId,
      createdById: session.user.id,
      status: "IN_PROGRESS",
      determinedFigure: autofill.detectedFigure as any ?? undefined,
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
