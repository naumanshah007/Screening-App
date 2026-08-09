import { cn } from "@/lib/utils";

/**
 * Compact inline trend line.
 *
 * Rendered ONLY where a genuine historical series exists. There is deliberately
 * no "flat line" fallback: a metric with no history shows no sparkline at all,
 * because an invented shape would read as evidence.
 */
export function MiniSparkline({
  values,
  tone = "brand",
  className,
  ariaLabel,
}: {
  values: number[];
  tone?: "brand" | "warn" | "danger";
  className?: string;
  ariaLabel: string;
}) {
  if (values.length < 2) return null;

  const width = 96;
  const height = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    // Inset by 2px top and bottom so the stroke is never clipped.
    const y = height - 2 - ((value - min) / span) * (height - 4);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  const stroke =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-500"
        : "text-brand-600";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", stroke, className)}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <path d={area} fill="currentColor" opacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
