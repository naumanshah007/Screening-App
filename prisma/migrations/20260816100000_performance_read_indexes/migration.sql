-- Additive read-path indexes for the bounded Review Queue and Completed Decisions lists.
-- These do not alter clinical facts, rules, authority, or audit evidence.
CREATE INDEX IF NOT EXISTS "BatchReviewItem_disposition_reviewRequired_createdAt_idx"
ON "BatchReviewItem"("disposition", "reviewRequired", "createdAt");

CREATE INDEX IF NOT EXISTS "BatchReviewItem_disposition_reviewedAt_idx"
ON "BatchReviewItem"("disposition", "reviewedAt");
