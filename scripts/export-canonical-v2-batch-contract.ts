import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CANONICAL_FACT_FIELD_CATALOG_V2,
  canonicalClinicalFactsV2JsonSchema,
} from "../lib/clinical-rules/canonical-facts-v2";

const CANONICAL_V2_BATCH_SCHEMA_ID =
  "cervigrade-canonical-facts-batch-v2" as const;

function protectCsvCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const outputDirectory = resolve(process.cwd(), "public/templates");
mkdirSync(outputDirectory, { recursive: true });

writeFileSync(
  resolve(outputDirectory, "canonical-clinical-facts-v2.schema.json"),
  `${JSON.stringify(canonicalClinicalFactsV2JsonSchema, null, 2)}\n`
);

const headers = [
  "schema_id",
  "subject_reference",
  "captured_at",
  "fact_name",
  "fact_value",
  "value_type",
  "status",
  "source",
  "observed_at",
  "recorded_at",
  "entered_by",
  "verified_by",
  "verification_status",
  "source_document_id",
  "external_reference",
];
const timestamp = "2026-08-03T00:00:00.000Z";
const samples: Array<[string, string, string, string, string]> = [
  ["HPV-UNSUITABLE", "currentPathway", "FIGURE_3", "STRING", "REVIEWER_ENTRY"],
  ["HPV-UNSUITABLE", "hpvValidity", "UNSUITABLE", "STRING", "LAB_RESULT"],
  ["CIN2-SURVEILLANCE", "biopsyResult", "CIN2", "STRING", "PATHOLOGY"],
  ["CIN2-SURVEILLANCE", "ageYears", "29", "NUMBER", "PRIOR_RECORD"],
  ["CIN2-SURVEILLANCE", "participantTreatmentPreference", "SURVEILLANCE", "STRING", "REVIEWER_ENTRY"],
  ["HSIL-MARGINS", "treatedHistology", "HSIL_CIN2_3", "STRING", "PATHOLOGY"],
  ["HSIL-MARGINS", "marginStatus", "POSITIVE", "STRING", "PATHOLOGY"],
  ["AIS-FOLLOW-UP", "treatedHistology", "AIS", "STRING", "PATHOLOGY"],
  ["AIS-FOLLOW-UP", "marginStatus", "CLEAR", "STRING", "PATHOLOGY"],
  ["CANCER-OVERLAY", "cancerType", "CERVICAL", "STRING", "SPECIALIST_LETTER"],
  ["CANCER-OVERLAY", "cancerStage", "STAGE_1A1", "STRING", "SPECIALIST_LETTER"],
  ["CANCER-OVERLAY", "cancerTreatment", "LOCAL_EXCISION", "STRING", "OPERATIVE_REPORT"],
  ["BLEEDING-PCB", "currentPathway", "FIGURE_10", "STRING", "REVIEWER_ENTRY"],
  ["BLEEDING-PCB", "bleedingType", "POSTCOITAL", "STRING", "PARTICIPANT_REPORT"],
  ["BLEEDING-PCB", "bleedingEpisodeState", "RECURRENT", "STRING", "PARTICIPANT_REPORT"],
  ["BLEEDING-PCB", "speculumExamStatus", "", "", "REVIEWER_ENTRY"],
];

function csvCell(value: string) {
  const safe = protectCsvCell(value).replaceAll('"', '""');
  return /[",\n]/.test(safe) ? `"${safe}"` : safe;
}

const rows = samples.map(([subject, fact, value, valueType, source]) => [
  CANONICAL_V2_BATCH_SCHEMA_ID,
  subject,
  timestamp,
  fact,
  value,
  valueType,
  value ? "KNOWN" : "UNKNOWN",
  source,
  "",
  timestamp,
  "synthetic-template",
  "",
  source === "REVIEWER_ENTRY" ? "UNVERIFIED" : "SOURCE_VERIFIED",
  `SYNTHETIC-${subject}`,
  "",
]);
writeFileSync(
  resolve(outputDirectory, "canonical-clinical-facts-v2-template.csv"),
  `${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`
);

const dictionaryHeaders = [
  "domain",
  "fact_name",
  "status_convention",
  "provenance_required",
  "description",
];
const dictionaryRows = Object.entries(CANONICAL_FACT_FIELD_CATALOG_V2).flatMap(
  ([domain, facts]) =>
    facts.map((fact) => [
      domain,
      fact,
      "KNOWN / UNKNOWN / NOT_RECORDED / NOT_APPLICABLE / PENDING / CONFLICTING",
      "yes",
      `Canonical ${domain} fact; use an allowed source and never infer an absent value.`,
    ])
);
writeFileSync(
  resolve(outputDirectory, "canonical-clinical-facts-v2-field-dictionary.csv"),
  `${[dictionaryHeaders, ...dictionaryRows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`
);
writeFileSync(
  resolve(outputDirectory, "canonical-clinical-facts-v2-validation-errors.csv"),
  "row_number,subject_reference,fact_name,severity,message\n2,SYNTHETIC-EXAMPLE,ageYears,error,KNOWN NUMBER value is not finite\n"
);

console.log(
  JSON.stringify({
    outputDirectory,
    sampleRows: rows.length,
    dictionaryRows: dictionaryRows.length,
  })
);
