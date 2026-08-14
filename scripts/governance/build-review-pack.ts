/**
 * Build the clinical governance review pack.
 *
 * WHY THIS IS GENERATED RATHER THAN WRITTEN
 * -----------------------------------------
 * The pack is what named clinical approvers read before recording a decision in
 * the app. If it were hand-written it could drift from CLINICAL_GOVERNANCE_CASES
 * and ACTIVATION_GATE_DEFINITIONS — and an approver would then be attesting to
 * one description while the ledger recorded a different case. Generating it from
 * the same constants the application enforces makes that impossible: regenerate
 * after any change to those definitions and the pack follows.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ----------------------------------
 * It records nothing. It writes no audit event, creates no draft, and populates
 * no approval or signature. Every decision field is left empty for a human to
 * complete inside the application, where the decision is bound to an
 * authenticated identity and to the draft's exact checksum. A signed-looking
 * document produced by a tool is precisely what this process exists to prevent.
 *
 * Usage: npx tsx scripts/governance/build-review-pack.ts [outputPath]
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  ACTIVATION_GATE_DEFINITIONS,
  ROLLBACK_THRESHOLD_CANDIDATES,
} from "@/lib/clinical-rules/activation-governance";
import {
  CLINICAL_GOVERNANCE_CASES,
  ClinicalGovernanceDispositionSchema,
} from "@/lib/clinical-rules/governance-review";

const DISPOSITIONS = ClinicalGovernanceDispositionSchema.options;

function field(label: string, value: string | readonly string[] | undefined): string {
  if (!value) return "";
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  return `| **${label}** | ${text} |\n`;
}

function caseSection(item: (typeof CLINICAL_GOVERNANCE_CASES)[number], index: number): string {
  let out = `\n### ${index + 1}. ${item.title}\n\n`;
  out += `\`${item.caseId}\`\n\n`;
  out += "| | |\n|---|---|\n";
  out += field("Source", item.source);
  out += field("Recommendations", item.recommendations);
  out += field("Figure branch", item.figureBranch);
  out += field("Affected rules", item.affectedRuleIds);
  out += field("Affected tests", item.affectedTests);
  out += "\n";
  out += `**What the source says.** ${item.sourceGuidance}\n\n`;
  out += `**What the current comparison oracle does.** ${item.currentLegacyBehaviour}\n\n`;
  out += `**What the governed rules do.** ${item.canonicalBehaviour}\n\n`;
  out += `**The competing interpretation.** ${item.competingInterpretation}\n\n`;
  out += `**Proposed final behaviour.** ${item.proposedFinalBehaviour}\n\n`;
  out += `**Safety impact.** ${item.safetyImpact}\n\n`;
  out += `**Effect on pathways.** ${item.effectOnPathways}\n\n`;
  out += `**Test evidence.** ${item.testEvidence}\n\n`;
  out += `**Disposition supported by the source analysis:** \`${item.sourceSupportedDisposition}\`\n\n`;
  out += "> This is the engineering reading of the source, not a clinical decision.\n";
  out += "> It carries no weight in the ledger until a named approver records it.\n\n";
  out += "| Approver decision | |\n|---|---|\n";
  out += "| Disposition | _(to be recorded in the app)_ |\n";
  out += "| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |\n";
  out += "| Approver | _(authenticated identity, recorded in the app)_ |\n";
  out += "| Date | _(recorded in the app)_ |\n";
  return out;
}

function gateSection(gate: (typeof ACTIVATION_GATE_DEFINITIONS)[number], index: number): string {
  let out = `\n### ${index + 1}. ${gate.title}\n\n`;
  out += `\`${gate.gateId}\`\n\n`;
  out += `**Question to answer.** ${gate.question}\n\n`;
  out += "| | |\n|---|---|\n";
  out += field("Evidence available", gate.evidence);
  out += field("Proposed decision", gate.proposed);
  out += field("Safety impact", gate.safetyImpact);
  out += field("Pathway", gate.pathway);
  out += field("Supporting tests", gate.tests);
  out += field("Engineering status", gate.engineeringStatus);
  out += field("Who may record it", gate.roles);
  out += "\n| Owner decision | |\n|---|---|\n";
  out += "| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |\n";
  out += "| Comments | _(minimum 10 characters, recorded in the app)_ |\n";
  out += "| Accountable owner | _(authenticated identity, recorded in the app)_ |\n";
  return out;
}

function build(): string {
  const cases = CLINICAL_GOVERNANCE_CASES;
  const gates = ACTIVATION_GATE_DEFINITIONS;

  let doc = "# CG-NCSP clinical governance review pack\n\n";
  doc +=
    "Prepared for the named clinical approvers, risk owner and activation operators who must " +
    "record the decisions below. **Nothing in this document is an approval.** Every decision " +
    "field is empty and is completed inside CerviGrade, where it is bound to an authenticated " +
    "identity, to the draft successor's revision, and to its exact content checksum.\n\n";

  doc += "## Before any decision can be recorded\n\n";
  doc +=
    "Clinical interpretations may only be recorded against a **draft successor**. The server " +
    "refuses anything else: *\"Governance interpretation may only revise a draft successor.\"* " +
    "CG-NCSP-3.1.0 is ACTIVE and is deciding new cases, so it cannot carry the register.\n\n";
  doc += "1. Open **Rule Studio** and clone CG-NCSP-3.1.0 into a new draft, choosing the version\n";
  doc += "   identifier and change summary — both are written to the permanent audit trail under\n";
  doc += "   the identity of whoever performs the clone.\n";
  doc += "2. Open **Governance**. The approval centre resolves the newest draft automatically and\n";
  doc += "   will then address the successor rather than the active version.\n";
  doc += "3. Work through the clinical interpretations, then the activation gates.\n\n";
  doc += "Two constraints apply throughout, and both are enforced by the server:\n\n";
  doc += "- **A proposer cannot approve their own interpretation.** Two distinct authenticated\n";
  doc += "  clinical approvers are required.\n";
  doc += "- **Decisions are bound to the draft's checksum.** Editing the draft's content after a\n";
  doc += "  decision invalidates that decision; it does not silently carry over.\n\n";
  doc +=
    "Decisions recorded by demonstration accounts are marked as demonstration attestations and " +
    "are excluded from real activation gates.\n\n";

  doc += `## Part A — Clinical interpretations (${cases.length})\n\n`;
  doc += "Each case is a point where the source guidance admits more than one reading, and a\n";
  doc += "named clinician must decide which reading the governed rules will carry.\n\n";
  doc += "Available dispositions:\n\n";
  for (const d of DISPOSITIONS) doc += `- \`${d}\`\n`;
  doc += cases.map(caseSection).join("\n---\n");

  doc += `\n\n## Part B — Operational activation gates (${gates.length})\n\n`;
  doc += "These are accountability decisions rather than clinical readings. Several name a\n";
  doc += "specific accountable person and cannot be satisfied by engineering evidence alone.\n";
  doc += gates.map(gateSection).join("\n---\n");

  doc += "\n\n### Candidate rollback thresholds\n\n";
  doc += "Referenced by `ROLLBACK-THRESHOLDS` above. The risk owner approves this set or\n";
  doc += "requests a change.\n\n";
  doc += "| Signal | Candidate threshold |\n|---|---|\n";
  for (const [signal, threshold] of Object.entries(ROLLBACK_THRESHOLD_CANDIDATES)) {
    const label = signal.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    doc += `| ${label} | ${threshold} |\n`;
  }

  doc += "\n\n## What is not covered here\n\n";
  doc += "This pack covers the register and the gates. It does not authorise a Production\n";
  doc += "activation, and completing it does not perform one. Production activation is a\n";
  doc += "separate controlled step requiring an activation operator and a distinct deputy, both\n";
  doc += "different from the two clinical approvers.\n\n";
  doc += `_Generated from CLINICAL_GOVERNANCE_CASES (${cases.length}) and `;
  doc += `ACTIVATION_GATE_DEFINITIONS (${gates.length}) by `;
  doc += "`scripts/governance/build-review-pack.ts`. Regenerate after any change to those\n";
  doc += "definitions so the pack cannot describe a case differently from the ledger._\n";
  return doc;
}

// ─── HTML edition ───────────────────────────────────────────────────────────
//
// Same constants, same empty decision fields. Approvers who will not clone the
// repository read this one; generating both from one source is what stops the
// circulated document from describing a case differently from the ledger.

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function row(label: string, value: string | readonly string[] | undefined): string {
  if (!value) return "";
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  return `<div class="meta-row"><dt>${esc(label)}</dt><dd>${esc(text)}</dd></div>`;
}

function prose(label: string, value: string): string {
  return `<div class="prose-block"><h4>${esc(label)}</h4><p>${esc(value)}</p></div>`;
}

/** An explicitly unfilled decision. Never populated by this generator. */
function awaiting(fields: string[]): string {
  return `<div class="decision" role="group" aria-label="Awaiting decision">
      <div class="decision-head"><span class="chip">Awaiting decision</span><span class="decision-note">Recorded in CerviGrade, bound to an authenticated identity</span></div>
      <dl class="decision-fields">${fields
        .map((f) => `<div><dt>${esc(f)}</dt><dd class="empty" aria-label="Not recorded">—</dd></div>`)
        .join("")}</dl>
    </div>`;
}

