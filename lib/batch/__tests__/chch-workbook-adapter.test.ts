/**
 * The CHCH importer, against the real workbook where it is available.
 *
 * The generic XLSX adapter expects a header on row 1; this workbook has one on
 * row 3. The equivalence test is the point: the frozen fixture stays
 * authoritative, and this proves a fresh parse of the actual file reproduces it
 * exactly rather than approximately.
 *
 * When the workbook is not present (CI, a clean checkout) the workbook-dependent
 * tests skip rather than fail — a missing input file is not a defect in the code
 * under test. The schema and rejection behaviour are exercised regardless,
 * against workbooks built in-memory.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";

import {
  CHCH_FIRST_DATA_ROW,
  CHCH_HEADER_ROW,
  differencesFromFrozenFixture,
  importChchWorkbook,
} from "../adapters/chch-workbook-adapter";
import { CHCH_SOURCE_EVIDENCE, CHCH_SOURCE_SHA256 } from "../chch-source-records";

const WORKBOOK = join(
  process.env.HOME ?? "",
  "Downloads",
  "CerviGrade_SurveyGrid_30_Synthetic_Patients.xlsx"
);
const haveWorkbook = existsSync(WORKBOOK);

const HEADERS = [
  "Patient ID",
  "Patient",
  "Age",
  "Screen / circumstance",
  "HPV result",
  "Cytology / follow-up",
  "Relevant history / context",
  "Demo priority",
  "Expected SurveyGrid behaviour",
];

/** A minimal workbook in the CHCH shape, for the negative cases. */
async function buildWorkbook(
  rows: Array<Array<string | number>>,
  options: { sheetName?: string; headers?: string[] } = {}
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(options.sheetName ?? "Sheet1");
  sheet.getRow(CHCH_HEADER_ROW).values = options.headers ?? HEADERS;
  rows.forEach((row, index) => {
    sheet.getRow(CHCH_FIRST_DATA_ROW + index).values = row;
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const VALID_ROW = [
  "chch-001",
  "Aroha T.",
  34,
  "First HPV screen",
  "HPV 16 positive",
  "Cytology pending",
  "No previous CIN",
  "High",
  "Direct colposcopy pathway.",
];

test("the importer reads the header from row 3, not row 1", async () => {
  const result = await importChchWorkbook(await buildWorkbook([VALID_ROW]));
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].worksheetRow, CHCH_FIRST_DATA_ROW);
});

test("a workbook with a different schema imports nothing", async () => {
  const wrong = await buildWorkbook([VALID_ROW], {
    headers: ["NHI", "Name", "Age", "Screen", "HPV", "Cytology", "History", "x", "y"],
  });
  const result = await importChchWorkbook(wrong);
  assert.ok(result.errors.length > 0, "an unconfirmed schema must be an error");
  assert.equal(result.rows.length, 0, "nothing may be imported from an unconfirmed schema");
});

test("a workbook without the expected sheet imports nothing", async () => {
  const result = await importChchWorkbook(
    await buildWorkbook([VALID_ROW], { sheetName: "Data" })
  );
  assert.equal(result.errors[0]?.field, "sheet");
  assert.equal(result.rows.length, 0, "the importer must not guess a data sheet");
});

test("a row with a missing field is rejected, never repaired", async () => {
  const incomplete = [...VALID_ROW];
  incomplete[4] = ""; // no HPV result
  const result = await importChchWorkbook(await buildWorkbook([incomplete]));
  assert.equal(result.rows.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].field, "hpvResult");
  assert.match(result.rejected[0].message, /rejected rather than/);
});

test("a duplicate case ID is rejected", async () => {
  const result = await importChchWorkbook(await buildWorkbook([VALID_ROW, [...VALID_ROW]]));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].field, "caseId");
});

test("an implausible age is rejected rather than coerced", async () => {
  const bad = [...VALID_ROW];
  bad[2] = "thirty-four";
  const result = await importChchWorkbook(await buildWorkbook([bad]));
  assert.equal(result.rows.length, 0);
  assert.equal(result.rejected[0].field, "age");
});

test("the importer inserts no clinical defaults", async () => {
  const result = await importChchWorkbook(await buildWorkbook([VALID_ROW]));
  const row = result.rows[0] as unknown as Record<string, unknown>;
  for (const field of ["sampleType", "repeatStage", "immunocompromised", "cytologyResult", "hpvResult"]) {
    assert.equal(row[field], undefined, `the importer must not synthesise ${field}`);
  }
  // It carries the SOURCE TEXT, which is a different thing from a clinical value.
  assert.equal(result.rows[0].hpvResultText, "HPV 16 positive");
});

test("the partner's Demo priority column is never ingested", async () => {
  const result = await importChchWorkbook(await buildWorkbook([VALID_ROW]));
  const serialised = JSON.stringify(result.rows[0]);
  assert.ok(
    !serialised.includes("Direct colposcopy pathway"),
    "the Expected behaviour column is an expectation, not guideline authority"
  );
  assert.ok(!serialised.includes('"High"'), "the Demo priority column must not be ingested");
});

test(
  "a fresh parse of the real workbook reproduces the frozen fixture exactly",
  { skip: haveWorkbook ? false : "workbook not present in this checkout" },
  async () => {
    const result = await importChchWorkbook(readFileSync(WORKBOOK));
    assert.equal(
      result.documentSha256,
      CHCH_SOURCE_SHA256,
      "this is not the workbook the audit verified"
    );
    assert.ok(result.matchesKnownWorkbook);
    assert.deepEqual(result.errors, [], "the real workbook must satisfy the schema check");
    assert.deepEqual(result.rejected, [], "no row of the real workbook may be rejected");
    assert.equal(result.rows.length, 30);
    assert.deepEqual(
      differencesFromFrozenFixture(result.rows, CHCH_SOURCE_EVIDENCE),
      [],
      "the frozen fixture and a fresh parse must be identical before either can replace the other"
    );
  }
);

test(
  "the real workbook's data occupies worksheet rows 4-33",
  { skip: haveWorkbook ? false : "workbook not present in this checkout" },
  async () => {
    const result = await importChchWorkbook(readFileSync(WORKBOOK));
    assert.deepEqual(
      result.rows.map((row) => row.worksheetRow),
      Array.from({ length: 30 }, (_, index) => index + 4),
      "case ordinal 1-30 is not the worksheet row"
    );
  }
);
