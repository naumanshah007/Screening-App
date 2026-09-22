/**
 * The controlled clinical evaluation boundary.
 *
 * An evaluator who can change a rule version, or edit a supplied case, can
 * invalidate their own evaluation without noticing — and the resulting evidence
 * would not show that it happened. These tests pin the boundary at the layer
 * that actually enforces it: the permission gate and the route guard, not the
 * presence or absence of a button.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { getApiPermissionError } from "../../lib/auth/api-permissions";
import {
  EVALUATION_DENIED_PERMISSIONS,
  isEvaluationAccount,
  isRouteDeniedInEvaluationMode,
  isSourceTypeAllowedInEvaluationMode,
} from "../../lib/auth/evaluation-mode";

const evaluator = { id: "u1", role: "GYNAE_GRADER", email: "chchadmin@cs.nz" };
const ordinaryGrader = { id: "u2", role: "GYNAE_GRADER", email: "clinician@cs.nz" };

test("the evaluation account is recognised, case- and whitespace-insensitively", () => {
  assert.equal(isEvaluationAccount(evaluator), true);
  assert.equal(isEvaluationAccount({ email: "  CHCHadmin@CS.NZ  " }), true);
  assert.equal(isEvaluationAccount(ordinaryGrader), false);
  assert.equal(isEvaluationAccount({ email: null }), false);
  assert.equal(isEvaluationAccount(undefined), false);
});

test("every denied capability is refused for the evaluator", () => {
  for (const permission of EVALUATION_DENIED_PERMISSIONS) {
    const error = getApiPermissionError(evaluator, permission);
    assert.ok(error, `${permission} must be refused for an evaluation account`);
    assert.equal(error.status, 403);
  }
});

test("rule governance in particular is refused", () => {
  // The evaluation is of a ruleset. An evaluator able to change it mid-review
  // would be evaluating something other than what was frozen.
  for (const permission of ["rules:edit", "rules:publish", "rules:activate", "rules:rollback"] as const) {
    assert.ok(getApiPermissionError(evaluator, permission), `${permission} must be refused`);
  }
});

test("the evaluation workflow itself is not blocked", () => {
  // Pull, process, review, and record a disposition — the whole point of the
  // account. A boundary that also blocks these is useless.
  for (const permission of ["batch:view", "batch:manage", "cases:view", "cases:grade", "decisions:view"] as const) {
    assert.equal(
      getApiPermissionError(evaluator, permission),
      null,
      `${permission} must remain available to the evaluator`
    );
  }
});

test("the boundary applies to the account, not to the role", () => {
  // An ordinary grader keeps whatever their role grants; the deny layer is
  // scoped to the evaluation identity.
  assert.equal(getApiPermissionError(ordinaryGrader, "rules:validate"), null);
  assert.ok(getApiPermissionError(evaluator, "rules:validate"));
});

test("an unauthenticated caller is refused before the boundary is consulted", () => {
  const error = getApiPermissionError({ email: "chchadmin@cs.nz" }, "batch:view");
  assert.ok(error);
  assert.equal(error.status, 401);
});

test("governance and administration routes are denied", () => {
  for (const route of [
    "/rules",
    "/rules/clinical",
    "/admin",
    "/admin/users",
    "/governance/clinical",
    "/audit",
    "/cases/new",
    "/patients",
  ]) {
    assert.equal(isRouteDeniedInEvaluationMode(route), true, `${route} must be denied`);
  }
});

test("the evaluation workflow routes stay reachable", () => {
  for (const route of ["/batch", "/review", "/decisions", "/dashboard", "/guidelines", "/analytics"]) {
    assert.equal(isRouteDeniedInEvaluationMode(route), false, `${route} must stay reachable`);
  }
});

test("a denied prefix does not deny an unrelated route that merely starts with the same letters", () => {
  // "/rules" must not deny "/rulesomething"; prefix matching is on segments.
  assert.equal(isRouteDeniedInEvaluationMode("/rulesets-public"), false);
  assert.equal(isRouteDeniedInEvaluationMode("/administration-guide"), false);
});

test("only the supplied CHCH case set may be ingested", () => {
  assert.equal(isSourceTypeAllowedInEvaluationMode("chchPublic"), true);

  // Anything that would introduce cases the clinician did not supply.
  for (const sourceType of ["csv", "xlsx", "json", "manual", "demo", "hl7", "fhir", "erms", "health-nz"]) {
    assert.equal(
      isSourceTypeAllowedInEvaluationMode(sourceType),
      false,
      `${sourceType} must not be ingestible in evaluation mode`
    );
  }
});
