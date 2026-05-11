"use client";

import { useState } from "react";
import { Database, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntegrationStatus } from "@/lib/ops/integration-status";
import type { NcsrAccessStatus } from "@/lib/integrations/colposcopy-registry/access";

type NcsrVisit = {
  visitDate: string;
  facility: string;
  clinician: string;
  colposcopyFindings: string;
  histologyResult?: string;
  managementDecision: string;
};

type NcsrTreatment = {
  treatmentDate: string;
  treatmentType: string;
  facility: string;
  outcome?: string;
};

type NcsrHpvResult = {
  testDate: string;
  hpvType: string;
  result: string;
  laboratoryId?: string;
};

type NcsrData = {
  nhiNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ethnicity?: string;
  previousColposcopyVisits: NcsrVisit[];
  previousTreatments: NcsrTreatment[];
  hpvHistory: NcsrHpvResult[];
  lastUpdated: string;
};

type PullResult =
  | { ok: true; data: NcsrData; message: string }
  | {
      ok: false;
      error: string;
      detail?: string;
      code?: string;
      stubMode?: boolean;
      configured?: boolean;
    };

function readinessBadgeVariant(status: "ready" | "warning" | "blocked" | "info") {
  switch (status) {
    case "ready":
      return "low";
    case "warning":
      return "high";
    case "blocked":
      return "urgent";
    default:
      return "default";
  }
}

