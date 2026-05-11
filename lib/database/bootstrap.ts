import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  isRemoteLibSqlUrl,
  resolveDatabaseAuthToken,
  resolveDatabaseUrl,
} from "@/lib/config/database";

let bootstrapPromise: Promise<void> | null = null;

function shouldBootstrapLocalDatabase(url: string) {
  return process.env.VERCEL === "1" && url.startsWith("file:") && !isRemoteLibSqlUrl(url);
}

function splitSqlStatements(sql: string) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function applyMigrations(url: string) {
  const client = createClient({
    url,
    ...(resolveDatabaseAuthToken() ? { authToken: resolveDatabaseAuthToken() } : {}),
  });

  try {
    const migrationRoot = join(process.cwd(), "prisma", "migrations");
    const migrations = readdirSync(migrationRoot)
      .sort()
      .map((directory) => join(migrationRoot, directory, "migration.sql"))
      .filter((path) => existsSync(path));

    for (const migration of migrations) {
      const sql = readFileSync(migration, "utf8");
      for (const statement of splitSqlStatements(sql)) {
        await client.execute(statement);
      }
    }
  } finally {
    client.close();
  }
}

async function getTableColumns(
  client: ReturnType<typeof createClient>,
  tableName: string
) {
  const result = await client.execute({
    sql: `PRAGMA table_info("${tableName}")`,
    args: [],
  });

  return new Set(result.rows.map((row) => String(row.name)));
}

async function addColumnIfMissing(
  client: ReturnType<typeof createClient>,
  tableName: string,
  columns: Set<string>,
  columnName: string,
  definition: string
) {
  if (columns.has(columnName)) {
    return;
  }

  await client.execute(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`);
  columns.add(columnName);
}

async function applyCompatibilityPatches(url: string) {
  const client = createClient({
    url,
    ...(resolveDatabaseAuthToken() ? { authToken: resolveDatabaseAuthToken() } : {}),
  });

  try {
    const userColumns = await getTableColumns(client, "User");
    await addColumnIfMissing(
      client,
      "User",
      userColumns,
      "passwordChangeRequired",
      "BOOLEAN NOT NULL DEFAULT false"
    );
    await addColumnIfMissing(
      client,
      "User",
      userColumns,
      "passwordChangedAt",
      "DATETIME"
    );
    await addColumnIfMissing(
      client,
      "User",
      userColumns,
      "passwordExpiresAt",
      "DATETIME"
    );
    await addColumnIfMissing(
      client,
      "User",
      userColumns,
      "twoFARecoveryCodesJson",
      "TEXT"
    );

    const auditColumns = await getTableColumns(client, "AuditLog");
    await addColumnIfMissing(
      client,
      "AuditLog",
      auditColumns,
      "severity",
      "TEXT NOT NULL DEFAULT 'INFO'"
    );
    await addColumnIfMissing(
      client,
      "AuditLog",
      auditColumns,
      "correlationId",
      "TEXT"
    );
    await addColumnIfMissing(
      client,
      "AuditLog",
      auditColumns,
      "sessionId",
      "TEXT"
    );
  } finally {
    client.close();
  }
}

async function seedDemoUsers(url: string) {
  const client = createClient({
    url,
    ...(resolveDatabaseAuthToken() ? { authToken: resolveDatabaseAuthToken() } : {}),
  });

  try {
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash("admin123", 10);
    const practiceId = "demo-practice-auckland";
    const cmPracticeId = "demo-practice-counties";

    await client.execute({
      sql: `INSERT OR IGNORE INTO GPPractice
        (id, name, address, dhbRegion, hpiNumber, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        practiceId,
        "Auckland City Medical Centre",
        "123 Queen Street, Auckland 1010",
        "Auckland",
        "G00001",
        now,
        now,
      ],
    });

    await client.execute({
      sql: `INSERT OR IGNORE INTO GPPractice
        (id, name, address, dhbRegion, hpiNumber, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        cmPracticeId,
        "Manukau SuperClinic",
        "901 Great South Road, Manukau 2104",
        "Counties Manukau",
        "G00042",
        now,
        now,
      ],
    });

    const users = [
      ["demo-user-admin", "admin@cs.nz", "System Admin", "ADMIN", null],
      ["demo-user-clinician", "clinician@cs.nz", "Dr. Sarah Smith", "GP", practiceId],
      ["demo-user-coordinator", "coordinator@cs.nz", "Jane Coordinator", "COORDINATOR", null],
      ["demo-user-specialist", "specialist@cs.nz", "Dr. James Colposcopy", "COLPOSCOPIST", practiceId],
      ["demo-user-gynae", "gynae.grader@cs.nz", "Dr. Priya Sharma", "GYNAE_GRADER", null],
      ["demo-user-smo", "smo@cs.nz", "Dr. Jasveen Kaur", "SMO_REVIEWER", null],
      ["demo-user-integration", "integration.admin@cs.nz", "Alicia Integration", "INTEGRATION_ADMIN", null],
      ["demo-user-gp-manukau", "gp.manukau@cs.nz", "Dr. Aroha Te Ahu", "GP", cmPracticeId],
    ] as const;

    for (const [id, email, name, role, gpPracticeId] of users) {
      await client.execute({
        sql: `INSERT INTO User
          (id, email, name, passwordHash, passwordChangeRequired, passwordChangedAt,
           passwordExpiresAt, role, twoFAEnabled, failedAttempts, gpPracticeId, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 0, ?, ?, ?, 0, 0, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            passwordHash = excluded.passwordHash,
            passwordChangeRequired = 0,
            role = excluded.role,
            name = excluded.name,
            failedAttempts = 0,
            lockedUntil = NULL,
            updatedAt = excluded.updatedAt`,
        args: [
          id,
          email,
          name,
          passwordHash,
          new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
          new Date(Date.now() + 69 * 24 * 60 * 60 * 1000).toISOString(),
          role,
          gpPracticeId,
          now,
          now,
        ],
      });
    }
  } finally {
    client.close();
  }
}

async function databaseHasSchema(url: string) {
  const client = createClient({
    url,
    ...(resolveDatabaseAuthToken() ? { authToken: resolveDatabaseAuthToken() } : {}),
  });

  try {
    const result = await client.execute({
      sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'",
      args: [],
    });
    return result.rows.length > 0;
  } finally {
    client.close();
  }
}

export async function ensureDatabaseReady() {
  const url = resolveDatabaseUrl();
  if (!shouldBootstrapLocalDatabase(url)) {
    return;
  }

  bootstrapPromise ??= (async () => {
    if (!(await databaseHasSchema(url))) {
      await applyMigrations(url);
    }
    await applyCompatibilityPatches(url);
    await seedDemoUsers(url);
  })();

  await bootstrapPromise;
}
