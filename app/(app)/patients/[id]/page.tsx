import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge, PriorityBadge, Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime, calculateAge, getFigureLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { PageIntro } from "@/components/layout/PageIntro";
import {
  User, Calendar, Phone, Mail, Building2, GitBranch,
  AlertTriangle, Shield, Clock, Activity, ArrowLeft,
  Microscope, ClipboardList
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
    URGENT: "bg-destructive",
    HIGH:   "bg-warn",
    MEDIUM: "bg-info",
    LOW:    "bg-success",
  };

  const initials = `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageIntro
        eyebrow={`NHI: ${patient.nhi} · ${age} years · DOB: ${formatDate(patient.dateOfBirth)}`}
        title={`${patient.firstName} ${patient.lastName}`}
        breadcrumb={[{ label: "Patients", href: "/patients" }, { label: `${patient.firstName} ${patient.lastName}` }]}
        actions={[
          { href: `/gp?nhi=${patient.nhi}`, label: "Enter Results", variant: "outline", icon: <Activity className="h-4 w-4" /> },
          { href: "/pathway", label: "Start New Assessment", icon: <GitBranch className="h-4 w-4" /> },
        ]}
      />

      {/* Recall alert */}
      {nextRecall && (
        <div className={cn(
          "flex items-start gap-3 px-4 py-3.5 rounded-xl border",
          isRecallOverdue
            ? "bg-destructive/5 border-destructive/30"
            : "bg-warn/5 border-warn/30"
        )}>
          <div className={cn(
            "p-1.5 rounded-lg flex-shrink-0",
            isRecallOverdue ? "bg-destructive/10" : "bg-warn/10"
          )}>
            {isRecallOverdue
              ? <AlertTriangle className="h-4 w-4 text-destructive" />
              : <Calendar className="h-4 w-4 text-warn" />
            }
          </div>
          <div>
            <p className={cn("text-sm font-semibold", isRecallOverdue ? "text-destructive" : "text-foreground")}>
              {isRecallOverdue ? "Recall Overdue" : "Next Screening Due"}
            </p>
            <p className={cn("text-xs mt-0.5", isRecallOverdue ? "text-destructive" : "text-warn")}>
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
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date of Birth</p>
                  <p className="font-medium text-foreground mt-0.5">{formatDate(patient.dateOfBirth)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Age</p>
                  <p className="font-medium text-foreground mt-0.5">{age} years</p>
                </div>
              </div>
              {patient.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate">{patient.email}</span>
                </div>
              )}
              {patient.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">{patient.phone}</span>
                </div>
              )}
              {patient.gpPractice && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">{patient.gpPractice.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border",
                  patient.status === "ACTIVE"
                    ? "bg-success/5 text-foreground border-success/30"
                    : "bg-muted text-muted-foreground border-border"
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", patient.status === "ACTIVE" ? "bg-success/50" : "bg-muted-foreground/40")} />
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
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-info/5 border border-info/30">
                  <span className="text-xs font-medium text-foreground">HPV Transition Patient</span>
                  <span className="text-[10px] text-muted-foreground">Transition pathway</span>
                </div>
              )}
              {patient.isPostHysterectomy && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-brand-50/40 border border-brand-200">
                  <span className="text-xs font-medium text-foreground">Post-Hysterectomy</span>
                  <span className="text-[10px] text-muted-foreground">Post-hysterectomy pathway</span>
                </div>
              )}
              {patient.medicalHistory?.atypicalEndometrialHistory && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5 border border-destructive/30">
                  <span className="text-xs font-medium text-destructive">Atypical Endometrial History</span>
                  <span className="text-[10px] text-destructive">→ Gynaecology</span>
                </div>
              )}
              {patient.medicalHistory?.immunocompromised && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-warn/5 border border-warn/30">
                  <span className="text-xs font-medium text-foreground">Immunocompromised</span>
                  <span className="text-[10px] text-warn">3y recall</span>
                </div>
              )}
              {!patient.isFirstTimeHPVTransition && !patient.isPostHysterectomy &&
                !patient.medicalHistory?.atypicalEndometrialHistory && !patient.medicalHistory?.immunocompromised && (
                  <p className="text-xs text-muted-foreground py-2">No special clinical flags</p>
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
                    <span className="text-sm text-muted-foreground">Risk Level</span>
                    <RiskBadge risk={latestSession.currentRiskLevel} />
                  </div>
                )}
                {latestSession.activeModule && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Active Pathway</p>
                    <p className="text-sm font-semibold text-navy-600">
                      {getFigureLabel(latestSession.activeModule)}
                    </p>
                  </div>
                )}
                {latestSession.recommendation && (
                  <div className="bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-mono text-brand-600 mb-0.5">{latestSession.recommendationCode}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{latestSession.recommendation}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
                  <div>
                    <p className="text-lg font-bold text-foreground">{latestSession.consecutiveNegativeCoTestCount}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Consec. Neg.</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{latestSession.consecutiveLowGradeCount}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Low Grade</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{latestSession.unsatisfactoryCytologyCount}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Unsat. Cyt.</p>
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
              <span className="text-xs text-muted-foreground">{patient.screeningSessions.length} session{patient.screeningSessions.length !== 1 ? "s" : ""}</span>
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
                  <div className="absolute left-10 top-4 bottom-4 w-0.5 bg-muted" aria-hidden />
                  <div className="divide-y divide-border">
                    {patient.screeningSessions.map((session, idx) => {
                      const latestResult = session.testResults[0];
                      const referral = session.referrals[0];
                      const dotColor = riskDotColors[session.currentRiskLevel ?? ""] ?? "bg-muted-foreground/30";
                      return (
                        <div key={session.id} className="relative px-6 py-5 hover:bg-muted/40 transition-colors">
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
                                <p className="text-sm font-semibold text-foreground">
                                  Session #{patient.screeningSessions.length - idx}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
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
                                <p className="text-xs text-muted-foreground leading-relaxed">{session.recommendation}</p>
                              </div>
                            )}

                            {/* Test results chips */}
                            {latestResult && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {latestResult.hpvResult && (
                                  <span className={cn(
                                    "text-xs px-2 py-1 rounded-md font-medium",
                                    latestResult.hpvResult === "HPV_16_18"
                                      ? "bg-destructive/10 text-destructive"
                                      : latestResult.hpvResult === "HPV_OTHER"
                                      ? "bg-warn/10 text-warn"
                                      : "bg-success/10 text-success"
                                  )}>
                                    HPV: {latestResult.hpvResult.replace(/_/g, " ")}
                                  </span>
                                )}
                                {latestResult.cytologyResult && (
                                  <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground font-mono">
                                    Cyt: {latestResult.cytologyResult}
                                  </span>
                                )}
                                {latestResult.tzType && (
                                  <span className="text-xs px-2 py-1 rounded-md bg-brand-50/40 text-muted-foreground border border-brand-200">
                                    TZ {latestResult.tzType}
                                  </span>
                                )}
                                {latestResult.sampleType && latestResult.sampleType === "SWAB" && (
                                  <span className="text-xs px-2 py-1 rounded-md bg-warn/5 text-warn border border-warn/30 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    SWAB
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Referral */}
                            {referral && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Referral:</span>
                                <PriorityBadge priority={referral.priority} />
                                <span className="text-xs text-muted-foreground">{referral.type}</span>
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
