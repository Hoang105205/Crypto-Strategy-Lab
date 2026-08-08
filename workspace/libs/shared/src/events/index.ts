// Event types & payloads — sourced from kb/contracts/events.yaml
// Owner: Phuong | Status: Active

import { Candle } from '../types/market-data';
import { BacktestConfig, EvaluationMetrics } from '../types/strategy';
import { BacktestSource } from '../types/enums';
import { LeaderboardEntryPayload } from '../types/infrastructure';

export const EventType = {
  MarketDataUpdated: 'MarketDataUpdated',
  BacktestRequested: 'BacktestRequested',
  BacktestCompleted: 'BacktestCompleted',
  BacktestFailed: 'BacktestFailed',
  BacktestDeadLettered: 'BacktestDeadLettered',
  LeaderboardUpdated: 'LeaderboardUpdated',
  SearchLoopStarted: 'SearchLoopStarted',
  SearchLoopProgress: 'SearchLoopProgress',
  SearchLoopStopped: 'SearchLoopStopped',
  NewsCollected: 'NewsCollected',
} as const;

export interface MarketDataUpdatedPayload {
  symbol: string;
  timeframe: string;
  candle: Candle;
}

export interface BacktestRequestedPayload {
  jobId: string;
  strategyVersionId: string;
  pair: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  backtestConfig: BacktestConfig;
  source: BacktestSource;
  loopRunId?: string;
}

export interface BacktestCompletedPayload {
  jobId: string;
  correlationId: string;
  loopRunId?: string;
  backtestResultId: string;
  strategyVersionId: string;
  strategyName: string;
  strategyType: string;
  isComposite: boolean;
  pair: string;
  timeframe: string;
  status: string;
  metrics: EvaluationMetrics;
  executedAt: Date;
  executionTimeMs: number;
}

export interface BacktestFailedPayload {
  jobId: string;
  correlationId: string;
  loopRunId?: string;
  strategyVersionId: string;
  error: string;
  attempt: number;
  willRetry: boolean;
}

export interface BacktestDeadLetteredPayload {
  jobId: string;
  correlationId: string;
  jobType: string;
  lastError: string;
  attempts: number;
  deadLetteredAt: Date;
}

export interface LeaderboardUpdatedPayload {
  updatedAt: Date;
  triggeredByBacktestResultId: string;
  rankingCriterion: string;
  topK: LeaderboardEntryPayload[];
}

export interface SearchLoopStartedPayload {
  loopRunId: string;
  config: {
    generatorType: string;
    maxCandidates?: number;
    maxDurationMs?: number;
    stopOnNoImprovementIterations: number;
  };
  startedAt: Date;
}

export interface SearchLoopProgressPayload {
  loopRunId: string;
  iteration: number;
  testedCandidates: number;
  currentCandidate: {
    strategyVersionId?: string;
    strategyName?: string;
    status: string;
  };
  bestScoreSoFar?: number;
  bestStrategyVersionId?: string;
}

export interface SearchLoopStoppedPayload {
  loopRunId: string;
  status: string;
  stopReason: string;
  testedCandidates: number;
  bestStrategyVersionId?: string;
  bestScore?: number;
  startedAt: Date;
  stoppedAt: Date;
}

export interface NewsCollectedPayload {
  articleId: string;
  relatedCoins: string[];
  sentimentScore: number;
  sentimentLabel: string;
  publishedAt: Date;
}
