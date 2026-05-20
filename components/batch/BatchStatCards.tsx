"use client";

import { StatCard } from "@/components/ui/card";
import { Users, AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import type { BatchProcessingResult } from "@/lib/batch/types";

function formatMs(ms: number): string {
  if (ms < 1)    return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

interface BatchStatCardsProps {
  result: BatchProcessingResult;
}

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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Processed"
        value={result.processedCount}
        subtext={result.errorCount > 0 ? `${result.errorCount} error(s)` : "All successful"}
        variant={result.errorCount > 0 ? "warning" : "success"}
        icon={<Users className="h-5 w-5" />}
      />
      <StatCard
        label="Urgent / High Risk"
        value={riskCounts.URGENT + riskCounts.HIGH}
        subtext={`${riskCounts.URGENT} urgent, ${riskCounts.HIGH} high`}
        variant={riskCounts.URGENT > 0 ? "urgent" : riskCounts.HIGH > 0 ? "warning" : "success"}
        icon={<AlertTriangle className="h-5 w-5" />}
      />
      <StatCard
        label="Referrals"
        value={referralCount}
        subtext={`of ${result.processedCount} cases`}
        variant={referralCount > 0 ? "info" : "default"}
        icon={<ShieldCheck className="h-5 w-5" />}
      />
      <StatCard
        label="Processing Time"
        value={formatMs(result.totalTimeMs)}
        subtext={`~${formatMs(result.totalTimeMs / Math.max(result.processedCount, 1))} per case`}
        variant="default"
        icon={<Clock className="h-5 w-5" />}
      />
    </div>
  );
}
