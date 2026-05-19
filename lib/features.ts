const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function readFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return TRUE_VALUES.has(raw.trim().toLowerCase());
}

export const featureFlags = {
  // Core clinical modules — on by default
  legacyCervical: readFlag("ENABLE_LEGACY_CERVICAL", true),
  casesV2: readFlag("ENABLE_CASES_V2", true),
  documentIngest: readFlag("ENABLE_DOCUMENT_INGEST", true),
  colposcopyModule: readFlag("ENABLE_COLPOSCOPY_MODULE", true),
  gynaecologyModule: readFlag("ENABLE_GYNAECOLOGY_MODULE", true),

  // Stub integrations — OFF by default until credentials/MoU are in place.
  // Enable via environment variable once the integration is live and tested.
  aiAssist: readFlag("ENABLE_AI_ASSIST", false),
  restrictedColpoIntegration: readFlag("ENABLE_RESTRICTED_COLPO_INTEGRATION", false),

  // Batch processing demo — OFF by default.
  // Enable with ENABLE_BATCH_DEMO=true for demo environments.
  batchDemo: readFlag("ENABLE_BATCH_DEMO", false),
} as const;

export type FeatureFlagName = keyof typeof featureFlags;

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  return featureFlags[name];
}
