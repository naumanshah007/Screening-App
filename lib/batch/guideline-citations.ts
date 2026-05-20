/**
 * NCSP Guideline citations — UI-only mapping.
 *
 * Maps engine `decision.figure` outputs to the human-readable NCSP Guideline
 * section name. **Does not modify clinical logic** — this is a display
 * layer that lets clinicians and reviewers see, at a glance, which part of
 * the published guideline each decision corresponds to.
 *
 * Source: Aotearoa NZ National Cervical Screening Programme Clinical Practice
 * Guidelines for Cervical Screening (HPV-primary screening).
 */

export interface GuidelineCitation {
  /** Short label for cards: "Figure 3" / "Table 1" */
  short: string;
  /** Full descriptive title for drawers / detail views */
  title: string;
  /** One-line context for tooltips */
  context: string;
}

const CITATIONS: Record<string, GuidelineCitation> = {
  FIGURE_1: {
    short:   "Figure 1",
    title:   "NCSP Figure 1 — Entry into HPV-primary screening",
    context: "Routing for never-screened or transitioning participants.",
  },
  FIGURE_2: {
    short:   "Figure 2",
    title:   "NCSP Figure 2 — Participants with prior screening history",
    context: "Re-entry pathway based on prior cytology / colposcopy history.",
  },
  FIGURE_3: {
    short:   "Figure 3",
    title:   "NCSP Figure 3 — Management of HPV-primary screening result",
    context: "Core HPV-result triage (NOT_DETECTED / 16-18 / Other).",
  },
  FIGURE_4: {
    short:   "Figure 4",
    title:   "NCSP Figure 4 — Initial colposcopy with normal findings",
    context: "Follow-up after initial colposcopy with no lesion identified.",
  },
  FIGURE_5: {
    short:   "Figure 5",
    title:   "NCSP Figure 5 — Confirmed CIN2/3 and ASC-H management",
    context: "MDM-mediated treatment vs surveillance for confirmed high-grade.",
  },
  FIGURE_6: {
    short:   "Figure 6",
    title:   "NCSP Figure 6 — Test of Cure following treatment",
    context: "Co-test surveillance after CIN2/3 treatment.",
  },
  FIGURE_7: {
    short:   "Figure 7",
    title:   "NCSP Figure 7 — Glandular cytology management",
    context: "AG2 / AC2-4 → gynaecology or colposcopy by grade.",
  },
  FIGURE_8: {
    short:   "Figure 8",
    title:   "NCSP Figure 8 — Post-hysterectomy management",
    context: "Continued screening obligation by hysterectomy type and pathology.",
  },
  FIGURE_9: {
    short:   "Figure 9",
    title:   "NCSP Figure 9 — Pregnancy and high-grade cytology",
    context: "Modified pathway for pregnant participants.",
  },
  FIGURE_10: {
    short:   "Figure 10",
    title:   "NCSP Figure 10 — Abnormal vaginal bleeding and cancer symptoms",
    context: "Symptomatic-presentation pathway — urgent gynaecology.",
  },
  TABLE_1: {
    short:   "Table 1",
    title:   "NCSP Table 1 — No-history pathway",
    context: "Routing when no prior screening history is available.",
  },
};

export function getGuidelineCitation(figure?: string | null): GuidelineCitation | null {
  if (!figure) return null;
  return CITATIONS[figure.toUpperCase()] ?? null;
}

export function formatFigureLabel(figure?: string | null): string {
  if (!figure) return "—";
  const c = getGuidelineCitation(figure);
  return c ? c.short : figure.replace(/_/g, " ");
}
