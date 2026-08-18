const CASE_RULE_VIEW_ROLES = new Set([
  "ADMIN",
  "SMO_REVIEWER",
  "COLPO_CNS",
  "GYNAE_GRADER",
  "COLPOSCOPIST",
]);

const CASE_RULE_DRAFT_EDITOR_ROLES = new Set(["ADMIN"]);

const CASE_RULE_REVIEW_ROLES = new Set([
  "SMO_REVIEWER",
  "COLPO_CNS",
  "GYNAE_GRADER",
  "COLPOSCOPIST",
]);

const CASE_RULE_ACTIVATION_ROLES = new Set(["ADMIN"]);

function hasRole(role: string | null | undefined, roles: Set<string>) {
  return typeof role === "string" && roles.has(role);
}

export function canViewCaseRuleReleases(role?: string | null) {
  return hasRole(role, CASE_RULE_VIEW_ROLES);
}

export function canEditCaseRuleDrafts(role?: string | null) {
  return hasRole(role, CASE_RULE_DRAFT_EDITOR_ROLES);
}

export function canReviewCaseRuleReleases(role?: string | null) {
  return hasRole(role, CASE_RULE_REVIEW_ROLES);
}

export function canActivateCaseRuleReleases(role?: string | null) {
  return hasRole(role, CASE_RULE_ACTIVATION_ROLES);
}

export function canManageCaseRuleReleases(role?: string | null) {
  return canViewCaseRuleReleases(role);
}
