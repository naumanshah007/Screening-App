import Link from "next/link";

import { cn } from "@/lib/utils";
import { MiniSparkline } from "./MiniSparkline";

export type KpiTone = "brand" | "warn" | "danger" | "neutral";

const ICON_TONE: Record<KpiTone, string> = {
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

/**
 * A single command-centre metric.
 *
 * `series` is optional by design. Metrics without a stored historical series
 * render cleanly with no sparkline and no trend badge rather than a fabricated
 * comparison — see docs note in MiniSparkline.
 */
export function DashboardKpiCard({
  label,
  value,
  caption,
  icon,
  tone = "brand",
  series,
  href,
  ariaSparklineLabel,
}: {
  label: string;
  value: string | number;
  /** What the number actually counts. Always shown, so a card is never ambiguous. */
  caption: string;
  icon: React.ReactNode;
  tone?: KpiTone;
  series?: number[];
  href?: string;
  ariaSparklineLabel?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
            ICON_TONE[tone]
          )}
          aria-hidden
        >
          {icon}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-xs leading-snug text-muted-foreground">{caption}</p>
        {series && series.length >= 2 ? (
          <MiniSparkline
            values={series}
            tone={tone === "neutral" ? "brand" : tone}
            ariaLabel={ariaSparklineLabel ?? `${label} daily trend`}
            className="flex-shrink-0"
          />
        ) : null}
      </div>
    </>
  );

  const shell =
    "group relative flex min-h-[124px] flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,30,50,0.04)] transition-shadow";

  if (!href) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        shell,
        "hover:shadow-[0_4px_16px_rgba(15,30,50,0.08)] hover:border-brand-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      {body}
    </Link>
  );
}
