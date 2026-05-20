"use client";

/**
 * IntegrationReadinessPanel — Shows data source connectors and their status.
 *
 * Displays which connectors are active (file upload), which are configuration-ready
 * (HL7, FHIR), and which are planned (PMS, Health NZ). Shows what will be
 * configurable for each connector.
 *
 * No credentials, no secrets, no server-side state. This is an informational
 * readiness panel. All future credentials will be server-side only.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet, Radio, Globe, Users, Shield,
  Cable, CheckCircle2, Settings, Clock, Lock,
  Server, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONNECTOR_CATALOG,
  getStatusLabel,
  getStatusColor,
  type ConnectorInfo,
  type ConnectorStatus,
} from "@/lib/batch/integration-types";

// Map icon names to components
const ICONS: Record<string, React.ElementType> = {
  FileSpreadsheet, Radio, Globe, Users, Shield,
};

function ConnectorCard({ connector }: { connector: ConnectorInfo }) {
  const Icon = ICONS[connector.icon] ?? Cable;
  const colors = getStatusColor(connector.status);
  const isActive = connector.status === "active";
  const isReady = connector.status === "adapter_defined";

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3 transition-colors",
      isActive
        ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10"
        : isReady
          ? "border-blue-200 dark:border-blue-800 bg-blue-50/20 dark:bg-blue-950/10"
          : "border-border bg-muted/20"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "p-2 rounded-lg",
            isActive
              ? "bg-emerald-100 dark:bg-emerald-900/40"
              : isReady
                ? "bg-blue-100 dark:bg-blue-900/40"
                : "bg-muted"
          )}>
            <Icon className={cn(
              "h-4 w-4",
              isActive
                ? "text-emerald-600 dark:text-emerald-400"
                : isReady
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground"
            )} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">{connector.title}</h4>
            {connector.protocol && (
              <span className="text-[10px] font-mono text-muted-foreground">{connector.protocol}</span>
            )}
          </div>
        </div>
        <Badge
          variant={isActive ? "low" : isReady ? "info" : "default"}
          size="sm"
        >
          {isActive && <CheckCircle2 className="h-3 w-3" />}
          {isReady && <Settings className="h-3 w-3" />}
          {connector.status === "planned" && <Clock className="h-3 w-3" />}
          {getStatusLabel(connector.status)}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {connector.description}
      </p>

      {/* Not connected notice for non-active connectors */}
      {!isActive && (
        <div className="rounded-md bg-muted/60 px-2 py-1.5 text-[10px] text-muted-foreground italic leading-snug">
          Not connected to live systems. Activation would require endpoint, auth, mapping,
          testing, governance, and server-side credential handling.
        </div>
      )}

      {/* Configurable fields — shown for non-active connectors */}
      {!isActive && connector.configurableFields.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
            {isReady ? "Would be configurable on activation:" : "Will be configurable:"}
          </div>
          <div className="flex flex-wrap gap-1">
            {connector.configurableFields.map((field) => (
              <span
                key={field}
                className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Active badge extras */}
      {isActive && (
        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          <span className="text-xs font-medium">Live — CSV, Excel, and JSON uploads supported</span>
        </div>
      )}
    </div>
  );
}

export function IntegrationReadinessPanel() {
  const active = CONNECTOR_CATALOG.filter((c) => c.status === "active");
  const ready = CONNECTOR_CATALOG.filter((c) => c.status === "adapter_defined");
  const planned = CONNECTOR_CATALOG.filter((c) => c.status === "planned");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Cable className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle>Data Sources &amp; Integration Readiness</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current mode: <strong className="text-emerald-700 dark:text-emerald-400">Demo + File Upload</strong>
                <span className="text-muted-foreground/60"> · {ready.length} adapter{ready.length !== 1 ? "s" : ""} defined (not connected) · {planned.length} planned</span>
              </p>
              <p className="text-[10px] text-muted-foreground/80 mt-1 leading-snug">
                <strong>No live hospital systems are connected.</strong>{" "}
                Only file upload (CSV / XLSX / JSON) is active in this build.
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connector grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECTOR_CATALOG.map((connector) => (
            <ConnectorCard key={connector.id} connector={connector} />
          ))}
        </div>

        {/* Architecture note */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <ArrowRight className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
            Integration Architecture
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When a live connector is enabled, demo datasets can be hidden and replaced by live hospital source data.
            The validation, mapper, decision engine, and dashboard remain the same &mdash; only the data source changes.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              All credentials server-side only
            </span>
            <span className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              Source metadata on every result
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Audit trail per import
            </span>
          </div>
        </div>

        {/* Current mode indicator */}
        <div className="text-[10px] text-muted-foreground/70">
          Connector interface defined by <span className="font-mono">DataSourceAdapter&lt;TRaw&gt;</span> in <span className="font-mono">lib/batch/types.ts</span>.
          Adding a new connector requires only implementing the adapter interface &mdash; zero changes to the processor, validator, or dashboard.
        </div>
      </CardContent>
    </Card>
  );
}
