"use client";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "low" | "medium" | "high" | "urgent" | "default";
  className?: string;
}

const variantClasses = {
  low: "bg-green-100 text-green-800 border border-green-200",
  medium: "bg-amber-100 text-amber-800 border border-amber-200",
  high: "bg-purple-100 text-purple-800 border border-purple-200",
  urgent: "bg-red-100 text-red-800 border border-red-200",
  default: "bg-gray-100 text-gray-700 border border-gray-200",
};

const icons = {
  low: "●",
  medium: "▲",
  high: "■",
  urgent: "⚠",
  default: "",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {variant !== "default" && (
        <span aria-hidden="true">{icons[variant]}</span>
      )}
      {children}
    </span>
  );
}

export function RiskBadge({ risk }: { risk?: string }) {
  const variantMap: Record<string, BadgeProps["variant"]> = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    URGENT: "urgent",
  };
  const labelMap: Record<string, string> = {
    LOW: "Low Risk",
    MEDIUM: "Medium Risk",
    HIGH: "High Risk",
    URGENT: "Urgent",
  };
  const v = variantMap[risk ?? ""] ?? "default";
  return <Badge variant={v}>{labelMap[risk ?? ""] ?? risk ?? "Unknown"}</Badge>;
}

export function PriorityBadge({ priority }: { priority?: string }) {
  const variantMap: Record<string, BadgeProps["variant"]> = {
    P1: "urgent",
    P2: "high",
    P3: "medium",
    P4: "low",
  };
  const v = variantMap[priority ?? ""] ?? "default";
  return <Badge variant={v}>{priority ?? "—"}</Badge>;
}
