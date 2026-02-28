/**
 * POST /api/pathway/sessions/[id]/notify
 * Send notifications to patient, GP, and/or coordinator.
 * The wizard session must be COMPLETE before notifications can be sent.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sendPatientNotification,
  sendGPNotification,
  sendCoordinatorNotification,
  type NotificationResult,
} from "@/lib/notifications";
import { addDays, format } from "date-fns";

// Priority → target working days
const PRIORITY_DAYS: Record<string, number> = {
  P1: 20,
  P2: 42,
  P3: 84,
  P4: 168,
};

function nextAppointmentGuidance(decision: Record<string, unknown>): string {
  if (decision.referralRequired) {
    const priority = (decision.referralPriority as string) ?? "P3";
    const days = PRIORITY_DAYS[priority] ?? 84;
    return `You have been referred for ${decision.referralType ?? "specialist review"}. You should receive an appointment within ${days} working days. If you do not hear within this timeframe, please contact your clinic.`;
  }
  if (decision.recallRequired && decision.recallIntervalMonths) {
    return `Your next cervical screening is recommended in ${decision.recallIntervalMonths} month${Number(decision.recallIntervalMonths) !== 1 ? "s" : ""}. Your clinic will contact you when it is due.`;
  }
  return "Please follow up with your GP or clinic for further guidance.";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  let body: {
    notifyPatient?: boolean;
    notifyGP?: boolean;
    notifyCoordinator?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const wizardSession = await prisma.wizardSession.findUnique({
    where: { id },
    include: {
      patient: {
        include: {
          gpPractice: true,
        },
      },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!wizardSession) {
    return NextResponse.json({ error: "Wizard session not found" }, { status: 404 });
  }
  if (wizardSession.status !== "COMPLETE") {
    return NextResponse.json({ error: "Wizard session is not complete yet" }, { status: 409 });
  }
  if (!wizardSession.decisionJson) {
    return NextResponse.json({ error: "No decision found in wizard session" }, { status: 409 });
  }

  const decision = JSON.parse(wizardSession.decisionJson) as Record<string, unknown>;
  const patient = wizardSession.patient;
  const practice = patient.gpPractice;
  const results: NotificationResult[] = [];

  // ── Patient notification ──────────────────────────────────────────────────
  if (body.notifyPatient && patient.email) {
    const result = await sendPatientNotification({
      patientEmail: patient.email,
      patientName: `${patient.firstName} ${patient.lastName}`,
      recommendation: (decision.recommendation as string) ?? "Please follow up with your GP.",
      nextAppointmentGuidance: nextAppointmentGuidance(decision),
      practicePhone: "(09) 000-0000", // Would come from practice model in production
      practiceName: practice?.name ?? "Your Clinic",
      referenceId: id,
    });
    results.push(result);
  } else if (body.notifyPatient && !patient.email) {
    results.push({
      channel: "patient",
      email: "(no email on file)",
      status: "failed",
      message: "Patient has no email address on file",
    });
  }

  // ── GP notification ───────────────────────────────────────────────────────
  if (body.notifyGP) {
    // Find the GP user associated with the practice
    const gpUser = practice
      ? await prisma.user.findFirst({
          where: { gpPracticeId: practice.id, role: "GP" },
          select: { email: true, name: true },
        })
      : null;

    const gpEmail = gpUser?.email ?? wizardSession.createdBy.email;

    const result = await sendGPNotification({
      gpEmail,
      patientName: `${patient.firstName} ${patient.lastName}`,
      nhi: patient.nhi,
      decisionCode: (decision.recommendationCode as string) ?? "",
      recommendation: (decision.recommendation as string) ?? "",
      figure: (decision.figure as string) ?? "",
      riskLevel: (decision.riskLevel as string) ?? "",
      referralPriority: decision.referralPriority as string | undefined,
      referralType: decision.referralType as string | undefined,
      recallMonths: decision.recallIntervalMonths as number | undefined,
      guidelineReference: decision.guidelineReference as string | undefined,
      referenceId: id,
    });
    results.push(result);
  }

  // ── Coordinator notification ──────────────────────────────────────────────
  if (body.notifyCoordinator && decision.referralRequired) {
    const coordinator = await prisma.user.findFirst({
      where: { role: "COORDINATOR" },
      select: { email: true },
    });

    if (coordinator) {
      const priority = (decision.referralPriority as string) ?? "P3";
      const targetDays = PRIORITY_DAYS[priority] ?? 84;
      const targetDate = format(addDays(new Date(), targetDays), "dd MMMM yyyy");

      const result = await sendCoordinatorNotification({
        coordinatorEmail: coordinator.email,
        patientName: `${patient.firstName} ${patient.lastName}`,
        nhi: patient.nhi,
        referralType: (decision.referralType as string) ?? "COLPOSCOPY",
        referralPriority: priority,
        targetDays,
        targetDate,
        referenceId: id,
      });
      results.push(result);
    }
  }

  return NextResponse.json({
    sent: results.map((r) => r.channel),
    results,
  });
}
