import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

export function getRiskColour(risk?: string): string {
  switch (risk) {
    case "LOW":    return "#22C55E";
    case "MEDIUM": return "#F59E0B";
    case "HIGH":   return "#7C3AED";
    case "URGENT": return "#DC2626";
    default:       return "#6B7280";
  }
}

export function getRiskBg(risk?: string): string {
  switch (risk) {
    case "LOW":    return "bg-green-100 text-green-800 border-green-200";
    case "MEDIUM": return "bg-amber-100 text-amber-800 border-amber-200";
    case "HIGH":   return "bg-purple-100 text-purple-800 border-purple-200";
    case "URGENT": return "bg-red-100 text-red-800 border-red-200";
    default:       return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function getRiskIcon(risk?: string): string {
  switch (risk) {
    case "LOW":    return "●";
    case "MEDIUM": return "▲";
    case "HIGH":   return "■";
    case "URGENT": return "⚠";
    default:       return "○";
  }
}

export function getPriorityLabel(priority?: string): string {
  switch (priority) {
    case "P1": return "P1 - Urgent (≤20 working days)";
    case "P2": return "P2 - Semi-urgent (≤42 working days)";
    case "P3": return "P3 - Routine (≤84 working days)";
    case "P4": return "P4 - Non-urgent (≤168 working days)";
    default:   return priority ?? "—";
  }
}

export function getFigureLabel(figure?: string): string {
  switch (figure) {
    case "FIGURE_1":  return "Figure 1 - HPV Transition (cytology-negative)";
    case "FIGURE_2":  return "Figure 2 - HPV Transition (previously abnormal)";
    case "FIGURE_3":  return "Figure 3 - Primary HPV Screening";
    case "FIGURE_4":  return "Figure 4 - Colposcopy & Histology (low-grade)";
    case "FIGURE_5":  return "Figure 5 - High-grade Lesion Management";
    case "FIGURE_6":  return "Figure 6 - Test of Cure";
    case "FIGURE_7":  return "Figure 7 - Post-abnormal Management";
    case "FIGURE_8":  return "Figure 8 - Post-hysterectomy";
    case "FIGURE_9":  return "Figure 9 - Extended Post-abnormal Management";
    case "FIGURE_10": return "Figure 10 - Post-hysterectomy Follow-up";
    case "TABLE_1":   return "Table 1 - Routine Case Management";
    default:          return figure ?? "Unknown";
  }
}

export function calculateAge(dob: Date | string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
