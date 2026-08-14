/**
 * Guidelines reads as clinical guidance, not as architecture.
 *
 * FOUR DEFECTS THESE LOCK
 * -----------------------
 * 1. The page heading badged the ruleset "Canonical CG-NCSP-3.1.0". "Canonical"
 *    is an internal term for which engine decides; a clinician reading the
 *    guidelines they must follow has no way to interpret it.
 * 2. A truncated SHA-256 sat in the page heading. It identifies exactly what
 *    ran — provenance, not guidance — and belongs with the rest of the
 *    provenance, which is where it now lives.
 * 3. A local Counties Manukau booking policy was listed as a peer of the
 *    national guidelines, without saying it was local or that it schedules care
 *    rather than deciding it.
 * 4. The legacy pathway router sat in the same list, implying an engineering
 *    provenance note was clinical reference material of the same kind.
 *
 * The wording is all that changes. Which engine is authoritative, and whether
 * an evaluation is operative, are decided identically in both presentations —
 * asserted below, because a "terminology" change that quietly altered authority
 * display would be a clinical-safety defect.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const HOME = read("app/(app)/guidelines/GuidelinesHome.tsx");
const BADGE = read("components/clinical-rules/ClinicalAuthorityBadge.tsx");
const LABELS = read("lib/clinical-rules/labels.ts");
const CURRENT = read("lib/clinical-rules/current-ruleset.ts");

test("the clinician-facing labels are client-safe", () => {
  // Their previous home imports Prisma; a client component importing a label
  // from there pulls the database client into the browser bundle.
  assert.doesNotMatch(
    LABELS,
    /^import /m,
    "the labels module must stay import-free"
  );
  assert.match(LABELS, /CURRENT_RULES_LABEL = "Current governed rules"/);
  assert.match(
    CURRENT,
    /export \{[\s\S]{0,120}CURRENT_RULES_LABEL,[\s\S]{0,80}\} from "@\/lib\/clinical-rules\/labels"/,
    "current-ruleset must re-export rather than redefine the labels"
  );
});

test("Guidelines names the ruleset the way a clinician would", () => {
  assert.match(
    HOME,
    /presentation="clinical"/,
    "the Guidelines badge must use the clinical presentation"
  );
  assert.match(
    BADGE,
    /clinical\s*\n?\s*\? `\$\{CURRENT_RULES_LABEL\} · \$\{ruleSetVersion\}`/,
    "the clinical badge must say 'Current governed rules', not 'Canonical'"
  );
  assert.match(
    BADGE,
    /clinical\s*\n?\s*\? "Previous grading rules"/,
    "the clinical badge must not say 'Legacy' to a clinician"
  );
  // The technical wording survives for provenance surfaces.
  assert.ok(BADGE.includes("`Canonical ${ruleSetVersion}`"));
  assert.ok(BADGE.includes('"Legacy"'));
});

test("the checksum moved to technical provenance", () => {
  assert.match(
    BADGE,
    /isCanonicalAuthority && isOperative && !clinical \?/,
    "the checksum must be suppressed in the clinical presentation"
  );
  // Suppressed on the heading, still shown on the page.
  assert.match(HOME, /Snapshot checksum/);
  assert.match(HOME, /Technical provenance and governance record/);
});

test("presentation changes wording only, never authority", () => {
  assert.match(
    BADGE,
    /const isCanonicalAuthority = authorityEngine === "CANONICAL" && Boolean\(ruleSetVersion\)/
  );
  assert.match(
    BADGE,
    /evaluationMode === "LIVE_PRODUCTION" \|\| evaluationMode === "LIVE_DEMO"/
  );
  // Neither predicate may consult the presentation.
  for (const line of BADGE.split("\n")) {
    if (/isCanonicalAuthority =|const isOperative =/.test(line)) {
      assert.ok(
        !/clinical|presentation/.test(line),
        `authority must not depend on presentation: ${line.trim()}`
      );
    }
  }
});

test("local policy and technical provenance are separate sections", () => {
  assert.match(HOME, /Local operational policy/);
  assert.match(HOME, /Technical references/);
  assert.doesNotMatch(
    HOME,
    /Additional references/,
    "the merged reference list must be gone"
  );
  assert.match(
    HOME,
    /it schedules care, it does not decide the clinical\s*\n?\s*recommendation/,
    "local policy must say what it does and does not decide"
  );
  assert.match(
    HOME,
    /Provenance for auditors and administrators\. Not clinical guidance\./,
    "the technical section must disclaim being guidance"
  );
  assert.match(
    HOME,
    /title="Pathway router reference"/,
    "the router reference must not be badged 'Legacy' on a clinical page"
  );
});
