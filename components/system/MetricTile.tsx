import Link from "next/link";

import { cn } from "@/lib/utils";
import { MiniSparkline } from "@/components/dashboard/MiniSparkline";

export type MetricTone = "brand" | "warn" | "danger" | "success" | "neutral";

const ICON_TONE: Record<MetricTone, string> = {
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "bg-destructive/10 text-destructive",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  neutral: "bg-muted text-muted-foreground",
};

/**
 * The one metric tile in the product. Generalises `DashboardKpiCard` so review,
 * decisions, batch and analytics all present numbers identically.
 *
 * `series` stays optional by design: a metric with no stored history renders
 * with no sparkline rather than a fabricated trend. Do not pass a synthesised
 * or padded series to make a tile look complete.
 */
export function MetricTile({
  label,
  value,
  caption,
  icon,
  tone = "brand",
  series,
  href,
  size = "md",
  ariaSparklineLabel,
  className,
}: {
  label: string;
  value: string | number;
  /** What the number actually counts. Always shown, so a tile is never ambiguous. */
  caption?: string;
  icon?: React.ReactNode;
  tone?: MetricTone;
  series?: number[];
  href?: string;
  /** "sm" for dense summary strips above a table; "md" for headline grids. */
  size?: "sm" | "md";
  ariaSparklineLabel?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "font-semibold leading-none tracking-tight text-foreground tabular-nums",
              size === "sm" ? "mt-1.5 text-xl" : "mt-2 text-3xl"
            )}
          >
            {value}
          </p>
        </div>
        {icon && (
          <span
            className={cn(
              "flex flex-shrink-0 items-center justify-center rounded-lg",
              size === "sm" ? "h-7 w-7" : "h-9 w-9",
              ICON_TONE[tone]
            )}
            aria-hidden
          >
            {icon}
          </span>
        )}
      </div>

      {(caption || (series && series.length >= 2)) && (
        <div className="mt-3 flex items-end justify-between gap-3">
          {caption ? (
            <p className="text-xs leading-snug text-muted-foreground">{caption}</p>
          ) : (
            <span />
          )}
          {series && series.length >= 2 ? (
            <MiniSparkline
              values={series}
              tone={tone === "neutral" || tone === "success" ? "brand" : tone}
              ariaLabel={ariaSparklineLabel ?? `${label} daily trend`}
              className="flex-shrink-0"
            />
          ) : null}
        </div>
      )}
    </>
  );

  const shell = cn(
    "group relative flex flex-col justify-between rounded-xl border border-border bg-card shadow-card transition-shadow",
    size === "sm" ? "min-h-[92px] p-3.5" : "min-h-[124px] p-4",
    className
  );

  if (!href) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        shell,
        "hover:border-brand-200 hover:shadow-raised",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      {body}
    </Link>
  );
}

/** Responsive grid for a row of MetricTiles. */
export function MetricGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        columns === 5 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
        columns === 6 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
        className
      )}
    >
      {children}
    </div>
  );
}
