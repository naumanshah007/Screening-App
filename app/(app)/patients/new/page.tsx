"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NewPatientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nhi: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    address: "",
    isFirstTimeHPVTransition: false,
    previousScreeningType: "",
    isPostHysterectomy: false,
    hysterectomyType: "",
    hysterectomyDate: "",
    ethnicityPrimary: "",
    ethnicityOther: "",
    interpreterRequired: false,
    preferredLanguage: "en",
  });

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          nhi: form.nhi.toUpperCase(),
          previousScreeningType: form.previousScreeningType || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to register patient.");
      } else {
        router.push(`/patients/${data.id}`);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-aura p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/patients" className="text-sm text-brand-700 dark:text-brand-300 hover:underline">
          ← Patients
        </Link>
        <span className="text-border-strong">/</span>
        <span className="text-sm text-muted-foreground">Register New Patient</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Register New Patient</h1>
        <p className="text-sm text-muted-foreground mt-1">Add patient to the cervical screening register</p>
      </div>

      {error && (
        <div role="alert" className="bg-destructive/5 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Demographics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="NHI Number"
              value={form.nhi}
              onChange={(e) => set("nhi", e.target.value.toUpperCase())}
              placeholder="e.g. ABC1234"
              required
              hint="National Health Index number — must be unique"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                required
              />
              <Input
                label="Last Name"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                required
              />
            </div>
            <Input
              label="Date of Birth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              required
            />
            <Select
              label="Primary ethnicity"
              value={form.ethnicityPrimary}
              onChange={(e) => set("ethnicityPrimary", e.target.value)}
              required
              placeholder="Select ethnicity…"
              options={[
                { value: "10", label: "European" },
                { value: "21", label: "Māori" },
                { value: "30", label: "Pacific peoples" },
                { value: "40", label: "Asian" },
                { value: "51", label: "Middle Eastern / Latin American / African" },
                { value: "61", label: "Other ethnicity" },
              ]}
              hint="NZ Level 1 prioritised ethnicity code used for equity reporting."
            />
            <Input
              label="Other ethnicity code"
              value={form.ethnicityOther}
              onChange={(e) => set("ethnicityOther", e.target.value)}
              hint="Optional secondary ethnicity code."
            />
            <Select
              label="Preferred language"
              value={form.preferredLanguage}
              onChange={(e) => set("preferredLanguage", e.target.value)}
              options={[
                { value: "en", label: "English" },
                { value: "mi", label: "Te reo Māori" },
                { value: "sm", label: "Samoan" },
                { value: "to", label: "Tongan" },
                { value: "zh", label: "Chinese" },
                { value: "other", label: "Other" },
              ]}
            />
            <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.interpreterRequired}
                onChange={(e) => set("interpreterRequired", e.target.checked)}
                className="h-5 w-5 rounded border-border"
              />
              Interpreter required
            </label>
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
            <Input
              label="Address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Clinical Flags</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* HPV Transition */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-info/30 bg-info/5">
              <input
                id="transition"
                type="checkbox"
                checked={form.isFirstTimeHPVTransition}
                onChange={(e) => set("isFirstTimeHPVTransition", e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-border text-brand-600"
              />
              <div>
                <label htmlFor="transition" className="text-sm font-medium text-foreground cursor-pointer">
                  First-time HPV Transition Patient
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Patient transitioning from cytology-based to HPV-based screening → uses the transition pathway
                </p>
              </div>
            </div>

            {form.isFirstTimeHPVTransition && (
              <Select
                label="Previous Screening Type"
                options={[
                  { value: "CYTOLOGY", label: "Cytology-based" },
                  { value: "HPV", label: "HPV-based" },
                ]}
                value={form.previousScreeningType}
                onChange={(e) => set("previousScreeningType", e.target.value)}
                placeholder="Select previous screening type…"
              />
            )}

            {/* Post-hysterectomy */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-brand-200 bg-brand-50/40">
              <input
                id="posthyst"
                type="checkbox"
                checked={form.isPostHysterectomy}
                onChange={(e) => set("isPostHysterectomy", e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-border text-brand-600"
              />
              <div>
                <label htmlFor="posthyst" className="text-sm font-medium text-foreground cursor-pointer">
                  Post-Hysterectomy
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Patient has had a hysterectomy → uses post-hysterectomy pathway checks
                </p>
              </div>
            </div>
            {form.isPostHysterectomy && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Hysterectomy type"
                  required
                  value={form.hysterectomyType}
                  onChange={(e) => set("hysterectomyType", e.target.value)}
                  placeholder="Select type…"
                  options={[
                    { value: "TOTAL", label: "Total — cervix removed" },
                    { value: "SUBTOTAL", label: "Subtotal — cervix retained" },
                  ]}
                />
                <Input
                  label="Hysterectomy date"
                  type="date"
                  value={form.hysterectomyDate}
                  onChange={(e) => set("hysterectomyDate", e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Link href="/patients">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? "Registering…" : "Register Patient"}
          </Button>
        </div>
      </form>
    </div>
  );
}
