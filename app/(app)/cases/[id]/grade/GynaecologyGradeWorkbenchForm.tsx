"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { ClinicalSummaryPayload } from "@/lib/cases/summary";

type GynaecologyGradeWorkbenchValues = {
  highSuspicionCancer: boolean;
  smoOnly: boolean;
  gynaecologyCategory: string;
  ussAvailable: boolean;
  ussFindings: string;
  triageNotes: string;
  internalTriageNotes: string;
};

type InvestigationSummary = {
  id: string;
  type: string;
  result: string | null;
  notes: string | null;
};

function ChecklistItem({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={complete ? "low" : "default"}>
        {complete ? "Checked" : "Review"}
      </Badge>
    </div>
  );
}

export function GynaecologyGradeWorkbenchForm({
  caseId,
  initialValues,
  investigations,
  summaryPayload,
  summaryApproved,
}: {
  caseId: string;
  initialValues: GynaecologyGradeWorkbenchValues;
  investigations: InvestigationSummary[];
  summaryPayload: ClinicalSummaryPayload | null;
  summaryApproved: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(field: keyof GynaecologyGradeWorkbenchValues, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          highSuspicionCancer: form.highSuspicionCancer,
          smoOnly: form.smoOnly,
          gynaecologyCategory: form.gynaecologyCategory || null,
          ussAvailable: form.ussAvailable,
          ussFindings: form.ussFindings || null,
          triageNotes: form.triageNotes || null,
          internalTriageNotes: form.internalTriageNotes || null,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save gynaecology workbench");
      }

      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save gynaecology workbench"
      );
    } finally {
      setLoading(false);
    }
  }

  const summarySections = summaryPayload?.sections.slice(0, 3) ?? [];

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
        Use this workbench to confirm the core grading context first: what condition this is,
        whether ultrasound support is available, and whether the case needs escalation or SMO
        review. Save here, then run the system recommendation.
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Quick review checklist</div>
          <ChecklistItem
            label="Condition category recorded"
            complete={Boolean(form.gynaecologyCategory)}
          />
          <ChecklistItem
            label="Ultrasound status recorded"
            complete={form.ussAvailable || Boolean(form.ussFindings)}
          />
          <ChecklistItem
            label="Clinician-approved summary available"
            complete={summaryApproved}
          />
          <ChecklistItem
            label="At least one investigation or supporting evidence item is on file"
            complete={investigations.length > 0}
          />
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Escalation flags</div>
          <label className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <input
              type="checkbox"
              checked={form.highSuspicionCancer}
              onChange={(event) => setField("highSuspicionCancer", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-destructive/40"
            />
            <span>
              <span className="block font-semibold">High suspicion cancer</span>
              <span className="block text-xs text-destructive mt-1">
                Use when the referral should go to the cancer-priority pathway.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.smoOnly}
              onChange={(event) => setField("smoOnly", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-sky-300"
            />
            <span>
              <span className="block font-semibold">SMO only</span>
              <span className="block text-xs text-info mt-1">
                Use when the referral should stay in a senior-review workflow.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          label="Condition category"
          value={form.gynaecologyCategory}
          onChange={(event) => setField("gynaecologyCategory", event.target.value)}
          options={[
            { value: "", label: "Select" },
            { value: "aub", label: "Abnormal Uterine Bleeding (AUB)" },
            { value: "fibroids", label: "Fibroids" },
            { value: "ovarian_mass", label: "Ovarian Masses / Cysts" },
            { value: "pmb", label: "Post-Menopausal Bleeding (PMB)" },
            { value: "pelvic_pain", label: "Pelvic Pain" },
            { value: "urogynaecology", label: "Urogynaecology" },
            { value: "cervical_polyp", label: "Cervical Polyp" },
            { value: "tubal_ligation", label: "Tubal Ligation" },
            { value: "pcos", label: "PCOS" },
            { value: "fertility", label: "Fertility" },
            { value: "pelvic_tear", label: "Pelvic Tear / Obstetric Injury" },
            { value: "paediatric", label: "Paediatric Gynaecology" },
            { value: "other", label: "Other" },
          ]}
        />
        <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={form.ussAvailable}
            onChange={(event) => setField("ussAvailable", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border-strong"
          />
          <span>
            <span className="block font-semibold">Pelvic ultrasound available</span>
            <span className="block text-xs text-muted-foreground mt-1">
              Most gynaecology pathways need ultrasound support before final grading.
            </span>
          </span>
        </label>
      </div>

      <Input
        label="Key ultrasound findings"
        value={form.ussFindings}
        onChange={(event) => setField("ussFindings", event.target.value)}
        placeholder="e.g. ET 8mm, fibroid 6cm, complex left ovarian cyst 5cm"
      />

      {investigations.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Investigations on file</div>
          <div className="flex flex-wrap gap-2">
            {investigations.map((investigation) => (
              <Badge key={investigation.id} variant="info">
                {investigation.type}
                {investigation.result ? ` - ${investigation.result}` : ""}
              </Badge>
            ))}
          </div>
          {investigations.some((investigation) => investigation.notes) && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              {investigations
                .filter((investigation) => investigation.notes)
                .map((investigation) => `${investigation.type}: ${investigation.notes}`)
                .join(" | ")}
            </div>
          )}
        </div>
      )}

      {summaryPayload && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">One-page summary snapshot</div>
            <Badge variant={summaryApproved ? "low" : "high"}>
              {summaryApproved ? "Approved" : "Review pending"}
            </Badge>
          </div>

          {(summaryPayload.warnings ?? []).length > 0 && (
            <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-4">
              <div className="text-sm font-semibold text-foreground">Warnings</div>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {summaryPayload.warnings.slice(0, 4).map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {summarySections.map((section) => (
              <div
                key={section.id}
                className="rounded-xl border border-border bg-card px-4 py-4"
              >
                <div className="text-sm font-semibold text-foreground">{section.title}</div>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {section.bullets.slice(0, 4).map((bullet) => (
                    <li key={bullet}>• {bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <Textarea
        label="Triage notes"
        rows={4}
        value={form.triageNotes}
        onChange={(event) => setField("triageNotes", event.target.value)}
        placeholder="Visible service-facing note for the grader or coordinator"
      />

      <Textarea
        label="Internal grading notes"
        rows={4}
        value={form.internalTriageNotes}
        onChange={(event) => setField("internalTriageNotes", event.target.value)}
        placeholder="Internal notes for the grading team"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={loading}>
          Save gynaecology workbench
        </Button>
        <span className="text-sm text-muted-foreground">
          After saving, re-run the system recommendation if the grading context changed.
        </span>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
    </form>
  );
}
