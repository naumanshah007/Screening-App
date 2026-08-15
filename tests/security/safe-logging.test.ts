import assert from "node:assert/strict";
import test from "node:test";

import {
  safeLogError,
  sanitizeForLog,
  writeSafeLog,
  type SafeLogRecord,
} from "@/lib/security/safe-logging";

test("central log sanitization removes representative PHI and credentials", () => {
  const sanitized = sanitizeForLog({
    patientName: "Aroha Sensitive",
    nhi: "ABC1234",
    nested: {
      email: "aroha@example.test",
      authorization: "Bearer super-secret-token",
      safeCount: 7,
    },
    message: "Lookup ABC1234 failed for aroha@example.test with Bearer abc.def.ghi",
  });
  const output = JSON.stringify(sanitized);
  for (const forbidden of [
    "Aroha Sensitive",
    "ABC1234",
    "aroha@example.test",
    "super-secret-token",
    "abc.def.ghi",
  ]) {
    assert.doesNotMatch(output, new RegExp(forbidden.replaceAll(".", "\\."), "i"));
  }
  assert.match(output, /safeCount/);
  assert.match(output, /\[REDACTED/);
});

test("safe logger retains an operational event without serializing stack or cause", () => {
  const records: SafeLogRecord[] = [];
  const sink = (record: SafeLogRecord) => records.push(record);
  const error = new Error("Patient ABC1234 email aroha@example.test could not be parsed");
  error.stack = "STACK_WITH_RAW_PAYLOAD";

  safeLogError("batch.parse.failed", error, { rowNumber: 4, rawPayload: "SECRET" }, sink);
  writeSafeLog("info", "batch.parse.recovered", { processedCount: 3 }, sink);

  const output = JSON.stringify(records);
  assert.match(output, /batch\.parse\.failed/);
  assert.match(output, /rowNumber/);
  assert.doesNotMatch(output, /ABC1234|aroha@example\.test|SECRET|STACK_WITH_RAW_PAYLOAD/);
});
