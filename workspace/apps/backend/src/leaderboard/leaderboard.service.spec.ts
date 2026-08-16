/* eslint-disable @typescript-eslint/unbound-method -- Jest assertions inspect typed port fakes. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  EventType,
  RankingCriterion,
  StrategyType,
  type BacktestCompletedPayload,
  type BacktestResult,
  type EventEnvelope,
  type EventPayloadMap,
  type EventSubscription,
  type EventTypeValue,
  type IBacktestResultPort,
  type IEventBus,
  type LeaderboardEntryPayload,
  type NormalizedRate,
} from '@crypto-strategy-lab/shared';

const TARGET_FILE = join(__dirname, 'leaderboard.service.ts');
const TARGET_MODULE = join(__dirname, 'leaderboard.service');
const TARGET_EXISTS = existsSync(TARGET_FILE);

const CORRELATION_ID = '2660f14b-c12a-4cc1-a33f-a6e48b51ac9a';
const STRATEGY_VERSION_ID = '69e1c401-810a-431f-b2d8-d9f732e7f829';
const SECOND_STRATEGY_VERSION_ID = '96b5a79e-ef61-419e-b87e-a1bf55fc7dd6';
const RESULT_ID = '3d2be150-1ce6-451e-a8c4-2c4d1b7e4618';
const SECOND_RESULT_ID = '1442da60-339d-40a6-bf87-0ba333919831';
const EXECUTED_AT = new Date('2026-08-15T03:00:00.000Z');
const UPDATED_AT = new Date('2026-08-15T03:00:01.000Z');

interface LeaderboardCreateInput {
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
  executedAt: Date;
}

interface LeaderboardRepositoryApi {
  findByBacktestResultId(
    backtestResultId: string,
  ): Promise<LeaderboardEntryPayload | null>;
  create(
    input: LeaderboardCreateInput,
  ): Promise<LeaderboardEntryPayload | null>;
  rerank(): Promise<void>;
  getTopK(criterion: RankingCriterion): Promise<LeaderboardEntryPayload[]>;
  getUpdatedAt(): Promise<Date>;
  findBestByStrategyVersionId(
    strategyVersionId: string,
  ): Promise<LeaderboardEntryPayload | null>;
}

interface ScoringPolicyApi {
  calculateScore(input: {
    totalReturn: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
  }): number;
}

interface LeaderboardServiceApi {
  onModuleInit(): void;
  onModuleDestroy(): void;
  handleBacktestCompleted(
    envelope: EventEnvelope<BacktestCompletedPayload, 'BacktestCompleted'>,
  ): Promise<void>;
  getDetail(strategyVersionId: string): Promise<
    | (LeaderboardEntryPayload & {
        trades: BacktestResult['trades'];
        executedAt: Date;
      })
    | null
  >;
}

type LeaderboardServiceConstructor = new (
  eventBus: IEventBus,
  repository: LeaderboardRepositoryApi,
  scoringPolicy: ScoringPolicyApi,
  resultPort: IBacktestResultPort,
) => LeaderboardServiceApi;

const loadTarget = (): LeaderboardServiceConstructor => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const target = require(TARGET_MODULE) as {
    LeaderboardService?: LeaderboardServiceConstructor;
  };
  if (typeof target.LeaderboardService !== 'function') {
    throw new Error(
      'T021 RED: leaderboard.service.ts must export LeaderboardService implementing the Observer contract.',
    );
  }
  return target.LeaderboardService;
};

const normalizedRate = (value: number): NormalizedRate =>
  value as NormalizedRate;

const completedPayload = (
  overrides: Partial<BacktestCompletedPayload> = {},
): BacktestCompletedPayload => ({
  jobId: 'b8257d6b-d9df-47fb-83c1-839b04335e6f',
  correlationId: CORRELATION_ID,
  loopRunId: null,
  backtestResultId: RESULT_ID,
  strategyVersionId: STRATEGY_VERSION_ID,
  strategyName: 'Moving Average',
  strategyType: 'MA',
  isComposite: false,
  pair: 'BTCUSDT',
  timeframe: '1h',
  status: 'SUCCESS',
  metrics: {
    totalReturn: 20,
    winRate: normalizedRate(0.6),
    maxDrawdown: -10,
    sharpeRatio: 1.2,
    profitFactor: 1.5,
    totalTrades: 10,
  },
  executedAt: EXECUTED_AT,
  executionTimeMs: 250,
  ...overrides,
});

const envelope = (
  payload = completedPayload(),
): EventEnvelope<BacktestCompletedPayload, 'BacktestCompleted'> => ({
  eventId: 'de63a16f-dfec-4cdc-a04d-8cd041a2f860',
  eventType: EventType.BacktestCompleted,
  eventVersion: 1,
  occurredAt: EXECUTED_AT,
  correlationId: CORRELATION_ID,
  payload,
});

const leaderboardEntry = (
  overrides: Partial<LeaderboardEntryPayload> = {},
): LeaderboardEntryPayload => ({
  rank: 1,
  strategyVersionId: STRATEGY_VERSION_ID,
  strategyName: 'Moving Average',
  strategyType: 'MA',
  isComposite: false,
  backtestResultId: RESULT_ID,
  score: 0.46,
  totalReturn: 20,
  winRate: normalizedRate(0.6),
  maxDrawdown: -10,
  sharpeRatio: 1.2,
  totalTrades: 10,
  ...overrides,
});

class EventBusFake implements IEventBus {
  readonly published: Array<{
    eventType: EventTypeValue;
    payload: EventPayloadMap[EventTypeValue];
    correlationId?: string;
  }> = [];
  readonly trace: string[];
  subscribedType: EventTypeValue | null = null;
  handler:
    ((envelope: EventEnvelope<never, never>) => void | Promise<void>) | null =
    null;
  cleanupCalls = 0;
  unsubscribeCalls = 0;

  constructor(trace: string[]) {
    this.trace = trace;
  }

  publish<TEventType extends EventTypeValue>(
    eventType: TEventType,
    payload: EventPayloadMap[TEventType],
    correlationId?: string,
  ): void {
    this.trace.push('publish');
    this.published.push({
      eventType,
      payload,
      correlationId,
    });
  }

  subscribe<TEventType extends EventTypeValue>(
    eventType: TEventType,
    handler: (
      envelope: EventEnvelope<EventPayloadMap[TEventType], TEventType>,
    ) => void | Promise<void>,
  ): EventSubscription {
    this.subscribedType = eventType;
    this.handler = handler;
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.cleanupCalls += 1;
      this.handler = null;
    };
  }

  unsubscribe(subscription: EventSubscription): void {
    this.unsubscribeCalls += 1;
    subscription();
  }
}

const makeRepository = (
  trace: string[],
  topK: LeaderboardEntryPayload[] = [leaderboardEntry()],
): jest.Mocked<LeaderboardRepositoryApi> => ({
  findByBacktestResultId: jest
    .fn<LeaderboardRepositoryApi['findByBacktestResultId']>()
    .mockImplementation(() => {
      trace.push('idempotency');
      return Promise.resolve(null);
    }),
  create: jest
    .fn<LeaderboardRepositoryApi['create']>()
    .mockImplementation((input) => {
      trace.push('persist');
      return Promise.resolve(leaderboardEntry(input));
    }),
  rerank: jest
    .fn<LeaderboardRepositoryApi['rerank']>()
    .mockImplementation(() => {
      trace.push('rerank');
      return Promise.resolve();
    }),
  getTopK: jest
    .fn<LeaderboardRepositoryApi['getTopK']>()
    .mockImplementation(() => {
      trace.push('topK');
      return Promise.resolve(topK);
    }),
  getUpdatedAt: jest
    .fn<LeaderboardRepositoryApi['getUpdatedAt']>()
    .mockResolvedValue(UPDATED_AT),
  findBestByStrategyVersionId: jest
    .fn<LeaderboardRepositoryApi['findBestByStrategyVersionId']>()
    .mockResolvedValue(leaderboardEntry()),
});

const makeResultPort = (): jest.Mocked<IBacktestResultPort> => ({
  save: jest.fn<IBacktestResultPort['save']>(),
  getById: jest.fn<IBacktestResultPort['getById']>(),
});

describe('LeaderboardService Observer contract (T021)', () => {
  it('has the production service target required by T025', () => {
    if (!TARGET_EXISTS) {
      throw new Error(
        'T021 RED: LeaderboardService is not implemented yet. ' +
          'T025 must add src/leaderboard/leaderboard.service.ts; this is not an import-path failure.',
      );
    }
    expect(loadTarget()).toBeDefined();
  });

  const describeWithTarget = TARGET_EXISTS ? describe : describe.skip;

  describeWithTarget('event subscription lifecycle', () => {
    let trace: string[];
    let eventBus: EventBusFake;
    let repository: jest.Mocked<LeaderboardRepositoryApi>;
    let scoringPolicy: jest.Mocked<ScoringPolicyApi>;
    let service: LeaderboardServiceApi;

    beforeEach(() => {
      trace = [];
      eventBus = new EventBusFake(trace);
      repository = makeRepository(trace);
      scoringPolicy = {
        calculateScore: jest
          .fn<ScoringPolicyApi['calculateScore']>()
          .mockReturnValue(0.46),
      };
      const Service = loadTarget();
      service = new Service(
        eventBus,
        repository,
        scoringPolicy,
        makeResultPort(),
      );
    });

    it('subscribes only to BacktestCompleted during module initialization', () => {
      service.onModuleInit();
      expect(eventBus.subscribedType).toBe(EventType.BacktestCompleted);
      expect(eventBus.handler).toEqual(expect.any(Function));
    });

    it('cleans the subscription exactly once during repeated destruction', () => {
      service.onModuleInit();
      service.onModuleDestroy();
      service.onModuleDestroy();
      expect(eventBus.unsubscribeCalls).toBe(1);
      expect(eventBus.cleanupCalls).toBe(1);
      expect(eventBus.handler).toBeNull();
    });
  });

  describeWithTarget('accepted completion handling', () => {
    let trace: string[];
    let eventBus: EventBusFake;
    let repository: jest.Mocked<LeaderboardRepositoryApi>;
    let scoringPolicy: jest.Mocked<ScoringPolicyApi>;
    let service: LeaderboardServiceApi;

    beforeEach(() => {
      trace = [];
      eventBus = new EventBusFake(trace);
      repository = makeRepository(trace);
      scoringPolicy = {
        calculateScore: jest
          .fn<ScoringPolicyApi['calculateScore']>()
          .mockImplementation((input) => {
            trace.push('score');
            return input.totalTrades === 0 ? 0.24 : 0.46;
          }),
      };
      const Service = loadTarget();
      service = new Service(
        eventBus,
        repository,
        scoringPolicy,
        makeResultPort(),
      );
    });

    it('validates, scores, persists, reranks, reads Top-K, then publishes', async () => {
      await service.handleBacktestCompleted(envelope());

      expect(trace).toEqual([
        'idempotency',
        'score',
        'persist',
        'rerank',
        'topK',
        'publish',
      ]);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          backtestResultId: RESULT_ID,
          strategyVersionId: STRATEGY_VERSION_ID,
          score: 0.46,
          executedAt: EXECUTED_AT,
        }),
      );
    });

    it('publishes the exact default-ranking payload with original correlation', async () => {
      const expectedTopK = [leaderboardEntry()];
      repository.getTopK.mockResolvedValue(expectedTopK);

      await service.handleBacktestCompleted(envelope());

      expect(eventBus.published).toEqual([
        {
          eventType: EventType.LeaderboardUpdated,
          payload: {
            updatedAt: UPDATED_AT,
            triggeredByBacktestResultId: RESULT_ID,
            rankingCriterion: RankingCriterion.SCORE,
            topK: expectedTopK,
          },
          correlationId: CORRELATION_ID,
        },
      ]);
    });

    it('persists every accepted result while broadcasting repository best-per-version Top-K', async () => {
      const bestPerVersionTopK = [
        leaderboardEntry({ score: 0.7 }),
        leaderboardEntry({
          rank: 2,
          strategyVersionId: SECOND_STRATEGY_VERSION_ID,
          backtestResultId: SECOND_RESULT_ID,
          score: 0.6,
        }),
      ];
      repository.getTopK.mockResolvedValue(bestPerVersionTopK);

      await service.handleBacktestCompleted(envelope());

      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.rerank).toHaveBeenCalledTimes(1);
      expect(repository.getTopK).toHaveBeenCalledWith(RankingCriterion.SCORE);
      expect(eventBus.published[0]?.payload).toMatchObject({
        topK: bestPerVersionTopK,
      });
    });

    it('normalizes return and win rate for a valid zero-trade result', async () => {
      const zeroTrade = completedPayload({
        metrics: {
          ...completedPayload().metrics,
          totalReturn: 90,
          winRate: normalizedRate(0.95),
          totalTrades: 0,
        },
      });

      await service.handleBacktestCompleted(envelope(zeroTrade));

      expect(scoringPolicy.calculateScore).toHaveBeenCalledWith(
        expect.objectContaining({ totalReturn: 0, winRate: 0, totalTrades: 0 }),
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalReturn: 0, winRate: 0, totalTrades: 0 }),
      );
    });
  });

  describeWithTarget('validation, idempotency, and failure isolation', () => {
    let trace: string[];
    let eventBus: EventBusFake;
    let repository: jest.Mocked<LeaderboardRepositoryApi>;
    let scoringPolicy: jest.Mocked<ScoringPolicyApi>;
    let service: LeaderboardServiceApi;

    beforeEach(() => {
      trace = [];
      eventBus = new EventBusFake(trace);
      repository = makeRepository(trace);
      scoringPolicy = {
        calculateScore: jest
          .fn<ScoringPolicyApi['calculateScore']>()
          .mockReturnValue(0.46),
      };
      const Service = loadTarget();
      service = new Service(
        eventBus,
        repository,
        scoringPolicy,
        makeResultPort(),
      );
    });

    it.each([
      ['win rate below zero', { winRate: -0.01 }],
      ['win rate above one', { winRate: 1.01 }],
      ['NaN return', { totalReturn: Number.NaN }],
      ['infinite drawdown', { maxDrawdown: Number.POSITIVE_INFINITY }],
      ['NaN Sharpe', { sharpeRatio: Number.NaN }],
      ['negative trade count', { totalTrades: -1 }],
      ['fractional trade count', { totalTrades: 1.5 }],
    ])('rejects %s without ranking side effects', async (_label, invalid) => {
      const payload = completedPayload({
        metrics: {
          ...completedPayload().metrics,
          ...invalid,
        } as BacktestCompletedPayload['metrics'],
      });

      await service.handleBacktestCompleted(envelope(payload));

      expect(scoringPolicy.calculateScore).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.rerank).not.toHaveBeenCalled();
      expect(eventBus.published).toHaveLength(0);
    });

    it('ignores a sequential duplicate without write, rerank, or broadcast', async () => {
      repository.findByBacktestResultId.mockResolvedValue(leaderboardEntry());

      await service.handleBacktestCompleted(envelope());

      expect(scoringPolicy.calculateScore).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.rerank).not.toHaveBeenCalled();
      expect(eventBus.published).toHaveLength(0);
    });

    it('treats a concurrent unique-race loser as duplicate without broadcast', async () => {
      repository.create.mockResolvedValue(null);

      await service.handleBacktestCompleted(envelope());

      expect(repository.rerank).not.toHaveBeenCalled();
      expect(repository.getTopK).not.toHaveBeenCalled();
      expect(eventBus.published).toHaveLength(0);
    });

    it('does not publish when persistence fails', async () => {
      repository.create.mockRejectedValue(new Error('database unavailable'));

      await expect(service.handleBacktestCompleted(envelope())).rejects.toThrow(
        'database unavailable',
      );
      expect(repository.rerank).not.toHaveBeenCalled();
      expect(eventBus.published).toHaveLength(0);
    });

    it('does not publish when global reranking fails', async () => {
      repository.rerank.mockRejectedValue(new Error('rerank failed'));

      await expect(service.handleBacktestCompleted(envelope())).rejects.toThrow(
        'rerank failed',
      );
      expect(repository.getTopK).not.toHaveBeenCalled();
      expect(eventBus.published).toHaveLength(0);
    });
  });

  describeWithTarget('Strategy-owned detail composition', () => {
    it('reads the local projection then obtains trades through IBacktestResultPort', async () => {
      const trace: string[] = [];
      const repository = makeRepository(trace);
      const resultPort = makeResultPort();
      const trades: BacktestResult['trades'] = [
        {
          entryDate: new Date('2026-08-15T01:00:00.000Z'),
          exitDate: new Date('2026-08-15T02:00:00.000Z'),
          entryPrice: 100,
          exitPrice: 110,
          side: 'LONG',
          pnl: 10,
          quantity: 1,
        },
      ];
      resultPort.getById.mockResolvedValue({
        id: RESULT_ID,
        jobId: 'b8257d6b-d9df-47fb-83c1-839b04335e6f',
        strategyVersionId: STRATEGY_VERSION_ID,
        pair: 'BTCUSDT',
        timeframe: '1h',
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-08-15T00:00:00.000Z'),
        totalReturn: 20,
        winRate: 0.6,
        maxDrawdown: -10,
        sharpeRatio: 1.2,
        profitFactor: 1.5,
        totalTrades: 1,
        trades,
        executedAt: EXECUTED_AT,
        executionTimeMs: 250,
        strategyVersion: {
          id: STRATEGY_VERSION_ID,
          strategyType: StrategyType.MA,
          name: 'Moving Average',
          version: 1,
          parameters: { period: 20 },
          isComposite: false,
          childVersionIds: [],
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        },
      });
      const Service = loadTarget();
      const service = new Service(
        new EventBusFake(trace),
        repository,
        { calculateScore: jest.fn(() => 0.46) },
        resultPort,
      );

      await expect(service.getDetail(STRATEGY_VERSION_ID)).resolves.toEqual({
        ...leaderboardEntry(),
        strategyVersion: expect.objectContaining({
          id: STRATEGY_VERSION_ID,
          version: 1,
        }),
        trades,
        executedAt: EXECUTED_AT,
      });
      expect(repository.findBestByStrategyVersionId).toHaveBeenCalledWith(
        STRATEGY_VERSION_ID,
      );
      expect(resultPort.getById).toHaveBeenCalledWith(RESULT_ID);
    });

    it('does not cross the Strategy port when no local projection exists', async () => {
      const trace: string[] = [];
      const repository = makeRepository(trace);
      repository.findBestByStrategyVersionId.mockResolvedValue(null);
      const resultPort = makeResultPort();
      const Service = loadTarget();
      const service = new Service(
        new EventBusFake(trace),
        repository,
        { calculateScore: jest.fn(() => 0.46) },
        resultPort,
      );

      await expect(service.getDetail(STRATEGY_VERSION_ID)).resolves.toBeNull();
      expect(resultPort.getById).not.toHaveBeenCalled();
    });
  });
});

const _backtestResultCompileFixture: BacktestResult | null = null;
void _backtestResultCompileFixture;
