import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/features";
import { BatchPageClient } from "./BatchPageClient";

/**
 * /batch — Batch Processing Demo
 *
 * Server Component wrapper: enforces the ENABLE_BATCH_DEMO feature flag.
 * If the flag is off, Next.js renders its standard 404 page (consistent
 * with how /cases and all other feature-gated routes in this app behave).
 *
 * The interactive state lives in BatchPageClient (a Client Component).
 */
export default function BatchPage() {
  if (!isFeatureEnabled("batchDemo")) {
    notFound();
  }

  return <BatchPageClient />;
}
