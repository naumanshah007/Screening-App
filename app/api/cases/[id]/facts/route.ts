import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { listCaseFacts } from "@/lib/cases/evidence";
import { isFeatureEnabled } from "@/lib/features";

function featureDisabledResponse() {
  return NextResponse.json(
    { error: "Document ingest is disabled" },
    { status: 404 }
  );
}

function isDocumentIngestEnabled() {
  return isFeatureEnabled("casesV2") && isFeatureEnabled("documentIngest");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDocumentIngestEnabled()) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "cases:view");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const { id } = await params;
  const facts = await listCaseFacts(id);

  return NextResponse.json({ facts });
}
