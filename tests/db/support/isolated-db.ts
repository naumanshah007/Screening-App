/**
 * An isolated, throwaway SQLite database for authority tests.
 *
 * The application's Prisma client resolves DATABASE_URL at module load and runs
 * `ensureDatabaseReady()` (lib/database/bootstrap.ts) on first query, which
 * creates the real schema. So the isolation strategy is: point DATABASE_URL at a
 * fresh temp file BEFORE importing anything that pulls in `@/lib/prisma`, then
 * let the application's own bootstrap build the schema.
 *
 * Nothing here touches a shared or production database. The file lives in the OS
 * temp directory and is removed afterwards.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export type IsolatedDatabase = {
  directory: string;
  url: string;
  file: string;
  cleanup: () => void;
};

/**
 * Point the process at a fresh database file. MUST be called before the first
 * import of any module that transitively imports `@/lib/prisma`.
 */
export function createIsolatedDatabase(label: string): IsolatedDatabase {
  const directory = mkdtempSync(path.join(tmpdir(), `cervigrade-${label}-`));
  const file = path.join(directory, "test.db");
  const url = `file:${file}`;
  process.env.DATABASE_URL = url;
  // Ensure no ambient remote database can be picked up by resolveDatabaseUrl().
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.LIBSQL_AUTH_TOKEN;
  delete process.env.VERCEL;
  return {
    directory,
    url,
    file,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

/**
 * Create the real schema in the isolated file from `lib/database/current-schema.sql`
 * — the same DDL the application ships — so these tests run against the real
 * tables rather than a hand-written approximation.
 */
export async function applySchema(file: string) {
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: `file:${file}` });
  const ddl = readFileSync(path.join(process.cwd(), "lib/database/current-schema.sql"), "utf8");
  for (const statement of splitSqlStatements(ddl)) {
    await client.execute(statement);
  }
  client.close();
}

/**
 * Split SQL on `;`, except inside a `CREATE TRIGGER ... BEGIN ... END;` body,
 * whose internal semicolons do not terminate the statement.
 *
 * The immutability triggers matter here: they are what stop a test — or a bug —
 * from updating or deleting an evaluated snapshot, so the isolated database must
 * carry them exactly as production does.
 */
export function splitSqlStatements(ddl: string): string[] {
  const statements: string[] = [];
  let current = "";
  let insideTriggerBody = false;

  for (const rawLine of ddl.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("--")) continue;

    current += `${rawLine}\n`;

    if (/^BEGIN\b/i.test(line)) {
      insideTriggerBody = true;
      continue;
    }
    if (insideTriggerBody) {
      if (/^END\s*;/i.test(line)) {
        insideTriggerBody = false;
        statements.push(current.trim().replace(/;$/, ""));
        current = "";
      }
      continue;
    }
    if (line.endsWith(";")) {
      statements.push(current.trim().replace(/;$/, ""));
      current = "";
    }
  }

  const trailing = current.trim();
  if (trailing.length > 0) statements.push(trailing);
  return statements;
}

export const TEST_RULE_SET_KEY = "cervigrade-ncsp-national";

type AnyPrisma = {
  clinicalRuleSet: { upsert: (args: unknown) => Promise<{ id: string }> };
  clinicalRuleVersion: { create: (args: unknown) => Promise<{ id: string }> };
  ruleSetActivation: { create: (args: unknown) => Promise<{ id: string }>; update: (args: unknown) => Promise<unknown> };
  ruleEvaluation: { create: (args: unknown) => Promise<{ id: string }> };
};

export async function seedRuleSet(prisma: AnyPrisma) {
  return prisma.clinicalRuleSet.upsert({
    where: { key: TEST_RULE_SET_KEY },
    update: {},
    create: { key: TEST_RULE_SET_KEY, name: "Test national rule set" },
  });
}

export async function seedVersion(
  prisma: AnyPrisma,
  args: {
    ruleSetId: string;
    displayVersion: string;
    status: string;
    checksum?: string | null;
    patch?: number;
  }
) {
  return prisma.clinicalRuleVersion.create({
    data: {
      ruleSetId: args.ruleSetId,
      versionMajor: 3,
      versionMinor: 1,
      versionPatch: args.patch ?? 0,
      displayVersion: args.displayVersion,
      status: args.status,
      sourceGuidelineSummary: "isolated test version",
      snapshotJson: "{}",
      checksum: args.checksum === undefined ? "checksum-abc" : args.checksum,
    },
  });
}

export async function seedActivation(
  prisma: AnyPrisma,
  args: {
    ruleSetId: string;
    ruleVersionId: string;
    environment: string;
    organisationKey?: string | null;
    deactivatedAt?: Date | null;
  }
) {
  return prisma.ruleSetActivation.create({
    data: {
      ruleSetId: args.ruleSetId,
      ruleVersionId: args.ruleVersionId,
      environment: args.environment,
      organisationKey: args.organisationKey ?? null,
      isDefault: true,
      activatedAt: new Date(),
      deactivatedAt: args.deactivatedAt ?? null,
      reason: "isolated test activation",
    },
  });
}

/** A patient plus a referral case, satisfying the schema's required fields. */
export async function seedReferralCase(
  prisma: {
    user: { create: (args: unknown) => Promise<{ id: string }> };
    patient: { create: (args: unknown) => Promise<{ id: string }> };
    referralCase: { create: (args: unknown) => Promise<{ id: string }> };
  },
  label: string
) {
  const user = await prisma.user.create({
    data: { email: `${label}-${Date.now()}@example.test`, name: "Test user", role: "ADMIN" },
  });
  const patient = await prisma.patient.create({
    data: {
      nhi: `T${label.slice(0, 3).toUpperCase()}${Date.now().toString().slice(-4)}`,
      firstName: "Test",
      lastName: label,
      dateOfBirth: new Date("1980-01-01"),
    },
  });
  const referralCase = await prisma.referralCase.create({
    data: { patientId: patient.id, serviceLine: "COLPOSCOPY", createdByUserId: user.id },
  });
  return { user, patient, referralCase };
}
