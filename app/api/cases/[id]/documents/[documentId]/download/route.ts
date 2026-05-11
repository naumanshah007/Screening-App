import { NextResponse } from "next/server";
import {
  getReferralDocumentById,
  getStoredReferralDocument,
  recordReferralDocumentRead,
} from "@/lib/cases/documents";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { documentStorage } from "@/lib/documents/storage";
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

export async function GET(
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
  const permissionError = getApiPermissionError(user, "cases:view");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const { id, documentId } = await params;
  const document = await getReferralDocumentById(id, documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await recordReferralDocumentRead(documentId, user?.id);

  const presignedUrl = await documentStorage.presignedUrl(document.storageKey, 300);
  if (presignedUrl) {
    return NextResponse.redirect(new URL(presignedUrl), { status: 307 });
  }

  const stored = await getStoredReferralDocument({
    caseId: id,
    documentId,
  });

  if (!stored) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return new Response(stored.fileBuffer, {
    headers: {
      "Content-Type": stored.document.mimeType,
      "Content-Length": stored.document.byteSize.toString(),
      "Content-Disposition": `inline; filename="${stored.document.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
