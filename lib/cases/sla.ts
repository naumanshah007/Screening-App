import type { CaseStatus, ServiceLine, TriagePriority } from "@prisma/client";
import {
  addBusinessDays,
  addDays,
  addMonths,
  differenceInCalendarDays,
  startOfDay,
} from "date-fns";

import type { CaseSlaBucket } from "@/lib/cases/types";

type SlaUnit = "business_days" | "calendar_days" | "calendar_months" | "none";

export type ServiceSlaRule = {
  amount: number | null;
  unit: SlaUnit;
  label: string;
  shortLabel: string;
};

const CLOSED_STATUSES = new Set<CaseStatus>([
  "REJECTED",
  "RETURNED_TO_GP",
  "CLOSED",
]);

const SERVICE_SLA_RULES: Record<ServiceLine, Record<TriagePriority, ServiceSlaRule>> = {
  COLPOSCOPY: {
    P1: { amount: 10, unit: "calendar_days", label: "10 calendar days", shortLabel: "10d" },
    P1_HSC: { amount: 10, unit: "calendar_days", label: "10 calendar days", shortLabel: "10d" },
    P2: { amount: 30, unit: "calendar_days", label: "30 calendar days", shortLabel: "30d" },
    P2_HSC: { amount: 30, unit: "calendar_days", label: "30 calendar days", shortLabel: "30d" },
    P3: { amount: 3, unit: "calendar_months", label: "3 calendar months", shortLabel: "3 mo" },
    P5: { amount: null, unit: "none", label: "No booking SLA", shortLabel: "No SLA" },
    REJECT: { amount: null, unit: "none", label: "No booking SLA", shortLabel: "No SLA" },
    DECLINE: { amount: null, unit: "none", label: "No booking SLA", shortLabel: "No SLA" },
    INFO_REQUIRED: {
      amount: null,
      unit: "none",
      label: "Awaiting information",
      shortLabel: "Info required",
    },
  },
  GYNAECOLOGY: {
    P1: { amount: 20, unit: "business_days", label: "20 working days", shortLabel: "20 wd" },
    P1_HSC: { amount: 20, unit: "business_days", label: "20 working days", shortLabel: "20 wd" },
    P2: { amount: 42, unit: "business_days", label: "42 working days", shortLabel: "42 wd" },
    P2_HSC: { amount: 42, unit: "business_days", label: "42 working days", shortLabel: "42 wd" },
    P3: { amount: 84, unit: "business_days", label: "84 working days", shortLabel: "84 wd" },
    P5: { amount: null, unit: "none", label: "Virtual clinic / no booking SLA", shortLabel: "Virtual" },
    REJECT: { amount: null, unit: "none", label: "No booking SLA", shortLabel: "No SLA" },
    DECLINE: { amount: null, unit: "none", label: "No booking SLA", shortLabel: "No SLA" },
    INFO_REQUIRED: {
      amount: null,
      unit: "none",
      label: "Awaiting information",
      shortLabel: "Info required",
    },
  },
};

export type CaseSlaSnapshot = {
  kind: "none" | "booked" | "overdue" | "due_soon" | "on_track" | "closed";
  label: string;
  daysDelta: number | null;
};

export function getPrioritySlaRule(args: {
  serviceLine?: ServiceLine | null;
  priority?: TriagePriority | null;
}) {
  if (!args.serviceLine || !args.priority) {
    return null;
  }
  return SERVICE_SLA_RULES[args.serviceLine][args.priority];
}

export function calculateCaseTargetDueAt(
  receivedAt: Date,
  serviceLine?: ServiceLine | null,
  priority?: TriagePriority | null,
  /** Precise calendar-day override from the matched rule — takes precedence over priority-based SLA */
  targetDaysOverride?: number | null
) {
  // Precise targetDays from the winning rule always wins
  if (targetDaysOverride != null && targetDaysOverride > 0) {
    return addDays(receivedAt, targetDaysOverride);
  }

  const rule = getPrioritySlaRule({ serviceLine, priority });
  if (!rule?.amount || rule.unit === "none") {
    return null;
  }

  switch (rule.unit) {
    case "business_days":
      return addBusinessDays(receivedAt, rule.amount);
    case "calendar_days":
      return addDays(receivedAt, rule.amount);
    case "calendar_months":
      return addMonths(receivedAt, rule.amount);
    default:
      return null;
  }
}

export function getServiceSlaSummary(serviceLine?: ServiceLine | null) {
  if (serviceLine === "COLPOSCOPY") {
    return "Colposcopy queue policy: P1/P1-HSC within 10 calendar days, P2 within 30 calendar days, P3 within 3 months, surveillance within 6 months. Precise day targets come from the matched rule.";
  }
  if (serviceLine === "GYNAECOLOGY") {
    return "Gynaecology queue policy: P1 20 working days, P2 42 working days, P3 84 working days, P5 virtual clinic.";
  }
  return "Queue policy uses service-specific SLA rules once a clinician-approved priority is saved.";
}

export function getSlaBadgeVariant(kind: CaseSlaSnapshot["kind"]) {
  switch (kind) {
    case "overdue":
      return "urgent" as const;
    case "due_soon":
      return "high" as const;
    case "booked":
      return "low" as const;
    default:
      return "info" as const;
  }
}

export function matchesSlaBucket(bucket: CaseSlaBucket, snapshot: CaseSlaSnapshot) {
  switch (bucket) {
    case "OVERDUE":
      return snapshot.kind === "overdue";
    case "DUE_SOON":
      return snapshot.kind === "due_soon";
    case "BOOKED":
      return snapshot.kind === "booked";
    case "ON_TRACK":
      return snapshot.kind === "on_track";
    case "NO_TARGET":
      return snapshot.kind === "none";
    default:
      return false;
  }
}

export function getCaseSlaSnapshot(args: {
  targetDueAt?: Date | string | null;
  bookedForAt?: Date | string | null;
  status?: CaseStatus | null;
  now?: Date;
}) {
  const { targetDueAt, bookedForAt, status } = args;
  const now = args.now ?? new Date();

  if (!targetDueAt) {
    return {
      kind: status && CLOSED_STATUSES.has(status) ? "closed" : "none",
      label: status && CLOSED_STATUSES.has(status) ? "No active SLA" : "Target not set",
      daysDelta: null,
    } satisfies CaseSlaSnapshot;
  }

  const target = startOfDay(new Date(targetDueAt));
  const today = startOfDay(now);
  const daysDelta = differenceInCalendarDays(target, today);

  if (bookedForAt) {
    return {
      kind: "booked",
      label: `Booked for ${new Date(bookedForAt).toLocaleDateString("en-NZ", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`,
      daysDelta,
    } satisfies CaseSlaSnapshot;
  }

  if (status && CLOSED_STATUSES.has(status)) {
    return {
      kind: "closed",
      label: "No active SLA",
      daysDelta,
    } satisfies CaseSlaSnapshot;
  }

  if (daysDelta < 0) {
    return {
      kind: "overdue",
      label: `${Math.abs(daysDelta)}d overdue`,
      daysDelta,
    } satisfies CaseSlaSnapshot;
  }

  if (daysDelta <= 3) {
    return {
      kind: "due_soon",
      label: `${daysDelta}d left`,
      daysDelta,
    } satisfies CaseSlaSnapshot;
  }

  return {
    kind: "on_track",
    label: `${daysDelta}d left`,
    daysDelta,
  } satisfies CaseSlaSnapshot;
}
