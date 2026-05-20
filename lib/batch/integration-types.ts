/**
 * Integration Types — Data source connector catalog.
 *
 * Defines the connector types, their status in the product, and what will
 * be configurable when each connector goes live. No credentials or secrets
 * are stored here — this is a UI catalog only.
 *
 * Security: all future credentials (API keys, OAuth tokens, TLS certs) will
 * be server-side only, stored in encrypted env vars or a vault, never exposed
 * to the frontend.
 */

// ─── Connector Status ───────────────────────────────────────────────────────

/**
 * Connector status:
 *  - "active":             live in this build (CSV/XLSX/JSON upload)
 *  - "adapter_defined":    adapter interface is defined in code; not connected to any live system.
 *                          Real connector activation requires endpoint, auth, mapping,
 *                          testing, governance, and server-side credential handling.
 *  - "planned":            on the roadmap; no adapter code yet.
 */
export type ConnectorStatus = "active" | "adapter_defined" | "planned";

// ─── Connector Catalog ──────────────────────────────────────────────────────

export interface ConnectorInfo {
  id: string;
  title: string;
  description: string;
  /** lucide icon name */
  icon: string;
  /** Current status in the product */
  status: ConnectorStatus;
  /** What's configurable when this connector goes live */
  configurableFields: string[];
  /** Standards or protocols */
  protocol?: string;
}

export const CONNECTOR_CATALOG: ConnectorInfo[] = [
  {
    id: "csv_xlsx_json",
    title: "CSV / Excel / JSON Upload",
    description: "Upload batch files in CSV, XLSX, or JSON format. Validated against the column template, mapped to engine fields, and processed through the decision engine.",
    icon: "FileSpreadsheet",
    status: "active",
    configurableFields: ["Column mapping version", "File size limit", "Source system label"],
    protocol: "File upload",
  },
  {
    id: "hl7_v2",
    title: "HL7 v2 Lab Feed (ORU/OBX)",
    description: "Receive lab results via HL7 v2.x message feed (MLLP/TCP). Standard for NZ lab-to-EMR messaging. Maps OBX segments to HPV, cytology, and histology results.",
    icon: "Radio",
    status: "adapter_defined",
    configurableFields: [
      "Source system",
      "Endpoint (MLLP host:port)",
      "Auth method (mutual TLS / basic)",
      "OBX field mapping",
      "Facility code",
      "Import schedule",
      "Test connection",
      "Last successful import",
    ],
    protocol: "HL7 v2.x MLLP/TCP",
  },
  {
    id: "fhir_r4",
    title: "FHIR R4 API",
    description: "Pull patient data from FHIR R4 REST endpoints. Maps DiagnosticReport and Observation resources to screening results.",
    icon: "Globe",
    status: "adapter_defined",
    configurableFields: [
      "Source system",
      "FHIR endpoint URL",
      "Auth method (OAuth 2.0 / API key / basic)",
      "Resource types (DiagnosticReport, Observation, Patient)",
      "Mapping version",
      "Facility / organisation ID",
      "Import schedule",
      "Test connection",
      "Last successful import",
    ],
    protocol: "FHIR R4 REST",
  },
  {
    id: "pms",
    title: "Patient Management System",
    description: "Sync patient demographics and screening history from PMS (e.g. MedTech, Indici, MyPractice). Provides age, NHI, ethnicity, and prior screening data.",
    icon: "Users",
    status: "planned",
    configurableFields: [
      "Source system",
      "API endpoint",
      "Auth method (API key / OAuth 2.0)",
      "Patient ID field mapping",
      "Demographics mapping",
      "Import schedule",
      "Test connection",
      "Last successful import",
    ],
    protocol: "REST API",
  },
  {
    id: "health_nz",
    title: "Screening Register / Health NZ",
    description: "Direct integration with the National Cervical Screening Programme (NCSP) register. Pull screening history, recall status, and programme-level data.",
    icon: "Shield",
    status: "planned",
    configurableFields: [
      "Source system",
      "Health NZ API endpoint",
      "Auth method (mutual TLS / OAuth 2.0)",
      "NHI lookup",
      "Screening history depth",
      "Facility ID",
      "MoU reference",
      "Import schedule",
      "Test connection",
      "Last successful import",
    ],
    protocol: "Health NZ API",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getStatusLabel(status: ConnectorStatus): string {
  switch (status) {
    case "active": return "Active";
    case "adapter_defined": return "Adapter pattern defined · not connected";
    case "planned": return "Planned";
  }
}

export function getStatusColor(status: ConnectorStatus): {
  bg: string; text: string; border: string;
} {
  switch (status) {
    case "active":
      return { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" };
    case "adapter_defined":
      return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" };
    case "planned":
      return { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };
  }
}
