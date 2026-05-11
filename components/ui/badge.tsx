"use client";
import { cn } from "@/lib/utils";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type Priority =
  | "P1" | "P1_HSC" | "P2" | "P2_HSC" | "P3" | "P4" | "P5"
  | "REJECT" | "DECLINE" | "INFO_REQUIRED";

type OperationalWorkflow =
  | "PENDING_REVIEW" | "BOOKABLE" | "VIRTUAL_CLINIC" | "RETURN_TO_GP" | "NEEDS_MORE_INFO";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "low" | "medium" | "high" | "urgent" | "default" | "info";
  size?: "sm" | "md";
  className?: string;
}

const variantClasses: Record<string, string> = {
  low:     "bg-success/5 text-foreground border border-success/30 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
  medium:  "bg-brand-50/40  text-foreground  border border-violet-200  dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800",
  high:    "bg-warn/5   text-foreground   border border-warn/30   dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  urgent:  "bg-destructive/5     text-foreground     border border-destructive/30     dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
  default: "bg-muted text-muted-foreground border border-border",
  info:    "bg-info/5     text-foreground     border border-info/30     dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800",
};

const dotClasses: Record<string, string> = {
  low:     "bg-success/50",
  medium:  "bg-brand-50/400",
  high:    "bg-warn/50",
  urgent:  "bg-destructive/50",
  default: "bg-muted-foreground",
  info:    "bg-info/50",
};

const sizeClasses: Record<string, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({ children, variant = "default", size = "sm", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {variant !== "default" && (
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotClasses[variant])} aria-hidden />
      )}
      {children}
    </span>
  );
}

const riskMeta: Record<RiskLevel, { variant: BadgeProps["variant"]; label: string }> = {
  LOW:    { variant: "low",    label: "Low risk" },
  MEDIUM: { variant: "medium", label: "Moderate" },
  HIGH:   { variant: "high",   label: "High risk" },
  URGENT: { variant: "urgent", label: "Urgent" },
};

export function RiskBadge({ risk, size }: { risk?: string; size?: BadgeProps["size"] }) {
  const meta = riskMeta[risk as RiskLevel] ?? { variant: "default" as const, label: risk ?? "—" };
  return (
    <Badge variant={meta.variant} size={size} aria-label={`Risk level: ${meta.label}`}>
      {meta.label}
    </Badge>
  );
}

const priorityMeta: Record<Priority, { variant: BadgeProps["variant"]; label: string; days: string }> = {
  P1:           { variant: "urgent", label: "P1 Urgent",    days: "≤20 working days" },
  P1_HSC:       { variant: "urgent", label: "P1 HSC",       days: "" },
  P2:           { variant: "high",   label: "P2 High",      days: "≤42 working days" },
  P2_HSC:       { variant: "high",   label: "P2 HSC",       days: "" },
  P3:           { variant: "medium", label: "P3 Standard",  days: "≤84 working days" },
  P4:           { variant: "low",    label: "P4 Routine",   days: "≤168 working days" },
  P5:           { variant: "info",   label: "P5 Virtual",   days: "" },
  REJECT:       { variant: "default", label: "Reject",      days: "" },
  DECLINE:      { variant: "default", label: "Decline",     days: "" },
  INFO_REQUIRED:{ variant: "info",   label: "Info Required", days: "" },
};

export function PriorityBadge({ priority, showDays, size }: { priority?: string; showDays?: boolean; size?: BadgeProps["size"] }) {
  const meta = priorityMeta[priority as Priority] ?? { variant: "default" as const, label: priority ?? "—", days: "" };
  return (
    <Badge variant={meta.variant} size={size} aria-label={`Priority: ${meta.label}`}>
      {meta.label}{showDays && meta.days ? ` · ${meta.days}` : ""}
    </Badge>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    PENDING:              { variant: "high",    label: "Pending" },
    APPROVED:             { variant: "info",    label: "Approved" },
    COMPLETE:             { variant: "low",     label: "Complete" },
    COMPLETED:            { variant: "low",     label: "Completed" },
    REJECTED:             { variant: "urgent",  label: "Rejected" },
    IN_PROGRESS:          { variant: "medium",  label: "In Progress" },
    RECALLED:             { variant: "info",    label: "Recalled" },
    REFERRED:             { variant: "high",    label: "Referred" },
    AWAITING_APPOINTMENT: { variant: "medium",  label: "Awaiting Appt" },
    ESCALATED:            { variant: "urgent",  label: "Escalated" },
    NEW:                  { variant: "info",    label: "New" },
    INGESTING:            { variant: "medium",  label: "Processing" },
    READY_FOR_SUMMARY:    { variant: "high",    label: "Ready for Summary" },
    READY_FOR_GRADING:    { variant: "urgent",  label: "Ready for Grading" },
    NEEDS_MORE_INFO:      { variant: "high",    label: "More Info Needed" },
    GRADED:               { variant: "low",     label: "Graded" },
    RETURNED_TO_GP:       { variant: "default", label: "Returned to GP" },
    BOOKED:               { variant: "info",    label: "Booked" },
    CLOSED:               { variant: "default", label: "Closed" },
  };
  const m = map[status ?? ""] ?? { variant: "default" as const, label: status ?? "—" };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function ServiceLineBadge({ serviceLine }: { serviceLine?: string }) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    COLPOSCOPY:  { variant: "info",   label: "Colposcopy" },
    GYNAECOLOGY: { variant: "medium", label: "Gynaecology" },
  };
  const meta = map[serviceLine ?? ""] ?? { variant: "default" as const, label: serviceLine ?? "—" };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function WorkflowBadge({ workflow }: { workflow?: string }) {
  const map: Record<OperationalWorkflow, { variant: BadgeProps["variant"]; label: string }> = {
    PENDING_REVIEW: { variant: "medium",  label: "Pending Review" },
    BOOKABLE:       { variant: "low",     label: "Bookable" },
    VIRTUAL_CLINIC: { variant: "info",    label: "Virtual Clinic" },
    RETURN_TO_GP:   { variant: "default", label: "Return to GP" },
    NEEDS_MORE_INFO:{ variant: "high",    label: "Needs More Info" },
  };
  const meta = map[workflow as OperationalWorkflow] ?? { variant: "default" as const, label: workflow ?? "—" };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
