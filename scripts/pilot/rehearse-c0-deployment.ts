import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

import { evaluateRuntimeBoundary } from "../../lib/config/runtime-boundary";
import {
  ACCEPTED_SPRINT_A_MIGRATION,
  PERFORMANCE_READ_INDEX_MIGRATION,
  SPRINT_B_MIGRATION,
  deployRemoteLibsqlMigrations,
} from "./deploy-remote-libsql-migrations";

const ACCEPTED_SPRINT_A_SHA = "9b0e9de1e897951895adf251e6ce86d18f5f5e19";
const EXPECTED_MIGRATION_COUNT = 21;
const SENTINEL_ID = "c0-upgrade-sentinel";
const SENTINEL_KEY = "c0-synthetic-upgrade";

function digest(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function run(args: {
  command: string;
  commandArgs: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
}) {
  const result = spawnSync(args.command, args.commandArgs, {
    cwd: args.cwd,
    env: { ...process.env, ...args.env },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim().slice(-6000);
    throw new Error(`${args.command} exited ${result.status}: ${detail}`);
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

async function migrationDigests(rootDir: string) {
  const migrationsDir = path.join(rootDir, "prisma", "migrations");
  const entries = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return new Map(
    await Promise.all(
      entries.map(async (name) => [
        name,
        digest(await readFile(path.join(migrationsDir, name, "migration.sql"))),
      ] as const)
    )
  );
}

async function getFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => (error || !port ? reject(error ?? new Error("No port")) : resolve(port)));
    });
  });
}

function createRehearsalToken(privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"]) {
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 30, sub: "c0-synthetic-migrator" })
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signature = sign(null, Buffer.from(signingInput), privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

async function waitForAuthenticatedServer(url: string, authToken: string, processHandle: ChildProcess) {
  const deadline = Date.now() + 15_000;
  let lastError = "server did not respond";
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Local libSQL server exited early with ${processHandle.exitCode}.`);
    }
    const client = createClient({ url, authToken });
    try {
      await client.execute("SELECT 1");
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 150));
    } finally {
      client.close();
    }
  }
  throw new Error(`Authenticated local libSQL did not become ready: ${lastError}`);
}

async function expectAuthenticationFailure(url: string, authToken?: string) {
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });
  try {
    await client.execute("SELECT 1");
    throw new Error("Remote libSQL accepted a missing or invalid token.");
  } catch (error) {
    if (error instanceof Error && error.message === "Remote libSQL accepted a missing or invalid token.") {
      throw error;
    }
  } finally {
    client.close();
  }
}

async function verifyDatabase(client: ReturnType<typeof createClient>, expectedMigrations: number) {
  const [migrationRows, sentinelRows, integrityRows, foreignKeyRows, userColumns, triggers] = await Promise.all([
    client.execute("SELECT migration_name, checksum, finished_at FROM _prisma_migrations ORDER BY started_at"),
    client.execute({ sql: "SELECT id, key, name FROM Organisation WHERE id = ?", args: [SENTINEL_ID] }),
    client.execute("PRAGMA integrity_check"),
    client.execute("PRAGMA foreign_key_check"),
    client.execute("PRAGMA table_info('User')"),
    client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name IN ('AuditLog_protected_update', 'AuditLog_protected_delete') ORDER BY name"
    ),
  ]);

  assert(migrationRows.rows.length === expectedMigrations, `Expected ${expectedMigrations} applied migrations.`);
  assert(
    String(migrationRows.rows.at(-1)?.migration_name) === PERFORMANCE_READ_INDEX_MIGRATION,
    "The performance read-index migration is not the final migration."
  );
  assert(sentinelRows.rows.length === 1, "Accepted-Sprint-A sentinel data did not survive the upgrade.");
  assert(String(integrityRows.rows[0]?.integrity_check) === "ok", "Database integrity_check failed.");
  assert(foreignKeyRows.rows.length === 0, "Database foreign_key_check failed.");
  assert(userColumns.rows.some((row) => String(row.name) === "sessionVersion"), "User.sessionVersion is missing.");
  assert(triggers.rows.length === 2, "Protected audit triggers are missing.");
}

async function verifyProtectedAudit(client: ReturnType<typeof createClient>) {
  const auditId = "c0-protected-audit";
  await client.execute({
    sql: `INSERT INTO AuditLog
            (id, action, entity, entityId, exportEvent, severity, integrityDigest, protectedAt, createdAt)
          VALUES (?, 'C0_REHEARSAL', 'SecurityBoundary', ?, 0, 'INFO', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [auditId, SENTINEL_ID, digest("c0-protected-audit")],
  });
  for (const sql of [
    "UPDATE AuditLog SET action = 'TAMPERED' WHERE id = ?",
    "DELETE FROM AuditLog WHERE id = ?",
  ]) {
    try {
      await client.execute({ sql, args: [auditId] });
      throw new Error("Protected audit mutation unexpectedly succeeded.");
    } catch (error) {
      if (error instanceof Error && error.message === "Protected audit mutation unexpectedly succeeded.") {
        throw error;
      }
    }
  }
}

