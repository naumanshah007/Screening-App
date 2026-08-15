/**
 * Notification Service
 *
 * Sends email notifications to patients, GPs, coordinators, and security reviewers.
 *
 * In development (no SMTP configured): logs to console + creates AuditLog entry.
 * In production: uses Nodemailer with SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM.
 */

import nodemailer from "nodemailer";

import { prisma } from "@/lib/prisma";
import { evaluateRuntimeBoundary } from "@/lib/config/runtime-boundary";
import { buildProtectedAuditEntry } from "@/lib/security/audit";
import { safeLogError, writeSafeLog } from "@/lib/security/safe-logging";

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

export type SecurityIncidentNotificationParams = {
  recipientEmail: string;
  recipientName?: string | null;
  incidentTitle: string;
  incidentSummary: string;
  severity: string;
  status: string;
  dueAt?: Date | null;
  reminderKind: "manual" | "due_soon" | "overdue";
  referenceId: string;
};

export type NotificationResult = {
  channel: "patient" | "gp" | "coordinator";
  email: string;
  status: "sent" | "logged" | "failed";
  message?: string;
};

export type NotificationRuntimeSummary = {
  configured: boolean;
  mode: "smtp" | "development";
  summary: string;
  detail: string;
};

// ─── Delivery helpers ──────────────────────────────────────────────────────────

function devLog(channel: string, referenceId: string) {
  writeSafeLog("info", "notification.development_delivery_suppressed", {
    channel,
    referenceId,
  });
}

async function logNotificationAudit(
  channel: string,
  _to: string,
  _subject: string,
  referenceId: string,
  entity = "WizardSession",
  actorUserId?: string | null
) {
  try {
    await prisma.auditLog.create({
      data: buildProtectedAuditEntry({
        userId: actorUserId ?? null,
        action: "NOTIFICATION_SENT",
        entity,
        entityId: referenceId,
        newValue: { channel, deliveryAttempted: true },
      }),
    });
  } catch (error) {
    safeLogError("notification.audit.write_failed", error, { channel, entity });
  }
}

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}

export function getNotificationRuntimeSummary(): NotificationRuntimeSummary {
  if (!hasSmtpConfig()) {
    const pilot = evaluateRuntimeBoundary().mode === "PILOT";
    return {
      configured: false,
      mode: "development",
      summary: pilot
        ? "Notifications are blocked: SMTP is not configured for pilot mode."
        : "Notifications are running in development suppression mode.",
      detail:
        pilot
          ? "Pilot mode never writes message recipients or content to logs as a delivery fallback."
          : "SMTP settings are not configured. Message content and recipient identity are suppressed; only metadata-only evidence is recorded.",
    };
  }

  return {
    configured: true,
    mode: "smtp",
    summary: "Notifications are configured for SMTP delivery.",
    detail:
      "Email delivery is ready to use with the configured SMTP server.",
  };
}

async function deliverEmail({
  channel,
  to,
  subject,
  body,
  referenceId,
  entity = "WizardSession",
  actorUserId,
}: {
  channel: NotificationResult["channel"];
  to: string;
  subject: string;
  body: string;
  referenceId: string;
  entity?: string;
  actorUserId?: string | null;
}): Promise<NotificationResult> {
  if (!hasSmtpConfig()) {
    if (evaluateRuntimeBoundary().mode === "PILOT") {
      throw new Error("Notification delivery is unavailable in pilot mode until SMTP is configured.");
    }
    devLog(channel, referenceId);
    await logNotificationAudit(channel, to, subject, referenceId, entity, actorUserId);
    return { channel, email: to, status: "logged" };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text: body,
  });

  await logNotificationAudit(channel, to, subject, referenceId, entity, actorUserId);
  return { channel, email: to, status: "sent" };
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
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
  };
  return map[r] ?? r;
}

// ─── Patient Notification ──────────────────────────────────────────────────────

export async function sendPatientNotification(
  params: PatientNotificationParams
): Promise<NotificationResult> {
  const {
    patientEmail,
    patientName,
    recommendation,
    nextAppointmentGuidance,
    practicePhone,
    practiceName,
    referenceId,
  } = params;

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

  return deliverEmail({
    channel: "patient",
    to: patientEmail,
    subject,
    body,
    referenceId,
  });
}

// ─── GP Notification ──────────────────────────────────────────────────────────

export async function sendGPNotification(
  params: GPNotificationParams
): Promise<NotificationResult> {
  const {
    gpEmail,
    patientName,
    nhi,
    decisionCode,
    recommendation,
    figure,
    riskLevel,
    referralPriority,
    referralType,
    recallMonths,
    guidelineReference,
    referenceId,
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

  return deliverEmail({
    channel: "gp",
    to: gpEmail,
    subject,
    body,
    referenceId,
  });
}

// ─── Coordinator Notification ─────────────────────────────────────────────────

export async function sendCoordinatorNotification(
  params: CoordinatorNotificationParams
): Promise<NotificationResult> {
  const {
    coordinatorEmail,
    patientName,
    nhi,
    referralType,
    referralPriority,
    targetDays,
    targetDate,
    referenceId,
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

  return deliverEmail({
    channel: "coordinator",
    to: coordinatorEmail,
    subject,
    body,
    referenceId,
  });
}

// ─── Security Incident Notification ───────────────────────────────────────────

export async function sendSecurityIncidentNotification(
  params: SecurityIncidentNotificationParams
): Promise<NotificationResult> {
  const {
    recipientEmail,
    recipientName,
    incidentTitle,
    incidentSummary,
    severity,
    status,
    dueAt,
    reminderKind,
    referenceId,
  } = params;

  const subject =
    reminderKind === "overdue"
      ? `Security Incident Overdue — ${incidentTitle}`
      : reminderKind === "due_soon"
        ? `Security Incident Due Soon — ${incidentTitle}`
        : `Security Incident Reminder — ${incidentTitle}`;

  const body = `
Hello ${recipientName ?? "team"},

This is a security incident ${reminderKind === "overdue" ? "escalation" : "reminder"} from the Women’s Health platform.

INCIDENT
  Title:    ${incidentTitle}
  Severity: ${severity}
  Status:   ${status}
  Due:      ${dueAt ? dueAt.toLocaleString("en-NZ") : "No due date set"}

SUMMARY
${incidentSummary}

Reference: ${referenceId}

Please review the security incident queue in the admin workspace and update ownership, status, or resolution notes as needed.
`.trim();

  return deliverEmail({
    channel: "coordinator",
    to: recipientEmail,
    subject,
    body,
    referenceId,
    entity: "SecurityIncident",
  });
}
