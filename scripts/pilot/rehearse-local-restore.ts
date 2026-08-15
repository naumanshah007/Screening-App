/**
 * Synthetic, isolated backup/restore rehearsal for the pilot runbook.
 *
 * This never opens the configured application database. It creates a fresh
 * database beneath the OS temp directory, closes it, copies it as a backup,
 * restores to a second file, validates integrity/evidence, then removes all
 * three files. Provider-managed remote restore remains an external gate.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import net from "node:net";

import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

async function getFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => (error || !port ? reject(error ?? new Error("No free port")) : resolve(port)));
    });
  });
}

function createRehearsalToken(privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"]) {
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 15, sub: "c0-synthetic-restore" })
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${sign(null, Buffer.from(signingInput), privateKey).toString("base64url")}`;
}

async function waitForServer(url: string, authToken: string, processHandle: ChildProcess) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error("Restored libSQL server exited before becoming ready.");
    const client = createClient({ url, authToken });
    try {
      await client.execute("SELECT 1");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    } finally {
      client.close();
    }
  }
  throw new Error("Restored authenticated libSQL server did not become ready.");
}

async function stopProcess(processHandle: ChildProcess) {
  if (!processHandle.pid) return;
  const signal = (name: NodeJS.Signals) => {
    try {
      process.kill(-processHandle.pid!, name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  signal("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => processHandle.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
  ]);
  signal("SIGKILL");
}

async function main() {
  const directory = await mkdtemp(path.join(tmpdir(), "cervigrade-restore-rehearsal-"));
  const source = path.join(directory, "source.db");
  const backup = path.join(directory, "backup.db");
  const restored = path.join(directory, "restored.db");
  let server: ChildProcess | null = null;

  try {
    const ddl = await readFile(
      path.join(process.cwd(), "lib/database/current-schema.sql"),
      "utf8"
    );
    const sourceClient = createClient({ url: `file:${source}` });
    await sourceClient.executeMultiple(ddl);
    const now = new Date().toISOString();
    const userId = randomUUID();
    const auditId = randomUUID();
    await sourceClient.execute({
      sql: `INSERT INTO "User" ("id", "email", "role", "isActive", "isDemoAccount", "sessionVersion", "createdAt", "updatedAt")
            VALUES (?, ?, 'ADMIN', 1, 0, 0, ?, ?)`,
      args: [userId, "synthetic-restore-rehearsal@example.invalid", now, now],
    });
    await sourceClient.execute({
      sql: `INSERT INTO "AuditLog" ("id", "userId", "action", "entity", "entityId", "newValue", "integrityDigest", "protectedAt", "createdAt")
            VALUES (?, ?, 'RECOVERY_SENTINEL', 'RecoveryRehearsal', ?, '{"synthetic":true}', ?, ?, ?)`,
      args: [auditId, userId, auditId, "synthetic-rehearsal-digest", now, now],
    });
    sourceClient.close();

    await copyFile(source, backup);
    // Simulate loss of the operational database before restoring a replacement.
    await unlink(source);
    await copyFile(backup, restored);

    const restoredClient = createClient({ url: `file:${restored}` });
    const integrity = await restoredClient.execute("PRAGMA integrity_check");
    const foreignKeys = await restoredClient.execute("PRAGMA foreign_key_check");
    const sentinel = await restoredClient.execute({
      sql: `SELECT COUNT(*) AS "count" FROM "AuditLog" WHERE "id" = ? AND "action" = 'RECOVERY_SENTINEL'`,
      args: [auditId],
    });
    let updateBlocked = false;
    let deleteBlocked = false;
    try {
      await restoredClient.execute({
        sql: `UPDATE "AuditLog" SET "action" = 'TAMPERED' WHERE "id" = ?`,
        args: [auditId],
      });
    } catch {
      updateBlocked = true;
    }
    try {
      await restoredClient.execute({
        sql: `DELETE FROM "AuditLog" WHERE "id" = ?`,
        args: [auditId],
      });
    } catch {
      deleteBlocked = true;
    }
    restoredClient.close();

    const integrityOk = integrity.rows[0]?.integrity_check === "ok";
    const foreignKeysOk = foreignKeys.rows.length === 0;
    const sentinelOk = Number(sentinel.rows[0]?.count ?? 0) === 1;
    if (!integrityOk || !foreignKeysOk || !sentinelOk || !updateBlocked || !deleteBlocked) {
      throw new Error("Synthetic restore verification failed.");
    }

    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyPath = path.join(directory, "sqld-public-key.pem");
    await writeFile(publicKeyPath, publicKey.export({ type: "spki", format: "pem" }), { mode: 0o600 });
    const authToken = createRehearsalToken(privateKey);
    const port = await getFreePort();
    const url = `http://127.0.0.1:${port}`;
    server = spawn(
      "turso",
      ["dev", "--db-file", restored, "--port", String(port), "--auth-jwt-key-file", publicKeyPath],
      { cwd: directory, env: process.env, stdio: ["ignore", "pipe", "pipe"], detached: true }
    );
    await waitForServer(url, authToken, server);

    const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken }) });
    try {
      const [restoredUser, restoredAudit] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.auditLog.findUnique({ where: { id: auditId } }),
      ]);
      if (restoredUser?.email !== "synthetic-restore-rehearsal@example.invalid" || restoredAudit?.action !== "RECOVERY_SENTINEL") {
        throw new Error("Application client could not read restored sentinel state.");
      }
    } finally {
      await prisma.$disconnect();
    }

    console.log(
      JSON.stringify({
        status: "PASS",
        data: "synthetic-only",
        integrityCheck: "ok",
        foreignKeyCheck: "ok",
        sentinelRecovered: true,
        protectedAuditUpdateBlocked: true,
        protectedAuditDeleteBlocked: true,
        operationalDatabaseLossSimulated: true,
        authenticatedRemoteStyleRestore: true,
        applicationReadRestoredState: true,
      })
    );
  } finally {
    if (server) await stopProcess(server);
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "FAIL",
      reason: error instanceof Error ? error.name : "UnknownError",
    })
  );
  process.exitCode = 1;
});
