import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BacktestSource,
  EventType,
  LoopStatus,
  RankingCriterion,
  SearchLoopProgressStatus,
  StrategyGeneratorType,
  type BacktestCompletedPayload,
  type EventEnvelope,
  type EventPayloadMap,
  type IEventBus,
  type NormalizedRate,
} from '@crypto-strategy-lab/shared';
import { EventBus } from './event-bus';

const JOB_ID = 'b8257d6b-d9df-47fb-83c1-839b04335e6f';
const CORRELATION_ID = '2660f14b-c12a-4cc1-a33f-a6e48b51ac9a';
const LOOP_RUN_ID = 'dc492a14-ee46-4748-9ef9-3c364689d20d';
const STRATEGY_VERSION_ID = '69e1c401-810a-431f-b2d8-d9f732e7f829';
const BACKTEST_RESULT_ID = '3d2be150-1ce6-451e-a8c4-2c4d1b7e4618';
const ARTICLE_ID = '62c95e8c-f52d-4de0-86bd-edb90fbe615b';
const STARTED_AT = new Date('2026-08-15T01:00:00.000Z');
const STOPPED_AT = new Date('2026-08-15T01:05:00.000Z');

const normalizedRate = (value: number): NormalizedRate => {
  if (value < 0 || value > 1) {
    throw new RangeError('Normalized rate fixture must be between 0 and 1');
  }

  return value as NormalizedRate;
};

const completedPayload: BacktestCompletedPayload = {
  jobId: JOB_ID,
  correlationId: CORRELATION_ID,
  loopRunId: null,
  backtestResultId: BACKTEST_RESULT_ID,
  strategyVersionId: STRATEGY_VERSION_ID,
  strategyName: 'Moving Average',
  strategyType: 'MA',
  isComposite: false,
  pair: 'BTCUSDT',
  timeframe: '1h',
  status: 'SUCCESS',
  metrics: {
    totalReturn: 12.5,
    winRate: normalizedRate(0.6),
    maxDrawdown: -8,
    sharpeRatio: 1.4,
    profitFactor: 1.8,
    totalTrades: 20,
  },
  executedAt: STOPPED_AT,
  executionTimeMs: 250,
};

const eventFixtures = {
  MarketDataUpdated: {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    candle: {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      openTime: STARTED_AT,
      closeTime: STOPPED_AT,
      open: 60_000,
      high: 61_000,
      low: 59_500,
      close: 60_500,
      volume: 125,
      isClosed: true,
    },
  },
  BacktestRequested: {
    jobId: JOB_ID,
    strategyVersionId: STRATEGY_VERSION_ID,
    pair: 'BTCUSDT',
    timeframe: '1h',
    startDate: STARTED_AT,
    endDate: STOPPED_AT,
    backtestConfig: {
      initialCapital: 10_000,
      positionSizePercent: 25,
      commission: 0.1,
      slippage: 0.05,
    },
    source: BacktestSource.USER,
    loopRunId: null,
  },
  BacktestCompleted: completedPayload,
  BacktestFailed: {
    jobId: JOB_ID,
    correlationId: CORRELATION_ID,
    loopRunId: LOOP_RUN_ID,
    strategyVersionId: STRATEGY_VERSION_ID,
    error: 'Backtest failed after terminal attempt',
    attempt: 3,
  },
  BacktestDeadLettered: {
    jobId: JOB_ID,
    correlationId: CORRELATION_ID,
    jobType: 'BACKTEST',
    lastError: 'Backtest failed after terminal attempt',
    attempts: 3,
    deadLetteredAt: STOPPED_AT,
  },
  LeaderboardUpdated: {
    updatedAt: STOPPED_AT,
    triggeredByBacktestResultId: BACKTEST_RESULT_ID,
    rankingCriterion: RankingCriterion.SCORE,
    topK: [
      {
        rank: 1,
        strategyVersionId: STRATEGY_VERSION_ID,
        strategyName: 'Moving Average',
        strategyType: 'MA',
        isComposite: false,
        backtestResultId: BACKTEST_RESULT_ID,
        score: 0.72,
        totalReturn: 12.5,
        winRate: normalizedRate(0.6),
        maxDrawdown: -8,
        sharpeRatio: 1.4,
        totalTrades: 20,
      },
    ],
  },
  SearchLoopStarted: {
    loopRunId: LOOP_RUN_ID,
    config: {
      generatorType: StrategyGeneratorType.RANDOM,
      maxCandidates: 5,
      maxDurationMs: null,
      stopOnNoImprovementIterations: 50,
    },
    startedAt: STARTED_AT,
  },
  SearchLoopProgress: {
    loopRunId: LOOP_RUN_ID,
    iteration: 1,
    testedCandidates: 1,
    currentCandidate: {
      strategyVersionId: STRATEGY_VERSION_ID,
      strategyName: 'Moving Average',
      status: SearchLoopProgressStatus.EVALUATING,
    },
    bestScoreSoFar: 0.72,
    bestStrategyVersionId: STRATEGY_VERSION_ID,
  },
  SearchLoopStopped: {
    loopRunId: LOOP_RUN_ID,
    status: LoopStatus.COMPLETED,
    stopReason: 'max_candidates_reached',
    testedCandidates: 5,
    bestStrategyVersionId: STRATEGY_VERSION_ID,
    bestScore: 0.72,
    startedAt: STARTED_AT,
    stoppedAt: STOPPED_AT,
  },
  NewsCollected: {
    articleId: ARTICLE_ID,
    relatedCoins: ['BTC'],
    sentimentScore: 0.7,
    sentimentLabel: 'POSITIVE',
    publishedAt: STARTED_AT,
  },
} satisfies EventPayloadMap;

