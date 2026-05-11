"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";

type PatientOption = {
  id: string;
  nhi: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | Date;
  gpPractice: {
    id: string;
    name: string;
  } | null;
};

type AssigneeOption = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type ServiceDefaults = {
  referralSource: string;
  triageNotes: string;
  referralReasonHint: string;
  categoryHint: string;
  assigneeRoles: readonly string[];
};

const SERVICE_DEFAULTS: Record<"COLPOSCOPY" | "GYNAECOLOGY", ServiceDefaults> = {
  COLPOSCOPY: {
    referralSource: "Colposcopy referral",
    triageNotes:
      "Check HPV, cytology, histology, and prior colposcopy history. Confirm whether the referral looks category-based or needs additional evidence.",
    referralReasonHint: "Example: HSIL referral, HPV 16/18 positivity, persistent low-grade abnormality",
    categoryHint: "Example: High-grade referral, HPV 16/18 pathway, routine low-grade review",
    assigneeRoles: ["COLPO_CNS", "COLPOSCOPIST", "SMO_REVIEWER", "COORDINATOR", "ADMIN"],
  },
  GYNAECOLOGY: {
    referralSource: "Gynaecology referral",
    triageNotes:
      "Check referral letter, imaging, labs, and prior clinic/discharge correspondence. Confirm whether the case has enough evidence for one-page summary and grading.",
    referralReasonHint: "Example: PMB, AUB, fibroids, ovarian cyst, pelvic pain",
    categoryHint: "Example: PMB, ovarian mass, fibroids, pelvic pain, reject / re-refer",
    assigneeRoles: ["GYNAE_GRADER", "SMO_REVIEWER", "COORDINATOR", "ADMIN"],
  },
};

const priorityOptions = [
  { value: "", label: "Leave unassigned" },
  { value: "P1", label: "P1 Urgent" },
  { value: "P1_HSC", label: "P1 HSC" },
  { value: "P2", label: "P2 High" },
  { value: "P2_HSC", label: "P2 HSC" },
  { value: "P3", label: "P3 Standard" },
  { value: "P5", label: "P5 Virtual" },
  { value: "INFO_REQUIRED", label: "Info Required" },
  { value: "REJECT", label: "Reject" },
  { value: "DECLINE", label: "Decline" },
];

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatPatientLabel(patient: PatientOption) {
  const dob = new Date(patient.dateOfBirth).toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `${patient.lastName}, ${patient.firstName} · ${patient.nhi} · DOB ${dob}`;
}

