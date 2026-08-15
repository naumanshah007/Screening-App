import { cn } from "@/lib/utils";
import type { UsageTrendPoint } from "@/lib/usage/usage-activity";

const segments = [
  { key: "firstTriages", label: "First triage", className: "bg-brand-600" },
  { key: "updatedResults", label: "Updated result", className: "bg-cyan-500" },
  { key: "manualRegrades", label: "Manual re-evaluation", className: "bg-violet-500" },
  { key: "duplicatesSuppressed", label: "Duplicate not reprocessed", className: "bg-amber-500" },
] as const;

export function UsageActivityChart({ points }: { points: UsageTrendPoint[] }) {
  const maximum = Math.max(1, ...points.map((point) => point.total));
  if (points.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No effective activity occurred in this date range.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {segments.map((segment) => (
          <span key={segment.key} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-sm", segment.className)} aria-hidden />
            {segment.label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto pb-1">
        <div
          className="flex h-52 min-w-full items-end gap-2 border-b border-border px-1"
          style={{ width: `${Math.max(100, points.length * 48)}px` }}
          role="img"
          aria-label="Effective activity by day"
        >
          {points.map((point) => (
            <div key={point.date} className="flex h-full min-w-8 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[0.625rem] font-medium tabular-nums text-muted-foreground">
                {point.total}
              </span>
              <div
                className="flex w-full max-w-8 flex-col-reverse overflow-hidden rounded-t-md bg-muted/50"
                style={{ height: `${Math.max(4, (point.total / maximum) * 156)}px` }}
                title={`${point.date}: ${point.total} effective events`}
              >
                {segments.map((segment) => {
                  const value = point[segment.key];
                  if (value === 0) return null;
                  return (
                    <span
                      key={segment.key}
                      className={segment.className}
                      style={{ height: `${(value / point.total) * 100}%` }}
                      title={`${segment.label}: ${value}`}
                    />
                  );
                })}
              </div>
              <time className="whitespace-nowrap text-[0.625rem] text-muted-foreground">
                {new Date(`${point.date}T12:00:00Z`).toLocaleDateString("en-NZ", {
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                })}
              </time>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
