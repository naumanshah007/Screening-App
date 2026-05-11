"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  SECURITY_INCIDENT_STATUSES,
  getSecurityIncidentTimingState,
  securityIncidentSeverityVariant,
  securityIncidentStatusLabel,
  securityIncidentStatusVariant,
  securityIncidentTimingLabel,
  securityIncidentTimingVariant,
} from "@/lib/security/incident-shared";
import type {
  SecurityIncidentAssignee,
  SecurityIncidentRecord,
} from "@/lib/security/incidents";
import type { SecurityIncidentStatus } from "@prisma/client";

const INCIDENT_STATUS_OPTIONS = SECURITY_INCIDENT_STATUSES.map((status) => ({
  value: status,
  label: securityIncidentStatusLabel(status),
}));

function incidentAuditHref(incident: SecurityIncidentRecord) {
  if (!incident.auditFilterJson) {
    return null;
  }

  try {
    const filters = JSON.parse(incident.auditFilterJson) as Record<string, string>;
    return `/audit?${new URLSearchParams(filters).toString()}`;
  } catch {
    return null;
  }
}

function formatDateTimeLocalValue(value?: Date | null) {
  if (!value) {
    return "";
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocalValue(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function IncidentRow({
  incident,
  assignees,
}: {
  incident: SecurityIncidentRecord;
  assignees: SecurityIncidentAssignee[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SecurityIncidentStatus>(incident.status);
  const [assignedToUserId, setAssignedToUserId] = useState(
    incident.assignedToUserId ?? ""
  );
  const [dueAt, setDueAt] = useState(formatDateTimeLocalValue(incident.dueAt));
  const [resolutionNotes, setResolutionNotes] = useState(
    incident.resolutionNotes ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const auditHref = incidentAuditHref(incident);
  const timingIncident = {
    status,
    dueAt: parseDateTimeLocalValue(dueAt),
  };
  const timingState = getSecurityIncidentTimingState({
    status: timingIncident.status,
    dueAt: timingIncident.dueAt,
  });

  async function saveIncident() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/security-incidents/${incident.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          assignedToUserId: assignedToUserId || null,
          dueAt: dueAt || null,
          resolutionNotes: resolutionNotes.trim() || null,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update incident");
      }

      setMessage(payload.message ?? "Incident updated.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to update incident"
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendReminder() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/security-incidents/${incident.id}/remind`,
        {
          method: "POST",
        }
      );

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send reminder");
      }

      setMessage(payload.message ?? "Reminder sent.");
      router.refresh();
    } catch (reminderError) {
      setError(
        reminderError instanceof Error
          ? reminderError.message
          : "Unable to send reminder"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{incident.title}</p>
            <Badge variant={securityIncidentSeverityVariant(incident.severity)}>
              {incident.severity}
            </Badge>
            <Badge variant={securityIncidentStatusVariant(incident.status)}>
              {securityIncidentStatusLabel(incident.status)}
            </Badge>
            <Badge variant={securityIncidentTimingVariant(timingState)}>
              {securityIncidentTimingLabel(timingIncident)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{incident.summary}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Opened {incident.createdAt.toLocaleString("en-NZ")}</div>
          <div>
            By {incident.openedBy.name ?? incident.openedBy.email ?? "System"}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {incident.sourcePreset && <Badge variant="info">Preset: {incident.sourcePreset}</Badge>}
        {incident.sourceEntity && <Badge variant="default">Entity: {incident.sourceEntity}</Badge>}
        {incident.sourceAction && <Badge variant="default">Action: {incident.sourceAction}</Badge>}
        {incident.assignedTo && (
          <Badge variant="low">
            Owner: {incident.assignedTo.name ?? incident.assignedTo.email}
          </Badge>
        )}
        {incident.dueAt && (
          <Badge variant="default">
            Due {incident.dueAt.toLocaleString("en-NZ")}
          </Badge>
        )}
        {incident.lastReminderAt && (
          <Badge variant="default">
            Reminder {incident.lastReminderAt.toLocaleDateString("en-NZ")}
          </Badge>
        )}
        {incident.resolvedAt && (
          <Badge variant="low">
            Resolved {incident.resolvedAt.toLocaleDateString("en-NZ")}
          </Badge>
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,200px)_minmax(0,240px)_minmax(0,220px)_minmax(0,1fr)_auto] lg:items-end">
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as SecurityIncidentStatus)}
          options={INCIDENT_STATUS_OPTIONS}
        />
        <Select
          label="Owner"
          value={assignedToUserId}
          onChange={(event) => setAssignedToUserId(event.target.value)}
          placeholder="Unassigned"
          options={assignees.map((assignee) => ({
            value: assignee.id,
            label: `${assignee.name ?? assignee.email} (${assignee.role})`,
          }))}
        />
        <Input
          label="Response due"
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />
        <Textarea
          label="Resolution or review notes"
          rows={3}
          value={resolutionNotes}
          onChange={(event) => setResolutionNotes(event.target.value)}
          placeholder="Capture triage notes, ownership, or resolution details."
        />
        <div className="flex flex-col gap-2">
          <Button type="button" loading={loading} onClick={saveIncident}>
            Save incident
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading || incident.status === "RESOLVED"}
            onClick={sendReminder}
          >
            Send reminder
          </Button>
          {auditHref && (
            <a
              href={auditHref}
              className="text-xs font-medium text-muted-foreground underline underline-offset-2"
            >
              Open audit scope
            </a>
          )}
        </div>
      </div>

      {message && <div className="mt-3 text-xs text-success">{message}</div>}
      {error && <div className="mt-3 text-xs text-destructive">{error}</div>}
    </div>
  );
}

export function SecurityIncidentManager({
  incidents,
  assignees,
}: {
  incidents: SecurityIncidentRecord[];
  assignees: SecurityIncidentAssignee[];
}) {
  return (
    <div id="security-incidents" className="space-y-4">
      {incidents.map((incident) => (
        <IncidentRow
          key={incident.id}
          incident={incident}
          assignees={assignees}
        />
      ))}
    </div>
  );
}
