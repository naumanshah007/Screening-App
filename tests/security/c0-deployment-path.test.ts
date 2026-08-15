import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { createClient } from "@libsql/client";

import {
  PERFORMANCE_READ_INDEX_MIGRATION,
  SPRINT_B_MIGRATION,
  deployRemoteLibsqlMigrations,
} from "../../scripts/pilot/deploy-remote-libsql-migrations";

test("the governed Prisma deploy path survives an ambient RUST_LOG=warn on a new SQLite target", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "cervigrade-c0-prisma-test-"));
  const databasePath = path.join(tempDir, "deploy.db");
  try {
    const result = spawnSync("npm", ["run", "pilot:prisma:migrate:deploy"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: `file:${databasePath}`,
        RUST_LOG: "warn",
      },
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const client = createClient({ url: `file:${databasePath}` });
    try {
      const migrations = await client.execute(
        "SELECT migration_name FROM _prisma_migrations ORDER BY started_at"
      );
      assert.equal(migrations.rows.length, 21);
      assert.equal(String(migrations.rows.at(-2)?.migration_name), SPRINT_B_MIGRATION);
      assert.equal(String(migrations.rows.at(-1)?.migration_name), PERFORMANCE_READ_INDEX_MIGRATION);
    } finally {
      client.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("the remote migration path refuses local files and unapproved loopback targets", async () => {
  await assert.rejects(
    deployRemoteLibsqlMigrations({
      url: "file:/tmp/not-a-remote-target.db",
      authToken: "synthetic-token",
      approvalReference: "C0-TEST",
    }),
    /remote libSQL/
  );
  await assert.rejects(
    deployRemoteLibsqlMigrations({
      url: "http://127.0.0.1:1",
      authToken: "synthetic-token",
      approvalReference: "C0-TEST",
    }),
    /explicit isolated C0 rehearsal/
  );
});

test("deployment tooling requires explicit database and change-control inputs", () => {
  const prismaRunner = readFileSync("scripts/pilot/run-prisma-migrate-deploy.ts", "utf8");
  const remoteRunner = readFileSync("scripts/pilot/deploy-remote-libsql-migrations.ts", "utf8");
  const identityConverter = readFileSync(
    "scripts/pilot/convert-demo-seed-to-c0-synthetic-pilot.ts",
    "utf8"
  );
  const browserLauncher = readFileSync("scripts/pilot/run-c0-browser-environment.ts", "utf8");
  assert.match(prismaRunner, /DATABASE_URL must be explicitly set/);
  assert.match(prismaRunner, /RUST_LOG: "info"/);
  assert.match(remoteRunner, /PILOT_MIGRATION_APPROVAL_ID/);
  assert.match(remoteRunner, /Checksum mismatch/);
  assert.match(identityConverter, /valid authenticator secret of at least 128 bits/);
  assert.match(browserLauncher, /DEMO_MODE: "false"/);
  assert.match(browserLauncher, /BOOTSTRAP_DEMO_DB: "false"/);
});
