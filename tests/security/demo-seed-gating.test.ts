/**
 * R6 remediation: demo accounts must never be created implicitly.
 *
 * Before this change, `seedDemoUsers()` ran whenever the bootstrap decided the
 * database looked empty on Vercel — which is true for ANY `file:` URL, i.e. any
 * deployment without DATABASE_URL. It then created login accounts using a
 * password hard-coded in `lib/database/bootstrap.ts`, on every cold start, via
 * an UPSERT that also overwrote `passwordHash` for existing users.
 *
 * These tests pin the three independent conditions that now gate seeding, and
 * prove a production deployment cannot auto-seed merely because a database is
 * empty.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  isProductionDeployment,
  readDemoSeedPassword,
  shouldSeedDemoAccounts,
} from "../../lib/database/bootstrap";

const LOCAL_FILE_URL = "file:/tmp/cervical-screening-v2.db";
const STRONG_PASSWORD = "a-deliberate-operator-password";

/** Env fixtures are plain records; the bootstrap helpers only read named keys. */
type Env = NodeJS.ProcessEnv;
const env = (values: Record<string, string>): Env => values as unknown as Env;

/** A Vercel Production environment with an empty local database — the dangerous case. */
function productionEnv(overrides: Record<string, string> = {}): Env {
  return env({ VERCEL: "1", VERCEL_ENV: "production", NODE_ENV: "production", ...overrides });
}

function previewEnv(overrides: Record<string, string> = {}): Env {
  return env({ VERCEL: "1", VERCEL_ENV: "preview", NODE_ENV: "production", ...overrides });
}

// ── The headline guarantee ──────────────────────────────────────────────────

test("Vercel Production cannot auto-seed demo users because a database is empty", () => {
  assert.equal(
    shouldSeedDemoAccounts(LOCAL_FILE_URL, productionEnv()),
    false,
    "an empty /tmp database on production must never produce login accounts"
  );
});

test("Production refuses to seed even with every opt-in set", () => {
  assert.equal(
    shouldSeedDemoAccounts(
      LOCAL_FILE_URL,
      productionEnv({ BOOTSTRAP_DEMO_DB: "1", DEMO_SEED_PASSWORD: STRONG_PASSWORD })
    ),
    false,
    "production is an absolute bar: opt-in plus a password must still not seed"
  );
});

// ── Each condition fails closed independently ───────────────────────────────

test("no seeding without the explicit BOOTSTRAP_DEMO_DB opt-in", () => {
  assert.equal(
    shouldSeedDemoAccounts(LOCAL_FILE_URL, previewEnv({ DEMO_SEED_PASSWORD: STRONG_PASSWORD })),
    false
  );
});

test("no seeding without an operator-supplied password", () => {
  assert.equal(
    shouldSeedDemoAccounts(LOCAL_FILE_URL, previewEnv({ BOOTSTRAP_DEMO_DB: "1" })),
    false,
    "there must be no default password"
  );
});

test("a weak or accidental password does not count as a deliberate choice", () => {
  for (const password of ["", " ", "admin123", "password", "short"]) {
    assert.equal(
      shouldSeedDemoAccounts(
        LOCAL_FILE_URL,
        previewEnv({ BOOTSTRAP_DEMO_DB: "1", DEMO_SEED_PASSWORD: password })
      ),
      false,
      `${JSON.stringify(password)} must not enable seeding`
    );
  }
});

test("seeding never targets a remote/shared database from this path", () => {
  assert.equal(
    shouldSeedDemoAccounts(
      "libsql://example-db.turso.io",
      previewEnv({ BOOTSTRAP_DEMO_DB: "1", DEMO_SEED_PASSWORD: STRONG_PASSWORD })
    ),
    false,
    "a shared database must not receive demo accounts implicitly"
  );
});

// ── The permitted case ──────────────────────────────────────────────────────

test("a non-production deployment with both opt-ins may seed a local database", () => {
  assert.equal(
    shouldSeedDemoAccounts(
      LOCAL_FILE_URL,
      previewEnv({ BOOTSTRAP_DEMO_DB: "1", DEMO_SEED_PASSWORD: STRONG_PASSWORD })
    ),
    true
  );
});

test("local development with both opt-ins may seed", () => {
  assert.equal(
    shouldSeedDemoAccounts(
      "file:./prisma/dev.db",
      env({ BOOTSTRAP_DEMO_DB: "1", DEMO_SEED_PASSWORD: STRONG_PASSWORD })
    ),
    true
  );
});

// ── Environment detection ───────────────────────────────────────────────────

test("production is detected by VERCEL_ENV, not NODE_ENV", () => {
  // Vercel builds Preview deployments with NODE_ENV=production, so NODE_ENV
  // alone would misclassify every Preview as production and vice versa.
  assert.equal(isProductionDeployment(env({ VERCEL_ENV: "production" })), true);
  assert.equal(
    isProductionDeployment(env({ VERCEL_ENV: "preview", NODE_ENV: "production" })),
    false
  );
  assert.equal(isProductionDeployment(env({ NODE_ENV: "production" })), false);
  assert.equal(isProductionDeployment(env({})), false);
});

test("readDemoSeedPassword rejects absent and trivial values", () => {
  assert.equal(readDemoSeedPassword(env({})), undefined);
  assert.equal(readDemoSeedPassword(env({ DEMO_SEED_PASSWORD: "   " })), undefined);
  assert.equal(readDemoSeedPassword(env({ DEMO_SEED_PASSWORD: "admin123" })), undefined);
  assert.equal(
    readDemoSeedPassword(env({ DEMO_SEED_PASSWORD: STRONG_PASSWORD })),
    STRONG_PASSWORD
  );
});

// ── No credential remains in source ─────────────────────────────────────────

test("no hard-coded seed password remains in the bootstrap source", () => {
  const source = readFileSync("lib/database/bootstrap.ts", "utf8");
  assert.equal(
    /bcrypt\.hash\(\s*["'`][^"'`]+["'`]/.test(source),
    false,
    "bcrypt.hash must never be called with a string literal password"
  );
  assert.equal(
    source.includes("admin123"),
    false,
    "the previously exposed demo password must not appear in source"
  );
});

test("all local seed entry points require an operator password and refuse remote databases", () => {
  for (const path of ["scripts/demo-reset.ts", "prisma/seed.ts"]) {
    const source = readFileSync(path, "utf8");
    assert.ok(source.includes("readDemoSeedPassword"), `${path} must require the operator password`);
    assert.ok(source.includes("isRemoteLibSqlUrl"), `${path} must refuse a remote/shared database`);
    assert.ok(source.includes("isProductionDeployment"), `${path} must refuse Production`);
    assert.equal(/admin123|CerviGradeDemo123/i.test(source), false, `${path} contains a legacy credential literal`);
  }
});

test("the seed password is never logged or echoed", () => {
  const source = readFileSync("lib/database/bootstrap.ts", "utf8");
  // No console call may mention the password variable or its env name.
  const loggingThePassword =
    /console\.[a-z]+\([^)]*(seedPassword|DEMO_SEED_PASSWORD)/.test(source);
  assert.equal(loggingThePassword, false, "a generated or supplied credential must never be logged");
});
