/* eslint-disable @typescript-eslint/unbound-method -- Jest inspects typed fakes and provider seams. */
import { Logger, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  EventType,
  RankingCriterion,
  StrategyType,
  type BacktestCompletedPayload,
  type BacktestResultDetail,
  type EventEnvelope,
  type IBacktestResultPort,
  type IEventBus,
  type LeaderboardUpdatedPayload,
  type NormalizedRate,
} from '@crypto-strategy-lab/shared';
import type { LeaderboardEntry as PrismaLeaderboardEntry } from '@prisma/client';
import { jest } from '@jest/globals';
import request from 'supertest';
import { PrismaService } from '../database/prisma.service';
import { IEVENT_BUS, IBACKTEST_RESULT_PORT } from '../shared/tokens';
import { LeaderboardModule } from './leaderboard.module';
import { ScoringPolicy, type IScoringPolicy } from './scoring-policy';

const CORRELATION_ID = '2660f14b-c12a-4cc1-a33f-a6e48b51ac9a';
const RESULT_A1 = '3d2be150-1ce6-451e-a8c4-2c4d1b7e4618';
const RESULT_A2 = '1442da60-339d-40a6-bf87-0ba333919831';
const RESULT_B = '08ab936f-bd9a-4dd8-9e10-9347a471d579';
const RESULT_C = '6621d246-2029-4fd5-8a28-5483c8159df7';
const RESULT_D = '7543552a-bf80-4523-84a6-c8cfba8be617';
const RESULT_E = 'fcae155d-4e11-4777-9633-574755ffb629';
const VERSION_A = '69e1c401-810a-431f-b2d8-d9f732e7f829';
const VERSION_B = '96b5a79e-ef61-419e-b87e-a1bf55fc7dd6';
const VERSION_C = 'e85b01ce-488c-4b37-8436-9c8589b00d52';
const EXECUTED_AT = new Date('2026-08-16T03:00:00.000Z');

interface CreateArguments {
  data: Omit<PrismaLeaderboardEntry, 'id' | 'createdAt' | 'updatedAt'>;
}

interface FindManyArguments {
  where?: { strategyVersionId?: string };
}

class InMemoryLeaderboardPrisma {
  readonly rows: PrismaLeaderboardEntry[] = [];
  readonly forbiddenStrategyVersionAccess = jest.fn(() => {
    throw new Error('Leaderboard crossed into the StrategyVersion delegate');
  });
  readonly forbiddenBacktestResultAccess = jest.fn(() => {
    throw new Error('Leaderboard crossed into the BacktestResult delegate');
  });
  failNextCreate = false;
  createAttempts = 0;
  private clock = 0;

