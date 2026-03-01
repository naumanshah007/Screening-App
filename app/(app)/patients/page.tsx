"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, calculateAge } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Users, Search, Plus, ChevronRight, Activity } from "lucide-react";

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
  const [hasSearched, setHasSearched] = useState(false);

  const loadPatients = useCallback(async (query: string) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=50`);
      const data = await res.json();
      setPatients(data.patients ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length >= 2) loadPatients(search);
      else if (search.length === 0) {
        loadPatients("");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, loadPatients]);

  // Load initial list
  useEffect(() => {
    loadPatients("");
  }, [loadPatients]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Patients</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total > 0 ? `${total} patients on cervical screening register` : "Cervical screening register"}
          </p>
        </div>
        <Link href="/patients/new">
          <Button size="md">
            <Plus className="h-4 w-4" />
            Register Patient
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Input
        label="Search patients"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by NHI, first name, or last name…"
        hint="Type at least 2 characters to search. Results update as you type."
        icon={<Search className="h-4 w-4" />}
      />

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-brand-600 animate-spin" />
        </div>
      ) : !hasSearched || patients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search && hasSearched ? "No patients found" : "Search the register"}
          description={
            search && hasSearched
              ? `No patients match "${search}". Check the spelling or try an NHI number.`
              : "Enter a name or NHI number to find a patient."
          }
          action={
            search && hasSearched
              ? { label: "Register new patient", onClick: () => window.location.href = "/patients/new" }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {patients.map((p, i) => (
            <div key={p.id} className="animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
            <Link href={`/patients/${p.id}`}>
              <Card
                className="hover:border-brand-300 hover:shadow-md transition-all duration-150"
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-navy-600/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-navy-600 font-semibold text-sm">
                        {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                      </span>
                    </div>
                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">
                          {p.firstName} {p.lastName}
                        </p>
                        {p.isFirstTimeHPVTransition && (
                          <Badge variant="info" size="sm">Transition</Badge>
                        )}
                        {p.isPostHysterectomy && (
                          <Badge variant="medium" size="sm">Post-hyst</Badge>
                        )}
                        {p.status !== "ACTIVE" && (
                          <Badge variant="default" size="sm">{p.status}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                        <span className="font-mono">NHI: {p.nhi}</span>
                        <span>·</span>
                        <span>{calculateAge(p.dateOfBirth)}y</span>
                        <span>·</span>
                        <span>DOB: {formatDate(p.dateOfBirth)}</span>
                        {p.gpPractice && (
                          <>
                            <span>·</span>
                            <span>{p.gpPractice.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Sessions + arrow */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Activity className="h-3.5 w-3.5" />
                        {p._count.screeningSessions} session{p._count.screeningSessions !== 1 ? "s" : ""}
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
