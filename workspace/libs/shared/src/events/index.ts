// Event types and payloads - sourced from kb/contracts/events.yaml
// Owner: Phuong | Status: Active

import type { Candle } from '../types/market-data';
import type { BacktestConfig, EvaluationMetrics } from '../types/strategy';
import type {
  BacktestSource,
  LoopStatus,
  RankingCriterion,
  SearchLoopProgressStatus,
  StrategyGeneratorType,
} from '../types/enums';
import type { LeaderboardEntryPayload, NormalizedRate } from '../types/infrastructure';

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

export type EventTypeValue = (typeof EventType)[keyof typeof EventType];

export interface MarketDataUpdatedPayload {
  symbol: string;
  timeframe: string;
  candle: Candle;
}

interface BacktestRequestedPayloadBase {
  jobId: string;
  strategyVersionId: string;
  pair: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  backtestConfig: BacktestConfig;
}

export interface UserBacktestRequestedPayload extends BacktestRequestedPayloadBase {
  source: BacktestSource.USER;
  loopRunId: null;
}

export interface SearchLoopBacktestRequestedPayload extends BacktestRequestedPayloadBase {
  source: BacktestSource.SEARCH_LOOP;
  loopRunId: string;
}

export type BacktestRequestedPayload =
  | UserBacktestRequestedPayload
  | SearchLoopBacktestRequestedPayload;

export type BacktestEvaluationMetrics = Omit<EvaluationMetrics, 'winRate'> & {
  winRate: NormalizedRate;
};

export interface BacktestCompletedPayload {
  jobId: string;
  correlationId: string;
  loopRunId: string | null;
  backtestResultId: string;
  strategyVersionId: string;
  strategyName: string;
  strategyType: string;
  isComposite: boolean;
  pair: string;
  timeframe: string;
  status: 'SUCCESS';
  metrics: BacktestEvaluationMetrics;
  executedAt: Date;
  executionTimeMs: number;
}

export interface BacktestFailedPayload {
  jobId: string;
  correlationId: string;
  loopRunId: string | null;
  strategyVersionId: string;
  error: string;
  attempt: number;
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
  rankingCriterion: RankingCriterion;
  topK: LeaderboardEntryPayload[];
}

export interface SearchLoopStartedPayload {
  loopRunId: string;
  config: {
    generatorType: StrategyGeneratorType;
    maxCandidates: number | null;
    maxDurationMs: number | null;
    stopOnNoImprovementIterations: number;
  };
  startedAt: Date;
}

export interface SearchLoopProgressPayload {
  loopRunId: string;
  iteration: number;
  testedCandidates: number;
  currentCandidate: {
    strategyVersionId: string | null;
    strategyName: string | null;
    status: SearchLoopProgressStatus;
  };
  bestScoreSoFar: number | null;
  bestStrategyVersionId: string | null;
}

export interface SearchLoopStoppedPayload {
  loopRunId: string;
  status: LoopStatus.COMPLETED | LoopStatus.STOPPED_BY_USER | LoopStatus.FAILED;
  stopReason: string;
  testedCandidates: number;
  bestStrategyVersionId: string | null;
  bestScore: number | null;
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

export interface EventPayloadMap {
  MarketDataUpdated: MarketDataUpdatedPayload;
  BacktestRequested: BacktestRequestedPayload;
  BacktestCompleted: BacktestCompletedPayload;
  BacktestFailed: BacktestFailedPayload;
  BacktestDeadLettered: BacktestDeadLetteredPayload;
  LeaderboardUpdated: LeaderboardUpdatedPayload;
  SearchLoopStarted: SearchLoopStartedPayload;
  SearchLoopProgress: SearchLoopProgressPayload;
  SearchLoopStopped: SearchLoopStoppedPayload;
  NewsCollected: NewsCollectedPayload;
}
