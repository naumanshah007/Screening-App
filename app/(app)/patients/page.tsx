"use client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RiskBadge } from "@/components/ui/badge";
import { formatDate, calculateAge } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Patient {
  id: string;
  nhi: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  status: string;
  isFirstTimeHPVTransition: boolean;
  isPostHysterectomy: boolean;
  gpPractice?: { name: string };
  _count: { screeningSessions: number };
}

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => loadPatients(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function loadPatients() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/patients?search=${encodeURIComponent(search)}&limit=50`
      );
      const data = await res.json();
      setPatients(data.patients ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Patients</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total > 0 ? `${total} patients on register` : "Search cervical screening register"}
          </p>
        </div>
        <Link href="/patients/new">
          <Button size="sm">+ Register Patient</Button>
        </Link>
      </div>

      <Input
        label="Search by NHI or Name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search NHI, first name, or last name…"
        hint="Results update as you type"
      />

      {loading ? (
        <div className="text-center py-12 text-gray-400">Searching…</div>
      ) : patients.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {search ? "No patients found." : "Enter an NHI or name to search."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {patients.map((p) => (
            <Link key={p.id} href={`/patients/${p.id}`}>
              <Card className="hover:border-[#0D9488] transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center">
                        <span className="text-[#1E3A5F] font-semibold text-sm">
                          {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-[#1E3A5F]">
                          {p.firstName} {p.lastName}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span className="font-mono">NHI: {p.nhi}</span>
                          <span>Age {calculateAge(p.dateOfBirth)}</span>
                          <span>DOB: {formatDate(p.dateOfBirth)}</span>
                          {p.gpPractice && <span>{p.gpPractice.name}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.isFirstTimeHPVTransition && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                          Transition
                        </span>
                      )}
                      {p.isPostHysterectomy && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                          Post-hyst
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {p._count.screeningSessions} session{p._count.screeningSessions !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
