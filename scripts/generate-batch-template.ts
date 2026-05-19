/**
 * scripts/generate-batch-template.ts
 *
 * Generates public/templates/batch-upload-template.xlsx and
 * public/templates/batch-upload-template.csv from the canonical
 * BATCH_COLUMNS definition.
 *
 * Usage:
 *   npx tsx scripts/generate-batch-template.ts
 */

import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { BATCH_COLUMNS } from "../lib/batch/template-columns";

const OUT_DIR = path.join(process.cwd(), "public", "templates");
fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Group columns ────────────────────────────────────────────────────────────

const groups = ["patient", "results", "history", "session", "colposcopy", "bleeding", "pregnancy"] as const;

const groupLabel: Record<string, string> = {
  patient:    "Patient Information",
  results:    "Test Results",
  history:    "Screening History",
  session:    "Session / Repeat Context",
  colposcopy: "Colposcopy Findings",
  bleeding:   "Abnormal Bleeding",
  pregnancy:  "Pregnancy",
};

// ─── Example row (5 representative cases) ────────────────────────────────────

const EXAMPLE_ROWS: Record<string, unknown>[] = [
  {
    label: "HPV Negative — routine",
    externalPatientId: "EX001",
    patientAge: 35,
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
    hpvResult: "NOT_DETECTED",
    sampleType: "LBC",
  },
  {
    label: "HPV 16/18 — colposcopy",
    externalPatientId: "EX002",
    patientAge: 28,
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
    hpvResult: "HPV_16_18",
    sampleType: "LBC",
  },
  {
    label: "HPV Other + HSIL",
    externalPatientId: "EX003",
    patientAge: 45,
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
    hpvResult: "HPV_OTHER",
    cytologyResult: "HSIL",
    sampleType: "LBC",
  },
  {
    label: "Immunocompromised — 3yr recall",
    externalPatientId: "EX004",
    patientAge: 50,
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    immunocompromised: true,
    atypicalEndometrialHistory: false,
    hpvResult: "NOT_DETECTED",
    sampleType: "LBC",
  },
  {
    label: "First HPV Transition",
    externalPatientId: "EX005",
    patientAge: 60,
    isFirstTimeHPVTransition: true,
    isPostHysterectomy: false,
    immunocompromised: false,
    atypicalEndometrialHistory: false,
  },
];

// ─── Build Excel workbook ─────────────────────────────────────────────────────

