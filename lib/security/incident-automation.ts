import { prisma } from "@/lib/prisma";
import { getSecurityIncidentTimingState } from "@/lib/security/incident-shared";
import { sendSecurityIncidentReminder } from "@/lib/security/incidents";

export const SECURITY_INCIDENT_AUTOMATION_ENTITY = "SecurityIncidentAutomation";

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSecurityIncidentAutomationConfig() {
  const secretSource = process.env.SECURITY_AUTOMATION_SECRET
    ? "SECURITY_AUTOMATION_SECRET"
    : process.env.CRON_SECRET
      ? "CRON_SECRET"
      : null;

  return {
    secretConfigured: Boolean(getSecurityIncidentAutomationSecret()),
    secretSource,
    reminderCooldownHours: parsePositiveInt(
      process.env.SECURITY_INCIDENT_REMINDER_COOLDOWN_HOURS,
      6
    ),
    endpointPath: "/api/admin/security-incidents/run",
  };
}

function getSecurityIncidentAutomationSecret() {
  return (
    process.env.SECURITY_AUTOMATION_SECRET ??
    process.env.CRON_SECRET ??
    null
  );
}

export function isSecurityAutomationSecretValid(authHeader: string | null) {
  const secret = getSecurityIncidentAutomationSecret();
  if (!secret || !authHeader) {
    return false;
  }

  return authHeader === `Bearer ${secret}`;
}

export async function getSecurityIncidentAutomationOverview() {
  const config = getSecurityIncidentAutomationConfig();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [lastRun, runs7d, automatedReminders7d] = await Promise.all([
    prisma.auditLog.findFirst({
      where: {
        entity: SECURITY_INCIDENT_AUTOMATION_ENTITY,
        action: "AUTOMATION_RUN",
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({
      where: {
        entity: SECURITY_INCIDENT_AUTOMATION_ENTITY,
        action: "AUTOMATION_RUN",
        createdAt: {
          gte: since,
        },
      },
    }),
    prisma.auditLog.count({
      where: {
        entity: "SecurityIncident",
        action: {
          in: ["AUTO_REMINDER_DUE_SOON", "AUTO_REMINDER_OVERDUE"],
        },
        createdAt: {
          gte: since,
        },
      },
    }),
  ]);

  return {
    config,
    activity: {
      lastRunAt: lastRun?.createdAt ?? null,
      runs7d,
      automatedReminders7d,
    },
  };
}

export async function processSecurityIncidentAutomation(options?: {
  actorUserId?: string | null;
  trigger?: "manual" | "job";
}) {
  const config = getSecurityIncidentAutomationConfig();
  const incidents = await prisma.securityIncident.findMany({
    where: {
      status: {
        not: "RESOLVED",
      },
    },
    include: {
      openedBy: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  const now = new Date();
  const cooldownBoundary = new Date(
    now.getTime() - config.reminderCooldownHours * 60 * 60 * 1000
  );
  const summary = {
    scanned: incidents.length,
    dueSoonReminders: 0,
    overdueReminders: 0,
    skippedCooldown: 0,
    skippedOnTrack: 0,
    reminders: [] as Array<{
      incidentId: string;
      title: string;
      state: "DUE_SOON" | "OVERDUE";
    }>,
  };

  for (const incident of incidents) {
    const timingState = getSecurityIncidentTimingState(incident, now);
    if (timingState !== "DUE_SOON" && timingState !== "OVERDUE") {
      summary.skippedOnTrack += 1;
      continue;
    }

    if (
      incident.lastReminderAt &&
      incident.lastReminderAt.getTime() >= cooldownBoundary.getTime()
    ) {
      summary.skippedCooldown += 1;
      continue;
    }

    await sendSecurityIncidentReminder(incident.id, options?.actorUserId ?? null, {
      automated: true,
      reason: timingState === "OVERDUE" ? "overdue" : "due_soon",
    });

    if (timingState === "OVERDUE") {
      summary.overdueReminders += 1;
    } else {
      summary.dueSoonReminders += 1;
    }

    summary.reminders.push({
      incidentId: incident.id,
      title: incident.title,
      state: timingState,
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: options?.actorUserId ?? null,
      action: "AUTOMATION_RUN",
      entity: SECURITY_INCIDENT_AUTOMATION_ENTITY,
      newValue: JSON.stringify({
        trigger: options?.trigger ?? "manual",
        reminderCooldownHours: config.reminderCooldownHours,
        ...summary,
      }),
    },
  });

  return {
    trigger: options?.trigger ?? "manual",
    reminderCooldownHours: config.reminderCooldownHours,
    ...summary,
  };
}
