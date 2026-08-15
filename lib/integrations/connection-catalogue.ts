import { CONNECTOR_CATALOG } from "@/lib/batch/integration-types";

export const CONNECTOR_TYPES = [
  "HL7_V2_LAB",
  "FHIR_R4",
  "PMS_REST",
  "SCREENING_REGISTER",
] as const;

export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export const AUTH_METHODS = [
  "NONE",
  "API_KEY",
  "BASIC",
  "OAUTH2_CLIENT_CREDENTIALS",
  "MUTUAL_TLS",
] as const;

export type IntegrationAuthMethod = (typeof AUTH_METHODS)[number];

export type MappingRequirement = {
  id: string;
  label: string;
  description: string;
};

export type ConnectorDefinition = {
  type: ConnectorType;
  catalogueId: string;
  title: string;
  shortTitle: string;
  protocol: string;
  description: string;
  authMethods: readonly IntegrationAuthMethod[];
  mappingRequirements: readonly MappingRequirement[];
  scheduleHint: string;
  gatewayRequired: boolean;
};

const byId = new Map(CONNECTOR_CATALOG.map((entry) => [entry.id, entry]));

function catalogueDescription(id: string) {
  const entry = byId.get(id);
  if (!entry) {
    throw new Error(`Connector catalogue entry ${id} is missing`);
  }
  return entry.description;
}

/**
 * Runtime instances refer back to the existing product catalogue. The catalogue
 * remains code-owned connector TYPE metadata; it is never persisted or mutated
 * when an IntegrationConnection instance is created.
 */
export const INTEGRATION_CONNECTOR_DEFINITIONS: readonly ConnectorDefinition[] = [
  {
    type: "HL7_V2_LAB",
    catalogueId: "hl7_v2",
    title: "HL7 v2 Laboratory Feed",
    shortTitle: "HL7 v2",
    protocol: "HL7 v2.x · MLLP gateway",
    description: catalogueDescription("hl7_v2"),
    authMethods: ["NONE", "BASIC", "MUTUAL_TLS"],
    gatewayRequired: true,
    scheduleHint: "Inbound delivery is gateway-managed; Vercel is not an MLLP receiver.",
    mappingRequirements: [
      { id: "nhi", label: "NHI", description: "Patient NHI identifier source" },
      { id: "accessionSpecimen", label: "Accession / specimen", description: "Stable source episode identity" },
      { id: "hpvResult", label: "HPV result", description: "HPV OBX value mapping" },
      { id: "cytology", label: "Cytology", description: "Cytology OBX value mapping" },
      { id: "histology", label: "Histology", description: "Histology OBX value mapping" },
      { id: "collectionDate", label: "Collection date", description: "Specimen collection date/time" },
    ],
  },
  {
    type: "FHIR_R4",
    catalogueId: "fhir_r4",
    title: "FHIR R4 API",
    shortTitle: "FHIR R4",
    protocol: "FHIR R4 REST",
    description: catalogueDescription("fhir_r4"),
    authMethods: ["NONE", "API_KEY", "BASIC", "OAUTH2_CLIENT_CREDENTIALS", "MUTUAL_TLS"],
    gatewayRequired: false,
    scheduleHint: "Polling metadata only; Phase 3A does not issue a FHIR request.",
    mappingRequirements: [
      { id: "nhi", label: "NHI", description: "Patient identifier/system mapping" },
      { id: "accessionSpecimen", label: "Accession / specimen", description: "Diagnostic report identity" },
      { id: "hpvResult", label: "HPV result", description: "Observation/code-system mapping" },
      { id: "cytology", label: "Cytology", description: "DiagnosticReport/Observation mapping" },
      { id: "histology", label: "Histology", description: "DiagnosticReport/Observation mapping" },
      { id: "collectionDate", label: "Collection date", description: "effective/specimen date mapping" },
    ],
  },
  {
    type: "PMS_REST",
    catalogueId: "pms",
    title: "Patient Management System",
    shortTitle: "PMS REST",
    protocol: "Generic REST API",
    description: catalogueDescription("pms"),
    authMethods: ["API_KEY", "BASIC", "OAUTH2_CLIENT_CREDENTIALS", "MUTUAL_TLS"],
    gatewayRequired: false,
    scheduleHint: "Generic polling metadata; no vendor contract is assumed.",
    mappingRequirements: [
      { id: "patientIdentifier", label: "Patient identifier", description: "NHI/patient identifier field" },
      { id: "demographics", label: "Demographics", description: "Demographic field group" },
      { id: "screeningHistory", label: "Screening history", description: "Historical screening result collection" },
      { id: "sourceEpisodeIdentity", label: "Source episode identity", description: "Stable record/import identity" },
    ],
  },
  {
    type: "SCREENING_REGISTER",
    catalogueId: "health_nz",
    title: "Screening Register / Health NZ",
    shortTitle: "Screening Register",
    protocol: "Contract-defined Health NZ API",
    description: catalogueDescription("health_nz"),
    authMethods: ["OAUTH2_CLIENT_CREDENTIALS", "MUTUAL_TLS"],
    gatewayRequired: false,
    scheduleHint: "Contract-dependent lookup metadata; no endpoint or operation is assumed.",
    mappingRequirements: [
      { id: "nhi", label: "NHI lookup", description: "Participant identifier lookup" },
      { id: "screeningHistory", label: "Screening history", description: "Programme history response mapping" },
      { id: "sourceEpisodeIdentity", label: "Source episode identity", description: "Stable programme result identity" },
    ],
  },
] as const;

export function getConnectorDefinition(type: ConnectorType) {
  const definition = INTEGRATION_CONNECTOR_DEFINITIONS.find((item) => item.type === type);
  if (!definition) throw new Error(`Unsupported connector type: ${type}`);
  return definition;
}

export function getCatalogueEntryForConnector(type: ConnectorType) {
  const definition = getConnectorDefinition(type);
  const entry = byId.get(definition.catalogueId);
  if (!entry) throw new Error(`Catalogue entry ${definition.catalogueId} is missing`);
  return entry;
}
