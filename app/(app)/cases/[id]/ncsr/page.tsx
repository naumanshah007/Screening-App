import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageIntro } from "@/components/layout/PageIntro";
import { auth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features";
import { getReferralCaseById } from "@/lib/cases/service";
import { ServiceLineBadge, StatusBadge, Badge } from "@/components/ui/badge";
import { getIntegrationStatusById } from "@/lib/ops/integration-status";
import { getNcsrUserAccessStatus } from "@/lib/integrations/colposcopy-registry/access";
import { NcsrPullClient } from "./NcsrPullClient";
import type { UserRole } from "@prisma/client";
import { PageShell } from "@/components/system";

function integrationBadgeVariant(status: "ready" | "warning" | "blocked" | "info") {
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

export default async function NcsrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isFeatureEnabled("colposcopyModule")) {
    notFound();
  }

  const { id } = await params;
  const session = await auth();
  const user = session?.user as { id?: string; role?: UserRole } | undefined;
  const referralCase = await getReferralCaseById(id);

  if (!referralCase || referralCase.serviceLine !== "COLPOSCOPY") {
    notFound();
  }

  const ncsrStatus = await getIntegrationStatusById("ncsr");
  const accessInfo = await getNcsrUserAccessStatus({
    userId: user?.id ?? null,
    role: user?.role,
  });
  const patient = referralCase.patient;

  return (
    <PageShell>
      <Link
        href={`/cases/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to case
      </Link>

      <PageIntro
        title="NCSR History"
        description={`${patient.firstName} ${patient.lastName} · ${patient.nhi}. Use this screen to pull national colposcopy history when both the deployment and the current user are approved for restricted registry access.`}
        trailing={
          <>
            {ncsrStatus && (
              <Badge variant={integrationBadgeVariant(ncsrStatus.status)}>
                {ncsrStatus.mode}
              </Badge>
            )}
            <ServiceLineBadge serviceLine={referralCase.serviceLine} />
            <StatusBadge status={referralCase.status} />
          </>
        }
      />

      {ncsrStatus && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{ncsrStatus.summary}</span>
          <span className="ml-1">{ncsrStatus.detail}</span>
        </div>
      )}

      <NcsrPullClient
        caseId={id}
        statusInfo={ncsrStatus ?? null}
        accessInfo={accessInfo}
      />
    </PageShell>
  );
}
