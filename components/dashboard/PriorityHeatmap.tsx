import {
  RISK_LEVELS,
  type PriorityDistribution,
  type RiskLevel,
} from "@/lib/decisions/dashboard-insights";
import { cn } from "@/lib/utils";

const PERIOD_LABEL: Record<PriorityDistribution["period"], string> = {
  today: "Today",
  week: "This week",
  month: "This month",
};

const LEVEL_LABEL: Record<RiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

/**
 * Intake volume by stored clinical risk level.
 *
 * Uses BatchReviewItem.riskLevel, the real stored field — not a priority code.
 * Cell shading is scaled within the table so a busy month does not wash out a
 * quiet day; the number is always shown, so colour is never the only signal.
 */
export function PriorityHeatmap({ distribution }: { distribution: PriorityDistribution[] }) {
  const max = Math.max(
    1,
    ...distribution.flatMap((row) => RISK_LEVELS.map((level) => row.counts[level]))
  );

  function cellTone(level: RiskLevel, value: number) {
    if (value === 0) return "bg-muted/40 text-muted-foreground";
    const intensity = value / max;
    const step = intensity > 0.66 ? 3 : intensity > 0.33 ? 2 : 1;
    const palette: Record<RiskLevel, string[]> = {
      LOW: ["bg-emerald-50 text-emerald-800", "bg-emerald-100 text-emerald-900", "bg-emerald-200 text-emerald-900"],
      MEDIUM: ["bg-sky-50 text-sky-800", "bg-sky-100 text-sky-900", "bg-sky-200 text-sky-900"],
      HIGH: ["bg-amber-50 text-amber-800", "bg-amber-100 text-amber-900", "bg-amber-200 text-amber-900"],
      URGENT: ["bg-red-50 text-red-800", "bg-red-100 text-red-900", "bg-red-200 text-red-900"],
    };
    return palette[level][step - 1];
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] border-separate border-spacing-1 text-sm">
        <caption className="sr-only">Intake volume by clinical risk level and period</caption>
        <thead>
          <tr>
            <th scope="col" className="w-24 text-left text-[11px] font-medium text-muted-foreground">
              <span className="sr-only">Period</span>
            </th>
            {RISK_LEVELS.map((level) => (
              <th
                key={level}
                scope="col"
                className="px-1 text-center text-[11px] font-medium text-muted-foreground"
              >
                {LEVEL_LABEL[level]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {distribution.map((row) => (
            <tr key={row.period}>
              <th
                scope="row"
                className="whitespace-nowrap pr-2 text-left text-xs font-medium text-muted-foreground"
              >
                {PERIOD_LABEL[row.period]}
              </th>
              {RISK_LEVELS.map((level) => (
                <td key={level} className="p-0">
                  <div
                    className={cn(
                      "rounded-md py-2 text-center text-sm font-semibold tabular-nums",
                      cellTone(level, row.counts[level])
                    )}
                    title={`${PERIOD_LABEL[row.period]} · ${LEVEL_LABEL[level]}: ${row.counts[level]}`}
                  >
                    {row.counts[level]}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
