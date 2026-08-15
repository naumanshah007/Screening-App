-- Additive real-data pilot security boundary. The accepted Sprint A migration
-- remains immutable; no existing row is rewritten or deleted here.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AuditLog" ADD COLUMN "integrityDigest" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "protectedAt" DATETIME;

-- Only rows deliberately written as protected evidence are append-only. This
-- preserves deterministic local demo reset for historical/unprotected rows.
CREATE TRIGGER "AuditLog_protected_update"
BEFORE UPDATE ON "AuditLog"
WHEN OLD."integrityDigest" IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Protected audit evidence is immutable');
END;

CREATE TRIGGER "AuditLog_protected_delete"
BEFORE DELETE ON "AuditLog"
WHEN OLD."integrityDigest" IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Protected audit evidence is immutable');
END;
