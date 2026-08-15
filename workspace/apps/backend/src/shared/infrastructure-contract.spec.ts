import {
  BacktestSource,
  JobStatusValue,
  LoopStatus,
  RankingCriterion,
  type BacktestFailedPayload,
  type IBacktestResultPort,
  type IJobQueue,
  type IStrategyExecutionPort,
  type QueueStats,
} from '@crypto-strategy-lab/shared';

describe('Event Infrastructure shared contract', () => {
  it('keeps queue lifecycle and Loop values aligned with the active contract', () => {
    expect(Object.values(JobStatusValue)).toEqual([
      'QUEUED',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'DEAD_LETTER',
    ]);
    expect(BacktestSource).toEqual({ USER: 'USER', SEARCH_LOOP: 'SEARCH_LOOP' });
    expect(Object.values(LoopStatus)).toEqual([
      'RUNNING',
      'PAUSED',
      'COMPLETED',
      'STOPPED_BY_USER',
      'FAILED',
    ]);
    expect(Object.values(RankingCriterion)).toEqual([
      'score',
      'totalReturn',
      'winRate',
      'maxDrawdown',
      'sharpeRatio',
    ]);
  });

  it('compiles required queue, terminal, stats, and Strategy port shapes', () => {
    type EnqueuePayload = Parameters<IJobQueue['enqueue']>[1];
    type RequiredJobId = EnqueuePayload extends { jobId: string } ? true : false;
    type TerminalOnly = 'willRetry' extends keyof BacktestFailedPayload ? false : true;
    type RedisAwareStats = QueueStats extends {
      delayed: number;
      redisConnected: boolean;
    }
      ? true
      : false;
    type StrategyPortsPresent = IStrategyExecutionPort extends object
      ? IBacktestResultPort extends object
        ? true
        : false
      : false;

    const assertions: [RequiredJobId, TerminalOnly, RedisAwareStats, StrategyPortsPresent] = [
      true,
      true,
      true,
      true,
    ];
    expect(assertions).toEqual([true, true, true, true]);
  });
});
