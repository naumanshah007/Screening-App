/**
 * The CerviGrade design system.
 *
 * Screens compose from this module only. If a screen needs something that is
 * not here, add it here first rather than styling it locally — page-local
 * variants are what made the product feel like separate applications.
 */

export { PageShell, PageSection } from "./PageShell";
export { PageHeader, HeaderMeta } from "./PageHeader";
export { Panel, PanelInset } from "./Panel";
export { StatusBadge, riskTone, dispositionTone } from "./StatusBadge";
export type { BadgeTone } from "./StatusBadge";
export { MetricTile, MetricGrid } from "./MetricTile";
export type { MetricTone } from "./MetricTile";
export { FilterBar, FilterPill, RangeControl } from "./FilterBar";
export { DataTable, RowActions, CellStack } from "./DataTable";
export type { Column } from "./DataTable";
export { Timeline, StepTimeline } from "./Timeline";
export type { TimelineEvent, TimelineTone, StepState } from "./Timeline";
export { DetailDrawer, DrawerSection, DrawerDisclosure, DrawerFields } from "./DetailDrawer";
