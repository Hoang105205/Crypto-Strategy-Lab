-- Backfill existing results before enforcing the producer-job idempotency key.
-- This migration is intentionally safe to generate/review without applying it.
ALTER TABLE "BacktestResult" ADD COLUMN "jobId" TEXT;

UPDATE "BacktestResult"
SET "jobId" = "id"
WHERE "jobId" IS NULL;

ALTER TABLE "BacktestResult" ALTER COLUMN "jobId" SET NOT NULL;

CREATE UNIQUE INDEX "BacktestResult_jobId_key" ON "BacktestResult"("jobId");
