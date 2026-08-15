/**
 * Synthetic, isolated backup/restore rehearsal for the pilot runbook.
 *
 * This never opens the configured application database. It creates a fresh
 * database beneath the OS temp directory, closes it, copies it as a backup,
 * restores to a second file, validates integrity/evidence, then removes all
 * three files. Provider-managed remote restore remains an external gate.
 */
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createClient } from "@libsql/client";

async function main() {
  const directory = await mkdtemp(path.join(tmpdir(), "cervigrade-restore-rehearsal-"));
  const source = path.join(directory, "source.db");
  const backup = path.join(directory, "backup.db");
  const restored = path.join(directory, "restored.db");

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

    console.log(
      JSON.stringify({
        status: "PASS",
        data: "synthetic-only",
        integrityCheck: "ok",
        foreignKeyCheck: "ok",
        sentinelRecovered: true,
        protectedAuditUpdateBlocked: true,
        protectedAuditDeleteBlocked: true,
      })
    );
  } finally {
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
