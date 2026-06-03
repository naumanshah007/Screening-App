"use client";

/**
 * MarketingNav — sticky dark-glass navigation for the public landing page.
 * Transparent-ish at top, solidifies on scroll. Desktop links + gradient CTA,
 * mobile dark-glass drawer.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";
import { PrivexaLockup } from "./PrivexaMark";

const LINKS = [
  { href: "#platform", label: "Platform" },
  { href: "#how", label: "How it works" },
  { href: "#governance", label: "Governance" },
  { href: "#audiences", label: "Who it's for" },
];

const DEMO_MAILTO =
  "mailto:info@privexa.co?subject=ClinicalTriage%20%E2%80%94%20demo%20request&body=Hi%20Privexa%20team%2C%0A%0AWe'd%20like%20to%20see%20a%20demo%20of%20ClinicalTriage.%0A%0AOrganisation%3A%0ARole%3A%0APreferred%20time%3A%0A";

export function MarketingNav({ authed = false }: { authed?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[#070D1F]/85 backdrop-blur-xl border-b border-white/10 shadow-[0_8px_30px_-12px_rgba(2,8,23,0.8)]"
          : "bg-[#070D1F]/40 backdrop-blur-md border-b border-white/[0.06]",
      ].join(" ")}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center" aria-label="ClinicalTriage by Privexa — home">
          <PrivexaLockup size={30} tone="light" uid="nav" />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="group relative rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              {l.label}
              <span className="absolute inset-x-3 -bottom-0.5 h-px scale-x-0 bg-gradient-to-r from-cyan-400 to-violet-400 transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-2.5 lg:flex">
          <Link
            href={authed ? "/dashboard" : "/login"}
            className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]"
          >
            {authed ? "Go to dashboard" : "Sign in"}
          </Link>
          <a
            href={DEMO_MAILTO}
            className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 px-4 py-2 text-sm font-semibold text-[#06121f] shadow-[0_8px_30px_-6px_rgba(34,211,238,0.5)] transition-transform hover:-translate-y-0.5"
          >
            Request a demo
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden">
          <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-[#0B1430]/95 px-5 pb-6 pt-3 backdrop-blur-xl">
            <div className="flex flex-col">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-slate-200 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2.5">
              <a
                href={DEMO_MAILTO}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 px-4 py-3 text-sm font-semibold text-[#06121f] shadow-[0_8px_30px_-6px_rgba(34,211,238,0.5)]"
              >
                Request a demo
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href={authed ? "/dashboard" : "/login"}
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white"
              >
                {authed ? "Go to dashboard" : "Sign in"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export { DEMO_MAILTO };
