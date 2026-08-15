import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type Client } from "@libsql/client";

export const ACCEPTED_SPRINT_A_MIGRATION = "20260815160000_sprint_a_pilot_integrity";
export const SPRINT_B_MIGRATION = "20260815193000_sprint_b_real_data_security_boundary";
export const PERFORMANCE_READ_INDEX_MIGRATION = "20260816100000_performance_read_indexes";

type MigrationFile = {
  name: string;
  checksum: string;
  sql: string;
};

type AppliedMigration = {
  migration_name: string;
  checksum: string;
  finished_at: string | null;
  rolled_back_at: string | null;
};

export type RemoteMigrationResult = {
  status: "PASS";
  target: "remote-libsql";
  appliedBefore: number;
  appliedNow: string[];
  appliedAfter: number;
  finalMigration: string;
  approvalReference: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function validateTarget(url: string, allowLoopback: boolean) {
  const parsed = new URL(url);
  if (!new Set(["libsql:", "https:", "http:", "wss:", "ws:"]).has(parsed.protocol)) {
    throw new Error("Pilot migration target must be a remote libSQL/HTTP/WebSocket URL.");
  }
  if (isLoopbackHostname(parsed.hostname) && !allowLoopback) {
    throw new Error("Loopback libSQL is allowed only for an explicit isolated C0 rehearsal.");
  }
  return parsed;
}

async function readMigrationFiles(rootDir: string): Promise<MigrationFile[]> {
  const migrationsDir = path.join(rootDir, "prisma", "migrations");
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(path.join(migrationsDir, name, "migration.sql"), "utf8");
      return { name, sql, checksum: sha256(sql) };
    })
  );
}

async function readAppliedMigrations(client: Client): Promise<AppliedMigration[]> {
  const result = await client.execute(
    `SELECT migration_name, checksum, finished_at, rolled_back_at
       FROM _prisma_migrations
      ORDER BY started_at ASC, migration_name ASC`
  );
  return result.rows.map((row) => ({
    migration_name: String(row.migration_name),
    checksum: String(row.checksum),
    finished_at: row.finished_at == null ? null : String(row.finished_at),
    rolled_back_at: row.rolled_back_at == null ? null : String(row.rolled_back_at),
  }));
}

function validateHistory(files: MigrationFile[], applied: AppliedMigration[]) {
  if (files.length === 0) throw new Error("No migration files were found.");
  if (!files.some((file) => file.name === ACCEPTED_SPRINT_A_MIGRATION)) {
    throw new Error("The accepted Sprint A migration is missing from the checked-in migration chain.");
  }

  for (const [index, row] of applied.entries()) {
    if (!row.finished_at || row.rolled_back_at) {
      throw new Error(`Migration ${row.migration_name} is incomplete or rolled back.`);
    }
    const expected = files[index];
    if (!expected || expected.name !== row.migration_name) {
      throw new Error("Applied migration history is not an exact prefix of the checked-in chain.");
    }
    if (expected.checksum !== row.checksum) {
      throw new Error(`Checksum mismatch for applied migration ${row.migration_name}.`);
    }
  }

  const acceptedIndex = files.findIndex((file) => file.name === ACCEPTED_SPRINT_A_MIGRATION);
  if (applied.length < acceptedIndex + 1) {
    throw new Error("Target database has not reached the accepted Sprint A migration baseline.");
  }
}

async function applyMigration(client: Client, migration: MigrationFile) {
  const transaction = await client.transaction("write");
  try {
    await transaction.executeMultiple(migration.sql);
    const completedAt = new Date().toISOString();
    await transaction.execute({
      sql: `INSERT INTO _prisma_migrations
              (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
            VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
      args: [randomUUID(), migration.checksum, completedAt, migration.name, completedAt],
    });
    await transaction.commit();
  } finally {
    transaction.close();
  }
}

export async function deployRemoteLibsqlMigrations(args: {
  url: string;
  authToken: string;
  approvalReference: string;
  rootDir?: string;
  allowLoopback?: boolean;
}): Promise<RemoteMigrationResult> {
  const url = args.url.trim();
  const authToken = args.authToken.trim();
  const approvalReference = args.approvalReference.trim();
  validateTarget(url, Boolean(args.allowLoopback));
  if (!authToken) throw new Error("A remote libSQL authentication token is required.");
  if (!approvalReference) throw new Error("A migration approval/change reference is required.");

  const files = await readMigrationFiles(args.rootDir ?? process.cwd());
  const client = createClient({ url, authToken });
  try {
    const applied = await readAppliedMigrations(client);
    validateHistory(files, applied);
    const pending = files.slice(applied.length);
    for (const migration of pending) await applyMigration(client, migration);

    const finalHistory = await readAppliedMigrations(client);
    validateHistory(files, finalHistory);
    if (finalHistory.length !== files.length) {
      throw new Error("Remote migration history did not reach the complete checked-in chain.");
    }

    return {
      status: "PASS",
      target: "remote-libsql",
      appliedBefore: applied.length,
      appliedNow: pending.map((migration) => migration.name),
      appliedAfter: finalHistory.length,
      finalMigration: files.at(-1)!.name,
      approvalReference,
    };
  } finally {
    client.close();
  }
}

async function main() {
  const url = process.env.PILOT_MIGRATION_DATABASE_URL?.trim();
  const authToken = process.env.PILOT_MIGRATION_AUTH_TOKEN?.trim();
  const approvalReference = process.env.PILOT_MIGRATION_APPROVAL_ID?.trim();
  if (!url || !authToken || !approvalReference) {
    throw new Error(
      "PILOT_MIGRATION_DATABASE_URL, PILOT_MIGRATION_AUTH_TOKEN, and PILOT_MIGRATION_APPROVAL_ID are required."
    );
  }

  const result = await deployRemoteLibsqlMigrations({
    url,
    authToken,
    approvalReference,
    allowLoopback: process.env.C0_ALLOW_LOOPBACK_LIBSQL === "1",
  });
  console.log(JSON.stringify(result));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Remote migration deployment failed.");
    process.exit(1);
  });
}
