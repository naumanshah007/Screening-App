import type { NextConfig } from "next";

const securityHeaders = [
  // Force HTTPS for 2 years, include subdomains
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Prevent clickjacking
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Stop MIME-type sniffing
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Referrer policy — don't leak URL to third parties
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Restrict browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Content Security Policy — restrict script/style/connect sources
  // Adjust 'connect-src' if you add external API calls (e.g. NCSR endpoint)
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline/eval needed by Next.js dev; tighten in prod with nonces
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Ensure the schema SQL file is included in Vercel serverless bundles
  outputFileTracingIncludes: {
    "/api/**": ["./lib/database/current-schema.sql"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
