"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Activity,
  Archive,
  Cable,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FileClock,
  KeyRound,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Waypoints,
} from "lucide-react";

import {
  DetailDrawer,
  DrawerFields,
  DrawerSection,
  MetricGrid,
  MetricTile,
  Panel,
  PanelInset,
  StatusBadge,
  StepTimeline,
  Timeline,
  type BadgeTone,
} from "@/components/system";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ConnectorDefinition,
  ConnectorType,
  IntegrationAuthMethod,
} from "@/lib/integrations/connection-catalogue";
import type {
  IntegrationConnectionDto,
  IntegrationDashboard,
} from "@/lib/integrations/connections";
import type { IntegrationConfigurationReport } from "@/lib/integrations/connection-validation";
import type { IntegrationConnectivityCheckDto } from "@/lib/integrations/connectivity-checks";

const WIZARD_STEPS = [
  "Connection",
  "Authentication",
  "Mapping",
  "Validate Configuration",
  "Schedule",
  "Readiness",
] as const;

const subscribeToDocument = () => () => undefined;

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60";
const textAreaClass =
  "min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

type DraftForm = {
  id: string | null;
  connectorType: ConnectorType;
  name: string;
  description: string;
  sourceSystem: string;
  sourceFacility: string;
  environment: "DEMO" | "TEST" | "PRODUCTION_LIKE";
  endpoint: Record<string, string | number | boolean | string[] | undefined>;
  authMethod: IntegrationAuthMethod;
  credentialRefInput: string;
  certificateRefInput: string;
  clearCredential: boolean;
  clearCertificate: boolean;
  credentialConfigured: boolean;
  certificateConfigured: boolean;
  mappingVersion: string;
  mapping: Record<string, string>;
  schedule: Record<string, string | number | undefined>;
  timezone: string;
};

function emptyDraft(type: ConnectorType, definition: ConnectorDefinition): DraftForm {
  return {
    id: null,
    connectorType: type,
    name: "",
    description: "",
    sourceSystem: "",
    sourceFacility: "",
    environment: "DEMO",
    endpoint:
      type === "HL7_V2_LAB"
        ? { acceptedMessageTypes: ["ORU^R01"], tlsMode: "MUTUAL_TLS" }
        : type === "FHIR_R4"
          ? { resourceTypes: ["DiagnosticReport", "Observation"], capabilityPath: "metadata" }
          : type === "SCREENING_REGISTER"
            ? { nhiLookupEnabled: true, permittedOperations: [] }
            : {},
    authMethod: definition.authMethods[0] ?? "NONE",
    credentialRefInput: "",
    certificateRefInput: "",
    clearCredential: false,
    clearCertificate: false,
    credentialConfigured: false,
    certificateConfigured: false,
    mappingVersion: "",
    mapping: {},
    schedule: {
      cadence: type === "HL7_V2_LAB" ? "GATEWAY_MANAGED" : undefined,
    },
    timezone: "Pacific/Auckland",
  };
}

function draftFromConnection(connection: IntegrationConnectionDto): DraftForm {
  return {
    id: connection.id,
    connectorType: connection.connectorType,
    name: customerConnectionName(connection),
    description: connection.description ?? "",
    sourceSystem: connection.sourceSystem,
    sourceFacility: connection.sourceFacility ?? "",
    environment: connection.environment as DraftForm["environment"],
    endpoint: { ...connection.endpoint },
    authMethod: connection.authMethod as IntegrationAuthMethod,
    credentialRefInput: "",
    certificateRefInput: "",
    clearCredential: false,
    clearCertificate: false,
    credentialConfigured: connection.credentialConfigured,
    certificateConfigured: connection.certificateConfigured,
    mappingVersion: connection.mappingVersion ?? "",
    mapping: { ...connection.mapping },
    schedule: { ...connection.schedule },
    timezone: connection.timezone,
  };
}

function stateLabel(state: string) {
  if (state === "READY_FOR_LIVE_TEST") return "Ready to Test";
  return state
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function environmentLabel(environment: string) {
  if (environment === "DEMO") return "Demo";
  if (environment === "TEST") return "Test";
  if (environment === "PRODUCTION_LIKE" || environment === "PILOT") return "Pilot";
  if (environment === "PRODUCTION") return "Production";
  return environment.replaceAll("_", " ").toLowerCase().replace(/^./, (character) => character.toUpperCase());
}

const INTERNAL_PROJECT_LANGUAGE = /\b(?:phase\s*[0-3](?:a|b)?|sprint\s*[ab]|c0)\b/i;
const VALIDATION_CONNECTION_LANGUAGE = /\b(?:qa|ssrf|security validation|policy validation|controlled fhir)\b/i;

function isTestValidationConnection(connection: IntegrationConnectionDto) {
  const searchable = [connection.name, connection.description, connection.sourceSystem]
    .filter(Boolean)
    .join(" ");
  return VALIDATION_CONNECTION_LANGUAGE.test(searchable) ||
    (connection.environment === "TEST" && INTERNAL_PROJECT_LANGUAGE.test(searchable));
}

function customerConnectionName(connection: IntegrationConnectionDto) {
  const searchable = [connection.name, connection.description, connection.sourceSystem]
    .filter(Boolean)
    .join(" ");

  if (/^Awanui Labs\b/i.test(connection.name) && INTERNAL_PROJECT_LANGUAGE.test(searchable)) {
    return "Awanui Labs — Demo HL7";
  }
  if (/\bssrf\b/i.test(searchable)) {
    return "Outbound Security Validation";
  }
  if (connection.connectorType === "FHIR_R4" && isTestValidationConnection(connection)) {
    return "FHIR R4 Test Connection";
  }

  const cleaned = connection.name
    .replace(/\bphase\s*[0-3](?:a|b)?\b/gi, "")
    .replace(/\bsprint\s*[ab]\b/gi, "")
    .replace(/\bc0\b/gi, "")
    .replace(/\bqa\b/gi, "Validation")
    .replace(/\bssrf\b/gi, "Outbound Security")
    .replace(/\s*[—–-]\s*(?=[—–-]|$)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s—–-]+|[\s—–-]+$/g, "")
    .trim();

  return cleaned || `${connection.connectorTitle} Connection`;
}

function auditDetailValue(key: string, value: unknown) {
  if (key.toLowerCase() === "environment" && typeof value === "string") {
    return environmentLabel(value);
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function needsAttention(connection: IntegrationConnectionDto) {
  const credentialMissing = connection.authMethod !== "NONE" &&
    !connection.credentialConfigured && !connection.certificateConfigured;
  const scheduleInvalid = connection.connectorType === "HL7_V2_LAB"
    ? connection.schedule.cadence !== "GATEWAY_MANAGED"
    : !connection.schedule.cadence;
  return ["PAUSED", "ERROR"].includes(connection.state) ||
    connection.lastValidationStatus === "FAILED" ||
    connection.mappingComplete < connection.mappingRequired ||
    credentialMissing ||
    scheduleInvalid;
}

function stateTone(state: string): BadgeTone {
  if (state === "READY_FOR_LIVE_TEST") return "success";
  if (state === "ERROR") return "danger";
  if (state === "PAUSED") return "warn";
  if (["CONFIGURATION_VALID", "MAPPING_VERIFIED"].includes(state)) return "info";
  return "neutral";
}

function checkTone(status: string): BadgeTone {
  if (["PASS", "PASSED"].includes(status)) return "success";
  if (["FAIL", "FAILED", "INCOMPATIBLE"].includes(status)) return "danger";
  if (status === "WARNING") return "warn";
  return "neutral";
}

function formatDateTime(value: string | null) {
  if (!value) return "Not tested";
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Pacific/Auckland",
  }).format(new Date(value));
}

