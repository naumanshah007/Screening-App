import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { evaluatePilotSession } from "@/lib/auth/session-policy";

const now = new Date("2026-08-15T12:00:00.000Z");

test("pilot session accepts timestamps within idle and re-auth windows", () => {
  assert.deepEqual(
    evaluatePilotSession({
      authenticatedAt: "2026-08-15T11:00:00.000Z",
      lastActivityAt: "2026-08-15T11:50:00.000Z",
      idleTimeoutMinutes: 20,
      reauthMinutes: 120,
      now,
    }),
    { valid: true, reason: null }
  );
});

test("idle timeout fails closed", () => {
  assert.deepEqual(
    evaluatePilotSession({
      authenticatedAt: "2026-08-15T11:00:00.000Z",
      lastActivityAt: "2026-08-15T11:30:00.000Z",
      idleTimeoutMinutes: 20,
      reauthMinutes: 120,
      now,
    }),
    { valid: false, reason: "idle_timeout" }
  );
});

test("absolute privilege re-authentication window fails closed", () => {
  assert.deepEqual(
    evaluatePilotSession({
      authenticatedAt: "2026-08-15T09:00:00.000Z",
      lastActivityAt: "2026-08-15T11:55:00.000Z",
      idleTimeoutMinutes: 20,
      reauthMinutes: 120,
      now,
    }),
    { valid: false, reason: "reauth_required" }
  );
});

test("missing or invalid timestamps never create a valid pilot session", () => {
  assert.deepEqual(
    evaluatePilotSession({
      authenticatedAt: "not-a-date",
      lastActivityAt: null,
      idleTimeoutMinutes: 20,
      reauthMinutes: 120,
      now,
    }),
    { valid: false, reason: "missing_timestamp" }
  );
});

test("pilot authentication rejects flagged and legacy-roster demo identities", () => {
  const source = readFileSync("lib/auth.ts", "utf8");
  assert.match(source, /user\.isDemoAccount \|\| isDemoAccountEmail\(user\.email\)/);
  assert.match(
    source,
    /currentUser\.isDemoAccount \|\| isDemoAccountEmail\(currentUser\.email\)/
  );
});
