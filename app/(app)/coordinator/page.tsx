"use client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskBadge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageIntro } from "@/components/layout/PageIntro";
import { SkeletonTable } from "@/components/ui/skeleton";
import { formatDate, calculateAge } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  RefreshCw, AlertTriangle, CheckCircle2,
  Clock, Filter, LayoutGrid, List, Calendar
} from "lucide-react";

type ReferralStatus = "PENDING" | "APPROVED" | "AWAITING_APPOINTMENT" | "COMPLETE" | "REJECTED" | "ESCALATED";

interface Referral {
  id: string;
  type: string;
  priority: string;
  status: ReferralStatus;
  reason: string;
  createdAt: string;
  targetDays: number;
  appointmentDate?: string;
  screeningSession: {
    currentRiskLevel: string;
    recommendation: string;
    patient: {
      id: string;
      nhi: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      gpPractice: { name: string } | null;
    };
  };
}

type ViewMode = "table" | "kanban";

const PRIORITY_ORDER = ["P1", "P2", "P3", "P4"];

const KANBAN_COLUMNS: { key: ReferralStatus; label: string; accent: string }[] = [
  { key: "PENDING",              label: "Pending Review",       accent: "border-t-warn" },
  { key: "APPROVED",             label: "Approved",             accent: "border-t-info" },
  { key: "AWAITING_APPOINTMENT", label: "Awaiting Appointment", accent: "border-t-brand-500" },
  { key: "COMPLETE",             label: "Complete",             accent: "border-t-success" },
];

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function daysOverdue(r: Referral): number {
  return Math.max(0, daysSince(r.createdAt) - (r.targetDays ?? 999));
}

function TargetChip({ r }: { r: Referral }) {
  const days = daysSince(r.createdAt);
  const overdue = daysOverdue(r);
  const target = r.targetDays;
  const daysLeft = target - days;

  if (overdue > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-3 w-3" />
        {overdue}d overdue
      </span>
    );
  }
  if (daysLeft <= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-warn/10 text-warn">
        <Clock className="h-3 w-3" />
        {daysLeft}d left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
      <Clock className="h-3 w-3" />
      {daysLeft}d left
    </span>
  );
}