  readonly leaderboardEntry = {
    create: jest.fn(async ({ data }: CreateArguments) => {
      this.createAttempts += 1;
      if (this.failNextCreate) {
        this.failNextCreate = false;
        throw new Error('private database provider failure');
      }
      if (
        this.rows.some(
          (entry) => entry.backtestResultId === data.backtestResultId,
        )
      ) {
        throw { code: 'P2002' };
      }
      const timestamp = new Date(Date.UTC(2026, 7, 16, 4, 0, this.clock++));
      const row: PrismaLeaderboardEntry = {
        ...data,
        id: `entry-${data.backtestResultId}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.rows.push(row);
      return row;
    }),
    findUnique: jest.fn(
      async ({ where }: { where: { backtestResultId: string } }) =>
        this.rows.find(
          (entry) => entry.backtestResultId === where.backtestResultId,
        ) ?? null,
    ),
    findMany: jest.fn(async (args?: FindManyArguments) =>
      this.rows.filter(
        (entry) =>
          !args?.where?.strategyVersionId ||
          entry.strategyVersionId === args.where.strategyVersionId,
      ),
    ),
    findFirst: jest.fn(
      async () =>
        [...this.rows].sort(
          (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
        )[0] ?? null,
    ),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { rank: number };
      }) => {
        const row = this.rows.find((entry) => entry.id === where.id);
        if (!row) throw new Error('row not found');
        row.rank = data.rank;
        return row;
      },
    ),
  };

  $transaction<T>(
    operation: (transaction: InMemoryLeaderboardPrisma) => Promise<T>,
  ): Promise<T> {
    return operation(this);
  }

  constructor() {
    Object.defineProperties(this, {
      strategyVersion: { get: this.forbiddenStrategyVersionAccess },
      backtestResult: { get: this.forbiddenBacktestResultAccess },
    });
  }
}

class BacktestResultPortFake implements IBacktestResultPort {
  readonly details = new Map<string, BacktestResultDetail>();
  readonly save = jest.fn<IBacktestResultPort['save']>();
  readonly getById = jest.fn<IBacktestResultPort['getById']>(async (id) => {
    if (this.unavailable) throw new Error('raw provider secret');
    return this.details.get(id) ?? null;
  });
  unavailable = false;
}

interface Harness {
  app: INestApplication;
  module: TestingModule;
  eventBus: IEventBus;
  prisma: InMemoryLeaderboardPrisma;
  resultPort: BacktestResultPortFake;
}

async function createHarness(scoringPolicy?: IScoringPolicy): Promise<Harness> {
  const prisma = new InMemoryLeaderboardPrisma();
  const resultPort = new BacktestResultPortFake();
  let builder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [() => ({ LEADERBOARD_TOP_K: 2 })],
      }),
      EventEmitterModule.forRoot(),
      LeaderboardModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(IBACKTEST_RESULT_PORT)
    .useValue(resultPort);

  if (scoringPolicy) {
    builder = builder.overrideProvider(ScoringPolicy).useValue(scoringPolicy);
  }

  const module = await builder.compile();
  const app = module.createNestApplication();
  await app.init();
  return {
    app,
    module,
    eventBus: module.get<IEventBus>(IEVENT_BUS),
    prisma,
    resultPort,
  };
}

function completion(
  overrides: Partial<BacktestCompletedPayload> = {},
): BacktestCompletedPayload {
  return {
    jobId: 'b8257d6b-d9df-47fb-83c1-839b04335e6f',
    correlationId: CORRELATION_ID,
    loopRunId: null,
    backtestResultId: RESULT_A1,
    strategyVersionId: VERSION_A,
    strategyName: 'Moving Average',
    strategyType: StrategyType.MA,
    isComposite: false,
    pair: 'BTCUSDT',
    timeframe: '1h',
    status: 'SUCCESS',
    metrics: {
      totalReturn: 20,
      winRate: 0.6 as NormalizedRate,
      maxDrawdown: -10,
      sharpeRatio: 1.2,
      profitFactor: 1.5,
      totalTrades: 10,
    },
    executedAt: EXECUTED_AT,
    executionTimeMs: 250,
    ...overrides,
  };
}

async function publishAndWait(
  harness: Harness,
  payload: BacktestCompletedPayload,
  expectedRows: number,
): Promise<void> {
  harness.eventBus.publish(
    EventType.BacktestCompleted,
    payload,
    CORRELATION_ID,
  );
  await eventually(
    () =>
      harness.prisma.rows.length === expectedRows &&
      harness.prisma.rows.every((row) => row.rank > 0),
  );
}

async function eventually(assertion: () => boolean): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (!assertion()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for asynchronous EventBus delivery');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

async function close(harness: Harness): Promise<void> {
  await harness.app.close();
}

describe('Leaderboard production wiring integration (T027)', () => {
  it('boots and carries BacktestCompleted through validation, persistence, ranking, and one exact update', async () => {
    const harness = await createHarness();
    const updates: Array<
      EventEnvelope<
        LeaderboardUpdatedPayload,
        typeof EventType.LeaderboardUpdated
      >
    > = [];
    harness.eventBus.subscribe(EventType.LeaderboardUpdated, (event) => {
      updates.push(event);
    });

    try {
      await publishAndWait(harness, completion(), 1);
      await eventually(() => updates.length === 1);

      expect(harness.prisma.rows[0]).toMatchObject({
        backtestResultId: RESULT_A1,
        rank: 1,
      });
      expect(harness.prisma.rows[0]?.score).toBeCloseTo(0.46);
      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({
        eventType: EventType.LeaderboardUpdated,
        eventVersion: 1,
        correlationId: CORRELATION_ID,
        payload: {
          triggeredByBacktestResultId: RESULT_A1,
          rankingCriterion: RankingCriterion.SCORE,
          topK: [{ backtestResultId: RESULT_A1, rank: 1 }],
        },
      });
      expect(updates[0]?.payload.topK[0]?.score).toBeCloseTo(0.46);
      expect(updates[0]?.payload.updatedAt).toBeInstanceOf(Date);
      expect(
        harness.prisma.forbiddenStrategyVersionAccess,
      ).not.toHaveBeenCalled();
      expect(
        harness.prisma.forbiddenBacktestResultAccess,
      ).not.toHaveBeenCalled();
    } finally {
      await close(harness);
    }
  });

  it('suppresses duplicate writes/broadcasts and rejects malformed metrics', async () => {
    const harness = await createHarness();
    const updates: LeaderboardUpdatedPayload[] = [];
    harness.eventBus.subscribe(EventType.LeaderboardUpdated, ({ payload }) => {
      updates.push(payload);
    });

    try {
      await publishAndWait(harness, completion(), 1);
      await eventually(() => updates.length === 1);
      const attemptsAfterFirst = harness.prisma.createAttempts;

      harness.eventBus.publish(EventType.BacktestCompleted, completion());
      harness.eventBus.publish(
        EventType.BacktestCompleted,
        completion({
          backtestResultId: RESULT_A2,
          metrics: { ...completion().metrics, winRate: 1.01 as NormalizedRate },
        }),
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(harness.prisma.rows).toHaveLength(1);
      expect(harness.prisma.createAttempts).toBe(attemptsAfterFirst);
      expect(updates).toHaveLength(1);
    } finally {
      await close(harness);
    }
  });

  it('does not broadcast when persistence fails and isolates the observer failure', async () => {
    const harness = await createHarness();
    const updates: LeaderboardUpdatedPayload[] = [];
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    harness.eventBus.subscribe(EventType.LeaderboardUpdated, ({ payload }) => {
      updates.push(payload);
    });
    harness.prisma.failNextCreate = true;

    try {
      expect(() =>
        harness.eventBus.publish(EventType.BacktestCompleted, completion()),
      ).not.toThrow();
      await eventually(() => harness.prisma.createAttempts === 1);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(harness.prisma.rows).toHaveLength(0);
      expect(updates).toHaveLength(0);
      expect(loggerError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Event subscriber failed',
          eventType: EventType.BacktestCompleted,
          correlationId: expect.any(String),
          error: expect.objectContaining({
            message: 'private database provider failure',
          }),
        }),
      );
    } finally {
      loggerError.mockRestore();
      await close(harness);
    }
  });

  it('persists all rows, ranks score ties deterministically, and serves best-per-version configured Top-K for every sort', async () => {
    const harness = await createHarness();
    const fixtures = [
      completion(),
      completion({
        backtestResultId: RESULT_A2,
        executedAt: new Date('2026-08-16T03:01:00.000Z'),
        metrics: {
          ...completion().metrics,
          totalReturn: 50,
          winRate: 0.4 as NormalizedRate,
          maxDrawdown: -20,
          sharpeRatio: 0.9,
        },
      }),
      completion({
        backtestResultId: RESULT_B,
        strategyVersionId: VERSION_B,
        strategyName: 'RSI',
        strategyType: StrategyType.RSI,
        executedAt: new Date('2026-08-16T03:02:00.000Z'),
        metrics: {
          ...completion().metrics,
          totalReturn: 10,
          winRate: 0.9 as NormalizedRate,
          maxDrawdown: -5,
          sharpeRatio: 2,
        },
      }),
      completion({
        backtestResultId: RESULT_C,
        strategyVersionId: VERSION_C,
        strategyName: 'MACD',
        strategyType: StrategyType.MACD,
        executedAt: new Date('2026-08-16T03:03:00.000Z'),
        metrics: {
          ...completion().metrics,
          totalReturn: 80,
          winRate: 0.2 as NormalizedRate,
          maxDrawdown: -30,
          sharpeRatio: 0.5,
        },
      }),
    ];

    try {
      for (const [index, fixture] of fixtures.entries()) {
        await publishAndWait(harness, fixture, index + 1);
      }

      expect(harness.prisma.rows).toHaveLength(4);
      expect(
        [...harness.prisma.rows]
          .sort((left, right) => left.rank - right.rank)
          .map((row) => row.backtestResultId),
      ).toEqual([RESULT_C, RESULT_A2, RESULT_B, RESULT_A1]);

      const expected: Record<RankingCriterion, string[]> = {
        [RankingCriterion.SCORE]: [RESULT_C, RESULT_A2],
        [RankingCriterion.TOTAL_RETURN]: [RESULT_C, RESULT_A2],
        [RankingCriterion.WIN_RATE]: [RESULT_B, RESULT_A1],
        [RankingCriterion.MAX_DRAWDOWN]: [RESULT_B, RESULT_A1],
        [RankingCriterion.SHARPE_RATIO]: [RESULT_B, RESULT_A1],
      };

      for (const criterion of Object.values(RankingCriterion)) {
        const response = await request(harness.app.getHttpServer())
          .get('/api/leaderboard')
          .query({ sortBy: criterion })
          .expect(200);
        expect(response.body.rankingCriterion).toBe(criterion);
        expect(
          (response.body.entries as Array<{ backtestResultId: string }>).map(
            (entry) => entry.backtestResultId,
          ),
        ).toEqual(expected[criterion]);
      }
    } finally {
      await close(harness);
    }
  });

  it('uses Sharpe, drawdown, execution time, then identity to break four-decimal score ties', async () => {
    const harness = await createHarness();
    const severeDrawdownTie = {
      ...completion().metrics,
      totalReturn: 36,
      winRate: 0.5 as NormalizedRate,
      maxDrawdown: -10,
      sharpeRatio: 1,
    };
    const lessSevereDrawdownTie = {
      ...severeDrawdownTie,
      totalReturn: 30,
      maxDrawdown: -5,
    };

    try {
      const ties = [
        completion({
          backtestResultId: RESULT_E,
          strategyVersionId: VERSION_A,
          metrics: severeDrawdownTie,
          executedAt: new Date('2026-08-16T04:00:00.000Z'),
        }),
        completion({
          backtestResultId: RESULT_A1,
          strategyVersionId: VERSION_B,
          metrics: severeDrawdownTie,
          executedAt: new Date('2026-08-16T03:00:00.000Z'),
        }),
        completion({
          backtestResultId: RESULT_D,
          strategyVersionId: VERSION_C,
          metrics: lessSevereDrawdownTie,
          executedAt: new Date('2026-08-16T04:00:00.000Z'),
        }),
        completion({
          backtestResultId: RESULT_A2,
          strategyVersionId: VERSION_A,
          metrics: severeDrawdownTie,
          executedAt: new Date('2026-08-16T04:00:00.000Z'),
        }),
        completion({
          backtestResultId: RESULT_B,
          strategyVersionId: VERSION_B,
          metrics: { ...severeDrawdownTie, sharpeRatio: 2 },
          executedAt: new Date('2026-08-16T05:00:00.000Z'),
        }),
      ];
      for (const [index, tie] of ties.entries()) {
        await publishAndWait(harness, tie, index + 1);
      }

      expect(
        [...harness.prisma.rows]
          .sort((left, right) => left.rank - right.rank)
          .map((row) => row.backtestResultId),
      ).toEqual([RESULT_B, RESULT_D, RESULT_A1, RESULT_A2, RESULT_E]);
    } finally {
      await close(harness);
    }
  });

  it('composes detail through the public port and returns stable 400/404/503 REST errors', async () => {
    const harness = await createHarness();
    harness.resultPort.details.set(RESULT_A1, detailFixture());

    try {
      await publishAndWait(harness, completion(), 1);

      const detail = await request(harness.app.getHttpServer())
        .get(`/api/leaderboard/${VERSION_A}`)
        .expect(200);
      expect(detail.body).toMatchObject({
        backtestResultId: RESULT_A1,
        strategyVersion: { id: VERSION_A, version: 1 },
        trades: [{ side: 'LONG', pnl: 10 }],
        executedAt: EXECUTED_AT.toISOString(),
      });
      expect(harness.resultPort.getById).toHaveBeenCalledWith(RESULT_A1);

      await request(harness.app.getHttpServer())
        .get('/api/leaderboard')
        .query({ sortBy: 'provider-secret-sort' })
        .expect(400)
        .expect({
          error: 'Invalid leaderboard sort criterion',
          code: 'INVALID_SORT_CRITERION',
        });
      await request(harness.app.getHttpServer())
        .get('/api/leaderboard/not-a-uuid')
        .expect(404)
        .expect({
          error: 'Leaderboard entry not found',
          code: 'LEADERBOARD_ENTRY_NOT_FOUND',
        });
      await request(harness.app.getHttpServer())
        .get(`/api/leaderboard/${VERSION_B}`)
        .expect(404)
        .expect({
          error: 'Leaderboard entry not found',
          code: 'LEADERBOARD_ENTRY_NOT_FOUND',
        });

      harness.resultPort.unavailable = true;
      await request(harness.app.getHttpServer())
        .get(`/api/leaderboard/${VERSION_A}`)
        .expect(503)
        .expect({
          error: 'Strategy Engine is unavailable',
          code: 'STRATEGY_ENGINE_UNAVAILABLE',
        });
    } finally {
      await close(harness);
    }
  });

  it('proves the scoring provider swap and idempotent subscription cleanup', async () => {
    const baseline = new ScoringPolicy();
    const alternative: IScoringPolicy = {
      calculateScore: jest.fn(() => 42),
      compare: (left, right) => baseline.compare(left, right),
    };
    const harness = await createHarness(alternative);
    const unsubscribe = jest.spyOn(harness.eventBus, 'unsubscribe');

    await publishAndWait(harness, completion(), 1);
    expect(alternative.calculateScore).toHaveBeenCalledTimes(1);
    expect(harness.prisma.rows[0]?.score).toBe(42);

    await harness.app.close();
    await harness.app.close();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    const attemptsAfterClose = harness.prisma.createAttempts;
    harness.eventBus.publish(
      EventType.BacktestCompleted,
      completion({ backtestResultId: RESULT_A2 }),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(harness.prisma.createAttempts).toBe(attemptsAfterClose);
  });
});

function detailFixture(): BacktestResultDetail {
  return {
    id: RESULT_A1,
    jobId: 'b8257d6b-d9df-47fb-83c1-839b04335e6f',
    strategyVersionId: VERSION_A,
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
    trades: [
      {
        entryDate: new Date('2026-08-15T01:00:00.000Z'),
        exitDate: new Date('2026-08-15T02:00:00.000Z'),
        entryPrice: 100,
        exitPrice: 110,
        side: 'LONG',
        pnl: 10,
        quantity: 1,
      },
    ],
    executedAt: EXECUTED_AT,
    executionTimeMs: 250,
    strategyVersion: {
      id: VERSION_A,
      strategyType: StrategyType.MA,
      name: 'Moving Average',
      version: 1,
      parameters: { period: 20 },
      isComposite: false,
      childVersionIds: [],
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
    },
  };
}
