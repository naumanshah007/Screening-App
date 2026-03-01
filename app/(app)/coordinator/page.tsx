"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskBadge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, calculateAge } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  RefreshCw, ClipboardList, AlertTriangle, CheckCircle2,
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

const KANBAN_COLUMNS: { key: ReferralStatus; label: string; accent: string; bg: string }[] = [
  { key: "PENDING",              label: "Pending Review",       accent: "border-amber-400",   bg: "bg-amber-50" },
  { key: "APPROVED",             label: "Approved",             accent: "border-sky-400",     bg: "bg-sky-50" },
  { key: "AWAITING_APPOINTMENT", label: "Awaiting Appointment", accent: "border-violet-400",  bg: "bg-violet-50" },
  { key: "COMPLETE",             label: "Complete",             accent: "border-emerald-400", bg: "bg-emerald-50" },
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
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        <AlertTriangle className="h-3 w-3" />
        {overdue}d overdue
      </span>
    );
  }
  if (daysLeft <= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <Clock className="h-3 w-3" />
        {daysLeft}d left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
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

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Referral Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Coordinator Portal — NZ Cervical Screening Programme
            {urgentCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                {urgentCount} P1 urgent
              </span>
            )}
            {overdueCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="h-3.5 w-3.5" />
                {overdueCount} overdue
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority filter */}
          <div className="flex items-center gap-1.5 border border-slate-200 bg-white rounded-lg px-3 h-9">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-sm text-slate-700 bg-transparent border-none focus:outline-none"
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
          <div className="flex items-center gap-1.5 border border-slate-200 bg-white rounded-lg px-3 h-9">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm text-slate-700 bg-transparent border-none focus:outline-none"
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
          <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => setView("table")}
              className={cn(
                "px-3 h-9 flex items-center gap-1.5 text-sm font-medium transition-colors",
                view === "table" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"
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
                view === "kanban" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"
              )}
              aria-pressed={view === "kanban"}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </button>
          </div>
          <Button onClick={loadReferrals} variant="outline" size="md">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-brand-600 animate-spin" />
        </div>
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
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Patient", "Priority", "Status", "Type", "Risk", "Referred", "Target", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedReferrals.map((r) => {
                  const patient = r.screeningSession.patient;
                  const overdue = daysOverdue(r);
                  const isHighPriority = (r.priority === "P1" || r.priority === "P2") && r.status === "PENDING";
                  return (
                    <tr
                      key={r.id}
                      className={cn(
                        "hover:bg-slate-50/80 transition-colors",
                        overdue > 0 ? "bg-red-50/50" : isHighPriority ? "bg-amber-50/30" : ""
                      )}
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900">{patient.firstName} {patient.lastName}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {patient.nhi} · {calculateAge(patient.dateOfBirth)}y
                        </p>
                        {patient.gpPractice && (
                          <p className="text-xs text-slate-400 mt-0.5">{patient.gpPractice.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5"><PriorityBadge priority={r.priority} /></td>
                      <td className="px-4 py-3.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs">{r.type}</td>
                      <td className="px-4 py-3.5"><RiskBadge risk={r.screeningSession.currentRiskLevel} /></td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
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
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === "APPROVED" && (
                            <button
                              onClick={() => updateStatus(r.id, "AWAITING_APPOINTMENT")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50 transition-colors"
                            >
                              Book
                            </button>
                          )}
                          {r.status === "AWAITING_APPOINTMENT" && (
                            <button
                              onClick={() => updateStatus(r.id, "COMPLETE")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              Complete
                            </button>
                          )}
                          <button
                            onClick={() => sendRecall(patient.id)}
                            className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors"
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
              <div key={col.key} className={cn("rounded-xl border-t-2 bg-white border border-slate-200 flex flex-col shadow-sm", col.accent)}>
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                    {col.label}
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                      {items.length}
                    </span>
                  </h2>
                </div>
                <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                  {items.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">No referrals</p>
                  )}
                  {items.map((r) => {
                    const overdue = daysOverdue(r);
                    const patient = r.screeningSession.patient;
                    return (
                      <div
                        key={r.id}
                        className={cn(
                          "bg-white rounded-lg border shadow-sm p-3 space-y-2.5 transition-all",
                          overdue > 0 ? "border-red-200" : "border-slate-200"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-xs text-slate-400 font-mono">{patient.nhi}</p>
                          </div>
                          <PriorityBadge priority={r.priority} />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <RiskBadge risk={r.screeningSession.currentRiskLevel} />
                          <TargetChip r={r} />
                        </div>
                        {r.reason && (
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{r.reason}</p>
                        )}
                        <p className="text-[10px] text-slate-400">
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
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === "APPROVED" && (
                            <button
                              onClick={() => updateStatus(r.id, "AWAITING_APPOINTMENT")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
                            >
                              <Calendar className="h-3 w-3 inline mr-1" />
                              Book Appt
                            </button>
                          )}
                          {r.status === "AWAITING_APPOINTMENT" && (
                            <button
                              onClick={() => updateStatus(r.id, "COMPLETE")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3 w-3 inline mr-1" />
                              Complete
                            </button>
                          )}
                          <button
                            onClick={() => sendRecall(patient.id)}
                            className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors"
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
