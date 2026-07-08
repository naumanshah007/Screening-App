"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SlideOver } from "@/components/ui/slide-over";
import { ManagerShell } from "@/components/admin/ManagerShell";
import { useConfirm } from "@/lib/hooks/useConfirm";
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
  if (!incident.auditFilterJson) return null;
  try {
    const filters = JSON.parse(incident.auditFilterJson) as Record<string, string>;
    return `/audit?${new URLSearchParams(filters).toString()}`;
  } catch {
    return null;
  }
}

function formatDateTimeLocalValue(value?: Date | null) {
  if (!value) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}T${p(value.getHours())}:${p(value.getMinutes())}`;
}

const URGENCY_ORDER: Record<string, number> = { OVERDUE: 0, DUE_SOON: 1, ON_TRACK: 2, RESOLVED: 3 };

function timingKey(incident: SecurityIncidentRecord) {
  return getSecurityIncidentTimingState({ status: incident.status, dueAt: incident.dueAt });
}

// ── Compact list row ────────────────────────────────────────────────────────
function IncidentListRow({
  incident,
  onManage,
}: {
  incident: SecurityIncidentRecord;
  onManage: () => void;
}) {
  const timingState = timingKey(incident);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{incident.title}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={securityIncidentSeverityVariant(incident.severity)}>{incident.severity}</Badge>
          <Badge variant={securityIncidentStatusVariant(incident.status)}>
            {securityIncidentStatusLabel(incident.status)}
          </Badge>
          <Badge variant={securityIncidentTimingVariant(timingState)}>
            {securityIncidentTimingLabel({ status: incident.status, dueAt: incident.dueAt })}
          </Badge>
          {incident.assignedTo && (
            <span className="text-xs text-muted-foreground">
              · {incident.assignedTo.name ?? incident.assignedTo.email}
            </span>
          )}
        </div>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onManage} className="flex-shrink-0">
        Manage
      </Button>
    </div>
  );
}

// ── Slide-over editor ───────────────────────────────────────────────────────
function IncidentEditor({
  incident,
  assignees,
  confirm,
}: {
  incident: SecurityIncidentRecord;
  assignees: SecurityIncidentAssignee[];
  confirm: (o: { title?: string; description: string; confirmLabel?: string; variant?: "danger" | "primary" }) => Promise<boolean>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SecurityIncidentStatus>(incident.status);
  const [assignedToUserId, setAssignedToUserId] = useState(incident.assignedToUserId ?? "");
  const [dueAt, setDueAt] = useState(formatDateTimeLocalValue(incident.dueAt));
  const [resolutionNotes, setResolutionNotes] = useState(incident.resolutionNotes ?? "");
  const [loading, setLoading] = useState(false);
  const auditHref = incidentAuditHref(incident);

  async function saveIncident() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/security-incidents/${incident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          assignedToUserId: assignedToUserId || null,
          dueAt: dueAt || null,
          resolutionNotes: resolutionNotes.trim() || null,
        }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to update incident");
      toast.success(payload.message ?? "Incident updated.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to update incident");
    } finally {
      setLoading(false);
    }
  }

  async function sendReminder() {
    const ok = await confirm({
      title: "Send reminder?",
      description: "Send a reminder notification to the incident owner now?",
      confirmLabel: "Send reminder",
      variant: "primary",
    });
    if (!ok) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/security-incidents/${incident.id}/remind`, { method: "POST" });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to send reminder");
      toast.success(payload.message ?? "Reminder sent.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to send reminder");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{incident.summary}</p>

      <div className="flex flex-wrap gap-2 text-xs">
        {incident.sourcePreset && <Badge variant="info">Preset: {incident.sourcePreset}</Badge>}
        {incident.sourceEntity && <Badge variant="default">Entity: {incident.sourceEntity}</Badge>}
        {incident.sourceAction && <Badge variant="default">Action: {incident.sourceAction}</Badge>}
        <Badge variant="default">Opened {incident.createdAt.toLocaleDateString("en-NZ")}</Badge>
        {incident.lastReminderAt && (
          <Badge variant="default">Reminder {incident.lastReminderAt.toLocaleDateString("en-NZ")}</Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as SecurityIncidentStatus)}
          options={INCIDENT_STATUS_OPTIONS}
        />
        <Select
          label="Owner"
          value={assignedToUserId}
          onChange={(e) => setAssignedToUserId(e.target.value)}
          placeholder="Unassigned"
          options={assignees.map((a) => ({ value: a.id, label: `${a.name ?? a.email} (${a.role})` }))}
        />
      </div>

      <Input
        label="Response due"
        type="datetime-local"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
      />

      <Textarea
        label="Resolution or review notes"
        rows={4}
        value={resolutionNotes}
        onChange={(e) => setResolutionNotes(e.target.value)}
        placeholder="Capture triage notes, ownership, or resolution details."
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="button" size="sm" loading={loading} onClick={saveIncident}>
          Save incident
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || incident.status === "RESOLVED"}
          onClick={sendReminder}
        >
          Send reminder
        </Button>
        {auditHref && (
          <a
            href={auditHref}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open audit scope
          </a>
        )}
      </div>
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
  const { confirm, ConfirmComponent } = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = incidents.find((i) => i.id === selectedId) ?? null;

  const sorted = [...incidents].sort(
    (a, b) => (URGENCY_ORDER[timingKey(a)] ?? 9) - (URGENCY_ORDER[timingKey(b)] ?? 9)
  );

  function matchesFilter(incident: SecurityIncidentRecord, id: string) {
    const timing = timingKey(incident);
    switch (id) {
      case "open":
        return incident.status !== "RESOLVED";
      case "overdue":
        return timing === "OVERDUE";
      case "due-soon":
        return timing === "DUE_SOON";
      case "unassigned":
        return !incident.assignedToUserId && incident.status !== "RESOLVED";
      case "resolved":
        return incident.status === "RESOLVED";
      default:
        return true;
    }
  }

  return (
    <>
      <ManagerShell
        items={sorted}
        getKey={(i) => i.id}
        searchText={(i) => `${i.title} ${i.summary} ${i.severity}`}
        searchPlaceholder="Search incidents by title"
        filters={[
          { id: "open", label: "Open" },
          { id: "overdue", label: "Overdue" },
          { id: "due-soon", label: "Due soon" },
          { id: "unassigned", label: "Unassigned" },
          { id: "resolved", label: "Resolved" },
        ]}
        matchesFilter={matchesFilter}
        emptyIcon={ShieldAlert}
        emptyTitle="No incidents match"
        emptyDescription="Try a different search or filter."
        renderRow={(i) => <IncidentListRow incident={i} onManage={() => setSelectedId(i.id)} />}
      />

      <SlideOver
        open={selected != null}
        onClose={() => setSelectedId(null)}
        title={selected?.title ?? "Incident"}
        subtitle={selected ? `${selected.severity} · opened ${selected.createdAt.toLocaleDateString("en-NZ")}` : undefined}
        width="lg"
      >
        {selected && <IncidentEditor key={selected.id} incident={selected} assignees={assignees} confirm={confirm} />}
      </SlideOver>

      {ConfirmComponent}
    </>
  );
}
