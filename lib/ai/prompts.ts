/**
 * AI prompt templates for the ClinicalTriage grading assistance pipeline.
 *
 * Each prompt is versioned so that concordance tracking can link AI
 * recommendations back to the exact prompt generation that produced them.
 * Bump PROMPT_VERSION whenever a prompt is changed.
 */

/**
 * Bump PROMPT_VERSION whenever a prompt is changed.
 * Stored in AIRecommendation.promptVersion for concordance tracking.
 */
export const PROMPT_VERSION = "2.0.0"; // bumped: provider-agnostic, Ollama-first

// ─── Types ────────────────────────────────────────────────────────────────────

export type SummarisationInput = {
  serviceLine: "COLPOSCOPY" | "GYNAECOLOGY";
  patientAge?: number | null;
  extractedFacts: Array<{
    label: string;
    valueText: string;
    sourceDocument: string;
  }>;
  referralReason?: string | null;
  clinicalHistory?: string | null;
  rawDocumentExcerpts?: string[];
};

export type GradingInput = {
  serviceLine: "COLPOSCOPY" | "GYNAECOLOGY";
  clinicalSummaryMarkdown: string;
  deterministicRecommendation?: {
    priority: string;
    category: string;
    outcome: string;
    rationale: string;
  } | null;
};

export type GradingOutput = {
  suggestedPriority: string;
  suggestedCategory: string;
  suggestedOutcome: string;
  rationale: string;
  confidence: number;
  citations: string[];
  concordantWithRule: boolean;
  reasoning: string;
};

// ─── Prompt builders ──────────────────────────────────────────────────────────

/**
 * Builds the system prompt for one-page clinical summarisation.
 * The model is asked to produce a structured JSON summary from extracted facts.
 */
export function buildSummarisationSystemPrompt(): string {
  return `You are a specialist clinical summarisation assistant for Health NZ Counties Manukau.
Your role is to produce concise, structured one-page summaries of referral packages for
${["colposcopy", "gynaecology"].join(" and ")} triage graders.

Guidelines:
- Summarise only facts present in the input — do not infer or add clinical judgement
- Use plain clinical language appropriate for a specialist grader
- Flag any missing information that is required for grading
- Structure the summary in the JSON schema provided
- All dates should be in NZ format (DD/MM/YYYY)

Output a single JSON object matching this schema:
{
  "patientSummary": "One sentence patient overview",
  "keyFindings": ["bullet 1", "bullet 2"],
  "investigations": ["relevant investigations"],
  "referralReason": "reason as stated by referrer",
  "missingInformation": ["any gaps needed for grading"],
  "redFlags": ["clinical red flags if present"],
  "suggestedNextStep": "brief clinical next step suggestion"
}`;
}

export function buildSummarisationUserPrompt(input: SummarisationInput): string {
  const factsText = input.extractedFacts
    .map((f) => `- ${f.label}: ${f.valueText} (from ${f.sourceDocument})`)
    .join("\n");

  const excerpts =
    input.rawDocumentExcerpts && input.rawDocumentExcerpts.length > 0
      ? `\n\nDocument excerpts:\n${input.rawDocumentExcerpts.slice(0, 3).join("\n\n---\n\n")}`
      : "";

  return `Service line: ${input.serviceLine}
${input.patientAge ? `Patient age: ${input.patientAge}` : ""}
${input.referralReason ? `Referral reason: ${input.referralReason}` : ""}
${input.clinicalHistory ? `Clinical history: ${input.clinicalHistory}` : ""}

Extracted facts:
${factsText || "(no facts extracted yet)"}${excerpts}

Please produce the one-page clinical summary JSON.`;
}

/**
 * Builds the prompt for AI-assisted grading recommendation.
 * The model is shown the clinical summary and the deterministic rule
 * recommendation, then asked to confirm or suggest an alternative with rationale.
 */
export function buildGradingSystemPrompt(
  serviceLine: "COLPOSCOPY" | "GYNAECOLOGY"
): string {
  const guidelineReference =
    serviceLine === "COLPOSCOPY"
      ? `COLP Grading Guide — Health NZ Counties Manukau:
P1/P1-HSC: within 10 calendar days (cancer suspicion or high-grade)
P2: within 30 calendar days (high-grade cytology or abnormal appearance)
P3: within 3 months (routine colposcopy)
P3 (extended): within 6 months (surveillance pathways)
REJECT: insufficient evidence — return to GP with instructions`
      : `Gynaecology Grading Guideline — Health NZ Counties Manukau:
P1/P1-HSC: within 2 weeks (PMB, complex adnexal mass, HSC-tracked)
P2/P2-HSC: within 4 weeks (semi-urgent specialist review)
P3: within 4 months (routine gynaecology review)
P5: virtual clinic only
REJECT: refer back to GP with specific requirements
DECLINE: redirect to appropriate pathway`;

  return `You are an AI grading assistant for the ClinicalTriage referral management system
at Health NZ Counties Manukau. You assist specialist graders by reviewing clinical
summaries and suggesting a booking priority.

You must always:
1. Base your recommendation on the published grading guidelines below
2. Explain your reasoning clearly, citing the specific guideline scenario that applies
3. Flag any information that is missing or would change the recommendation
4. Express a confidence level from 0.0 (no confidence) to 1.0 (very confident)
5. If the deterministic rule recommendation is provided and you agree, say so explicitly

Grading guidelines:
${guidelineReference}

Respond with a JSON object matching this schema exactly:
{
  "suggestedPriority": "P1_HSC | P1 | P2_HSC | P2 | P3 | P5 | REJECT | DECLINE | INFO_REQUIRED",
  "suggestedCategory": "short category label",
  "suggestedOutcome": "brief outcome description",
  "rationale": "explanation of the recommendation",
  "confidence": 0.0–1.0,
  "citations": ["guideline scenario matched"],
  "concordantWithRule": true | false,
  "reasoning": "step-by-step reasoning referencing the clinical facts"
}`;
}

export function buildGradingUserPrompt(input: GradingInput): string {
  const ruleSection = input.deterministicRecommendation
    ? `\nDeterministic rule recommendation:
Priority: ${input.deterministicRecommendation.priority}
Category: ${input.deterministicRecommendation.category}
Outcome: ${input.deterministicRecommendation.outcome}
Rationale: ${input.deterministicRecommendation.rationale}`
    : "\nNo deterministic rule recommendation available — assess independently.";

  return `Clinical summary:
${input.clinicalSummaryMarkdown}
${ruleSection}

Please provide your grading recommendation as JSON.`;
}