export function NcsrPullClient({
  caseId,
  statusInfo,
  accessInfo,
}: {
  caseId: string;
  statusInfo: IntegrationStatus | null;
  accessInfo: NcsrAccessStatus;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PullResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("visits");

  async function handlePull() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/ncsr-pull`, { method: "POST" });
      const data = (await res.json()) as PullResult;
      setResult(data);
    } catch {
      setResult({ ok: false, error: "Network error — unable to reach NCSR endpoint.", code: "UNAVAILABLE" });
    } finally {
      setLoading(false);
    }
  }

  function toggle(section: string) {
    setExpandedSection(expandedSection === section ? null : section);
  }

  const integrationAllowsPull =
    statusInfo?.status !== "blocked" && statusInfo?.mode !== "Feature disabled";
  const canPull = accessInfo.canPull && Boolean(statusInfo) && integrationAllowsPull;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-brand-600" />
            Your Restricted Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={readinessBadgeVariant(accessInfo.status)}>
              {accessInfo.mode}
            </Badge>
            {accessInfo.certification?.expiresAt && (
              <span className="text-muted-foreground">
                Expires {new Date(accessInfo.certification.expiresAt).toLocaleDateString("en-NZ")}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">{accessInfo.summary}</p>
          <p className="text-muted-foreground">{accessInfo.detail}</p>
          {accessInfo.nextStep && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-muted-foreground">
              <span className="font-medium text-foreground">Next step:</span>{" "}
              {accessInfo.nextStep}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration status + pull button */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">
                  National Colposcopy Screening Registry
                </span>
                {statusInfo && (
                  <Badge variant={readinessBadgeVariant(statusInfo.status)}>
                    {statusInfo.mode}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Pull this patient&apos;s complete colposcopy history — previous visits, treatments,
                and HPV screening results — from the national database.
                Every access is audit-logged for data sovereignty compliance.
              </p>
              {statusInfo?.nextStep && (
                <div className="flex items-center gap-1.5 text-xs text-warn mt-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {statusInfo.nextStep}
                </div>
              )}
            </div>
            <Button
              onClick={handlePull}
              loading={loading}
              variant="primary"
              className="shrink-0"
              disabled={!canPull}
            >
              {canPull ? "Pull from NCSR" : "Access blocked"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && !result.ok && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warn mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">
                  {result.stubMode ? "Stub mode — no live data" : "NCSR pull failed"}
                </p>
                <p className="text-muted-foreground mt-0.5">{result.error}</p>
                {result.detail && (
                  <p className="text-muted-foreground text-xs mt-2">{result.detail}</p>
                )}
                {result.stubMode && (
                  <p className="text-muted-foreground text-xs mt-2">
                    Configure NCSR_API_BASE_URL and NCSR_API_KEY environment variables to enable live
                    NCSR data access.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result?.ok && (
        <>
          {/* Patient match confirmation */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">
                    NCSR record matched: {result.data.firstName} {result.data.lastName}
                  </p>
                  <p className="text-muted-foreground">
                    {result.message} · Last updated {new Date(result.data.lastUpdated).toLocaleDateString("en-NZ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Previous colposcopy visits */}
          <CollapsibleSection
            id="visits"
            title={`Previous Colposcopy Visits (${result.data.previousColposcopyVisits.length})`}
            expanded={expandedSection === "visits"}
            onToggle={toggle}
          >
            {result.data.previousColposcopyVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No previous colposcopy visits on record.</p>
            ) : (
              <div className="divide-y divide-border">
                {result.data.previousColposcopyVisits.map((v, i) => (
                  <div key={i} className="py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Visit date</p>
                      <p className="font-medium text-foreground">
                        {new Date(v.visitDate).toLocaleDateString("en-NZ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Facility</p>
                      <p className="font-medium text-foreground">{v.facility}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Clinician</p>
                      <p className="font-medium text-foreground">{v.clinician}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Findings</p>
                      <p className="font-medium text-foreground">{v.colposcopyFindings}</p>
                    </div>
                    {v.histologyResult && (
                      <div>
                        <p className="text-muted-foreground">Histology</p>
                        <p className="font-medium text-foreground">{v.histologyResult}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Management</p>
                      <p className="font-medium text-foreground">{v.managementDecision}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Treatments */}
          <CollapsibleSection
            id="treatments"
            title={`Previous Treatments (${result.data.previousTreatments.length})`}
            expanded={expandedSection === "treatments"}
            onToggle={toggle}
          >
            {result.data.previousTreatments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No previous treatments on record.</p>
            ) : (
              <div className="divide-y divide-border">
                {result.data.previousTreatments.map((t, i) => (
                  <div key={i} className="py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Date</p>
                      <p className="font-medium text-foreground">
                        {new Date(t.treatmentDate).toLocaleDateString("en-NZ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Treatment type</p>
                      <p className="font-medium text-foreground">{t.treatmentType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Facility</p>
                      <p className="font-medium text-foreground">{t.facility}</p>
                    </div>
                    {t.outcome && (
                      <div>
                        <p className="text-muted-foreground">Outcome</p>
                        <p className="font-medium text-foreground">{t.outcome}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* HPV history */}
          <CollapsibleSection
            id="hpv"
            title={`HPV Test History (${result.data.hpvHistory.length})`}
            expanded={expandedSection === "hpv"}
            onToggle={toggle}
          >
            {result.data.hpvHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No HPV test history on record.</p>
            ) : (
              <div className="divide-y divide-border">
                {result.data.hpvHistory.map((h, i) => (
                  <div key={i} className="py-3 grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Test date</p>
                      <p className="font-medium text-foreground">
                        {new Date(h.testDate).toLocaleDateString("en-NZ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">HPV type</p>
                      <p className="font-medium text-foreground">{h.hpvType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Result</p>
                      <p className="font-medium text-foreground">{h.result}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </>
      )}

      {/* Data sovereignty notice */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
        <p>
          NCSR data is hosted within the NZ health cloud (Azure NZ North). All access is encrypted
          in transit and audit-logged. Data does not leave New Zealand infrastructure.
          Accessed by authorised Health NZ Counties Manukau staff only.
        </p>
      </div>
    </div>
  );
}

function CollapsibleSection({
  id,
  title,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        className="py-3 cursor-pointer select-none"
        onClick={() => onToggle(id)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {expanded && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}
