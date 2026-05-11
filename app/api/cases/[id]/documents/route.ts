import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { isDocumentType } from "@/lib/cases/document-types";
import {
  createReferralDocument,
  listReferralDocuments,
} from "@/lib/cases/documents";
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

function isTruthyValue(value: FormDataEntryValue | null) {
  return (
    typeof value === "string" &&
    ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
  );
}

function isUserInputError(message: string) {
  return (
    message === "Unsupported file type" ||
    message === "Uploaded file is empty" ||
    message === "File exceeds 20 MB limit" ||
    message === "Referral case not found"
  );
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
  const documents = await listReferralDocuments(id);
  return NextResponse.json({ documents });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDocumentIngestEnabled()) {
    return featureDisabledResponse();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "documents:upload");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const userId = user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Session is missing user id" },
      { status: 401 }
    );
  }
  const { id } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Request must be multipart form data" },
      { status: 400 }
    );
  }

  const fileEntries = [
    ...formData.getAll("files"),
    ...formData.getAll("file"),
  ].filter((value): value is File => value instanceof File);
  const rawType = formData.get("type");
  const autoIngest = isTruthyValue(formData.get("autoIngest"));

  if (fileEntries.length === 0) {
    return NextResponse.json(
      { error: "At least one file is required" },
      { status: 400 }
    );
  }

  if (!isDocumentType(rawType)) {
    return NextResponse.json(
      { error: "type must be a supported document type" },
      { status: 400 }
    );
  }

  try {
    const uploaded = [];
    const failures = [];
    let autoIngestedCount = 0;

    for (const file of fileEntries) {
      try {
        const document = await createReferralDocument({
          caseId: id,
          type: rawType,
          file,
          uploadedByUserId: userId,
        });

        let ingestedDocument = null;
        let autoIngestStatus = "SKIPPED";

        if (autoIngest && document.mimeType === "application/pdf") {
          try {
            ingestedDocument = await ingestReferralDocument({
              caseId: id,
              documentId: document.id,
              actorUserId: userId,
            });
            autoIngestStatus = "COMPLETE";
            autoIngestedCount += 1;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unable to ingest document";
            autoIngestStatus = "FAILED";
            failures.push({
              fileName: document.fileName,
              stage: "ingest",
              error: message,
            });
          }
        }

        uploaded.push({
          id: document.id,
          fileName: document.fileName,
          type: document.type,
          mimeType: document.mimeType,
          ocrStatus: ingestedDocument?.ocrStatus ?? document.ocrStatus,
          parseStatus: ingestedDocument?.parseStatus ?? document.parseStatus,
          autoIngestStatus,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to upload document";
        failures.push({
          fileName: file.name,
          stage: "upload",
          error: message,
        });
      }
    }

    if (uploaded.length === 0) {
      const firstFailure = failures[0];
      return NextResponse.json(
        {
          error: firstFailure?.error ?? "Unable to upload documents",
          failures,
        },
        {
          status:
            firstFailure && isUserInputError(firstFailure.error) ? 400 : 500,
        }
      );
    }

    return NextResponse.json(
      {
        uploaded,
        failures,
        autoIngestedCount,
      },
      { status: failures.length > 0 ? 207 : 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to upload document";
    const status = isUserInputError(message) ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
