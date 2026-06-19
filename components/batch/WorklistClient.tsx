"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, XCircle, HelpCircle, Eye, Loader2, ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge, RiskBadge, PriorityBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { BatchResultDetail } from "@/components/batch/BatchResultDetail";
import { cn } from "@/lib/utils";
import type { BatchCaseResult } from "@/lib/batch/types";

export type Disposition = "PENDING" | "ACCEPTED" | "REJECTED" | "NEEDS_INFO";

export interface WorklistItem {
  id: string;
  rowNumber: number;
  label: string | null;
  externalPatientId: string | null;
  patientName: string | null;
  nhi: string | null;
  gpPractice: string | null;
  receivedDate: string | null;
  patientAge: number | null;
  ethnicityPrimary: string | null;
  figure: string;
  riskLevel: string;
  recommendationCode: string;
  recommendation: string;
  referralPriority: string | null;
  safetyOutcome: string | null;
  reviewRequired: boolean;
  engineStatus: string;
  disposition: Disposition;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  overrideReason: string | null;
  result: BatchCaseResult;
  /** Aggregate-queue context (optional). */
  sourceSystem?: string | null;
  runId?: string | null;
}

type Filter = "all" | "review" | "pending" | "accepted" | "rejected" | "needs_info";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "review", label: "Mandatory clinician review" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "needs_info", label: "Needs information" },
];

const DISPOSITION_BADGE: Record<Disposition, { variant: "low" | "urgent" | "info" | "default"; label: string }> = {
  PENDING: { variant: "default", label: "Pending" },
  ACCEPTED: { variant: "low", label: "Accepted" },
  REJECTED: { variant: "urgent", label: "Rejected" },
  NEEDS_INFO: { variant: "info", label: "Needs information" },
};

function patientNhi(item: WorklistItem) {
  return item.nhi ?? item.externalPatientId ?? `ROW-${String(item.rowNumber).padStart(3, "0")}`;
}

function isUrgentClinicalPriority(item: WorklistItem) {
  return item.riskLevel === "URGENT" || item.referralPriority === "P1" || item.referralPriority === "P1_HSC";
}

