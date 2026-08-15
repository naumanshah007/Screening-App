/** Apply every checked-in SQL migration to a fresh synthetic database. */
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createClient } from "@libsql/client";

async function main() {
  const directory = await mkdtemp(path.join(tmpdir(), "cervigrade-migration-chain-"));
  const client = createClient({ url: `file:${path.join(directory, "fresh.db")}` });
  try {
    const root = path.join(process.cwd(), "prisma", "migrations");
    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const entry of entries) {
      const sql = await readFile(path.join(root, entry, "migration.sql"), "utf8");
      await client.executeMultiple(sql);
    }

    const integrity = await client.execute("PRAGMA integrity_check");
    const userColumns = await client.execute(`PRAGMA table_info("User")`);
    const auditColumns = await client.execute(`PRAGMA table_info("AuditLog")`);
    const triggers = await client.execute(
      `SELECT "name" FROM sqlite_master WHERE "type" = 'trigger' AND "name" LIKE 'AuditLog_protected_%' ORDER BY "name"`
    );
    const userColumnNames = new Set(userColumns.rows.map((row) => String(row.name)));
    const auditColumnNames = new Set(auditColumns.rows.map((row) => String(row.name)));
    const triggerNames = new Set(triggers.rows.map((row) => String(row.name)));
    if (
      integrity.rows[0]?.integrity_check !== "ok" ||
      !userColumnNames.has("sessionVersion") ||
      !auditColumnNames.has("integrityDigest") ||
      !auditColumnNames.has("protectedAt") ||
      !triggerNames.has("AuditLog_protected_update") ||
      !triggerNames.has("AuditLog_protected_delete")
    ) {
      throw new Error("Fresh migration-chain verification failed.");
    }

    console.log(
      JSON.stringify({
        status: "PASS",
        migrationsApplied: entries.length,
        integrityCheck: "ok",
        sprintBSecuritySchema: true,
      })
    );
  } finally {
    client.close();
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
