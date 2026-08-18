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
import { BatchResultDetail, type BatchResultDetailFocus } from "@/components/batch/BatchResultDetail";
import { cn } from "@/lib/utils";
import { formatFigureLabel } from "@/lib/batch/guideline-citations";
import type { BatchCaseResult } from "@/lib/batch/types";
import type { PriorComparison } from "@/lib/batch/reprocessing";

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
  /** Booking triage grade from the active rule release. */
  triagePriority?: string | null;
  triageCategory?: string | null;
  triageRuleCode?: string | null;
  triageRuleVersion?: string | null;
  /** Reprocessing. */
  priorDecisionCount: number;
  priorComparison?: PriorComparison | null;
  /** Aggregate-queue context (optional). */
  sourceSystem?: string | null;
  runId?: string | null;
}

type Filter = "all" | "review" | "urgent" | "pending" | "accepted" | "rejected" | "needs_info";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "review", label: "Mandatory clinician review" },
  { id: "urgent", label: "Urgent clinical priority" },
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
  initialFilter = "all",
  initialPriorityFilter = null,
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
  /** URL-backed starting filter, used when cards link into the queue. */
  initialFilter?: Filter;
  initialPriorityFilter?: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<WorklistItem[]>(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(initialPriorityFilter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [detailItem, setDetailItem] = useState<WorklistItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailFocus, setDetailFocus] = useState<BatchResultDetailFocus>("summary");

  // Reason modal for mandatory acceptance / reject / needs-info
  const [reasonModal, setReasonModal] = useState<{
    open: boolean;
    disposition: "ACCEPTED" | "REJECTED" | "NEEDS_INFO";
    itemIds: string[];
  } | null>(null);
  const [reasonText, setReasonText] = useState("");

  const counts = useMemo(() => {
    const c = { pending: 0, accepted: 0, rejected: 0, needs_info: 0, review: 0, urgent: 0 };
    for (const it of items) {
      if (it.disposition === "PENDING") c.pending++;
      else if (it.disposition === "ACCEPTED") c.accepted++;
      else if (it.disposition === "REJECTED") c.rejected++;
      else if (it.disposition === "NEEDS_INFO") c.needs_info++;
      if (it.reviewRequired) c.review++;
      if (isUrgentClinicalPriority(it)) c.urgent++;
    }
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const byPrimaryFilter = (() => {
      switch (filter) {
        case "review": return items.filter((i) => i.reviewRequired);
        case "urgent": return items.filter(isUrgentClinicalPriority);
        case "pending": return items.filter((i) => i.disposition === "PENDING");
        case "accepted": return items.filter((i) => i.disposition === "ACCEPTED");
        case "rejected": return items.filter((i) => i.disposition === "REJECTED");
        case "needs_info": return items.filter((i) => i.disposition === "NEEDS_INFO");
        default: return items;
      }
    })();

    if (!priorityFilter) return byPrimaryFilter;
    return byPrimaryFilter.filter((i) => (i.triagePriority ?? i.referralPriority) === priorityFilter);
  }, [items, filter, priorityFilter]);

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
    (disposition: "ACCEPTED" | "REJECTED" | "NEEDS_INFO", itemIds: string[]) => {
      if (itemIds.length === 0) return;
      setReasonText("");
      setReasonModal({ open: true, disposition, itemIds });
    },
    []
  );

  const submitReason = useCallback(() => {
    if (!reasonModal) return;
    if ((reasonModal.disposition === "REJECTED" || reasonModal.disposition === "ACCEPTED") && !reasonText.trim()) {
      setError(reasonModal.disposition === "REJECTED"
        ? "A reason is required to reject."
        : "A clinical review note is required to accept mandatory-review cases.");
      return;
    }
    const { disposition, itemIds } = reasonModal;
    setReasonModal(null);
    void applyDisposition(itemIds, disposition, reasonText.trim() || undefined);
  }, [reasonModal, reasonText, applyDisposition]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const acceptItems = useCallback((itemIds: string[]) => {
    const requiresNote = items.some((item) => itemIds.includes(item.id) && item.reviewRequired);
    if (requiresNote) requestReason("ACCEPTED", itemIds);
    else void applyDisposition(itemIds, "ACCEPTED");
  }, [items, requestReason, applyDisposition]);

  const syncUrlFilter = useCallback((nextFilter: Filter, nextPriorityFilter: string | null) => {
    if (window.location.pathname !== "/review") return;

    const params = new URLSearchParams(window.location.search);
    if (nextFilter === "all") params.delete("filter");
    else params.set("filter", nextFilter);
    if (nextPriorityFilter) params.set("priority", nextPriorityFilter);
    else params.delete("priority");
    params.delete("added");

    const query = params.toString();
    router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [router]);

  const applyFilter = useCallback((nextFilter: Filter, nextPriorityFilter: string | null = null) => {
    setFilter(nextFilter);
    setPriorityFilter(nextPriorityFilter);
    setSelected(new Set());
    syncUrlFilter(nextFilter, nextPriorityFilter);
  }, [syncUrlFilter]);

  const openDetail = useCallback((item: WorklistItem, focus: BatchResultDetailFocus = "summary") => {
    setDetailItem(item);
    setDetailFocus(focus);
    setDetailOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* Summary stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={removeCompletedOnAction ? "Pending queue" : "Total"}
          value={items.length}
          active={filter === "all" && !priorityFilter}
          onClick={() => applyFilter("all")}
        />
        <StatCard
          label="Pending"
          value={counts.pending}
          tone="info"
          active={filter === "pending" && !priorityFilter}
          onClick={() => applyFilter("pending")}
        />
        <StatCard
          label="Accepted"
          value={counts.accepted}
          tone="success"
          active={filter === "accepted" && !priorityFilter}
          onClick={() => applyFilter("accepted")}
        />
        <StatCard
          label="Rejected"
          value={counts.rejected}
          tone="danger"
          active={filter === "rejected" && !priorityFilter}
          onClick={() => applyFilter("rejected")}
        />
        <StatCard
          label="Mandatory review"
          value={counts.review}
          tone="warn"
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
          active={filter === "review" && !priorityFilter}
          onClick={() => applyFilter("review")}
        />
        <StatCard
          label="Urgent priority"
          value={counts.urgent}
          tone="danger"
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
          active={filter === "urgent" && !priorityFilter}
          onClick={() => applyFilter("urgent")}
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const n =
            f.id === "all" ? items.length
            : f.id === "review" ? counts.review
            : f.id === "urgent" ? counts.urgent
            : counts[f.id as keyof typeof counts];
          return (
            <button
              key={f.id}
              onClick={() => applyFilter(f.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === f.id && !priorityFilter
                  ? "bg-brand-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              {f.label} ({n})
            </button>
          );
        })}
        {priorityFilter && (
          <button
            type="button"
            onClick={() => applyFilter("all")}
            className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700"
          >
            Booking priority: {priorityFilter} x
          </button>
        )}
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
              onClick={() => acceptItems(selectedIds)}>
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
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="max-w-full overflow-x-auto overscroll-x-contain">
            <table className="min-w-[1120px] w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  {canReview && (
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible"
                        className="h-4 w-4 rounded border-border"
                      />
                    </th>
                  )}
                  <th className="min-w-[220px] px-3 py-2.5">Patient</th>
                  {showSource && <th className="min-w-[170px] px-3 py-2.5">Source</th>}
                  <th className="min-w-[170px] px-3 py-2.5">Referral</th>
                  <th className="px-3 py-2.5">Risk</th>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="min-w-[280px] px-3 py-2.5">Recommendation</th>
                  <th className="min-w-[150px] px-3 py-2.5">Status</th>
                  <th className="sticky right-0 z-20 border-l border-border bg-card px-3 py-2.5 text-right">Actions</th>
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
                        {item.priorDecisionCount > 0 && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                            Seen before{item.priorDecisionCount > 1 ? ` · ${item.priorDecisionCount} prior` : ""}
                            {item.priorComparison?.anyChanged ? " · data changed" : ""}
                          </span>
                        )}
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
                        {item.triagePriority ? (
                          <>
                            <PriorityBadge priority={item.triagePriority} />
                            {item.triageRuleCode && (
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                {item.triageRuleCode}
                                {item.triageRuleVersion ? ` · v${item.triageRuleVersion}` : ""}
                              </p>
                            )}
                          </>
                        ) : item.referralPriority ? (
                          <PriorityBadge priority={item.referralPriority} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-foreground line-clamp-2">{item.recommendation}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.recommendationCode}</p>
                        <button
                          type="button"
                          onClick={() => openDetail(item, "figure")}
                          className="mt-1 inline-flex items-center rounded-md text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
                        >
                          {formatFigureLabel(item.figure)}
                        </button>
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
                      <td className="sticky right-0 z-10 border-l border-border bg-card px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          <Button size="xs" variant="ghost" onClick={() => openDetail(item)}>
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                          {canReview && item.disposition !== "ACCEPTED" && (
                            <Button size="xs" variant="ghost" disabled={busy}
                              onClick={() => acceptItems([item.id])}
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
      <BatchResultDetail
        result={detailItem?.result ?? null}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        priorComparison={detailItem?.priorComparison ?? null}
        initialFocus={detailFocus}
        reviewItemId={detailItem?.id}
        canCorrectCanonicalFacts={canReview && detailItem?.disposition === "PENDING"}
        triage={
          detailItem?.triagePriority
            ? {
                priority: detailItem.triagePriority,
                category: detailItem.triageCategory ?? null,
                ruleCode: detailItem.triageRuleCode ?? null,
                ruleVersion: detailItem.triageRuleVersion ?? null,
              }
            : null
        }
      />

      {/* Reason modal for reject / needs-info */}
      <Dialog
        open={Boolean(reasonModal?.open)}
        onClose={() => setReasonModal(null)}
	        title={reasonModal?.disposition === "REJECTED" ? "Reject case(s)" : reasonModal?.disposition === "ACCEPTED" ? "Confirm mandatory review" : "Mark as needs information"}
        description={
          reasonModal?.disposition === "REJECTED"
            ? `A reason is required and recorded in the audit trail. Applies to ${reasonModal?.itemIds.length ?? 0} case(s).`
            : reasonModal?.disposition === "ACCEPTED"
              ? `Record what you reviewed before accepting ${reasonModal?.itemIds.length ?? 0} mandatory-review case(s).`
              : `Optional note. Applies to ${reasonModal?.itemIds.length ?? 0} case(s).`
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setReasonModal(null)}>Cancel</Button>
            <Button
              variant={reasonModal?.disposition === "REJECTED" ? "danger" : reasonModal?.disposition === "ACCEPTED" ? "success" : "warning"}
              onClick={submitReason}
            >
	              {reasonModal?.disposition === "REJECTED" ? "Reject" : reasonModal?.disposition === "ACCEPTED" ? "Accept after review" : "Mark needs information"}
            </Button>
          </>
        }
      >
        <Textarea
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          placeholder={reasonModal?.disposition === "REJECTED"
            ? "e.g. Duplicate referral; already booked under existing case."
            : reasonModal?.disposition === "ACCEPTED"
              ? "Summarise the history, evidence, or safety flag you reviewed."
              : "e.g. Awaiting NCSR history before disposition."}
          rows={3}
          autoFocus
        />
      </Dialog>
    </div>
  );
}

function StatCard({
  label, value, tone, icon, active, onClick,
}: {
  label: string;
  value: number;
  tone?: "info" | "success" | "danger" | "warn";
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
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
    </>
  );

  const className = cn(
    "rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors",
    active && "border-brand-300 ring-2 ring-brand-500/20",
    onClick && "w-full cursor-pointer hover:border-brand-300/60 hover:bg-muted/35"
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
