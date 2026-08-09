import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { auth } from "@/lib/auth";
import { PageIntro } from "@/components/layout/PageIntro";
import { WorkflowGovernancePanel } from "@/components/cases/WorkflowGovernancePanel";
import { Button } from "@/components/ui/button";
import {
  Badge,
  ServiceLineBadge,
  StatusBadge,
} from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { countCaseFacts } from "@/lib/cases/evidence";
import { getReferralCaseById } from "@/lib/cases/service";
import { listReferralDocuments } from "@/lib/cases/documents";
import { buildCaseDocumentReadiness } from "@/lib/cases/readiness";
import {
  buildCaseGovernanceSignals,
  getGovernanceSignalsForArea,
} from "@/lib/cases/governance";
import { isFeatureEnabled } from "@/lib/features";
import { getNcsrUserAccessStatus } from "@/lib/integrations/colposcopy-registry/access";
import { getServiceIntegrationStatuses } from "@/lib/ops/integration-status";
import { formatDateTime } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { DocumentIngestButton } from "./DocumentIngestButton";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { PageShell } from "@/components/system";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function labelForDocumentType(type: string) {
  switch (type) {
    case "REFERRAL":
      return "Referral";
    case "CLINIC_LETTER":
      return "Clinic Letter";
    case "DISCHARGE_SUMMARY":
      return "Discharge Summary";
    case "LAB_RESULT":
      return "Lab Result";
    case "RADIOLOGY":
      return "Radiology";
    default:
      return "Other";
  }
}

function ProcessingBadge({ label, value }: { label: string; value: string }) {
  const variant: "low" | "urgent" | "high" | "default" =
    value === "COMPLETE"
      ? "low"
      : value === "FAILED"
        ? "urgent"
        : value === "PROCESSING"
          ? "high"
          : "default";

  return (
    <Badge variant={variant}>
      {label}: {value.toLowerCase()}
    </Badge>
  );
}

function documentsFeatureEnabled() {
  return isFeatureEnabled("casesV2") && isFeatureEnabled("documentIngest");
}

