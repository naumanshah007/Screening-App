"use client";

/**
 * HeroVisual — the floating glass composition that sits in the hero's right
 * column.
 *
 *  Desktop (sm+): a glowing shield core with a rotating conic sweep, orbital
 *  rings with travelling nodes, four corner glass panels, and SVG data-flow
 *  connectors with travelling light pulses from each panel into the core.
 *
 *  Mobile (< sm): NO absolute positioning — a clean centerpiece above a 2×2
 *  grid of the same panels.
 */

import { PrivexaMark } from "./PrivexaMark";
import { Layers, ShieldCheck, Users, FileSearch } from "lucide-react";

type Panel = {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string; // text colour for the icon
};

const PANELS: Panel[] = [
  { icon: Layers, label: "Batch decision support", value: "Provisional · reviewer-gated", accent: "text-cyan-300" },
  { icon: ShieldCheck, label: "Validation preview", value: "Flags bad data first", accent: "text-emerald-300" },
  { icon: Users, label: "Equity by ethnicity", value: "Outcomes made visible", accent: "text-violet-300" },
  { icon: FileSearch, label: "Source-to-decision audit", value: "Every result traceable", accent: "text-sky-300" },
];

function PanelCard({ panel }: { panel: Panel }) {
  const Icon = panel.icon;
  return (
    <div className="glass-panel rounded-2xl p-3.5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
          <Icon className={`h-4 w-4 ${panel.accent}`} />
        </span>
        <span className="text-[13px] font-semibold leading-tight text-white">{panel.label}</span>
      </div>
      <p className="mt-2 text-xs leading-snug text-slate-300">{panel.value}</p>
    </div>
  );
}

function Core({ size = "lg" }: { size?: "lg" | "sm" }) {
  const dim = size === "lg" ? "h-44 w-44" : "h-32 w-32";
  const mark = size === "lg" ? 92 : 68;
  return (
    <div className={`relative grid ${dim} place-items-center`}>
      {/* Ambient glow */}
      <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl animate-glow-pulse" />
      {/* Conic light sweep */}
      <div className="conic-sweep absolute inset-[-14%] rounded-full opacity-60 animate-spin-slow" />
      {/* Glass disc */}
      <div className="glass-panel relative grid h-full w-full place-items-center rounded-full">
        <div className="absolute inset-2 rounded-full border border-white/10" />
        <PrivexaMark size={mark} uid={`core-${size}`} animated />
      </div>
    </div>
  );
}

export function HeroVisual() {
  return (
    <div className="relative w-full">
      {/* ───────── Desktop / tablet: absolute composition ───────── */}
      <div className="relative mx-auto hidden aspect-square w-full max-w-[520px] sm:block">
        {/* Dot-grid backdrop, radially masked */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(rgba(148,163,184,0.35) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(circle at 50% 50%, black 35%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 35%, transparent 72%)",
          }}
          aria-hidden
        />

        {/* Orbital rings */}
        <div className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/10 animate-spin-slow" aria-hidden>
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_3px_rgba(34,211,238,0.7)]" />
        </div>
        <div
          className="absolute left-1/2 top-1/2 h-[55%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
          style={{ animation: "pvxSpin 34s linear infinite reverse" }}
          aria-hidden
        >
          <span className="absolute top-1/2 -right-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-violet-300 shadow-[0_0_10px_3px_rgba(167,139,250,0.7)]" />
        </div>

        {/* Connectors: corner panels → core, with travelling pulses */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="pvx-conn" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#22D3EE" stopOpacity="0.0" />
              <stop offset="0.5" stopColor="#22D3EE" stopOpacity="0.5" />
              <stop offset="1" stopColor="#A78BFA" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {[
            { id: "c1", d: "M20,20 C32,32 38,40 50,50" },
            { id: "c2", d: "M80,20 C68,32 62,40 50,50" },
            { id: "c3", d: "M20,80 C32,68 38,60 50,50" },
            { id: "c4", d: "M80,80 C68,68 62,60 50,50" },
          ].map((p) => (
            <g key={p.id}>
              <path
                id={p.id}
                d={p.d}
                fill="none"
                stroke="url(#pvx-conn)"
                strokeWidth="0.6"
                strokeDasharray="2 3"
                className="animate-dash"
              />
              <circle r="0.9" fill="#A5F3FC">
                <animateMotion dur="3.4s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                  <mpath href={`#${p.id}`} />
                </animateMotion>
                <animate attributeName="opacity" values="0;1;1;0" dur="3.4s" repeatCount="indefinite" />
              </circle>
            </g>
          ))}
        </svg>

        {/* Centerpiece */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Core size="lg" />
        </div>

        {/* Four corner panels */}
        <div className="absolute left-0 top-2 w-[44%] animate-float-slow">
          <PanelCard panel={PANELS[0]} />
        </div>
        <div className="absolute right-0 top-2 w-[44%] animate-float-slower">
          <PanelCard panel={PANELS[1]} />
        </div>
        <div className="absolute bottom-2 left-0 w-[44%] animate-float-slower">
          <PanelCard panel={PANELS[2]} />
        </div>
        <div className="absolute bottom-2 right-0 w-[44%] animate-float-slow">
          <PanelCard panel={PANELS[3]} />
        </div>

        {/* Platform base + reflection */}
        <div className="absolute inset-x-[18%] bottom-[-6%] h-10 rounded-[50%] bg-cyan-400/10 blur-xl" aria-hidden />
      </div>

      {/* ───────── Mobile: centerpiece + 2×2 grid (no absolute) ───────── */}
      <div className="sm:hidden">
        <div className="flex justify-center">
          <Core size="sm" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {PANELS.map((p) => (
            <PanelCard key={p.label} panel={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
