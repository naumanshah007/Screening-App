export const PILOT_GOVERNANCE_BASELINE = {
  interpretationCards: 16,
  distinctClinicalApprovals: 2,
  canonicalActivationGates: 11,
  source: "docs/canonical-activation-gate-status.md",
} as const;

export const EXTERNAL_PILOT_GATES = [
  "Customer privacy impact assessment and privacy approval",
  "New Zealand data-residency and hosting approval",
  "Customer security and operator approval",
  "Clinical governance approval for the pilot operating protocol",
  "Dedicated pilot infrastructure, DNS and access-control provisioning",
  "Hospital SSO/IdP configuration and MFA evidence if SSO is selected",
  "Managed backup credentials, schedule and provider-level restore evidence",
  "External immutable/WORM audit anchoring",
  "Customer-approved retention, deletion and legal-hold policy",
  "Real-data data-sharing/processing authority and named pilot cohort",
  "Production/staging migration and deployment approval",
] as const;

export type ExternalPilotGateStatus = "EXTERNAL GATE — NOT YET SATISFIED";

export function getExternalPilotGates() {
  return EXTERNAL_PILOT_GATES.map((name) => ({
    name,
    status: "EXTERNAL GATE — NOT YET SATISFIED" as ExternalPilotGateStatus,
  }));
}
