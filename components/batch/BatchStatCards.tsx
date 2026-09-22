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
  const referralCount = result.results.filter(
    (r) => r.status === "success" && r.decision.referralRequired
  ).length;

  // "Urgent" has to mean the same thing here as it does in the Review Queue and
  // the Command Centre, which count urgent risk OR a P1 referral priority.
  // Counting risk level alone made this tile disagree with the queue the
  // operator reaches two clicks later: a Test of Cure case carrying HIGH risk
  // with a P1 referral was urgent there and not urgent here, and neither screen
  // said which sense of the word it meant.
  // P1_HSC, which the queue predicate also accepts, belongs to the booking
  // rules in lib/cases and cannot appear on a ClinicalDecision — the engine's
  // ReferralPriority is P1..P4. Matching it here would be unreachable code.
  const urgentClinicalCount = result.results.filter(
    (r) =>
      r.status === "success" &&
      (r.decision.riskLevel === "URGENT" || r.decision.referralPriority === "P1")
  ).length;
  const highNotUrgentCount = result.results.filter(
    (r) =>
      r.status === "success" &&
      r.decision.riskLevel === "HIGH" &&
      r.decision.referralPriority !== "P1"
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
        value={urgentClinicalCount + highNotUrgentCount}
        caption={`${urgentClinicalCount} urgent (risk or P1), ${highNotUrgentCount} high`}
        tone={urgentClinicalCount > 0 ? "danger" : highNotUrgentCount > 0 ? "warn" : "success"}
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
