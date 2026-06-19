/**
 * Realistic NZ Demo Dataset Generator
 *
 * Produces synthetic-but-believable cervical screening cases for demos:
 * NZ-realistic names, NHI-format identifiers, a Counties Manukau ethnicity
 * mix, South Auckland GP practices, referral dates spread across a chosen
 * range, and clinically-coherent inputs that route through the real decision
 * engine to a realistic spread of outcomes (including cases the engine
 * correctly flags for clinician review).
 *
 * IMPORTANT: This is SYNTHETIC data. No real patients. In production these
 * cases arrive from the lab HL7v2 feed / eReferral / NCSR via the adapter
 * layer; the downstream validation, engine, and worklist are identical.
 */

import type { CanonicalBatchCase, SourceType } from "./types";
import { ENGINE_VERSION } from "./processor";

// ─── Source presets (what each connector "pulls") ───────────────────────────

export type ConnectorId = "hl7" | "erms" | "ncsr";

export const CONNECTOR_PRESETS: Record<
  ConnectorId,
  { sourceType: SourceType; sourceSystem: string; mappingVersion: string }
> = {
  hl7: {
    sourceType: "hl7",
    sourceSystem: "Awanui Labs — Auckland (HL7v2)",
    mappingVersion: "hl7v2-oru-r01-v1",
  },
  erms: {
    sourceType: "erms",
    sourceSystem: "Counties Manukau eReferrals (HealthLink EDI)",
    mappingVersion: "erms-eref-v1",
  },
  ncsr: {
    sourceType: "health-nz",
    sourceSystem: "NCSR — National Cervical Screening Register",
    mappingVersion: "ncsr-v1",
  },
};

// ─── Identity pools (South Auckland / Counties Manukau flavour) ──────────────

const FIRST_NAMES = [
  // Pacific
  "Mere", "Sina", "Litia", "Ana", "Talia", "Losa", "Mele", "Fetu", "Ofa", "Sela",
  // Māori
  "Aroha", "Hine", "Mihi", "Ngaire", "Awhina", "Manaia", "Kahu", "Tia",
  // Pākehā / European
  "Emma", "Charlotte", "Olivia", "Sophie", "Hannah", "Ruby", "Grace", "Chloe",
  // Asian (Indian / Chinese / Filipino)
  "Priya", "Anjali", "Mei", "Ling", "Wei", "Maria", "Divya", "Sunita", "Joy", "Rose",
];

const LAST_NAMES = [
  "Williams", "Tuʻipulotu", "Faʻavae", "Nguyen", "Patel", "Singh", "Wang", "Chen",
  "Taufa", "Latu", "Vaʻai", "Ngata", "Heke", "Rāwiri", "Thompson", "Anderson",
  "Reddy", "Kumar", "Sharma", "Lee", "Wong", "Cruz", "Santos", "Fonoti", "Pouesi",
  "Mafileʻo", "Tupou", "Walker", "Hughes", "Brown",
];

const GP_PRACTICES = [
  "Ōtara Family Health Centre",
  "Māngere Health Centre",
  "Papatoetoe Family Doctors",
  "East Tāmaki Healthcare — Ōtāhuhu",
  "TaPasefika Health Trust",
  "Greenstone Family Clinic, Manurewa",
  "Bairds Mainfreight Primary Health",
  "Clendon Medical Centre",
  "Tamaki Health — Flat Bush",
  "Manukau Superclinic GP",
];

// NZ ethnicity codes the app uses (see Patient.ethnicityPrimary).
// Weighted to Counties Manukau demographics.
const ETHNICITY_WEIGHTS: { code: string; weight: number }[] = [
  { code: "PACIFIC", weight: 22 },
  { code: "ASIAN", weight: 28 },
  { code: "MAORI", weight: 16 },
  { code: "EUROPEAN", weight: 30 },
  { code: "OTHER", weight: 4 },
];

// ─── Clinical archetypes (route coherently through the engine) ───────────────

type Archetype = {
  /** Short clinical descriptor for the worklist label. */
  reason: string;
  weight: number;
  /** Clinical fields merged onto the case. */
  fields: () => Partial<CanonicalBatchCase>;
};

