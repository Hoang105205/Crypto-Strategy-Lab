/* eslint-disable @typescript-eslint/unbound-method -- Jest inspects typed fakes and provider seams. */
import {
  Logger,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
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
import { LeaderboardService } from './leaderboard.service';
import { ScoringPolicy, type IScoringPolicy } from './scoring-policy';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import { SupabaseService } from '../auth/supabase.service';
import { PushGateway } from '../dashboard/push.gateway';

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
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

interface CreateArguments {
  data: Omit<PrismaLeaderboardEntry, 'id' | 'createdAt' | 'updatedAt'>;
}

interface FindManyArguments {
  where?: {
    strategyVersionId?: string;
    userId?: string | null;
    OR?: Array<{ userId: string | null }>;
  };
}

interface DeleteManyArguments {
  where: { id: { in: string[] } };
}

const optionalAuthGuard: CanActivate = {
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      headers: { authorization?: string };
      user?: { id: string | null };
    }>();
    const token = request.headers.authorization?.replace(/^Bearer /, '');
    request.user = {
      id: token === 'user-a' ? USER_A : token === 'user-b' ? USER_B : null,
    };
    return true;
  },
};

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
    create: jest.fn(({ data }: CreateArguments) => {
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
        throw Object.assign(new Error('Unique constraint violation'), {
          code: 'P2002',
        });
      }
      const timestamp = new Date(Date.UTC(2026, 7, 16, 4, 0, this.clock++));
      const row: PrismaLeaderboardEntry = {
        ...data,
        id: `entry-${data.backtestResultId}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.rows.push(row);
      return Promise.resolve(row);
    }),
    findUnique: jest.fn(({ where }: { where: { backtestResultId: string } }) =>
      Promise.resolve(
        this.rows.find(
          (entry) => entry.backtestResultId === where.backtestResultId,
        ) ?? null,
      ),
    ),
    findMany: jest.fn((args?: FindManyArguments) =>
      Promise.resolve(
        this.rows.filter(
          (entry) =>
            (!args?.where?.strategyVersionId ||
              entry.strategyVersionId === args.where.strategyVersionId) &&
            matchesViewerWhere(entry, args?.where),
        ),
      ),
    ),
    findFirst: jest.fn((args?: FindManyArguments) =>
      Promise.resolve(
        this.rows
          .filter((entry) => matchesViewerWhere(entry, args?.where))
          .sort(
            (left, right) =>
              right.updatedAt.getTime() - left.updatedAt.getTime(),
          )[0] ?? null,
      ),
    ),
    update: jest.fn(
      ({ where, data }: { where: { id: string }; data: { rank: number } }) => {
        const row = this.rows.find((entry) => entry.id === where.id);
        if (!row) throw new Error('row not found');
        row.rank = data.rank;
        return Promise.resolve(row);
      },
    ),
    deleteMany: jest.fn(({ where }: DeleteManyArguments) => {
      const ids = new Set(where.id.in);
      const previousLength = this.rows.length;
      for (let index = this.rows.length - 1; index >= 0; index -= 1) {
        if (ids.has(this.rows[index].id)) this.rows.splice(index, 1);
      }
      return Promise.resolve({ count: previousLength - this.rows.length });
    }),
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
  readonly getById = jest.fn<IBacktestResultPort['getById']>((id) => {
    if (this.unavailable) throw new Error('raw provider secret');
    return Promise.resolve(this.details.get(id) ?? null);
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
    .useValue(resultPort)
    .overrideProvider(SupabaseService)
    .useValue({ verifyToken: jest.fn() })
    .overrideGuard(SupabaseJwtGuard)
    .useValue(optionalAuthGuard);

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
    userId: null,
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
  if (!harness.resultPort.details.has(payload.backtestResultId)) {
    const detail = detailFixture();
    harness.resultPort.details.set(payload.backtestResultId, {
      ...detail,
      id: payload.backtestResultId,
      jobId: payload.jobId,
      userId: payload.userId,
      strategyVersionId: payload.strategyVersionId,
      pair: payload.pair,
      timeframe: payload.timeframe,
      totalReturn: payload.metrics.totalReturn,
      winRate: payload.metrics.winRate,
      maxDrawdown: payload.metrics.maxDrawdown,
      sharpeRatio: payload.metrics.sharpeRatio,
      profitFactor: payload.metrics.profitFactor,
      totalTrades: payload.metrics.totalTrades,
      executedAt: payload.executedAt,
      executionTimeMs: payload.executionTimeMs,
      strategyVersion: {
        ...detail.strategyVersion,
        id: payload.strategyVersionId,
        userId: payload.userId,
        strategyType: payload.strategyType,
        name: payload.strategyName,
        isComposite: payload.isComposite,
      },
    });
  }
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

  it('removes confirmed orphan projections and reranks surviving entries', async () => {
    const harness = await createHarness();

    try {
      await publishAndWait(harness, completion(), 1);
      await publishAndWait(
        harness,
        completion({
          backtestResultId: RESULT_B,
          strategyVersionId: VERSION_B,
          metrics: { ...completion().metrics, totalReturn: 10 },
        }),
        2,
      );
      harness.resultPort.details.delete(RESULT_A1);

      const deleted = await harness.module
        .get(LeaderboardService)
        .cleanupOrphans();

      expect(deleted).toBe(1);
      expect(harness.prisma.rows).toHaveLength(1);
      expect(harness.prisma.rows[0]).toMatchObject({
        backtestResultId: RESULT_B,
        rank: 1,
      });
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
      expect(loggerError).toHaveBeenCalledTimes(1);
      const logged = loggerError.mock.calls[0]?.[0] as {
        message: string;
        eventType: EventType;
        correlationId: string;
        error: { message: string };
      };
      expect(logged.message).toBe('Event subscriber failed');
      expect(logged.eventType).toBe(EventType.BacktestCompleted);
      expect(typeof logged.correlationId).toBe('string');
      expect(logged.error.message).toBe('private database provider failure');
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
        const body = response.body as {
          rankingCriterion: RankingCriterion;
          entries: Array<{ backtestResultId: string }>;
        };
        expect(body.rankingCriterion).toBe(criterion);
        expect(body.entries.map((entry) => entry.backtestResultId)).toEqual(
          expected[criterion],
        );
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

describe('T012 private-detail anti-enumeration', () => {
  it('returns the identical stable 404 for foreign existing and nonexistent details for A and B', async () => {
    const harness = await createHarness();
    const detailA = detailFixture();
    const detailB: BacktestResultDetail = {
      ...detailFixture(),
      id: RESULT_B,
      userId: USER_B,
      strategyVersionId: VERSION_B,
      strategyVersion: {
        ...detailFixture().strategyVersion,
        id: VERSION_B,
        userId: USER_B,
      },
    };
    harness.resultPort.details.set(RESULT_A1, {
      ...detailA,
      userId: USER_A,
      strategyVersion: { ...detailA.strategyVersion, userId: USER_A },
    });
    harness.resultPort.details.set(RESULT_B, detailB);

    try {
      await publishAndWait(harness, completion({ userId: USER_A }), 1);
      await publishAndWait(
        harness,
        completion({
          userId: USER_B,
          backtestResultId: RESULT_B,
          strategyVersionId: VERSION_B,
        }),
        2,
      );

      const nonexistentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const expected = {
        error: 'Leaderboard entry not found',
        code: 'LEADERBOARD_ENTRY_NOT_FOUND',
      };
      const anonymousPrivate = await request(harness.app.getHttpServer()).get(
        `/api/leaderboard/${VERSION_A}`,
      );
      const aOwn = await request(harness.app.getHttpServer())
        .get(`/api/leaderboard/${VERSION_A}`)
        .set('Authorization', 'Bearer user-a');
      const bOwn = await request(harness.app.getHttpServer())
        .get(`/api/leaderboard/${VERSION_B}`)
        .set('Authorization', 'Bearer user-b');
      const aForeign = await request(harness.app.getHttpServer())
        .get(`/api/leaderboard/${VERSION_B}`)
        .set('Authorization', 'Bearer user-a');
      const aMissing = await request(harness.app.getHttpServer())
        .get(`/api/leaderboard/${nonexistentId}`)
        .set('Authorization', 'Bearer user-a');
      const bForeign = await request(harness.app.getHttpServer())
        .get(`/api/leaderboard/${VERSION_A}`)
        .set('Authorization', 'Bearer user-b');
      const bMissing = await request(harness.app.getHttpServer())
        .get(`/api/leaderboard/${nonexistentId}`)
        .set('Authorization', 'Bearer user-b');

      expect(aOwn.status).toBe(200);
      expect(aOwn.body).toMatchObject({ userId: USER_A });
      expect(bOwn.status).toBe(200);
      expect(bOwn.body).toMatchObject({ userId: USER_B });
      for (const response of [
        anonymousPrivate,
        aForeign,
        aMissing,
        bForeign,
        bMissing,
      ]) {
        expect(response.status).toBe(404);
        expect(response.body).toEqual(expected);
      }
      expect(aForeign.body).toEqual(aMissing.body);
      expect(bForeign.body).toEqual(bMissing.body);
    } finally {
      await close(harness);
    }
  });
});

describe('T006 explicit scoped REST projections', () => {
  it('filters every scope before criterion ranking, Top-K, rank and updatedAt', async () => {
    const harness = await createHarness();
    const seeded = [
      completion({
        userId: null,
        strategyVersionId: VERSION_A,
        backtestResultId: RESULT_A1,
        strategyName: 'System One',
        metrics: { ...completion().metrics, totalReturn: 90, sharpeRatio: 3 },
      }),
      completion({
        userId: null,
        strategyVersionId: VERSION_B,
        backtestResultId: RESULT_A2,
        strategyName: 'System Two',
        metrics: { ...completion().metrics, totalReturn: 80, sharpeRatio: 2.8 },
      }),
      completion({
        userId: USER_A,
        strategyVersionId: VERSION_C,
        backtestResultId: RESULT_B,
        strategyName: 'A One',
        metrics: { ...completion().metrics, totalReturn: 10, sharpeRatio: 1.2 },
      }),
      completion({
        userId: USER_A,
        strategyVersionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        backtestResultId: RESULT_C,
        strategyName: 'A Two',
        metrics: { ...completion().metrics, totalReturn: 5, sharpeRatio: 1.1 },
      }),
      completion({
        userId: USER_B,
        strategyVersionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        backtestResultId: RESULT_D,
        strategyName: 'B Private',
        metrics: { ...completion().metrics, totalReturn: 100, sharpeRatio: 4 },
      }),
    ];

    try {
      for (const payload of seeded) {
        harness.resultPort.details.set(payload.backtestResultId, {
          ...detailFixture(),
          id: payload.backtestResultId,
          userId: payload.userId,
          strategyVersionId: payload.strategyVersionId,
          strategyVersion: {
            ...detailFixture().strategyVersion,
            id: payload.strategyVersionId,
            userId: payload.userId,
          },
        });
        await publishAndWait(harness, payload, harness.prisma.rows.length + 1);
      }

      const systemUpdatedAt = maxUpdatedAt(harness.prisma.rows, null);
      const mineUpdatedAt = maxUpdatedAt(harness.prisma.rows, USER_A);
      for (const criterion of Object.values(RankingCriterion)) {
        const system = await request(harness.app.getHttpServer())
          .get('/api/leaderboard')
          .query({ scope: 'system', sortBy: criterion })
          .set('Authorization', 'Bearer user-a')
          .expect(200);
        const mine = await request(harness.app.getHttpServer())
          .get('/api/leaderboard')
          .query({ scope: 'mine', sortBy: criterion })
          .set('Authorization', 'Bearer user-a')
          .expect(200);
        const systemBody = system.body as {
          updatedAt: string;
          entries: Array<{ userId: string | null; rank: number }>;
        };
        const mineBody = mine.body as typeof systemBody;

        expect(systemBody.entries.every(({ userId }) => userId === null)).toBe(
          true,
        );
        expect(mineBody.entries.every(({ userId }) => userId === USER_A)).toBe(
          true,
        );
        expect(systemBody.entries.map(({ rank }) => rank)).toEqual([1, 2]);
        expect(mineBody.entries.map(({ rank }) => rank)).toEqual([1, 2]);
        expect(systemBody.updatedAt).toBe(systemUpdatedAt.toISOString());
        expect(mineBody.updatedAt).toBe(mineUpdatedAt.toISOString());
      }

      const combined = await request(harness.app.getHttpServer())
        .get('/api/leaderboard')
        .set('Authorization', 'Bearer user-a')
        .expect(200);
      expect(
        (combined.body as { entries: Array<{ userId: string | null }> })
          .entries,
      ).toHaveLength(2);
      expect(
        (
          combined.body as { entries: Array<{ userId: string | null }> }
        ).entries.every(({ userId }) => userId === null),
      ).toBe(true);

      const callsBeforeAnonymousMine =
        harness.prisma.leaderboardEntry.findMany.mock.calls.length +
        harness.prisma.leaderboardEntry.findFirst.mock.calls.length;
      const anonymousMine = await request(harness.app.getHttpServer())
        .get('/api/leaderboard')
        .query({ scope: 'mine' })
        .expect(200);
      expect(anonymousMine.body).toMatchObject({
        rankingCriterion: RankingCriterion.SCORE,
        updatedAt: new Date(0).toISOString(),
        entries: [],
      });
      expect(
        harness.prisma.leaderboardEntry.findMany.mock.calls.length +
          harness.prisma.leaderboardEntry.findFirst.mock.calls.length,
      ).toBe(callsBeforeAnonymousMine);

      await request(harness.app.getHttpServer())
        .get('/api/leaderboard')
        .query({ scope: 'invalid-private-scope' })
        .expect(400)
        .expect({
          error: 'Invalid leaderboard scope',
          code: 'INVALID_LEADERBOARD_SCOPE',
        });
    } finally {
      await close(harness);
    }
  });

  it('authorizes detail with the same scope before crossing the Strategy result port', async () => {
    const harness = await createHarness();
    const systemPayload = completion({ userId: null });
    const privatePayload = completion({
      userId: USER_A,
      strategyVersionId: VERSION_B,
      backtestResultId: RESULT_B,
    });
    for (const payload of [systemPayload, privatePayload]) {
      harness.resultPort.details.set(payload.backtestResultId, {
        ...detailFixture(),
        id: payload.backtestResultId,
        userId: payload.userId,
        strategyVersionId: payload.strategyVersionId,
        strategyVersion: {
          ...detailFixture().strategyVersion,
          id: payload.strategyVersionId,
          userId: payload.userId,
        },
      });
      await publishAndWait(harness, payload, harness.prisma.rows.length + 1);
    }

    try {
      harness.resultPort.getById.mockClear();
      await request(harness.app.getHttpServer())
        .get(`/api/leaderboard/${VERSION_A}`)
        .query({ scope: 'system' })
        .set('Authorization', 'Bearer user-a')
        .expect(200);
      await request(harness.app.getHttpServer())
        .get(`/api/leaderboard/${VERSION_B}`)
        .query({ scope: 'mine' })
        .set('Authorization', 'Bearer user-a')
        .expect(200);
      expect(harness.resultPort.getById).toHaveBeenCalledTimes(2);

      const expected = {
        error: 'Leaderboard entry not found',
        code: 'LEADERBOARD_ENTRY_NOT_FOUND',
      };
      for (const [strategyVersionId, scope] of [
        [VERSION_A, 'mine'],
        [VERSION_B, 'system'],
        [VERSION_B, 'mine'],
        ['ffffffff-ffff-4fff-8fff-ffffffffffff', 'mine'],
      ] as const) {
        const response = request(harness.app.getHttpServer())
          .get(`/api/leaderboard/${strategyVersionId}`)
          .query({ scope });
        if (strategyVersionId === VERSION_B) {
          response.set('Authorization', 'Bearer user-b');
        }
        await response.expect(404).expect(expected);
      }
      expect(harness.resultPort.getById).toHaveBeenCalledTimes(2);
    } finally {
      await close(harness);
    }
  });
});

describe('T022 private A/B completions at the namespace-wide gateway boundary', () => {
  it('emits only the system projection and redacts both private result IDs', async () => {
    const harness = await createHarness();
    const gateway = new PushGateway(harness.eventBus);
    const server = {
      emit: jest.fn<(channel: string, payload: unknown) => void>(),
    };
    gateway.server = server as never;
    gateway.onModuleInit();

    try {
      await publishAndWait(harness, completion({ userId: null }), 1);
      await eventually(
        () =>
          server.emit.mock.calls.filter(
            ([channel]) => channel === 'leaderboard:update',
          ).length === 1,
      );
      await publishAndWait(
        harness,
        completion({
          userId: USER_A,
          backtestResultId: RESULT_B,
          strategyVersionId: VERSION_B,
          strategyName: 'Private A',
        }),
        2,
      );
      await publishAndWait(
        harness,
        completion({
          userId: USER_B,
          backtestResultId: RESULT_C,
          strategyVersionId: VERSION_C,
          strategyName: 'Private B',
        }),
        3,
      );
      await eventually(
        () =>
          server.emit.mock.calls.filter(
            ([channel]) => channel === 'leaderboard:update',
          ).length === 3,
      );

      const emitted = server.emit.mock.calls
        .filter(([channel]) => channel === 'leaderboard:update')
        .map(([, payload]) => payload as LeaderboardUpdatedPayload);
      const systemPayload = emitted[0];
      expect(systemPayload).toBeDefined();
      expect(systemPayload?.updatedAt).toBeInstanceOf(Date);
      expect(systemPayload).toMatchObject({
        triggeredByBacktestResultId: RESULT_A1,
        rankingCriterion: RankingCriterion.SCORE,
        topK: [
          expect.objectContaining({
            userId: null,
            backtestResultId: RESULT_A1,
            rank: 1,
          }),
        ],
      });

      for (const privatePayload of emitted.slice(1)) {
        expect(privatePayload).toEqual({
          updatedAt: systemPayload?.updatedAt,
          triggeredByBacktestResultId: null,
          rankingCriterion: RankingCriterion.SCORE,
          topK: systemPayload?.topK,
        });
      }

      const privateWire = JSON.stringify(emitted.slice(1));
      for (const forbidden of [
        USER_A,
        USER_B,
        RESULT_B,
        RESULT_C,
        VERSION_B,
        VERSION_C,
        'Private A',
        'Private B',
      ]) {
        expect(privateWire).not.toContain(forbidden);
      }
      expect(
        emitted.every((payload) =>
          payload.topK.every(({ userId }) => userId === null),
        ),
      ).toBe(true);
    } finally {
      gateway.onModuleDestroy();
      await close(harness);
    }
  });
});

function matchesViewerWhere(
  entry: PrismaLeaderboardEntry,
  where?: FindManyArguments['where'],
): boolean {
  if (!where || (!Object.hasOwn(where, 'userId') && !where.OR)) return true;
  if (Object.hasOwn(where, 'userId')) return entry.userId === where.userId;
  return where.OR?.some(({ userId }) => entry.userId === userId) ?? false;
}

function maxUpdatedAt(
  rows: PrismaLeaderboardEntry[],
  userId: string | null,
): Date {
  const times = rows
    .filter((row) => row.userId === userId)
    .map((row) => row.updatedAt.getTime());
  return new Date(Math.max(...times));
}

function detailFixture(): BacktestResultDetail {
  return {
    id: RESULT_A1,
    jobId: 'b8257d6b-d9df-47fb-83c1-839b04335e6f',
    userId: null,
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
      userId: null,
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
