"use client";

import { Users, AlertTriangle, ShieldCheck, Clock } from "lucide-react";

import { MetricTile, MetricGrid } from "@/components/system";
import type { BatchProcessingResult } from "@/lib/batch/types";

function formatMs(ms: number): string {
  if (ms < 1)    return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

interface BatchStatCardsProps {
  result: BatchProcessingResult;
}

/**
 * Run summary for a completed batch.
 *
 * Every figure is counted from the run's own results — no series is passed to
 * MetricTile because a single run has no daily history to trend.
 */
export function BatchStatCards({ result }: BatchStatCardsProps) {
  const riskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
  for (const r of result.results) {
    if (r.status === "success" && r.decision.riskLevel) {
      const level = r.decision.riskLevel as keyof typeof riskCounts;
      if (level in riskCounts) riskCounts[level]++;
    }
  }

  const referralCount = result.results.filter(
    (r) => r.status === "success" && r.decision.referralRequired
  ).length;

  return (
    <MetricGrid columns={4}>
      <MetricTile
        label="Processed"
        value={result.processedCount}
        caption={result.errorCount > 0 ? `${result.errorCount} error(s)` : "All successful"}
        tone={result.errorCount > 0 ? "warn" : "success"}
        icon={<Users className="h-4.5 w-4.5" />}
      />
      <MetricTile
        label="Urgent / High risk"
        value={riskCounts.URGENT + riskCounts.HIGH}
        caption={`${riskCounts.URGENT} urgent, ${riskCounts.HIGH} high`}
        tone={riskCounts.URGENT > 0 ? "danger" : riskCounts.HIGH > 0 ? "warn" : "success"}
        icon={<AlertTriangle className="h-4.5 w-4.5" />}
      />
      <MetricTile
        label="Referrals"
        value={referralCount}
        caption={`of ${result.processedCount} cases`}
        tone={referralCount > 0 ? "brand" : "neutral"}
        icon={<ShieldCheck className="h-4.5 w-4.5" />}
      />
      <MetricTile
        label="Processing time"
        value={formatMs(result.totalTimeMs)}
        caption={`~${formatMs(result.totalTimeMs / Math.max(result.processedCount, 1))} per case`}
        tone="neutral"
        icon={<Clock className="h-4.5 w-4.5" />}
      />
    </MetricGrid>
  );
}
