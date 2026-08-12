/**
 * DEMO_MODE configuration and login-surface guarantees.
 *
 * These assertions are deliberately environment-driven rather than mocked: the
 * whole safety property is that behaviour follows a single environment variable
 * and nothing else, so the tests set and clear that variable directly.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

async function withDemoMode<T>(
  value: string | undefined,
  run: () => Promise<T> | T
): Promise<T> {
  const previous = process.env.DEMO_MODE;
  if (value === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previous;
  }
}

test("demo mode is off unless explicitly enabled", async () => {
  const { isDemoModeEnabled } = await import("@/lib/config/demo-mode");

  await withDemoMode(undefined, () => {
    assert.equal(isDemoModeEnabled(), false, "must default to off");
  });
  await withDemoMode("false", () => {
    assert.equal(isDemoModeEnabled(), false);
  });
  await withDemoMode("true", () => {
    assert.equal(isDemoModeEnabled(), true);
  });
  await withDemoMode("1", () => {
    assert.equal(isDemoModeEnabled(), true);
  });
});

test("demo mode is not coupled to NODE_ENV", async () => {
  const { isDemoModeEnabled } = await import("@/lib/config/demo-mode");
  const previousNodeEnv = process.env.NODE_ENV;

  try {
    // A production build with DEMO_MODE on is exactly the current deployment.
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    await withDemoMode("true", () => {
      assert.equal(
        isDemoModeEnabled(),
        true,
        "NODE_ENV=production must not force demo mode off"
      );
    });
    await withDemoMode("false", () => {
      assert.equal(
        isDemoModeEnabled(),
        false,
        "NODE_ENV must not be able to force demo mode on"
      );
    });
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV =
      previousNodeEnv;
  }
});

test("every application role has a demonstration identity", async () => {
  const { DEMO_ACCOUNTS } = await import("@/lib/config/demo-mode");

  // The Prisma schema is the source of truth for what roles exist. Parsing it
  // rather than restating the list means adding a role to the enum without a
  // demo identity fails this test, so the roster cannot fall behind the app.
  const schema = readFileSync(
    join(ROOT, "prisma", "schema.prisma"),
    "utf8"
  );
  const enumBody = schema.match(/enum UserRole\s*\{([^}]*)\}/)?.[1];
  assert.ok(enumBody, "could not locate the UserRole enum");

  const schemaRoles = enumBody!
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"));

  const covered = new Set(DEMO_ACCOUNTS.map((account) => account.role));
  const missing = schemaRoles.filter((role) => !covered.has(role as never));

  assert.deepEqual(
    missing,
    [],
    `every UserRole needs a demo account; missing: ${missing.join(", ")}`
  );

  // No role should be represented twice except ADMIN, which needs two distinct
  // people so activation-operator / deputy-operator separation is showable.
  const byEmail = new Map(
    DEMO_ACCOUNTS.map((account) => [account.email, account.role])
  );
  assert.equal(byEmail.get("admin@cs.nz"), "ADMIN");
  assert.equal(byEmail.get("smo@cs.nz"), "SMO_REVIEWER");
  assert.equal(byEmail.get("specialist@cs.nz"), "COLPOSCOPIST");
  assert.equal(byEmail.get("colpo.cns@cs.nz"), "COLPO_CNS");
  assert.equal(byEmail.get("gynae.grader@cs.nz"), "GYNAE_GRADER");
  assert.equal(byEmail.get("integration.admin@cs.nz"), "INTEGRATION_ADMIN");
  assert.equal(byEmail.get("deputy.admin@cs.nz"), "ADMIN");

  const admins = DEMO_ACCOUNTS.filter((account) => account.role === "ADMIN");
  assert.equal(admins.length, 2, "two ADMINs are required for operator/deputy separation");

  // Emails must be unique — a duplicate would silently collapse two role cards
  // onto one identity.
  assert.equal(
    new Set(DEMO_ACCOUNTS.map((a) => a.email)).size,
    DEMO_ACCOUNTS.length,
    "demo account emails must be unique"
  );
  assert.equal(
    new Set(DEMO_ACCOUNTS.map((a) => a.key)).size,
    DEMO_ACCOUNTS.length,
    "demo account keys must be unique"
  );
});

test("the demo password is never a source literal", async () => {
  const { getDemoPassword } = await import("@/lib/config/demo-mode");

  // Demo mode on, but no password configured — must resolve to undefined
  // rather than falling back to a baked-in default.
  await withDemoMode("true", () => {
    const previous = process.env.DEMO_PASSWORD;
    delete process.env.DEMO_PASSWORD;
    try {
      assert.equal(
        getDemoPassword(),
        undefined,
        "there must be no hard-coded fallback demo password"
      );
    } finally {
      if (previous !== undefined) process.env.DEMO_PASSWORD = previous;
    }
  });

  // The config module itself must contain no credential-shaped literal.
  const source = readFileSync(
    join(ROOT, "lib", "config", "demo-mode.ts"),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /admin123/i,
    "demo-mode.ts must not contain the demo password as a literal"
  );
});

test("no demo credential is resolvable when demo mode is off", async () => {
  const { getDemoPassword, assertDemoModeEnabled } = await import(
    "@/lib/config/demo-mode"
  );

  await withDemoMode("false", () => {
    process.env.DEMO_PASSWORD = "irrelevant-value-for-this-assertion";
    try {
      assert.equal(
        getDemoPassword(),
        undefined,
        "the demo password must be unreachable while demo mode is off"
      );
      assert.throws(
        () => assertDemoModeEnabled("Reset to demo password"),
        /only available when DEMO_MODE is enabled/
      );
    } finally {
      delete process.env.DEMO_PASSWORD;
    }
  });
});

test("the login route supplies demo accounts only while demo mode is on", () => {
  // The server component decides; the client cannot. Assert the gate exists in
  // the route source rather than rendering, matching the existing R6 guard's
  // approach for this repository (no component-render harness).
  const source = readFileSync(
    join(ROOT, "app", "(auth)", "login", "page.tsx"),
    "utf8"
  );

  assert.match(
    source,
    /isDemoModeEnabled\(\)\s*\?/,
    "the login route must gate the demo account list on isDemoModeEnabled()"
  );
  assert.match(
    source,
    /:\s*\[\]/,
    "the login route must supply an empty account list when demo mode is off"
  );
});

test("no credential material reaches the demo login component", () => {
  const source = readFileSync(
    join(ROOT, "components", "auth", "DemoLoginPanel.tsx"),
    "utf8"
  );

  assert.doesNotMatch(
    source,
    /password\s*[:=]\s*['"`]/i,
    "the demo panel must not contain a password value"
  );
  assert.match(
    source,
    /signInAsDemoUser\(/,
    "the demo panel must authenticate through the server action"
  );
});
