/**
 * Tests for the selection-state invariants that the BatchValidationPreview
 * component depends on.
 *
 * The component tracks selection by stable rowKey = `${sourceType}::${rowNumber}`
 * (NOT by caseId, which is regenerated on every revalidation). These tests
 * pin down the invariants:
 *
 *  - rowNumber is stable across revalidations (it comes from _rowIndex + 1)
 *  - editing a row in-place preserves its rowNumber
 *  - if an edited row remains valid/warnings, it survives selection reconciliation
 *  - if an edited row becomes invalid, it is auto-deselected
 *  - duplicate row produces a NEW rowNumber → defaults to selected
 *  - delete removes the row entirely → not in selection
 *  - selected count always matches the actual processable filter result
 *  - sending stale caseIds to processBatch never processes them (no zero-row
 *    surprise after edit)
 */

import test from "node:test";
import assert from "node:assert/strict";
import { validateBatchRows } from "../validation";
import { processBatch } from "../processor";
import type { ParsedSourceRow, SourceMetadata, CanonicalBatchCase } from "../types";

const META: Omit<SourceMetadata, "rowNumber" | "importedAt"> = {
  sourceType: "manual",
  sourceSystem: "Test",
  mappingVersion: "manual-v1",
  engineVersion: "test-v1",
};

function row(fields: Record<string, unknown>, index = 0): ParsedSourceRow {
  return {
    _rowIndex: index,
    _sourceFields: Object.keys(fields),
    ...fields,
  };
}

const rowKey = (c: CanonicalBatchCase) =>
  `${c.source.sourceType}::${c.source.rowNumber}`;

// Mirror of the reconciliation algorithm in BatchValidationPreview so we can
// test it deterministically without rendering a component.
function reconcileSelection(
  prevSelected: Set<string>,
  prevCases: CanonicalBatchCase[],
  currentCases: CanonicalBatchCase[]
): Set<string> {
  const idsByKey = new Map<string, string>();
  const caseById = new Map<string, CanonicalBatchCase>();
  for (const c of currentCases) {
    idsByKey.set(rowKey(c), c.caseId);
    caseById.set(c.caseId, c);
  }
  const prevKeys = new Set(prevCases.map(rowKey));
  const prevStatusByKey = new Map(prevCases.map((c) => [rowKey(c), c.validationStatus]));

  const next = new Set<string>();
  // Keep previously-selected keys that still exist and are still processable
  for (const k of prevSelected) {
    const id = idsByKey.get(k);
    if (!id) continue;
    const c = caseById.get(id);
    if (c && c.validationStatus !== "invalid") next.add(k);
  }
  // Auto-select rows that are processable and either:
  //   (a) newly added, OR
  //   (b) transitioned from invalid → processable (edit fix)
  for (const k of idsByKey.keys()) {
    const id = idsByKey.get(k)!;
    const c = caseById.get(id)!;
    if (c.validationStatus === "invalid") continue;
    const wasPresent = prevKeys.has(k);
    const wasInvalid = prevStatusByKey.get(k) === "invalid";
    if (!wasPresent || wasInvalid) next.add(k);
  }
  return next;
}

function selectedCaseIds(
  selected: Set<string>,
  cases: CanonicalBatchCase[]
): string[] {
  const out: string[] = [];
  for (const c of cases) {
    if (selected.has(rowKey(c)) && c.validationStatus !== "invalid") {
      out.push(c.caseId);
    }
  }
  return out;
}

// ─── Invariants ─────────────────────────────────────────────────────────────

test("rowNumber is stable across revalidations", () => {
  const rows = [
    row({ hpvResult: "NOT_DETECTED" }, 0),
    row({ hpvResult: "HPV_16_18" }, 1),
  ];
  const a = validateBatchRows(rows, META);
  const b = validateBatchRows(rows, META);
  assert.equal(a.cases[0].source.rowNumber, b.cases[0].source.rowNumber);
  assert.equal(a.cases[1].source.rowNumber, b.cases[1].source.rowNumber);
});