export function CaseCreateForm({
  patients,
  assignees,
  documentsEnabled,
}: {
  patients: PatientOption[];
  assignees: AssigneeOption[];
  documentsEnabled: boolean;
}) {
  const router = useRouter();
  const [patientSearch, setPatientSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSubmitTarget, setActiveSubmitTarget] = useState<"case" | "documents">("case");
  const [form, setForm] = useState({
    patientId: "",
    serviceLine: "COLPOSCOPY",
    receivedAt: toDateTimeLocalValue(new Date()),
    referralSource: SERVICE_DEFAULTS.COLPOSCOPY.referralSource,
    externalCaseId: "",
    referralReason: "",
    currentPriority: "",
    currentCategory: "",
    assignedToUserId: "",
    highSuspicionCancer: false,
    smoOnly: false,
    regradeOfCaseId: "",
    triageNotes: SERVICE_DEFAULTS.COLPOSCOPY.triageNotes,
    // Colposcopy-specific fields
    fctStatus: "",
    hpvTestResult: "",
    hpvType: "",
    cytologySample: "",
    referrerReasonCode: "",
    assessmentOfReferral: "",
    bookingPriorityNote: "",
    referralType: "",
    ovestinInstruction: "",
    ncsrNoteAdded: false,
    referralNoteAdded: false,
    internalTriageNotes: "",
    // Gynaecology-specific fields
    gynaecologyCategory: "",
    ussAvailable: false,
    ussFindings: "",
  });

  const selectedServiceDefaults = SERVICE_DEFAULTS[form.serviceLine as keyof typeof SERVICE_DEFAULTS];
  const filteredPatients = patients.filter((patient) => {
    if (!patientSearch.trim()) {
      return true;
    }

    const query = patientSearch.trim().toLowerCase();
    return (
      patient.nhi.toLowerCase().includes(query) ||
      patient.firstName.toLowerCase().includes(query) ||
      patient.lastName.toLowerCase().includes(query) ||
      patient.gpPractice?.name.toLowerCase().includes(query)
    );
  });
  const filteredAssignees = assignees.filter((assignee) =>
    selectedServiceDefaults.assigneeRoles.includes(assignee.role)
  );

  function setField(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function applyServiceDefaults(nextServiceLine: "COLPOSCOPY" | "GYNAECOLOGY") {
    const previousDefaults = SERVICE_DEFAULTS[form.serviceLine as keyof typeof SERVICE_DEFAULTS];
    const nextDefaults = SERVICE_DEFAULTS[nextServiceLine];

    setForm((current) => ({
      ...current,
      serviceLine: nextServiceLine,
      referralSource:
        !current.referralSource ||
        current.referralSource === previousDefaults.referralSource
          ? nextDefaults.referralSource
          : current.referralSource,
      triageNotes:
        !current.triageNotes ||
        current.triageNotes === previousDefaults.triageNotes
          ? nextDefaults.triageNotes
          : current.triageNotes,
      assignedToUserId:
        assignees.some(
          (assignee) =>
            assignee.id === current.assignedToUserId &&
            nextDefaults.assigneeRoles.includes(assignee.role)
        )
          ? current.assignedToUserId
          : "",
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!form.patientId) {
      setError("Patient selection is required.");
      return;
    }

    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter as HTMLButtonElement | null;
    const submitTarget =
      submitter?.value === "documents" ? "documents" : "case";
    setActiveSubmitTarget(submitTarget);
    setLoading(true);

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          currentPriority: form.currentPriority || undefined,
          currentCategory: form.currentCategory || undefined,
          assignedToUserId: form.assignedToUserId || undefined,
          externalCaseId: form.externalCaseId || undefined,
          referralReason: form.referralReason || undefined,
          referralSource: form.referralSource || undefined,
          regradeOfCaseId: form.regradeOfCaseId || undefined,
          receivedAt: form.receivedAt ? new Date(form.receivedAt).toISOString() : undefined,
          // Colposcopy-specific — only send if COLPOSCOPY
          fctStatus: form.serviceLine === "COLPOSCOPY" && form.fctStatus ? form.fctStatus : undefined,
          hpvTestResult: form.serviceLine === "COLPOSCOPY" && form.hpvTestResult ? form.hpvTestResult : undefined,
          hpvType: form.serviceLine === "COLPOSCOPY" && form.hpvType ? form.hpvType : undefined,
          cytologySample: form.serviceLine === "COLPOSCOPY" && form.cytologySample ? form.cytologySample : undefined,
          referrerReasonCode: form.serviceLine === "COLPOSCOPY" && form.referrerReasonCode ? form.referrerReasonCode : undefined,
          assessmentOfReferral: form.serviceLine === "COLPOSCOPY" && form.assessmentOfReferral ? form.assessmentOfReferral : undefined,
          bookingPriorityNote: form.serviceLine === "COLPOSCOPY" && form.bookingPriorityNote ? form.bookingPriorityNote : undefined,
          referralType: form.serviceLine === "COLPOSCOPY" && form.referralType ? form.referralType : undefined,
          ovestinInstruction: form.serviceLine === "COLPOSCOPY" && form.ovestinInstruction ? form.ovestinInstruction : undefined,
          ncsrNoteAdded: form.serviceLine === "COLPOSCOPY" ? form.ncsrNoteAdded || undefined : undefined,
          referralNoteAdded: form.serviceLine === "COLPOSCOPY" ? form.referralNoteAdded || undefined : undefined,
          internalTriageNotes: form.internalTriageNotes || undefined,
          // Gynaecology-specific — only send if GYNAECOLOGY
          gynaecologyCategory: form.serviceLine === "GYNAECOLOGY" && form.gynaecologyCategory ? form.gynaecologyCategory : undefined,
          ussAvailable: form.serviceLine === "GYNAECOLOGY" ? form.ussAvailable || undefined : undefined,
          ussFindings: form.serviceLine === "GYNAECOLOGY" && form.ussFindings ? form.ussFindings : undefined,
        }),
      });

      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? "Unable to create referral case");
      }

      router.push(
        submitTarget === "documents" && documentsEnabled
          ? `/cases/${payload.id}/documents`
          : `/cases/${payload.id}`
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create referral case"
      );
    } finally {
      setLoading(false);
      setActiveSubmitTarget("case");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Referral Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Service line"
              value={form.serviceLine}
              onChange={(event) =>
                applyServiceDefaults(event.target.value as "COLPOSCOPY" | "GYNAECOLOGY")
              }
              options={[
                { value: "COLPOSCOPY", label: "Colposcopy" },
                { value: "GYNAECOLOGY", label: "Gynaecology" },
              ]}
            />
            <Input
              label="Received at"
              type="datetime-local"
              value={form.receivedAt}
              onChange={(event) => setField("receivedAt", event.target.value)}
              required
            />
          </div>

          <Input
            label="Patient search"
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.target.value)}
            placeholder="Search by NHI, first name, last name, or practice"
            hint={`Showing ${filteredPatients.length} of ${patients.length} active patients loaded into the intake form.`}
          />

          <Select
            label="Patient"
            value={form.patientId}
            onChange={(event) => setField("patientId", event.target.value)}
            placeholder="Select patient"
            options={filteredPatients.map((patient) => ({
              value: patient.id,
              label: formatPatientLabel(patient),
            }))}
          />

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <span>Patient missing from the register?</span>
            <Link href="/patients/new" className="font-medium text-brand-600 hover:text-brand-700">
              Register new patient
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Referral source"
              value={form.referralSource}
              onChange={(event) => setField("referralSource", event.target.value)}
              placeholder={selectedServiceDefaults.referralSource}
            />
            <Input
              label="External case id"
              value={form.externalCaseId}
              onChange={(event) => setField("externalCaseId", event.target.value)}
              placeholder="Optional source-system identifier"
            />
          </div>

          <Input
            label="Referral reason"
            value={form.referralReason}
            onChange={(event) => setField("referralReason", event.target.value)}
            placeholder={selectedServiceDefaults.referralReasonHint}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Triage Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select
              label="Initial priority"
              value={form.currentPriority}
              onChange={(event) => setField("currentPriority", event.target.value)}
              options={priorityOptions}
            />
            <Input
              label="Category"
              value={form.currentCategory}
              onChange={(event) => setField("currentCategory", event.target.value)}
              placeholder={selectedServiceDefaults.categoryHint}
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
              label="Regrade of case id"
              value={form.regradeOfCaseId}
              onChange={(event) => setField("regradeOfCaseId", event.target.value)}
              placeholder="Optional existing case id"
              hint="Use when an updated referral should reopen or supersede an existing waiting-list case."
            />
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Service-specific assignee options are filtered automatically from the available clinician and coordinator roles.
            </div>
          </div>

          <Textarea
            label="Triage notes"
            rows={5}
            value={form.triageNotes}
            onChange={(event) => setField("triageNotes", event.target.value)}
            placeholder={selectedServiceDefaults.triageNotes}
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
                  Marks the case for urgent escalation in the deterministic grading flow.
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
                  Use when the referral should be held for senior medical officer review.
                </span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* ─── Colposcopy-Specific Triage Fields ─────────────────────────────── */}
      {form.serviceLine === "COLPOSCOPY" && (
        <Card>
          <CardHeader>
            <CardTitle>Colposcopy Triage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                Faster Cancer Treatment (FCT)
              </label>
              <div className="flex flex-wrap gap-4">
                {[
                  { value: "", label: "Clear" },
                  { value: "confirmed_cancer", label: "Confirmed cancer at grading" },
                  { value: "high_suspicion", label: "High suspicion of cancer at grading" },
                  { value: "no_low_suspicion", label: "No/Low suspicion of cancer at grading" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="radio"
                      name="fctStatus"
                      value={opt.value}
                      checked={form.fctStatus === opt.value}
                      onChange={(e) => setField("fctStatus", e.target.value)}
                      className="h-4 w-4 border-border-strong text-success"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Select
                label="1. HPV test"
                value={form.hpvTestResult}
                onChange={(e) => setField("hpvTestResult", e.target.value)}
                options={[
                  { value: "", label: "Select HPV test result" },
                  { value: "not_detected", label: "HPV not detected" },
                  { value: "hpv_16_18", label: "HPV 16/18 detected" },
                  { value: "hpv_other", label: "HPV other detected" },
                  { value: "inadequate", label: "Inadequate" },
                ]}
              />
              <Select
                label="2. Type (HPV)"
                value={form.hpvType}
                onChange={(e) => setField("hpvType", e.target.value)}
                options={[
                  { value: "", label: "Select type" },
                  { value: "primary_screening", label: "Primary screening" },
                  { value: "post_treatment", label: "Post-treatment assessment" },
                  { value: "surveillance", label: "HPV surveillance" },
                  { value: "triage", label: "Triage referral" },
                  { value: "other", label: "Other" },
                ]}
              />
              <Select
                label="3. Cytology sample"
                value={form.cytologySample}
                onChange={(e) => setField("cytologySample", e.target.value)}
                options={[
                  { value: "", label: "Select cytology" },
                  { value: "negative", label: "Negative / Normal" },
                  { value: "asc_us", label: "ASC-US" },
                  { value: "lsil", label: "LSIL" },
                  { value: "asc_h", label: "ASC-H" },
                  { value: "hsil", label: "HSIL" },
                  { value: "scc", label: "SCC (Suspicious/definite cancer)" },
                  { value: "glandular", label: "Glandular abnormality" },
                  { value: "borderline", label: "Borderline" },
                  { value: "unsatisfactory", label: "Unsatisfactory" },
                ]}
              />
            </div>

            <Select
              label="4. Referrer's reason for referral"
              value={form.referrerReasonCode}
              onChange={(e) => setField("referrerReasonCode", e.target.value)}
              options={[
                { value: "", label: "Select reason" },
                { value: "hpv_primary", label: "HPV detected — primary screening" },
                { value: "hpv_post_treatment", label: "HPV detected — post-treatment assessment" },
                { value: "hpv_surveillance", label: "HPV detected — surveillance" },
                { value: "abnormal_appearance", label: "Abnormal cervical appearance" },
                { value: "symptomatic", label: "Symptomatic with co-test results" },
                { value: "endorsed_colposcopy", label: "Endorsed referred on colposcopy" },
                { value: "other", label: "Other" },
              ]}
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                Genotype(s) (if HPV Detected)
              </label>
              <div className="flex flex-wrap gap-4">
                {[
                  { value: "hpv_16", label: "HPV 16" },
                  { value: "hpv_18", label: "HPV 18" },
                  { value: "not_applicable", label: "Not applicable" },
                  { value: "oncogenic_not_16_18", label: "Oncogenic (not 16/18)" },
                  { value: "other", label: "Other (specify in Triage Notes)" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border-strong text-success"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Select
                label="5. Assessment of referral"
                value={form.assessmentOfReferral}
                onChange={(e) => setField("assessmentOfReferral", e.target.value)}
                options={[
                  { value: "", label: "Select assessment" },
                  { value: "appropriate", label: "Appropriate" },
                  { value: "inappropriate", label: "Inappropriate" },
                  { value: "incomplete", label: "Incomplete information" },
                  { value: "urgent", label: "Urgent" },
                ]}
              />
              <Input
                label="6. Booking priority"
                value={form.bookingPriorityNote}
                onChange={(e) => setField("bookingPriorityNote", e.target.value)}
                placeholder="e.g. 10 days, 30 days, 3 months"
              />
              <Select
                label="7. Type"
                value={form.referralType}
                onChange={(e) => setField("referralType", e.target.value)}
                options={[
                  { value: "", label: "Select type" },
                  { value: "new", label: "New referral" },
                  { value: "re_referral", label: "Re-referral" },
                  { value: "follow_up", label: "Follow-up" },
                  { value: "toc", label: "Test of cure" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                Ovestin (i.e. if amenorrhoeic from B/Feeding/Depo, &gt;50yo, post-menopausal)
              </label>
              <div className="space-y-2">
                {[
                  { value: "", label: "No" },
                  { value: "contraindicated", label: "Contraindicated (i.e. Hormone positive BCA)" },
                  { value: "2_nights", label: "Prescribe Vaginal Ovestin Cream nightly, omitting 2 nights prior to clinic visit" },
                  { value: "3_weeks", label: "Prescribe Vaginal Ovestin Cream nightly for 3 weeks followed by twice a week, omitting 2 nights prior to clinic visit" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <input
                      type="radio"
                      name="ovestinInstruction"
                      value={opt.value}
                      checked={form.ovestinInstruction === opt.value}
                      onChange={(e) => setField("ovestinInstruction", e.target.value)}
                      className="mt-0.5 h-4 w-4 border-border-strong text-success"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                Referral notes and NCSR Notes
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.ncsrNoteAdded}
                    onChange={(e) => setField("ncsrNoteAdded", e.target.checked)}
                    className="h-4 w-4 rounded border-border-strong text-success"
                  />
                  NCSR Note added (will be published in Whaihua/Register)
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.referralNoteAdded}
                    onChange={(e) => setField("referralNoteAdded", e.target.checked)}
                    className="h-4 w-4 rounded border-border-strong text-success"
                  />
                  Referral Note added (for internal communication)
                </label>
              </div>
            </div>

            <Textarea
              label="Triage Notes (Internal)"
              rows={3}
              value={form.internalTriageNotes}
              onChange={(e) => setField("internalTriageNotes", e.target.value)}
              placeholder="Internal triage notes..."
            />
          </CardContent>
        </Card>
      )}

      {/* ─── Gynaecology-Specific Triage Fields ──────────────────────────────── */}
      {form.serviceLine === "GYNAECOLOGY" && (
        <Card>
          <CardHeader>
            <CardTitle>Gynaecology Triage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Condition category"
              value={form.gynaecologyCategory}
              onChange={(e) => setField("gynaecologyCategory", e.target.value)}
              options={[
                { value: "", label: "Select condition" },
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.ussAvailable}
                    onChange={(e) => setField("ussAvailable", e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border-strong"
                  />
                  <span>
                    <span className="block font-semibold">Pelvic ultrasound available</span>
                    <span className="block text-xs text-muted-foreground mt-1">
                      Many gynaecology categories require USS before grading. Mark if the referral includes ultrasound results.
                    </span>
                  </span>
                </label>
              </div>
              <Input
                label="USS findings"
                value={form.ussFindings}
                onChange={(e) => setField("ussFindings", e.target.value)}
                placeholder="e.g. ET 12mm, fibroid 4cm, simple cyst 3cm"
                hint="Key ultrasound findings relevant to grading"
              />
            </div>

            <Textarea
              label="Internal notes"
              rows={3}
              value={form.internalTriageNotes}
              onChange={(e) => setField("internalTriageNotes", e.target.value)}
              placeholder="Internal triage notes for grading..."
            />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          value="case"
          loading={loading && activeSubmitTarget === "case"}
        >
          Create referral case
        </Button>
        {documentsEnabled && (
          <Button
            type="submit"
            variant="secondary"
            value="documents"
            loading={loading && activeSubmitTarget === "documents"}
          >
            Create and add documents
          </Button>
        )}
        <Link href="/cases">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
