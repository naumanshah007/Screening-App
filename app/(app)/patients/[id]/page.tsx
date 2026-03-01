import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge, PriorityBadge, Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime, calculateAge, getFigureLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  User, Calendar, Phone, Mail, Building2, GitBranch,
  AlertTriangle, Shield, Clock, Activity, ArrowLeft,
  ChevronRight, Microscope, ClipboardList
} from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PatientDetailPage({ params }: Props) {
  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      gpPractice: true,
      medicalHistory: true,
      screeningSessions: {
        include: {
          testResults: { orderBy: { testDate: "desc" } },
          colposcopyFindings: true,
          referrals: true,
          pathwayHistory: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      recalls: { orderBy: { dueDate: "asc" }, take: 5 },
    },
  });

  if (!patient) notFound();

  const latestSession = patient.screeningSessions[0];
  const nextRecall = patient.recalls.find((r) => r.status === "PENDING");
  const isRecallOverdue = nextRecall && new Date(nextRecall.dueDate) < new Date();
  const age = calculateAge(patient.dateOfBirth);

  const riskDotColors: Record<string, string> = {
    URGENT: "bg-red-500",
    HIGH:   "bg-amber-500",
    MEDIUM: "bg-violet-500",
    LOW:    "bg-emerald-500",
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/patients">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="w-14 h-14 rounded-2xl bg-navy-600/10 flex items-center justify-center flex-shrink-0">
            <span className="text-navy-600 font-bold text-xl">
              {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {patient.firstName} {patient.lastName}
            </h1>
            <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
              <span className="font-mono">NHI: {patient.nhi}</span>
              <span>·</span>
              <span>{age} years old</span>
              <span>·</span>
              <span>DOB: {formatDate(patient.dateOfBirth)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href={`/gp?nhi=${patient.nhi}`}>
            <Button variant="outline" size="md">
              <Activity className="h-4 w-4" />
              Enter Results
            </Button>
          </Link>
          <Link href="/pathway">
            <Button size="md">
              <GitBranch className="h-4 w-4" />
              Start Pathway
            </Button>
          </Link>
        </div>
      </div>

      {/* Recall alert */}
      {nextRecall && (
        <div className={cn(
          "flex items-start gap-3 px-4 py-3.5 rounded-xl border",
          isRecallOverdue
            ? "bg-red-50 border-red-200"
            : "bg-amber-50 border-amber-200"
        )}>
          <div className={cn(
            "p-1.5 rounded-lg flex-shrink-0",
            isRecallOverdue ? "bg-red-100" : "bg-amber-100"
          )}>
            {isRecallOverdue
              ? <AlertTriangle className="h-4 w-4 text-red-600" />
              : <Calendar className="h-4 w-4 text-amber-600" />
            }
          </div>
          <div>
            <p className={cn("text-sm font-semibold", isRecallOverdue ? "text-red-800" : "text-amber-800")}>
              {isRecallOverdue ? "Recall Overdue" : "Next Screening Due"}
            </p>
            <p className={cn("text-xs mt-0.5", isRecallOverdue ? "text-red-600" : "text-amber-600")}>
              Due: {formatDate(nextRecall.dueDate)}
              {nextRecall.reason && ` · ${nextRecall.reason}`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left sidebar ── */}
        <div className="space-y-4">
          {/* Demographics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4 text-brand-600" />
                Demographics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Date of Birth</p>
                  <p className="font-medium text-slate-900 mt-0.5">{formatDate(patient.dateOfBirth)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Age</p>
                  <p className="font-medium text-slate-900 mt-0.5">{age} years</p>
                </div>
              </div>
              {patient.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-sm truncate">{patient.email}</span>
                </div>
              )}
              {patient.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-sm">{patient.phone}</span>
                </div>
              )}
              {patient.gpPractice && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-sm">{patient.gpPractice.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border",
                  patient.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", patient.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-400")} />
                  {patient.status}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Clinical Flags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-brand-600" />
                Clinical Flags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {patient.isFirstTimeHPVTransition && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50 border border-sky-200">
                  <span className="text-xs font-medium text-sky-800">HPV Transition Patient</span>
                  <span className="text-[10px] text-sky-500">→ Fig 1/2</span>
                </div>
              )}
              {patient.isPostHysterectomy && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-violet-50 border border-violet-200">
                  <span className="text-xs font-medium text-violet-800">Post-Hysterectomy</span>
                  <span className="text-[10px] text-violet-500">→ Fig 8</span>
                </div>
              )}
              {patient.medicalHistory?.atypicalEndometrialHistory && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 border border-red-200">
                  <span className="text-xs font-medium text-red-800">Atypical Endometrial History</span>
                  <span className="text-[10px] text-red-500">→ Gynaecology</span>
                </div>
              )}
              {patient.medicalHistory?.immunocompromised && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-xs font-medium text-amber-800">Immunocompromised</span>
                  <span className="text-[10px] text-amber-500">3y recall</span>
                </div>
              )}
              {!patient.isFirstTimeHPVTransition && !patient.isPostHysterectomy &&
                !patient.medicalHistory?.atypicalEndometrialHistory && !patient.medicalHistory?.immunocompromised && (
                  <p className="text-xs text-slate-400 py-2">No special clinical flags</p>
                )}
            </CardContent>
          </Card>

          {/* Current Status */}
          {latestSession && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-brand-600" />
                  Current Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestSession.currentRiskLevel && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Risk Level</span>
                    <RiskBadge risk={latestSession.currentRiskLevel} />
                  </div>
                )}
                {latestSession.activeModule && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Active Pathway</p>
                    <p className="text-sm font-semibold text-navy-600">
                      {getFigureLabel(latestSession.activeModule)}
                    </p>
                  </div>
                )}
                {latestSession.recommendation && (
                  <div className="bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-mono text-brand-600 mb-0.5">{latestSession.recommendationCode}</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{latestSession.recommendation}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{latestSession.consecutiveNegativeCoTestCount}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">Consec. Neg.</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">{latestSession.consecutiveLowGradeCount}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">Low Grade</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">{latestSession.unsatisfactoryCytologyCount}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">Unsat. Cyt.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: Timeline ── */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-600" />
                Screening History
              </CardTitle>
              <span className="text-xs text-slate-400">{patient.screeningSessions.length} session{patient.screeningSessions.length !== 1 ? "s" : ""}</span>
            </CardHeader>
            <CardContent className="p-0">
              {patient.screeningSessions.length === 0 ? (
                <EmptyState
                  icon={Microscope}
                  title="No screening sessions recorded"
                  description="Enter the first results to start the clinical record."
                  action={{ label: "Enter results", onClick: () => { window.location.href = `/gp?nhi=${patient.nhi}`; } }}
                />
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-10 top-4 bottom-4 w-0.5 bg-slate-100" aria-hidden />
                  <div className="divide-y divide-slate-50">
                    {patient.screeningSessions.map((session, idx) => {
                      const latestResult = session.testResults[0];
                      const referral = session.referrals[0];
                      const dotColor = riskDotColors[session.currentRiskLevel ?? ""] ?? "bg-slate-300";
                      return (
                        <div key={session.id} className="relative px-6 py-5 hover:bg-slate-50/60 transition-colors">
                          {/* Timeline dot */}
                          <div
                            className={cn(
                              "absolute left-[34px] top-7 w-4 h-4 rounded-full border-2 border-white z-10 shadow-sm",
                              dotColor
                            )}
                            aria-hidden
                          />
                          <div className="ml-9">
                            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  Session #{patient.screeningSessions.length - idx}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {formatDateTime(session.createdAt)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {session.currentRiskLevel && (
                                  <RiskBadge risk={session.currentRiskLevel} />
                                )}
                                {session.activeModule && (
                                  <Badge variant="default">
                                    {session.activeModule.replace("FIGURE_", "Fig ").replace("TABLE_", "Tbl ")}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {session.recommendation && (
                              <div className="mb-3 bg-brand-50/60 border border-brand-100 rounded-lg px-3 py-2">
                                <p className="text-[10px] font-mono text-brand-600 mb-0.5">{session.recommendationCode}</p>
                                <p className="text-xs text-slate-700 leading-relaxed">{session.recommendation}</p>
                              </div>
                            )}

                            {/* Test results chips */}
                            {latestResult && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {latestResult.hpvResult && (
                                  <span className={cn(
                                    "text-xs px-2 py-1 rounded-md font-medium",
                                    latestResult.hpvResult === "HPV_16_18"
                                      ? "bg-red-100 text-red-700"
                                      : latestResult.hpvResult === "HPV_OTHER"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  )}>
                                    HPV: {latestResult.hpvResult.replace(/_/g, " ")}
                                  </span>
                                )}
                                {latestResult.cytologyResult && (
                                  <span className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-mono">
                                    Cyt: {latestResult.cytologyResult}
                                  </span>
                                )}
                                {latestResult.tzType && (
                                  <span className="text-xs px-2 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-200">
                                    TZ {latestResult.tzType}
                                  </span>
                                )}
                                {latestResult.sampleType && latestResult.sampleType === "SWAB" && (
                                  <span className="text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    SWAB
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Referral */}
                            {referral && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <ClipboardList className="h-3.5 w-3.5 text-slate-400" />
                                <span className="text-xs text-slate-500">Referral:</span>
                                <PriorityBadge priority={referral.priority} />
                                <span className="text-xs text-slate-600">{referral.type}</span>
                                <StatusBadge status={referral.status} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
