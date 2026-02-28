"use client";
import { getFigureLabel, getRiskBg, getRiskIcon } from "@/lib/utils";
import type { PathwayFigure, RiskLevel } from "@/lib/engine/types";

interface PathwayIndicatorProps {
  figure?: PathwayFigure | string;
  riskLevel?: RiskLevel | string;
  step?: string;
}

export function PathwayIndicator({ figure, riskLevel, step }: PathwayIndicatorProps) {
  if (!figure) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      {/* Pathway name */}
      <div className="flex items-center gap-3">
        <div className="w-2 h-8 rounded-full bg-[#0D9488]" aria-hidden="true" />
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            Current Pathway
          </p>
          <p className="text-sm font-semibold text-[#1E3A5F]">
            {getFigureLabel(figure)}
          </p>
          {step && <p className="text-xs text-gray-400 mt-0.5">{step}</p>}
        </div>
      </div>

      {/* Risk level */}
      {riskLevel && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${getRiskBg(riskLevel)}`}
          role="status"
          aria-label={`Risk level: ${riskLevel}`}
        >
          <span aria-hidden="true">{getRiskIcon(riskLevel)}</span>
          <span>{riskLevel}</span>
        </div>
      )}
    </div>
  );
}

// Risk legend (for UI reference)
export function RiskLegend() {
  const items = [
    { level: "LOW", icon: "●", label: "Low Risk", colour: "text-green-600", bg: "bg-green-100" },
    { level: "MEDIUM", icon: "▲", label: "Medium Risk", colour: "text-amber-600", bg: "bg-amber-100" },
    { level: "HIGH", icon: "■", label: "High Risk", colour: "text-purple-600", bg: "bg-purple-100" },
    { level: "URGENT", icon: "⚠", label: "Urgent", colour: "text-red-600", bg: "bg-red-100" },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div
          key={item.level}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.bg} ${item.colour}`}
          role="note"
          aria-label={item.label}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
