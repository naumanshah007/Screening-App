"use client";
import { RiskBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFigureLabel } from "@/lib/utils";
import type { ClinicalDecision } from "@/lib/engine/types";

interface DecisionPanelProps {
  decision: ClinicalDecision | null;
  isPreview?: boolean;
}

export function DecisionPanel({ decision, isPreview = false }: DecisionPanelProps) {
  if (!decision) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-gray-400">
          <p className="text-sm">Enter test results to see clinical decision</p>
        </CardContent>
      </Card>
    );
  }

  const priorityColour: Record<string, string> = {
    P1: "bg-red-50 border-red-200 text-red-800",
    P2: "bg-purple-50 border-purple-200 text-purple-800",
    P3: "bg-amber-50 border-amber-200 text-amber-800",
    P4: "bg-green-50 border-green-200 text-green-800",
  };

  return (
    <div className="space-y-4">
      {isPreview && (
        <div className="text-xs font-semibold text-[#0D9488] uppercase tracking-wider">
          Preview — Decision not yet saved
        </div>
      )}

      {/* Active pathway banner */}
      <div className="bg-[#1E3A5F] text-white rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-blue-200 uppercase tracking-wider">Active Pathway</p>
          <p className="font-semibold text-sm mt-0.5">{getFigureLabel(decision.figure)}</p>
        </div>
        <RiskBadge risk={decision.riskLevel} />
      </div>

      {/* Recommendation */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 font-medium">{decision.recommendation}</p>
          <p className="text-xs text-gray-400 mt-1 font-mono">{decision.recommendationCode}</p>
          {decision.nextAction && (
            <div className="mt-3 bg-[#0D9488]/10 border border-[#0D9488]/20 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-[#0D9488] uppercase tracking-wider">Next Action</p>
              <p className="text-sm text-[#0D9488] mt-0.5">{decision.nextAction}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral details */}
      {decision.referralRequired && (
        <Card>
          <CardHeader>
            <CardTitle>Referral Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded border ${
                  priorityColour[decision.referralPriority ?? "P3"]
                }`}
              >
                {decision.referralPriority}
              </span>
              <span className="text-sm text-gray-700">{decision.referralType}</span>
            </div>
            {decision.referralReason && (
              <p className="text-sm text-gray-600">{decision.referralReason}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recall details */}
      {decision.recallRequired && decision.recallIntervalMonths && (
        <Card>
          <CardHeader>
            <CardTitle>Recall Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              Recall in{" "}
              <strong>
                {decision.recallIntervalMonths >= 12
                  ? `${Math.round(decision.recallIntervalMonths / 12)} year${
                      decision.recallIntervalMonths >= 24 ? "s" : ""
                    }`
                  : `${decision.recallIntervalMonths} months`}
              </strong>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Clinical warnings */}
      {decision.clinicalWarnings && decision.clinicalWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2">
            Clinical Warnings
          </p>
          <ul className="space-y-1">
            {decision.clinicalWarnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                <span>⚠</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Guideline reference */}
      {decision.guidelineReference && (
        <div className="text-xs text-gray-400 border-t pt-3">
          <span className="font-semibold">Guideline: </span>
          {decision.guidelineReference}
        </div>
      )}
    </div>
  );
}
