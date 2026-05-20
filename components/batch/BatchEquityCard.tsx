"use client";

/**
 * Equity breakdown card — ethnicity disaggregation of batch outcomes.
 *
 * In Aotearoa NZ this is non-negotiable: Te Whatu Ora and NCSP expect
 * equity outcomes to be visible from day one, not bolted on later.
 *
 * Buckets ethnicity strings into the NZ Level-1 priority order:
 *   Māori → Pacific → Asian → European → MELAA/Other → Unknown
 */

import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BatchCaseResult } from "@/lib/batch/types";

interface BatchEquityCardProps {
  results: BatchCaseResult[];
}

type Bucket = "Māori" | "Pacific" | "Asian" | "European" | "MELAA / Other" | "Unknown";

function bucketEthnicity(raw?: string | null): Bucket {
  if (!raw) return "Unknown";
  const s = raw.trim().toUpperCase();

  // NZ Level-2 numeric codes (priority ordered: Māori > Pacific > Asian > Euro)
  if (s.startsWith("21") || s === "2" || s.includes("MAORI") || s.includes("MĀORI")) return "Māori";
  if (s.startsWith("3")  || s.includes("PACIFIC") || s.includes("PASIFIKA")) return "Pacific";
  if (s.startsWith("4")  || s.includes("ASIAN")) return "Asian";
  if (s.startsWith("1")  || s.includes("EUROPEAN") || s.includes("NZ EUROPEAN") || s === "PĀKEHĀ" || s.includes("PAKEHA")) return "European";
  if (s.startsWith("5")  || s.includes("MELAA") || s.includes("OTHER")) return "MELAA / Other";
  return "Unknown";
}

const BUCKET_ORDER: Bucket[] = ["Māori", "Pacific", "Asian", "European", "MELAA / Other", "Unknown"];

const BUCKET_COLOURS: Record<Bucket, string> = {
  "Māori":         "bg-rose-500",
  "Pacific":       "bg-amber-500",
  "Asian":         "bg-sky-500",
  "European":      "bg-violet-500",
  "MELAA / Other": "bg-emerald-500",
  "Unknown":       "bg-muted-foreground/40",
};

export function BatchEquityCard({ results }: BatchEquityCardProps) {
  const total = results.length;
  if (total === 0) return null;

  // Tally
  const counts: Record<Bucket, number> = {
    "Māori": 0, "Pacific": 0, "Asian": 0, "European": 0, "MELAA / Other": 0, "Unknown": 0,
  };
  // Urgent/High counts per bucket (the equity question that matters)
  const urgent: Record<Bucket, number> = {
    "Māori": 0, "Pacific": 0, "Asian": 0, "European": 0, "MELAA / Other": 0, "Unknown": 0,
  };

  for (const r of results) {
    const b = bucketEthnicity(r.case.ethnicityPrimary as string | undefined);
    counts[b] += 1;
    if (r.status === "success" && (r.decision.riskLevel === "URGENT" || r.decision.riskLevel === "HIGH")) {
      urgent[b] += 1;
    }
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-semibold text-foreground">Equity — Outcomes by Ethnicity</div>
          </div>
          <span className="text-xs text-muted-foreground">{total} processed</span>
        </div>

        {/* Stacked horizontal bar */}
        <div className="h-2 w-full rounded-full overflow-hidden flex bg-muted">
          {BUCKET_ORDER.map((b) => {
            const pct = (counts[b] / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={b}
                className={cn("h-full transition-all", BUCKET_COLOURS[b])}
                style={{ width: `${pct}%` }}
                title={`${b}: ${counts[b]} (${pct.toFixed(0)}%)`}
              />
            );
          })}
        </div>

        {/* Legend / counts */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
          {BUCKET_ORDER.filter((b) => counts[b] > 0).map((b) => {
            const pct = (counts[b] / total) * 100;
            const u   = urgent[b];
            return (
              <div key={b} className="flex items-center gap-2 text-xs min-w-0">
                <span className={cn("h-2 w-2 rounded-full flex-shrink-0", BUCKET_COLOURS[b])} />
                <span className="text-muted-foreground flex-shrink-0">{b}</span>
                <span className="text-foreground font-semibold tabular-nums">{counts[b]}</span>
                <span className="text-muted-foreground/70 tabular-nums">({pct.toFixed(0)}%)</span>
                {u > 0 && (
                  <span className="ml-auto text-red-600 dark:text-red-400 text-xs font-medium whitespace-nowrap">
                    {u} urgent
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground/80 pt-1 border-t border-border">
          Ethnicity bucketed to NZ Level-1 priority order (Māori → Pacific → Asian → European → MELAA/Other → Unknown).
        </p>
      </CardContent>
    </Card>
  );
}