async function stopProcess(processHandle: ChildProcess) {
  const processGroup = processHandle.pid ? -processHandle.pid : null;
  const signalGroup = (signal: NodeJS.Signals) => {
    if (processGroup === null) return;
    try {
      process.kill(processGroup, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  signalGroup("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => processHandle.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
  ]);
  signalGroup("SIGKILL");
}

async function main() {
  const rootDir = process.cwd();
  const beforeDigests = await migrationDigests(rootDir);
  assert(beforeDigests.size === EXPECTED_MIGRATION_COUNT, "Expected exactly 21 checked-in migrations.");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cervigrade-c0-deploy-"));
  let server: ChildProcess | null = null;

  try {
    const acceptedDir = path.join(tempDir, "accepted-sprint-a");
    // Extract an immutable archive rather than creating or changing a Git
    // worktree used by another stream.
    await mkdir(acceptedDir, { recursive: true });
    const archive = spawnSync("git", ["archive", ACCEPTED_SPRINT_A_SHA], {
      cwd: rootDir,
      maxBuffer: 80 * 1024 * 1024,
    });
    if (archive.status !== 0 || !archive.stdout) throw new Error("Could not archive accepted Sprint A.");
    const extract = spawnSync("tar", ["-x", "-C", acceptedDir], { input: archive.stdout });
    if (extract.status !== 0) throw new Error("Could not extract accepted Sprint A archive.");
    await symlink(path.join(rootDir, "node_modules"), path.join(acceptedDir, "node_modules"), "dir");

    const baseDatabase = path.join(tempDir, "accepted-sprint-a.db");
    const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
    run({
      command: process.execPath,
      commandArgs: [prismaCli, "migrate", "deploy"],
      cwd: acceptedDir,
      env: { DATABASE_URL: `file:${baseDatabase}`, RUST_LOG: "info" },
    });

    const baseClient = createClient({ url: `file:${baseDatabase}` });
    try {
      const baseHistory = await baseClient.execute(
        "SELECT migration_name FROM _prisma_migrations ORDER BY started_at"
      );
      assert(baseHistory.rows.length === EXPECTED_MIGRATION_COUNT - 2, "Accepted Sprint A did not produce 19 migrations.");
      assert(
        String(baseHistory.rows.at(-1)?.migration_name) === ACCEPTED_SPRINT_A_MIGRATION,
        "Accepted Sprint A is not the baseline database's final migration."
      );
      await baseClient.execute({
        sql: `INSERT INTO Organisation (id, key, name, shortName, isActive, createdAt, updatedAt)
              VALUES (?, ?, 'C0 Synthetic Upgrade Sentinel', 'C0', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: [SENTINEL_ID, SENTINEL_KEY],
      });
    } finally {
      baseClient.close();
    }

    const localUpgradeDatabase = path.join(tempDir, "local-prisma-upgrade.db");
    await copyFile(baseDatabase, localUpgradeDatabase);
    const prismaDeployOutput = run({
      command: "npm",
      commandArgs: ["run", "pilot:prisma:migrate:deploy"],
      cwd: rootDir,
      env: { DATABASE_URL: `file:${localUpgradeDatabase}` },
    });
    assert(prismaDeployOutput.includes(`Applying migration \`${SPRINT_B_MIGRATION}\``), "Prisma did not apply Sprint B.");
    assert(
      prismaDeployOutput.includes(`Applying migration \`${PERFORMANCE_READ_INDEX_MIGRATION}\``),
      "Prisma did not apply the performance read indexes."
    );
    const prismaStatusOutput = run({
      command: process.execPath,
      commandArgs: [prismaCli, "migrate", "status"],
      cwd: rootDir,
      env: { DATABASE_URL: `file:${localUpgradeDatabase}`, RUST_LOG: "info" },
    });
    assert(prismaStatusOutput.includes("Database schema is up to date"), "Prisma did not report an up-to-date schema.");
    const localClient = createClient({ url: `file:${localUpgradeDatabase}` });
    try {
      await verifyDatabase(localClient, EXPECTED_MIGRATION_COUNT);
    } finally {
      localClient.close();
    }

    const remoteUpgradeDatabase = path.join(tempDir, "remote-libsql-upgrade.db");
    await copyFile(baseDatabase, remoteUpgradeDatabase);
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyPath = path.join(tempDir, "sqld-public-key.pem");
    await writeFile(publicKeyPath, publicKey.export({ type: "spki", format: "pem" }), { mode: 0o600 });
    const authToken = createRehearsalToken(privateKey);
    const port = await getFreePort();
    const url = `http://127.0.0.1:${port}`;
    const rehearsalServer = spawn(
      "turso",
      ["dev", "--db-file", remoteUpgradeDatabase, "--port", String(port), "--auth-jwt-key-file", publicKeyPath],
      { cwd: tempDir, env: process.env, stdio: ["ignore", "pipe", "pipe"], detached: true }
    );
    server = rehearsalServer;
    await waitForAuthenticatedServer(url, authToken, rehearsalServer);
    await expectAuthenticationFailure(url);
    await expectAuthenticationFailure(url, `${authToken.slice(0, -1)}x`);

    const remoteMigrationResult = await deployRemoteLibsqlMigrations({
      url,
      authToken,
      approvalReference: "C0-SYNTHETIC-DRY-RUN",
      rootDir,
      allowLoopback: true,
    });
    assert(remoteMigrationResult.appliedBefore === 19, "Remote target did not begin at Sprint A.");
    assert(
      JSON.stringify(remoteMigrationResult.appliedNow) ===
        JSON.stringify([SPRINT_B_MIGRATION, PERFORMANCE_READ_INDEX_MIGRATION]),
      "Remote deployment did not apply Sprint B followed by the performance read indexes."
    );

    const remoteClient = createClient({ url, authToken });
    try {
      await verifyDatabase(remoteClient, EXPECTED_MIGRATION_COUNT);
      await verifyProtectedAudit(remoteClient);
    } finally {
      remoteClient.close();
    }

    const adapter = new PrismaLibSql({ url, authToken });
    const prisma = new PrismaClient({ adapter });
    try {
      const sentinel = await prisma.organisation.findUnique({ where: { id: SENTINEL_ID } });
      assert(sentinel?.key === SENTINEL_KEY, "Prisma Client could not read the upgraded remote state.");
      await prisma.user.count();
    } finally {
      await prisma.$disconnect();
    }

    const boundary = evaluateRuntimeBoundary({
      env: {
        CERVIGRADE_RUNTIME_MODE: "PILOT",
        PILOT_AUTH_MODE: "LOCAL_MFA",
        PILOT_IDLE_TIMEOUT_MINUTES: "15",
        PILOT_REAUTH_MINUTES: "60",
        PILOT_RETENTION_POLICY_ID: "C0-SYNTHETIC-POLICY",
      },
      database: {
        adapter: "libsql",
        mode: "remote-libsql",
        url,
        displayTarget: "http://127.0.0.1:<isolated>",
        authConfigured: true,
      },
    });
    assert(boundary.ready, `PILOT boundary remained blocked: ${boundary.issues.map((issue) => issue.id).join(",")}`);

    const afterDigests = await migrationDigests(rootDir);
    assert(JSON.stringify([...beforeDigests]) === JSON.stringify([...afterDigests]), "A migration file changed during rehearsal.");

    console.log(
      JSON.stringify({
        status: "PASS",
        data: "synthetic-only",
        acceptedSprintABaseline: ACCEPTED_SPRINT_A_SHA,
        migrationsBefore: 19,
        prismaMigrateDeploy: "PASS",
        prismaStatus: "up-to-date",
        remoteAuthenticatedLibsql: "PASS",
        missingTokenRejected: true,
        invalidTokenRejected: true,
        migrationsAfter: EXPECTED_MIGRATION_COUNT,
        sprintBMigrationApplied: true,
        existingDataSurvived: true,
        integrityCheck: "ok",
        foreignKeyCheck: "ok",
        protectedAuditTamperRejected: true,
        prismaClientRemoteBoot: true,
        pilotRuntimeBoundaryReady: true,
        migrationFilesUnchanged: true,
      })
    );
  } finally {
    if (server) await stopProcess(server);
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "C0 deployment rehearsal failed.");
  process.exit(1);
});
