import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/notifications/send-recall - Trigger recall letter generation
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { recallId, patientId } = body;

  if (!recallId && !patientId) {
    return NextResponse.json({ error: "recallId or patientId required" }, { status: 400 });
  }

  const recall = await prisma.recall.findFirst({
    where: recallId ? { id: recallId } : { patientId, status: "PENDING" },
    include: {
      patient: {
        select: {
          nhi: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          gpPractice: { select: { name: true, address: true } },
        },
      },
    },
  });

  if (!recall) {
    return NextResponse.json({ error: "Recall not found" }, { status: 404 });
  }

  // Mark as sent
  await prisma.recall.update({
    where: { id: recall.id },
    data: { status: "SENT", sentAt: new Date() },
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      userId: (session.user as { id?: string }).id,
      action: "SEND_RECALL",
      entity: "Recall",
      entityId: recall.id,
      newValue: JSON.stringify({ patientNhi: recall.patient.nhi }),
    },
  });

  // Generate recall letter content
  const letterContent = generateRecallLetter(recall);

  return NextResponse.json({
    success: true,
    recallId: recall.id,
    sentAt: new Date(),
    letterContent,
  });
}

function generateRecallLetter(recall: {
  dueDate: Date;
  reason: string | null;
  patient: {
    firstName: string;
    lastName: string;
    nhi: string;
    gpPractice: { name: string; address: string | null } | null;
  };
}): string {
  const patient = recall.patient;
  const practice = patient.gpPractice;
  const dueDate = new Date(recall.dueDate).toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return `
CERVICAL SCREENING RECALL NOTICE
${practice?.name ?? ""}
${practice?.address ?? ""}

Date: ${new Date().toLocaleDateString("en-NZ")}

Dear ${patient.firstName} ${patient.lastName} (NHI: ${patient.nhi}),

This letter is to remind you that your cervical screening is due.

Your next screening is recommended by: ${dueDate}

Reason: ${recall.reason ?? "Routine cervical screening recall"}

Please contact your GP practice to arrange an appointment at your earliest convenience.

This screening is an important part of your healthcare. The cervical screening programme helps detect any changes in cervical cells early, when they are most easily treated.

If you have any questions, please contact your GP practice directly.

Yours sincerely,

Cervical Screening Programme
NZ Cervical Screening Programme
`.trim();
}
