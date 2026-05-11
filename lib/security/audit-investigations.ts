import type { Prisma } from "@prisma/client";

import {
  SECURITY_EVENT_ACTION,
  SECURITY_EVENT_ENTITY,
} from "@/lib/security/events";

export type InvestigationPresetKey =
  | "recent-security"
  | "failed-sign-ins"
  | "locked-accounts"
  | "credential-recovery";

type InvestigationPresetDefinition = {
  key: InvestigationPresetKey;
  label: string;
  description: string;
  days: number;
  entities?: string[];
  actions?: string[];
};

type AuditFilterInput = {
  preset?: string | null;
  entity?: string | null;
  action?: string | null;
  userId?: string | null;
  days?: string | null;
  page?: string | null;
  limit?: string | null;
};

export type ResolvedAuditFilters = {
  preset: InvestigationPresetDefinition | null;
  entities: string[];
  actions: string[];
  userId?: string;
  days: number;
  page: number;
  limit: number;
};

const INVESTIGATION_PRESETS: InvestigationPresetDefinition[] = [
  {
    key: "recent-security",
    label: "Recent security review",
    description:
      "Seven-day security timeline covering sign-in failures, lockouts, and credential recovery.",
    days: 7,
    entities: [SECURITY_EVENT_ENTITY],
  },
  {
    key: "failed-sign-ins",
    label: "Failed sign-ins",
    description:
      "Unknown users, bad passwords, 2FA failures, and invalid recovery-code attempts.",
    days: 7,
    entities: [SECURITY_EVENT_ENTITY],
    actions: [
      SECURITY_EVENT_ACTION.LOGIN_FAILED_UNKNOWN_USER,
      SECURITY_EVENT_ACTION.LOGIN_FAILED_PASSWORD,
      SECURITY_EVENT_ACTION.LOGIN_FAILED_2FA,
      SECURITY_EVENT_ACTION.RECOVERY_CODE_FAILED,
    ],
  },
  {
    key: "locked-accounts",
    label: "Locked accounts",
    description:
      "Lockout creation and blocked sign-in attempts for accounts that are currently or recently locked.",
    days: 30,
    entities: [SECURITY_EVENT_ENTITY],
    actions: [
      SECURITY_EVENT_ACTION.LOGIN_LOCKED,
      SECURITY_EVENT_ACTION.LOGIN_BLOCKED_LOCKED,
    ],
  },
  {
    key: "credential-recovery",
    label: "Credential recovery",
    description:
      "Administrator-issued password resets, 2FA resets, and recovery-code rotation activity.",
    days: 30,
    entities: ["UserPassword", "User2FA", "User2FARecoveryCode", "User2FARecoveryCodes"],
  },
];

function parsePositiveInt(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getInvestigationPresets() {
  return INVESTIGATION_PRESETS;
}

export function getInvestigationPreset(
  key: string | null | undefined
): InvestigationPresetDefinition | null {
  if (!key) {
    return null;
  }

  return INVESTIGATION_PRESETS.find((preset) => preset.key === key) ?? null;
}

export function resolveAuditFilters(
  input: AuditFilterInput
): ResolvedAuditFilters {
  const preset = getInvestigationPreset(input.preset);
  const entity = input.entity?.trim() || undefined;
  const action = input.action?.trim() || undefined;
  const userId = input.userId?.trim() || undefined;

  return {
    preset,
    entities: entity ? [entity] : [...(preset?.entities ?? [])],
    actions: action ? [action] : [...(preset?.actions ?? [])],
    userId,
    days: parsePositiveInt(input.days, preset?.days ?? 7),
    page: parsePositiveInt(input.page, 1),
    limit: Math.min(parsePositiveInt(input.limit, 25), 100),
  };
}

export function getAuditWindowStart(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function buildAuditWhere(
  filters: ResolvedAuditFilters
): Prisma.AuditLogWhereInput {
  return {
    createdAt: {
      gte: getAuditWindowStart(filters.days),
    },
    ...(filters.entities.length === 1
      ? { entity: filters.entities[0] }
      : filters.entities.length > 1
        ? { entity: { in: filters.entities } }
        : {}),
    ...(filters.actions.length === 1
      ? { action: filters.actions[0] }
      : filters.actions.length > 1
        ? { action: { in: filters.actions } }
        : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
  };
}

export function buildAuditSearchParams(
  filters: ResolvedAuditFilters,
  overrides?: Partial<{
    page: number;
    limit: number;
    days: number;
    preset: InvestigationPresetKey | null;
    entity: string | null;
    action: string | null;
    userId: string | null;
    format: "json" | "csv";
  }>
) {
  const params = new URLSearchParams();
  const presetKey = overrides?.preset ?? filters.preset?.key ?? null;
  const entity =
    overrides?.entity === null
      ? null
      : overrides?.entity ??
        (presetKey || filters.entities.length !== 1 ? null : filters.entities[0]);
  const action =
    overrides?.action === null
      ? null
      : overrides?.action ??
        (presetKey || filters.actions.length !== 1 ? null : filters.actions[0]);
  const userId = overrides?.userId === null ? null : overrides?.userId ?? filters.userId ?? null;
  const days = overrides?.days ?? filters.days;
  const limit = overrides?.limit ?? filters.limit;

  if (presetKey) {
    params.set("preset", presetKey);
  }
  if (entity) {
    params.set("entity", entity);
  }
  if (action) {
    params.set("action", action);
  }
  if (userId) {
    params.set("userId", userId);
  }
  params.set("days", String(days));
  params.set("limit", String(limit));
  if (overrides?.page) {
    params.set("page", String(overrides.page));
  } else if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  if (overrides?.format) {
    params.set("format", overrides.format);
  }

  return params;
}

export function summarizeAuditFilter(values: string[]) {
  if (values.length === 0) {
    return "All";
  }

  if (values.length === 1) {
    return values[0];
  }

  return `${values.length} selected`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getAuditExportFilename(
  filters: ResolvedAuditFilters,
  format: "json" | "csv"
) {
  const label = filters.preset?.label ?? "audit-report";
  return `${slugify(label)}-${filters.days}d.${format}`;
}
