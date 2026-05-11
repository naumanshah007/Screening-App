import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, TriangleAlert } from "lucide-react";
import { auth } from "@/lib/auth";
import { WorkflowGovernancePanel } from "@/components/cases/WorkflowGovernancePanel";
import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/button";
import { Badge, ServiceLineBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getReferralCaseById } from "@/lib/cases/service";
import {
  getStoredClinicalSummary,
  parseClinicalSummaryPayload,
} from "@/lib/cases/summary";
import {
  buildCaseGovernanceSignals,
  getGovernanceSignalsForArea,
} from "@/lib/cases/governance";
import { isFeatureEnabled } from "@/lib/features";
import { getNcsrUserAccessStatus } from "@/lib/integrations/colposcopy-registry/access";
import { getServiceIntegrationStatuses } from "@/lib/ops/integration-status";
import { formatDateTime } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { SummaryGenerateButton } from "./SummaryGenerateButton";
import { SummaryReviewForm } from "./SummaryReviewForm";

export default async function CaseSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isFeatureEnabled("casesV2")) {
    notFound();
  }

  const { id } = await params;
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const [referralCase, summary] = await Promise.all([
    getReferralCaseById(id),
    getStoredClinicalSummary(id),
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
    "summary"
  );

  const payload = summary ? parseClinicalSummaryPayload(summary.summaryJson) : null;
  const summaryApproved = summary?.status === "APPROVED";

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <Link
        href={`/cases/${referralCase.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to case
      </Link>
      <PageIntro
        eyebrow={workspace.label}
        title="Clinical Summary"
        description={`${referralCase.patient.firstName} ${referralCase.patient.lastName} · ${referralCase.patient.nhi}. Build and approve the one-page case summary before deterministic grading can proceed.`}
        trailing={
          <>
            <Link href={`/cases/${referralCase.id}/documents`}>
              <Button variant="outline" size="sm">Documents</Button>
            </Link>
            <Link href={`/cases/${referralCase.id}/evidence`}>
              <Button variant="outline" size="sm">Evidence</Button>
            </Link>
            <Link href={`/cases/${referralCase.id}/grade`}>
              <Button variant="outline" size="sm">Grade</Button>
            </Link>
            {summary && (
              <Link href={`/cases/${referralCase.id}/summary/print`} target="_blank">
                <Button variant="outline" size="sm">Export PDF</Button>
              </Link>
            )}
            <ServiceLineBadge serviceLine={referralCase.serviceLine} />
            <StatusBadge status={referralCase.status} />
            {summary && <Badge variant="info">{summary.status}</Badge>}
            <SummaryGenerateButton caseId={referralCase.id} />
          </>
        }
      />

      <WorkflowGovernancePanel
        title="Summary Governance"
        description="These checks explain whether any restricted integration or platform dependency may limit what this summary can safely rely on."
        signals={governanceSignals}
      />

      {!payload ? (
        <Card>
          <EmptyState
            icon={FileText}
            eyebrow={workspace.label}
            title="No summary generated yet"
            description="Generate a one-page case summary from the current referral record and extracted evidence."
            nextStep="Check that documents have been uploaded and ingested, then generate the summary and move to clinician review."
            action={{ href: `/cases/${referralCase.id}/documents`, label: "Open documents" }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Generated Summary Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!summaryApproved && (
                <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-4 text-sm text-foreground">
                  Deterministic grading is blocked until this summary is clinician-approved.
                </div>
              )}
              {(payload.warnings ?? []).length > 0 && (
                <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-4">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <TriangleAlert className="h-4 w-4" />
                    Warnings
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-foreground">
                    {(payload.warnings ?? []).map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(payload.sections ?? []).map((section) => (
                <div key={section.id} className="space-y-3">
                  <h2 className="text-base font-semibold text-foreground">
                    {section.title}
                  </h2>
                  <div className="rounded-xl border border-border bg-card">
                    <ul className="divide-y divide-border">
                      {(section.bullets ?? []).map((bullet) => (
                        <li key={bullet} className="px-4 py-3 text-sm text-muted-foreground">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary Meta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Generated</div>
                  <div className="text-foreground font-medium">
                    {summary ? formatDateTime(summary.updatedAt) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Generated by</div>
                  <div className="text-foreground font-medium">
                    {payload.generatedBy}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="text-foreground font-medium">
                    {summary?.status ?? "Not generated"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Approved by</div>
                  <div className="text-foreground font-medium">
                    {summary?.approvedBy?.name ??
                      summary?.approvedBy?.email ??
                      "Not approved"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Approved at</div>
                  <div className="text-foreground font-medium">
                    {summary?.approvedAt ? formatDateTime(summary.approvedAt) : "—"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Actions</CardTitle>
              </CardHeader>
              <CardContent>
                {(payload.nextActions ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No next actions were generated.
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {(payload.nextActions ?? []).map((action) => (
                      <li key={action}>• {action}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Summary Review</CardTitle>
              </CardHeader>
              <CardContent>
                {summary ? (
                  <SummaryReviewForm
                    caseId={referralCase.id}
                    initialMarkdown={summary.renderedMarkdown}
                    initialStatus={summary.status}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Generate a summary before clinician review can begin.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
