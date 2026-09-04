import { BacktestSource } from '@crypto-strategy-lab/shared';
import type { JobsOptions } from 'bullmq';
import type { ValidatedEnvironment } from '../config/environment';

export const BACKTEST_BACKOFF_TYPE = 'backtest-deterministic';
export const BACKTEST_RETRY_DELAYS_MS = [1_000, 4_000] as const;

export interface BullMqBacktestConfig {
  queueName: string;
  concurrency: number;
  attempts: 3;
  retryDelaysMs: typeof BACKTEST_RETRY_DELAYS_MS;
  defaultJobOptions: Pick<
    JobsOptions,
    'attempts' | 'backoff' | 'removeOnComplete' | 'removeOnFail'
  >;
}

export function getBacktestPriority(source: BacktestSource): number {
  switch (source) {
    case BacktestSource.USER:
      return 1;
    case BacktestSource.SEARCH_LOOP:
      return 10;
    default:
      throw new Error('Unsupported Backtest source');
  }
}

/**
 * BullMQ invokes custom backoff after a failed execution. With three total
 * attempts there are only two valid transitions to another execution.
 */
export function backtestBackoffStrategy(attemptsMade: number): number {
  return BACKTEST_RETRY_DELAYS_MS[attemptsMade - 1] ?? -1;
}

export function createBullMqConfig(
  environment: ValidatedEnvironment,
): BullMqBacktestConfig {
  const retention = {
    age: environment.BACKTEST_JOB_RETENTION_AGE_SECONDS,
    count: environment.BACKTEST_JOB_RETENTION_COUNT,
  };

  return {
    queueName: environment.BACKTEST_QUEUE_NAME,
    concurrency: environment.BACKTEST_WORKER_CONCURRENCY,
    attempts: environment.BACKTEST_MAX_ATTEMPTS,
    retryDelaysMs: BACKTEST_RETRY_DELAYS_MS,
    defaultJobOptions: {
      attempts: environment.BACKTEST_MAX_ATTEMPTS,
      backoff: { type: BACKTEST_BACKOFF_TYPE },
      removeOnComplete: { ...retention },
      removeOnFail: { ...retention },
    },
  };
}
