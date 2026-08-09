import Link from "next/link";

import { cn } from "@/lib/utils";

export type FunnelStage = {
  label: string;
  value: number;
  href?: string;
};

/**
 * Intake → decision conversion, from real counts.
 *
 * Percentages are expressed against the FIRST stage, and the first stage is
 * always 100% of itself. Where the first stage is zero, no percentages are
 * shown at all rather than rendering 0% or NaN across the row.
 */
export function WorkflowFunnel({
  stages,
  scopeLabel,
}: {
  stages: FunnelStage[];
  scopeLabel: string;
}) {
  const base = stages[0]?.value ?? 0;
  const max = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <div>
      <div className="flex items-center gap-2">
        {stages.map((stage, index) => {
          // Width conveys magnitude; a floor keeps small non-zero stages legible.
          const ratio = max === 0 ? 0 : stage.value / max;
          const flex = 0.55 + ratio * 0.45;
          const content = (
            <>
              <span className="text-lg font-semibold tabular-nums">{stage.value}</span>
              <span className="mt-0.5 block text-[11px] font-medium leading-tight opacity-90">
                {stage.label}
              </span>
            </>
          );
          const tint = [
            "bg-brand-600 text-white",
            "bg-brand-500 text-white",
            "bg-brand-400 text-white",
            "bg-brand-200 text-brand-900",
          ][index] ?? "bg-muted text-foreground";

          return (
            <div key={stage.label} style={{ flexGrow: flex }} className="min-w-0 flex-1">
              {stage.href ? (
                <Link
                  href={stage.href}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 text-center transition-opacity hover:opacity-90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    tint
                  )}
                >
                  {content}
                </Link>
              ) : (
                <div className={cn("rounded-lg px-3 py-2.5 text-center", tint)}>{content}</div>
              )}
              <p className="mt-1.5 text-center text-[11px] tabular-nums text-muted-foreground">
                {base > 0 ? `${Math.round((stage.value / base) * 100)}%` : "—"}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Conversion from intake to exported evidence · {scopeLabel}
      </p>
    </div>
  );
}
