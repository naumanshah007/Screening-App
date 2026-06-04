/**
 * LandingPage — the public marketing surface at `/`.
 *
 * Server-renderable shell that composes client islands (nav, hero visual,
 * scroll-reveal). Section rhythm alternates dark (midnight) ↔ light.
 *
 * Wording is deliberately safe: "decision support", "provisional",
 * "reviewer-gated", "guideline-aligned", "under clinical validation",
 * "not connected to live systems". No fake stats, no implied approval.
 */

import Link from "next/link";
import {
  ArrowRight, BookOpen, ShieldCheck, Lock, FileSearch, Users, Layers,
  Stethoscope, Cable, Database, FlaskConical, Upload, CheckCircle2, Cpu,
  Mail, Sparkles, ChevronRight,
} from "lucide-react";
import { MarketingNav } from "./MarketingNav";
import { HeroVisual } from "./HeroVisual";
import { PrivexaMark, PrivexaLockup } from "./PrivexaMark";
import { Reveal } from "./Reveal";

/* ─────────────────────────── Small building blocks ─────────────────────── */

function SectionHeader({
  eyebrow, title, description, tone = "light", align = "left",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  tone?: "light" | "dark";
  align?: "left" | "center";
}) {
  const titleColor = tone === "dark" ? "text-white" : "text-slate-900";
  const descColor = tone === "dark" ? "text-slate-300" : "text-slate-600";
  const eyebrowColor = tone === "dark" ? "text-cyan-300" : "text-cyan-700";
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <div className={`flex items-center gap-2.5 ${align === "center" ? "justify-center" : ""}`}>
        <span className="h-px w-6 bg-gradient-to-r from-cyan-400 to-violet-400" />
        <span className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${eyebrowColor}`}>
          {eyebrow}
        </span>
      </div>
      <h2 className={`font-display mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2.1rem] ${titleColor}`}>
        {title}
      </h2>
      {description && <p className={`mt-3 text-base leading-relaxed ${descColor}`}>{description}</p>}
    </div>
  );
}

function TrustChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="glass-panel inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-200">
      <Icon className="h-3.5 w-3.5 text-cyan-300" />
      {label}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  live: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  adapter: "bg-amber-50 text-amber-700 ring-amber-200",
};

function ProductCard({
  icon: Icon, title, body, status, statusLabel, accent,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  status: "live" | "adapter";
  statusLabel: string;
  accent: string; // e.g. "from-cyan-400 to-sky-400"
}) {
  return (
    <article className="group relative h-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,28,63,0.04),_0_10px_28px_-14px_rgba(15,28,63,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/60 hover:shadow-[0_26px_64px_-30px_rgba(8,145,178,0.45)]">
      <span className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${STATUS_STYLES[status]}`}>
          {statusLabel}
        </span>
      </div>
      <h3 className="font-display mt-4 text-[1.15rem] font-semibold tracking-tight text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
    </article>
  );
}

function GovernanceCard({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="glass-panel group relative h-full overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:ring-1 hover:ring-cyan-400/30">
      <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-400/0 blur-2xl transition-colors duration-500 group-hover:bg-cyan-400/20" />
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/10">
        <Icon className="h-5 w-5 text-cyan-300" />
      </span>
      <h3 className="font-display mt-3.5 text-[1.05rem] font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{body}</p>
    </div>
  );
}

/* ────────────────────────────── Data ───────────────────────────────────── */

const VALUES = [
  { icon: BookOpen, title: "Guideline-aligned", body: "Every recommendation maps to the NCSP HPV Primary pathway — Figures 1–10 and Table 1 — inside a versioned, test-covered decision engine." },
  { icon: ShieldCheck, title: "Reviewer-gated by design", body: "Outputs are provisional. A clinician confirms before any action — the platform never acts on its own." },
  { icon: Users, title: "Equity from day one", body: "Outcomes are disaggregated by ethnicity in NZ Level-1 priority order, so inequities are visible — not buried in an average." },
  { icon: FileSearch, title: "Source-to-decision audit", body: "Each result carries its source, mapping and engine version, with a full step-by-step decision trace." },
];

