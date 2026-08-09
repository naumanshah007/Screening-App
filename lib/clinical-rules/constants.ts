export const NATIONAL_RULE_SET_KEY = "cervigrade-ncsp-national";
export const IMPORTED_PRODUCT_VERSION = "CG-NCSP-3.0.0";
export const IMPORTED_PRODUCT_VERSION_PARTS = {
  major: 3,
  minor: 0,
  patch: 0,
} as const;

export const REQUIRED_SAFETY_NOTICES = [
  "Provisional recommendation",
  "Reviewer confirmation required",
  "Not for direct clinical action",
  "Demo environment",
  "Simulated export package",
] as const;

export const DEFAULT_RULE_ACTIVATION_ENVIRONMENT = "DEMO" as const;
export const CANONICAL_ENGINE_VERSION = "canonical-graph-v1";
