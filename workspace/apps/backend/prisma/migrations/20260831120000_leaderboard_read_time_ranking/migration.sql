-- Rank is computed at read time. The legacy rank column remains for backwards
-- compatibility, but its index no longer serves any query.
DROP INDEX IF EXISTS "LeaderboardEntry_rank_idx";

CREATE INDEX "LeaderboardEntry_score_idx"
ON "LeaderboardEntry"("score" DESC);

CREATE INDEX "LeaderboardEntry_userId_score_idx"
ON "LeaderboardEntry"("userId", "score" DESC);

CREATE INDEX "LeaderboardEntry_strategyVersionId_score_idx"
ON "LeaderboardEntry"("strategyVersionId", "score" DESC);
