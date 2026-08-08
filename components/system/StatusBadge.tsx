import { cn } from "@/lib/utils";

/**
 * The one badge in the product.
 *
 * `tone` is the visual weight; it never carries meaning on its own. Every badge
 * renders its own text, so status is legible without colour — required for the
 * clinical-safety rule that colour is never the sole signal.
 */
export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warn"
  | "danger"
  | "info"
  /** Reserved for canonical/shadow ruleset context, so it never reads as an operative state. */
  | "canonical";

const TONE: Record<BadgeTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  brand: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-300",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  warn: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  canonical:
    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
};

export function StatusBadge({
  children,
  tone = "neutral",
  size = "md",
  dot = false,
  mono = false,
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  size?: "sm" | "md";
  /** Leading status dot. Decorative only — the label still carries the meaning. */
  dot?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[0.6875rem]" : "px-2 py-0.5 text-xs",
        mono && "font-mono",
        TONE[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {children}
    </span>
  );
}

/**
 * Maps a stored clinical risk level to a badge tone.
 * Only the four levels that exist on BatchReviewItem.riskLevel.
 */
export function riskTone(riskLevel: string): BadgeTone {
  switch (riskLevel) {
    case "URGENT":
      return "danger";
    case "HIGH":
      return "warn";
    case "MEDIUM":
      return "info";
    case "LOW":
      return "success";
    default:
      return "neutral";
  }
}

/** Maps a reviewer disposition to a badge tone. */
export function dispositionTone(disposition: string): BadgeTone {
  switch (disposition) {
    case "ACCEPTED":
      return "brand";
    case "REJECTED":
      return "danger";
    case "NEEDS_INFO":
      return "warn";
    default:
      return "neutral";
  }
}
