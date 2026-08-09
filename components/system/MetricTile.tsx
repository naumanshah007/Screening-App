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
  const hasSeries = Boolean(series && series.length >= 2);

  /*
   * Every element sits in a fixed-height lane.
   *
   * This matters more than it looks: labels differ in length ("Pending review"
   * vs "Clinician review required"), so without a reserved label height the
   * long ones wrap and shove their number down a line — and a row of tiles ends
   * up with its numbers on two or three different baselines. The label lane is
   * exactly two lines tall and clamped, the caption is a single truncated line,
   * and the sparkline lane is reserved whether or not a series exists, so tiles
   * with and without history still line up along the bottom.
   */
  const body = (
    <>
      <div className="flex items-start gap-2.5">
        {icon && (
          <span
            className={cn(
              "flex flex-shrink-0 items-center justify-center rounded-lg",
              size === "sm" ? "h-7 w-7" : "h-8 w-8",
              ICON_TONE[tone]
            )}
            aria-hidden
          >
            {icon}
          </span>
        )}
        <p
          className={cn(
            "min-w-0 flex-1 font-semibold uppercase tracking-wider text-muted-foreground",
            "line-clamp-2 text-[0.6875rem] leading-tight",
            size === "sm" ? "h-[1.75rem]" : "h-[1.75rem]"
          )}
          title={label}
        >
          {label}
        </p>
      </div>

      <p
        className={cn(
          "font-semibold leading-none tracking-tight text-foreground tabular-nums",
          size === "sm" ? "mt-2 text-xl" : "mt-2.5 text-[1.75rem]"
        )}
      >
        {value}
      </p>

      {caption && (
        <p className="mt-1.5 truncate text-xs leading-tight text-muted-foreground" title={caption}>
          {caption}
        </p>
      )}

      {size !== "sm" && (
        // Full-bleed trend band flush with the card's bottom edge. The lane is
        // reserved even with no series, so a row of tiles keeps one baseline.
        <div className="-mx-4 -mb-4 mt-auto h-8 overflow-hidden">
          {hasSeries && series ? (
            <MiniSparkline
              values={series}
              tone={tone === "neutral" || tone === "success" ? "brand" : tone}
              ariaLabel={ariaSparklineLabel ?? `${label} daily trend`}
              className="block h-8 w-full"
            />
          ) : null}
        </div>
      )}
    </>
  );

  const shell = cn(
    "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-shadow",
    size === "sm" ? "min-h-[86px] p-3.5" : "min-h-[136px] p-4",
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
