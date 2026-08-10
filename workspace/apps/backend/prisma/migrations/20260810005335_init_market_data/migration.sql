-- CreateTable
CREATE TABLE "Candle" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "openTime" TIMESTAMP(3) NOT NULL,
    "closeTime" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "isClosed" BOOLEAN NOT NULL,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingPair" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "baseAsset" TEXT NOT NULL,
    "quoteAsset" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TradingPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyVersion" (
    "id" TEXT NOT NULL,
    "strategyType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "parameters" JSONB NOT NULL,
    "parentVersionId" TEXT,
    "isComposite" BOOLEAN NOT NULL DEFAULT false,
    "childVersionIds" TEXT[],
    "combinerType" TEXT,
    "combinerWeights" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestResult" (
    "id" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalReturn" DOUBLE PRECISION NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "sharpeRatio" DOUBLE PRECISION NOT NULL,
    "profitFactor" DOUBLE PRECISION NOT NULL,
    "totalTrades" INTEGER NOT NULL,
    "trades" JSONB NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executionTimeMs" INTEGER NOT NULL,

    CONSTRAINT "BacktestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "crawledAt" TIMESTAMP(3) NOT NULL,
    "relatedCoins" TEXT[],
    "sentimentScore" DOUBLE PRECISION NOT NULL,
    "sentimentLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentimentScore" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentimentScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "strategyName" TEXT NOT NULL,
    "strategyType" TEXT NOT NULL,
    "isComposite" BOOLEAN NOT NULL,
    "backtestResultId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "totalReturn" DOUBLE PRECISION NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "sharpeRatio" DOUBLE PRECISION NOT NULL,
    "totalTrades" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLoopRun" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "generatorType" TEXT NOT NULL,
    "iteration" INTEGER NOT NULL DEFAULT 0,
    "testedCandidates" INTEGER NOT NULL DEFAULT 0,
    "maxCandidates" INTEGER,
    "maxDurationMs" INTEGER,
    "stopOnNoImprovementIterations" INTEGER DEFAULT 50,
    "currentCandidateStrategyVersionId" TEXT,
    "bestStrategyVersionId" TEXT,
    "bestScore" DOUBLE PRECISION,
    "stopReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "SearchLoopRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLoopCandidate" (
    "id" TEXT NOT NULL,
    "loopRunId" TEXT NOT NULL,
    "strategyVersionId" TEXT NOT NULL,
    "backtestResultId" TEXT,
    "iteration" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLoopCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeadLetterJob" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL,
    "lastError" TEXT NOT NULL,
    "deadLetteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DeadLetterJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candle_symbol_timeframe_openTime_idx" ON "Candle"("symbol", "timeframe", "openTime");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_symbol_timeframe_openTime_key" ON "Candle"("symbol", "timeframe", "openTime");

-- CreateIndex
CREATE UNIQUE INDEX "TradingPair_symbol_key" ON "TradingPair"("symbol");

-- CreateIndex
CREATE INDEX "StrategyVersion_strategyType_idx" ON "StrategyVersion"("strategyType");

-- CreateIndex
CREATE INDEX "BacktestResult_strategyVersionId_idx" ON "BacktestResult"("strategyVersionId");

-- CreateIndex
CREATE INDEX "BacktestResult_pair_timeframe_idx" ON "BacktestResult"("pair", "timeframe");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_url_key" ON "NewsArticle"("url");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_source_idx" ON "NewsArticle"("source");

-- CreateIndex
CREATE INDEX "SentimentScore_articleId_idx" ON "SentimentScore"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_backtestResultId_key" ON "LeaderboardEntry"("backtestResultId");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_rank_idx" ON "LeaderboardEntry"("rank");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_strategyVersionId_idx" ON "LeaderboardEntry"("strategyVersionId");

-- CreateIndex
CREATE INDEX "SearchLoopRun_status_idx" ON "SearchLoopRun"("status");

-- CreateIndex
CREATE INDEX "SearchLoopCandidate_loopRunId_idx" ON "SearchLoopCandidate"("loopRunId");

-- CreateIndex
CREATE UNIQUE INDEX "DeadLetterJob_jobId_key" ON "DeadLetterJob"("jobId");

-- AddForeignKey
ALTER TABLE "BacktestResult" ADD CONSTRAINT "BacktestResult_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentimentScore" ADD CONSTRAINT "SentimentScore_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchLoopCandidate" ADD CONSTRAINT "SearchLoopCandidate_loopRunId_fkey" FOREIGN KEY ("loopRunId") REFERENCES "SearchLoopRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
