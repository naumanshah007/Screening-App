"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { QueueTrendPoint } from "@/lib/decisions/dashboard-insights";
import { cn } from "@/lib/utils";

const SERIES = [
  { key: "totalInQueue", label: "Total in queue", colour: "#0d9488" },
  { key: "clinicianReviewRequired", label: "Clinician review required", colour: "#2e5f9a" },
  { key: "urgentPriority", label: "Urgent priority", colour: "#dc2626" },
] as const;

function formatDay(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

/**
 * Daily pending-queue composition.
 *
 * Every point is a real count of stored items bucketed by creation day. A day
 * with no intake shows zero because zero happened — no interpolation.
 */
export function QueueTrendChart({
  data,
  availableRanges = [7, 30],
  onRangeChange,
  activeRange,
}: {
  data: QueueTrendPoint[];
  availableRanges?: number[];
  onRangeChange?: (days: number) => void;
  activeRange?: number;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No intake recorded in this period.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-3">
          {SERIES.map((series) => {
            const isHidden = hidden.has(series.key);
            return (
              <li key={series.key}>
                <button
                  type="button"
                  onClick={() => toggle(series.key)}
                  aria-pressed={!isHidden}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-1 py-0.5 text-xs transition-opacity",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isHidden ? "opacity-40" : "opacity-100"
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: series.colour }}
                    aria-hidden
                  />
                  <span className="text-muted-foreground">{series.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {onRangeChange && (
          <div className="flex items-center gap-1" role="group" aria-label="Trend range">
            {availableRanges.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onRangeChange(days)}
                aria-pressed={activeRange === days}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeRange === days
                    ? "border-brand-300 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {days}D
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-[220px]" role="img" aria-label="Daily review queue composition">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={1}
          initialDimension={{ width: 720, height: 220 }}
        >
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              labelFormatter={(value) => formatDay(String(value))}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
                fontSize: 12,
              }}
            />
            {SERIES.filter((series) => !hidden.has(series.key)).map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.colour}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
