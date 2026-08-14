/**
 * Clinician-facing names for the governed ruleset.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * These labels belong on client components — the authority badge on Guidelines
 * is one. Their previous home, `current-ruleset.ts`, imports Prisma, so any
 * client component that imported a label would pull the database client into
 * the browser bundle and fail the build. This module is pure and has no
 * imports, so either side can use it.
 *
 * The words "canonical", "legacy" and "shadow" are deliberately absent. They
 * are internal architecture terms: accurate on governance, Rule Studio, audit
 * and provenance surfaces, and meaningless — or worse, alarming — to a
 * clinician reading the guidelines they are expected to follow.
 */

/** Full title of the guideline surface. */
export const CURRENT_GUIDELINES_LABEL = "Current Cervical Screening Guidelines";

/** Short form for compact UI, e.g. a decision card header or a badge. */
export const CURRENT_RULES_LABEL = "Current governed rules";
