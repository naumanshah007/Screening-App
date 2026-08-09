"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

const DISPOSITIONS = [
  "SOURCE_SUPPORTS_OPTION_A",
  "SOURCE_SUPPORTS_OPTION_B",
  "KEEP_GOVERNANCE_STOP",
  "REQUIRE_EXTERNAL_CLINICAL_ADVICE",
  "RULEBOOK_CORRECTION_REQUIRED",
  "ORACLE_CORRECTION_REQUIRED",
] as const;

type ReviewCase = {
  caseId: string;
  title: string;
  source: string;
  recommendations: readonly string[];
  figureBranch: string;
  affectedRuleIds: readonly string[];
  affectedTests: readonly string[];
  sourceGuidance: string;
  currentLegacyBehaviour: string;
  canonicalBehaviour: string;
  proposedFinalBehaviour: string;
  safetyImpact: string;
  testEvidence: string;
  competingInterpretation: string;
  sourceSupportedDisposition: (typeof DISPOSITIONS)[number];
  effectOnPathways: string;
  rules: Array<{
    stableRuleId: string;
    conditionExpression: unknown;
    provisionalOutcome: string;
  }>;
  approvalStatus: string;
  recordedDisposition: string | null;
  reviewerComment: string | null;
  approver: string | null;
  approvalDate: string | null;
};

