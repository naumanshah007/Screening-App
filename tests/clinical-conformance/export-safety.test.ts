import assert from "node:assert/strict";
import test from "node:test";
import { buildSimulatedDecisionPackage, serialiseCsvRow, type DecisionPackageInput } from "../../lib/decisions/package-generator";

const item: DecisionPackageInput = { id: "SYNTHETIC", batchRunId: "RUN", disposition: "ACCEPTED", patientName: "Synthetic Patient", nhi: null, externalPatientId: null, patientAge: 35, gpPractice: null, recommendation: "Provisional recommendation", recommendationCode: "SYNTHETIC", referralPriority: null, referralType: null, riskLevel: "LOW", reviewedAt: new Date(0), reviewNote: null, overrideReason: null, reviewedBy: { name: "Synthetic Reviewer" }, batchRun: { id: "RUN", source: "demo", sourceSystem: null, sourceFileName: null, createdAt: new Date(0) } };

test("all package surfaces remain simulated/integration-preview/not-for-action labelled", () => {
  const pkg = buildSimulatedDecisionPackage(item, new Date(0).toISOString());
  const serialised = JSON.stringify(pkg);
  assert.match(serialised, /simulated export package/i);
  assert.match(serialised, /integration-ready preview/i);
  assert.match(serialised, /not for direct clinical action/i);
});

test("CSV export row contains the safety labels", () => {
  const pkg = buildSimulatedDecisionPackage(item, new Date(0).toISOString());
  const csv = serialiseCsvRow(pkg.csvExportRow);
  assert.match(csv, /simulated/i);
  assert.match(csv, /not for direct clinical action/i);
});

test("FHIR-like and HL7-style previews contain a direct-clinical-action prohibition", () => {
  const pkg = buildSimulatedDecisionPackage(item, new Date(0).toISOString());
  assert.match(JSON.stringify(pkg.fhirLikeJson), /not for direct clinical action/i);
  assert.match(pkg.hl7StyleMessage, /not for direct clinical action/i);
});
