import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createClient } from "@libsql/client";

import { ensureClinicalRuleSchema } from "../../lib/database/bootstrap";

test("legacy ClinicalRuleSet storage is preserved before canonical tables are installed", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cervigrade-schema-"));
  const url = `file:${path.join(directory, "legacy.db")}`;
  const client = createClient({ url });

  try {
    await client.execute(`CREATE TABLE "ClinicalRuleSet" (
      "id" TEXT PRIMARY KEY,
      "version" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "rulesJson" TEXT NOT NULL
    )`);
    await client.execute({
      sql: "INSERT INTO ClinicalRuleSet (id, version, name, rulesJson) VALUES (?, ?, ?, ?)",
      args: ["legacy-1", "legacy-v1", "Legacy rules", "[]"],
    });

    await ensureClinicalRuleSchema(url);
    await ensureClinicalRuleSchema(url);

    const archived = await client.execute(
      "SELECT id, version FROM LegacyClinicalRuleSet"
    );
    assert.deepEqual(archived.rows, [{ id: "legacy-1", version: "legacy-v1" }]);

    const columns = await client.execute("PRAGMA table_info(ClinicalRuleSet)");
    const names = new Set(columns.rows.map((row) => String(row.name)));
    assert.equal(names.has("key"), true);
    assert.equal(names.has("scope"), true);

    const tables = await client.execute({
      sql: "SELECT name FROM sqlite_master WHERE type = ? AND name IN (?, ?, ?, ?)",
      args: [
        "table",
        "ClinicalRuleVersion",
        "RuleSetActivation",
        "RuleEvaluation",
        "RuleVersionAuditEvent",
      ],
    });
    assert.equal(tables.rows.length, 4);
  } finally {
    client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
