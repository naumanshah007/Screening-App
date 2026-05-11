const CASE_RULE_GOVERNANCE_ROLES = new Set([
  "ADMIN",
  "SMO_REVIEWER",
  "COLPO_CNS",
  "GYNAE_GRADER",
  "COLPOSCOPIST",
]);

export function canManageCaseRuleReleases(role?: string | null) {
  return typeof role === "string" && CASE_RULE_GOVERNANCE_ROLES.has(role);
}