export function WorklistClient({
  initialItems,
  canReview,
  engineVersion,
  showSource = false,
  removeCompletedOnAction = false,
}: {
  /** Per-run worklist passes its run's items; the aggregate queue passes all. */
  runId?: string;
  initialItems: WorklistItem[];
  canReview: boolean;
  engineVersion?: string;
  /** Show the originating source/run per row (aggregate Review Queue). */
  showSource?: boolean;
  /** Aggregate pending queue removes items once a final disposition is recorded. */
  removeCompletedOnAction?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<WorklistItem[]>(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState<BatchCaseResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Reason modal for reject / needs-info
  const [reasonModal, setReasonModal] = useState<{
    open: boolean;
    disposition: "REJECTED" | "NEEDS_INFO";
    itemIds: string[];
  } | null>(null);
  const [reasonText, setReasonText] = useState("");

  const counts = useMemo(() => {
    const c = { pending: 0, accepted: 0, rejected: 0, needs_info: 0, review: 0 };
    for (const it of items) {
      if (it.disposition === "PENDING") c.pending++;
      else if (it.disposition === "ACCEPTED") c.accepted++;
      else if (it.disposition === "REJECTED") c.rejected++;
      else if (it.disposition === "NEEDS_INFO") c.needs_info++;
      if (it.reviewRequired) c.review++;
    }
    return c;
  }, [items]);

  const visible = useMemo(() => {
    switch (filter) {
      case "review": return items.filter((i) => i.reviewRequired);
      case "pending": return items.filter((i) => i.disposition === "PENDING");
      case "accepted": return items.filter((i) => i.disposition === "ACCEPTED");
      case "rejected": return items.filter((i) => i.disposition === "REJECTED");
      case "needs_info": return items.filter((i) => i.disposition === "NEEDS_INFO");
      default: return items;
    }
  }, [items, filter]);

  const visibleIds = useMemo(() => visible.map((i) => i.id), [visible]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (visibleIds.every((id) => next.has(id))) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [visibleIds]);

  const applyDisposition = useCallback(
    async (itemIds: string[], disposition: Disposition, reason?: string) => {
      if (itemIds.length === 0 || disposition === "PENDING") return;
      setBusy(true);
      setError("");
      try {
        const res = await fetch(`/api/batch/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemIds,
            disposition,
            note: reason ?? null,
            overrideReason: disposition === "REJECTED" ? (reason ?? null) : null,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const idSet = new Set(itemIds);
        setItems((prev) => {
          if (removeCompletedOnAction) {
            return prev.filter((it) => !idSet.has(it.id));
          }

          return prev.map((it) =>
            idSet.has(it.id)
              ? {
                  ...it,
                  disposition,
                  reviewedByName: "You",
                  reviewedAt: "just now",
                  reviewNote: reason ?? null,
                  overrideReason: disposition === "REJECTED" ? (reason ?? null) : null,
                }
              : it
          );
        });
        setSelected(new Set());
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Review failed.");
      } finally {
        setBusy(false);
      }
    },
    [removeCompletedOnAction, router]
  );

  const requestReason = useCallback(
    (disposition: "REJECTED" | "NEEDS_INFO", itemIds: string[]) => {
      if (itemIds.length === 0) return;
      setReasonText("");
      setReasonModal({ open: true, disposition, itemIds });
    },
    []
  );

  const submitReason = useCallback(() => {
    if (!reasonModal) return;
    if (reasonModal.disposition === "REJECTED" && !reasonText.trim()) {
      setError("A reason is required to reject.");
      return;
    }
    const { disposition, itemIds } = reasonModal;
    setReasonModal(null);
    void applyDisposition(itemIds, disposition, reasonText.trim() || undefined);
  }, [reasonModal, reasonText, applyDisposition]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const openDetail = useCallback((item: WorklistItem) => {
    setDetail(item.result);
    setDetailOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* Summary stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label={removeCompletedOnAction ? "Pending queue" : "Total"} value={items.length} />
        <StatCard label="Pending" value={counts.pending} tone="info" />
        <StatCard label="Accepted" value={counts.accepted} tone="success" />
        <StatCard label="Rejected" value={counts.rejected} tone="danger" />
        <StatCard label="Mandatory review" value={counts.review} tone="warn" icon={<ShieldAlert className="h-3.5 w-3.5" />} />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const n =
            f.id === "all" ? items.length
            : f.id === "review" ? counts.review
            : counts[f.id as keyof typeof counts];
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === f.id
                  ? "bg-brand-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              {f.label} ({n})
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Bulk action bar */}
      {canReview && selected.size > 0 && (
        <div className="sticky top-2 z-10 rounded-xl border border-border bg-card shadow-overlay px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-foreground">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="success" disabled={busy}
              onClick={() => applyDisposition(selectedIds, "ACCEPTED")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Accept selected
            </Button>
            <Button size="sm" variant="warning" disabled={busy}
              onClick={() => requestReason("NEEDS_INFO", selectedIds)}>
              <HelpCircle className="h-4 w-4" /> Needs information
            </Button>
            <Button size="sm" variant="danger" disabled={busy}
              onClick={() => requestReason("REJECTED", selectedIds)}>
              <XCircle className="h-4 w-4" /> Reject selected
            </Button>
          </div>
        </div>
      )}

      {!canReview && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          You can view this Review Queue but your role cannot record accept/reject decisions.
        </div>
      )}

      {/* Worklist table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  {canReview && (
                    <th className="px-3 py-2.5 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible"
                        className="h-4 w-4 rounded border-border"
                      />
                    </th>
                  )}
                  <th className="px-3 py-2.5">Patient</th>
                  {showSource && <th className="px-3 py-2.5">Source</th>}
                  <th className="px-3 py-2.5">Referral</th>
                  <th className="px-3 py-2.5">Risk</th>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5 min-w-[240px]">Recommendation</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
	                {visible.map((item) => {
	                  const isSel = selected.has(item.id);
	                  const dispMeta = DISPOSITION_BADGE[item.disposition];
	                  const urgentClinical = isUrgentClinicalPriority(item);
	                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors",
                        isSel && "bg-brand-50/40 dark:bg-brand-950/20"
                      )}
                    >
                      {canReview && (
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggle(item.id)}
                            aria-label={`Select ${item.patientName ?? patientNhi(item)}`}
                            className="h-4 w-4 rounded border-border"
                          />
                        </td>
                      )}
                      <td className="px-3 py-2.5">
	                        <div className="flex flex-wrap items-center gap-1.5">
	                          <span className="font-medium text-foreground">
	                            {item.patientName ?? patientNhi(item)}
	                          </span>
	                          {urgentClinical && (
	                            <Badge variant="urgent" size="sm">Urgent clinical priority</Badge>
	                          )}
	                          {item.reviewRequired && (
	                            <Badge variant="high" size="sm">Mandatory clinician review</Badge>
	                          )}
	                        </div>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{patientNhi(item)}</span>
                          {item.patientAge != null && <> · {item.patientAge} yrs</>}
                          {item.ethnicityPrimary && <> · {item.ethnicityPrimary.toLowerCase()}</>}
                        </p>
                      </td>
                      {showSource && (
                        <td className="px-3 py-2.5">
                          <p className="text-foreground truncate max-w-[160px]">{item.sourceSystem ?? "—"}</p>
                          {item.runId && (
                            <Link
                              href={`/batch/runs/${item.runId}`}
                              className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                            >
	                              View intake →
                            </Link>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2.5">
                        <p className="text-foreground truncate max-w-[180px]">{item.gpPractice ?? "—"}</p>
                        {item.receivedDate && (
                          <p className="text-xs text-muted-foreground">Received {item.receivedDate}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><RiskBadge risk={item.riskLevel} /></td>
                      <td className="px-3 py-2.5">
                        {item.referralPriority ? <PriorityBadge priority={item.referralPriority} /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-foreground line-clamp-2">{item.recommendation}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.recommendationCode}</p>
                        {item.disposition === "REJECTED" && item.overrideReason && (
                          <p className="text-xs text-destructive mt-0.5">Reason: {item.overrideReason}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={dispMeta.variant} size="sm">{dispMeta.label}</Badge>
                        {item.reviewedByName && item.disposition !== "PENDING" && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.reviewedByName}{item.reviewedAt ? ` · ${item.reviewedAt}` : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="xs" variant="ghost" onClick={() => openDetail(item)}>
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                          {canReview && item.disposition !== "ACCEPTED" && (
                            <Button size="xs" variant="ghost" disabled={busy}
                              onClick={() => applyDisposition([item.id], "ACCEPTED")}
                              aria-label="Accept">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                          )}
                          {canReview && item.disposition !== "REJECTED" && (
                            <Button size="xs" variant="ghost" disabled={busy}
                              onClick={() => requestReason("REJECTED", [item.id])}
                              aria-label="Reject">
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={(canReview ? 1 : 0) + (showSource ? 1 : 0) + 7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      No cases match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {engineVersion ? `Engine ${engineVersion} · ` : ""}Recommendations are decision-support only and require reviewer confirmation before any clinical action.
      </p>

      {/* Drill-in: full picture (reuses the batch result detail) */}
      <BatchResultDetail result={detail} open={detailOpen} onClose={() => setDetailOpen(false)} />

      {/* Reason modal for reject / needs-info */}
      <Dialog
        open={Boolean(reasonModal?.open)}
        onClose={() => setReasonModal(null)}
	        title={reasonModal?.disposition === "REJECTED" ? "Reject case(s)" : "Mark as needs information"}
        description={
          reasonModal?.disposition === "REJECTED"
            ? `A reason is required and recorded in the audit trail. Applies to ${reasonModal?.itemIds.length ?? 0} case(s).`
            : `Optional note. Applies to ${reasonModal?.itemIds.length ?? 0} case(s).`
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setReasonModal(null)}>Cancel</Button>
            <Button
              variant={reasonModal?.disposition === "REJECTED" ? "danger" : "warning"}
              onClick={submitReason}
            >
	              {reasonModal?.disposition === "REJECTED" ? "Reject" : "Mark needs information"}
            </Button>
          </>
        }
      >
        <Textarea
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          placeholder={reasonModal?.disposition === "REJECTED"
            ? "e.g. Duplicate referral; already booked under existing case."
            : "e.g. Awaiting NCSR history before disposition."}
          rows={3}
          autoFocus
        />
      </Dialog>
    </div>
  );
}

function StatCard({
  label, value, tone, icon,
}: {
  label: string;
  value: number;
  tone?: "info" | "success" | "danger" | "warn";
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={cn(
        "text-2xl font-bold mt-0.5",
        tone === "success" && "text-success",
        tone === "danger" && "text-destructive",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        !tone && "text-foreground",
        tone === "info" && "text-foreground",
      )}>
        {value}
      </div>
    </div>
  );
}