function GovernanceCaseCard({
  item,
  versionId,
  revision,
  status,
  canPropose,
  canApprove,
  onRevision,
}: {
  item: ReviewCase;
  versionId: string;
  revision: number;
  status: string;
  canPropose: boolean;
  canApprove: boolean;
  onRevision: (revision: number) => void;
}) {
  const router = useRouter();
  const [disposition, setDisposition] = useState<(typeof DISPOSITIONS)[number]>(
    item.sourceSupportedDisposition
  );
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState<"PROPOSE" | "APPROVE" | "REJECT" | "REQUEST_CHANGE" | null>(null);
  const [error, setError] = useState("");

  async function submit(action: "PROPOSE" | "APPROVE" | "REJECT" | "REQUEST_CHANGE") {
    setBusy(action);
    setError("");
    try {
      const response = await fetch(
        `/api/clinical-rules/versions/${versionId}/governance-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            caseId: item.caseId,
            disposition,
            comments,
            expectedRevision: revision,
          }),
        }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to record review");
      onRevision(body.revision);
      setComments("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record review");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{item.caseId}</Badge>
            <Badge variant="low">Engineering: implemented</Badge>
            <Badge variant={item.approvalStatus.startsWith("APPROVED") ? "low" : "high"}>
              Clinical: {item.approvalStatus.replaceAll("_", " ")}
            </Badge>
            <Badge variant={item.approvalStatus.startsWith("APPROVED") ? "low" : "high"}>
              Governance: {item.approvalStatus.startsWith("APPROVED") ? "approved" : "pending"}
            </Badge>
          </div>
          <CardTitle className="mt-3">{item.title}</CardTitle>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.source}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 text-sm lg:grid-cols-2">
          {[
            ["Source guidance", item.sourceGuidance],
            ["Current Legacy behaviour", item.currentLegacyBehaviour],
            ["Canonical behaviour", item.canonicalBehaviour],
            ["Proposed final behaviour", item.proposedFinalBehaviour],
            ["Safety impact", item.safetyImpact],
            ["Test evidence", item.testEvidence],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-muted/25 p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
              <p className="mt-2 leading-6">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 text-sm lg:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pathway / recommendation</div>
            <p className="mt-2">{item.figureBranch}</p>
            <p className="mt-2 font-mono text-xs">{item.recommendations.join(", ")}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Alternative interpretation</div>
            <p className="mt-2 leading-6">{item.competingInterpretation}</p>
            <p className="mt-2 text-xs text-muted-foreground">{item.effectOnPathways}</p>
          </div>
        </div>

        {item.rules.length > 0 && <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Current rule records and AST</div>
          <div className="space-y-3">
            {item.rules.map((rule) => (
              <div key={rule.stableRuleId} className="overflow-hidden rounded-lg border border-border">
                <div className="border-b border-border bg-slate-50 px-3 py-2 font-mono text-xs font-bold">{rule.stableRuleId}</div>
                <div className="p-3 text-sm"><strong>Current outcome:</strong> {rule.provisionalOutcome}</div>
                <pre className="max-h-64 overflow-auto border-t border-border bg-navy-950 p-3 text-[11px] leading-5 text-slate-100">{JSON.stringify(rule.conditionExpression, null, 2)}</pre>
              </div>
            ))}
          </div>
        </div>}

        <div className="rounded-lg border border-border p-3 text-xs leading-5 text-muted-foreground">
          <strong className="text-foreground">Affected tests:</strong> {item.affectedTests.join(", ")}
          {item.recordedDisposition && <><br /><strong className="text-foreground">Recorded disposition:</strong> {item.recordedDisposition}</>}
          {item.reviewerComment && <><br /><strong className="text-foreground">Latest comment:</strong> {item.reviewerComment}</>}
          <br /><strong className="text-foreground">Approver:</strong> {item.approver ?? "Not yet approved"}
          <br /><strong className="text-foreground">Date:</strong> {item.approvalDate ?? "—"}
        </div>

        <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
          <label className="text-xs font-semibold text-foreground">
            Proposed disposition
            <select
              value={disposition}
              onChange={(event) => setDisposition(event.target.value as (typeof DISPOSITIONS)[number])}
              disabled={status !== "DRAFT"}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-xs"
            >
              {DISPOSITIONS.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <Textarea
            label="Reviewer comments"
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            rows={3}
            placeholder="Record source reasoning and any remaining concern (minimum 10 characters)."
            disabled={status !== "DRAFT"}
          />
        </div>
        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!canPropose || status !== "DRAFT" || comments.trim().length < 10 || busy !== null}
            onClick={() => void submit("PROPOSE")}
            icon={busy === "PROPOSE" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
          >
            Submit proposal
          </Button>
          <Button
            variant="primary"
            disabled={!canApprove || status !== "DRAFT" || comments.trim().length < 10 || busy !== null}
            onClick={() => void submit("APPROVE")}
            icon={busy === "APPROVE" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          >
            APPROVE
          </Button>
          <Button
            variant="danger"
            disabled={!canApprove || status !== "DRAFT" || comments.trim().length < 10 || busy !== null}
            onClick={() => void submit("REJECT")}
            loading={busy === "REJECT"}
          >
            REJECT
          </Button>
          <Button
            variant="outline"
            disabled={!canApprove || status !== "DRAFT" || comments.trim().length < 10 || busy !== null}
            onClick={() => void submit("REQUEST_CHANGE")}
            loading={busy === "REQUEST_CHANGE"}
          >
            REQUEST CHANGE
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClinicalGovernanceReviewWorkspace({
  versionId,
  initialRevision,
  status,
  canPropose,
  canApprove,
  cases,
}: {
  versionId: string;
  initialRevision: number;
  status: string;
  canPropose: boolean;
  canApprove: boolean;
  cases: ReviewCase[];
}) {
  const [revision, setRevision] = useState(initialRevision);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
        <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Clinical governance boundary</div>
        <p className="mt-1">A proposer cannot approve the same interpretation. Approval records a new draft revision and audit event; it never mutates a published version or permits publication. Current draft revision: {revision}.</p>
      </div>
      {cases.map((item) => (
        <GovernanceCaseCard
          key={item.caseId}
          item={item}
          versionId={versionId}
          revision={revision}
          status={status}
          canPropose={canPropose}
          canApprove={canApprove}
          onRevision={setRevision}
        />
      ))}
    </div>
  );
}
