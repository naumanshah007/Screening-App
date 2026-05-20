/**
 * Batch Processing — "Real-world Sample" Demo Dataset
 *
 * A deliberately messy dataset that exercises the validation and parsing
 * layers. Use this in demos to show that the system handles imperfect
 * source data gracefully — bad enums, missing IDs, partial rows, mixed
 * case, duplicates — rather than silently passing junk to the engine.
 *
 * Returns ParsedSourceRow[] (post-adapter shape) so the validation layer
 * runs against it the same way it would against an uploaded CSV.
 *
 * DEMO DATA — NOT REAL PATIENT DATA.
 */

import type { ParsedSourceRow } from "./types";

// Each row is a Record<string, unknown> like what an adapter would produce
// for an uploaded CSV/XLSX/JSON. Deliberate issues are commented inline.
export function buildMessyDataset(): ParsedSourceRow[] {
  const fields = [
    "externalPatientId", "label", "patientAge", "ethnicityPrimary",
    "hpvResult", "cytologyResult", "sampleType",
    "immunocompromised", "isPregnant", "isPostHysterectomy",
    "isFirstTimeHPVTransition", "hasAbnormalVaginalBleeding", "hasCancerSymptoms",
    "repeatStage", "testOfCureStage",
  ];

  const raw: Array<Record<string, unknown>> = [
    // 1 — Perfectly valid row to anchor the demo
    {
      externalPatientId: "LAB-001-2026",
      label: "Routine HPV negative — clean row",
      patientAge: 38,
      ethnicityPrimary: "EUROPEAN",
      hpvResult: "NOT_DETECTED",
      sampleType: "LBC",
      immunocompromised: false,
    },

    // 2 — Mixed case enum that adapter should normalise
    {
      externalPatientId: "LAB-002-2026",
      label: "Mixed-case enum (hpv_16_18 lowercase)",
      patientAge: 42,
      ethnicityPrimary: "MAORI",
      hpvResult: "hpv_16_18",            // ← lowercase, should normalise
      sampleType: "lbc",                  // ← lowercase
    },

    // 3 — Missing patient ID (warning, not error)
    {
      // externalPatientId omitted
      label: "Missing NHI / patient ID",
      patientAge: 29,
      ethnicityPrimary: "PACIFIC",
      hpvResult: "HPV_OTHER",
      cytologyResult: "LSIL",
      sampleType: "LBC",
    },

    // 4 — Bad enum value (should fail validation → invalid)
    {
      externalPatientId: "LAB-004-2026",
      label: "Bad HPV enum: 'POSITIVE' instead of code",
      patientAge: 35,
      ethnicityPrimary: "ASIAN",
      hpvResult: "POSITIVE",              // ← not a valid enum
      sampleType: "LBC",
    },

    // 5 — Age out of range (should fail validation)
    {
      externalPatientId: "LAB-005-2026",
      label: "Age out of plausible range",
      patientAge: 145,                    // ← invalid
      ethnicityPrimary: "MAORI",
      hpvResult: "NOT_DETECTED",
    },

    // 6 — Whitespace in fields
    {
      externalPatientId: "  LAB-006-2026  ",
      label: "Whitespace in cells",
      patientAge: 50,
      ethnicityPrimary: " European ",     // ← padding
      hpvResult: " HPV_OTHER ",           // ← padding
      cytologyResult: "NEGATIVE",
      sampleType: "LBC",
    },

    // 7 — Duplicate of #1's patient ID (warning: duplicate)
    {
      externalPatientId: "LAB-001-2026",  // ← duplicate
      label: "Duplicate patient ID",
      patientAge: 40,
      ethnicityPrimary: "PACIFIC",
      hpvResult: "HPV_OTHER",
      cytologyResult: "LSIL",
      sampleType: "LBC",
    },

    // 8 — Partial row (only HPV result, missing context)
    {
      externalPatientId: "LAB-008-2026",
      label: "Partial row — HPV only",
      hpvResult: "HPV_16_18",
      // age, ethnicity, sample type, all missing
    },

    // 9 — Pregnant + HSIL (valid, exercises Figure 9)
    {
      externalPatientId: "LAB-009-2026",
      label: "Pregnant + HSIL — Figure 9 pathway",
      patientAge: 31,
      ethnicityPrimary: "MAORI",
      hpvResult: "HPV_OTHER",
      cytologyResult: "HSIL",
      isPregnant: "yes",                  // ← string boolean — adapter should coerce
      sampleType: "LBC",
    },

    // 10 — Urgent: bleeding + cancer symptoms (exercises Figure 10)
    {
      externalPatientId: "LAB-010-2026",
      label: "Abnormal bleeding + cancer Sx — urgent",
      patientAge: 56,
      ethnicityPrimary: "PACIFIC",
      hasAbnormalVaginalBleeding: 1,      // ← numeric boolean
      hasCancerSymptoms: "TRUE",          // ← uppercase string boolean
    },

    // 11 — Unknown column (should appear in unmappedColumns)
    {
      externalPatientId: "LAB-011-2026",
      label: "Unknown column included",
      patientAge: 44,
      ethnicityPrimary: "EUROPEAN",
      hpvResult: "NOT_DETECTED",
      sampleType: "LBC",
      labOrderId: "ORD-998-A",            // ← not a known field
      collectorInitials: "JR",            // ← not a known field
    },

    // 12 — Test of Cure stage with abbreviation
    {
      externalPatientId: "LAB-012-2026",
      label: "Test of Cure — first test",
      patientAge: 36,
      ethnicityPrimary: "ASIAN",
      hpvResult: "NOT_DETECTED",
      cytologyResult: "NEGATIVE",
      testOfCureStage: "FIRST_TEST",
      sampleType: "LBC",
    },

    // 13 — Immunocompromised, no HPV result yet
    {
      externalPatientId: "LAB-013-2026",
      label: "Immunocompromised, awaiting HPV result",
      patientAge: 47,
      ethnicityPrimary: "OTHER",
      immunocompromised: "Y",             // ← single-letter boolean
      sampleType: "LBC",
    },

    // 14 — Post-hysterectomy
    {
      externalPatientId: "LAB-014-2026",
      label: "Post-hysterectomy (subtotal) — continued screening",
      patientAge: 58,
      ethnicityPrimary: "MAORI",
      isPostHysterectomy: true,
      hysterectomyType: "SUBTOTAL",
      hysterectomyIndication: "BENIGN_GYNAECOLOGICAL_DISEASE",
      hysterectomySpecimenPathology: "NO_CERVICAL_PATHOLOGY",
    },
  ];

  return raw.map((row, index) => {
    const parsed: ParsedSourceRow = {
      _rowIndex: index,
      _sourceFields: fields,
    };
    for (const [k, v] of Object.entries(row)) {
      if (v !== undefined && v !== null && v !== "") parsed[k] = v;
    }
    return parsed;
  });
}