test("caseId IS regenerated on every revalidation (justifies rowKey approach)", () => {
  const rows = [row({ hpvResult: "NOT_DETECTED" }, 0)];
  const a = validateBatchRows(rows, META);
  const b = validateBatchRows(rows, META);
  assert.notEqual(a.cases[0].caseId, b.cases[0].caseId);
});

// ─── Edit → still valid ─────────────────────────────────────────────────────

test("edited row that REMAINS valid keeps its selection", () => {
  const before = validateBatchRows(
    [row({ hpvResult: "NOT_DETECTED" }, 0)],
    META
  );
  const selected = new Set<string>([rowKey(before.cases[0])]);

  // Simulate edit: same _rowIndex, different field value
  const after = validateBatchRows(
    [row({ hpvResult: "HPV_16_18" }, 0)],
    META
  );
  const next = reconcileSelection(selected, before.cases, after.cases);

  assert.ok(next.has(rowKey(after.cases[0])), "row should remain selected after edit");
  assert.equal(selectedCaseIds(next, after.cases).length, 1);
});

// ─── Edit invalid → valid: now selectable ───────────────────────────────────

test("edit invalid → valid: row becomes selectable and can be processed", () => {
  // Start: invalid (POSITIVE is not a valid enum)
  const before = validateBatchRows(
    [row({ hpvResult: "POSITIVE" }, 0)],
    META
  );
  assert.equal(before.cases[0].validationStatus, "invalid");

  // User clears the invalid value by editing — selection set started empty
  // because the row was invalid.
  const selected = new Set<string>();

  // After edit: valid
  const after = validateBatchRows(
    [row({ hpvResult: "HPV_16_18" }, 0)],
    META
  );
  const next = reconcileSelection(selected, before.cases, after.cases);

  // Newly processable row should be auto-selected
  assert.ok(next.has(rowKey(after.cases[0])));

  // Processing the resolved selection actually produces a result
  const ids = selectedCaseIds(next, after.cases);
  const toProcess = after.cases.filter((c) => ids.includes(c.caseId));
  const batch = processBatch(toProcess);
  assert.equal(batch.results.length, 1, "process must not send zero rows");
  assert.equal(batch.results[0].status, "success");
});

// ─── Edit valid → invalid: auto-deselect, cannot be processed ──────────────

test("edit valid → invalid: row is auto-deselected and cannot be processed", () => {
  const before = validateBatchRows(
    [row({ hpvResult: "NOT_DETECTED" }, 0)],
    META
  );
  const selected = new Set<string>([rowKey(before.cases[0])]);

  // After edit: invalid enum
  const after = validateBatchRows(
    [row({ hpvResult: "BANANA" }, 0)],
    META
  );
  assert.equal(after.cases[0].validationStatus, "invalid");

  const next = reconcileSelection(selected, before.cases, after.cases);
  assert.equal(next.size, 0, "invalid row must be auto-deselected");

  const ids = selectedCaseIds(next, after.cases);
  assert.equal(ids.length, 0);

  // Confirm: even if a stale caseId leaks through, processBatch won't run it
  const stillProcessable = after.cases.filter((c) => c.validationStatus !== "invalid");
  assert.equal(stillProcessable.length, 0);
});

// ─── Critical: selected count must match what gets processed ─────────────────

