/**
 * Guards the conformance alias registry against collapsing clinically distinct
 * dispositions.
 *
 * Background: the registry previously accepted `TEST_OF_CURE` as satisfying a
 * `FIGURE_5_COTEST_SURVEILLANCE` expectation, and `URGENT_GYNAECOLOGY` as
 * satisfying `GLANDULAR_SPECIALIST_ROUTE`. Both mask real clinical differences.
 * These tests fail if either is reintroduced.
 *
 * This strengthens the test oracle only. It changes no clinical rule and relaxes
 * no safety boundary.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { equivalent } from "./support/conformance-runner";

test("Figure 5 surveillance does not pass as Figure 6 Test of Cure", () => {
  assert.equal(
    equivalent("FIGURE_5_COTEST_SURVEILLANCE", "TEST_OF_CURE"),
    false,
    "Figure 5 co-test surveillance must not be satisfied by a Test of Cure result: Figure 5 implies no HSIL treatment and no treatment date"
  );
  assert.equal(equivalent("FIGURE_5_COTEST_SURVEILLANCE", "CONTINUE_TOC"), false);
  assert.equal(equivalent("FIGURE_5_COTEST_SURVEILLANCE", "TOC_COMPLETE"), false);
});

test("Figure 6 Test of Cure does not pass as Figure 5 surveillance", () => {
  assert.equal(
    equivalent("TEST_OF_CURE", "FIGURE_5_COTEST_SURVEILLANCE"),
    false,
    "Test of Cure must not be satisfied by Figure 5 surveillance: Figure 6 is reachable only once post-treatment facts exist"
  );
  assert.equal(equivalent("CONTINUE_TOC", "FIGURE_5_COTEST_SURVEILLANCE"), false);
  assert.equal(equivalent("TOC_COMPLETE", "FIGURE_5_COTEST_SURVEILLANCE"), false);
});

test("ordinary and urgent referrals are not interchangeable", () => {
  assert.equal(equivalent("GYNAECOLOGY", "URGENT_GYNAECOLOGY"), false);
  assert.equal(equivalent("URGENT_GYNAECOLOGY", "GYNAECOLOGY"), false);
  assert.equal(equivalent("COLPOSCOPY", "URGENT_COLPOSCOPY"), false);
  assert.equal(
    equivalent("GLANDULAR_SPECIALIST_ROUTE", "URGENT_GYNAECOLOGY"),
    false,
    "the glandular specialist route must not be satisfied by an urgent gynaecology referral"
  );
});

test("treatment recommendation is not satisfied by completed treatment", () => {
  assert.equal(equivalent("TREATMENT", "TOC_COMPLETE"), false);
});

test("routine recall is not satisfied by no further screening", () => {
  assert.equal(equivalent("ROUTINE_RECALL", "NO_FURTHER_SCREENING"), false);
});

test("presentation aliases are still accepted where the disposition is unchanged", () => {
  // Same action, timing, destination and pathway provenance under another name.
  assert.equal(equivalent("FIGURE_5_COTEST_SURVEILLANCE", "REPEAT_COTEST"), true);
  assert.equal(equivalent("GLANDULAR_SPECIALIST_ROUTE", "COLPOSCOPY"), true);
  assert.equal(equivalent("GLANDULAR_SPECIALIST_ROUTE", "GYNAECOLOGY"), true);
  assert.equal(equivalent("SPECIALIST_FOLLOW_UP", "COLPOSCOPY"), true);
  // Identity always holds.
  assert.equal(equivalent("COLPOSCOPY", "COLPOSCOPY"), true);
});
