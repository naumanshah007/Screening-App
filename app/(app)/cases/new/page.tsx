import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { PageIntro } from "@/components/layout/PageIntro";
import { Card, CardContent } from "@/components/ui/card";
import { isFeatureEnabled } from "@/lib/features";
import { getReferralCaseIntakeOptions } from "@/lib/cases/service";
import { getWorkspaceContext } from "@/lib/workspace/context";

import { CaseCreateForm } from "./CaseCreateForm";
import { PageShell } from "@/components/system";

export default async function NewReferralCasePage() {
  if (!isFeatureEnabled("casesV2")) {
    notFound();
  }

  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const documentsEnabled = isFeatureEnabled("documentIngest");
  const { patients, assignees } = await getReferralCaseIntakeOptions();
  const workspace = getWorkspaceContext(user?.role, true);

  return (
    <PageShell width="narrow">
      <Link href="/cases" className="text-sm text-brand-600 hover:underline">
        ← Cases
      </Link>
      <PageIntro
        eyebrow={workspace.label}
        title="Create Referral Case"
        description="Start a new colposcopy or gynaecology case, set the operational context, and hand the referral directly into documents, summary generation, grading, clinician confirmation, and booking."
      />

      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          Loaded {patients.length} active patients and {assignees.length} assignable
          users into the intake form. Use patient search to narrow the list before
          selecting the final record.
        </CardContent>
      </Card>

      <CaseCreateForm
        patients={patients}
        assignees={assignees}
        documentsEnabled={documentsEnabled}
      />
    </PageShell>
  );
}
