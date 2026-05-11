/**
 * National Colposcopy Screening Registry (NCSR) integration client.
 *
 * This module defines the interface for pulling patient data from the
 * national colposcopy database. All access is restricted to authorised
 * users (COLPO_CNS, SMO_REVIEWER, ADMIN) and every request is audit-logged
 * for data sovereignty compliance.
 *
 * Data sovereignty: NCSR data is hosted within the NZ health cloud (Azure
 * NZ North). This client must never route data through overseas endpoints.
 *
 * Current state: STUB implementation — real API credentials and endpoint
 * are provided by Health NZ integration team after MoU is signed.
 */

import { prisma } from "@/lib/prisma";

// ─── NCSR data types ───────────────────────────────────────────────────────

export type NcsrPatientRecord = {
  nhiNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO 8601
  ethnicity?: string;
  previousColposcopyVisits: NcsrColposcopyVisit[];
  previousTreatments: NcsrTreatment[];
  hpvHistory: NcsrHpvResult[];
  lastUpdated: string; // ISO 8601
};

export type NcsrColposcopyVisit = {
  visitDate: string;
  facility: string;
  clinician: string;
  colposcopyFindings: string;
  histologyResult?: string;
  managementDecision: string;
};

export type NcsrTreatment = {
  treatmentDate: string;
  treatmentType: string; // LLETZ, cone biopsy, cryotherapy, etc.
  facility: string;
  outcome?: string;
};

export type NcsrHpvResult = {
  testDate: string;
  hpvType: string;
  result: string;
  laboratoryId?: string;
};

export type NcsrPullResult =
  | { ok: true; data: NcsrPatientRecord }
  | { ok: false; error: string; code: "NOT_FOUND" | "UNAUTHORIZED" | "UNAVAILABLE" | "STUB" };

// ─── Integration config ────────────────────────────────────────────────────

type NcsrConfig = {
  baseUrl: string;
  apiKey: string;
  tenantId: string;
};

function getNcsrConfig(): NcsrConfig | null {
  const baseUrl = process.env.NCSR_API_BASE_URL;
  const apiKey = process.env.NCSR_API_KEY;
  const tenantId = process.env.NCSR_TENANT_ID ?? "cmdhb"; // Counties Manukau DHB
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey, tenantId };
}

// ─── Audit logging ─────────────────────────────────────────────────────────

async function auditNcsrAccess(args: {
  userId: string | null;
  nhiNumber: string;
  action: "PULL" | "PULL_FAILED";
  detail?: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId: args.userId,
      action: `NCSR_${args.action}`,
      entity: "NcsrRecord",
      entityId: args.nhiNumber,
      newValue: args.detail ?? null,
      exportEvent: true, // flag for restricted data access reporting
    },
  });
}

// ─── Client ────────────────────────────────────────────────────────────────

/**
 * Pull a patient's NCSR history by NHI number.
 *
 * Every call is audit-logged regardless of outcome.
 * Returns a stub result if NCSR credentials are not configured.
 */
export async function pullNcsrPatientRecord(args: {
  nhiNumber: string;
  requestedByUserId: string;
}): Promise<NcsrPullResult> {
  const config = getNcsrConfig();

  if (!config) {
    // Stub mode — return synthetic data for demo / development
    await auditNcsrAccess({
      userId: args.requestedByUserId,
      nhiNumber: args.nhiNumber,
      action: "PULL",
      detail: "STUB_MODE — NCSR_API_KEY not configured",
    });

    return {
      ok: false,
      error:
        "NCSR integration is not yet configured. Set NCSR_API_BASE_URL and NCSR_API_KEY in environment to enable live data pull.",
      code: "STUB",
    };
  }

  try {
    const response = await fetch(
      `${config.baseUrl}/v1/patients/${encodeURIComponent(args.nhiNumber)}`,
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "X-Tenant-ID": config.tenantId,
          "X-Requesting-User": args.requestedByUserId,
          Accept: "application/json",
        },
        // Enforce NZ data residency — no redirects to overseas endpoints
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (response.status === 404) {
      await auditNcsrAccess({
        userId: args.requestedByUserId,
        nhiNumber: args.nhiNumber,
        action: "PULL_FAILED",
        detail: "NOT_FOUND",
      });
      return { ok: false, error: "Patient not found in NCSR", code: "NOT_FOUND" };
    }

    if (response.status === 403) {
      await auditNcsrAccess({
        userId: args.requestedByUserId,
        nhiNumber: args.nhiNumber,
        action: "PULL_FAILED",
        detail: "UNAUTHORIZED",
      });
      return { ok: false, error: "Access denied by NCSR", code: "UNAUTHORIZED" };
    }

    if (!response.ok) {
      const detail = `HTTP ${response.status}`;
      await auditNcsrAccess({
        userId: args.requestedByUserId,
        nhiNumber: args.nhiNumber,
        action: "PULL_FAILED",
        detail,
      });
      return { ok: false, error: `NCSR returned ${response.status}`, code: "UNAVAILABLE" };
    }

    const data = (await response.json()) as NcsrPatientRecord;

    await auditNcsrAccess({
      userId: args.requestedByUserId,
      nhiNumber: args.nhiNumber,
      action: "PULL",
      detail: `${data.previousColposcopyVisits.length} visits, ${data.previousTreatments.length} treatments`,
    });

    return { ok: true, data };
  } catch (err) {
    await auditNcsrAccess({
      userId: args.requestedByUserId,
      nhiNumber: args.nhiNumber,
      action: "PULL_FAILED",
      detail: String(err),
    });
    return { ok: false, error: "NCSR service unavailable", code: "UNAVAILABLE" };
  }
}

/** Returns whether live NCSR integration is configured */
export function isNcsrConfigured(): boolean {
  return Boolean(process.env.NCSR_API_BASE_URL && process.env.NCSR_API_KEY);
}
