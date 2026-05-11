"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

type ColposcopyGradeSheetValues = {
  highSuspicionCancer: boolean;
  smoOnly: boolean;
  triageNotes: string;
  fctStatus: string;
  hpvTestResult: string;
  hpvType: string;
  cytologySample: string;
  referrerReasonCode: string;
  assessmentOfReferral: string;
  bookingPriorityNote: string;
  referralType: string;
  ovestinInstruction: string;
  ncsrNoteAdded: boolean;
  referralNoteAdded: boolean;
  internalTriageNotes: string;
};

type InvestigationSummary = {
  id: string;
  type: string;
  result: string | null;
  notes: string | null;
};

export function ColposcopyGradeSheetForm({
  caseId,
  initialValues,
  investigations,
}: {
  caseId: string;
  initialValues: ColposcopyGradeSheetValues;
  investigations: InvestigationSummary[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(field: keyof ColposcopyGradeSheetValues, value: string | boolean) {
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
          triageNotes: form.triageNotes || null,
          fctStatus: form.fctStatus || null,
          hpvTestResult: form.hpvTestResult || null,
          hpvType: form.hpvType || null,
          cytologySample: form.cytologySample || null,
          referrerReasonCode: form.referrerReasonCode || null,
          assessmentOfReferral: form.assessmentOfReferral || null,
          bookingPriorityNote: form.bookingPriorityNote || null,
          referralType: form.referralType || null,
          ovestinInstruction: form.ovestinInstruction || null,
          ncsrNoteAdded: form.ncsrNoteAdded,
          referralNoteAdded: form.referralNoteAdded,
          internalTriageNotes: form.internalTriageNotes || null,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save colposcopy grading sheet");
      }

      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save colposcopy grading sheet"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
        Save the grading sheet here first, then re-run the system recommendation so the rule
        trace reflects the latest colposcopy review context.
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              Use when the referral requires urgent cancer-pathway escalation.
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
              Keeps the case in a senior-review workflow for booking and coordination.
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">
          Faster Cancer Treatment (FCT)
        </label>
        <div className="flex flex-wrap gap-4">
          {[
            { value: "", label: "Clear" },
            { value: "confirmed_cancer", label: "Confirmed cancer at grading" },
            { value: "high_suspicion", label: "High suspicion of cancer" },
            { value: "no_low_suspicion", label: "No/Low suspicion of cancer" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="radio"
                name="fctStatus"
                value={option.value}
                checked={form.fctStatus === option.value}
                onChange={(event) => setField("fctStatus", event.target.value)}
                className="h-4 w-4 border-border-strong text-success"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Select
          label="HPV test"
          value={form.hpvTestResult}
          onChange={(event) => setField("hpvTestResult", event.target.value)}
          options={[
            { value: "", label: "Select" },
            { value: "not_detected", label: "HPV not detected" },
            { value: "hpv_16_18", label: "HPV 16/18 detected" },
            { value: "hpv_other", label: "HPV other detected" },
            { value: "inadequate", label: "Inadequate" },
          ]}
        />
        <Select
          label="HPV pathway type"
          value={form.hpvType}
          onChange={(event) => setField("hpvType", event.target.value)}
          options={[
            { value: "", label: "Select" },
            { value: "primary_screening", label: "Primary screening" },
            { value: "post_treatment", label: "Post-treatment" },
            { value: "surveillance", label: "Surveillance" },
            { value: "triage", label: "Triage referral" },
            { value: "other", label: "Other" },
          ]}
        />
        <Select
          label="Cytology sample"
          value={form.cytologySample}
          onChange={(event) => setField("cytologySample", event.target.value)}
          options={[
            { value: "", label: "Select" },
            { value: "negative", label: "Negative" },
            { value: "asc_us", label: "ASC-US" },
            { value: "lsil", label: "LSIL" },
            { value: "asc_h", label: "ASC-H" },
            { value: "hsil", label: "HSIL" },
            { value: "scc", label: "SCC / suspicious cancer" },
            { value: "glandular", label: "Glandular abnormality" },
            { value: "borderline", label: "Borderline" },
            { value: "unsatisfactory", label: "Unsatisfactory" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          label="Referrer reason"
          value={form.referrerReasonCode}
          onChange={(event) => setField("referrerReasonCode", event.target.value)}
          options={[
            { value: "", label: "Select" },
            { value: "hpv_primary", label: "HPV detected - primary screening" },
            { value: "hpv_post_treatment", label: "HPV detected - post-treatment" },
            { value: "hpv_surveillance", label: "HPV detected - surveillance" },
            { value: "abnormal_appearance", label: "Abnormal cervical appearance" },
            { value: "symptomatic", label: "Symptomatic with co-test" },
            { value: "endorsed_colposcopy", label: "Endorsed referral on colposcopy" },
            { value: "other", label: "Other" },
          ]}
        />
        <Select
          label="Assessment of referral"
          value={form.assessmentOfReferral}
          onChange={(event) => setField("assessmentOfReferral", event.target.value)}
          options={[
            { value: "", label: "Select" },
            { value: "appropriate", label: "Appropriate" },
            { value: "inappropriate", label: "Inappropriate" },
            { value: "incomplete", label: "Incomplete information" },
            { value: "urgent", label: "Urgent" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Input
          label="Booking priority note"
          value={form.bookingPriorityNote}
          onChange={(event) => setField("bookingPriorityNote", event.target.value)}
          placeholder="e.g. 10 days, 30 days, 3 months"
        />
        <Select
          label="Referral type"
          value={form.referralType}
          onChange={(event) => setField("referralType", event.target.value)}
          options={[
            { value: "", label: "Select" },
            { value: "new", label: "New referral" },
            { value: "re_referral", label: "Re-referral" },
            { value: "follow_up", label: "Follow-up" },
            { value: "toc", label: "Test of cure" },
          ]}
        />
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          Use triage notes for any genotype or scenario detail that needs to be visible to the
          reviewing clinician.
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">Ovestin</label>
        <div className="space-y-2">
          {[
            { value: "", label: "No" },
            { value: "contraindicated", label: "Contraindicated (hormone positive BCA)" },
            { value: "2_nights", label: "Prescribe nightly, omitting 2 nights before clinic" },
            { value: "3_weeks", label: "Prescribe nightly for 3 weeks then twice weekly, omitting 2 nights before clinic" },
          ].map((option) => (
            <label key={option.value} className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="radio"
                name="ovestinInstruction"
                value={option.value}
                checked={form.ovestinInstruction === option.value}
                onChange={(event) => setField("ovestinInstruction", event.target.value)}
                className="mt-0.5 h-4 w-4 border-border-strong text-success"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={form.ncsrNoteAdded}
            onChange={(event) => setField("ncsrNoteAdded", event.target.checked)}
            className="h-4 w-4 rounded border-border-strong text-success"
          />
          NCSR note added
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={form.referralNoteAdded}
            onChange={(event) => setField("referralNoteAdded", event.target.checked)}
            className="h-4 w-4 rounded border-border-strong text-success"
          />
          Referral note added
        </label>
      </div>

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

      <Textarea
        label="Triage notes"
        rows={4}
        value={form.triageNotes}
        onChange={(event) => setField("triageNotes", event.target.value)}
        placeholder="Visible reasoning, booking context, or service-facing note"
      />

      <Textarea
        label="Internal triage notes"
        rows={4}
        value={form.internalTriageNotes}
        onChange={(event) => setField("internalTriageNotes", event.target.value)}
        placeholder="Internal grade-sheet notes for the reviewing team"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={loading}>
          Save colposcopy sheet
        </Button>
        <span className="text-sm text-muted-foreground">
          After saving, re-run the system recommendation if the triage inputs changed.
        </span>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
    </form>
  );
}
