"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";

type AssigneeOption = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type EditableCaseRecord = {
  id: string;
  serviceLine: "COLPOSCOPY" | "GYNAECOLOGY";
  receivedAt: string | Date;
  referralSource: string | null;
  externalCaseId: string | null;
  referralReason: string | null;
  currentCategory: string | null;
  assignedToUserId: string | null;
  highSuspicionCancer: boolean;
  smoOnly: boolean;
  regradeOfCaseId: string | null;
  triageNotes: string | null;
  clinicianDecision: {
    id: string;
    finalPriority: string | null;
  } | null;
  // Colposcopy-specific
  fctStatus: string | null;
  hpvTestResult: string | null;
  hpvType: string | null;
  cytologySample: string | null;
  referrerReasonCode: string | null;
  assessmentOfReferral: string | null;
  bookingPriorityNote: string | null;
  referralType: string | null;
  ovestinInstruction: string | null;
  ncsrNoteAdded: boolean | null;
  referralNoteAdded: boolean | null;
  internalTriageNotes: string | null;
  // Gynaecology-specific
  gynaecologyCategory: string | null;
  ussAvailable: boolean | null;
  ussFindings: string | null;
};

const SERVICE_ASSIGNEE_ROLES: Record<
  EditableCaseRecord["serviceLine"],
  readonly string[]
> = {
  COLPOSCOPY: ["COLPO_CNS", "COLPOSCOPIST", "SMO_REVIEWER", "COORDINATOR", "ADMIN"],
  GYNAECOLOGY: ["GYNAE_GRADER", "SMO_REVIEWER", "COORDINATOR", "ADMIN"],
};

