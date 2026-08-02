import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSimulatedDecisionPackage,
  serialiseCsvRow,
  type DecisionPackageInput,
} from "@/lib/decisions/package-generator";

const completedItem: DecisionPackageInput = {
  id: "item-1",
  batchRunId: "run-1",
  patientName: "Aroha Test",
  nhi: "ABC1234",
  externalPatientId: "EXT-1",
  patientAge: 42,
  gpPractice: "Example Medical",
  recommendation: "Book routine colposcopy.",
  recommendationCode: "P3_ROUTINE",
  referralPriority: "P3",
  referralType: "COLPOSCOPY",
  riskLevel: "LOW",
  disposition: "ACCEPTED",
  reviewedAt: new Date("2026-06-19T02:30:00.000Z"),
  reviewNote: "Reviewer confirmed routine pathway.",
  overrideReason: null,
  reviewedBy: {
    id: "reviewer-1",
    name: "SMO Reviewer",
    email: "smo@example.test",
    role: "SMO_REVIEWER",
  },
  ruleEvaluation: {
    id: "evaluation-shadow-1",
    evaluationMode: "SHADOW",
    ruleVersionDisplay: "CG-NCSP-3.1.0",
    rulesetChecksum: "3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a",
    engineVersion: "canonical-clinical-rules-v2",
    matchedRuleIds: JSON.stringify(["F3-16"]),
    branchPath: JSON.stringify(["node:root", "node:section:figure-3", "node:rule:F3-16", "node:outcome:F3-16"]),
    provisionalRecommendation: "Refer to colposcopy.",
    missingInformation: JSON.stringify([]),
    reviewerRequirement: "CLINICIAN_REVIEW",
    clinicianOnly: false,
    sourceReferences: JSON.stringify([{ document: "NCSP June 2023 v1.1", reference: "Figure 3; R4.14" }]),
    evaluationTrace: JSON.stringify({ legacyComparison: { differences: {} } }),
    canonicalInputSnapshot: JSON.stringify({ schemaId: "canonical-clinical-facts-v2", facts: {} }),
  },
  batchRun: {
    id: "run-1",
    source: "DEMO",
    sourceSystem: "Awanui Labs demo connector",
    sourceFileName: null,
    engineVersion: "business-figures-table1-v1",
    pinnedRuleVersionId: "rule-version-3",
    pinnedRuleVersionDisplay: "CG-NCSP-3.0.0",
    pinnedRulesetChecksum: "9b28840075916585962e7c6e7da6970ee6572bc0b2c1fddf3cf8fb3ad91466ab",
    createdAt: new Date("2026-06-19T01:00:00.000Z"),
  },
};

test("decision package includes required simulated export labels", () => {
  const pkg = buildSimulatedDecisionPackage(completedItem, "2026-06-19T03:00:00.000Z");
  const text = JSON.stringify(pkg);

  for (const phrase of [
    "Simulated export package",
    "Integration-ready preview",
    "Demo PAS update",
    "Demo GP/referrer letter",
    "FHIR-like preview",
    "HL7-style preview",
    "CSV export",
    "Reviewer confirmation required",
    "Not for direct clinical action",
  ]) {
    assert.ok(text.includes(phrase), `expected package to include ${phrase}`);
  }
});

test("decision package avoids overclaiming live integration wording", () => {
  const pkg = buildSimulatedDecisionPackage(completedItem, "2026-06-19T03:00:00.000Z");
  const text = JSON.stringify(pkg);
  const forbidden = [
    ["Live", " write-back"].join(""),
    ["Production", " connected"].join(""),
    ["Automated", " approval"].join(""),
    ["System", " decided"].join(""),
    ["Connected", " live hospital source"].join(""),
  ];

  for (const phrase of forbidden) {
    assert.equal(text.includes(phrase), false, `package must not include ${phrase}`);
  }
});

test("decision package rejects pending review items", () => {
  assert.throws(
    () => buildSimulatedDecisionPackage({ ...completedItem, disposition: "PENDING" }),
    /Only completed decisions/
  );
});

test("decision package serialises a CSV export row", () => {
  const pkg = buildSimulatedDecisionPackage(completedItem, "2026-06-19T03:00:00.000Z");
  const csv = serialiseCsvRow(pkg.csvExportRow);

  assert.ok(csv.startsWith("package_status,simulated_export_package"));
  assert.ok(csv.includes("SIMULATED_PACKAGE_READY"));
  assert.ok(csv.includes("Integration-ready preview"));
});

test("completed-decision exports visibly preserve pinned ruleset provenance", () => {
  const pkg = buildSimulatedDecisionPackage(completedItem, "2026-06-19T03:00:00.000Z");
  const checksum = completedItem.batchRun.pinnedRulesetChecksum!;

  assert.equal(pkg.summary.ruleVersion, "CG-NCSP-3.0.0");
  assert.equal(pkg.summary.rulesetChecksum, checksum);
  assert.equal(pkg.csvExportRow.clinical_rule_version, "CG-NCSP-3.0.0");
  assert.equal(pkg.csvExportRow.clinical_ruleset_checksum, checksum);
  assert.ok(JSON.stringify(pkg.fhirLikeJson).includes("CG-NCSP-3.0.0"));
  assert.ok(JSON.stringify(pkg.fhirLikeJson).includes(checksum));
  assert.ok(pkg.hl7StyleMessage.includes("RULEVERSION^Clinical rule version||CG-NCSP-3.0.0"));
  assert.ok(pkg.hl7StyleMessage.includes(`RULECHECKSUM^Ruleset checksum||${checksum}`));
  assert.ok(pkg.gpLetter.body.includes("Clinical rule version: CG-NCSP-3.0.0"));
  assert.equal(pkg.canonicalShadow?.authority, "SHADOW_ONLY");
  assert.equal(pkg.canonicalShadow?.ruleVersion, "CG-NCSP-3.1.0");
  assert.deepEqual(pkg.canonicalShadow?.matchedRuleIds, ["F3-16"]);
  assert.ok(pkg.csvExportRow.canonical_shadow_branch_path.includes("node:rule:F3-16"));
  assert.ok(JSON.stringify(pkg.fhirLikeJson).includes("Canonical branch path"));
  assert.ok(pkg.hl7StyleMessage.includes("SHADOWPATH^Canonical shadow branch path"));
});

test("CSV exports neutralise spreadsheet formulas", () => {
  const csv = serialiseCsvRow({ patient_name: "=HYPERLINK(\"https://example.test\")" });
  assert.equal(csv.split("\n")[1], "\"'=HYPERLINK(\"\"https://example.test\"\")\"");
});