const publishAllFixtures = (eventBus: IEventBus): void => {
  eventBus.publish(
    EventType.MarketDataUpdated,
    eventFixtures.MarketDataUpdated,
  );
  eventBus.publish(
    EventType.BacktestRequested,
    eventFixtures.BacktestRequested,
  );
  eventBus.publish(
    EventType.BacktestCompleted,
    eventFixtures.BacktestCompleted,
  );
  eventBus.publish(EventType.BacktestFailed, eventFixtures.BacktestFailed);
  eventBus.publish(
    EventType.BacktestDeadLettered,
    eventFixtures.BacktestDeadLettered,
  );
  eventBus.publish(
    EventType.LeaderboardUpdated,
    eventFixtures.LeaderboardUpdated,
  );
  eventBus.publish(
    EventType.SearchLoopStarted,
    eventFixtures.SearchLoopStarted,
  );
  eventBus.publish(
    EventType.SearchLoopProgress,
    eventFixtures.SearchLoopProgress,
  );
  eventBus.publish(
    EventType.SearchLoopStopped,
    eventFixtures.SearchLoopStopped,
  );
  eventBus.publish(EventType.NewsCollected, eventFixtures.NewsCollected);
};

const flushAsyncHandlers = async (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('EventBus contract', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus(new EventEmitter2());
  });

  it('keeps all ten active event definitions publishable with typed fixtures', () => {
    expect(() => publishAllFixtures(eventBus)).not.toThrow();
  });

  it('creates a version-1 UTC envelope with UUID identities and the original payload', () => {
    const received: EventEnvelope<
      BacktestCompletedPayload,
      typeof EventType.BacktestCompleted
    >[] = [];

    eventBus.subscribe(EventType.BacktestCompleted, (envelope) => {
      received.push(envelope);
    });

    const publishedAtEarliest = new Date();
    eventBus.publish(EventType.BacktestCompleted, completedPayload);
    eventBus.publish(EventType.BacktestCompleted, completedPayload);
    const publishedAtLatest = new Date();

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({
      eventType: EventType.BacktestCompleted,
      eventVersion: 1,
    });
    expect(received[0]?.eventId).toMatch(UUID_PATTERN);
    expect(received[0]?.correlationId).toMatch(UUID_PATTERN);
    expect(received[0]?.eventId).not.toBe(received[1]?.eventId);
    expect(received[0]?.correlationId).not.toBe(received[1]?.correlationId);
    expect(received[0]?.occurredAt).toBeInstanceOf(Date);
    expect(received[0]?.occurredAt.toISOString()).toMatch(/Z$/);
    expect(received[0]?.occurredAt.getTime()).toBeGreaterThanOrEqual(
      publishedAtEarliest.getTime(),
    );
    expect(received[0]?.occurredAt.getTime()).toBeLessThanOrEqual(
      publishedAtLatest.getTime(),
    );
    expect(received[0]?.payload).toBe(completedPayload);
  });

  it('preserves a supplied correlation ID', () => {
    const correlationIds: string[] = [];
    eventBus.subscribe(EventType.BacktestCompleted, ({ correlationId }) => {
      correlationIds.push(correlationId);
    });

    eventBus.publish(
      EventType.BacktestCompleted,
      completedPayload,
      CORRELATION_ID,
    );

    expect(correlationIds).toEqual([CORRELATION_ID]);
  });

  it('delivers the unchanged typed payload to multiple subscribers without returning a result', () => {
    const first = jest.fn();
    const second = jest.fn();

    eventBus.subscribe(EventType.BacktestCompleted, first);
    eventBus.subscribe(EventType.BacktestCompleted, second);

    const result = eventBus.publish(
      EventType.BacktestCompleted,
      completedPayload,
    );

    expect(result).toBeUndefined();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first.mock.calls[0]?.[0].payload).toBe(completedPayload);
    expect(second.mock.calls[0]?.[0].payload).toBe(completedPayload);
  });

  it('isolates a synchronous subscriber throw from the publisher and sibling subscribers', () => {
    const sibling = jest.fn();
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    try {
      eventBus.subscribe(EventType.BacktestCompleted, () => {
        throw new Error('sync subscriber failure');
      });
      eventBus.subscribe(EventType.BacktestCompleted, sibling);

      let publisherError: unknown;
      try {
        eventBus.publish(EventType.BacktestCompleted, completedPayload);
      } catch (error: unknown) {
        publisherError = error;
      }

      expect(sibling).toHaveBeenCalledTimes(1);
      expect(publisherError).toBeUndefined();
      expect(loggerError).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.BacktestCompleted,
          eventId: expect.stringMatching(UUID_PATTERN),
          correlationId: expect.stringMatching(UUID_PATTERN),
          error: expect.objectContaining({
            message: 'sync subscriber failure',
          }),
        }),
      );
    } finally {
      loggerError.mockRestore();
    }
  });

  it('isolates and logs an async rejection without an unhandled rejection', async () => {
    const subscriberError = new Error('async subscriber failure');
    const sibling = jest.fn();
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      eventBus.subscribe(EventType.BacktestCompleted, async () => {
        throw subscriberError;
      });
      eventBus.subscribe(EventType.BacktestCompleted, sibling);

      expect(() =>
        eventBus.publish(EventType.BacktestCompleted, completedPayload),
      ).not.toThrow();
      await flushAsyncHandlers();

      expect(sibling).toHaveBeenCalledTimes(1);
      expect(loggerError).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.BacktestCompleted,
          eventId: expect.stringMatching(UUID_PATTERN),
          correlationId: expect.stringMatching(UUID_PATTERN),
          error: expect.objectContaining({
            message: 'async subscriber failure',
          }),
        }),
      );
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
      loggerError.mockRestore();
    }
  });

  it('makes cleanup and unsubscribe idempotent without removing a sibling', () => {
    const removedSubscriber = jest.fn();
    const sibling = jest.fn();
    const cleanupRemoved = eventBus.subscribe(
      EventType.BacktestCompleted,
      removedSubscriber,
    );
    const cleanupSibling = eventBus.subscribe(
      EventType.BacktestCompleted,
      sibling,
    );

    cleanupRemoved();
    cleanupRemoved();
    eventBus.unsubscribe(cleanupRemoved);
    eventBus.unsubscribe(cleanupRemoved);
    eventBus.publish(EventType.BacktestCompleted, completedPayload);

    expect(removedSubscriber).not.toHaveBeenCalled();
    expect(sibling).toHaveBeenCalledTimes(1);

    eventBus.unsubscribe(cleanupSibling);
    eventBus.unsubscribe(cleanupSibling);
    cleanupSibling();
    cleanupSibling();
    eventBus.publish(EventType.BacktestCompleted, completedPayload);

    expect(sibling).toHaveBeenCalledTimes(1);
  });
});
