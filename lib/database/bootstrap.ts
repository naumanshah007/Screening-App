import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";
import {
  isRemoteLibSqlUrl,
  resolveDatabaseAuthToken,
  resolveDatabaseUrl,
} from "@/lib/config/database";

// Cleared on failure so the next request retries rather than re-throwing a stale rejected promise.
let bootstrapPromise: Promise<void> | null = null;
const TRUE_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

function readBooleanEnv(name: string) {
  const raw = process.env[name];
  return Boolean(raw && TRUE_ENV_VALUES.has(raw.trim().toLowerCase()));
}

function shouldBootstrapDatabase(url: string) {
  // Explicit opt-in (set on Vercel for the demo deployment)
  if (process.env.BOOTSTRAP_DEMO_DB === "1") {
    return true;
  }
  // Legacy fallback: auto-bootstrap local SQLite file on Vercel
  return process.env.VERCEL === "1" && url.startsWith("file:") && !isRemoteLibSqlUrl(url);
}

/**
 * True when this process is running against a production deployment.
 *
 * `VERCEL_ENV` is a Vercel system variable and is the authoritative signal:
 * "production" | "preview" | "development". `NODE_ENV` is NOT sufficient on its
 * own, because Vercel builds Preview deployments with NODE_ENV=production too.
 */
export function isProductionDeployment(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.VERCEL_ENV === "production";
}

/**
 * Whether demo users and demo patients may be seeded.
 *
 * R6 REMEDIATION. Previously demo seeding happened whenever
 * `shouldBootstrapDatabase()` was true — which on Vercel is true for ANY
 * `file:` database URL. A deployment with no DATABASE_URL therefore fell back to
 * an ephemeral /tmp SQLite file and then seeded demo accounts into it, using a
 * password hard-coded in this file, on every cold start. Because the seed is an
 * UPSERT that overwrites `passwordHash`, it also reset any rotated password back
 * to the hard-coded value.
 *
 * Three independent conditions are now required, and each fails closed:
 *
 *   1. `BOOTSTRAP_DEMO_DB=1` must be set explicitly. The implicit
 *      "empty database on Vercel" path no longer seeds accounts — it only
 *      creates the schema.
 *   2. `DEMO_SEED_PASSWORD` must be supplied. There is no default and no
 *      fallback: with no password, no account is created.
 *   3. The deployment must not be production. A production deployment never
 *      seeds demo accounts, even with both of the above set.
 */
export function shouldSeedDemoAccounts(
  url: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (isProductionDeployment(env)) return false;
  if (env.BOOTSTRAP_DEMO_DB !== "1") return false;
  if (!readDemoSeedPassword(env)) return false;
  // Never seed accounts into a remote/shared database from this code path.
  return !isRemoteLibSqlUrl(url);
}

/**
 * The initial password for seeded demo accounts, supplied by the operator.
 *
 * Returns undefined when absent or too weak to be a deliberate choice. The value
 * is never logged, never returned to a caller other than the seeder, and never
 * written to any response.
 */
export function readDemoSeedPassword(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const raw = env.DEMO_SEED_PASSWORD?.trim();
  if (!raw || raw.length < 12) return undefined;
  return raw;
}

function shouldApplySchemaPatches(url: string) {
  if (shouldBootstrapDatabase(url)) {
    return true;
  }

  // Vercel demo deployments may point at a persistent libSQL/Turso database.
  // Keep those databases compatible with the checked-in Prisma schema without
  // reseeding demo users unless BOOTSTRAP_DEMO_DB is explicitly enabled.
  return (
    readBooleanEnv("ENABLE_BATCH_DEMO") &&
    (process.env.VERCEL === "1" || process.env.NODE_ENV === "production")
  );
}

function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let buffer: string[] = [];
  let inTrigger = false;

  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!inTrigger && /^CREATE\s+TRIGGER\b/i.test(trimmed)) inTrigger = true;
    buffer.push(line);

    if (inTrigger) {
      if (/^END;$/i.test(trimmed)) {
        statements.push(buffer.join("\n").trim());
        buffer = [];
        inTrigger = false;
      }
      continue;
    }

    if (trimmed.endsWith(";")) {
      const statement = buffer.join("\n").trim();
      if (statement) statements.push(statement);
      buffer = [];
    }
  }

  const remainder = buffer.join("\n").trim();
  if (remainder) statements.push(remainder);
  return statements;
}

