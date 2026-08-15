import assert from "node:assert/strict";
import test from "node:test";

import { JSONUploadAdapter } from "@/lib/batch/adapters/json-adapter";
import {
  manifestFromAdapter,
  normalizeIntakeParseManifest,
} from "@/lib/batch/intake-manifest";

test("parse manifest accounts for every JSON source record including skipped rows", async () => {
  const parsed = await new JSONUploadAdapter().parse(JSON.stringify([
    { hpvResult: "NOT_DETECTED" },
    "not-an-object",
    { hpvResult: "HPV_OTHER" },
    null,
  ]));
  const manifest = manifestFromAdapter(parsed);

  assert.equal(manifest.sourceRecordCount, 4);
  assert.equal(manifest.parsedRecordCount, 2);
  assert.equal(manifest.skippedRecordCount, 2);
  assert.equal(manifest.warnings.length, 2);
  assert.equal(
    manifest.sourceRecordCount,
    manifest.parsedRecordCount + manifest.skippedRecordCount
  );
});

test("server manifest validation reconciles prepared rows independently from source parsing", () => {
  const manifest = normalizeIntakeParseManifest({
    schemaVersion: 1,
    sourceRecordCount: 100,
    parsedRecordCount: 98,
    skippedRecordCount: 2,
    preparedRecordCount: 99,
    warnings: [{ rowIndex: 3, field: "_type", message: "Row skipped." }],
    errors: [],
    detectedColumns: ["hpvResult"],
    unmappedColumns: [],
  }, 99);

  assert.equal(manifest.sourceRecordCount, 100);
  assert.equal(manifest.preparedRecordCount, 99);
});

test("server rejects a manifest that could hide row loss", () => {
  assert.throws(
    () => normalizeIntakeParseManifest({
      schemaVersion: 1,
      sourceRecordCount: 100,
      parsedRecordCount: 97,
      skippedRecordCount: 2,
      preparedRecordCount: 97,
      warnings: [],
      errors: [],
      detectedColumns: [],
      unmappedColumns: [],
    }, 97),
    /does not reconcile source/
  );
});
