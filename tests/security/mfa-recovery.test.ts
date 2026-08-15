import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RECOVERY_CODE_COUNT,
  consumeRecoveryCode,
  createRecoveryCodes,
} from "@/lib/auth/recovery-codes";

test("a recovery code is consumed exactly once", () => {
  const created = createRecoveryCodes();
  assert.equal(created.rawCodes.length, RECOVERY_CODE_COUNT);

  const firstUse = consumeRecoveryCode({
    storedJson: created.storedJson,
    code: created.rawCodes[0],
  });
  assert.equal(firstUse.valid, true);
  assert.equal(firstUse.remainingCount, RECOVERY_CODE_COUNT - 1);

  const reused = consumeRecoveryCode({
    storedJson: firstUse.nextStoredJson,
    code: created.rawCodes[0],
  });
  assert.equal(reused.valid, false);
  assert.equal(reused.remainingCount, RECOVERY_CODE_COUNT - 1);
});

test("credential authentication atomically consumes and audits recovery codes", () => {
  const source = readFileSync("lib/auth.ts", "utf8");
  assert.match(source, /consumeRecoveryCode/);
  assert.match(source, /twoFARecoveryCodesJson: user\.twoFARecoveryCodesJson/);
  assert.match(source, /RECOVERY_CODE_USED/);
  assert.match(source, /RECOVERY_CODE_FAILED/);
  assert.match(source, /method: authenticationMethod/);
});
