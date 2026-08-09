-- Clinical evidence is append-only. A regrade creates a linked RuleEvaluation;
-- it never edits the earlier result.
CREATE TRIGGER "RuleEvaluation_immutable_update"
BEFORE UPDATE ON "RuleEvaluation"
BEGIN
  SELECT RAISE(ABORT, 'Clinical rule evaluations are immutable');
END;

CREATE TRIGGER "RuleEvaluation_immutable_delete"
BEFORE DELETE ON "RuleEvaluation"
BEGIN
  SELECT RAISE(ABORT, 'Clinical rule evaluations are immutable');
END;

-- The national rule audit trail is append-only.
CREATE TRIGGER "RuleVersionAuditEvent_immutable_update"
BEFORE UPDATE ON "RuleVersionAuditEvent"
BEGIN
  SELECT RAISE(ABORT, 'Clinical rule audit events are immutable');
END;

CREATE TRIGGER "RuleVersionAuditEvent_immutable_delete"
BEFORE DELETE ON "RuleVersionAuditEvent"
BEGIN
  SELECT RAISE(ABORT, 'Clinical rule audit events are immutable');
END;

-- A draft identity that has already produced evidence must be cloned to a new
-- semantic version before its governed snapshot can change.
CREATE TRIGGER "ClinicalRuleVersion_evaluated_snapshot_update"
BEFORE UPDATE OF "ruleSetId", "versionMajor", "versionMinor", "versionPatch", "displayVersion", "snapshotJson", "checksum"
ON "ClinicalRuleVersion"
WHEN EXISTS (
  SELECT 1 FROM "RuleEvaluation" WHERE "ruleVersionId" = OLD."id" LIMIT 1
)
BEGIN
  SELECT RAISE(ABORT, 'Evaluated clinical rule version identities are immutable');
END;
