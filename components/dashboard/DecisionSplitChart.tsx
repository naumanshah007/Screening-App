"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { DecisionSplit } from "@/lib/decisions/dashboard-metrics";

const SEGMENTS = [
  { key: "accepted", label: "Accepted", colour: "#0d9488" },
  { key: "rejected", label: "Rejected", colour: "#dc2626" },
  { key: "needsInfo", label: "Needs information", colour: "#f59e0b" },
] as const;

/**
 * Reviewer disposition split for completed decisions.
 *
 * Reads only stored dispositions. The acceptance rate is accepted / total and
 * is suppressed entirely when nothing has been completed, rather than shown
 * as 0%, which would read as "everything was rejected".
 */
export function DecisionSplitChart({ split }: { split: DecisionSplit }) {
  const values: Record<string, number> = {
    accepted: split.accepted,
    rejected: split.rejected,
    needsInfo: split.needsInfo,
  };
  const total = split.accepted + split.rejected + split.needsInfo;

  if (total === 0) {
    return (
      <div className="flex h-[190px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No completed decisions yet.
      </div>
    );
  }

  const data = SEGMENTS.map((segment) => ({
    name: segment.label,
    value: values[segment.key] ?? 0,
    colour: segment.colour,
  })).filter((entry) => entry.value > 0);

  const acceptanceRate = Math.round((split.accepted / total) * 1000) / 10;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-[170px] w-[170px] flex-shrink-0" role="img" aria-label={`Decision split: ${SEGMENTS.map((s) => `${s.label} ${values[s.key] ?? 0}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={54}
              outerRadius={82}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.colour} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-card)",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-foreground">{total}</span>
          <span className="text-[11px] text-muted-foreground">Total</span>
        </div>
      </div>

      <dl className="min-w-[190px] flex-1 space-y-2">
        {SEGMENTS.map((segment) => {
          const value = values[segment.key] ?? 0;
          const percent = Math.round((value / total) * 1000) / 10;
          return (
            <div key={segment.key} className="flex items-center justify-between gap-3 text-sm">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: segment.colour }}
                  aria-hidden
                />
                {segment.label}
              </dt>
              <dd className="tabular-nums font-medium text-foreground">
                {value} <span className="text-muted-foreground">({percent}%)</span>
              </dd>
            </div>
          );
        })}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-2 text-sm">
          <dt className="text-muted-foreground">Acceptance rate</dt>
          <dd className="rounded-md bg-brand-50 px-2 py-0.5 text-sm font-semibold tabular-nums text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            {acceptanceRate}%
          </dd>
        </div>
      </dl>
    </div>
  );
}
