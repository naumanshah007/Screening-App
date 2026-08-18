import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  getCurrentGuidelines,
  listGuidelineVersionHistory,
} from "@/lib/clinical-rules/current-guidelines";
import { GuidelinesHome } from "./GuidelinesHome";
import { GuidelinesUnavailable } from "./GuidelinesUnavailable";

export default async function GuidelinesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const guidelines = await getCurrentGuidelines();
  if (!guidelines) return <GuidelinesUnavailable />;

  const history = await listGuidelineVersionHistory();

  // The full snapshot stays on the server; the home page only needs summaries,
  // so it is not serialised into the client payload.
  const clientGuidelines = {
    title: guidelines.title,
    subtitle: guidelines.subtitle,
    authority: guidelines.authority,
    pathways: guidelines.pathways,
    governance: guidelines.governance,
  };

  return (
    <GuidelinesHome
      guidelines={clientGuidelines}
      history={history.map((entry) => ({
        id: entry.id,
        displayVersion: entry.displayVersion,
        status: entry.status,
        revision: entry.revision,
        updatedAt: entry.updatedAt.toISOString(),
        evaluations: entry._count.evaluations,
        activeIn: entry.activations.map((activation) => activation.environment),
      }))}
    />
  );
}
