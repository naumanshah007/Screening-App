"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskBadge, PriorityBadge, Badge } from "@/components/ui/badge";
import { formatDate, calculateAge } from "@/lib/utils";

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

const KANBAN_COLUMNS: { key: ReferralStatus; label: string; colour: string }[] = [
  { key: "PENDING", label: "Pending Review", colour: "bg-amber-50 border-amber-200" },
  { key: "APPROVED", label: "Approved", colour: "bg-blue-50 border-blue-200" },
  { key: "AWAITING_APPOINTMENT", label: "Awaiting Appointment", colour: "bg-purple-50 border-purple-200" },
  { key: "COMPLETE", label: "Complete", colour: "bg-green-50 border-green-200" },
];

type ViewMode = "kanban" | "table";

export default function CoordinatorPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("kanban");
  const [updating, setUpdating] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState("");

  useEffect(() => {
    loadReferrals();
  }, [priorityFilter]);

  async function loadReferrals() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (priorityFilter) params.append("priority", priorityFilter);
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
    alert("Recall notice sent.");
  }

  function isDaysOverdue(r: Referral): number {
    const days = Math.floor(
      (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, days - (r.targetDays ?? 999));
  }

  const byStatus = (status: ReferralStatus) =>
    referrals.filter((r) => r.status === status);

  return (
    <div className="p-6 max-w-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Referral Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Coordinator Portal — NZ Cervical Screening Programme</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2"
            aria-label="Filter by priority"
          >
            <option value="">All Priorities</option>
            <option value="P1">P1 - Urgent</option>
            <option value="P2">P2 - Semi-urgent</option>
            <option value="P3">P3 - Routine</option>
            <option value="P4">P4 - Non-urgent</option>
          </select>
          {/* View toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setView("kanban")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                view === "kanban"
                  ? "bg-[#0D9488] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              aria-pressed={view === "kanban"}
            >
              Kanban
            </button>
            <button
              onClick={() => setView("table")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                view === "table"
                  ? "bg-[#0D9488] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              aria-pressed={view === "table"}
            >
              Table
            </button>
          </div>
          <Button onClick={loadReferrals} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading referrals…</div>
      ) : referrals.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No referrals found.</div>
      ) : view === "kanban" ? (
        /* ── Kanban Board ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map((col) => {
            const items = byStatus(col.key);
            return (
              <div key={col.key} className={`border rounded-xl ${col.colour} flex flex-col`}>
                <div className="px-4 py-3 border-b border-current/10">
                  <h2 className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                    {col.label}
                    <span className="bg-white text-gray-600 text-xs px-2 py-0.5 rounded-full border">
                      {items.length}
                    </span>
                  </h2>
                </div>
                <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                  {items.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">None</p>
                  )}
                  {items.map((r) => {
                    const overdue = isDaysOverdue(r);
                    const patient = r.screeningSession.patient;
                    return (
                      <div
                        key={r.id}
                        className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[#1E3A5F]">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">{patient.nhi}</p>
                          </div>
                          <PriorityBadge priority={r.priority} />
                        </div>
                        <div className="flex items-center gap-2">
                          <RiskBadge risk={r.screeningSession.currentRiskLevel} />
                          <Badge variant="default">{r.type}</Badge>
                        </div>
                        {r.reason && (
                          <p className="text-xs text-gray-600 line-clamp-2">{r.reason}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          Referred: {formatDate(r.createdAt)}
                          {patient.gpPractice && ` · ${patient.gpPractice.name}`}
                        </p>
                        {overdue > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded px-2 py-1">
                            <p className="text-xs text-red-700 font-semibold">
                              ⚠ Overdue by {overdue} days (target: {r.targetDays} days)
                            </p>
                          </div>
                        )}
                        {/* Actions */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {r.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => updateStatus(r.id, "APPROVED")}
                                disabled={updating === r.id}
                                className="text-xs px-2 py-1 bg-[#0D9488] text-white rounded hover:bg-[#0b7a6f] transition-colors disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateStatus(r.id, "REJECTED")}
                                disabled={updating === r.id}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === "APPROVED" && (
                            <button
                              onClick={() => updateStatus(r.id, "AWAITING_APPOINTMENT")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              Book Appointment
                            </button>
                          )}
                          {r.status === "AWAITING_APPOINTMENT" && (
                            <button
                              onClick={() => updateStatus(r.id, "COMPLETE")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              Mark Complete
                            </button>
                          )}
                          <button
                            onClick={() => sendRecall(patient.id)}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
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
      ) : (
        /* ── Table View ── */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="grid" aria-label="Referral queue">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Patient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Risk</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Referred</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Days</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {referrals.map((r) => {
                  const patient = r.screeningSession.patient;
                  const daysSince = Math.floor(
                    (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const overdue = isDaysOverdue(r);
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 ${overdue > 0 ? "bg-red-50" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1E3A5F]">
                          {patient.firstName} {patient.lastName}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{patient.nhi} · Age {calculateAge(patient.dateOfBirth)}</p>
                      </td>
                      <td className="px-4 py-3"><PriorityBadge priority={r.priority} /></td>
                      <td className="px-4 py-3 text-gray-600">{r.type}</td>
                      <td className="px-4 py-3">
                        <Badge variant={r.status === "COMPLETE" ? "low" : r.status === "PENDING" ? "medium" : "default"}>
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3"><RiskBadge risk={r.screeningSession.currentRiskLevel} /></td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={overdue > 0 ? "text-red-600 font-semibold" : "text-gray-600"}>
                          {daysSince}d {overdue > 0 && `(+${overdue} overdue)`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {r.status === "PENDING" && (
                            <button
                              onClick={() => updateStatus(r.id, "APPROVED")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-[#0D9488] text-white rounded disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                          {r.status === "APPROVED" && (
                            <button
                              onClick={() => updateStatus(r.id, "AWAITING_APPOINTMENT")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                            >
                              Book
                            </button>
                          )}
                          {r.status === "AWAITING_APPOINTMENT" && (
                            <button
                              onClick={() => updateStatus(r.id, "COMPLETE")}
                              disabled={updating === r.id}
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded disabled:opacity-50"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
