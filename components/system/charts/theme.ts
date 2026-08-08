/**
 * Shared recharts theme.
 *
 * Every chart in the product imports from here so axes, grids, tooltips and
 * series colours are identical. Chart colours are literal hex values rather
 * than CSS variables because recharts writes them into SVG attributes, where
 * `var()` does not resolve in all renderers.
 */

/** Categorical series palette, in the order series should be assigned. */
export const CHART_SERIES_COLOURS = [
  "#0d9488", // brand teal
  "#2e5f9a", // navy
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#65a30d", // lime
] as const;

/**
 * Semantic colours for clinical state.
 *
 * These must match the `StatusBadge` tones so a risk level looks the same in a
 * chart as it does in a table. Colour is never the only signal — charts using
 * these must also label the series.
 */
export const CHART_SEMANTIC_COLOURS = {
  urgent: "#dc2626",
  high: "#d97706",
  medium: "#0284c7",
  low: "#059669",
  neutral: "#94a3b8",
} as const;

export const CHART_GRID = {
  strokeDasharray: "3 3",
  stroke: "currentColor",
  className: "text-border",
  vertical: false,
} as const;

export const CHART_AXIS = {
  tick: { fontSize: 11 },
  stroke: "currentColor",
  className: "text-muted-foreground",
  tickLine: false,
  axisLine: false,
} as const;

/**
 * Tooltip chrome.
 *
 * References the base `--border` / `--card` custom properties, NOT the
 * `--color-*` theme tokens: `@theme inline` inlines its tokens into utility
 * classes and never emits them as custom properties, so `var(--color-card)`
 * resolves to nothing here and the tooltip silently falls back to the recharts
 * default styling.
 */
export const CHART_TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  boxShadow: "0 4px 16px -2px rgb(13 27 42 / 0.08)",
  fontSize: 12,
} as const;

/** Standard chart body heights, so panels line up across a grid. */
export const CHART_HEIGHT = {
  sm: 160,
  md: 220,
  lg: 280,
} as const;

/** Consistent NZ short-date formatting for time axes. */
export function formatChartDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}
