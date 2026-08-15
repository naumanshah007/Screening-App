import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProtectedAuditEntry,
  verifyProtectedAuditEntry,
} from "@/lib/security/audit";

function withRuntimeMode<T>(mode: string, run: () => T): T {
  const previous = process.env.CERVIGRADE_RUNTIME_MODE;
  process.env.CERVIGRADE_RUNTIME_MODE = mode;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.CERVIGRADE_RUNTIME_MODE;
    else process.env.CERVIGRADE_RUNTIME_MODE = previous;
  }
}

function verifiable(entry: ReturnType<typeof buildProtectedAuditEntry>) {
  return {
    id: String(entry.id),
    userId: typeof entry.userId === "string" ? entry.userId : null,
    action: entry.action,
    entity: entry.entity,
    entityId: typeof entry.entityId === "string" ? entry.entityId : null,
    oldValue: typeof entry.oldValue === "string" ? entry.oldValue : null,
    newValue: typeof entry.newValue === "string" ? entry.newValue : null,
    ipAddress: typeof entry.ipAddress === "string" ? entry.ipAddress : null,
    userAgent: typeof entry.userAgent === "string" ? entry.userAgent : null,
    exportEvent: Boolean(entry.exportEvent),
    severity: entry.severity ?? "INFO",
    correlationId:
      typeof entry.correlationId === "string" ? entry.correlationId : null,
    sessionId: typeof entry.sessionId === "string" ? entry.sessionId : null,
    createdAt: entry.createdAt as Date,
    protectedAt: (entry.protectedAt as Date | undefined) ?? null,
    integrityDigest:
      typeof entry.integrityDigest === "string" ? entry.integrityDigest : null,
  };
}

test("validation/pilot-style evidence is sanitized, digested, and verifiable", () => {
  withRuntimeMode("VALIDATION", () => {
    const entry = buildProtectedAuditEntry({
      userId: "actor-1",
      action: "PHI_RECORD_READ",
      entity: "Patient",
      entityId: "patient-internal-id",
      newValue: { patientName: "Synthetic Sensitive", purpose: "direct-care" },
      createdAt: new Date("2026-08-15T00:00:00.000Z"),
    });
    assert.match(String(entry.integrityDigest), /^[a-f0-9]{64}$/);
    assert.doesNotMatch(String(entry.newValue), /Synthetic Sensitive/);
    assert.equal(verifyProtectedAuditEntry(verifiable(entry)), true);

    const tampered = { ...verifiable(entry), action: "TAMPERED" };
    assert.equal(verifyProtectedAuditEntry(tampered), false);
  });
});

test("demo evidence stays resettable and makes no immutability claim", () => {
  withRuntimeMode("DEMO", () => {
    const entry = buildProtectedAuditEntry({
      action: "SIMULATED_PACKAGE_EXPORT",
      entity: "DecisionPackage",
    });
    assert.equal(entry.integrityDigest, undefined);
    assert.equal(entry.protectedAt, undefined);
  });
});