function buildHtml(): string {
  const cases = CLINICAL_GOVERNANCE_CASES;
  const gates = ACTIVATION_GATE_DEFINITIONS;

  const caseNav = cases
    .map((c, i) => `<li><a href="#case-${i + 1}"><span class="idx">A${i + 1}</span>${esc(c.title)}</a></li>`)
    .join("");
  const gateNav = gates
    .map((g, i) => `<li><a href="#gate-${i + 1}"><span class="idx">B${i + 1}</span>${esc(g.title)}</a></li>`)
    .join("");

  const caseBody = cases
    .map(
      (c, i) => `<article class="item" id="case-${i + 1}">
      <header class="item-head">
        <span class="idx-badge">A${i + 1}</span>
        <div><h3>${esc(c.title)}</h3><code class="ident">${esc(c.caseId)}</code></div>
      </header>
      <dl class="meta">
        ${row("Source", c.source)}${row("Recommendations", c.recommendations)}${row("Figure branch", c.figureBranch)}${row("Affected rules", c.affectedRuleIds)}${row("Affected tests", c.affectedTests)}
      </dl>
      ${prose("What the source says", c.sourceGuidance)}
      ${prose("What the current comparison oracle does", c.currentLegacyBehaviour)}
      ${prose("What the governed rules do", c.canonicalBehaviour)}
      ${prose("The competing interpretation", c.competingInterpretation)}
      ${prose("Proposed final behaviour", c.proposedFinalBehaviour)}
      ${prose("Safety impact", c.safetyImpact)}
      ${prose("Effect on pathways", c.effectOnPathways)}
      ${prose("Test evidence", c.testEvidence)}
      <p class="reading">Disposition supported by the source analysis: <code>${esc(c.sourceSupportedDisposition)}</code><span>This is the engineering reading of the source, not a clinical decision. It carries no weight until a named approver records it.</span></p>
      ${awaiting(["Disposition", "Reviewer comments", "Approver", "Date"])}
    </article>`
    )
    .join("");

  const gateBody = gates
    .map(
      (g, i) => `<article class="item" id="gate-${i + 1}">
      <header class="item-head">
        <span class="idx-badge alt">B${i + 1}</span>
        <div><h3>${esc(g.title)}</h3><code class="ident">${esc(g.gateId)}</code></div>
      </header>
      <p class="question">${esc(g.question)}</p>
      <dl class="meta">
        ${row("Evidence available", g.evidence)}${row("Proposed decision", g.proposed)}${row("Safety impact", g.safetyImpact)}${row("Pathway", g.pathway)}${row("Supporting tests", g.tests)}${row("Engineering status", g.engineeringStatus)}${row("Who may record it", g.roles)}
      </dl>
      ${awaiting(["Decision", "Comments", "Accountable owner"])}
    </article>`
    )
    .join("");

  const thresholds = Object.entries(ROLLBACK_THRESHOLD_CANDIDATES)
    .map(([signal, threshold]) => {
      const label = signal.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
      return `<tr><th scope="row">${esc(label)}</th><td>${esc(threshold)}</td></tr>`;
    })
    .join("");

  return `<title>CG-NCSP Governance Register</title>
<style>
  :root {
    --ground: #f7f9fa;
    --surface: #ffffff;
    --surface-sunk: #eef2f4;
    --line: #d8e0e5;
    --line-soft: #e7edf0;
    --ink: #16212b;
    --muted: #566672;
    --accent: #0d6d78;
    --accent-soft: #e2f0f1;
    --pending: #8a5a00;
    --pending-soft: #fbf1de;
    --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Source Serif Pro", Georgia, serif;
    --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0d1418;
      --surface: #141d23;
      --surface-sunk: #101820;
      --line: #26343d;
      --line-soft: #1d2830;
      --ink: #e2eaef;
      --muted: #93a4b0;
      --accent: #4cbcc7;
      --accent-soft: #122a2e;
      --pending: #d9a441;
      --pending-soft: #2a2211;
    }
  }
  :root[data-theme="dark"] {
    --ground: #0d1418;
    --surface: #141d23;
    --surface-sunk: #101820;
    --line: #26343d;
    --line-soft: #1d2830;
    --ink: #e2eaef;
    --muted: #93a4b0;
    --accent: #4cbcc7;
    --accent-soft: #122a2e;
    --pending: #d9a441;
    --pending-soft: #2a2211;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--accent); }
  a:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 3px; }
  code { font-family: var(--mono); font-size: 0.85em; }

  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px 96px; }

  /* ── Masthead ─────────────────────────────────────────────── */
  .masthead { border-bottom: 2px solid var(--ink); padding: 56px 0 24px; margin-bottom: 40px; }
  .eyebrow {
    font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--muted); margin: 0 0 14px;
  }
  .masthead h1 {
    font-family: var(--serif); font-weight: 600; font-size: clamp(30px, 4.4vw, 46px);
    line-height: 1.12; letter-spacing: -0.015em; margin: 0 0 16px; text-wrap: balance;
  }
  .standfirst { font-size: 17px; color: var(--muted); max-width: 62ch; margin: 0; }
  .standfirst strong { color: var(--ink); font-weight: 600; }

  .tally { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
  .tally div {
    display: flex; align-items: baseline; gap: 9px;
    border: 1px solid var(--line); background: var(--surface);
    border-radius: 3px; padding: 9px 14px;
  }
  .tally .n { font-family: var(--mono); font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--pending); }
  .tally .l { font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted); }

  /* ── Blocking precondition ────────────────────────────────── */
  .precondition {
    border: 1px solid var(--line); border-left: 3px solid var(--pending);
    background: var(--pending-soft); border-radius: 3px;
    padding: 22px 26px; margin-bottom: 44px;
  }
  .precondition h2 { font-family: var(--serif); font-size: 21px; font-weight: 600; margin: 0 0 10px; }
  .precondition p { margin: 0 0 12px; max-width: 72ch; }
  .precondition ol { margin: 0 0 12px; padding-left: 22px; max-width: 72ch; }
  .precondition li { margin-bottom: 7px; }
  .precondition p:last-child, .precondition ol:last-child { margin-bottom: 0; }
  .precondition q { font-style: italic; }

  /* ── Layout ───────────────────────────────────────────────── */
  .layout { display: grid; grid-template-columns: 1fr; gap: 44px; }
  @media (min-width: 1000px) { .layout { grid-template-columns: 236px 1fr; gap: 56px; } }

  nav.toc { font-size: 13px; }
  @media (min-width: 1000px) { nav.toc { position: sticky; top: 24px; align-self: start; max-height: calc(100vh - 48px); overflow-y: auto; } }
  nav.toc h2 {
    font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
    margin: 0 0 10px; padding-bottom: 8px; border-bottom: 1px solid var(--line);
  }
  nav.toc h2 + h2 { margin-top: 26px; }
  nav.toc ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  nav.toc a {
    display: grid; grid-template-columns: 30px 1fr; gap: 6px; align-items: start;
    text-decoration: none; color: var(--muted); padding: 5px 6px; border-radius: 3px; line-height: 1.4;
  }
  nav.toc a:hover { background: var(--surface-sunk); color: var(--ink); }
  nav.toc .idx { font-family: var(--mono); font-size: 11px; color: var(--accent); padding-top: 1px; }

  section > h2.part {
    font-family: var(--serif); font-size: 27px; font-weight: 600; letter-spacing: -0.01em;
    margin: 0 0 6px; padding-top: 8px;
  }
  section > p.part-note { color: var(--muted); margin: 0 0 26px; max-width: 68ch; }
  section + section { margin-top: 60px; }

  .dispositions { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 30px; padding: 0; list-style: none; }
  .dispositions li {
    font-family: var(--mono); font-size: 11.5px; color: var(--muted);
    border: 1px solid var(--line); border-radius: 3px; padding: 4px 8px; background: var(--surface);
  }

  /* ── Item ─────────────────────────────────────────────────── */
  .item {
    background: var(--surface); border: 1px solid var(--line); border-radius: 4px;
    padding: 28px 30px; margin-bottom: 18px; scroll-margin-top: 20px;
  }
  .item-head { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 20px; }
  .idx-badge {
    flex: none; font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
    color: var(--accent); background: var(--accent-soft); border-radius: 3px;
    padding: 4px 7px; margin-top: 3px;
  }
  .item-head h3 { font-family: var(--serif); font-size: 21px; font-weight: 600; line-height: 1.25; margin: 0 0 5px; text-wrap: balance; }
  .ident { color: var(--muted); font-size: 11.5px; letter-spacing: 0.02em; }

  .question {
    font-family: var(--serif); font-size: 17px; font-style: italic;
    color: var(--ink); margin: 0 0 20px; padding-left: 14px; border-left: 2px solid var(--accent);
  }

  dl.meta { margin: 0 0 22px; padding: 16px 18px; background: var(--surface-sunk); border-radius: 3px; display: flex; flex-direction: column; gap: 8px; }
  .meta-row { display: grid; grid-template-columns: 1fr; gap: 1px; }
  @media (min-width: 620px) { .meta-row { grid-template-columns: 168px 1fr; gap: 14px; } }
  .meta-row dt { font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted); padding-top: 3px; }
  .meta-row dd { margin: 0; font-size: 14px; }

  .prose-block { margin-bottom: 15px; }
  .prose-block h4 { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 3px; font-weight: 600; }
  .prose-block p { margin: 0; max-width: 70ch; font-size: 15px; }

  .reading {
    margin: 20px 0 0; padding: 13px 16px; border: 1px dashed var(--line);
    border-radius: 3px; font-size: 14px; max-width: 74ch;
  }
  .reading code { color: var(--accent); font-weight: 600; }
  .reading span { display: block; margin-top: 5px; color: var(--muted); font-size: 13px; }

  /* ── The empty decision ───────────────────────────────────── */
  .decision { margin-top: 18px; border: 1px dashed var(--pending); background: var(--pending-soft); border-radius: 3px; padding: 15px 18px; }
  .decision-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 12px; }
  .chip {
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase;
    color: var(--pending); border: 1px solid var(--pending); border-radius: 2px; padding: 2px 7px;
  }
  .decision-note { font-size: 12.5px; color: var(--muted); }
  .decision-fields { margin: 0; display: flex; flex-direction: column; gap: 7px; }
  .decision-fields > div { display: grid; grid-template-columns: 1fr; gap: 1px; }
  @media (min-width: 620px) { .decision-fields > div { grid-template-columns: 168px 1fr; gap: 14px; } }
  .decision-fields dt { font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted); }
  .decision-fields dd { margin: 0; }
  .empty { font-family: var(--mono); color: var(--muted); opacity: 0.55; }

  /* ── Thresholds ───────────────────────────────────────────── */
  .table-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 4px; background: var(--surface); }
  table { border-collapse: collapse; width: 100%; min-width: 480px; font-size: 14px; }
  th, td { text-align: left; padding: 11px 18px; border-bottom: 1px solid var(--line-soft); }
  tr:last-child th, tr:last-child td { border-bottom: 0; }
  tbody th { font-weight: 500; color: var(--ink); white-space: nowrap; }
  tbody td { color: var(--muted); font-variant-numeric: tabular-nums; }

  .closing { margin-top: 60px; padding-top: 26px; border-top: 1px solid var(--line); }
  .closing h2 { font-family: var(--serif); font-size: 20px; font-weight: 600; margin: 0 0 10px; }
  .closing p { max-width: 72ch; color: var(--muted); margin: 0 0 12px; }
  .colophon { font-size: 12.5px; color: var(--muted); margin-top: 26px; padding-top: 16px; border-top: 1px solid var(--line-soft); }
  .colophon code { font-size: 11.5px; }
</style>

<div class="wrap">
  <header class="masthead">
    <p class="eyebrow">CerviGrade · Clinical governance</p>
    <h1>CG-NCSP clinical governance review pack</h1>
    <p class="standfirst">
      Prepared for the named clinical approvers, risk owner and activation operators who must record the
      decisions below. <strong>Nothing in this document is an approval.</strong> Every decision field is
      empty and is completed inside CerviGrade, where it is bound to an authenticated identity, to the
      draft successor's revision, and to its exact content checksum.
    </p>
    <div class="tally">
      <div><span class="n">0 / ${cases.length}</span><span class="l">Clinical interpretations</span></div>
      <div><span class="n">0 / ${gates.length}</span><span class="l">Activation gates</span></div>
      <div><span class="n">0 / 2</span><span class="l">Independent approvers</span></div>
    </div>
  </header>

  <div class="precondition">
    <h2>Before any decision can be recorded</h2>
    <p>
      Clinical interpretations may only be recorded against a <strong>draft successor</strong>. The server
      refuses anything else: <q>Governance interpretation may only revise a draft successor.</q>
      CG-NCSP-3.1.0 is ACTIVE and is deciding new cases, so it cannot carry the register.
    </p>
    <ol>
      <li>Open <strong>Rule Studio</strong> and clone CG-NCSP-3.1.0 into a new draft, choosing the version identifier and change summary — both are written to the permanent audit trail under the identity of whoever performs the clone.</li>
      <li>Open <strong>Governance</strong>. The approval centre resolves the newest draft automatically and will then address the successor rather than the active version.</li>
      <li>Work through the clinical interpretations, then the activation gates.</li>
    </ol>
    <p>Two constraints apply throughout, and both are enforced by the server:</p>
    <ol>
      <li><strong>A proposer cannot approve their own interpretation.</strong> Two distinct authenticated clinical approvers are required.</li>
      <li><strong>Decisions are bound to the draft's checksum.</strong> Editing the draft's content after a decision invalidates that decision; it does not silently carry over.</li>
    </ol>
    <p>Decisions recorded by demonstration accounts are marked as demonstration attestations and are excluded from real activation gates.</p>
  </div>

  <div class="layout">
    <nav class="toc" aria-label="Contents">
      <h2>A · Interpretations</h2>
      <ol>${caseNav}</ol>
      <h2>B · Activation gates</h2>
      <ol>${gateNav}</ol>
    </nav>

    <main>
      <section aria-labelledby="part-a">
        <h2 class="part" id="part-a">Part A — Clinical interpretations</h2>
        <p class="part-note">
          Each case is a point where the source guidance admits more than one reading, and a named
          clinician must decide which reading the governed rules will carry.
        </p>
        <ul class="dispositions">${DISPOSITIONS.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
        ${caseBody}
      </section>

      <section aria-labelledby="part-b">
        <h2 class="part" id="part-b">Part B — Operational activation gates</h2>
        <p class="part-note">
          These are accountability decisions rather than clinical readings. Several name a specific
          accountable person and cannot be satisfied by engineering evidence alone.
        </p>
        ${gateBody}
      </section>

      <section aria-labelledby="thresholds">
        <h2 class="part" id="thresholds">Candidate rollback thresholds</h2>
        <p class="part-note">
          Referenced by <code>ROLLBACK-THRESHOLDS</code> above. The risk owner approves this set or requests a change.
        </p>
        <div class="table-scroll">
          <table>
            <thead><tr><th scope="col">Signal</th><th scope="col">Candidate threshold</th></tr></thead>
            <tbody>${thresholds}</tbody>
          </table>
        </div>
      </section>

      <div class="closing">
        <h2>What is not covered here</h2>
        <p>
          This pack covers the register and the gates. It does not authorise a Production activation, and
          completing it does not perform one. Production activation is a separate controlled step requiring
          an activation operator and a distinct deputy, both different from the two clinical approvers.
        </p>
        <p class="colophon">
          Generated from <code>CLINICAL_GOVERNANCE_CASES</code> (${cases.length}) and
          <code>ACTIVATION_GATE_DEFINITIONS</code> (${gates.length}) by
          <code>scripts/governance/build-review-pack.ts</code>. Regenerate after any change to those
          definitions so the pack cannot describe a case differently from the ledger.
        </p>
      </div>
    </main>
  </div>
</div>
`;
}

const target = process.argv[2] ?? join(process.cwd(), "docs", "governance", "clinical-review-pack.md");
writeFileSync(target, build(), "utf8");

const htmlTarget = process.argv[3] ?? target.replace(/\.md$/, ".html");
writeFileSync(htmlTarget, buildHtml(), "utf8");

console.log(
  `Wrote ${target} and ${htmlTarget}: ${CLINICAL_GOVERNANCE_CASES.length} clinical interpretations, ${ACTIVATION_GATE_DEFINITIONS.length} activation gates. No decision recorded.`
);
