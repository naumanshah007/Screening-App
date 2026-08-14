import { createHash } from "node:crypto";

import { deterministicJson } from "@/lib/clinical-rules/checksum";
import type { ClinicalInput } from "@/lib/engine/types";
import type { CanonicalBatchCase } from "@/lib/batch/types";

/**
 * Source identity for an arriving case.
 *
 * THREE DIFFERENT QUESTIONS, THREE DIFFERENT KEYS
 * -----------------------------------------------
 * These are routinely conflated, and conflating them produces both false
 * duplicates and missed updates:
 *
 *   1. "Have we already received this DELIVERY?"  → IngestionReceipt.deliveryKey
 *      Transport-level. An HL7 message control ID, an uploaded file's hash, a
 *      connector's delivery id. Answers replay, and nothing clinical. A message
 *      control ID is emphatically NOT clinical episode identity: a lab may
 *      resend the same episode under a new control number, and an amended
 *      report always does.
 *
 *   2. "Is this the same clinical EPISODE?"       → sourceEpisodeKey (+ facility)
 *      The accession or specimen identifier. Stable across amendments to the
 *      same specimen, which is exactly the property that makes an amended
 *      result recognisable as an update rather than a new case.
 *
 *   3. "Has anything CLINICALLY meaningful changed?" → clinicalPayloadDigest
 *      Not the same as "has anything changed" — see below.
 *
 * This module computes (1) and (3) and carries the identifiers for (2). Episode
 * classification itself is a separate concern and lives elsewhere.
 */

// ─── Digests ────────────────────────────────────────────────────────────────

/**
 * Fields excluded from the clinical digest because they identify the delivery
 * rather than describe the patient.
 *
 * `patientId` is regenerated per pull, so including it would make every
 * re-delivery of an unchanged episode look like new clinical information —
 * which is the exact failure this digest exists to prevent.
 */
const NON_CLINICAL_INPUT_FIELDS = new Set(["patientId"]);

/** ISO date, no time — a lab reporting midnight vs midday is not a change. */
function normaliseDateLike(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}([T ]|$)/;

function normaliseValue(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (DATE_LIKE.test(trimmed)) return normaliseDateLike(trimmed);
    // Enum-valued in practice. Case and internal spacing are formatting, not
    // clinical content, so a lab switching to lower case must not read as an
    // amended result.
    return trimmed.toUpperCase().replace(/\s+/g, " ");
  }

  if (Array.isArray(value)) {
    const items = value.map(normaliseValue).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => [key, normaliseValue(child)] as const)
      .filter(([, child]) => child !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }

  return value;
}

/**
 * The normalised clinical facts a digest is taken over.
 *
 * WHY THE WHOLE ClinicalInput
 * ---------------------------
 * Rather than curating a list of "important" fields — which would drift from
 * the engine and silently stop noticing a change — this normalises everything
 * the engine consumes. `ClinicalInput` is by construction exactly the set of
 * facts that can alter a recommendation: anything in it can change the outcome,
 * and anything not in it cannot. A field added to the engine is therefore
 * covered here the day it is added, with no second list to remember.
 *
 * Exported for tests and for explaining a match to a reviewer.
 */
export function normaliseClinicalFacts(input: ClinicalInput): Record<string, unknown> {
  const entries = Object.entries(input as unknown as Record<string, unknown>)
    .filter(([key]) => !NON_CLINICAL_INPUT_FIELDS.has(key))
    .map(([key, value]) => [key, normaliseValue(value)] as const)
    .filter(([, value]) => value !== undefined);

  return Object.fromEntries(entries);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Digest of the clinically meaningful content, normalised.
 *
 * This is the ONLY digest that may cause a case to be classified as UPDATED. A
 * change here means the governed rules could now reach a different
 * recommendation, which is the only kind of change that justifies asking a
 * clinician to look again.
 */
export function clinicalPayloadDigest(input: ClinicalInput): string {
  return sha256(deterministicJson(normaliseClinicalFacts(input)));
}

/**
 * Volatile per-delivery metadata, excluded from the raw digest.
 *
 * Without these exclusions the raw digest would differ on every pull of an
 * unchanged case and would report nothing at all.
 */
const VOLATILE_CASE_FIELDS = new Set(["caseId"]);
const VOLATILE_SOURCE_FIELDS = new Set(["importedAt", "rowNumber"]);

/**
 * Digest of everything that arrived, normalisation aside.
 *
 * Deliberately broader than the clinical digest: it changes when a name
 * spelling, a GP practice or a demographic detail is corrected. Those matter
 * for provenance and for explaining "this arrived again and was different", but
 * they must NOT drive re-evaluation, because no governed rule reads them.
 * Keeping both digests is what lets the product tell a cosmetic redelivery
 * apart from an amended result.
 */
export function rawPayloadDigest(batchCase: CanonicalBatchCase): string {
  const { source, ...rest } = batchCase as unknown as Record<string, unknown> & {
    source: Record<string, unknown>;
  };

  const caseFields = Object.fromEntries(
    Object.entries(rest).filter(([key]) => !VOLATILE_CASE_FIELDS.has(key))
  );
  const sourceFields = Object.fromEntries(
    Object.entries(source ?? {}).filter(([key]) => !VOLATILE_SOURCE_FIELDS.has(key))
  );

  return sha256(deterministicJson({ ...caseFields, source: sourceFields }));
}

// ─── Ingestion identity ─────────────────────────────────────────────────────

/** Where a delivery came in. Distinct from the clinical source facility. */
export type IngestionChannel =
  | "upload"
  | "demo-connector"
  | "manual"
  | "fhir"
  | "hl7-gateway";

/**
 * Transport-level identity of one delivery.
 *
 * `deliveryKey` is whatever the channel uses to name a single delivery: an HL7
 * MSH-10 message control ID, the SHA-256 of an uploaded file, a FHIR page
 * cursor. It is scoped by channel and organisation, never compared across them,
 * and never used to decide anything clinical.
 */
export type DeliveryIdentity = {
  channel: IngestionChannel;
  deliveryKey: string;
};

/** Delivery key for an uploaded file: its content hash. */
export function fileDeliveryKey(contents: string | Uint8Array): string {
  return sha256(
    typeof contents === "string" ? contents : Buffer.from(contents).toString("base64")
  );
}
