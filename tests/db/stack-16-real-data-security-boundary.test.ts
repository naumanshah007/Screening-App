import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import { createClient } from "@libsql/client";

import {
  createIsolatedDatabase,
  splitSqlStatements,
} from "./support/isolated-db";

const database = createIsolatedDatabase("sprint-b-security-boundary");
const client = createClient({ url: database.url });

after(() => {
  client.close();
  database.cleanup();
});

test("Sprint B migration upgrades an accepted-shape database additively", async () => {
  await client.executeMultiple(`
    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
    CREATE TABLE "AuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "action" TEXT NOT NULL,
      "entity" TEXT NOT NULL,
      "entityId" TEXT,
      "oldValue" TEXT,
      "newValue" TEXT,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "exportEvent" BOOLEAN NOT NULL DEFAULT false,
      "severity" TEXT NOT NULL DEFAULT 'INFO',
      "correlationId" TEXT,
      "sessionId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
    );
    INSERT INTO "User" ("id", "email", "updatedAt")
      VALUES ('existing-user', 'existing@example.invalid', CURRENT_TIMESTAMP);
    INSERT INTO "AuditLog" ("id", "userId", "action", "entity")
      VALUES ('legacy-audit', 'existing-user', 'LEGACY_EVENT', 'Legacy');
  `);

  const migration = readFileSync(
    path.join(
      process.cwd(),
      "prisma/migrations/20260815193000_sprint_b_real_data_security_boundary/migration.sql"
    ),
    "utf8"
  );
  for (const statement of splitSqlStatements(migration)) {
    await client.execute(statement);
  }

  const user = await client.execute(
    `SELECT "id", "sessionVersion" FROM "User" WHERE "id" = 'existing-user'`
  );
  assert.equal(user.rows[0]?.id, "existing-user");
  assert.equal(Number(user.rows[0]?.sessionVersion), 0);

  const legacy = await client.execute(
    `SELECT "action", "integrityDigest", "protectedAt" FROM "AuditLog" WHERE "id" = 'legacy-audit'`
  );
  assert.equal(legacy.rows[0]?.action, "LEGACY_EVENT");
  assert.equal(legacy.rows[0]?.integrityDigest, null);
  assert.equal(legacy.rows[0]?.protectedAt, null);
});

test("protected audit evidence rejects update and delete while legacy rows remain resettable", async () => {
  await client.execute(`UPDATE "AuditLog" SET "action" = 'LEGACY_CORRECTED' WHERE "id" = 'legacy-audit'`);
  assert.equal(
    (await client.execute(`SELECT "action" FROM "AuditLog" WHERE "id" = 'legacy-audit'`)).rows[0]
      ?.action,
    "LEGACY_CORRECTED"
  );

  await client.execute(`
    INSERT INTO "AuditLog" ("id", "userId", "action", "entity", "integrityDigest", "protectedAt")
    VALUES ('protected-audit', 'existing-user', 'PHI_RECORD_READ', 'Patient', 'sha256-digest', CURRENT_TIMESTAMP)
  `);
  await assert.rejects(
    client.execute(`UPDATE "AuditLog" SET "action" = 'TAMPERED' WHERE "id" = 'protected-audit'`),
    /Protected audit evidence is immutable/
  );
  await assert.rejects(
    client.execute(`DELETE FROM "AuditLog" WHERE "id" = 'protected-audit'`),
    /Protected audit evidence is immutable/
  );
});

test("current schema carries session revocation and protected-audit triggers", () => {
  const schema = readFileSync(
    path.join(process.cwd(), "lib/database/current-schema.sql"),
    "utf8"
  );
  assert.match(schema, /"sessionVersion" INTEGER NOT NULL DEFAULT 0/);
  assert.match(schema, /CREATE TRIGGER "AuditLog_protected_update"/);
  assert.match(schema, /CREATE TRIGGER "AuditLog_protected_delete"/);
});