async function buildXlsx() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Privexa Cervical Screening App";
  wb.created = new Date();
  wb.modified = new Date();

  // ── Tab 1: Instructions ───────────────────────────────────────────────────
  const instrSheet = wb.addWorksheet("Instructions");
  instrSheet.addRow(["Privexa Batch Upload Template — Cervical Screening Decision Engine"]);
  instrSheet.addRow([]);
  instrSheet.addRow(["HOW TO USE"]);
  instrSheet.addRow(["1. Fill in the 'Template' tab with your patient data."]);
  instrSheet.addRow(["2. Delete the header in the Template tab if it conflicts with your system."]);
  instrSheet.addRow(["3. Save as .xlsx or .csv and upload in the Batch Demo page."]);
  instrSheet.addRow(["4. Required fields: isFirstTimeHPVTransition, isPostHysterectomy, immunocompromised, atypicalEndometrialHistory"]);
  instrSheet.addRow(["   (These default to false if omitted, but it is best practice to include them.)"]);
  instrSheet.addRow([]);
  instrSheet.addRow(["BOOLEAN VALUES"]);
  instrSheet.addRow(["Accepted: true / false / yes / no / 1 / 0 / y / n"]);
  instrSheet.addRow([]);
  instrSheet.addRow(["ENUM VALUES"]);
  instrSheet.addRow(["Must match the exact codes in the 'Allowed Values' tab (case-insensitive)."]);
  instrSheet.addRow([]);
  instrSheet.addRow(["COLUMN ALIASES"]);
  instrSheet.addRow(["Some columns accept alternative names (e.g. 'nhi' instead of 'externalPatientId')."]);
  instrSheet.addRow(["See the 'Template' tab column descriptions for aliases."]);
  instrSheet.addRow([]);
  instrSheet.addRow(["DEMO / POC NOTICE"]);
  instrSheet.addRow(["This batch processor is under validation. All results require clinical review."]);
  instrSheet.addRow(["Not a substitute for professional clinical judgement."]);

  instrSheet.getColumn(1).width = 80;
  instrSheet.getRow(1).font = { bold: true, size: 13 };
  instrSheet.getRow(3).font = { bold: true };
  instrSheet.getRow(10).font = { bold: true };
  instrSheet.getRow(13).font = { bold: true };
  instrSheet.getRow(16).font = { bold: true };
  instrSheet.getRow(19).font = { bold: true };

  // ── Tab 2: Template ───────────────────────────────────────────────────────
  const templateSheet = wb.addWorksheet("Template");
  const headerRow = templateSheet.addRow(BATCH_COLUMNS.map((c) => c.field));
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EAF6" },
  };

  // Freeze header row
  templateSheet.views = [{ state: "frozen", ySplit: 1 }];

  // Set column widths and add data validation for enum columns
  BATCH_COLUMNS.forEach((col, idx) => {
    const column = templateSheet.getColumn(idx + 1);
    column.width = Math.min(Math.max(col.field.length + 4, 18), 40);

    if (col.type === "enum" && col.allowedValues && col.allowedValues.length > 0) {
      // Add dropdown validation for small enum lists
      if (col.allowedValues.length <= 20) {
        for (let row = 2; row <= 201; row++) {
          templateSheet.getCell(row, idx + 1).dataValidation = {
            type: "list",
            formulae: [`"${col.allowedValues.join(",")}"`],
            showErrorMessage: true,
            errorTitle: `Invalid ${col.label}`,
            error: `Must be one of: ${col.allowedValues.join(", ")}`,
          };
        }
      }
    }
  });

  // ── Tab 3: Examples ───────────────────────────────────────────────────────
  const exampleSheet = wb.addWorksheet("Examples");
  const exHeaderRow = exampleSheet.addRow(BATCH_COLUMNS.map((c) => c.field));
  exHeaderRow.font = { bold: true };
  exHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F5E9" },
  };
  exampleSheet.views = [{ state: "frozen", ySplit: 1 }];
  BATCH_COLUMNS.forEach((_, idx) => {
    exampleSheet.getColumn(idx + 1).width = 20;
  });

  for (const example of EXAMPLE_ROWS) {
    const rowData = BATCH_COLUMNS.map((col) => {
      const v = example[col.field];
      return v !== undefined ? v : "";
    });
    exampleSheet.addRow(rowData);
  }

  // ── Tab 4: Allowed Values ─────────────────────────────────────────────────
  const allowedSheet = wb.addWorksheet("Allowed Values");
  const avHeader = allowedSheet.addRow(["Field", "Label", "Required?", "Type", "Allowed Values", "Description"]);
  avHeader.font = { bold: true };
  avHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF3E0" },
  };
  allowedSheet.columns = [
    { width: 35 }, { width: 28 }, { width: 12 }, { width: 12 }, { width: 80 }, { width: 60 },
  ];

  for (const col of BATCH_COLUMNS) {
    allowedSheet.addRow([
      col.field,
      col.label,
      col.required ? "Required" : "Optional",
      col.type,
      col.allowedValues ? col.allowedValues.join(" | ") : (col.type === "boolean" ? "true | false | yes | no | 1 | 0" : "—"),
      col.description + (col.aliases?.length ? `\nAliases: ${col.aliases.join(", ")}` : ""),
    ]);
  }

  // ─── Write ────────────────────────────────────────────────────────────────
  const xlsxPath = path.join(OUT_DIR, "batch-upload-template.xlsx");
  await wb.xlsx.writeFile(xlsxPath);
  console.log(`✓ Written: ${xlsxPath}`);
}

// ─── Build CSV header template ────────────────────────────────────────────────

function buildCSV() {
  const header = BATCH_COLUMNS.map((c) => c.field).join(",");
  const csvPath = path.join(OUT_DIR, "batch-upload-template.csv");
  fs.writeFileSync(csvPath, header + "\n", "utf8");
  console.log(`✓ Written: ${csvPath}`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log("Generating batch upload templates…");
  await buildXlsx();
  buildCSV();
  console.log("Done.");
})();
