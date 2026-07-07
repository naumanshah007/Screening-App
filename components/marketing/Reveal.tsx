"use client";

/**
 * Reveal — scroll-reveal wrapper.
 *
 * Content is ALWAYS in the DOM (crawler-safe). On first intersection it
 * transitions opacity 0→1 + translateY 24px→0. Respects prefers-reduced-motion
 * (renders immediately, no transform).
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in ms. */
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}

export function Reveal({ children, className, delay = 0, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  const setElement = useCallback((node: HTMLElement | null) => {
    ref.current = node;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style = {
    opacity: shown ? 1 : 0,
    transform: shown ? "translateY(0)" : "translateY(24px)",
    transition: `opacity 700ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 700ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
    willChange: "opacity, transform",
  };

  if (as === "section") {
    return <section ref={setElement} className={className} style={style}>{children}</section>;
  }
  if (as === "li") {
    return <li ref={setElement} className={className} style={style}>{children}</li>;
  }
  if (as === "article") {
    return <article ref={setElement} className={className} style={style}>{children}</article>;
  }
  return <div ref={setElement} className={className} style={style}>{children}</div>;
}
