import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateAverageDecisionMinutes,
  startOfCurrentWeek,
  summariseDecisionSplit,
} from "@/lib/decisions/dashboard-metrics";

test("dashboard metrics summarise completed decision split", () => {
  const split = summariseDecisionSplit([
    { disposition: "ACCEPTED", _count: { _all: 7 } },
    { disposition: "REJECTED", _count: { _all: 2 } },
    { disposition: "NEEDS_INFO", _count: { _all: 3 } },
  ]);

  assert.deepEqual(split, {
    accepted: 7,
    rejected: 2,
    needsInfo: 3,
    total: 12,
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
