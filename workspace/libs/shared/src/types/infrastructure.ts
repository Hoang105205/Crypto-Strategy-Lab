// Event Infrastructure types - sourced from kb/contracts/events.yaml
// Owner: Phuong | Status: Active

import type { BacktestConfig } from './strategy';
import type {
  JobStatusValue,
  JobType,
  LoopStatus,
  RankingCriterion,
  SearchLoopCandidateStatus,
  StrategyGeneratorType,
} from './enums';

declare const normalizedRateBrand: unique symbol;

/** A rate validated at a public boundary to be between 0 and 1 inclusive. */
export type NormalizedRate = number & { readonly [normalizedRateBrand]: true };

export interface EventEnvelope<T = unknown, TEventType extends string = string> {
  eventId: string;
  eventType: TEventType;
  eventVersion: 1;
  occurredAt: Date;
  correlationId: string;
  payload: T;
}

export interface JobRequest {
  jobId: string;
  jobType: JobType;
  payload: Record<string, unknown>;
  attempt: number;
  maxAttempts: number;
  correlationId: string;
  createdAt: Date;
  availableAt: Date;
}

export interface JobStatus {
  jobId: string;
  status: JobStatusValue;
  attempt: number;
  lastError: string | null;
  updatedAt: Date;
}

export interface QueueStats {
  queued: number;
  processing: number;
  completedLast24h: number;
  deadLettered: number;
  delayed: number;
  redisConnected: boolean;
}

export interface DeadLetterJob {
  id: string;
  jobId: string;
  jobType: JobType;
  payload: Record<string, unknown>;
  attempts: number;
  lastError: string;
  deadLetteredAt: Date;
  resolvedAt: Date | null;
}

export interface LeaderboardEntryPayload {
  rank: number;
  strategyVersionId: string;
  strategyName: string;
  strategyType: string;
  isComposite: boolean;
  backtestResultId: string;
  score: number;
  totalReturn: number;
  winRate: NormalizedRate;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
}

export interface SearchLoopConfig {
  generatorType: StrategyGeneratorType;
  pair: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  backtestConfig: BacktestConfig;
  maxCandidates: number | null;
  maxDurationMs: number | null;
  stopOnNoImprovementIterations: number;
}

export interface SearchLoopRun {
  id: string;
  status: LoopStatus;
  generatorType: StrategyGeneratorType;
  iteration: number;
  testedCandidates: number;
  maxCandidates: number | null;
  maxDurationMs: number | null;
  stopOnNoImprovementIterations: number;
  currentCandidateStrategyVersionId: string | null;
  bestStrategyVersionId: string | null;
  bestScore: number | null;
  stopReason: string | null;
  startedAt: Date;
  pausedAt: Date | null;
  stoppedAt: Date | null;
}

export interface SearchLoopCandidate {
  id: string;
  loopRunId: string;
  jobId: string;
  strategyVersionId: string;
  backtestResultId: string | null;
  iteration: number;
  score: number | null;
  status: SearchLoopCandidateStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaderboardSnapshot {
  rankingCriterion: RankingCriterion;
  updatedAt: Date;
  entries: LeaderboardEntryPayload[];
}
