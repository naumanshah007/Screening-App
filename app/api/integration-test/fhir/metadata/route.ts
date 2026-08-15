import { NextResponse } from "next/server";

/**
 * Public, synthetic, body-safe capability endpoint used only to verify the
 * production outbound path without patient data or invented credentials.
 */
export async function GET() {
  return NextResponse.json(
    {
      resourceType: "CapabilityStatement",
      status: "active",
      kind: "instance",
      date: "2026-08-15",
      fhirVersion: "4.0.1",
      format: ["application/fhir+json"],
      implementation: { description: "CerviGrade controlled synthetic connectivity endpoint" },
      rest: [
        {
          mode: "server",
          resource: [
            { type: "DiagnosticReport", interaction: [{ code: "read" }] },
            { type: "Observation", interaction: [{ code: "read" }] },
            { type: "Patient", interaction: [{ code: "read" }] },
          ],
        },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-CerviGrade-Test-Endpoint": "synthetic-capability-only",
      },
    }
  );
}
