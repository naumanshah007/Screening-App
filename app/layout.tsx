import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Manrope } from "next/font/google";
import { Providers } from "@/components/layout/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Marketing typography — exposed as CSS vars; only the landing page consumes
// them (via .font-display / .font-body). The clinical app chrome stays on Geist.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CerviGrade by Privexa — Cervical Referral Grading Tool",
  description:
    "CerviGrade is a cervical referral grading tool with screening decision support for hospital teams. Provisional, reviewer-gated and guideline-aligned to the NCSP HPV Primary pathway. Decision support — a prototype under clinical validation, not a certified medical device.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${manrope.variable} antialiased`}>
        <a href="#main-content" className="skip-to-content">Skip to main content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
