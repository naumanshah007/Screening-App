import { Cable, ShieldCheck, Workflow } from "lucide-react";
import { redirect } from "next/navigation";

import { IntegrationCentreClient } from "@/components/integrations/IntegrationCentreClient";
import { HeaderMeta, PageHeader, PageShell } from "@/components/system";
import { auth } from "@/lib/auth";
import { isAuthorizedForRoute } from "@/lib/auth/permissions";
import { INTEGRATION_CONNECTOR_DEFINITIONS } from "@/lib/integrations/connection-catalogue";
import { getIntegrationDashboard } from "@/lib/integrations/connections";
import { getCurrentOrganisation } from "@/lib/organisation/current-organisation";

export const dynamic = "force-dynamic";

export default async function IntegrationCentrePage() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!isAuthorizedForRoute("/admin/integrations", user?.role)) {
    redirect("/dashboard");
  }

  const organisation = await getCurrentOrganisation();
  const dashboard = organisation
    ? await getIntegrationDashboard(organisation.id)
    : {
        connections: [],
        summary: {
          configured: 0,
          readyForLiveTest: 0,
          liveVerified: 0,
          needsConfiguration: 0,
          pausedOrErrors: 0,
        },
        health: {
          configurationFailures: 0,
          mappingIncomplete: 0,
          missingCredentialReferences: 0,
          invalidSchedules: 0,
          liveConnectivityNotTested: 0,
          liveConnectivityFailures: 0,
          staleConnectivityEvidence: 0,
        },
      };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Administration · Advanced"
        title="Integration Centre"
        description="Validate connection configuration and run explicit, bounded server-side connection tests. A successful test never enables data ingestion or imports clinical data."
        meta={
          <>
            <HeaderMeta
              label="Organisation"
              value={organisation?.shortName ?? organisation?.name ?? "Not configured"}
              icon={<ShieldCheck className="h-4 w-4" />}
            />
            <HeaderMeta
              label="Connector catalogue"
              value={`${INTEGRATION_CONNECTOR_DEFINITIONS.length} supported types`}
              icon={<Cable className="h-4 w-4" />}
            />
            <HeaderMeta
              label="Connection testing"
              value="Secure and bounded"
              icon={<Workflow className="h-4 w-4" />}
            />
          </>
        }
      />

      <IntegrationCentreClient
        organisationConfigured={Boolean(organisation)}
        dashboard={dashboard}
        definitions={INTEGRATION_CONNECTOR_DEFINITIONS}
      />
    </PageShell>
  );
}
