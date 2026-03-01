"use client";
import { cn } from "@/lib/utils";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type Priority  = "P1" | "P2" | "P3" | "P4";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "low" | "medium" | "high" | "urgent" | "default" | "info";
  size?: "sm" | "md";
  className?: string;
}

const variantClasses: Record<string, string> = {
  low:     "bg-emerald-50 text-emerald-800 border border-emerald-200",
  medium:  "bg-violet-50  text-violet-800  border border-violet-200",
  high:    "bg-amber-50   text-amber-800   border border-amber-200",
  urgent:  "bg-red-50     text-red-800     border border-red-200",
  default: "bg-slate-100  text-slate-700   border border-slate-200",
  info:    "bg-sky-50     text-sky-800     border border-sky-200",
};

const dotClasses: Record<string, string> = {
  low:    "bg-emerald-500",
  medium: "bg-violet-500",
  high:   "bg-amber-500",
  urgent: "bg-red-500",
  default:"bg-slate-400",
  info:   "bg-sky-500",
};

const sizeClasses: Record<string, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({ children, variant = "default", size = "sm", className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full font-medium",
      variantClasses[variant],
      sizeClasses[size],
      className
    )}>
      {variant !== "default" && (
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotClasses[variant])} aria-hidden />
      )}
      {children}
    </span>
  );
}

const riskMeta: Record<RiskLevel, { variant: BadgeProps["variant"]; label: string }> = {
  LOW:    { variant: "low",    label: "Low Risk" },
  MEDIUM: { variant: "medium", label: "Moderate" },
  HIGH:   { variant: "high",   label: "High Risk" },
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
  P1: { variant: "urgent", label: "P1 Urgent",   days: "20 working days" },
  P2: { variant: "high",   label: "P2 High",     days: "42 working days" },
  P3: { variant: "medium", label: "P3 Standard", days: "84 working days" },
  P4: { variant: "low",    label: "P4 Routine",  days: "168 working days" },
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
  };
  const m = map[status ?? ""] ?? { variant: "default" as const, label: status ?? "—" };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