export default async function CaseDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!documentsFeatureEnabled()) {
    notFound();
  }

  const { id } = await params;
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const [referralCase, documents, factCount] = await Promise.all([
    getReferralCaseById(id),
    listReferralDocuments(id),
    countCaseFacts(id),
  ]);

  if (!referralCase) {
    notFound();
  }

  const workspace = getWorkspaceContext(user?.role, true);
  const integrationStatuses = await getServiceIntegrationStatuses(referralCase.serviceLine);
  const ncsrAccess =
    referralCase.serviceLine === "COLPOSCOPY"
      ? await getNcsrUserAccessStatus({
          userId: (session?.user as { id?: string } | undefined)?.id ?? null,
          role: user?.role,
        })
      : null;
  const governanceSignals = getGovernanceSignalsForArea(
    buildCaseGovernanceSignals({
      serviceLine: referralCase.serviceLine,
      integrationStatuses,
      ncsrAccess,
    }),
    "documents"
  );

  const readiness = buildCaseDocumentReadiness({
    serviceLine: referralCase.serviceLine,
    documents,
    factCount,
    summaryStatus: referralCase.summary?.status ?? null,
  });

  return (
    <PageShell>
      <Link
        href={`/cases/${referralCase.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to case
      </Link>
      <PageIntro
        eyebrow={workspace.label}
        title="Case Documents"
        description={`${referralCase.patient.firstName} ${referralCase.patient.lastName} · ${referralCase.patient.nhi}. Upload the referral pack, run ingest, and confirm the case has enough evidence to move to summary and grading.`}
        trailing={
          <>
            <Link href={`/cases/${referralCase.id}/edit`}>
              <Button variant="outline" size="sm">Edit case</Button>
            </Link>
            <Link href={`/cases/${referralCase.id}/summary`}>
              <Button variant="outline" size="sm">Summary</Button>
            </Link>
            <Link href={`/cases/${referralCase.id}/evidence`}>
              <Button variant="outline" size="sm">Evidence</Button>
            </Link>
            <Link href={`/cases/${referralCase.id}/grade`}>
              <Button variant="outline" size="sm">Grade</Button>
            </Link>
            <ServiceLineBadge serviceLine={referralCase.serviceLine} />
            <StatusBadge status={referralCase.status} />
          </>
        }
      />

      <WorkflowGovernancePanel
        title="Workflow Governance"
        description="These checks explain whether any platform or restricted-access dependency needs attention before you rely on document automation for this case."
        signals={governanceSignals}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Uploaded Evidence</CardTitle>
          </CardHeader>
          {documents.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              eyebrow={workspace.label}
              title="No documents attached"
              description="Upload referrals, letters, imaging, or lab results to build the case evidence set."
              nextStep="Start by uploading the referral pack, then run ingest on each file so the summary and evidence screens can populate."
            />
          ) : (
            <div className="divide-y divide-border">
              {documents.map((document) => (
                <div key={document.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-foreground truncate">
                          {document.fileName}
                        </div>
                        <Badge variant="info">{labelForDocumentType(document.type)}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ProcessingBadge label="OCR" value={document.ocrStatus} />
                        <ProcessingBadge label="Parse" value={document.parseStatus} />
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        <span>{formatFileSize(document.byteSize)}</span>
                        <span>{document.mimeType}</span>
                        <span>{formatDateTime(document.createdAt)}</span>
                        <span>{document.uploadedBy?.name ?? "Unknown uploader"}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <Link
                        href={`/api/cases/${referralCase.id}/documents/${document.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-brand-600 hover:text-brand-700 whitespace-nowrap"
                      >
                        Open file
                      </Link>
                      <DocumentIngestButton
                        caseId={referralCase.id}
                        documentId={document.id}
                        label={
                          document.parseStatus === "PROCESSING"
                            ? "Ingesting..."
                            : document.parseStatus === "COMPLETE"
                              ? "Re-run ingest"
                              : document.parseStatus === "FAILED"
                                ? "Retry ingest"
                                : "Run ingest"
                        }
                        disabled={document.parseStatus === "PROCESSING"}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DocumentUploadForm caseId={referralCase.id} />
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                PDFs and image uploads can ingest into page text and first-pass facts. Scanned PDFs automatically fall back to OCR when they do not contain extractable text.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Readiness Check</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {readiness.headline}
                </p>
              </div>
              <Badge variant={readiness.variant}>
                {readiness.stage === "READY_FOR_GRADING"
                  ? "Ready for grading"
                  : readiness.stage === "READY_FOR_SUMMARY"
                    ? "Ready for summary"
                    : "Needs evidence"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <div className="text-muted-foreground">Documents</div>
                  <div className="font-semibold text-foreground">
                    {readiness.stats.totalDocuments}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <div className="text-muted-foreground">Extracted facts</div>
                  <div className="font-semibold text-foreground">
                    {readiness.stats.factCount}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <div className="text-muted-foreground">Parsed docs</div>
                  <div className="font-semibold text-foreground">
                    {readiness.stats.parsedDocuments}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <div className="text-muted-foreground">Pending / failed</div>
                  <div className="font-semibold text-foreground">
                    {readiness.stats.pendingDocuments} / {readiness.stats.failedDocuments}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {readiness.checks.map((check) => (
                  <div
                    key={check.label}
                    className="rounded-lg border border-border px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{check.label}</div>
                        <div className="text-sm text-muted-foreground mt-1">{check.detail}</div>
                      </div>
                      <Badge variant={check.passed ? "low" : "default"}>
                        {check.passed ? "Pass" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {readiness.blockers.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <div className="text-sm font-medium text-destructive">Current blockers</div>
                  <div className="mt-2 space-y-1 text-sm text-destructive">
                    {readiness.blockers.map((blocker) => (
                      <div key={blocker}>• {blocker}</div>
                    ))}
                  </div>
                </div>
              )}

              {readiness.recommendations.length > 0 && (
                <div className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-3">
                  <div className="text-sm font-medium text-foreground">Recommended next evidence</div>
                  <div className="mt-2 space-y-1 text-sm text-foreground">
                    {readiness.recommendations.map((recommendation) => (
                      <div key={recommendation}>• {recommendation}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/cases/${referralCase.id}/summary`}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted/40"
                >
                  Open summary
                </Link>
                <Link
                  href={`/cases/${referralCase.id}/grade`}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted/40"
                >
                  Open grading
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
