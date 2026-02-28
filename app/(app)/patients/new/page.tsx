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
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/patients" className="text-sm text-[#0D9488] hover:underline">
          ← Patients
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-500">Register New Patient</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Register New Patient</h1>
        <p className="text-sm text-gray-500 mt-1">Add patient to the cervical screening register</p>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
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
            <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
              <input
                id="transition"
                type="checkbox"
                checked={form.isFirstTimeHPVTransition}
                onChange={(e) => set("isFirstTimeHPVTransition", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-blue-300 text-[#0D9488]"
              />
              <div>
                <label htmlFor="transition" className="text-sm font-medium text-blue-800 cursor-pointer">
                  First-time HPV Transition Patient
                </label>
                <p className="text-xs text-blue-600 mt-0.5">
                  Patient transitioning from cytology-based to HPV-based screening → routes to Figure 1 or 2
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
            <div className="flex items-start gap-3 p-3 rounded-lg border border-purple-200 bg-purple-50">
              <input
                id="posthyst"
                type="checkbox"
                checked={form.isPostHysterectomy}
                onChange={(e) => set("isPostHysterectomy", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-purple-300 text-[#0D9488]"
              />
              <div>
                <label htmlFor="posthyst" className="text-sm font-medium text-purple-800 cursor-pointer">
                  Post-Hysterectomy
                </label>
                <p className="text-xs text-purple-600 mt-0.5">
                  Patient has had a hysterectomy → routes to Figure 8 or 10
                </p>
              </div>
            </div>
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
