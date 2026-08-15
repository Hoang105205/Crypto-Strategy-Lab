-- T004: Event Infrastructure persistence fields.
-- Review-only migration: Hoang must approve before this is applied.

-- Leaderboard rows have a safe source timestamp available for backfill.
ALTER TABLE "LeaderboardEntry" ADD COLUMN "executedAt" TIMESTAMP(3);
UPDATE "LeaderboardEntry"
SET "executedAt" = "createdAt"
WHERE "executedAt" IS NULL;
ALTER TABLE "LeaderboardEntry" ALTER COLUMN "executedAt" SET NOT NULL;

-- Existing candidates cannot be assigned a trustworthy producer jobId. Abort
-- instead of inventing correlation identities if the skeleton table has data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "SearchLoopCandidate" LIMIT 1) THEN
    RAISE EXCEPTION
      'SearchLoopCandidate is not empty; backfill jobId from the producer source before applying this migration';
  END IF;
END $$;

ALTER TABLE "SearchLoopCandidate"
  ADD COLUMN "jobId" TEXT NOT NULL,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "SearchLoopCandidate_jobId_key"
  ON "SearchLoopCandidate"("jobId");

-- The no-improvement safety bound must always remain active.
UPDATE "SearchLoopRun"
SET "stopOnNoImprovementIterations" = 50
WHERE "stopOnNoImprovementIterations" IS NULL;

ALTER TABLE "SearchLoopRun"
  ALTER COLUMN "stopOnNoImprovementIterations" SET DEFAULT 50,
  ALTER COLUMN "stopOnNoImprovementIterations" SET NOT NULL;