function toDateTimeLocalValue(value: string | Date) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function CaseEditForm({
  referralCase,
  assignees,
}: {
  referralCase: EditableCaseRecord;
  assignees: AssigneeOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    receivedAt: toDateTimeLocalValue(referralCase.receivedAt),
    referralSource: referralCase.referralSource ?? "",
    externalCaseId: referralCase.externalCaseId ?? "",
    referralReason: referralCase.referralReason ?? "",
    currentCategory: referralCase.currentCategory ?? "",
    assignedToUserId: referralCase.assignedToUserId ?? "",
    highSuspicionCancer: referralCase.highSuspicionCancer,
    smoOnly: referralCase.smoOnly,
    regradeOfCaseId: referralCase.regradeOfCaseId ?? "",
    triageNotes: referralCase.triageNotes ?? "",
    // Colposcopy-specific
    fctStatus: referralCase.fctStatus ?? "",
    hpvTestResult: referralCase.hpvTestResult ?? "",
    hpvType: referralCase.hpvType ?? "",
    cytologySample: referralCase.cytologySample ?? "",
    referrerReasonCode: referralCase.referrerReasonCode ?? "",
    assessmentOfReferral: referralCase.assessmentOfReferral ?? "",
    bookingPriorityNote: referralCase.bookingPriorityNote ?? "",
    referralType: referralCase.referralType ?? "",
    ovestinInstruction: referralCase.ovestinInstruction ?? "",
    ncsrNoteAdded: referralCase.ncsrNoteAdded ?? false,
    referralNoteAdded: referralCase.referralNoteAdded ?? false,
    internalTriageNotes: referralCase.internalTriageNotes ?? "",
    // Gynaecology-specific
    gynaecologyCategory: referralCase.gynaecologyCategory ?? "",
    ussAvailable: referralCase.ussAvailable ?? false,
    ussFindings: referralCase.ussFindings ?? "",
  });

  const filteredAssignees = assignees.filter((assignee) =>
    SERVICE_ASSIGNEE_ROLES[referralCase.serviceLine].includes(assignee.role)
  );

  function setField(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/cases/${referralCase.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receivedAt: form.receivedAt
            ? new Date(form.receivedAt).toISOString()
            : undefined,
          referralSource: form.referralSource,
          externalCaseId: form.externalCaseId,
          referralReason: form.referralReason,
          currentCategory: form.currentCategory,
          assignedToUserId: form.assignedToUserId || null,
          highSuspicionCancer: form.highSuspicionCancer,
          smoOnly: form.smoOnly,
          regradeOfCaseId: form.regradeOfCaseId || null,
          triageNotes: form.triageNotes,
          // Colposcopy-specific
          ...(referralCase.serviceLine === "COLPOSCOPY" && {
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
          // Gynaecology-specific
          ...(referralCase.serviceLine === "GYNAECOLOGY" && {
            gynaecologyCategory: form.gynaecologyCategory || null,
            ussAvailable: form.ussAvailable,
            ussFindings: form.ussFindings || null,
            internalTriageNotes: form.internalTriageNotes || null,
          }),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update referral case");
      }

      router.push(`/cases/${referralCase.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update referral case"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {referralCase.clinicianDecision && (
        <div className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-foreground">
          This case already has a clinician decision. Priority changes should stay in
          the grading workflow; this edit screen only updates intake and assignment
          metadata.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Locked Context</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
          <div>
            <div className="text-muted-foreground">Service line</div>
            <div className="font-medium text-foreground">
              {referralCase.serviceLine === "COLPOSCOPY" ? "Colposcopy" : "Gynaecology"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Case id</div>
            <div className="font-mono text-foreground text-xs break-all">
              {referralCase.id}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operational Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Received at"
              type="datetime-local"
              value={form.receivedAt}
              onChange={(event) => setField("receivedAt", event.target.value)}
              required
            />
            <Select
              label="Assign to"
              value={form.assignedToUserId}
              onChange={(event) => setField("assignedToUserId", event.target.value)}
              options={[
                { value: "", label: "Unassigned" },
                ...filteredAssignees.map((assignee) => ({
                  value: assignee.id,
                  label: `${assignee.name ?? assignee.email} · ${assignee.role}`,
                })),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Referral source"
              value={form.referralSource}
              onChange={(event) => setField("referralSource", event.target.value)}
            />
            <Input
              label="External case id"
              value={form.externalCaseId}
              onChange={(event) => setField("externalCaseId", event.target.value)}
            />
          </div>

          <Input
            label="Referral reason"
            value={form.referralReason}
            onChange={(event) => setField("referralReason", event.target.value)}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Category"
              value={form.currentCategory}
              onChange={(event) => setField("currentCategory", event.target.value)}
            />
            <Input
              label="Regrade of case id"
              value={form.regradeOfCaseId}
              onChange={(event) => setField("regradeOfCaseId", event.target.value)}
              placeholder="Optional case id"
            />
          </div>

          <Textarea
            label="Triage notes"
            rows={6}
            value={form.triageNotes}
            onChange={(event) => setField("triageNotes", event.target.value)}
          />

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
                  Keeps the case flagged for urgent escalation and grading review.
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
                  Retains the senior-review flag for queueing and booking decisions.
                </span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* ─── Colposcopy-Specific Triage Fields ─────────────────────────────── */}
      {referralCase.serviceLine === "COLPOSCOPY" && (
        <Card>
          <CardHeader>
            <CardTitle>Colposcopy Triage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">Faster Cancer Treatment (FCT)</label>
              <div className="flex flex-wrap gap-4">
                {[
                  { value: "", label: "Clear" },
                  { value: "confirmed_cancer", label: "Confirmed cancer at grading" },
                  { value: "high_suspicion", label: "High suspicion of cancer" },
                  { value: "no_low_suspicion", label: "No/Low suspicion" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="radio" name="fctStatus" value={opt.value} checked={form.fctStatus === opt.value} onChange={(e) => setField("fctStatus", e.target.value)} className="h-4 w-4 border-border-strong text-success" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Select label="HPV test" value={form.hpvTestResult} onChange={(e) => setField("hpvTestResult", e.target.value)} options={[{ value: "", label: "Select" }, { value: "not_detected", label: "HPV not detected" }, { value: "hpv_16_18", label: "HPV 16/18 detected" }, { value: "hpv_other", label: "HPV other detected" }, { value: "inadequate", label: "Inadequate" }]} />
              <Select label="Type (HPV)" value={form.hpvType} onChange={(e) => setField("hpvType", e.target.value)} options={[{ value: "", label: "Select" }, { value: "primary_screening", label: "Primary screening" }, { value: "post_treatment", label: "Post-treatment" }, { value: "surveillance", label: "Surveillance" }, { value: "triage", label: "Triage referral" }, { value: "other", label: "Other" }]} />
              <Select label="Cytology sample" value={form.cytologySample} onChange={(e) => setField("cytologySample", e.target.value)} options={[{ value: "", label: "Select" }, { value: "negative", label: "Negative" }, { value: "asc_us", label: "ASC-US" }, { value: "lsil", label: "LSIL" }, { value: "asc_h", label: "ASC-H" }, { value: "hsil", label: "HSIL" }, { value: "scc", label: "SCC" }, { value: "glandular", label: "Glandular" }, { value: "unsatisfactory", label: "Unsatisfactory" }]} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Select label="Assessment of referral" value={form.assessmentOfReferral} onChange={(e) => setField("assessmentOfReferral", e.target.value)} options={[{ value: "", label: "Select" }, { value: "appropriate", label: "Appropriate" }, { value: "inappropriate", label: "Inappropriate" }, { value: "incomplete", label: "Incomplete" }, { value: "urgent", label: "Urgent" }]} />
              <Input label="Booking priority" value={form.bookingPriorityNote} onChange={(e) => setField("bookingPriorityNote", e.target.value)} placeholder="e.g. 10 days, 30 days" />
              <Select label="Type" value={form.referralType} onChange={(e) => setField("referralType", e.target.value)} options={[{ value: "", label: "Select" }, { value: "new", label: "New referral" }, { value: "re_referral", label: "Re-referral" }, { value: "follow_up", label: "Follow-up" }, { value: "toc", label: "Test of cure" }]} />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">Ovestin</label>
              <div className="space-y-2">
                {[
                  { value: "", label: "No" },
                  { value: "contraindicated", label: "Contraindicated (Hormone positive BCA)" },
                  { value: "2_nights", label: "Prescribe nightly, omitting 2 nights prior to visit" },
                  { value: "3_weeks", label: "Prescribe nightly for 3 weeks then twice weekly, omitting 2 nights prior" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <input type="radio" name="ovestinInstruction" value={opt.value} checked={form.ovestinInstruction === opt.value} onChange={(e) => setField("ovestinInstruction", e.target.value)} className="mt-0.5 h-4 w-4 border-border-strong text-success" />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={form.ncsrNoteAdded} onChange={(e) => setField("ncsrNoteAdded", e.target.checked)} className="h-4 w-4 rounded border-border-strong text-success" />
                NCSR Note added
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={form.referralNoteAdded} onChange={(e) => setField("referralNoteAdded", e.target.checked)} className="h-4 w-4 rounded border-border-strong text-success" />
                Referral Note added
              </label>
            </div>

            <Textarea label="Triage Notes (Internal)" rows={3} value={form.internalTriageNotes} onChange={(e) => setField("internalTriageNotes", e.target.value)} />
          </CardContent>
        </Card>
      )}

      {/* ─── Gynaecology-Specific Triage Fields ──────────────────────────────── */}
      {referralCase.serviceLine === "GYNAECOLOGY" && (
        <Card>
          <CardHeader>
            <CardTitle>Gynaecology Triage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select label="Condition category" value={form.gynaecologyCategory} onChange={(e) => setField("gynaecologyCategory", e.target.value)} options={[{ value: "", label: "Select" }, { value: "aub", label: "Abnormal Uterine Bleeding (AUB)" }, { value: "fibroids", label: "Fibroids" }, { value: "ovarian_mass", label: "Ovarian Masses / Cysts" }, { value: "pmb", label: "Post-Menopausal Bleeding (PMB)" }, { value: "pelvic_pain", label: "Pelvic Pain" }, { value: "urogynaecology", label: "Urogynaecology" }, { value: "cervical_polyp", label: "Cervical Polyp" }, { value: "tubal_ligation", label: "Tubal Ligation" }, { value: "pcos", label: "PCOS" }, { value: "fertility", label: "Fertility" }, { value: "pelvic_tear", label: "Pelvic Tear" }, { value: "paediatric", label: "Paediatric Gynaecology" }, { value: "other", label: "Other" }]} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <input type="checkbox" checked={form.ussAvailable} onChange={(e) => setField("ussAvailable", e.target.checked)} className="mt-1 h-4 w-4 rounded border-border-strong" />
                <span>
                  <span className="block font-semibold">Pelvic ultrasound available</span>
                  <span className="block text-xs text-muted-foreground mt-1">Required for most gynaecology grading categories.</span>
                </span>
              </label>
              <Input label="USS findings" value={form.ussFindings} onChange={(e) => setField("ussFindings", e.target.value)} placeholder="e.g. ET 12mm, fibroid 4cm" />
            </div>
            <Textarea label="Internal notes" rows={3} value={form.internalTriageNotes} onChange={(e) => setField("internalTriageNotes", e.target.value)} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={loading}>
          Save case changes
        </Button>
        <Link href={`/cases/${referralCase.id}`}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
