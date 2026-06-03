import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { PageIntro } from "@/components/layout/PageIntro";
import { Card, CardContent } from "@/components/ui/card";
import { getReferralCaseById, getReferralCaseIntakeOptions } from "@/lib/cases/service";
import { isFeatureEnabled } from "@/lib/features";
import { formatDate } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace/context";

import { CaseEditForm } from "./CaseEditForm";

export default async function EditReferralCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isFeatureEnabled("casesV2")) {
    notFound();
  }

  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const { id } = await params;
  const [referralCase, intakeOptions] = await Promise.all([
    getReferralCaseById(id),
    getReferralCaseIntakeOptions(),
  ]);

  if (!referralCase) {
    notFound();
  }

  const workspace = getWorkspaceContext(user?.role, true);

  return (
    <div className="page-aura p-6 max-w-5xl space-y-6 animate-fade-in">
      <Link href={`/cases/${referralCase.id}`} className="text-sm text-brand-600 hover:underline">
        ← Case
      </Link>
      <PageIntro
        eyebrow={workspace.label}
        title="Edit Referral Case"
        description="Update operational metadata, assignment, and intake notes without changing the patient or service-line identity of the case."
      />

      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="text-muted-foreground">Patient</div>
            <div className="font-medium text-foreground">
              {referralCase.patient.firstName} {referralCase.patient.lastName}
            </div>
            <div className="text-xs text-muted-foreground font-mono">{referralCase.patient.nhi}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Service line</div>
            <div className="font-medium text-foreground">
              {referralCase.serviceLine === "COLPOSCOPY" ? "Colposcopy" : "Gynaecology"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Date of birth</div>
            <div className="font-medium text-foreground">
              {formatDate(referralCase.patient.dateOfBirth)}
            </div>
          </div>
        </CardContent>
      </Card>

      <CaseEditForm referralCase={referralCase} assignees={intakeOptions.assignees} />
    </div>
  );
}
