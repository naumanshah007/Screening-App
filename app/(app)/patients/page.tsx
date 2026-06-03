"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/layout/PageIntro";
import { formatDate, calculateAge } from "@/lib/utils";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
import Link from "next/link";
import { Users, Search, Plus, ChevronRight, Activity, Copy } from "lucide-react";

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

function PatientRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function NHICopy({ nhi }: { nhi: string }) {
  const { copy, copied } = useCopyToClipboard("NHI copied");
  return (
    <button
      onClick={(e) => { e.preventDefault(); copy(nhi); }}
      className="flex items-center gap-1 font-mono hover:text-foreground transition-colors group"
      aria-label={`Copy NHI ${nhi}`}
      title="Copy NHI"
    >
      <span>NHI: {nhi}</span>
      <Copy className={`h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ${copied ? "text-success" : ""}`} aria-hidden />
    </button>
  );
}

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadPatients = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=50`);
      const data = await res.json();
      setPatients(data.patients ?? []);
      setTotal(data.total ?? 0);
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients("");
  }, [loadPatients]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length >= 2 || search.length === 0) loadPatients(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, loadPatients]);

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
      <div className="page-aura">
        <PageIntro
          eyebrow="Legacy tools"
          title="Patients"
          description={hasLoaded ? `${total.toLocaleString()} patients on the cervical screening register.` : "Cervical screening register"}
          actions={[{ href: "/patients/new", label: "Register patient", icon: <Plus className="h-4 w-4" /> }]}
        />
      </div>

      <Input
        label="Search patients"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="NHI, first name, or last name…"
        hint="Results update as you type. Search requires at least 2 characters."
        icon={<Search className="h-4 w-4" />}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <PatientRowSkeleton key={i} />)}
        </div>
      ) : patients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No patients found" : "Search the register"}
          description={
            search
              ? `No patients match "${search}". Try an NHI number or check the spelling.`
              : "Enter a name or NHI number to find a patient record."
          }
          action={search ? { href: "/patients/new", label: "Register new patient", variant: "outline" } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {patients.map((p, i) => (
            <div key={p.id} className="animate-fade-in" style={{ animationDelay: `${i * 15}ms` }}>
              <Link href={`/patients/${p.id}`}>
                <Card className="hover-lift hover:border-border-strong">
                  <CardContent className="py-3.5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-50 to-navy-600/10 ring-1 ring-border/60 flex items-center justify-center flex-shrink-0">
                        <span className="text-navy-700 font-semibold text-sm">
                          {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-foreground">{p.firstName} {p.lastName}</p>
                          {p.isFirstTimeHPVTransition && <Badge variant="info" size="sm">HPV Transition</Badge>}
                          {p.isPostHysterectomy && <Badge variant="medium" size="sm">Post-hyst</Badge>}
                          {p.status !== "ACTIVE" && <Badge variant="default" size="sm">{p.status}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <NHICopy nhi={p.nhi} />
                          <span aria-hidden>·</span>
                          <span>{calculateAge(p.dateOfBirth)}y</span>
                          <span aria-hidden>·</span>
                          <span>DOB {formatDate(p.dateOfBirth)}</span>
                          {p.gpPractice && <><span aria-hidden>·</span><span>{p.gpPractice.name}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Activity className="h-3.5 w-3.5" aria-hidden />
                          {p._count.screeningSessions} {p._count.screeningSessions === 1 ? "session" : "sessions"}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
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
