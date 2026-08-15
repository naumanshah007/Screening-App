"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Network } from "lucide-react";

import { Panel, StatusBadge } from "@/components/system";
import { cn } from "@/lib/utils";
import {
  buildPathwayGraph,
  listPathwaySummaries,
  type PathwayGraph,
  type PathwaySummary,
} from "@/lib/clinical-rules/pathway-view-model";
import type { ClinicalRuleSnapshot } from "@/lib/clinical-rules/schema";
import { PathwayViewer, type GovernanceMeta } from "./PathwayViewer";

function displayTitle(summary: PathwaySummary) {
  return summary.viewType === "MASTER" ? "Complete Governed Decision Tree" : summary.title;
}

function displayGraph(graph: PathwayGraph) {
  return graph.viewType === "MASTER"
    ? { ...graph, title: "Complete Governed Decision Tree" }
    : graph;
}

function pathwayReference(summary: PathwaySummary) {
  const match = /^(Figure\s+\d+[A-Za-z]?)/i.exec(summary.description);
  if (match) return match[1];
  if (summary.viewType === "MASTER") return "Complete pathway";
  if (summary.viewType === "OVERLAY") return "Governed overlay";
  return "Governed pathway";
}

/**
 * Rule Studio's pathway catalogue and reader.
 *
 * Every card builds its diagram from the same governed snapshot used by the
 * master view. Selecting a card changes presentation only; it never creates a
 * second clinical interpretation or a separate rule graph.
 */
export function PathwayCatalogue({
  snapshot,
  governance,
}: {
  snapshot: ClinicalRuleSnapshot;
  governance: GovernanceMeta;
}) {
  const summaries = useMemo(() => listPathwaySummaries(snapshot), [snapshot]);
  const graphCounts = useMemo(
    () =>
      new Map(
        summaries.map((summary) => {
          const summaryGraph = buildPathwayGraph(snapshot, summary.key);
          return [summary.key, { nodes: summaryGraph.nodes.length, edges: summaryGraph.edges.length }];
        })
      ),
    [snapshot, summaries]
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedSummary = summaries.find((summary) => summary.key === selectedKey) ?? null;
  const selectedView = snapshot.views.find((view) => view.key === selectedKey) ?? null;
  const graph = useMemo(
    () => (selectedKey ? displayGraph(buildPathwayGraph(snapshot, selectedKey)) : null),
    [selectedKey, snapshot]
  );

  if (graph && selectedSummary && selectedView) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedKey(null)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> All pathways
        </button>

        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {pathwayReference(selectedSummary)}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {displayTitle(selectedSummary)}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {selectedSummary.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="info">{governance.rulesetId}</StatusBadge>
              <StatusBadge tone="neutral">{graph.nodes.length} nodes</StatusBadge>
              <StatusBadge tone="neutral">{graph.edges.length} edges</StatusBadge>
            </div>
          </div>
          {selectedSummary.viewType === "MASTER" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Projection version {selectedView.visualSource?.packageVersion ?? snapshot.importEvidence.visualPackageVersion ?? snapshot.sourcePackage.version}
            </p>
          ) : null}
        </Panel>

        <PathwayViewer
          key={graph.key}
          graph={graph}
          governance={governance}
          initialCollapsed={graph.viewType === "MASTER"}
          className="min-h-[720px]"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Panel className="border-brand-200 bg-brand-50/40 dark:border-brand-900 dark:bg-brand-950/20">
        <div className="flex items-start gap-3">
          <Network className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Governed pathway views</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              These views are visual projections of the current governed rules. Clinical logic is shared with {governance.rulesetId}; only the visual layout differs.
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {summaries.map((summary) => {
          const counts = graphCounts.get(summary.key)!;
          return (
            <article key={summary.key} className="flex min-h-56 flex-col rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {pathwayReference(summary)}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-foreground">{displayTitle(summary)}</h2>
                </div>
                <StatusBadge tone={summary.viewType === "MASTER" ? "info" : "neutral"} size="sm">
                  {summary.viewType === "MASTER" ? "Complete" : summary.viewType === "OVERLAY" ? "Overlay" : "Pathway"}
                </StatusBadge>
              </div>
              <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{summary.description}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{counts.nodes} nodes</span>
                <span>{counts.edges} edges</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKey(summary.key)}
                className={cn(
                  "mt-4 inline-flex items-center justify-between rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-brand-700 transition-colors",
                  "hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                Open pathway <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
