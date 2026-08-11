import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  getGuidelineCatalogue,
  listGuidelineVersionHistory,
} from "@/lib/clinical-rules/guideline-catalogue";
import { GuidelinesHome } from "./GuidelinesHome";

/**
 * Current Cervical Screening Guidelines.
 *
 * Server-rendered so clinical authority is resolved per request from the real
 * activation state rather than a client fetch. This page reports live authority,
 * so it must never be served from a build-time render — see the force-dynamic
 * contract in `tests/ui/authority-wiring.test.ts`.
 *
 * The clinician-facing surface presents ONE guideline system. The governed
 * identifier CG-NCSP-3.1.0, its lifecycle, checksum and version history remain
 * available under "View governance details", in Rule Studio and in audit.
 * The legacy pathway router reference lives at /guidelines/technical-router as
 * technical provenance, not as a competing clinical guideline system.
 */
export const dynamic = "force-dynamic";

export default async function GuidelinesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [catalogue, history] = await Promise.all([
    getGuidelineCatalogue(),
    listGuidelineVersionHistory(),
  ]);

  return <GuidelinesHome catalogue={catalogue} history={history} />;
}