const PIPELINE = [
  { icon: Upload, title: "Ingest", body: "CSV, Excel or JSON today; HL7 v2 / FHIR R4 adapters defined for later." },
  { icon: CheckCircle2, title: "Validate", body: "NHI, enum and consistency checks with clear, fix-it guidance per row." },
  { icon: Cpu, title: "Decision support", body: "The shared engine produces a provisional, guideline-aligned recommendation." },
  { icon: ShieldCheck, title: "Reviewer confirmation", body: "A clinician reviews and confirms before anything is actioned." },
  { icon: FileSearch, title: "Audit & export", body: "Every case stays traceable, with full source and engine metadata." },
];

const PRODUCTS = [
  { icon: Layers, title: "Batch Decision Support", body: "Process many cases at once into provisional recommendations, prioritised for the reviewer.", status: "live" as const, statusLabel: "Live in demo", accent: "from-cyan-400 to-sky-500" },
  { icon: Stethoscope, title: "Manual Pathway", body: "Step a single case through the guideline pathway, question by question.", status: "live" as const, statusLabel: "Live", accent: "from-teal-400 to-emerald-500" },
  { icon: ShieldCheck, title: "Validation & Data Quality", body: "NHI, enum and cross-field consistency checks, with suggested fixes before processing.", status: "live" as const, statusLabel: "Live", accent: "from-emerald-400 to-teal-500" },
  { icon: Users, title: "Equity Analytics", body: "Outcomes disaggregated by ethnicity in NZ Level-1 priority order.", status: "live" as const, statusLabel: "Live", accent: "from-violet-400 to-fuchsia-500" },
  { icon: Cable, title: "Integration Adapters", body: "HL7 v2, FHIR R4, PMS and Health NZ — server-side, governed, mapped to one data contract.", status: "adapter" as const, statusLabel: "Adapter defined · not connected", accent: "from-sky-400 to-blue-500" },
  { icon: Database, title: "Governance & Audit", body: "Source-to-decision trace and a per-import audit trail on every result.", status: "live" as const, statusLabel: "Live", accent: "from-indigo-400 to-violet-500" },
];

const GOVERNANCE = [
  { icon: ShieldCheck, title: "Reviewer-gated", body: "Provisional outputs; clinician confirmation required before any action." },
  { icon: Lock, title: "Privacy-first", body: "Credentials are server-side only. No secrets are exposed in the frontend." },
  { icon: BookOpen, title: "Guideline-aligned", body: "Mapped to the NCSP HPV Primary pathway; versioned and test-covered." },
  { icon: Database, title: "Source metadata everywhere", body: "Source type, system, file, row, mapping and engine version on every result." },
  { icon: Cable, title: "Not connected to live systems", body: "Adapter pattern defined for HL7 / FHIR / PMS / Health NZ; activation is governed." },
  { icon: FlaskConical, title: "Under clinical validation", body: "A prototype undergoing clinical validation — not a certified medical device." },
];

const AUDIENCES = [
  { role: "CMO / Clinical Director", body: "Confidence that recommendations are guideline-aligned and reviewer-gated." },
  { role: "Screening Coordinator", body: "A clear, prioritised worklist with provisional recommendations for review." },
  { role: "CIO / Integration Lead", body: "An adapter architecture with server-side credentials and one clean data contract." },
  { role: "Quality & Safety", body: "Full source-to-decision traceability and a per-import audit trail." },
  { role: "Equity Lead", body: "Outcomes disaggregated by ethnicity, visible from day one." },
];

/* ────────────────────────────── Page ───────────────────────────────────── */

