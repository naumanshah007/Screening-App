/**
 * Which evaluation modes are clinically operative.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * This predicate is needed on both the server and the client. The server-side
 * home for it (lib/clinical-rules/pinning.ts) imports Prisma, so importing it
 * into a client component pulls the database client into the browser bundle and
 * breaks the build.
 *
 * It previously existed twice — once in pinning.ts and once as a private copy
 * inside AuthorityComparison.tsx. Two definitions of "is this decision live"
 * can drift, and a UI that disagrees with the server about whether an
 * evaluation is operative is exactly how shadow wording ends up on a live
 * clinical decision. This module is the single definition; it is pure, has no
 * imports, and is safe on either side.
 */

/** Modes in which a canonical evaluation genuinely decides the case. */
export const OPERATIVE_EVALUATION_MODES = [
  "LIVE_DEMO",
  "LIVE_PRODUCTION",
] as const;

export type OperativeEvaluationMode =
  (typeof OPERATIVE_EVALUATION_MODES)[number];

/**
 * True when the evaluation is the clinical decision rather than shadow or
 * simulation evidence.
 *
 * Accepts a plain string so callers holding a serialised record do not have to
 * cast: an unrecognised value is correctly treated as not operative.
 */
export function isOperativeEvaluationMode(mode: string | null | undefined): boolean {
  return (OPERATIVE_EVALUATION_MODES as readonly string[]).includes(mode ?? "");
}