function friendlyAuditAction(action: string) {
  return action
    .replace(/^INTEGRATION_/, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}

function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-xs font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-[0.6875rem] leading-relaxed text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function ReadinessRow({ label, value, tone = "neutral" }: { label: string; value: string; tone?: BadgeTone }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <StatusBadge size="sm" tone={tone}>{value}</StatusBadge>
    </div>
  );
}

export function IntegrationCentreClient({
  organisationConfigured,
  dashboard,
  definitions,
}: {
  organisationConfigured: boolean;
  dashboard: IntegrationDashboard;
  definitions: readonly ConnectorDefinition[];
}) {
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribeToDocument, () => true, () => false);
  const [data, setData] = useState(dashboard);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<DraftForm>(() => emptyDraft(definitions[0]!.type, definitions[0]!));
  const [report, setReport] = useState<IntegrationConfigurationReport | null>(null);
  const [auditConnection, setAuditConnection] = useState<IntegrationConnectionDto | null>(null);
  const [connectivityConnection, setConnectivityConnection] = useState<IntegrationConnectionDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setData(dashboard), [dashboard]);

  const definition = useMemo(
    () => definitions.find((item) => item.type === form.connectorType) ?? definitions[0]!,
    [definitions, form.connectorType]
  );
  const mappingComplete = definition.mappingRequirements.filter(
    (requirement) => Boolean(form.mapping[requirement.id]?.trim())
  ).length;
  const configuredConnections = useMemo(
    () => data.connections.filter((connection) => !isTestValidationConnection(connection)),
    [data.connections]
  );
  const validationConnections = useMemo(
    () => data.connections.filter(isTestValidationConnection),
    [data.connections]
  );
  const customerSummary = useMemo(() => ({
    configured: configuredConnections.length,
    readyToTest: configuredConnections.filter((connection) => connection.state === "READY_FOR_LIVE_TEST").length,
    recentlyVerified: configuredConnections.filter((connection) =>
      connection.lastValidationStatus === "PASSED" &&
      connection.latestConnectivityCheck?.status === "PASSED" &&
      !connection.latestConnectivityCheck.stale
    ).length,
    needsAttention: configuredConnections.filter(needsAttention).length,
  }), [configuredConnections]);
  const integrationHealth = useMemo(() => ({
    configurationFailures: configuredConnections.filter((connection) => connection.lastValidationStatus === "FAILED").length,
    mappingIncomplete: configuredConnections.filter((connection) => connection.mappingComplete < connection.mappingRequired).length,
    missingCredentialReferences: configuredConnections.filter((connection) => connection.authMethod !== "NONE" && !connection.credentialConfigured && !connection.certificateConfigured).length,
    invalidSchedules: configuredConnections.filter((connection) => connection.connectorType === "HL7_V2_LAB" ? connection.schedule.cadence !== "GATEWAY_MANAGED" : !connection.schedule.cadence).length,
    connectionNotTested: configuredConnections.filter((connection) => !connection.latestConnectivityCheck || connection.latestConnectivityCheck.status === "NOT_TESTED").length,
    connectionTestFailures: configuredConnections.filter((connection) => connection.latestConnectivityCheck?.status === "FAILED").length,
    staleConnectionEvidence: configuredConnections.filter((connection) => connection.latestConnectivityCheck?.status === "PASSED" && connection.latestConnectivityCheck.stale).length,
  }), [configuredConnections]);

  const setEndpoint = (key: string, value: DraftForm["endpoint"][string]) =>
    setForm((current) => ({ ...current, endpoint: { ...current.endpoint, [key]: value } }));
  const setSchedule = (key: string, value: DraftForm["schedule"][string]) =>
    setForm((current) => ({ ...current, schedule: { ...current.schedule, [key]: value } }));

  const resetFeedback = () => {
    setNotice("");
    setError("");
  };

  const openNew = () => {
    const first = definitions[0]!;
    setForm(emptyDraft(first.type, first));
    setReport(null);
    setStep(0);
    resetFeedback();
    setWizardOpen(true);
  };

  const openExisting = (connection: IntegrationConnectionDto) => {
    setForm(draftFromConnection(connection));
    setReport(null);
    setStep(0);
    resetFeedback();
    setWizardOpen(true);
  };

  const replaceConnection = (connection: IntegrationConnectionDto) => {
    setData((current) => ({
      ...current,
      connections: current.connections.some((item) => item.id === connection.id)
        ? current.connections.map((item) =>
            item.id === connection.id
              ? {
                  ...connection,
                  audits: connection.audits.length ? connection.audits : item.audits,
                  connectivityChecks: connection.connectivityChecks.length
                    ? connection.connectivityChecks
                    : item.connectivityChecks,
                  latestConnectivityCheck:
                    connection.latestConnectivityCheck ?? item.latestConnectivityCheck,
                }
              : item
          )
        : [connection, ...current.connections],
    }));
  };

  const request = async (url: string, options: RequestInit) => {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    });
    const body = (await response.json()) as {
      error?: string;
      issues?: { path: string; message: string }[];
      connection?: IntegrationConnectionDto;
      report?: IntegrationConfigurationReport;
      check?: IntegrationConnectivityCheckDto;
    };
    if (!response.ok) {
      const issue = body.issues?.[0];
      throw new Error(issue ? `${issue.path || "Configuration"}: ${issue.message}` : body.error ?? "Request failed");
    }
    return body;
  };

  const payload = () => {
    const result: Record<string, unknown> = {
      connectorType: form.connectorType,
      name: form.name,
      description: form.description || null,
      sourceSystem: form.sourceSystem,
      sourceFacility: form.sourceFacility || null,
      environment: form.environment,
      endpoint: form.endpoint,
      authMethod: form.authMethod,
      mappingVersion: form.mappingVersion || null,
      mapping: form.mapping,
      schedule: form.schedule,
      timezone: form.timezone,
    };
    if (form.clearCredential) result.credentialRef = null;
    else if (form.credentialRefInput.trim()) result.credentialRef = form.credentialRefInput.trim();
    if (form.clearCertificate) result.certificateRef = null;
    else if (form.certificateRefInput.trim()) result.certificateRef = form.certificateRefInput.trim();
    return result;
  };

  const persist = async () => {
    setBusy(true);
    resetFeedback();
    try {
      const body = await request(
        form.id ? `/api/admin/integrations/${form.id}` : "/api/admin/integrations",
        { method: form.id ? "PATCH" : "POST", body: JSON.stringify(payload()) }
      );
      if (!body.connection) throw new Error("Configuration response was incomplete");
      const connection = body.connection;
      replaceConnection(connection);
      setForm({
        ...draftFromConnection(connection),
        credentialRefInput: "",
        certificateRefInput: "",
        clearCredential: false,
        clearCertificate: false,
      });
      // Any saved configuration change makes an earlier report stale. The
      // readiness step must show that honestly and require an explicit rerun.
      setReport(null);
      setNotice("Configuration metadata saved. The connection remains untested.");
      router.refresh();
      return connection;
    } finally {
      setBusy(false);
    }
  };

  const saveAndContinue = async () => {
    try {
      await persist();
      setStep((current) => Math.min(WIZARD_STEPS.length - 1, current + 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save configuration");
    }
  };

  const validateConfiguration = async (connectionId?: string) => {
    setBusy(true);
    resetFeedback();
    try {
      let id = connectionId ?? form.id;
      if (!connectionId) {
        const saved = await persist();
        id = saved.id;
      }
      const body = await request(`/api/admin/integrations/${id}/validate`, {
        method: "POST",
        body: "{}",
      });
      if (!body.connection || !body.report) throw new Error("Validation response was incomplete");
      replaceConnection(body.connection);
      if (!connectionId) {
        setForm(draftFromConnection(body.connection));
        setReport(body.report);
      }
      setNotice(body.report.summary);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to validate configuration");
    } finally {
      setBusy(false);
    }
  };

  const testLiveConnection = async (connection: IntegrationConnectionDto) => {
    setBusy(true);
    resetFeedback();
    try {
      const body = await request(`/api/admin/integrations/${connection.id}/live-test`, {
        method: "POST",
        body: "{}",
      });
      if (!body.check) throw new Error("Connection test response was incomplete");
      const checks = [
        body.check,
        ...connection.connectivityChecks.filter((item) => item.id !== body.check!.id),
      ];
      const updated = {
        ...connection,
        connectivityChecks: checks,
        latestConnectivityCheck: body.check,
      };
      setData((current) => ({
        ...current,
        connections: current.connections.map((item) => item.id === connection.id ? updated : item),
      }));
      setConnectivityConnection(updated);
      setNotice(body.check.safeSummary);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to test the connection");
    } finally {
      setBusy(false);
    }
  };

  const changeState = async (connection: IntegrationConnectionDto, action: "PAUSE" | "RESUME" | "ARCHIVE") => {
    if (action === "ARCHIVE" && !window.confirm(`Archive ${customerConnectionName(connection)}? Its audit history will remain preserved.`)) {
      return;
    }
    setBusy(true);
    resetFeedback();
    try {
      const body = await request(`/api/admin/integrations/${connection.id}/state`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (body.connection) replaceConnection(body.connection);
      setNotice(action === "ARCHIVE" ? "Configuration archived; audit history preserved." : `Configuration ${action.toLowerCase()}d.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change state");
    } finally {
      setBusy(false);
    }
  };

  const switchConnectorType = (type: ConnectorType) => {
    const nextDefinition = definitions.find((item) => item.type === type)!;
    const reset = emptyDraft(type, nextDefinition);
    setForm((current) => ({
      ...reset,
      id: current.id,
      name: current.name,
      description: current.description,
      sourceSystem: current.sourceSystem,
      sourceFacility: current.sourceFacility,
      environment: current.environment,
    }));
    setReport(null);
  };

  return (
    <>
      {!organisationConfigured ? (
        <PanelInset className="border-destructive/30 bg-destructive/5 text-sm text-destructive">
          No active operating organisation is configured. Connector instances cannot be saved until organisation resolution is unambiguous.
        </PanelInset>
      ) : null}

      {notice ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <MetricGrid columns={4}>
        <MetricTile label="Configured connections" value={customerSummary.configured} caption="Customer connections" icon={<Cable className="h-4 w-4" />} />
        <MetricTile label="Ready to test" value={customerSummary.readyToTest} caption="Configuration validated" icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <MetricTile label="Recently verified" value={customerSummary.recentlyVerified} caption="Current connection evidence" icon={<Activity className="h-4 w-4" />} tone="success" />
        <MetricTile label="Needs attention" value={customerSummary.needsAttention} caption="Configuration or status issue" icon={<AlertTriangle className="h-4 w-4" />} tone={customerSummary.needsAttention ? "danger" : "neutral"} />
      </MetricGrid>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title="Configured connections"
          description="Connections configured for this organisation."
          action={
            <Button onClick={openNew} disabled={!organisationConfigured} icon={<Plus className="h-4 w-4" />}>
              Configure connection
            </Button>
          }
        >
          {configuredConnections.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {configuredConnections.map((connection) => {
                const connector = definitions.find((item) => item.type === connection.connectorType)!;
                const credentialRequired = connection.authMethod !== "NONE";
                const credentialReady = !credentialRequired || connection.credentialConfigured || connection.certificateConfigured;
                const scheduleReady = connection.connectorType === "HL7_V2_LAB"
                  ? connection.schedule.cadence === "GATEWAY_MANAGED"
                  : Boolean(connection.schedule.cadence);
                const latest = connection.latestConnectivityCheck;
                const currentEvidence = connection.lastValidationStatus === "PASSED";
                const liveValue = connector.gatewayRequired
                  ? "Not available"
                  : !latest
                    ? "Not tested"
                    : !currentEvidence && latest.status === "PASSED"
                      ? "Historical only — revalidate"
                      : latest.stale && latest.status === "PASSED"
                        ? `Stale — ${latest.ageLabel}`
                        : latest.status === "PASSED"
                          ? `Verified ${latest.ageLabel}`
                          : latest.status === "FAILED"
                            ? `Failed ${latest.ageLabel}`
                            : `Not tested · ${latest.ageLabel}`;
                const liveTone: BadgeTone = latest?.status === "PASSED" && currentEvidence && !latest.stale
                  ? "success"
                  : latest?.status === "FAILED"
                    ? "danger"
                    : latest?.stale || !currentEvidence
                      ? "warn"
                      : "neutral";
                return (
                  <article key={connection.id} className="rounded-xl border border-border bg-surface-raised p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          {connection.connectorType === "HL7_V2_LAB" ? <Radio className="h-4 w-4" /> : <Waypoints className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-foreground">{customerConnectionName(connection)}</h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">{connector.shortTitle} · {environmentLabel(connection.environment)}</p>
                        </div>
                      </div>
                      <StatusBadge size="sm" tone={stateTone(connection.state)}>{stateLabel(connection.state)}</StatusBadge>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      {connection.sourceSystem}{connection.sourceFacility ? ` · ${connection.sourceFacility}` : ""}
                    </p>

                    <div className="mt-3 rounded-lg border border-border/70 bg-card px-3">
                      <ReadinessRow label="Configuration" value={connection.lastValidationStatus === "PASSED" ? "Valid" : connection.lastValidationStatus === "FAILED" ? "Needs attention" : "Configured"} tone={connection.lastValidationStatus === "PASSED" ? "success" : connection.lastValidationStatus === "FAILED" ? "danger" : "neutral"} />
                      <ReadinessRow label="Mapping" value={`${connection.mappingComplete}/${connection.mappingRequired}`} tone={connection.mappingComplete === connection.mappingRequired ? "success" : "warn"} />
                      <ReadinessRow label="Credential ref" value={credentialReady ? (credentialRequired ? "Configured" : "Not required") : "Missing"} tone={credentialReady ? "success" : "warn"} />
                      <ReadinessRow label="Schedule" value={scheduleReady ? "Valid metadata" : "Needs configuration"} tone={scheduleReady ? "success" : "warn"} />
                      {connector.gatewayRequired ? <ReadinessRow label="Gateway" value="Required" tone="warn" /> : null}
                      <ReadinessRow label="Last connection test" value={latest ? `${latest.status === "PASSED" ? "Passed" : latest.status === "FAILED" ? "Failed" : "Not tested"} ${latest.ageLabel}` : "Not tested"} tone={liveTone} />
                      <ReadinessRow label="Connection test" value={liveValue} tone={liveTone} />
                      <ReadinessRow label="Data ingestion" value="Not enabled" />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="xs" variant="outline" onClick={() => openExisting(connection)} icon={<Settings2 className="h-3.5 w-3.5" />}>Configure</Button>
                      <Button size="xs" variant="outline" loading={busy} onClick={() => validateConfiguration(connection.id)} icon={<RefreshCcw className="h-3.5 w-3.5" />}>Validate Configuration</Button>
                      <Button size="xs" loading={busy} disabled={!connection.liveTestAvailable} onClick={() => testLiveConnection(connection)} icon={<Activity className="h-3.5 w-3.5" />}>Test Connection</Button>
                      <Button size="xs" variant="ghost" onClick={() => setConnectivityConnection(connection)} icon={<Activity className="h-3.5 w-3.5" />}>View connection history</Button>
                      <Button size="xs" variant="ghost" onClick={() => setAuditConnection(connection)} icon={<FileClock className="h-3.5 w-3.5" />}>View audit</Button>
                      {connection.state === "PAUSED" ? (
                        <Button size="xs" variant="ghost" onClick={() => changeState(connection, "RESUME")} icon={<Play className="h-3.5 w-3.5" />}>Resume</Button>
                      ) : (
                        <Button size="xs" variant="ghost" onClick={() => changeState(connection, "PAUSE")} icon={<Pause className="h-3.5 w-3.5" />}>Pause</Button>
                      )}
                      <Button size="xs" variant="ghost" onClick={() => changeState(connection, "ARCHIVE")} icon={<Archive className="h-3.5 w-3.5" />}>Archive</Button>
                    </div>

                    <p className="mt-3 text-[0.6875rem] text-muted-foreground">
                      {!connection.liveTestAvailable ? connection.liveTestUnavailableReason : "A successful connection test proves connectivity only; data ingestion remains not enabled."}
                    </p>
                    <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                      Last validation: {formatDateTime(connection.lastValidatedAt)}{latest ? ` · Last connection test: ${formatDateTime(latest.completedAt)}` : " · Connection not tested"}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <CircleDashed className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">No customer connections configured</h3>
              <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
                The connector catalogue describes what CerviGrade could support. Configure an organisation instance to assess metadata, mappings, credentials and schedule readiness.
              </p>
              <Button className="mt-4" onClick={openNew} disabled={!organisationConfigured} icon={<Plus className="h-4 w-4" />}>Configure first connection</Button>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Integration health" description="Not tested is neutral, not an error.">
            <div className="space-y-1">
              <ReadinessRow label="Configuration failures" value={String(integrationHealth.configurationFailures)} tone={integrationHealth.configurationFailures ? "danger" : "success"} />
              <ReadinessRow label="Mapping incomplete" value={String(integrationHealth.mappingIncomplete)} tone={integrationHealth.mappingIncomplete ? "warn" : "success"} />
              <ReadinessRow label="Missing credential refs" value={String(integrationHealth.missingCredentialReferences)} tone={integrationHealth.missingCredentialReferences ? "warn" : "success"} />
              <ReadinessRow label="Invalid schedules" value={String(integrationHealth.invalidSchedules)} tone={integrationHealth.invalidSchedules ? "warn" : "success"} />
              <ReadinessRow label="Connection not tested" value={String(integrationHealth.connectionNotTested)} />
              <ReadinessRow label="Connection test failures" value={String(integrationHealth.connectionTestFailures)} tone={integrationHealth.connectionTestFailures ? "danger" : "success"} />
              <ReadinessRow label="Stale connection evidence" value={String(integrationHealth.staleConnectionEvidence)} tone={integrationHealth.staleConnectionEvidence ? "warn" : "success"} />
            </div>
          </Panel>

          <Panel title="Connector catalogue" description="Types are code-owned; configured instances are stored separately.">
            <div className="space-y-3">
              {definitions.map((connector) => (
                <div key={connector.type} className="rounded-lg border border-border/70 bg-surface-raised p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">{connector.shortTitle}</p>
                    <StatusBadge size="sm" tone="neutral">{connector.protocol}</StatusBadge>
                  </div>
                  <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">{connector.description}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {validationConnections.length ? (
        <details className="group rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span>Test &amp; validation connections</span>
            <StatusBadge size="sm" tone="neutral">{validationConnections.length}</StatusBadge>
          </summary>
          <div className="space-y-3 border-t border-border px-4 py-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Administrative validation connections are kept separate from normal configured connections. Their connection history and audit evidence remain available here.
            </p>
            {validationConnections.map((connection) => {
              const latest = connection.latestConnectivityCheck;
              return (
                <div key={connection.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{customerConnectionName(connection)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {connection.connectorTitle} · {environmentLabel(connection.environment)} · {stateLabel(connection.state)}
                      {latest ? ` · Last connection test ${latest.ageLabel}` : " · Connection not tested"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="xs" variant="outline" onClick={() => openExisting(connection)} icon={<Settings2 className="h-3.5 w-3.5" />}>Configure</Button>
                    <Button size="xs" loading={busy} disabled={!connection.liveTestAvailable} onClick={() => testLiveConnection(connection)} icon={<Activity className="h-3.5 w-3.5" />}>Test Connection</Button>
                    <Button size="xs" variant="ghost" onClick={() => setConnectivityConnection(connection)} icon={<Activity className="h-3.5 w-3.5" />}>Connection history</Button>
                    <Button size="xs" variant="ghost" onClick={() => setAuditConnection(connection)} icon={<FileClock className="h-3.5 w-3.5" />}>Audit evidence</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      {mounted && createPortal(
        <DetailDrawer
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          title={form.id ? "Configure connector" : "Configure new connector"}
          subtitle={`${WIZARD_STEPS[step]} · ${definition.shortTitle}`}
          width="2xl"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || busy} icon={<ChevronLeft className="h-4 w-4" />}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setWizardOpen(false)} disabled={busy}>Close</Button>
                {step < WIZARD_STEPS.length - 1 ? (
                  <Button onClick={saveAndContinue} loading={busy} iconEnd={<ChevronRight className="h-4 w-4" />}>Save &amp; continue</Button>
                ) : (
                  <Button onClick={() => setWizardOpen(false)} disabled={busy}>Finish</Button>
                )}
              </div>
            </div>
          }
        >
          <StepTimeline
            steps={WIZARD_STEPS.map((label, index) => ({
              id: label,
              label,
              state: index < step ? "complete" : index === step ? "current" : "upcoming",
            }))}
          />

          {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div> : null}
          {notice ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</div> : null}

          {step === 0 ? (
            <ConnectionStep form={form} definition={definition} definitions={definitions} setForm={setForm} setEndpoint={setEndpoint} switchType={switchConnectorType} />
          ) : null}
          {step === 1 ? (
            <AuthenticationStep form={form} definition={definition} setForm={setForm} setEndpoint={setEndpoint} />
          ) : null}
          {step === 2 ? (
            <MappingStep form={form} definition={definition} mappingComplete={mappingComplete} setForm={setForm} />
          ) : null}
          {step === 3 ? (
            <ValidationStep report={report} busy={busy} onValidate={() => validateConfiguration()} />
          ) : null}
          {step === 4 ? (
            <ScheduleStep form={form} definition={definition} setForm={setForm} setSchedule={setSchedule} />
          ) : null}
          {step === 5 ? (
            <ReadinessStep form={form} definition={definition} mappingComplete={mappingComplete} report={report} busy={busy} onValidate={() => validateConfiguration()} />
          ) : null}
        </DetailDrawer>,
        document.body
      )}

      {mounted && createPortal(
        <DetailDrawer
          open={Boolean(auditConnection)}
          onClose={() => setAuditConnection(null)}
          title="Configuration audit"
          subtitle={auditConnection ? customerConnectionName(auditConnection) : undefined}
          width="lg"
        >
          {auditConnection ? (
            <>
              <DrawerFields
                fields={[
                  { label: "Connector", value: auditConnection.connectorTitle },
                  { label: "State", value: stateLabel(auditConnection.state) },
                  { label: "Organisation scope", value: "Current operating organisation" },
                  { label: "Secret values", value: "Never stored in audit" },
                ]}
              />
              <DrawerSection title="Recorded changes">
                {auditConnection.audits.length ? (
                  <Timeline events={auditConnection.audits.map((entry) => ({
                    id: entry.id,
                    title: friendlyAuditAction(entry.action),
                    timestamp: formatDateTime(entry.at),
                    actor: entry.actor,
                    description: entry.details ? Object.entries(entry.details).map(([key, value]) => `${key}: ${auditDetailValue(key, value)}`).join(" · ") : "Safe metadata only",
                    tone: entry.action.includes("VALIDATED") ? "brand" : "neutral",
                  }))} />
                ) : (
                  <p className="text-sm text-muted-foreground">No audit entries are available.</p>
                )}
              </DrawerSection>
            </>
          ) : null}
        </DetailDrawer>,
        document.body
      )}

      {mounted && createPortal(
        <DetailDrawer
          open={Boolean(connectivityConnection)}
          onClose={() => setConnectivityConnection(null)}
          title="Connection test history"
          subtitle={connectivityConnection ? customerConnectionName(connectivityConnection) : undefined}
          width="lg"
        >
          {connectivityConnection ? (
            <>
              <DrawerFields
                fields={[
                  { label: "Connector", value: connectivityConnection.connectorTitle },
                  { label: "Configuration", value: connectivityConnection.lastValidationStatus === "PASSED" ? "Valid" : "Revalidation required" },
                  { label: "Data ingestion", value: "Not enabled" },
                  { label: "Clinical data requested", value: "No" },
                ]}
              />
              <PanelInset className="text-xs leading-relaxed text-muted-foreground">
                Each row is append-only evidence from an explicit bounded test. A pass proves endpoint, network/TLS, authentication and configured capability semantics only; it does not authorise or enable data ingestion.
              </PanelInset>
              {connectivityConnection.latestConnectivityCheck ? (
                <DrawerSection
                  title="Latest step-by-step result"
                  action={<StatusBadge tone={checkTone(connectivityConnection.latestConnectivityCheck.status)}>{connectivityConnection.latestConnectivityCheck.status.replaceAll("_", " ")}</StatusBadge>}
                >
                  <p className="mb-3 text-xs text-muted-foreground">
                    {formatDateTime(connectivityConnection.latestConnectivityCheck.completedAt)} · {connectivityConnection.latestConnectivityCheck.ageLabel}{connectivityConnection.latestConnectivityCheck.stale ? " · stale" : ""}
                  </p>
                  <div className="space-y-3">
                    {connectivityConnection.latestConnectivityCheck.diagnostics.map((item) => (
                      <div key={item.key} className="rounded-lg border border-border bg-surface-raised p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-foreground">{item.label}</p>
                          <StatusBadge size="sm" tone={checkTone(item.status)}>{item.value}</StatusBadge>
                        </div>
                        <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </DrawerSection>
              ) : (
                <DrawerSection title="Latest result">
                  <p className="text-sm text-muted-foreground">The connection has not been tested.</p>
                </DrawerSection>
              )}
              <DrawerSection title="Historical checks">
                {connectivityConnection.connectivityChecks.length ? (
                  <Timeline events={connectivityConnection.connectivityChecks.map((entry) => ({
                    id: entry.id,
                    title: entry.safeSummary,
                    timestamp: formatDateTime(entry.completedAt),
                    actor: entry.performedBy,
                    description: `${entry.status.replaceAll("_", " ")} · network ${entry.networkStatus} · TLS ${entry.tlsStatus} · authentication ${entry.authenticationStatus} · protocol ${entry.protocolStatus}${entry.httpStatus ? ` · HTTP ${entry.httpStatus}` : ""}${entry.latencyMs !== null ? ` · ${entry.latencyMs} ms` : ""}`,
                    tone: entry.status === "PASSED" ? "brand" : entry.status === "FAILED" ? "danger" : "neutral",
                  }))} />
                ) : (
                  <p className="text-sm text-muted-foreground">No historical checks are recorded.</p>
                )}
              </DrawerSection>
            </>
          ) : null}
        </DetailDrawer>,
        document.body
      )}
    </>
  );
}

function ConnectionStep({
  form,
  definition,
  definitions,
  setForm,
  setEndpoint,
  switchType,
}: {
  form: DraftForm;
  definition: ConnectorDefinition;
  definitions: readonly ConnectorDefinition[];
  setForm: React.Dispatch<React.SetStateAction<DraftForm>>;
  setEndpoint: (key: string, value: DraftForm["endpoint"][string]) => void;
  switchType: (type: ConnectorType) => void;
}) {
  return (
    <DrawerSection title="1. Connection metadata">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Connection name" required>
          <input className={fieldClass} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Awanui Labs — Demo HL7" />
        </Field>
        <Field label="Connector type" required>
          <select className={fieldClass} value={form.connectorType} onChange={(event) => switchType(event.target.value as ConnectorType)} disabled={Boolean(form.id)}>
            {definitions.map((item) => <option key={item.type} value={item.type}>{item.title}</option>)}
          </select>
        </Field>
        <Field label="Source system" required>
          <input className={fieldClass} value={form.sourceSystem} onChange={(event) => setForm((current) => ({ ...current, sourceSystem: event.target.value }))} placeholder="Laboratory or source platform" />
        </Field>
        <Field label="Source facility / organisation">
          <input className={fieldClass} value={form.sourceFacility} onChange={(event) => setForm((current) => ({ ...current, sourceFacility: event.target.value }))} placeholder="Facility or site" />
        </Field>
        <Field label="Environment" required>
          <select className={fieldClass} value={form.environment} onChange={(event) => setForm((current) => ({ ...current, environment: event.target.value as DraftForm["environment"] }))}>
            <option value="DEMO">Demo</option>
            <option value="TEST">Test</option>
            <option value="PRODUCTION_LIKE">Pilot</option>
          </select>
        </Field>
        <Field label="Timezone" required>
          <input className={fieldClass} value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea className={textAreaClass} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Configuration purpose; do not enter credentials." />
        </Field>
      </div>

      <ConnectorSpecificFields form={form} setEndpoint={setEndpoint} />

      {definition.gatewayRequired ? (
        <PanelInset className="border-amber-200 bg-amber-50/60 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Receiver status: Gateway required / Not receiving.</strong> Vercel cannot host a persistent MLLP listener. This stores gateway metadata only and does not open a socket.
        </PanelInset>
      ) : (
        <PanelInset className="text-xs text-muted-foreground">
          Validate Configuration checks metadata only. Test Connection is a separate explicit server-side action after validation passes.
        </PanelInset>
      )}
    </DrawerSection>
  );
}

function ConnectorSpecificFields({ form, setEndpoint }: { form: DraftForm; setEndpoint: (key: string, value: DraftForm["endpoint"][string]) => void }) {
  const value = (key: string) => String(form.endpoint[key] ?? "");
  if (form.connectorType === "HL7_V2_LAB") {
    return (
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="MLLP host" required><input className={fieldClass} value={value("host")} onChange={(event) => setEndpoint("host", event.target.value)} placeholder="Gateway host metadata" /></Field>
        <Field label="Port" required><input className={fieldClass} type="number" min={1} max={65535} value={value("port")} onChange={(event) => setEndpoint("port", event.target.value ? Number(event.target.value) : undefined)} /></Field>
        <Field label="TLS mode" required><select className={fieldClass} value={value("tlsMode")} onChange={(event) => setEndpoint("tlsMode", event.target.value)}><option value="MUTUAL_TLS">Mutual TLS</option><option value="TLS">TLS</option><option value="NONE">None</option></select></Field>
        <Field label="Accepted message types" required><input className={fieldClass} value={(form.endpoint.acceptedMessageTypes as string[] | undefined)?.join(", ") ?? ""} onChange={(event) => setEndpoint("acceptedMessageTypes", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder="ORU^R01" /></Field>
        <Field label="Sending application" required><input className={fieldClass} value={value("sendingApplication")} onChange={(event) => setEndpoint("sendingApplication", event.target.value)} /></Field>
        <Field label="Sending facility" required><input className={fieldClass} value={value("sendingFacility")} onChange={(event) => setEndpoint("sendingFacility", event.target.value)} /></Field>
        <Field label="Receiving application" required><input className={fieldClass} value={value("receivingApplication")} onChange={(event) => setEndpoint("receivingApplication", event.target.value)} /></Field>
        <Field label="Receiving facility" required><input className={fieldClass} value={value("receivingFacility")} onChange={(event) => setEndpoint("receivingFacility", event.target.value)} /></Field>
        <Field label="Duplicate identity strategy" required className="sm:col-span-2"><input className={fieldClass} value={value("duplicateIdentityStrategy")} onChange={(event) => setEndpoint("duplicateIdentityStrategy", event.target.value)} placeholder="Accession + specimen + collection date" /></Field>
      </div>
    );
  }
  if (form.connectorType === "FHIR_R4") {
    return (
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="FHIR base URL" required className="sm:col-span-2"><input className={fieldClass} type="url" value={value("baseUrl")} onChange={(event) => setEndpoint("baseUrl", event.target.value)} placeholder="Contract-provided base URL" /></Field>
        <Field label="Capability path" required hint="Safe metadata operation only; normally metadata."><input className={fieldClass} value={value("capabilityPath")} onChange={(event) => setEndpoint("capabilityPath", event.target.value)} placeholder="metadata" /></Field>
        <Field label="Resource types" required><input className={fieldClass} value={(form.endpoint.resourceTypes as string[] | undefined)?.join(", ") ?? ""} onChange={(event) => setEndpoint("resourceTypes", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></Field>
        <Field label="Identifier system" required><input className={fieldClass} value={value("identifierSystem")} onChange={(event) => setEndpoint("identifierSystem", event.target.value)} /></Field>
        <Field label="Paging strategy" required><input className={fieldClass} value={value("pagingStrategy")} onChange={(event) => setEndpoint("pagingStrategy", event.target.value)} placeholder="Bundle next-link or contract-defined" /></Field>
        <Field label="Incremental search parameters" required><input className={fieldClass} value={value("incrementalParameters")} onChange={(event) => setEndpoint("incrementalParameters", event.target.value)} placeholder="Contract-defined parameters" /></Field>
      </div>
    );
  }
  if (form.connectorType === "PMS_REST") {
    return (
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Base URL" required className="sm:col-span-2"><input className={fieldClass} type="url" value={value("baseUrl")} onChange={(event) => setEndpoint("baseUrl", event.target.value)} placeholder="Vendor contract base URL" /></Field>
        <Field label="Optional health / capability path" hint="If blank, only generic HTTP reachability can be established." className="sm:col-span-2"><input className={fieldClass} value={value("healthPath")} onChange={(event) => setEndpoint("healthPath", event.target.value)} placeholder="health" /></Field>
        <Field label="Organisation / site" required><input className={fieldClass} value={value("organisationSite")} onChange={(event) => setEndpoint("organisationSite", event.target.value)} /></Field>
        <Field label="Pagination strategy" required><input className={fieldClass} value={value("pagingStrategy")} onChange={(event) => setEndpoint("pagingStrategy", event.target.value)} /></Field>
        <Field label="Incremental-sync field" required className="sm:col-span-2"><input className={fieldClass} value={value("incrementalParameters")} onChange={(event) => setEndpoint("incrementalParameters", event.target.value)} placeholder="Generic configured field; no vendor contract assumed" /></Field>
      </div>
    );
  }
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field label="Contract endpoint" required className="sm:col-span-2"><input className={fieldClass} type="url" value={value("baseUrl")} onChange={(event) => setEndpoint("baseUrl", event.target.value)} placeholder="Enter only an authorised contract endpoint" /></Field>
      <Field label="Authorised connectivity path" hint="Required for connection testing. Use only the contract-provided safe connectivity or capability operation." className="sm:col-span-2"><input className={fieldClass} value={value("connectivityPath")} onChange={(event) => setEndpoint("connectivityPath", event.target.value)} placeholder="Contract-provided operation" /></Field>
      <Field label="Facility / organisation ID" required><input className={fieldClass} value={value("facilityOrganisationId")} onChange={(event) => setEndpoint("facilityOrganisationId", event.target.value)} /></Field>
      <Field label="Screening history depth" required><input className={fieldClass} value={value("screeningHistoryDepth")} onChange={(event) => setEndpoint("screeningHistoryDepth", event.target.value)} /></Field>
      <Field label="Permitted operations" required><input className={fieldClass} value={(form.endpoint.permittedOperations as string[] | undefined)?.join(", ") ?? ""} onChange={(event) => setEndpoint("permittedOperations", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder="Contract-defined selections" /></Field>
      <Field label="Programme identifier" required><input className={fieldClass} value={value("programmeIdentifier")} onChange={(event) => setEndpoint("programmeIdentifier", event.target.value)} /></Field>
      <Field label="MoU / agreement reference" required><input className={fieldClass} value={value("agreementReference")} onChange={(event) => setEndpoint("agreementReference", event.target.value)} /></Field>
      <Field label="Lookup strategy" required><input className={fieldClass} value={value("lookupStrategy")} onChange={(event) => setEndpoint("lookupStrategy", event.target.value)} /></Field>
      <label className="flex items-center gap-2 text-xs text-foreground"><input type="checkbox" checked={Boolean(form.endpoint.nhiLookupEnabled)} onChange={(event) => setEndpoint("nhiLookupEnabled", event.target.checked)} /> NHI lookup enabled in configuration</label>
    </div>
  );
}

function AuthenticationStep({ form, definition, setForm, setEndpoint }: { form: DraftForm; definition: ConnectorDefinition; setForm: React.Dispatch<React.SetStateAction<DraftForm>>; setEndpoint: (key: string, value: DraftForm["endpoint"][string]) => void }) {
  const endpointValue = (key: string) => String(form.endpoint[key] ?? "");
  return (
    <DrawerSection title="2. Authentication metadata">
      <PanelInset className="mb-4 flex items-start gap-3">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p className="text-xs leading-relaxed text-muted-foreground">Only provider references are stored. Existing references are never returned to the browser and cannot be revealed. Enter a new reference only to replace it.</p>
      </PanelInset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Authentication method" required>
          <select className={fieldClass} value={form.authMethod} onChange={(event) => setForm((current) => ({ ...current, authMethod: event.target.value as IntegrationAuthMethod }))}>
            {definition.authMethods.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}
          </select>
        </Field>
        <div className="rounded-lg border border-border bg-surface-raised p-3">
          <p className="text-xs font-medium text-foreground">Current reference state</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge size="sm" tone={form.credentialConfigured && !form.clearCredential ? "success" : "neutral"}>{form.credentialConfigured && !form.clearCredential ? "Credential reference configured" : "Credential reference missing"}</StatusBadge>
            {form.authMethod === "MUTUAL_TLS" ? <StatusBadge size="sm" tone={form.certificateConfigured && !form.clearCertificate ? "success" : "neutral"}>{form.certificateConfigured && !form.clearCertificate ? "Certificate reference configured" : "Certificate reference missing"}</StatusBadge> : null}
          </div>
        </div>
        <Field label={form.credentialConfigured ? "Replacement credential reference" : "Credential reference"} hint="Example: env:INTEGRATION_FHIR_SECRET. Do not paste a key, token or password." className="sm:col-span-2">
          <input className={fieldClass} value={form.credentialRefInput} onChange={(event) => setForm((current) => ({ ...current, credentialRefInput: event.target.value, clearCredential: false }))} autoComplete="off" placeholder={form.credentialConfigured ? "Leave blank to retain the configured reference" : "env:INTEGRATION_CONNECTOR_SECRET"} />
        </Field>
        {form.credentialConfigured ? <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={form.clearCredential} onChange={(event) => setForm((current) => ({ ...current, clearCredential: event.target.checked, credentialRefInput: "" }))} /> Remove configured credential reference</label> : null}
        {form.authMethod === "API_KEY" ? (
          <Field label="API key header" hint="Header name only; the secret value stays server-side." className="sm:col-span-2">
            <input className={fieldClass} value={endpointValue("apiKeyHeader")} onChange={(event) => setEndpoint("apiKeyHeader", event.target.value)} placeholder="X-API-Key" />
          </Field>
        ) : null}
        {form.authMethod === "BASIC" ? (
          <Field label="Basic username" hint="The password resolves from the credential reference." className="sm:col-span-2">
            <input className={fieldClass} value={endpointValue("basicUsername")} onChange={(event) => setEndpoint("basicUsername", event.target.value)} autoComplete="off" />
          </Field>
        ) : null}
        {form.authMethod === "OAUTH2_CLIENT_CREDENTIALS" ? (
          <>
            <Field label="OAuth token endpoint" required className="sm:col-span-2"><input className={fieldClass} type="url" value={endpointValue("oauthTokenUrl")} onChange={(event) => setEndpoint("oauthTokenUrl", event.target.value)} placeholder="Contract-provided token endpoint" /></Field>
            <Field label="OAuth client ID" required><input className={fieldClass} value={endpointValue("oauthClientId")} onChange={(event) => setEndpoint("oauthClientId", event.target.value)} autoComplete="off" /></Field>
            <Field label="OAuth scopes"><input className={fieldClass} value={endpointValue("oauthScopes")} onChange={(event) => setEndpoint("oauthScopes", event.target.value)} /></Field>
            <Field label="OAuth audience" className="sm:col-span-2"><input className={fieldClass} value={endpointValue("oauthAudience")} onChange={(event) => setEndpoint("oauthAudience", event.target.value)} /></Field>
          </>
        ) : null}
        {form.authMethod === "MUTUAL_TLS" ? (
          <>
            <Field label={form.certificateConfigured ? "Replacement certificate reference" : "Certificate reference"} hint="Reference metadata only; certificate material is not stored here." className="sm:col-span-2">
              <input className={fieldClass} value={form.certificateRefInput} onChange={(event) => setForm((current) => ({ ...current, certificateRefInput: event.target.value, clearCertificate: false }))} autoComplete="off" placeholder={form.certificateConfigured ? "Leave blank to retain the configured reference" : "vault:certificates/example"} />
            </Field>
            {form.certificateConfigured ? <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={form.clearCertificate} onChange={(event) => setForm((current) => ({ ...current, clearCertificate: event.target.checked, certificateRefInput: "" }))} /> Remove configured certificate reference</label> : null}
          </>
        ) : null}
      </div>
    </DrawerSection>
  );
}

function MappingStep({ form, definition, mappingComplete, setForm }: { form: DraftForm; definition: ConnectorDefinition; mappingComplete: number; setForm: React.Dispatch<React.SetStateAction<DraftForm>> }) {
  return (
    <DrawerSection title="3. Required field mappings" action={<StatusBadge tone={mappingComplete === definition.mappingRequirements.length ? "success" : "warn"}>{mappingComplete} / {definition.mappingRequirements.length} complete</StatusBadge>}>
      <Field label="Mapping version" hint="Version this configuration against your own mapping specification.">
        <input className={fieldClass} value={form.mappingVersion} onChange={(event) => setForm((current) => ({ ...current, mappingVersion: event.target.value }))} placeholder="e.g. demo-map-1" />
      </Field>
      <div className="mt-4 space-y-3">
        {definition.mappingRequirements.map((requirement) => {
          const mapped = Boolean(form.mapping[requirement.id]?.trim());
          return (
            <div key={requirement.id} className="grid gap-3 rounded-lg border border-border bg-surface-raised p-3 sm:grid-cols-[minmax(0,180px)_1fr] sm:items-center">
              <div>
                <div className="flex items-center gap-2"><p className="text-xs font-semibold text-foreground">{requirement.label}</p><StatusBadge size="sm" tone={mapped ? "success" : "warn"}>{mapped ? "Mapped" : "Missing"}</StatusBadge></div>
                <p className="mt-1 text-[0.6875rem] text-muted-foreground">{requirement.description}</p>
              </div>
              <input aria-label={`${requirement.label} source mapping`} className={fieldClass} value={form.mapping[requirement.id] ?? ""} onChange={(event) => setForm((current) => ({ ...current, mapping: { ...current.mapping, [requirement.id]: event.target.value } }))} placeholder="Source field, segment or resource path" />
            </div>
          );
        })}
      </div>
    </DrawerSection>
  );
}

function ValidationStep({ report, busy, onValidate }: { report: IntegrationConfigurationReport | null; busy: boolean; onValidate: () => void }) {
  return (
    <DrawerSection title="4. Validate Configuration">
      <PanelInset className="mb-4">
        <p className="text-xs leading-relaxed text-muted-foreground">Checks endpoint syntax, required metadata, credential-reference state, connector-specific mappings, schedule and organisation association. It performs no DNS lookup, login or remote request.</p>
      </PanelInset>
      <Button onClick={onValidate} loading={busy} icon={<RefreshCcw className="h-4 w-4" />}>Validate Configuration</Button>
      <ValidationReport report={report} />
    </DrawerSection>
  );
}

function ValidationReport({ report }: { report: IntegrationConfigurationReport | null }) {
  if (!report) {
    return <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No configuration validation has been run in this wizard session.</div>;
  }
  return (
    <div className="mt-4 space-y-3">
      {report.checks.map((check) => (
        <div key={check.key} className="rounded-lg border border-border bg-surface-raised p-3">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-foreground">{check.label}</p><StatusBadge size="sm" tone={checkTone(check.status)}>{check.value}</StatusBadge></div>
          <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">{check.detail}</p>
        </div>
      ))}
    </div>
  );
}

function ScheduleStep({ form, definition, setForm, setSchedule }: { form: DraftForm; definition: ConnectorDefinition; setForm: React.Dispatch<React.SetStateAction<DraftForm>>; setSchedule: (key: string, value: DraftForm["schedule"][string]) => void }) {
  const cadence = String(form.schedule.cadence ?? "");
  const hl7 = form.connectorType === "HL7_V2_LAB";
  return (
    <DrawerSection title="5. Schedule metadata">
      <PanelInset className="mb-4 text-xs text-muted-foreground">{definition.scheduleHint}</PanelInset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cadence" required>
          <select className={fieldClass} value={cadence} onChange={(event) => setSchedule("cadence", event.target.value || undefined)} disabled={hl7}>
            <option value="">Select cadence</option>
            {hl7 ? <option value="GATEWAY_MANAGED">Gateway managed</option> : null}
            {!hl7 ? <><option value="EVERY_15_MINUTES">Every 15 minutes</option><option value="HOURLY">Hourly</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="ON_DEMAND">On demand</option><option value="MANUAL">Manual</option></> : null}
          </select>
        </Field>
        <Field label="Timezone" required><input className={fieldClass} value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))} /></Field>
        {["DAILY", "WEEKLY"].includes(cadence) ? <Field label="Local run time" required><input className={fieldClass} type="time" value={String(form.schedule.timeOfDay ?? "")} onChange={(event) => setSchedule("timeOfDay", event.target.value)} /></Field> : null}
        {cadence === "WEEKLY" ? <Field label="Weekday" required><select className={fieldClass} value={String(form.schedule.weekday ?? "")} onChange={(event) => setSchedule("weekday", event.target.value ? Number(event.target.value) : undefined)}><option value="">Select day</option>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></Field> : null}
        {["FHIR_R4", "PMS_REST"].includes(form.connectorType) ? <Field label="Incremental-sync field" required><input className={fieldClass} value={String(form.schedule.incrementalField ?? "")} onChange={(event) => setSchedule("incrementalField", event.target.value)} /></Field> : null}
        {form.connectorType === "FHIR_R4" ? <Field label="Search parameters"><input className={fieldClass} value={String(form.schedule.searchParameters ?? "")} onChange={(event) => setSchedule("searchParameters", event.target.value)} /></Field> : null}
        {form.connectorType === "SCREENING_REGISTER" ? <Field label="Lookup strategy" required><input className={fieldClass} value={String(form.schedule.lookupStrategy ?? "")} onChange={(event) => setSchedule("lookupStrategy", event.target.value)} /></Field> : null}
      </div>
      {hl7 ? <PanelInset className="mt-4 border-amber-200 bg-amber-50/60 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><strong>Receiver status: Gateway required / Not receiving.</strong> The schedule describes the future gateway handoff only.</PanelInset> : null}
    </DrawerSection>
  );
}

function ReadinessStep({ form, definition, mappingComplete, report, busy, onValidate }: { form: DraftForm; definition: ConnectorDefinition; mappingComplete: number; report: IntegrationConfigurationReport | null; busy: boolean; onValidate: () => void }) {
  const credentialRequired = form.authMethod !== "NONE";
  const credentialReady = !credentialRequired || form.credentialConfigured || form.certificateConfigured || Boolean(form.credentialRefInput || form.certificateRefInput);
  const scheduleReady = form.connectorType === "HL7_V2_LAB" ? form.schedule.cadence === "GATEWAY_MANAGED" : Boolean(form.schedule.cadence);
  return (
    <DrawerSection title="6. Readiness">
      <div className="rounded-lg border border-border bg-card px-3">
        <ReadinessRow label="Configuration" value={report ? (report.status === "FAILED" ? "Needs attention" : "Validated") : "Validation required"} tone={report ? (report.status === "FAILED" ? "danger" : "success") : "warn"} />
        <ReadinessRow label="Mapping" value={`${mappingComplete}/${definition.mappingRequirements.length}`} tone={mappingComplete === definition.mappingRequirements.length ? "success" : "warn"} />
        <ReadinessRow label="Credential ref" value={credentialReady ? (credentialRequired ? "Configured" : "Not required") : "Missing"} tone={credentialReady ? "success" : "warn"} />
        <ReadinessRow label="Schedule" value={scheduleReady ? "Valid metadata" : "Needs configuration"} tone={scheduleReady ? "success" : "warn"} />
        <ReadinessRow label="Connection test" value={definition.gatewayRequired ? "Unavailable — gateway required" : "Separate test required"} />
        <ReadinessRow label="Data ingestion" value="Not enabled" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={onValidate} loading={busy} icon={<RefreshCcw className="h-4 w-4" />}>Validate Configuration</Button>
        <p className="text-xs text-muted-foreground">Re-run after schedule or mapping changes. Then close this wizard and use the separate Test Connection action.</p>
      </div>
      <ValidationReport report={report} />
      <PanelInset className="mt-4 flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p className="text-xs leading-relaxed text-muted-foreground">Configuration validation does not contact the remote system. A later connection-test pass still does not mean data was imported, governance was approved, or data ingestion was enabled.</p>
      </PanelInset>
    </DrawerSection>
  );
}
