"use client";

import { AlertTriangle, ArrowRight, Plus } from "lucide-react";

import { Panel } from "@/components/system";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The single action panel for Case Intake.
 *
 * Replaces three scattered elements — a large amber "provisional output"
 * warning, a loose selected-count line, and two competing buttons — with one
 * cohesive surface: state on the left, actions on the right.
 *
 * WORDING
 * -------
 * Nothing here may imply a clinical recommendation exists. At this stage cases
 * have been routed but not evaluated by the current governed ruleset; the
 * governed recommendation is produced when they enter the Review Queue.
 */
export function BatchActionPanel({
  totalCount,
  selectedCount,
  validCount,
  blockedCount,
  episodeSummary,
  processing,
  onProcess,
  onAddManual,
  onSelectAll,
  onClearSelection,
  className,
}: {
  totalCount: number;
  selectedCount: number;
  validCount: number;
  blockedCount: number;
  /** How many of these arrivals have been seen before. */
  episodeSummary?: {
    received: number;
    NEW: number;
    ALREADY_IN_REVIEW: number;
    COMPLETED: number;
    UPDATED: number;
    POSSIBLE_DUPLICATE: number;
  } | null;
  processing?: boolean;
  onProcess: () => void;
  onAddManual?: () => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  className?: string;
}) {
  const allSelected = selectedCount === validCount && validCount > 0;

  return (
    <Panel className={cn("px-4 py-4", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* ── State ───────────────────────────────────────────────────── */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <p className="text-lg font-semibold leading-none text-foreground">
              {totalCount} case{totalCount === 1 ? "" : "s"} ready
            </p>
            {blockedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {blockedCount} need{blockedCount === 1 ? "s" : ""} attention
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{selectedCount} selected</span>
            {" · "}
            {validCount} valid
            {" · "}
            {blockedCount} blocked
          </p>

          {/*
            How much of this intake has been seen before.

            Only non-zero categories are shown: on a first pull everything is
            new, and printing four zeros would be noise. Counted across
            EVERYTHING pulled rather than only the current selection, because
            the question this answers — "am I about to process work that is
            already done?" — is asked before selecting.
          */}
          {episodeSummary && episodeSummary.received > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{episodeSummary.received} received</span>
              {(
                [
                  ["new", episodeSummary.NEW],
                  ["already in review", episodeSummary.ALREADY_IN_REVIEW],
                  ["completed", episodeSummary.COMPLETED],
                  ["updated", episodeSummary.UPDATED],
                  ["possible duplicate", episodeSummary.POSSIBLE_DUPLICATE],
                ] as const
              )
                .filter(([, count]) => count > 0)
                .map(([label, count]) => (
                  <span key={label}>
                    {" · "}
                    <span className="font-medium text-foreground">{count}</span> {label}
                  </span>
                ))}
            </p>
          )}

          {/* Selection controls sit with the count they act on. */}
          {(onSelectAll || onClearSelection) && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              {onSelectAll && !allSelected && (
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-400"
                >
                  Select all
                </button>
              )}
              {onClearSelection && selectedCount > 0 && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Clear selection
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2.5">
          {onAddManual && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddManual}
              icon={<Plus className="h-4 w-4" />}
            >
              Add Test Case
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={onProcess}
            disabled={selectedCount === 0 || processing}
            loading={processing}
          >
            Prepare {selectedCount} for Review Queue
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {/* ── Safety notice ───────────────────────────────────────────────
          Restrained and inline: it must be unmissable without competing with
          the primary action for attention. */}
      <div className="mt-3.5 flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
        <AlertTriangle
          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
          <strong className="font-semibold">
            Routing preview · Governed recommendation pending
          </strong>
          <span className="ml-1 text-amber-800/90 dark:text-amber-300/90">
            No clinical recommendation has been generated yet. Selected cases are
            evaluated when added to the Review Queue.
          </span>
        </p>
      </div>
    </Panel>
  );
}
