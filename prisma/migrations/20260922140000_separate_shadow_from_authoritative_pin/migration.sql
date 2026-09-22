-- Separate shadow comparison provenance from authoritative pin provenance.
--
-- pinnedRuleVersion* previously received the SHADOW ruleset whenever authority
-- was LEGACY, so a run decided by the legacy engine carried a governed version
-- and checksum in the fields that mean "this ruleset decided". These columns
-- give the observing ruleset somewhere truthful to live.
ALTER TABLE "BatchRun" ADD COLUMN "shadowRuleVersionId" TEXT;
ALTER TABLE "BatchRun" ADD COLUMN "shadowRuleVersionDisplay" TEXT;
ALTER TABLE "BatchRun" ADD COLUMN "shadowRulesetChecksum" TEXT;
ALTER TABLE "BatchRun" ADD COLUMN "shadowEvaluationMode" TEXT;

-- Existing rows: every historical run was decided by LEGACY (no ruleset has
-- ever been activated), so any pin present is a shadow version in the wrong
-- column. Move it rather than dropping it — it is real comparison evidence.
UPDATE "BatchRun"
SET "shadowRuleVersionId"      = "pinnedRuleVersionId",
    "shadowRuleVersionDisplay" = "pinnedRuleVersionDisplay",
    "shadowRulesetChecksum"    = "pinnedRulesetChecksum",
    "shadowEvaluationMode"     = 'SHADOW',
    "pinnedRuleVersionId"      = NULL,
    "pinnedRuleVersionDisplay" = NULL,
    "pinnedRulesetChecksum"    = NULL
WHERE "pinnedRuleVersionId" IS NOT NULL;
