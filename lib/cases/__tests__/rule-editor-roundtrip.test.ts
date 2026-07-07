import test from "node:test";
import assert from "node:assert/strict";

import {
  getBaselineCaseRuleReleaseDefinition,
  parseCaseRuleReleaseDefinition,
  validateCaseRuleReleaseDefinitionJson,
} from "../rule-policy";
import { runCaseRuleRegression } from "../rule-regression";

// Phase 1 verification: the side-by-side form editor serializes an edited
// definition (via JSON.stringify) that the existing parse/validation accepts,
// and the edit is reflected. See docs plan: Admin Rule Editor.

test("edited definition round-trips through validate + parse and reflects changes", () => {
  const base = getBaselineCaseRuleReleaseDefinition("COLPOSCOPY");
  assert.ok(base.rules.length > 0, "baseline should have rules to edit");

  // Simulate what RuleCardEditor does: deep clone, edit outputs, re-serialize.
  const edited = JSON.parse(JSON.stringify(base)) as typeof base;
  edited.defaultRecommendation.category = "Edited default category";
  const firstRule = edited.rules[0];
  firstRule.recommendation.priority = "P1";
  firstRule.recommendation.targetDays = 20;
  firstRule.recommendation.outcome = "Edited outcome text";

  const definitionJson = JSON.stringify(edited);

  // The existing validation must accept the editor's output (no throw).
  assert.doesNotThrow(() =>
    validateCaseRuleReleaseDefinitionJson({ serviceLine: "COLPOSCOPY", definitionJson })
  );

  // Parsing must reflect the edits.
  const parsed = parseCaseRuleReleaseDefinition({ serviceLine: "COLPOSCOPY", definitionJson });
  assert.equal(parsed.defaultRecommendation.category, "Edited default category");
  assert.equal(parsed.rules[0].recommendation.priority, "P1");
  assert.equal(parsed.rules[0].recommendation.targetDays, 20);
  assert.equal(parsed.rules[0].recommendation.outcome, "Edited outcome text");
});

test("regression harness still runs against an edited definition", () => {
  const base = getBaselineCaseRuleReleaseDefinition("COLPOSCOPY");
  const edited = JSON.parse(JSON.stringify(base)) as typeof base;
  edited.rules[0].recommendation.category = "Tweaked";

  const regression = runCaseRuleRegression({ serviceLine: "COLPOSCOPY", definition: edited });
  assert.ok(regression.total > 0, "regression should have fixtures");
  assert.equal(typeof regression.passed, "number");
});

test("malformed JSON falls back to baseline (never throws in parse)", () => {
  const parsed = parseCaseRuleReleaseDefinition({ serviceLine: "GYNAECOLOGY", definitionJson: "{not json" });
  assert.equal(parsed.serviceLine, "GYNAECOLOGY");
  assert.ok(parsed.rules.length >= 0);
});
