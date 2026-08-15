import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateAverageDecisionMinutes,
  getCommandCentreMetricPolicy,
  startOfCurrentWeek,
  summariseDecisionSplit,
} from "@/lib/decisions/dashboard-metrics";
import { isVisibleInDemoFlow } from "@/lib/auth/permissions";

test("dashboard metrics summarise completed decision split", () => {
  const split = summariseDecisionSplit([
    { disposition: "ACCEPTED", _count: { _all: 7 } },
    { disposition: "REJECTED", _count: { _all: 2 } },
    { disposition: "NEEDS_INFO", _count: { _all: 3 } },
  ]);

  assert.deepEqual(split, {
    accepted: 7,
    rejected: 2,
    total: 9,
  });
});

test("dashboard metrics average intake to decision ignores missing and negative durations", () => {
  const average = calculateAverageDecisionMinutes([
    {
      batchRun: { createdAt: new Date("2026-06-19T00:00:00.000Z") },
      reviewedAt: new Date("2026-06-19T01:00:00.000Z"),
    },
    {
      batchRun: { createdAt: new Date("2026-06-19T00:00:00.000Z") },
      reviewedAt: new Date("2026-06-19T03:00:00.000Z"),
    },
    {
      batchRun: { createdAt: new Date("2026-06-19T04:00:00.000Z") },
      reviewedAt: new Date("2026-06-19T03:00:00.000Z"),
    },
    {
      batchRun: { createdAt: new Date("2026-06-19T00:00:00.000Z") },
      reviewedAt: null,
    },
  ]);

  assert.equal(average, 120);
});

test("dashboard metrics week starts on Monday", () => {
  const friday = new Date("2026-06-19T12:00:00.000Z");
  const weekStart = startOfCurrentWeek(friday);

  assert.equal(weekStart.getDay(), 1);
  assert.equal(weekStart.getHours(), 0);
  assert.equal(weekStart.getMinutes(), 0);
});

test("dashboard metric policy grants organisation scope to admin and coordinator roles", () => {
  for (const role of ["ADMIN", "INTEGRATION_ADMIN", "COORDINATOR"]) {
    const policy = getCommandCentreMetricPolicy({ id: `${role}-1`, role });

    assert.equal(policy.canViewOperationalMetrics, true);
    assert.equal(policy.queueScope, "organisation");
    assert.equal(policy.intakeScope, "organisation");
    assert.equal(policy.completedScope, "organisation");
    assert.equal(policy.packageScope, "organisation");
  }
});

test("dashboard metric policy scopes completed decisions to the current reviewer", () => {
  const policy = getCommandCentreMetricPolicy({ id: "smo-1", role: "SMO_REVIEWER" });

  assert.equal(policy.canViewOperationalMetrics, true);
  assert.equal(policy.queueScope, "organisation");
  assert.equal(policy.intakeScope, "organisation");
  assert.equal(policy.completedScope, "own");
  assert.equal(policy.completedLabel, "Your reviewer-confirmed decisions");
});

test("dashboard metric policy hides operational metrics from GP and missing roles", () => {
  assert.equal(
    getCommandCentreMetricPolicy({ id: "gp-1", role: "GP" }).canViewOperationalMetrics,
    false
  );
  assert.equal(getCommandCentreMetricPolicy({}).canViewOperationalMetrics, false);
});

test("dashboard demo flow CTA policy matches sidebar role visibility", () => {
  assert.equal(isVisibleInDemoFlow("/batch", "ADMIN"), true);
  assert.equal(isVisibleInDemoFlow("/batch", "COORDINATOR"), true);
  assert.equal(isVisibleInDemoFlow("/batch", "SMO_REVIEWER"), false);
  assert.equal(isVisibleInDemoFlow("/review", "SMO_REVIEWER"), true);
  assert.equal(isVisibleInDemoFlow("/review", "INTEGRATION_ADMIN"), false);
  assert.equal(isVisibleInDemoFlow("/decisions", "SMO_REVIEWER"), true);
  assert.equal(isVisibleInDemoFlow("/audit", "SMO_REVIEWER"), false);
  assert.equal(isVisibleInDemoFlow("/dashboard", "GP"), true);
});
