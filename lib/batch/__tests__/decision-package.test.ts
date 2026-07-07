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
  batchRun: {
    id: "run-1",
    source: "DEMO",
    sourceSystem: "Awanui Labs demo connector",
    sourceFileName: null,
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
