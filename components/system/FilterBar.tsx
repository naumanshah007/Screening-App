"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Horizontal filter row. Sticks below the page header on long worklists so the
 * active filter is never scrolled out of view.
 */
export function FilterBar({
  children,
  sticky = false,
  className,
  label = "Filters",
}: {
  children: React.ReactNode;
  sticky?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex flex-wrap items-center gap-2",
        sticky && "sticky top-0 z-20 -mx-1 bg-background/85 px-1 py-2 backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * A single filter chip.
 *
 * `count` is rendered only when a real count is supplied — an undefined count
 * shows no badge rather than a zero that could be mistaken for "none match".
 */
export function FilterPill({
  label,
  active,
  count,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
          : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
        className
      )}
    >
      {label}
      {typeof count === "number" && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums",
            active ? "bg-brand-100 text-brand-800 dark:bg-brand-800 dark:text-brand-100" : "bg-muted"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * A segmented day-range control that writes to the URL, so the server
 * re-queries real data rather than filtering a client-side copy.
 *
 * Extracted from `DashboardTopBar` so every time-scoped screen shares one
 * control and one query-parameter contract.
 */
export function RangeControl({
  ranges = [7, 14, 30],
  activeDays,
  param = "days",
  label = "Date range",
  className,
}: {
  ranges?: number[];
  activeDays: number;
  param?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setRange(days: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(param, String(days));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      className={cn("flex items-center gap-1 rounded-lg border border-border bg-card p-1", className)}
      role="group"
      aria-label={label}
    >
      {ranges.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => setRange(days)}
          aria-pressed={activeDays === days}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activeDays === days
              ? "bg-brand-600 text-white"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {days}D
        </button>
      ))}
    </div>
  );
}
