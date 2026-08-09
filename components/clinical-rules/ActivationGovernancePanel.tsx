"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Play, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

type GateDefinition = {
  gateId: string;
  title: string;
  question: string;
  evidence: string;
  proposed: string;
  safetyImpact: string;
  pathway: string;
  tests: string;
  engineeringStatus: string;
  roles: readonly string[];
};

type GateState = {
  gateId: string;
  action: "APPROVE" | "REJECT" | "REQUEST_CHANGE" | "PENDING";
  comments: string | null;
  actorName: string | null;
  actorRole: string | null;
  subjectUserId: string | null;
  subjectName: string | null;
  timestamp: string | null;
  outcome: string | null;
};

type AdminUser = { id: string; name: string | null; email: string | null };

export function ActivationGovernancePanel({
  versionId,
  versionStatus,
  definitions,
  states,
  admins,
  currentUserId,
  currentUserRole,
  thresholds,
}: {
  versionId: string;
  versionStatus: string;
  definitions: GateDefinition[];
  states: GateState[];
  admins: AdminUser[];
  currentUserId: string;
  currentUserRole: string;
  thresholds: Record<string, string>;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const allApproved = states.every((state) => state.action === "APPROVE");
  const operator = states.find((state) => state.gateId === "ACTIVATION-OPERATOR");
  const assignedOperator = operator?.subjectUserId === currentUserId;

  async function decide(gateId: string, action: "APPROVE" | "REJECT" | "REQUEST_CHANGE") {
    setBusy(`${gateId}:${action}`);
    try {
      const response = await fetch(
        `/api/clinical-rules/versions/${versionId}/activation-gates`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            gateId,
            action,
            comments: comments[gateId] ?? "",
            subjectUserId: subjects[gateId] || undefined,
          }),
        }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to record decision");
      toast.success(`${gateId} decision recorded`);
      setComments((current) => ({ ...current, [gateId]: "" }));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record decision");
    } finally {
      setBusy(null);
    }
  }

  async function activateProduction() {
    const reason = window.prompt(
      "Production activation reason (record the approved change reference)"
    );
    if (!reason) return;
    setBusy("ACTIVATE_PRODUCTION");
    try {
      const response = await fetch(`/api/clinical-rules/versions/${versionId}/activate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ environment: "PRODUCTION", reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to activate Production");
      toast.success("Production clinical authority activated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to activate Production");
    } finally {
      setBusy(null);
    }
  }

  async function rollbackProduction() {
    const reason = window.prompt("Emergency rollback reason and incident/change reference");
    if (!reason) return;
    setBusy("ROLLBACK_PRODUCTION");
    try {
      const response = await fetch(`/api/clinical-rules/versions/${versionId}/rollback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ environment: "PRODUCTION", reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to roll Production back");
      toast.success("Production authority rolled back to Legacy");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to roll Production back");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950">
        <div className="flex items-center gap-2 font-bold">
          <ShieldAlert className="h-4 w-4" /> Production authority boundary
        </div>
        <p className="mt-1">
          Decisions are append-only and attributable. No approval is inferred from engineering
          evidence. Production remains Legacy until every current-checksum gate is approved and
          the assigned operator explicitly activates the published version.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Operational gates" value={`${states.filter((state) => state.action === "APPROVE").length}/${states.length}`} />
        <Summary label="Release status" value={versionStatus} />
        <Summary label="Production activation" value={allApproved && assignedOperator ? "OPERATOR READY" : "BLOCKED"} />
      </div>

      {definitions.map((definition) => {
        const state = states.find((item) => item.gateId === definition.gateId)!;
        const assignment = definition.gateId === "ACTIVATION-OPERATOR" || definition.gateId === "DEPUTY-OPERATOR";
        const mayDecide = definition.roles.includes(currentUserRole);
        const comment = comments[definition.gateId] ?? "";
        return (
          <Card key={definition.gateId}>
            <CardHeader>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="info">{definition.gateId}</Badge>
                  <Badge variant="low">Engineering: {definition.engineeringStatus.replaceAll("_", " ")}</Badge>
                  <Badge variant={state.action === "APPROVE" ? "low" : "high"}>Governance: {state.action.replaceAll("_", " ")}</Badge>
                </div>
                <CardTitle className="mt-3">{definition.title}</CardTitle>
                <p className="mt-2 text-sm font-medium text-foreground">{definition.question}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm lg:grid-cols-2">
                {[
                  ["Evidence", definition.evidence],
                  ["Proposed interpretation / behaviour", definition.proposed],
                  ["Safety impact", definition.safetyImpact],
                  ["Pathway / workflow", definition.pathway],
                  ["Affected tests", definition.tests],
                  ["Clinical approval status", state.action === "APPROVE" ? "APPROVED" : "NOT APPROVED"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/25 p-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
                    <p className="mt-2 leading-6">{value}</p>
                  </div>
                ))}
              </div>

              {definition.gateId === "ROLLBACK-THRESHOLDS" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="font-bold">Candidate T+0 thresholds — risk-owner approval required</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {Object.entries(thresholds).map(([key, value]) => <li key={key}><strong>{key.replaceAll(/([A-Z])/g, " $1")}:</strong> {value}</li>)}
                  </ul>
                </div>
              )}

              {definition.gateId === "LICENSING" && (
                <div className="rounded-lg border border-border p-3 text-sm">
                  Required recorded outcome: <strong>APPROVED</strong>, <strong>NOT APPROVED</strong>, or <strong>REQUIRES LEGAL REVIEW</strong>. Use APPROVE, REJECT, or REQUEST CHANGE respectively, and state the scope in comments.
                </div>
              )}

              <div className="rounded-lg border border-border p-3 text-xs leading-5 text-muted-foreground">
                <strong className="text-foreground">Latest approver:</strong> {state.actorName ?? "No authenticated decision"}
                <br /><strong className="text-foreground">Role:</strong> {state.actorRole ?? "—"}
                {state.subjectName && <><br /><strong className="text-foreground">Assigned person:</strong> {state.subjectName}</>}
                <br /><strong className="text-foreground">Timestamp:</strong> {state.timestamp ? new Date(state.timestamp).toLocaleString("en-NZ") : "—"}
                <br /><strong className="text-foreground">Comments:</strong> {state.comments ?? "—"}
                {state.outcome && <><br /><strong className="text-foreground">Recorded outcome:</strong> {state.outcome.replaceAll("_", " ")}</>}
              </div>

              {assignment && (
                <label className="block text-xs font-semibold">
                  Authenticated ADMIN assignment
                  <select
                    value={subjects[definition.gateId] ?? ""}
                    onChange={(event) => setSubjects((current) => ({ ...current, [definition.gateId]: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Select an operator</option>
                    {admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.name ?? admin.email ?? admin.id}</option>)}
                  </select>
                </label>
              )}

              <Textarea
                label="Decision comments and evidence reference"
                value={comment}
                onChange={(event) => setComments((current) => ({ ...current, [definition.gateId]: event.target.value }))}
                rows={3}
                placeholder="Record the evidence reviewed and accountable decision (minimum 10 characters)."
              />
              <div className="flex flex-wrap gap-2">
                {(["APPROVE", "REJECT", "REQUEST_CHANGE"] as const).map((action) => (
                  <Button
                    key={action}
                    variant={action === "APPROVE" ? "success" : action === "REJECT" ? "danger" : "outline"}
                    disabled={!mayDecide || comment.trim().length < 10 || (assignment && action === "APPROVE" && !subjects[definition.gateId]) || busy !== null}
                    loading={busy === `${definition.gateId}:${action}`}
                    onClick={() => void decide(definition.gateId, action)}
                  >
                    {action === "REQUEST_CHANGE" ? "REQUEST CHANGE" : action}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> Controlled Production activation</div>
            <p className="mt-1 text-sm text-muted-foreground">Requires PUBLISHED status, every gate approved for this checksum, and the signed-in user assigned as Activation Operator.</p>
          </div>
          <Button
            variant="primary"
            icon={busy === "ACTIVATE_PRODUCTION" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            disabled={versionStatus !== "PUBLISHED" || !allApproved || !assignedOperator || busy !== null}
            onClick={() => void activateProduction()}
          >
            Activate Production authority
          </Button>
          <Button
            variant="danger"
            icon={busy === "ROLLBACK_PRODUCTION" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            disabled={versionStatus !== "ACTIVE" || ![operator?.subjectUserId, states.find((state) => state.gateId === "DEPUTY-OPERATOR")?.subjectUserId].includes(currentUserId) || busy !== null}
            onClick={() => void rollbackProduction()}
          >
            Roll back Production to Legacy
          </Button>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-lg font-bold">{value}</div></div>;
}
