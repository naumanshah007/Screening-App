"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";

import { cn } from "@/lib/utils";

export const DASHBOARD_RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
] as const;

/**
 * Command-centre header.
 *
 * Only controls that are genuinely wired appear here. The date range writes to
 * the URL and is read server-side, so changing it re-queries real data. Controls
 * that would merely look functional (global search, notifications) are
 * deliberately omitted rather than rendered as convincing dead UI.
 */
export function DashboardTopBar({
  title,
  subtitle,
  activeDays,
}: {
  title: string;
  subtitle: string;
  activeDays: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setRange(days: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", String(days));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">
          Command Centre
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </div>

      <div
        className="flex items-center gap-1 rounded-lg border border-border bg-card p-1"
        role="group"
        aria-label="Dashboard date range"
      >
        <Calendar className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        {DASHBOARD_RANGES.map((range) => (
          <button
            key={range.days}
            type="button"
            onClick={() => setRange(range.days)}
            aria-pressed={activeDays === range.days}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeDays === range.days
                ? "bg-brand-600 text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {range.days}D
          </button>
        ))}
      </div>
    </div>
  );
}