export default function CoordinatorPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("table");
  const [updating, setUpdating] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    loadReferrals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorityFilter, statusFilter]);

  async function loadReferrals() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (priorityFilter) params.append("priority", priorityFilter);
      if (statusFilter) params.append("status", statusFilter);
      const res = await fetch(`/api/referrals?${params}`);
      const data = await res.json();
      setReferrals(data.referrals ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(referralId: string, status: ReferralStatus) {
    setUpdating(referralId);
    try {
      await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: referralId, status }),
      });
      setReferrals((prev) =>
        prev.map((r) => (r.id === referralId ? { ...r, status } : r))
      );
    } finally {
      setUpdating(null);
    }
  }

  async function sendRecall(patientId: string) {
    await fetch("/api/notifications/send-recall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId }),
    });
  }

  const byStatus = (status: ReferralStatus) => referrals.filter((r) => r.status === status);

  // Sort referrals by priority then date
  const sortedReferrals = [...referrals].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const urgentCount = referrals.filter(r => r.priority === "P1" && r.status === "PENDING").length;
  const overdueCount = referrals.filter(r => daysOverdue(r) > 0).length;

  const alertBadge = (urgentCount > 0 || overdueCount > 0) ? (
    <div className="flex items-center gap-2">
      {urgentCount > 0 && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {urgentCount} P1 urgent
        </span>
      )}
      {overdueCount > 0 && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-warn/10 text-warn">
          <Clock className="h-3.5 w-3.5" />
          {overdueCount} overdue
        </span>
      )}
    </div>
  ) : null;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageIntro
        eyebrow="Coordinator Portal — NZ Cervical Screening"
        title="Referral Queue"
        description="Review, approve and track referrals across priority and status."
        trailing={alertBadge}
      />

      {/* Controls bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Priority filter */}
        <div className="flex items-center gap-1.5 border border-border bg-card rounded-lg px-3 h-9">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-sm text-muted-foreground bg-transparent border-none focus:outline-none"
            aria-label="Filter by priority"
          >
            <option value="">All Priorities</option>
            <option value="P1">P1 Urgent</option>
            <option value="P2">P2 High</option>
            <option value="P3">P3 Standard</option>
            <option value="P4">P4 Routine</option>
          </select>
        </div>
        {/* Status filter */}
        <div className="flex items-center gap-1.5 border border-border bg-card rounded-lg px-3 h-9">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm text-muted-foreground bg-transparent border-none focus:outline-none"
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="AWAITING_APPOINTMENT">Awaiting Appt</option>
            <option value="COMPLETE">Complete</option>
          </select>
        </div>
        {/* View toggle */}
        <div className="flex border border-border rounded-lg overflow-hidden bg-card">
          <button
            onClick={() => setView("table")}
            className={cn(
              "px-3 h-9 flex items-center gap-1.5 text-sm font-medium transition-colors",
              view === "table" ? "bg-brand-600 text-white" : "text-muted-foreground hover:bg-muted/40"
            )}
            aria-pressed={view === "table"}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
          <button
            onClick={() => setView("kanban")}
            className={cn(
              "px-3 h-9 flex items-center gap-1.5 text-sm font-medium transition-colors",
              view === "kanban" ? "bg-brand-600 text-white" : "text-muted-foreground hover:bg-muted/40"
            )}
            aria-pressed={view === "kanban"}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Kanban
          </button>
        </div>
        <Button onClick={loadReferrals} variant="outline" size="md" icon={<RefreshCw className="h-4 w-4" />}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : referrals.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No referrals found"
          description="All referrals matching the current filters have been processed."
        />
      ) : view === "table" ? (
        /* ── Table View ── */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="grid" aria-label="Referral queue">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {["Patient", "Priority", "Status", "Type", "Risk", "Referred", "Target", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedReferrals.map((r) => {
                  const patient = r.screeningSession.patient;
                  const overdue = daysOverdue(r);
                  const isHighPriority = (r.priority === "P1" || r.priority === "P2") && r.status === "PENDING";
                  return (
                    <tr
                      key={r.id}
                      className={cn(
                        "hover:bg-muted/40 transition-colors",
                        overdue > 0 ? "bg-destructive/5/50" : isHighPriority ? "bg-warn/5/30" : ""
                      )}
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-foreground">{patient.firstName} {patient.lastName}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {patient.nhi} · {calculateAge(patient.dateOfBirth)}y
                        </p>
                        {patient.gpPractice && (
                          <p className="text-xs text-muted-foreground mt-0.5">{patient.gpPractice.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5"><PriorityBadge priority={r.priority} /></td>
                      <td className="px-4 py-3.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.type}</td>
                      <td className="px-4 py-3.5"><RiskBadge risk={r.screeningSession.currentRiskLevel} /></td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <TargetChip r={r} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1.5">
                          {r.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => updateStatus(r.id, "APPROVED")}
                                disabled={updating === r.id}
                                className="text-xs px-2 py-1 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateStatus(r.id, "REJECTED")}
                                disabled={updating === r.id}
                                className="text-xs px-2 py-1 bg-destructive text-white rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === "APPROVED" && (
                            <button
                              onClick={() => updateStatus(r.id, "AWAITING_APPOINTMENT")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-info text-white rounded-md hover:bg-info/90 disabled:opacity-50 transition-colors"
                            >
                              Book
                            </button>
                          )}
                          {r.status === "AWAITING_APPOINTMENT" && (
                            <button
                              onClick={() => updateStatus(r.id, "COMPLETE")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-success text-white rounded-md hover:bg-success/90 disabled:opacity-50 transition-colors"
                            >
                              Complete
                            </button>
                          )}
                          <button
                            onClick={() => sendRecall(patient.id)}
                            className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-md hover:bg-muted/60 transition-colors"
                          >
                            Recall
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* ── Kanban Board ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map((col) => {
            const items = byStatus(col.key).sort((a, b) => {
              const pa = PRIORITY_ORDER.indexOf(a.priority);
              const pb = PRIORITY_ORDER.indexOf(b.priority);
              return pa - pb;
            });
            return (
              <div key={col.key} className={cn("rounded-xl border-t-4 bg-card border border-border flex flex-col shadow-sm", col.accent)}>
                <div className="px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
                    {col.label}
                    <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                      {items.length}
                    </span>
                  </h2>
                </div>
                <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No referrals</p>
                  )}
                  {items.map((r) => {
                    const overdue = daysOverdue(r);
                    const patient = r.screeningSession.patient;
                    return (
                      <div
                        key={r.id}
                        className={cn(
                          "bg-card rounded-lg border shadow-sm p-3 space-y-2.5 transition-all",
                          overdue > 0 ? "border-destructive/30" : "border-border"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">{patient.nhi}</p>
                          </div>
                          <PriorityBadge priority={r.priority} />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <RiskBadge risk={r.screeningSession.currentRiskLevel} />
                          <TargetChip r={r} />
                        </div>
                        {r.reason && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{r.reason}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(r.createdAt)}
                          {patient.gpPractice && ` · ${patient.gpPractice.name}`}
                        </p>
                        {/* Actions */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {r.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => updateStatus(r.id, "APPROVED")}
                                disabled={updating === r.id}
                                className="text-xs px-2 py-1 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateStatus(r.id, "REJECTED")}
                                disabled={updating === r.id}
                                className="text-xs px-2 py-1 bg-destructive text-white rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === "APPROVED" && (
                            <button
                              onClick={() => updateStatus(r.id, "AWAITING_APPOINTMENT")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-info text-white rounded-md hover:bg-info/90 transition-colors disabled:opacity-50"
                            >
                              <Calendar className="h-3 w-3 inline mr-1" />
                              Book Appt
                            </button>
                          )}
                          {r.status === "AWAITING_APPOINTMENT" && (
                            <button
                              onClick={() => updateStatus(r.id, "COMPLETE")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-success text-white rounded-md hover:bg-success/90 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3 w-3 inline mr-1" />
                              Complete
                            </button>
                          )}
                          <button
                            onClick={() => sendRecall(patient.id)}
                            className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-md hover:bg-muted/60 transition-colors"
                          >
                            Send Recall
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
