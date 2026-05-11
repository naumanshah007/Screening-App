import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { ingestReferralDocument } from "@/lib/cases/ingest";
import { isFeatureEnabled } from "@/lib/features";

export const runtime = "nodejs";

function featureDisabledResponse() {
  return NextResponse.json(
    { error: "Document ingest is disabled" },
    { status: 404 }
  );
}

function isDocumentIngestEnabled() {
  return isFeatureEnabled("casesV2") && isFeatureEnabled("documentIngest");
}

export async function POST(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; documentId: string }>;
  }
) {
  if (!isDocumentIngestEnabled()) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "documents:ingest");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const { id, documentId } = await params;

  try {
    const document = await ingestReferralDocument({
      caseId: id,
      documentId,
      actorUserId: user?.id,
    });

    return NextResponse.json(document);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to ingest document";
    const status =
      message === "Document not found" || message === "Stored file not found"
        ? 404
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
