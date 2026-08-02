"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, Copy, Download, FileCheck2, Play, RotateCcw, Send, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ClinicalRuleVersionActions({
  id,
  status,
  canEdit,
  canValidate,
  canApprove,
  canPublish,
  canActivate,
  canRollback,
  canExport,
  sourceSummary,
}: {
  id: string;
  status: string;
  canEdit: boolean;
  canValidate: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canActivate: boolean;
  canRollback: boolean;
  canExport: boolean;
  sourceSummary: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string>();

  async function run(action: string, body?: unknown) {
    setPending(action);
    try {
      const response = await fetch(`/api/clinical-rules/versions/${id}/${action}`, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Unable to ${action}`);
      if (action === "validate" && !result.report.valid) {
        toast.warning(`${result.report.counts.errors} publication blockers remain`);
      } else {
        toast.success(`${action[0]!.toUpperCase()}${action.slice(1)} completed`);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to ${action}`);
    } finally {
      setPending(undefined);
    }
  }

  async function cloneVersion() {
    const displayVersion = window.prompt("New semantic version", "CG-NCSP-3.0.1");
    if (!displayVersion) return;
    const changeSummary = window.prompt("Change summary");
    if (!changeSummary) return;
    setPending("clone");
    try {
      const response = await fetch("/api/clinical-rules/versions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceVersionId: id,
          displayVersion,
          changeSummary,
          changeClassification: "CLINICAL_LOGIC",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to clone version");
      toast.success("Draft created from immutable snapshot");
      router.push(`/rules/clinical/${result.version.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to clone version");
    } finally {
      setPending(undefined);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && ["PUBLISHED", "ACTIVE", "RETIRED", "ARCHIVED"].includes(status) && (
        <Button size="sm" variant="outline" loading={pending === "clone"} onClick={() => void cloneVersion()} icon={<Copy className="h-4 w-4" />}>Clone draft</Button>
      )}
      {canValidate && ["DRAFT", "VALIDATED"].includes(status) && (
        <Button size="sm" variant="outline" loading={pending === "validate"} onClick={() => void run("validate")} icon={<FileCheck2 className="h-4 w-4" />}>Validate</Button>
      )}
      {canApprove && status === "VALIDATED" && (
        <Button size="sm" variant="success" loading={pending === "approve"} onClick={() => { const reason = window.prompt("Approval reason"); if (reason) void run("approve", { reason }); }} icon={<CheckCircle2 className="h-4 w-4" />}>Approve</Button>
      )}
      {canPublish && status === "VALIDATED" && (
        <Button size="sm" variant="secondary" loading={pending === "publish"} onClick={() => { const reason = window.prompt("Publication reason"); if (reason) void run("publish", { reason, sourceSummary }); }} icon={<Send className="h-4 w-4" />}>Publish</Button>
      )}
      {canActivate && status === "PUBLISHED" && (
        <Button size="sm" variant="primary" loading={pending === "activate"} onClick={() => { const reason = window.prompt("Activation reason"); if (reason) void run("activate", { environment: "DEMO", reason }); }} icon={<Play className="h-4 w-4" />}>Activate in demo</Button>
      )}
      {canRollback && status === "PUBLISHED" && (
        <Button size="sm" variant="warning" loading={pending === "rollback"} onClick={() => { const reason = window.prompt("Rollback reason"); if (reason) void run("rollback", { environment: "DEMO", reason }); }} icon={<RotateCcw className="h-4 w-4" />}>Roll back to this</Button>
      )}
      {canPublish && status === "PUBLISHED" && (
        <Button size="sm" variant="outline" loading={pending === "retire"} onClick={() => { const reason = window.prompt("Retirement reason"); if (reason) void run("retire", { reason }); }} icon={<ShieldOff className="h-4 w-4" />}>Retire</Button>
      )}
      {canPublish && status === "RETIRED" && (
        <Button size="sm" variant="outline" loading={pending === "archive"} onClick={() => { const reason = window.prompt("Archive reason"); if (reason) void run("archive", { reason }); }} icon={<Archive className="h-4 w-4" />}>Archive</Button>
      )}
      {canExport && (
        <Button size="sm" variant="outline" onClick={() => { window.location.href = `/api/clinical-rules/versions/${id}/export`; }} icon={<Download className="h-4 w-4" />}>Export JSON</Button>
      )}
    </div>
  );
}
