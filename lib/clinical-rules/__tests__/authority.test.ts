/**
 * Authority resolver safety properties.
 *
 * These tests assert the resolver's *fail-safe* behaviour without a database:
 * every path that cannot positively establish an ACTIVE canonical activation
 * must resolve to LEGACY. The database-backed precedence tests live alongside
 * the integration suite.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { isLiveProductionAuthorityEnabled, describeAuthority, getRuntimeClinicalEnvironment, LEGACY_ENGINE_VERSION } from "../authority";

function withEnv(value: string | undefined, run: () => void) {
  const previous = process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION;
  if (value === undefined) delete process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION;
  else process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION;
    else process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION = previous;
  }
}

test("live production authority is OFF when unset", () => {
  withEnv(undefined, () => {
    assert.equal(isLiveProductionAuthorityEnabled(), false);
  });
});

test("live production authority is OFF for every value that is not an explicit yes", () => {
  for (const value of ["", " ", "0", "false", "no", "off", "maybe", "TRUE_ISH", "canonical"]) {
    withEnv(value, () => {
      assert.equal(
        isLiveProductionAuthorityEnabled(),
        false,
        `${JSON.stringify(value)} must not enable live production clinical authority`
      );
    });
  }
});

test("live production authority is ON only for explicit affirmatives", () => {
  for (const value of ["1", "true", "TRUE", " yes ", "on"]) {
    withEnv(value, () => {
      assert.equal(isLiveProductionAuthorityEnabled(), true, `${JSON.stringify(value)} should enable`);
    });
  }
});

test("the legacy engine identity is stable", () => {
  // Exported so provenance records and the batch processor cannot drift apart.
  assert.equal(LEGACY_ENGINE_VERSION, "business-figures-table1-v1");
});

test("authority description never implies canonical without a version", () => {
  assert.equal(describeAuthority({ authorityEngine: "LEGACY", ruleSetVersion: null }), "Legacy");
  assert.equal(
    describeAuthority({ authorityEngine: "CANONICAL", ruleSetVersion: null }),
    "Legacy",
    "a canonical authority with no resolved version must not be displayed as canonical"
  );
  assert.equal(
    describeAuthority({ authorityEngine: "CANONICAL", ruleSetVersion: "CG-NCSP-3.1.0" }),
    "Canonical CG-NCSP-3.1.0"
  );
});

test("the runtime deployment selects the governed activation environment", () => {
  const previousVercel = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "production";
    assert.equal(getRuntimeClinicalEnvironment(), "PRODUCTION");
    process.env.VERCEL_ENV = "preview";
    assert.equal(getRuntimeClinicalEnvironment(), "VALIDATION");
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercel;
  }
});
