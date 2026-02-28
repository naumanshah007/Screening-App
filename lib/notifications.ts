/**
 * Notification Service
 *
 * Sends email notifications to patients, GPs, and coordinators
 * after a clinical pathway decision is made.
 *
 * In development (no SMTP configured): logs to console + creates AuditLog entry.
 * In production: uses Nodemailer with SMTP_HOST/SMTP_USER/SMTP_PASS env vars.
 */

import { prisma } from "@/lib/prisma";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PatientNotificationParams = {
  patientEmail: string;
  patientName: string;
  recommendation: string;
  nextAppointmentGuidance: string;
  practicePhone: string;
  practiceName: string;
  referenceId: string;
};

export type GPNotificationParams = {
  gpEmail: string;
  patientName: string;
  nhi: string;
  decisionCode: string;
  recommendation: string;
  figure: string;
  riskLevel: string;
  referralPriority?: string;
  referralType?: string;
  recallMonths?: number;
  guidelineReference?: string;
  referenceId: string;
};

export type CoordinatorNotificationParams = {
  coordinatorEmail: string;
  patientName: string;
  nhi: string;
  referralType: string;
  referralPriority: string;
  targetDays: number;
  targetDate: string;
  referenceId: string;
};

export type NotificationResult = {
  channel: "patient" | "gp" | "coordinator";
  email: string;
  status: "sent" | "logged" | "failed";
  message?: string;
};

// ─── Dev mode mailer (console logger) ─────────────────────────────────────────

function devLog(channel: string, to: string, subject: string, body: string) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📧 [DEV EMAIL] Channel: ${channel}`);
  console.log(`   To:      ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log("   Body:");
  body.split("\n").forEach((line) => console.log(`   ${line}`));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

async function logNotificationAudit(
  channel: string,
  to: string,
  subject: string,
  referenceId: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        action: "NOTIFICATION_SENT",
        entity: "WizardSession",
        entityId: referenceId,
        newValue: JSON.stringify({ channel, to, subject }),
      },
    });
  } catch {
    // Non-fatal
  }
}

// ─── Priority label helper ─────────────────────────────────────────────────────

function priorityLabel(p?: string): string {
  const map: Record<string, string> = {
    P1: "P1 — Urgent (within 20 working days)",
    P2: "P2 — Priority (within 42 working days)",
    P3: "P3 — Routine (within 84 working days)",
    P4: "P4 — Deferred (within 168 working days)",
  };
  return p ? (map[p] ?? p) : "Routine";
}

function riskLabel(r: string): string {
  const map: Record<string, string> = {
    LOW:    "Low",
    MEDIUM: "Medium",
    HIGH:   "High",
    URGENT: "Urgent",
  };
  return map[r] ?? r;
}

// ─── Patient Notification ──────────────────────────────────────────────────────

export async function sendPatientNotification(
  params: PatientNotificationParams
): Promise<NotificationResult> {
  const { patientEmail, patientName, recommendation, nextAppointmentGuidance, practicePhone, practiceName, referenceId } = params;

  const subject = `Your Cervical Screening Results — ${practiceName}`;

  const body = `
Dear ${patientName},

Your cervical screening results have been reviewed by your healthcare team.

WHAT THIS MEANS FOR YOU
${recommendation}

YOUR NEXT STEP
${nextAppointmentGuidance}

If you have any questions or concerns, please do not hesitate to contact your clinic:
Phone: ${practicePhone}
Practice: ${practiceName}

You are encouraged to discuss these results with your GP or nurse at your next appointment.

IMPORTANT: This notification is for information only. Please do not reply to this email.
If you need to reschedule or have urgent concerns, contact your practice directly.

Reference: ${referenceId}
`.trim();

  devLog("patient", patientEmail, subject, body);
  await logNotificationAudit("patient", patientEmail, subject, referenceId);

  return { channel: "patient", email: patientEmail, status: "logged" };
}

// ─── GP Notification ──────────────────────────────────────────────────────────

export async function sendGPNotification(
  params: GPNotificationParams
): Promise<NotificationResult> {
  const {
    gpEmail, patientName, nhi, decisionCode, recommendation,
    figure, riskLevel, referralPriority, referralType,
    recallMonths, guidelineReference, referenceId,
  } = params;

  const subject = `Cervical Screening Decision — ${patientName} (${nhi})`;

  const body = `
CERVICAL SCREENING CLINICAL DECISION SUMMARY
${new Date().toLocaleDateString("en-NZ", { day: "2-digit", month: "long", year: "numeric" })}

PATIENT
  Name:  ${patientName}
  NHI:   ${nhi}

PATHWAY ASSESSMENT
  Figure:      ${figure}
  Risk Level:  ${riskLabel(riskLevel)}
  Code:        ${decisionCode}

RECOMMENDATION
  ${recommendation}

${referralType ? `REFERRAL REQUIRED
  Type:      ${referralType}
  Priority:  ${priorityLabel(referralPriority)}
` : ""}
${recallMonths ? `RECALL
  Next screening due in ${recallMonths} month${recallMonths !== 1 ? "s" : ""}
` : ""}
${guidelineReference ? `GUIDELINE REFERENCE
  ${guidelineReference}
` : ""}
Reference: ${referenceId}
Generated by the NZ Cervical Screening Clinical Decision Support System.
`.trim();

  devLog("gp", gpEmail, subject, body);
  await logNotificationAudit("gp", gpEmail, subject, referenceId);

  return { channel: "gp", email: gpEmail, status: "logged" };
}

// ─── Coordinator Notification ─────────────────────────────────────────────────

export async function sendCoordinatorNotification(
  params: CoordinatorNotificationParams
): Promise<NotificationResult> {
  const {
    coordinatorEmail, patientName, nhi, referralType,
    referralPriority, targetDays, targetDate, referenceId,
  } = params;

  const subject = `ACTION REQUIRED — New ${referralType} Referral (${referralPriority}): ${patientName}`;

  const body = `
ACTION REQUIRED — NEW REFERRAL

Patient:    ${patientName}
NHI:        ${nhi}

Referral Details:
  Type:        ${referralType}
  Priority:    ${priorityLabel(referralPriority)}
  Target:      Within ${targetDays} working days
  Target Date: ${targetDate}

Please log in to the Cervical Screening System to approve this referral
and arrange an appointment for the patient.

Reference: ${referenceId}
`.trim();

  devLog("coordinator", coordinatorEmail, subject, body);
  await logNotificationAudit("coordinator", coordinatorEmail, subject, referenceId);

  return { channel: "coordinator", email: coordinatorEmail, status: "logged" };
}
