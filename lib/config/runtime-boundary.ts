import {
  getDatabaseRuntimeSummary,
  type DatabaseRuntimeSummary,
} from "@/lib/config/database";

export const RUNTIME_MODES = [
  "DEVELOPMENT",
  "DEMO",
  "VALIDATION",
  "PILOT",
] as const;

export type RuntimeMode = (typeof RUNTIME_MODES)[number];
export type PilotAuthMode = "LOCAL_MFA" | "HOSPITAL_SSO_MFA";

export type RuntimeBoundaryIssue = {
  id: string;
  message: string;
  external: boolean;
};

export type RuntimeBoundary = {
  mode: RuntimeMode;
  explicitlyConfigured: boolean;
  pilotAuthMode: PilotAuthMode | null;
  pilotIdleTimeoutMinutes: number | null;
  pilotReauthMinutes: number | null;
  retentionPolicyId: string | null;
  issues: RuntimeBoundaryIssue[];
  ready: boolean;
};

type RuntimeEnvironment = Record<string, string | undefined>;

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function value(env: RuntimeEnvironment, key: string) {
  const normalized = env[key]?.trim();
  return normalized ? normalized : undefined;
}

function truthy(env: RuntimeEnvironment, key: string) {
  const raw = value(env, key)?.toLowerCase();
  return raw ? TRUTHY.has(raw) : false;
}

function positiveInteger(env: RuntimeEnvironment, key: string) {
  const raw = value(env, key);
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function resolveRuntimeMode(env: RuntimeEnvironment = process.env) {
  const configured = value(env, "CERVIGRADE_RUNTIME_MODE")?.toUpperCase();
  if (configured && RUNTIME_MODES.includes(configured as RuntimeMode)) {
    return {
      mode: configured as RuntimeMode,
      explicitlyConfigured: true,
      invalidConfiguredValue: null,
    };
  }

  if (configured) {
    return {
      mode: "VALIDATION" as const,
      explicitlyConfigured: true,
      invalidConfiguredValue: configured,
    };
  }

  if (truthy(env, "DEMO_MODE")) {
    return {
      mode: "DEMO" as const,
      explicitlyConfigured: false,
      invalidConfiguredValue: null,
    };
  }

  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    return {
      mode: "DEVELOPMENT" as const,
      explicitlyConfigured: false,
      invalidConfiguredValue: null,
    };
  }

  // A production build does not imply authority to process pilot data. The
  // conservative fallback is non-actionable validation.
  return {
    mode: "VALIDATION" as const,
    explicitlyConfigured: false,
    invalidConfiguredValue: null,
  };
}

export function evaluateRuntimeBoundary(args: {
  env?: RuntimeEnvironment;
  database?: DatabaseRuntimeSummary;
} = {}): RuntimeBoundary {
  const env = args.env ?? process.env;
  const database = args.database ?? getDatabaseRuntimeSummary();
  const resolution = resolveRuntimeMode(env);
  const issues: RuntimeBoundaryIssue[] = [];
  const authValue = value(env, "PILOT_AUTH_MODE")?.toUpperCase();
  const pilotAuthMode =
    authValue === "LOCAL_MFA" || authValue === "HOSPITAL_SSO_MFA"
      ? authValue
      : null;
  const pilotIdleTimeoutMinutes = positiveInteger(
    env,
    "PILOT_IDLE_TIMEOUT_MINUTES"
  );
  const pilotReauthMinutes = positiveInteger(env, "PILOT_REAUTH_MINUTES");
  const retentionPolicyId = value(env, "PILOT_RETENTION_POLICY_ID") ?? null;

  if (resolution.invalidConfiguredValue) {
    issues.push({
      id: "runtime-mode-invalid",
      message: `CERVIGRADE_RUNTIME_MODE must be one of ${RUNTIME_MODES.join(", ")}.`,
      external: false,
    });
  }

  if (resolution.mode === "DEMO" && !truthy(env, "DEMO_MODE")) {
    issues.push({
      id: "demo-mode-mismatch",
      message: "DEMO runtime requires DEMO_MODE to be explicitly enabled.",
      external: false,
    });
  }

  if (resolution.mode === "PILOT") {
    if (!resolution.explicitlyConfigured) {
      issues.push({
        id: "pilot-not-explicit",
        message: "PILOT mode must be selected explicitly.",
        external: false,
      });
    }

    const demoConfigurationPresent =
      truthy(env, "DEMO_MODE") ||
      Boolean(value(env, "DEMO_PASSWORD")) ||
      Boolean(value(env, "DEMO_SEED_PASSWORD")) ||
      truthy(env, "BOOTSTRAP_DEMO_DB");
    if (demoConfigurationPresent) {
      issues.push({
        id: "pilot-demo-isolation",
        message:
          "Pilot mode refuses demo flags, demo credentials, and demo account bootstrap configuration.",
        external: false,
      });
    }

    if (database.mode !== "remote-libsql" || !database.authConfigured) {
      issues.push({
        id: "pilot-database-boundary",
        message:
          "Pilot mode requires an authenticated managed remote libsql database; local file fallback is prohibited.",
        external: true,
      });
    }

    if (!authValue) {
      issues.push({
        id: "pilot-auth-mode",
        message:
          "PILOT_AUTH_MODE must explicitly select LOCAL_MFA or HOSPITAL_SSO_MFA.",
        external: false,
      });
    } else if (!pilotAuthMode) {
      issues.push({
        id: "pilot-auth-mode-invalid",
        message:
          "PILOT_AUTH_MODE must be LOCAL_MFA or HOSPITAL_SSO_MFA.",
        external: false,
      });
    } else if (pilotAuthMode === "HOSPITAL_SSO_MFA") {
      issues.push({
        id: "hospital-sso-external",
        message:
          "Hospital SSO is not configured in this application build; IdP integration and MFA evidence remain an external gate.",
        external: true,
      });
    }

    if (!pilotIdleTimeoutMinutes) {
      issues.push({
        id: "pilot-idle-timeout",
        message:
          "PILOT_IDLE_TIMEOUT_MINUTES must be an explicitly approved positive integer.",
        external: false,
      });
    }

    if (!pilotReauthMinutes) {
      issues.push({
        id: "pilot-reauth-window",
        message:
          "PILOT_REAUTH_MINUTES must be an explicitly approved positive integer.",
        external: false,
      });
    }

    if (!retentionPolicyId) {
      issues.push({
        id: "pilot-retention-policy",
        message:
          "PILOT_RETENTION_POLICY_ID must reference the customer-approved retention and deletion policy.",
        external: true,
      });
    }
  }

  return {
    mode: resolution.mode,
    explicitlyConfigured: resolution.explicitlyConfigured,
    pilotAuthMode,
    pilotIdleTimeoutMinutes,
    pilotReauthMinutes,
    retentionPolicyId,
    issues,
    ready: issues.length === 0,
  };
}

export function assertRuntimeBoundaryReady(action = "This operation") {
  const boundary = evaluateRuntimeBoundary();
  if (!boundary.ready) {
    throw new Error(
      `${action} is blocked by runtime security configuration (${boundary.issues
        .map((issue) => issue.id)
        .join(", ")}).`
    );
  }
  return boundary;
}

export function isPilotMode() {
  return resolveRuntimeMode().mode === "PILOT";
}

export function assertSyntheticDataOperationAllowed(action: string) {
  const boundary = evaluateRuntimeBoundary();
  if (boundary.mode === "PILOT") {
    throw new Error(`${action} is prohibited in PILOT mode.`);
  }
}