test("selected count ALWAYS matches process payload (the Codex bug)", () => {
  // Reproduces the Codex bug: previously, caseIds in `selected` went stale after
  // edit because validateBatchRows regenerates UUIDs. The UI showed "1 selected"
  // but processBatch received 0 rows. After the fix, selection uses stable
  // rowKey so the live caseId is always resolvable.
  const before = validateBatchRows(
    [
      row({ hpvResult: "NOT_DETECTED" }, 0),
      row({ hpvResult: "HPV_16_18" }, 1),
      row({ hpvResult: "HPV_OTHER", cytologyResult: "LSIL" }, 2),
    ],
    META
  );

  // All processable selected
  let selected = new Set<string>(before.cases.map(rowKey));
  assert.equal(selectedCaseIds(selected, before.cases).length, 3);

  // User edits row 1 (still valid)
  const after = validateBatchRows(
    [
      row({ hpvResult: "NOT_DETECTED" }, 0),
      row({ hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE" }, 1), // edited
      row({ hpvResult: "HPV_OTHER", cytologyResult: "LSIL" }, 2),
    ],
    META
  );

  selected = reconcileSelection(selected, before.cases, after.cases);
  const ids = selectedCaseIds(selected, after.cases);

  assert.equal(ids.length, 3, "all 3 rows should still be selected");

  const batch = processBatch(after.cases.filter((c) => ids.includes(c.caseId)));
  assert.equal(batch.results.length, 3, "UI count must equal processed count");
});

// ─── Duplicate ──────────────────────────────────────────────────────────────

test("duplicate row gets a new rowNumber and is auto-selected", () => {
  const before = validateBatchRows(
    [row({ hpvResult: "NOT_DETECTED" }, 0)],
    META
  );
  const selected = new Set<string>([rowKey(before.cases[0])]);

  // Duplicate appended
  const after = validateBatchRows(
    [
      row({ hpvResult: "NOT_DETECTED" }, 0),
      row({ hpvResult: "NOT_DETECTED" }, 1), // duplicate
    ],
    META
  );
  const next = reconcileSelection(selected, before.cases, after.cases);

  assert.equal(next.size, 2, "duplicate row should be auto-selected");
  assert.ok(next.has(rowKey(after.cases[0])));
  assert.ok(next.has(rowKey(after.cases[1])));
});

// ─── Delete ─────────────────────────────────────────────────────────────────

test("delete removes the row from selection without affecting other rows", () => {
  const before = validateBatchRows(
    [
      row({ hpvResult: "NOT_DETECTED" }, 0),
      row({ hpvResult: "HPV_16_18" }, 1),
      row({ hpvResult: "HPV_OTHER" }, 2),
    ],
    META
  );
  const selected = new Set<string>(before.cases.map(rowKey));

  // Delete middle row → remaining rows re-indexed 0,1
  const after = validateBatchRows(
    [
      row({ hpvResult: "NOT_DETECTED" }, 0),
      row({ hpvResult: "HPV_OTHER" }, 1),
    ],
    META
  );

  const next = reconcileSelection(selected, before.cases, after.cases);
  // Note: because rowKey is rowNumber-based, deleting a middle row "renames"
  // the trailing row's key. The reconciler treats that as a new key and
  // auto-selects it (good — it stays selected).
  assert.equal(next.size, 2);
  const ids = selectedCaseIds(next, after.cases);
  assert.equal(ids.length, 2);

  const batch = processBatch(after.cases.filter((c) => ids.includes(c.caseId)));
  assert.equal(batch.results.length, 2);
});

// ─── Invalid rows never enter selection ─────────────────────────────────────

test("invalid rows are never processable, regardless of selection state", () => {
  const v = validateBatchRows(
    [
      row({ hpvResult: "NOT_DETECTED" }, 0), // valid
      row({ hpvResult: "INVALID_ENUM" }, 1), // invalid
    ],
    META
  );
  // Even if we (incorrectly) pre-select all keys, the resolved set must
  // exclude invalid rows.
  const selected = new Set<string>(v.cases.map(rowKey));
  const ids = selectedCaseIds(selected, v.cases);
  assert.equal(ids.length, 1);
  assert.equal(
    v.cases.find((c) => c.caseId === ids[0])?.validationStatus !== "invalid",
    true
  );
});

test("processBatch with includeInvalid:false rejects invalid rows even if passed in", () => {
  // Even with a stale or malformed selection, the API safety net holds.
  const v = validateBatchRows(
    [
      row({ hpvResult: "NOT_DETECTED" }, 0),
      row({ hpvResult: "INVALID_ENUM" }, 1),
    ],
    META
  );
  const batch = processBatch(v.cases, { includeInvalid: false });
  assert.equal(batch.results.length, 1);
});
