CREATE TABLE "SearchLoopControl" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "generatorType" TEXT NOT NULL DEFAULT 'RANDOM',
    "pair" TEXT NOT NULL DEFAULT 'BTCUSDT',
    "timeframe" TEXT NOT NULL DEFAULT '1h',
    "backtestWindowDays" INTEGER NOT NULL DEFAULT 180,
    "initialCapital" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "positionSizePercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "commission" DOUBLE PRECISION,
    "slippage" DOUBLE PRECISION,
    "maxCandidatesPerRun" INTEGER DEFAULT 100,
    "maxDurationMsPerRun" INTEGER,
    "stopOnNoImprovementIterations" INTEGER NOT NULL DEFAULT 50,
    "cooldownMs" INTEGER NOT NULL DEFAULT 30000,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "lastStartedRunId" TEXT,
    "lastError" TEXT,
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchLoopControl_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchLoopControl_enabled_nextRunAt_idx"
ON "SearchLoopControl"("enabled", "nextRunAt");

CREATE INDEX "SearchLoopControl_leaseUntil_idx"
ON "SearchLoopControl"("leaseUntil");