const ARCHETYPES: Archetype[] = [
  {
    reason: "HPV not detected — routine screen",
    weight: 30,
    fields: () => ({ hpvResult: "NOT_DETECTED", sampleType: "LBC" }),
  },
  {
    reason: "HPV not detected (immune deficient) — 3-yearly",
    weight: 4,
    fields: () => ({ hpvResult: "NOT_DETECTED", sampleType: "LBC", immunocompromised: true }),
  },
  {
    reason: "HPV (other) + negative cytology",
    weight: 12,
    fields: () => ({ hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE", sampleType: "LBC" }),
  },
  {
    reason: "HPV (other) + LSIL",
    weight: 6,
    fields: () => ({ hpvResult: "HPV_OTHER", cytologyResult: "LSIL", sampleType: "LBC" }),
  },
  {
    reason: "HPV 16/18 detected",
    weight: 9,
    fields: () => ({ hpvResult: "HPV_16_18", cytologyResult: "NEGATIVE", sampleType: "LBC" }),
  },
  {
    reason: "HPV 16/18 + HSIL — urgent",
    weight: 3,
    fields: () => ({ hpvResult: "HPV_16_18", cytologyResult: "HSIL", sampleType: "LBC" }),
  },
  {
    reason: "HPV (other) + HSIL",
    weight: 4,
    fields: () => ({ hpvResult: "HPV_OTHER", cytologyResult: "HSIL", sampleType: "LBC" }),
  },
  {
    reason: "Glandular abnormality (AG2)",
    weight: 3,
    fields: () => ({ hpvResult: "HPV_OTHER", cytologyResult: "AG2", sampleType: "LBC" }),
  },
  {
    reason: "Inadequate HPV sample — repeat",
    weight: 3,
    fields: () => ({ hpvResult: "INADEQUATE", sampleType: "LBC" }),
  },
  {
    reason: "Self-collected swab, HPV (other)",
    weight: 4,
    fields: () => ({ hpvResult: "HPV_OTHER", sampleType: "SWAB" }),
  },
  {
    reason: "Test of Cure — HPV detected post-treatment",
    weight: 3,
    fields: () => ({ isTestOfCure: true, hpvResult: "HPV_16_18", cytologyResult: "NEGATIVE" }),
  },
  {
    reason: "First HPV transition — overdue, invite",
    weight: 4,
    fields: () => ({ isFirstTimeHPVTransition: true, screeningStatus: "OVERDUE" }),
  },
  {
    reason: "Second repeat HPV (other) persists",
    weight: 3,
    fields: () => ({ hpvResult: "HPV_OTHER", repeatStage: "SECOND_REPEAT", cytologyResult: "NEGATIVE", sampleType: "LBC" }),
  },
  {
    reason: "Previous high-grade — history unavailable",
    weight: 6,
    fields: () => ({
      isFirstTimeHPVTransition: true,
      priorHighGradeResult: true,
      historySourceAvailable: false,
    }),
  },
  {
    reason: "Postmenopausal bleeding — ? cancer",
    weight: 3,
    fields: () => ({
      hasAbnormalVaginalBleeding: true,
      hasCancerSymptoms: true,
      suspicionOfCancer: true,
      abnormalCervix: true,
    }),
  },
];

// ─── Random helpers ──────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

const NHI_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // excludes I and O per NHI rules

function randomNHI(): string {
  let s = "";
  for (let i = 0; i < 3; i++) s += pick(NHI_LETTERS.split(""));
  for (let i = 0; i < 4; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function randomAge(): number {
  // Mostly 25–69 screening range, occasional 70–74.
  const roll = Math.random();
  if (roll < 0.05) return 70 + Math.floor(Math.random() * 5);
  return 25 + Math.floor(Math.random() * 45);
}

function randomDateBetween(start: Date, end: Date): Date {
  const t = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(t);
}

// ─── Generator ───────────────────────────────────────────────────────────────

export interface GenerateOptions {
  connector: ConnectorId;
  count: number;
  /** Referral received-date window (inclusive). */
  rangeStart: Date;
  rangeEnd: Date;
}

export function generateRealisticCases(opts: GenerateOptions): CanonicalBatchCase[] {
  const preset = CONNECTOR_PRESETS[opts.connector];
  const importedAt = new Date().toISOString();
  const cases: CanonicalBatchCase[] = [];

  for (let i = 0; i < opts.count; i++) {
    const archetype = weightedPick(ARCHETYPES);
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const nhi = randomNHI();
    const receivedDate = randomDateBetween(opts.rangeStart, opts.rangeEnd);

    cases.push({
      caseId: crypto.randomUUID(),
      label: archetype.reason,
      patientName: `${firstName} ${lastName}`,
      nhi,
      gpPractice: pick(GP_PRACTICES),
      receivedDate: receivedDate.toISOString(),
      source: {
        sourceType: preset.sourceType,
        sourceSystem: preset.sourceSystem,
        mappingVersion: preset.mappingVersion,
        engineVersion: ENGINE_VERSION,
        rowNumber: i + 1,
        importedAt,
        externalPatientId: nhi,
      },

      // Required defaults
      patientAge: randomAge(),
      ethnicityPrimary: weightedPick(ETHNICITY_WEIGHTS).code,
      isFirstTimeHPVTransition: false,
      isPostHysterectomy: false,
      immunocompromised: false,
      atypicalEndometrialHistory: false,
      consecutiveNegativeCoTestCount: 0,
      consecutiveLowGradeCount: 0,
      unsatisfactoryCytologyCount: 0,

      // Validation — synthetic data is pre-validated
      validationStatus: "valid",
      validationErrors: [],
      validationWarnings: [],

      // Clinical archetype overrides
      ...archetype.fields(),
    });
  }

  // Stable sort by received date (newest first) so the worklist reads naturally.
  cases.sort((a, b) => (b.receivedDate ?? "").localeCompare(a.receivedDate ?? ""));
  cases.forEach((c, idx) => {
    c.source.rowNumber = idx + 1;
  });

  return cases;
}
