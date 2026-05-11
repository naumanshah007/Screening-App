"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

const documentTypeOptions = [
  { value: "REFERRAL", label: "Referral" },
  { value: "CLINIC_LETTER", label: "Clinic Letter" },
  { value: "DISCHARGE_SUMMARY", label: "Discharge Summary" },
  { value: "LAB_RESULT", label: "Lab Result" },
  { value: "RADIOLOGY", label: "Radiology" },
  { value: "OTHER", label: "Other" },
];

export function DocumentUploadForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [type, setType] = useState("REFERRAL");
  const [files, setFiles] = useState<File[]>([]);
  const [autoIngest, setAutoIngest] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) {
      setError("Select at least one file before uploading.");
      return;
    }

    setUploading(true);
    setError(null);
    setWarning(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("type", type);
    formData.append("autoIngest", autoIngest ? "true" : "false");
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      const response = await fetch(`/api/cases/${caseId}/documents`, {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        error?: string;
        uploaded?: Array<{ fileName: string; autoIngestStatus: string }>;
        failures?: Array<{ fileName: string; stage: string; error: string }>;
        autoIngestedCount?: number;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }

      const uploadedCount = payload.uploaded?.length ?? 0;
      const failureCount = payload.failures?.length ?? 0;
      const autoIngestedCount = payload.autoIngestedCount ?? 0;

      if (failureCount > 0) {
        setWarning(
          `${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded. ${failureCount} file${failureCount === 1 ? "" : "s"} need attention.`
        );
      } else {
        setSuccess(
          `${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded${autoIngestedCount > 0 ? ` and ${autoIngestedCount} PDF${autoIngestedCount === 1 ? "" : "s"} auto-ingested` : ""}.`
        );
      }

      setFiles([]);
      const form = event.currentTarget;
      form.reset();
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Document Type"
        value={type}
        onChange={(event) => setType(event.target.value)}
        options={documentTypeOptions}
      />
      <Input
        label="Choose Files"
        type="file"
        accept=".pdf,image/png,image/jpeg,image/tiff,image/webp"
        multiple
        onChange={(event) =>
          setFiles(Array.from(event.target.files ?? []))
        }
        hint="Upload a referral pack in one batch. All selected files will use the chosen document type."
      />
      <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={autoIngest}
          onChange={(event) => setAutoIngest(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-600"
        />
        <span>
          Auto-ingest PDFs after upload.
          <span className="block text-xs text-muted-foreground">
            PDF files will be parsed immediately. Image OCR still requires a later slice.
          </span>
        </span>
      </label>
      {files.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          {files.length} file{files.length === 1 ? "" : "s"} selected
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {warning && (
        <div className="rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-sm text-foreground">
          {warning}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
          {success}
        </div>
      )}

      <Button type="submit" loading={uploading} className="w-full">
        {!uploading && <Upload className="h-4 w-4" />}
        Upload Documents
      </Button>
    </form>
  );
}
