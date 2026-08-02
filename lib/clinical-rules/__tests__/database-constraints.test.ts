import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function databaseWithCurrentSchema() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "cervigrade-rule-constraints-"));
  const database = path.join(directory, "constraints.db");
  const schema = readFileSync(path.join(process.cwd(), "lib/database/current-schema.sql"), "utf8");
  execFileSync("sqlite3", [database], { input: schema });
  return { directory, database };
}

test("database rejects mutation of a published clinical snapshot", () => {
  const { directory, database } = databaseWithCurrentSchema();
  try {
    execFileSync("sqlite3", [database], {
      input: `
        INSERT INTO ClinicalRuleSet (id, key, name, scope, createdAt, updatedAt)
        VALUES ('set-1', 'national', 'National', 'GLOBAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        INSERT INTO ClinicalRuleVersion (
          id, ruleSetId, versionMajor, versionMinor, versionPatch, displayVersion,
          status, sourceGuidelineSummary, snapshotJson, checksum, updatedAt
        ) VALUES (
          'version-1', 'set-1', 3, 0, 0, 'CG-NCSP-3.0.0', 'PUBLISHED',
          'Verified sources', '{}', 'checksum-1', CURRENT_TIMESTAMP
        );
      `,
    });
    assert.throws(
      () => execFileSync("sqlite3", [database, "UPDATE ClinicalRuleVersion SET snapshotJson = '{\"changed\":true}' WHERE id = 'version-1';"], { stdio: ["pipe", "pipe", "pipe"] }),
      /Published clinical rule versions are immutable/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("database permits only one live default activation for a scope and environment", () => {
  const { directory, database } = databaseWithCurrentSchema();
  try {
    execFileSync("sqlite3", [database], {
      input: `
        INSERT INTO ClinicalRuleSet (id, key, name, scope, createdAt, updatedAt)
        VALUES ('set-1', 'national', 'National', 'GLOBAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        INSERT INTO ClinicalRuleVersion (
          id, ruleSetId, versionMajor, versionMinor, versionPatch, displayVersion,
          status, sourceGuidelineSummary, snapshotJson, checksum, updatedAt
        ) VALUES
          ('version-1', 'set-1', 3, 0, 0, 'CG-NCSP-3.0.0', 'PUBLISHED', 'Sources', '{}', 'one', CURRENT_TIMESTAMP),
          ('version-2', 'set-1', 3, 0, 1, 'CG-NCSP-3.0.1', 'PUBLISHED', 'Sources', '{}', 'two', CURRENT_TIMESTAMP);
        INSERT INTO RuleSetActivation (
          id, ruleSetId, ruleVersionId, organisationKey, environment, isDefault, reason
        ) VALUES ('activation-1', 'set-1', 'version-1', NULL, 'DEMO', 1, 'Initial');
      `,
    });
    assert.throws(
      () => execFileSync("sqlite3", [database, "INSERT INTO RuleSetActivation (id, ruleSetId, ruleVersionId, organisationKey, environment, isDefault, reason) VALUES ('activation-2', 'set-1', 'version-2', NULL, 'DEMO', 1, 'Conflict');"], { stdio: ["pipe", "pipe", "pipe"] }),
      /UNIQUE constraint failed/
    );
    execFileSync("sqlite3", [database, "UPDATE RuleSetActivation SET deactivatedAt = CURRENT_TIMESTAMP WHERE id = 'activation-1'; INSERT INTO RuleSetActivation (id, ruleSetId, ruleVersionId, organisationKey, environment, isDefault, reason) VALUES ('activation-2', 'set-1', 'version-2', NULL, 'DEMO', 1, 'Controlled switch');"]);
    const count = execFileSync("sqlite3", [database, "SELECT count(*) FROM RuleSetActivation WHERE deactivatedAt IS NULL;"]).toString().trim();
    assert.equal(count, "1");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("database rejects deletion of a published clinical version", () => {
  const { directory, database } = databaseWithCurrentSchema();
  try {
    execFileSync("sqlite3", [database], {
      input: `
        INSERT INTO ClinicalRuleSet (id, key, name, scope, createdAt, updatedAt)
        VALUES ('set-1', 'national', 'National', 'GLOBAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        INSERT INTO ClinicalRuleVersion (
          id, ruleSetId, versionMajor, versionMinor, versionPatch, displayVersion,
          status, sourceGuidelineSummary, snapshotJson, checksum, updatedAt
        ) VALUES (
          'version-1', 'set-1', 3, 0, 0, 'CG-NCSP-3.0.0', 'PUBLISHED',
          'Verified sources', '{}', 'checksum-1', CURRENT_TIMESTAMP
        );
      `,
    });
    assert.throws(
      () => execFileSync("sqlite3", [database, "DELETE FROM ClinicalRuleVersion WHERE id = 'version-1';"], { stdio: ["pipe", "pipe", "pipe"] }),
      /Only unreferenced draft clinical rule versions may be deleted/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("database allows draft snapshot revisions before publication", () => {
  const { directory, database } = databaseWithCurrentSchema();
  try {
    execFileSync("sqlite3", [database], {
      input: `
        INSERT INTO ClinicalRuleSet (id, key, name, scope, createdAt, updatedAt)
        VALUES ('set-1', 'national', 'National', 'GLOBAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        INSERT INTO ClinicalRuleVersion (
          id, ruleSetId, versionMajor, versionMinor, versionPatch, displayVersion,
          status, sourceGuidelineSummary, snapshotJson, checksum, updatedAt
        ) VALUES (
          'version-1', 'set-1', 3, 0, 0, 'CG-NCSP-3.0.0', 'DRAFT',
          'Verified sources', '{}', 'checksum-1', CURRENT_TIMESTAMP
        );
        UPDATE ClinicalRuleVersion SET snapshotJson = '{"draft":true}', revision = revision + 1 WHERE id = 'version-1';
      `,
    });
    const row = execFileSync("sqlite3", [database, "SELECT revision || ':' || json_extract(snapshotJson, '$.draft') FROM ClinicalRuleVersion WHERE id = 'version-1';"]).toString().trim();
    assert.equal(row, "2:1");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
