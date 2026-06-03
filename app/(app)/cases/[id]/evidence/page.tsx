import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSearch, Microscope, ScrollText } from "lucide-react";
import { auth } from "@/lib/auth";
import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/button";
import { Badge, ServiceLineBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listCaseEvidenceDocuments, listCaseFacts } from "@/lib/cases/evidence";
import { getReferralCaseById } from "@/lib/cases/service";
import { isFeatureEnabled } from "@/lib/features";
import { formatDateTime } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace/context";

function documentsFeatureEnabled() {
  return isFeatureEnabled("casesV2") && isFeatureEnabled("documentIngest");
}

function formatExcerpt(text: string, maxLength = 280) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength).trim()}...`;
}

function processingVariant(status: string): "default" | "low" | "high" | "urgent" {
  switch (status) {
    case "COMPLETE":
      return "low";
    case "PROCESSING":
      return "high";
    case "FAILED":
      return "urgent";
    default:
      return "default";
  }
}

export default async function CaseEvidencePage({
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
  const [referralCase, documents, facts] = await Promise.all([
    getReferralCaseById(id),
    listCaseEvidenceDocuments(id),
    listCaseFacts(id),
  ]);

  if (!referralCase) {
    notFound();
  }

  const workspace = getWorkspaceContext(user?.role, true);

  const extractedPageCount = documents.reduce(
    (total, document) => total + document.pages.length,
    0
  );
  const completeDocuments = documents.filter(
    (document) => document.parseStatus === "COMPLETE"
  ).length;

  return (
    <div className="page-aura p-6 space-y-6 animate-fade-in">
      <Link
        href={`/cases/${referralCase.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to case
      </Link>
      <PageIntro
        eyebrow={workspace.label}
        title="Evidence Review"
        description={`${referralCase.patient.firstName} ${referralCase.patient.lastName} · ${referralCase.patient.nhi}. Review extracted facts and page text before relying on the one-page summary or grading recommendation.`}
        trailing={
          <>
            <Link href={`/cases/${referralCase.id}/documents`}>
              <Button variant="outline" size="sm">Documents</Button>
            </Link>
            <Link href={`/cases/${referralCase.id}/summary`}>
              <Button variant="outline" size="sm">Summary</Button>
            </Link>
            <Link href={`/cases/${referralCase.id}/grade`}>
              <Button variant="outline" size="sm">Grade</Button>
            </Link>
            <ServiceLineBadge serviceLine={referralCase.serviceLine} />
            <StatusBadge status={referralCase.status} />
          </>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Documents"
          value={documents.length}
          subtext="Attached to case"
          icon={<ScrollText className="h-5 w-5" />}
        />
        <StatCard
          label="Parsed"
          value={completeDocuments}
          subtext="Documents with complete parse status"
          icon={<FileSearch className="h-5 w-5" />}
        />
        <StatCard
          label="Pages"
          value={extractedPageCount}
          subtext="Stored page extracts"
          icon={<Microscope className="h-5 w-5" />}
        />
        <StatCard
          label="Facts"
          value={facts.length}
          subtext="Heuristic extractions"
          variant={facts.length > 0 ? "success" : "default"}
          icon={<Microscope className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Extracted Facts</CardTitle>
          </CardHeader>
          {facts.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              eyebrow={workspace.label}
              title="No facts extracted yet"
              description="Run ingest on a PDF document to populate the evidence model."
              nextStep="Go back to Documents, run ingest on the uploaded files, then return here to review the extracted facts."
              action={{ href: `/cases/${referralCase.id}/documents`, label: "Open documents" }}
            />
          ) : (
            <div className="divide-y divide-border">
              {facts.map((fact) => (
                <div
                  key={fact.id}
                  className="px-5 py-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">
                        {fact.label}
                      </div>
                      <div className="text-sm text-muted-foreground">{fact.valueText}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <Badge variant="info">{fact.factType}</Badge>
                      {fact.confidence !== null && fact.confidence !== undefined && (
                        <Badge variant="default">
                          {Math.round(fact.confidence * 100)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {fact.documentPage.document.fileName} · page {fact.documentPage.pageNumber}
                  </div>
                  {fact.sourceQuote && (
                    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      {fact.sourceQuote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evidence Pages</CardTitle>
          </CardHeader>
          {documents.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              eyebrow={workspace.label}
              title="No documents uploaded"
              description="Upload and ingest documents from the case documents screen."
              nextStep="Add the referral pack first so page extracts and heuristic facts can be reviewed here."
              action={{ href: `/cases/${referralCase.id}/documents`, label: "Open documents" }}
            />
          ) : (
            <CardContent className="space-y-4">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="rounded-xl border border-border p-4 space-y-3"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground">
                      {document.fileName}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="info">{document.type}</Badge>
                      <Badge variant={processingVariant(document.ocrStatus)}>
                        OCR {document.ocrStatus.toLowerCase()}
                      </Badge>
                      <Badge variant={processingVariant(document.parseStatus)}>
                        Parse {document.parseStatus.toLowerCase()}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(document.createdAt)}
                    </div>
                  </div>
                  {document.pages.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No page extracts stored yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {document.pages.map((page) => (
                        <div
                          key={page.id}
                          className="rounded-lg border border-border bg-muted/40 px-3 py-3"
                        >
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                            Page {page.pageNumber}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatExcerpt(page.extractedText)}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {page.facts.length} extracted {page.facts.length === 1 ? "fact" : "facts"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