async function applyCurrentSchema(url: string) {
  const client = createClient({
    url,
    ...(resolveDatabaseAuthToken() ? { authToken: resolveDatabaseAuthToken() } : {}),
  });

  try {
    const schemaSql = readFileSync(
      join(process.cwd(), "lib", "database", "current-schema.sql"),
      "utf8"
    );

    for (const statement of splitSqlStatements(schemaSql)) {
      await client.execute(statement);
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

async function tableExists(
  client: ReturnType<typeof createClient>,
  tableName: string
) {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [tableName],
  });

  return result.rows.length > 0;
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

async function applyBatchSchemaPatches(client: ReturnType<typeof createClient>) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "BatchRun" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "source" TEXT NOT NULL,
      "sourceSystem" TEXT,
      "sourceFileName" TEXT,
      "engineVersion" TEXT NOT NULL,
      "totalCases" INTEGER NOT NULL,
      "pendingCount" INTEGER NOT NULL DEFAULT 0,
      "acceptedCount" INTEGER NOT NULL DEFAULT 0,
      "rejectedCount" INTEGER NOT NULL DEFAULT 0,
      "needsInfoCount" INTEGER NOT NULL DEFAULT 0,
      "reviewRequiredCount" INTEGER NOT NULL DEFAULT 0,
      "createdByUserId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "BatchRun_createdByUserId_fkey"
        FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "BatchReviewItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "batchRunId" TEXT NOT NULL,
      "rowNumber" INTEGER NOT NULL,
      "label" TEXT,
      "externalPatientId" TEXT,
      "patientAge" INTEGER,
      "ethnicityPrimary" TEXT,
      "patientName" TEXT,
      "nhi" TEXT,
      "gpPractice" TEXT,
      "receivedDate" DATETIME,
      "figure" TEXT NOT NULL,
      "riskLevel" TEXT NOT NULL,
      "recommendationCode" TEXT NOT NULL,
      "recommendation" TEXT NOT NULL,
      "referralPriority" TEXT,
      "referralType" TEXT,
      "safetyOutcome" TEXT,
      "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
      "engineStatus" TEXT NOT NULL DEFAULT 'success',
      "caseJson" TEXT NOT NULL,
      "inputJson" TEXT NOT NULL,
      "decisionJson" TEXT NOT NULL,
      "disposition" TEXT NOT NULL DEFAULT 'PENDING',
      "reviewedByUserId" TEXT,
      "reviewedAt" DATETIME,
      "reviewNote" TEXT,
      "overrideReason" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "BatchReviewItem_batchRunId_fkey"
        FOREIGN KEY ("batchRunId") REFERENCES "BatchRun" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "BatchReviewItem_reviewedByUserId_fkey"
        FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);

  const batchRunColumns = await getTableColumns(client, "BatchRun");
  await addColumnIfMissing(
    client,
    "BatchRun",
    batchRunColumns,
    "reviewRequiredCount",
    "INTEGER NOT NULL DEFAULT 0"
  );
  await addColumnIfMissing(
    client,
    "BatchRun",
    batchRunColumns,
    "sourceSystem",
    "TEXT"
  );
  await addColumnIfMissing(
    client,
    "BatchRun",
    batchRunColumns,
    "sourceFileName",
    "TEXT"
  );

  const batchReviewColumns = await getTableColumns(client, "BatchReviewItem");
  await addColumnIfMissing(
    client,
    "BatchReviewItem",
    batchReviewColumns,
    "patientName",
    "TEXT"
  );
  await addColumnIfMissing(
    client,
    "BatchReviewItem",
    batchReviewColumns,
    "nhi",
    "TEXT"
  );
  await addColumnIfMissing(
    client,
    "BatchReviewItem",
    batchReviewColumns,
    "gpPractice",
    "TEXT"
  );
  await addColumnIfMissing(
    client,
    "BatchReviewItem",
    batchReviewColumns,
    "receivedDate",
    "DATETIME"
  );

  await client.execute(
    `CREATE INDEX IF NOT EXISTS "BatchRun_createdByUserId_createdAt_idx"
     ON "BatchRun"("createdByUserId", "createdAt")`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "BatchRun_source_createdAt_idx"
     ON "BatchRun"("source", "createdAt")`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "BatchReviewItem_batchRunId_disposition_idx"
     ON "BatchReviewItem"("batchRunId", "disposition")`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "BatchReviewItem_batchRunId_reviewRequired_idx"
     ON "BatchReviewItem"("batchRunId", "reviewRequired")`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "BatchReviewItem_reviewedByUserId_reviewedAt_idx"
     ON "BatchReviewItem"("reviewedByUserId", "reviewedAt")`
  );
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

    if (await tableExists(client, "User")) {
      await applyBatchSchemaPatches(client);
    }
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
    // R6: no hard-coded password. The operator supplies DEMO_SEED_PASSWORD; the
    // caller has already verified it is present via shouldSeedDemoAccounts().
    // The value is never logged or echoed.
    const seedPassword = readDemoSeedPassword();
    if (!seedPassword) {
      throw new Error(
        "Demo account seeding requires DEMO_SEED_PASSWORD (minimum 12 characters). No account was created."
      );
    }
    const passwordHash = await bcrypt.hash(seedPassword, 10);
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

async function seedDemoPatients(url: string) {
  const client = createClient({
    url,
    ...(resolveDatabaseAuthToken() ? { authToken: resolveDatabaseAuthToken() } : {}),
  });

  try {
    const now = new Date().toISOString();
    const patients = [
      {
        id: "demo-patient-mary",
        nhi: "ZZZ0001",
        firstName: "Mary",
        lastName: "Johnson",
        dateOfBirth: "1985-03-15T00:00:00.000Z",
        email: "mary.johnson@example.test",
        phone: "0215550101",
        address: "12 Queen Street, Auckland",
        gpPracticeId: "demo-practice-auckland",
        isFirstTimeHPVTransition: false,
        previousScreeningType: null,
        isPostHysterectomy: false,
      },
      {
        id: "demo-patient-patricia",
        nhi: "ZZZ0002",
        firstName: "Patricia",
        lastName: "Williams",
        dateOfBirth: "1978-07-22T00:00:00.000Z",
        email: "patricia.williams@example.test",
        phone: "0215550102",
        address: "44 Manukau Road, Auckland",
        gpPracticeId: "demo-practice-auckland",
        isFirstTimeHPVTransition: true,
        previousScreeningType: "CYTOLOGY",
        isPostHysterectomy: false,
      },
      {
        id: "demo-patient-linda",
        nhi: "ZZZ0003",
        firstName: "Linda",
        lastName: "Brown",
        dateOfBirth: "1962-11-08T00:00:00.000Z",
        email: "linda.brown@example.test",
        phone: "0215550103",
        address: "8 Lake Road, Takapuna",
        gpPracticeId: "demo-practice-auckland",
        isFirstTimeHPVTransition: false,
        previousScreeningType: null,
        isPostHysterectomy: true,
      },
      {
        id: "demo-patient-hine",
        nhi: "CMH1001",
        firstName: "Hine",
        lastName: "Tuhoe",
        dateOfBirth: "1990-06-12T00:00:00.000Z",
        email: "hine.tuhoe@example.test",
        phone: "0215550201",
        address: "21 Great South Road, Manukau",
        gpPracticeId: "demo-practice-counties",
        isFirstTimeHPVTransition: false,
        previousScreeningType: null,
        isPostHysterectomy: false,
      },
      {
        id: "demo-patient-anika",
        nhi: "CMH1002",
        firstName: "Anika",
        lastName: "Prasad",
        dateOfBirth: "1975-02-28T00:00:00.000Z",
        email: "anika.prasad@example.test",
        phone: "0215550202",
        address: "90 Cavendish Drive, Manukau",
        gpPracticeId: "demo-practice-counties",
        isFirstTimeHPVTransition: true,
        previousScreeningType: "CYTOLOGY",
        isPostHysterectomy: false,
      },
      {
        id: "demo-patient-mei",
        nhi: "CMH1003",
        firstName: "Mei",
        lastName: "Wong",
        dateOfBirth: "1988-09-14T00:00:00.000Z",
        email: "mei.wong@example.test",
        phone: "0215550203",
        address: "7 Broadway, Papakura",
        gpPracticeId: "demo-practice-counties",
        isFirstTimeHPVTransition: false,
        previousScreeningType: null,
        isPostHysterectomy: false,
      },
    ] as const;

    for (const patient of patients) {
      await client.execute({
        sql: `INSERT INTO Patient
          (id, nhi, firstName, lastName, dateOfBirth, email, phone, address,
           gpPracticeId, status, isFirstTimeHPVTransition, previousScreeningType,
           isPostHysterectomy, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)
          ON CONFLICT(nhi) DO UPDATE SET
            firstName = excluded.firstName,
            lastName = excluded.lastName,
            email = excluded.email,
            phone = excluded.phone,
            address = excluded.address,
            gpPracticeId = excluded.gpPracticeId,
            isFirstTimeHPVTransition = excluded.isFirstTimeHPVTransition,
            previousScreeningType = excluded.previousScreeningType,
            isPostHysterectomy = excluded.isPostHysterectomy,
            updatedAt = excluded.updatedAt`,
        args: [
          patient.id,
          patient.nhi,
          patient.firstName,
          patient.lastName,
          patient.dateOfBirth,
          patient.email,
          patient.phone,
          patient.address,
          patient.gpPracticeId,
          patient.isFirstTimeHPVTransition,
          patient.previousScreeningType,
          patient.isPostHysterectomy,
          now,
          now,
        ],
      });

      await client.execute({
        sql: `INSERT OR IGNORE INTO MedicalHistory
          (id, patientId, previousHighGradeLesion, immunocompromised, hiv,
           atypicalEndometrialHistory, createdAt, updatedAt)
          VALUES (?, ?, 0, 0, 0, 0, ?, ?)`,
        args: [`${patient.id}-history`, patient.id, now, now],
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
  // Schema creation and demo-account seeding are deliberately separate concerns.
  // Creating tables in an empty database is harmless; creating login accounts is
  // not. See shouldSeedDemoAccounts().
  const seedDemoAccounts = shouldSeedDemoAccounts(url);

  if (!shouldApplySchemaPatches(url)) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      if (!(await databaseHasSchema(url))) {
        await applyCurrentSchema(url);
      }
      await applyCompatibilityPatches(url);
      if (seedDemoAccounts) {
        await seedDemoUsers(url);
        await seedDemoPatients(url);
      }
    })().catch((err) => {
      // Clear so the next request retries from scratch
      bootstrapPromise = null;
      throw err;
    });
  }

  await bootstrapPromise;
}
