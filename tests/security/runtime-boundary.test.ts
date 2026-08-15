import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateRuntimeBoundary,
  resolveRuntimeMode,
} from "@/lib/config/runtime-boundary";
import type { DatabaseRuntimeSummary } from "@/lib/config/database";

const remoteDatabase: DatabaseRuntimeSummary = {
  adapter: "libsql",
  mode: "remote-libsql",
  url: "libsql://pilot.example.invalid",
  displayTarget: "libsql://pilot.example.invalid",
  authConfigured: true,
};

const localDatabase: DatabaseRuntimeSummary = {
  adapter: "libsql",
  mode: "local-file",
  url: "file:./test.db",
  displayTarget: "test.db",
  authConfigured: false,
};

const validPilotEnv = {
  CERVIGRADE_RUNTIME_MODE: "PILOT",
  PILOT_AUTH_MODE: "LOCAL_MFA",
  PILOT_IDLE_TIMEOUT_MINUTES: "20",
  PILOT_REAUTH_MINUTES: "120",
  PILOT_RETENTION_POLICY_ID: "customer-policy-approved-reference",
};

test("production builds default to non-actionable validation, never pilot", () => {
  assert.deepEqual(resolveRuntimeMode({ NODE_ENV: "production" }), {
    mode: "VALIDATION",
    explicitlyConfigured: false,
    invalidConfiguredValue: null,
  });
});

test("a fully explicit local-MFA pilot boundary can become internally ready", () => {
  const result = evaluateRuntimeBoundary({
    env: validPilotEnv,
    database: remoteDatabase,
  });
  assert.equal(result.mode, "PILOT");
  assert.equal(result.pilotAuthMode, "LOCAL_MFA");
  assert.equal(result.ready, true);
  assert.deepEqual(result.issues, []);
});

test("pilot mode fails closed on demo configuration and local database fallback", () => {
  const result = evaluateRuntimeBoundary({
    env: { ...validPilotEnv, DEMO_MODE: "true", DEMO_PASSWORD: "must-not-be-used" },
    database: localDatabase,
  });
  assert.equal(result.ready, false);
  assert.ok(result.issues.some((issue) => issue.id === "pilot-demo-isolation"));
  assert.ok(result.issues.some((issue) => issue.id === "pilot-database-boundary"));
});

test("missing pilot policy values are blockers instead of invented defaults", () => {
  const result = evaluateRuntimeBoundary({
    env: { CERVIGRADE_RUNTIME_MODE: "PILOT" },
    database: remoteDatabase,
  });
  assert.equal(result.ready, false);
  assert.ok(result.issues.some((issue) => issue.id === "pilot-auth-mode"));
  assert.ok(result.issues.some((issue) => issue.id === "pilot-idle-timeout"));
  assert.ok(result.issues.some((issue) => issue.id === "pilot-reauth-window"));
  assert.ok(result.issues.some((issue) => issue.id === "pilot-retention-policy"));
});

test("hospital SSO is honestly retained as an external gate", () => {
  const result = evaluateRuntimeBoundary({
    env: { ...validPilotEnv, PILOT_AUTH_MODE: "HOSPITAL_SSO_MFA" },
    database: remoteDatabase,
  });
  assert.equal(result.ready, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.id === "hospital-sso-external" && issue.external
    )
  );
});
