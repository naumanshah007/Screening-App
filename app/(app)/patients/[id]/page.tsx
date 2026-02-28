import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge, PriorityBadge, Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, calculateAge, getFigureLabel } from "@/lib/utils";
import Link from "next/link";

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center">
              <span className="text-[#1E3A5F] font-bold">
                {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1E3A5F]">
                {patient.firstName} {patient.lastName}
              </h1>
              <p className="text-sm text-gray-500 font-mono">NHI: {patient.nhi}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/gp?nhi=${patient.nhi}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D9488] text-white rounded-lg text-sm font-medium hover:bg-[#0b7a6f]"
          >
            ✦ Enter Results
          </Link>
        </div>
      </div>

      {/* Next screening due alert */}
      {nextRecall && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            new Date(nextRecall.dueDate) < new Date()
              ? "bg-red-50 border-red-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <span className="text-lg" aria-hidden="true">
            {new Date(nextRecall.dueDate) < new Date() ? "⚠" : "📅"}
          </span>
          <div>
            <p className={`text-sm font-semibold ${
              new Date(nextRecall.dueDate) < new Date() ? "text-red-800" : "text-amber-800"
            }`}>
              {new Date(nextRecall.dueDate) < new Date()
                ? "Recall Overdue"
                : "Next Screening Due"}
            </p>
            <p className={`text-xs ${
              new Date(nextRecall.dueDate) < new Date() ? "text-red-600" : "text-amber-600"
            }`}>
              Due: {formatDate(nextRecall.dueDate)}
              {nextRecall.reason && ` · ${nextRecall.reason}`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: patient details */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Demographics</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-400">Date of Birth</p>
                  <p className="font-medium">{formatDate(patient.dateOfBirth)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Age</p>
                  <p className="font-medium">{calculateAge(patient.dateOfBirth)} years</p>
                </div>
              </div>
              {patient.email && (
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="font-medium">{patient.email}</p>
                </div>
              )}
              {patient.phone && (
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="font-medium">{patient.phone}</p>
                </div>
              )}
              {patient.gpPractice && (
                <div>
                  <p className="text-xs text-gray-400">GP Practice</p>
                  <p className="font-medium">{patient.gpPractice.name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Clinical Flags</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {patient.isFirstTimeHPVTransition && (
                <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-200">
                  <span>HPV Transition Patient</span>
                  <span className="ml-auto text-blue-400">→ Figure 1/2</span>
                </div>
              )}
              {patient.isPostHysterectomy && (
                <div className="flex items-center gap-2 text-xs bg-purple-50 text-purple-700 px-3 py-2 rounded-lg border border-purple-200">
                  <span>Post-Hysterectomy</span>
                  <span className="ml-auto text-purple-400">→ Figure 8/10</span>
                </div>
              )}
              {patient.medicalHistory?.atypicalEndometrialHistory && (
                <div className="flex items-center gap-2 text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg border border-red-200">
                  <span>⚠ Atypical Endometrial History (AG2)</span>
                  <span className="ml-auto text-red-400">→ Gynaecology</span>
                </div>
              )}
              {patient.medicalHistory?.immunocompromised && (
                <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded-lg border border-amber-200">
                  <span>Immunocompromised</span>
                </div>
              )}
              {!patient.isFirstTimeHPVTransition && !patient.isPostHysterectomy &&
                !patient.medicalHistory?.atypicalEndometrialHistory && (
                  <p className="text-xs text-gray-400">No special clinical flags</p>
                )}
            </CardContent>
          </Card>

          {/* Current session status */}
          {latestSession && (
            <Card>
              <CardHeader><CardTitle>Current Status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {latestSession.currentRiskLevel && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Risk Level</span>
                    <RiskBadge risk={latestSession.currentRiskLevel} />
                  </div>
                )}
                {latestSession.activeModule && (
                  <div>
                    <p className="text-xs text-gray-400">Active Pathway</p>
                    <p className="text-sm font-medium text-[#1E3A5F]">
                      {getFigureLabel(latestSession.activeModule)}
                    </p>
                  </div>
                )}
                {latestSession.recommendation && (
                  <div>
                    <p className="text-xs text-gray-400">Recommendation</p>
                    <p className="text-sm text-gray-700">{latestSession.recommendation}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-center text-xs">
                  <div>
                    <p className="font-bold text-[#1E3A5F]">
                      {latestSession.consecutiveNegativeCoTestCount}
                    </p>
                    <p className="text-gray-400">Consec. Neg.</p>
                  </div>
                  <div>
                    <p className="font-bold text-[#1E3A5F]">
                      {latestSession.consecutiveLowGradeCount}
                    </p>
                    <p className="text-gray-400">Low Grade</p>
                  </div>
                  <div>
                    <p className="font-bold text-[#1E3A5F]">
                      {latestSession.unsatisfactoryCytologyCount}
                    </p>
                    <p className="text-gray-400">Unsat. Cyt.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: screening timeline */}
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Screening History Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {patient.screeningSessions.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400">
                  <p className="text-sm">No screening sessions recorded.</p>
                  <Link href={`/gp?nhi=${patient.nhi}`} className="text-[#0D9488] text-sm hover:underline mt-2 inline-block">
                    Enter first results →
                  </Link>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-gray-100" aria-hidden="true" />
                  <div className="space-y-0 divide-y divide-gray-50">
                    {patient.screeningSessions.map((session, idx) => {
                      const latestResult = session.testResults[0];
                      const referral = session.referrals[0];
                      return (
                        <div key={session.id} className="relative px-6 py-5 hover:bg-gray-50">
                          {/* Timeline dot */}
                          <div
                            className={`absolute left-8 top-6 w-4 h-4 rounded-full border-2 border-white z-10 ${
                              session.currentRiskLevel === "URGENT"
                                ? "bg-red-500"
                                : session.currentRiskLevel === "HIGH"
                                ? "bg-purple-500"
                                : session.currentRiskLevel === "MEDIUM"
                                ? "bg-amber-400"
                                : "bg-green-500"
                            }`}
                            aria-hidden="true"
                          />
                          <div className="ml-8">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <div>
                                <p className="text-sm font-semibold text-[#1E3A5F]">
                                  Session #{patient.screeningSessions.length - idx}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {formatDateTime(session.createdAt)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {session.currentRiskLevel && (
                                  <RiskBadge risk={session.currentRiskLevel} />
                                )}
                                {session.activeModule && (
                                  <Badge variant="default">
                                    {session.activeModule.replace("FIGURE_", "Fig ").replace("TABLE_", "Table ")}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {session.recommendation && (
                              <div className="mt-2 bg-[#0D9488]/5 border border-[#0D9488]/15 rounded-lg px-3 py-2">
                                <p className="text-xs font-mono text-[#0D9488]">
                                  {session.recommendationCode}
                                </p>
                                <p className="text-xs text-gray-700 mt-0.5">
                                  {session.recommendation}
                                </p>
                              </div>
                            )}

                            {/* Test results */}
                            {latestResult && (
                              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                                {latestResult.hpvResult && (
                                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                    HPV: {latestResult.hpvResult.replace(/_/g, " ")}
                                  </span>
                                )}
                                {latestResult.cytologyResult && (
                                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono">
                                    Cyt: {latestResult.cytologyResult}
                                  </span>
                                )}
                                {latestResult.tzType && (
                                  <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-200">
                                    TZ {latestResult.tzType}
                                  </span>
                                )}
                                {latestResult.sampleType && (
                                  <span className={`px-2 py-1 rounded ${
                                    latestResult.sampleType === "SWAB"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-gray-100 text-gray-600"
                                  }`}>
                                    {latestResult.sampleType}
                                    {latestResult.sampleType === "SWAB" && " ⚠"}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Referral */}
                            {referral && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-gray-500">Referral:</span>
                                <PriorityBadge priority={referral.priority} />
                                <span className="text-xs text-gray-600">{referral.type}</span>
                                <Badge variant={
                                  referral.status === "COMPLETE" ? "low" :
                                  referral.status === "PENDING" ? "medium" : "default"
                                }>
                                  {referral.status.replace(/_/g, " ")}
                                </Badge>
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
