/**
 * POST /api/clinical-rules/bootstrap-demo
 *
 * Loads the governed canonical rule set into a NON-PRODUCTION database as
 * DRAFT, so Rule Studio, the authority indicator and shadow evaluation have a
 * version to work with.
 *
 * WHY THIS EXISTS
 * ---------------
 * The importer previously required the external ~39 MB v2.1 source package,
 * which is not in version control and therefore absent from every deployed
 * environment. On a Preview with an ephemeral database that meant CG-NCSP-3.1.0
 * simply did not exist: Rule Studio was empty, the sidebar could not name the
 * canonical ruleset, and no shadow evaluation could be produced. This route
 * loads it from the committed, checksum-verified governed snapshot.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It creates DRAFT versions only. It does not validate-for-approval, does not
 * approve, does not publish, does not activate, and cannot make canonical
 * clinically authoritative — those remain gated by the governed lifecycle and
 * by `assertProductionActivationPermitted`. It refuses outright on a production
 * deployment.
 */

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import {
  importNcspRulebookV21,
  importNcspRulebookV21Successor,
} from "@/lib/clinical-rules/importer";
import { isProductionDeployment } from "@/lib/database/bootstrap";

export async function POST() {
  // Hard bar: a production deployment never bootstraps rule content this way.
  if (isProductionDeployment()) {
    return NextResponse.json(
      { error: "Rule bootstrap is not available on a production deployment." },
      { status: 403 }
    );
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "rules:edit");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  try {
    // The successor requires its parent, so import the base version first.
    const base = await importNcspRulebookV21({ actorUserId: user?.id });
    const successor = await importNcspRulebookV21Successor({
      actorUserId: user?.id,
      reason: "Demo bootstrap: load governed successor ruleset as DRAFT for shadow evaluation.",
    });

    return NextResponse.json({
      base: {
        action: base.action,
        displayVersion: base.displayVersion,
        checksum: base.checksum,
        status: base.status,
      },
      successor: {
        action: successor.action,
        displayVersion: successor.displayVersion,
        checksum: successor.checksum,
        status: successor.status,
        rules: successor.validation.counts,
      },
      // Stated explicitly so no caller can infer otherwise.
      publicationStatus: "UNPUBLISHED",
      activationStatus: "INACTIVE",
      clinicalAuthority: "LEGACY",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to bootstrap clinical rules" },
      { status: 500 }
    );
  }
}
