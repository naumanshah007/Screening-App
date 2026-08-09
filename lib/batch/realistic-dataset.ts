/**
 * Realistic NZ Demo Dataset Generator
 *
 * Produces synthetic-but-believable cervical screening cases for demos:
 * NZ-realistic names, NHI-format identifiers, GP practices spread across
 * five regions (Northland, Auckland, Counties Manukau, Canterbury,
 * Wellington), referral dates spread across a chosen range, and
 * clinically-coherent inputs that route through the real decision engine
 * to a realistic spread of outcomes (including cases the engine correctly
 * flags for clinician review).
 *
 * Regions are modelled explicitly (rather than one Auckland-only pool)
 * because production will eventually link real per-region patient data —
 * lab results (e.g. Awanui), eReferrals, and NCSR records — across these
 * same regional boundaries. Keeping the demo data region-aware now means
 * the shape of the data won't need to change when real feeds are wired in.
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
    // Per-case sourceSystem is overridden below using REGION_LAB_SYSTEM —
    // Awanui runs a lab in each region, not just Auckland. This default is
    // only used as a fallback.
    sourceSystem: "Awanui Labs — Auckland (HL7v2)",
    mappingVersion: "hl7v2-oru-r01-v1",
  },
  erms: {
    sourceType: "erms",
    // eReferrals route through one national HealthLink EDI integration
    // regardless of region, so this stays a single system.
    sourceSystem: "HealthLink eReferrals (National EDI)",
    mappingVersion: "erms-eref-v1",
  },
  ncsr: {
    sourceType: "health-nz",
    sourceSystem: "NCSR — National Cervical Screening Register",
    mappingVersion: "ncsr-v1",
  },
};

// ─── Regions ─────────────────────────────────────────────────────────────────
// Five regions covering the spread of real NZ health-system boundaries this
// data will eventually need to line up with: Northland, Auckland, Counties
// Manukau, Canterbury (CDHB), and Wellington.

export type Region = "Northland" | "Auckland" | "Counties Manukau" | "Canterbury" | "Wellington";

// Awanui Labs site used for the per-case HL7 sourceSystem string.
const REGION_LAB_CITY: Record<Region, string> = {
  Northland: "Whangārei",
  Auckland: "Auckland",
  "Counties Manukau": "Manukau",
  Canterbury: "Christchurch",
  Wellington: "Wellington",
};

// ─── Identity pools ──────────────────────────────────────────────────────────

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

const GP_PRACTICES: { name: string; region: Region }[] = [
  // Northland
  { name: "Kaitaia Rural Health", region: "Northland" },
  { name: "Whangārei Central Health", region: "Northland" },
  { name: "Kerikeri Bay Medical Centre", region: "Northland" },
  // Auckland
  { name: "Auckland City Medical Centre", region: "Auckland" },
  { name: "Ponsonby Road Health Centre", region: "Auckland" },
  { name: "Mt Eden Family Doctors", region: "Auckland" },
  // Counties Manukau
  { name: "Ōtara Family Health Centre", region: "Counties Manukau" },
  { name: "Māngere Health Centre", region: "Counties Manukau" },
  { name: "Papatoetoe Family Doctors", region: "Counties Manukau" },
  { name: "East Tāmaki Healthcare — Ōtāhuhu", region: "Counties Manukau" },
  { name: "TaPasefika Health Trust", region: "Counties Manukau" },
  { name: "Greenstone Family Clinic, Manurewa", region: "Counties Manukau" },
  { name: "Bairds Mainfreight Primary Health", region: "Counties Manukau" },
  { name: "Clendon Medical Centre", region: "Counties Manukau" },
  { name: "Tamaki Health — Flat Bush", region: "Counties Manukau" },
  { name: "Manukau Superclinic GP", region: "Counties Manukau" },
  // Canterbury
  { name: "Riccarton Family Health", region: "Canterbury" },
  { name: "Addington Medical Centre", region: "Canterbury" },
  { name: "Rangiora Health Hub", region: "Canterbury" },
  // Wellington
  { name: "Newtown Family Health Centre", region: "Wellington" },
  { name: "Karori Medical Centre", region: "Wellington" },
  { name: "Lower Hutt Community Health", region: "Wellington" },
];

// Patients with a stable NHI so a repeat pull re-encounters them (drives the
// "Seen before" flag + previous-vs-now comparison). Synthetic — not real NHIs.
const RETURNING_PATIENTS: { name: string; nhi: string; gpPractice: string; region: Region; age: number; ethnicity: string }[] = [
  { name: "Aroha Williams", nhi: "ZAB1042", gpPractice: "Ōtara Family Health Centre", region: "Counties Manukau", age: 38, ethnicity: "MAORI" },
  { name: "Litia Taufa", nhi: "ZBC2071", gpPractice: "TaPasefika Health Trust", region: "Counties Manukau", age: 46, ethnicity: "PACIFIC" },
  { name: "Priya Reddy", nhi: "ZCD3088", gpPractice: "Auckland City Medical Centre", region: "Auckland", age: 52, ethnicity: "ASIAN" },
  { name: "Hine Rāwiri", nhi: "ZDE4019", gpPractice: "Whangārei Central Health", region: "Northland", age: 41, ethnicity: "MAORI" },
  { name: "Charlotte Hughes", nhi: "ZEF5023", gpPractice: "Riccarton Family Health", region: "Canterbury", age: 34, ethnicity: "EUROPEAN" },
  { name: "Grace Thompson", nhi: "ZFG6087", gpPractice: "Newtown Family Health Centre", region: "Wellington", age: 58, ethnicity: "EUROPEAN" },
];

// NZ ethnicity codes the app uses (see Patient.ethnicityPrimary), weighted per
// region so the mix looks plausible for that part of the country rather than
// a single national average. Directional, not census-precise.
const REGION_ETHNICITY_WEIGHTS: Record<Region, { code: string; weight: number }[]> = {
  Northland: [
    { code: "MAORI", weight: 38 },
    { code: "EUROPEAN", weight: 42 },
    { code: "PACIFIC", weight: 6 },
    { code: "ASIAN", weight: 8 },
    { code: "OTHER", weight: 6 },
  ],
  Auckland: [
    { code: "EUROPEAN", weight: 34 },
    { code: "ASIAN", weight: 31 },
    { code: "PACIFIC", weight: 12 },
    { code: "MAORI", weight: 10 },
    { code: "OTHER", weight: 13 },
  ],
  "Counties Manukau": [
    { code: "PACIFIC", weight: 22 },
    { code: "ASIAN", weight: 28 },
    { code: "MAORI", weight: 16 },
    { code: "EUROPEAN", weight: 30 },
    { code: "OTHER", weight: 4 },
  ],
  Canterbury: [
    { code: "EUROPEAN", weight: 70 },
    { code: "ASIAN", weight: 12 },
    { code: "MAORI", weight: 9 },
    { code: "PACIFIC", weight: 2 },
    { code: "OTHER", weight: 7 },
  ],
  Wellington: [
    { code: "EUROPEAN", weight: 60 },
    { code: "ASIAN", weight: 15 },
    { code: "MAORI", weight: 12 },
    { code: "PACIFIC", weight: 8 },
    { code: "OTHER", weight: 5 },
  ],
};

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

  type Identity = { name: string; nhi: string; gpPractice: string; region: Region; age: number; ethnicity: string };

  const buildCase = (identity: Identity): CanonicalBatchCase => {
    const archetype = weightedPick(ARCHETYPES);
    const receivedDate = randomDateBetween(opts.rangeStart, opts.rangeEnd);
    const sourceSystem =
      opts.connector === "hl7"
        ? `Awanui Labs — ${REGION_LAB_CITY[identity.region]} (HL7v2)`
        : preset.sourceSystem;
    return {
      caseId: crypto.randomUUID(),
      label: archetype.reason,
      patientName: identity.name,
      nhi: identity.nhi,
      gpPractice: identity.gpPractice,
      receivedDate: receivedDate.toISOString(),
      source: {
        sourceType: preset.sourceType,
        sourceSystem,
        mappingVersion: preset.mappingVersion,
        engineVersion: ENGINE_VERSION,
        rowNumber: cases.length + 1,
        importedAt,
        externalPatientId: identity.nhi,
      },
      patientAge: identity.age,
      ethnicityPrimary: identity.ethnicity,
      isFirstTimeHPVTransition: false,
      isPostHysterectomy: false,
      immunocompromised: false,
      atypicalEndometrialHistory: false,
      consecutiveNegativeCoTestCount: 0,
      consecutiveLowGradeCount: 0,
      unsatisfactoryCytologyCount: 0,
      validationStatus: "valid",
      validationErrors: [],
      validationWarnings: [],
      ...archetype.fields(),
    };
  };

  // A few patients have a STABLE NHI so a second pull re-encounters them — this
  // is what makes the "Seen before" / previous-vs-now comparison demonstrable.
  // Their clinical archetype is re-rolled each pull, so the result can change.
  const returningCount = opts.count >= 6 ? Math.min(3, RETURNING_PATIENTS.length) : 0;
  for (let i = 0; i < returningCount; i++) {
    const p = RETURNING_PATIENTS[i];
    cases.push(buildCase({ name: p.name, nhi: p.nhi, gpPractice: p.gpPractice, region: p.region, age: p.age, ethnicity: p.ethnicity }));
  }

  for (let i = returningCount; i < opts.count; i++) {
    const practice = pick(GP_PRACTICES);
    cases.push(
      buildCase({
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        nhi: randomNHI(),
        gpPractice: practice.name,
        region: practice.region,
        age: randomAge(),
        ethnicity: weightedPick(REGION_ETHNICITY_WEIGHTS[practice.region]).code,
      })
    );
  }

  // Stable sort by received date (newest first) so the worklist reads naturally.
  cases.sort((a, b) => (b.receivedDate ?? "").localeCompare(a.receivedDate ?? ""));
  cases.forEach((c, idx) => {
    c.source.rowNumber = idx + 1;
  });

  return cases;
}
