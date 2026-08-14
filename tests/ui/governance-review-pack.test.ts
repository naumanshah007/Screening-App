/**
 * The governance review pack must stay a preparation document.
 *
 * TWO RISKS THIS GUARDS
 * ---------------------
 * 1. DRIFT. Approvers read the pack and then record a decision in the app. If
 *    the pack described a case differently from CLINICAL_GOVERNANCE_CASES, an
 *    approver would be attesting to one thing while the ledger recorded
 *    another. The pack is generated from those constants; this asserts it was
 *    regenerated and still covers every case and gate.
 *
 * 2. A DOCUMENT THAT LOOKS SIGNED. A tool-produced file containing approver
 *    names, dispositions or dates could be mistaken for the register itself.
 *    Every decision field must stay empty, and the pack must keep saying that
 *    the decision belongs in the application, bound to an authenticated
 *    identity and to the draft's checksum.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ACTIVATION_GATE_DEFINITIONS } from "../../lib/clinical-rules/activation-governance";
import { CLINICAL_GOVERNANCE_CASES } from "../../lib/clinical-rules/governance-review";

const ROOT = join(__dirname, "..", "..");
const PACK = readFileSync(join(ROOT, "docs", "governance", "clinical-review-pack.md"), "utf8");
const HTML = readFileSync(join(ROOT, "docs", "governance", "clinical-review-pack.html"), "utf8");
const SCRIPT = readFileSync(
  join(ROOT, "scripts", "governance", "build-review-pack.ts"),
  "utf8"
);

test("every clinical interpretation case appears in the pack", () => {
  for (const item of CLINICAL_GOVERNANCE_CASES) {
    assert.ok(PACK.includes(item.caseId), `pack is stale: missing ${item.caseId}`);
    assert.ok(PACK.includes(item.title), `pack is stale: missing title for ${item.caseId}`);
    assert.ok(
      PACK.includes(item.competingInterpretation),
      `pack must state the competing reading for ${item.caseId}`
    );
  }
  assert.match(
    PACK,
    new RegExp(`Part A — Clinical interpretations \\(${CLINICAL_GOVERNANCE_CASES.length}\\)`)
  );
});

test("every activation gate appears in the pack", () => {
  for (const gate of ACTIVATION_GATE_DEFINITIONS) {
    assert.ok(PACK.includes(gate.gateId), `pack is stale: missing ${gate.gateId}`);
    assert.ok(PACK.includes(gate.question), `pack must state the question for ${gate.gateId}`);
  }
  assert.match(
    PACK,
    new RegExp(`Part B — Operational activation gates \\(${ACTIVATION_GATE_DEFINITIONS.length}\\)`)
  );
});

test("the pack records no decision", () => {
  assert.match(PACK, /\*\*Nothing in this document is an approval\.\*\*/);
  // Decision cells must be placeholders, never a name, disposition or date.
  const decisionRows = PACK.split("\n").filter((line) =>
    /^\| (Disposition|Decision|Approver|Accountable owner|Date|Reviewer comments|Comments) \|/.test(line)
  );
  assert.ok(decisionRows.length > 0, "the pack must carry decision fields to be filled in");
  for (const row of decisionRows) {
    assert.match(
      row,
      /_\(.*recorded in the app.*\)_/,
      `decision field must stay an empty placeholder: ${row}`
    );
  }
});

test("the circulated HTML edition records no decision either", () => {
  // This is the edition that gets shared with people who will not clone the
  // repository, so it is the one most likely to be mistaken for the register.
  assert.match(HTML, /<strong>Nothing in this document is an approval\.<\/strong>/);

  // Every decision cell must still be the empty placeholder.
  const cells = HTML.match(/<dd class="empty"[^>]*>([^<]*)</g) ?? [];
  assert.ok(cells.length > 0, "the HTML must carry decision fields to be filled in");
  for (const cell of cells) {
    assert.match(cell, />—<$/, `decision cell must stay empty: ${cell}`);
  }

  // Both editions must describe the same register.
  for (const item of CLINICAL_GOVERNANCE_CASES) {
    assert.ok(HTML.includes(item.caseId), `HTML edition is stale: missing ${item.caseId}`);
  }
  for (const gate of ACTIVATION_GATE_DEFINITIONS) {
    assert.ok(HTML.includes(gate.gateId), `HTML edition is stale: missing ${gate.gateId}`);
  }
  assert.match(
    HTML,
    new RegExp(`>0 / ${CLINICAL_GOVERNANCE_CASES.length}<`),
    "the tally must show the register as unstarted"
  );
});

test("the pack states the constraints that make a decision valid", () => {
  assert.match(
    PACK,
    /Governance interpretation may only revise a draft successor/,
    "approvers must be told why the active version cannot carry the register"
  );
  assert.match(
    PACK,
    /A proposer cannot approve their own interpretation/,
    "separation of duties must be stated"
  );
  assert.match(
    PACK,
    /Editing the draft's content after a\s*\n?\s*decision invalidates that decision/,
    "checksum binding must be stated"
  );
  assert.match(
    PACK,
    /excluded from real activation gates/,
    "demo attestations must be named as excluded"
  );
  assert.match(
    PACK,
    /It does not authorise a Production\s*\n?\s*activation/,
    "the pack must not read as activation authority"
  );
});

test("the generator writes nothing to the database", () => {
  assert.doesNotMatch(
    SCRIPT,
    /from "@\/lib\/prisma"|prisma\./,
    "the pack generator must not touch the database"
  );
  for (const name of [
    "recordClinicalGovernanceReview",
    "recordActivationGateDecision",
    "cloneClinicalRuleVersion",
    "activateClinicalRuleVersion",
  ]) {
    assert.ok(!SCRIPT.includes(name), `the generator must not call ${name}`);
  }
});
