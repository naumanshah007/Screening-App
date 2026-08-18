import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  GitBranch,
  Layers,
  Route,
  Stethoscope,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

import type { GraphNodeType } from "@/lib/clinical-rules/schema";
import type { PathwayTone } from "@/lib/clinical-rules/pathway-view-model";

export type ToneStyle = {
  bg: string;
  border: string;
  accent: string;
  fg: string;
  icon: LucideIcon;
  /** Legend wording. */
  legend: string;
};

/**
 * Tone -> CSS custom properties declared in `app/globals.css`.
 * Using variables (not Tailwind `dark:`) because the app switches theme with
 * `[data-theme="dark"]`, which Tailwind's default dark variant does not track.
 */
export const TONE_STYLE: Record<PathwayTone, ToneStyle> = {
  ENTRY: {
    bg: "var(--pw-entry-bg)",
    border: "var(--pw-entry-border)",
    accent: "var(--pw-entry-accent)",
    fg: "var(--pw-entry-fg)",
    icon: Route,
    legend: "Pathway entry / section",
  },
  DECISION: {
    bg: "var(--pw-decision-bg)",
    border: "var(--pw-decision-border)",
    accent: "var(--pw-decision-accent)",
    fg: "var(--pw-decision-fg)",
    icon: GitBranch,
    legend: "Decision — governed condition",
  },
  ROUTINE: {
    bg: "var(--pw-routine-bg)",
    border: "var(--pw-routine-border)",
    accent: "var(--pw-routine-accent)",
    fg: "var(--pw-routine-fg)",
    icon: CheckCircle2,
    legend: "Outcome — routine screening or discharge",
  },
  MONITOR: {
    bg: "var(--pw-monitor-bg)",
    border: "var(--pw-monitor-border)",
    accent: "var(--pw-monitor-accent)",
    fg: "var(--pw-monitor-fg)",
    icon: CalendarClock,
    legend: "Outcome — repeat test or timed recall",
  },
  REFERRAL: {
    bg: "var(--pw-referral-bg)",
    border: "var(--pw-referral-border)",
    accent: "var(--pw-referral-accent)",
    fg: "var(--pw-referral-fg)",
    icon: Stethoscope,
    legend: "Outcome — specialist referral or MDM review",
  },
  REVIEW: {
    bg: "var(--pw-review-bg)",
    border: "var(--pw-review-border)",
    accent: "var(--pw-review-accent)",
    fg: "var(--pw-review-fg)",
    icon: UserRoundCheck,
    legend: "Clinician confirmation required",
  },
  URGENT: {
    bg: "var(--pw-urgent-bg)",
    border: "var(--pw-urgent-border)",
    accent: "var(--pw-urgent-accent)",
    fg: "var(--pw-urgent-fg)",
    icon: AlertTriangle,
    legend: "Safety stop — governed override",
  },
};

export const FALLBACK_ICON = Layers;

/** Governed node type, rendered in plain clinical language on the card badge. */
export const NODE_TYPE_LABEL: Record<GraphNodeType, string> = {
  START: "Start",
  ROUTER: "Section",
  DECISION: "Decision",
  ACTION: "Action",
  REPEAT_TIMER: "Repeat / recall",
  SAFETY_STOP: "Safety stop",
  CLINICIAN_REVIEW: "Clinician review",
  MDM_REVIEW: "MDM review",
  SPECIALIST_REFERRAL: "Specialist referral",
  SUBFLOW_LINK: "Linked pathway",
  TERMINAL: "Outcome",
  INFORMATION: "Information",
};

export const REVIEWER_REQUIREMENT_LABEL: Record<string, string> = {
  MANDATORY_CLINICIAN_CONFIRMATION: "Clinician confirmation required",
  CLINICIAN_REVIEW: "Clinician review",
  MDM_REVIEW: "MDM review",
  SPECIALIST_REVIEW: "Specialist review",
};

/** Legend rows, in the order a reader should meet them. */
export const LEGEND_ORDER: PathwayTone[] = [
  "ENTRY",
  "DECISION",
  "ROUTINE",
  "MONITOR",
  "REFERRAL",
  "REVIEW",
  "URGENT",
];