export function LandingPage({ authed = false }: { authed?: boolean }) {
  return (
    <div className="privexa-landing font-body">
      <MarketingNav authed={authed} />

      <main id="main-content">
        {/* ════════════════ HERO (dark) ════════════════ */}
        <section className="bg-midnight relative overflow-hidden">
          {/* Top hairline highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
          {/* Aurora + grid + grain */}
          <div className="aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="grid-overlay pointer-events-none absolute inset-0" aria-hidden />
          <div className="grain-overlay pointer-events-none absolute inset-0" aria-hidden />

          <div className="relative mx-auto grid max-w-7xl items-start gap-12 px-5 pb-20 pt-28 sm:px-8 lg:grid-cols-2 lg:gap-10 lg:pb-28 lg:pt-36">
            {/* Left column */}
            <div className="max-w-xl">
              <span className="glass-panel inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-200">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                Privexa · Aotearoa New Zealand
              </span>

              <h1 className="font-display mt-5 text-[2.05rem] font-semibold leading-[1.08] tracking-[-0.02em] text-white [hyphens:none] sm:text-[3.1rem] sm:leading-[1.05] lg:text-[3.6rem]">
                Referral grading &amp; screening decision support,{" "}
                <span className="text-gradient-brand">governed end to end</span>.
              </h1>

              <p className="mt-5 text-[1.05rem] leading-relaxed text-slate-200">
                CerviGrade by Privexa helps hospital screening and colposcopy teams turn referral
                and lab data into <strong className="font-semibold text-white">provisional, guideline-aligned</strong>{" "}
                recommendations — each one reviewer-gated, auditable, and mapped to the NCSP HPV Primary
                pathway. Decision support designed for clinicians, not autonomous care.
              </p>

              {/* CTAs */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href={authed ? "/dashboard" : "/login"}
                  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 px-5 py-3 text-[15px] font-semibold text-[#06121f] shadow-[0_8px_30px_-6px_rgba(34,211,238,0.5)] transition-transform hover:-translate-y-0.5"
                >
                  {authed ? "Go to dashboard" : "Open CerviGrade"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Trust chips */}
              <div className="mt-8 flex flex-wrap gap-2.5">
                <TrustChip icon={BookOpen} label="Guideline-aligned" />
                <TrustChip icon={ShieldCheck} label="Reviewer-gated" />
                <TrustChip icon={Lock} label="Privacy-first" />
                <TrustChip icon={FileSearch} label="Audit by design" />
              </div>
            </div>

            {/* Right column — floating visual */}
            <div className="lg:pt-2">
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* ════════════════ VALUE (light) ════════════════ */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <SectionHeader
              eyebrow="Why CerviGrade"
              title="Built for clinical trust, not just throughput"
              description="The hard part of screening at scale isn't speed — it's confidence. Every surface in the platform is designed so a clinician can trust, check, and stand behind the output."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {VALUES.map((v, i) => (
                <Reveal as="article" key={v.title} delay={i * 80}>
                  <div className="h-full rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,28,63,0.04),_0_10px_28px_-14px_rgba(15,28,63,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/60 hover:shadow-[0_26px_64px_-30px_rgba(8,145,178,0.45)]">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-sm">
                      <v.icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-display mt-4 text-[1.1rem] font-semibold tracking-tight text-slate-900">{v.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{v.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════ HOW IT WORKS (dark) ════════════════ */}
        <section id="how" className="bg-midnight relative overflow-hidden">
          <div className="grid-overlay pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <SectionHeader
              tone="dark"
              eyebrow="How it works"
              title="From referral to reviewed recommendation"
              description="A single governed pipeline. The data source can change — the validation, decision engine and audit stay exactly the same."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {PIPELINE.map((step, i) => (
                <Reveal key={step.title} delay={i * 80}>
                  <div className="glass-panel relative h-full rounded-2xl p-5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-cyan-300">
                        <step.icon className="h-4 w-4" />
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                        Step {i + 1}
                      </span>
                    </div>
                    <h3 className="font-display mt-3 text-[1.05rem] font-semibold tracking-tight text-white">{step.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{step.body}</p>
                    {i < PIPELINE.length - 1 && (
                      <ChevronRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-cyan-400/40 lg:block" />
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════ PLATFORM / CAPABILITIES (light) ════════════════ */}
        <section id="platform" className="bg-[#F5F8FC]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <SectionHeader
              eyebrow="Platform"
              title="One governed platform, many surfaces"
              description="Batch and manual, validation and equity, integration and audit — all sharing the same decision engine and the same safety guarantees."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {PRODUCTS.map((p, i) => (
                <Reveal key={p.title} delay={(i % 3) * 80}>
                  <ProductCard {...p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════ GOVERNANCE (dark) ════════════════ */}
        <section id="governance" className="bg-midnight relative overflow-hidden">
          <div className="grid-overlay pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          <div className="grain-overlay pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <SectionHeader
              tone="dark"
              eyebrow="Governance & security"
              title="Safety is the product, not a footnote"
              description="The same properties a Quality & Safety Officer would ask for are built in — and visible — rather than promised."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {GOVERNANCE.map((gc, i) => (
                <Reveal key={gc.title} delay={(i % 3) * 80}>
                  <GovernanceCard {...gc} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════ AUDIENCES (light) ════════════════ */}
        <section id="audiences" className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <SectionHeader
              eyebrow="Who it's for"
              title="Built with every stakeholder in the room"
              description="A serious screening programme is a team sport. CerviGrade gives each role what they need to say yes."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {AUDIENCES.map((a, i) => (
                <Reveal as="article" key={a.role} delay={(i % 3) * 80}>
                  <div className="flex h-full items-start gap-3.5 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,28,63,0.04),_0_10px_28px_-14px_rgba(15,28,63,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/60">
                    <span className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 text-white">
                      <Users className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="font-display text-[1.02rem] font-semibold tracking-tight text-slate-900">{a.role}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{a.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════ CTA BAND (dark) ════════════════ */}
        <section className="bg-midnight relative overflow-hidden">
          <div className="grid-overlay pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(34,211,238,0.18), transparent 65%)" }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
            <PrivexaMark size={52} uid="cta" className="mx-auto" />
            <h2 className="font-display mt-6 text-[2rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.5rem]">
              Your screening decision support is ready
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
              Start using CerviGrade today. Explore the guided pathway, upload your data, or review sample results to see how it works.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={authed ? "/dashboard" : "/login"}
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 px-6 py-3 text-[15px] font-semibold text-[#06121f] shadow-[0_8px_30px_-6px_rgba(34,211,238,0.5)] transition-transform hover:-translate-y-0.5"
              >
                {authed ? "Go to dashboard" : "Open CerviGrade"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ════════════════ FOOTER (dark) ════════════════ */}
        <footer className="bg-[#070D1F] border-t border-white/10">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
              {/* Brand */}
              <div className="lg:col-span-1">
                <PrivexaLockup size={32} tone="light" uid="footer" />
                <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-300">
                  Governed referral grading and screening decision support for hospital teams.
                  Built by Privexa in Aotearoa New Zealand.
                </p>
              </div>

              {/* Platform */}
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Platform</h3>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {[
                    ["Batch decision support", "live"],
                    ["Manual pathway", "live"],
                    ["Validation & data quality", "live"],
                    ["Equity analytics", "live"],
                    ["Integration adapters", "adapter"],
                  ].map(([label, status]) => (
                    <li key={label}>
                      <a href="#platform" className="inline-flex items-center gap-2 text-slate-300 transition-colors hover:text-white">
                        {label}
                        <span className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-emerald-400" : "bg-amber-400"}`} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Governance */}
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Governance &amp; trust</h3>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {["Reviewer-gated by design", "Privacy-first", "Under clinical validation", "Source-to-decision audit"].map((label) => (
                    <li key={label}>
                      <a href="#governance" className="text-slate-300 transition-colors hover:text-white">{label}</a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Reach */}
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Reach</h3>
                <ul className="mt-4 space-y-2.5 text-sm">
                  <li>
                    <a href="mailto:info@privexa.co" className="inline-flex items-center gap-2 text-slate-300 transition-colors hover:text-white">
                      <Mail className="h-3.5 w-3.5" /> info@privexa.co
                    </a>
                  </li>
                  <li>
                    <Link href={authed ? "/dashboard" : "/login"} className="text-slate-300 transition-colors hover:text-white">
                      {authed ? "Go to dashboard" : "Sign in"}
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>© {new Date().getFullYear()} Privexa. All rights reserved.</span>
              <span className="max-w-xl sm:text-right">
                Decision support — a prototype under clinical validation, not a certified medical device.
                Outputs are provisional and require reviewer confirmation before action.
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
