import { describe, expect, it } from '@jest/globals';
import { BacktestSource } from '@crypto-strategy-lab/shared';
import { validateEnvironment } from '../config/environment';
import {
  BACKTEST_BACKOFF_TYPE,
  BACKTEST_RETRY_DELAYS_MS,
  backtestBackoffStrategy,
  createBullMqConfig,
  getBacktestPriority,
} from './bullmq.config';

describe('BullMQ backtest configuration', () => {
  it('maps validated environment defaults to the queue runtime contract', () => {
    const config = createBullMqConfig(validateEnvironment({}));

    expect(config).toEqual({
      queueName: 'backtest',
      concurrency: 3,
      attempts: 3,
      retryDelaysMs: [1_000, 4_000],
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: BACKTEST_BACKOFF_TYPE },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: { age: 86_400, count: 1_000 },
      },
    });
  });

  it('uses configured concurrency and bounded retention without changing attempts', () => {
    const config = createBullMqConfig(
      validateEnvironment({
        BACKTEST_WORKER_CONCURRENCY: 7,
        BACKTEST_JOB_RETENTION_AGE_SECONDS: 3_600,
        BACKTEST_JOB_RETENTION_COUNT: 250,
      }),
    );

    expect(config.concurrency).toBe(7);
    expect(config.attempts).toBe(3);
    expect(config.defaultJobOptions.removeOnComplete).toEqual({
      age: 3_600,
      count: 250,
    });
    expect(config.defaultJobOptions.removeOnFail).toEqual({
      age: 3_600,
      count: 250,
    });
  });

  it('gives USER work priority 1 and SEARCH_LOOP work priority 10', () => {
    expect(getBacktestPriority(BacktestSource.USER)).toBe(1);
    expect(getBacktestPriority(BacktestSource.SEARCH_LOOP)).toBe(10);
  });

  it('defines two delays for exactly three execution attempts', () => {
    expect(BACKTEST_RETRY_DELAYS_MS).toEqual([1_000, 4_000]);
    expect(backtestBackoffStrategy(1)).toBe(1_000);
    expect(backtestBackoffStrategy(2)).toBe(4_000);
    expect(backtestBackoffStrategy(3)).toBe(-1);
  });
});
