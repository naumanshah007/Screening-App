"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import {
  buildPathwayGraph,
  listPathwaySummaries,
} from "@/lib/clinical-rules/pathway-view-model";
import type { ClinicalRuleSnapshot } from "@/lib/clinical-rules/schema";
import { PathwayViewer, type CaseOverlay, type GovernanceMeta } from "./PathwayViewer";

/**
 * Pathway viewer with a governed-view selector.
 *
 * Used by Rule Studio and Case Review, which already hold the whole snapshot,
 * so each view is built on demand rather than serialised twelve times. The
 * Guidelines routes build a single view server-side instead, keeping their
 * payload small.
 */
export function PathwayWorkspace({
  snapshot,
  governance,
  caseOverlay,
  initialViewKey,
  className,
}: {
  snapshot: ClinicalRuleSnapshot;
  governance?: GovernanceMeta;
  caseOverlay?: CaseOverlay;
  initialViewKey?: string;
  className?: string;
}) {
  const summaries = useMemo(() => listPathwaySummaries(snapshot), [snapshot]);
  const [viewKey, setViewKey] = useState(
    () => initialViewKey ?? summaries[0]?.key ?? "master"
  );

  const graph = useMemo(() => {
    try {
      return buildPathwayGraph(snapshot, viewKey);
    } catch {
      return buildPathwayGraph(snapshot, summaries[0].key);
    }
  }, [snapshot, viewKey, summaries]);

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Governed pathway views">
        {summaries.map((summary) => (
          <button
            key={summary.key}
            role="tab"
            aria-selected={summary.key === graph.key}
            onClick={() => setViewKey(summary.key)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              summary.key === graph.key
                ? "border-accent-color bg-accent-color text-white"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {summary.title}
            <span
              className={cn(
                "ml-1.5 tabular-nums",
                summary.key === graph.key ? "text-white/70" : "text-muted-foreground/70"
              )}
            >
              {summary.decisions}
            </span>
          </button>
        ))}
      </div>

      <PathwayViewer
        key={graph.key}
        graph={graph}
        governance={governance}
        caseOverlay={caseOverlay}
        initialCollapsed={graph.viewType === "MASTER"}
        className="min-h-[640px] flex-1"
      />
    </div>
  );
}
