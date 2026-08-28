import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  EventType,
  LoopStatus,
  StrategyGeneratorType,
  StrategyType,
  type BacktestCompletedPayload,
  type BacktestResultDetail,
  type IBacktestResultPort,
  type IEventBus,
  type LeaderboardUpdatedPayload,
  type NormalizedRate,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';
import type { LeaderboardEntry as PrismaLeaderboardEntry } from '@prisma/client';
import { jest } from '@jest/globals';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { SupabaseJwtGuard } from '../src/auth/supabase-jwt.guard';
import { SupabaseService } from '../src/auth/supabase.service';
import { PrismaService } from '../src/database/prisma.service';
import { PushGateway } from '../src/dashboard/push.gateway';
import { EventsModule } from '../src/events/events.module';
import { LeaderboardModule } from '../src/leaderboard/leaderboard.module';
import { LoopController } from '../src/loop/loop.controller';
import { LoopStatusService } from '../src/loop/loop-status.service';
import { StrategyLoopService } from '../src/loop/strategy-loop.service';
import { IBACKTEST_RESULT_PORT, IEVENT_BUS } from '../src/shared/tokens';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const SYSTEM_VERSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SYSTEM_RESULT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const A_VERSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const A_RESULT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const B_VERSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const B_RESULT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
const GLOBAL_LOOP_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

interface FindManyArguments {
  where?: {
    strategyVersionId?: string;
    userId?: string | null;
    OR?: Array<{ userId: string | null }>;
  };
}

class InMemoryLeaderboardPrisma {
  readonly rows: PrismaLeaderboardEntry[] = [];
  private clock = 0;

  readonly leaderboardEntry = {
    create: jest.fn(
      ({
        data,
      }: {
        data: Omit<PrismaLeaderboardEntry, 'id' | 'createdAt' | 'updatedAt'>;
      }) => {
        const timestamp = new Date(Date.UTC(2026, 7, 24, 1, 0, this.clock++));
        const row: PrismaLeaderboardEntry = {
          ...data,
          id: `entry-${data.backtestResultId}`,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        this.rows.push(row);
        return Promise.resolve(row);
      },
    ),
    findUnique: jest.fn(({ where }: { where: { backtestResultId: string } }) =>
      Promise.resolve(
        this.rows.find(
          (row) => row.backtestResultId === where.backtestResultId,
        ) ?? null,
      ),
    ),
    findMany: jest.fn((args?: FindManyArguments) =>
      Promise.resolve(
        this.rows.filter(
          (row) =>
            (!args?.where?.strategyVersionId ||
              row.strategyVersionId === args.where.strategyVersionId) &&
            matchesViewer(row, args?.where),
        ),
      ),
    ),
    findFirst: jest.fn((args?: FindManyArguments) =>
      Promise.resolve(
        [...this.rows]
          .filter((row) => matchesViewer(row, args?.where))
          .sort(
            (left, right) =>
              right.updatedAt.getTime() - left.updatedAt.getTime(),
          )[0] ?? null,
      ),
    ),
    update: jest.fn(
      ({ where, data }: { where: { id: string }; data: { rank: number } }) => {
        const row = this.rows.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error('row not found');
        row.rank = data.rank;
        return Promise.resolve(row);
      },
    ),
  };

  $transaction<T>(
    operation: (transaction: InMemoryLeaderboardPrisma) => Promise<T>,
  ): Promise<T> {
    return operation(this);
  }
}

class BacktestResultPortFake implements IBacktestResultPort {
  readonly details = new Map<string, BacktestResultDetail>();
  readonly save = jest.fn<IBacktestResultPort['save']>();
  readonly getById = jest.fn<IBacktestResultPort['getById']>((id) =>
    Promise.resolve(this.details.get(id) ?? null),
  );
}

const optionalAuthGuard: CanActivate = {
  canActivate(context: ExecutionContext): boolean {
    const httpRequest = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { id: string | null };
    }>();
    const token = httpRequest.headers.authorization?.replace(/^Bearer /, '');
    httpRequest.user = {
      id: token === 'user-a' ? USER_A : token === 'user-b' ? USER_B : null,
    };
    return true;
  },
};

const globalLoop: SearchLoopRun = {
  id: GLOBAL_LOOP_ID,
  status: LoopStatus.RUNNING,
  generatorType: StrategyGeneratorType.DOMAIN_GUIDED,
  iteration: 7,
  testedCandidates: 7,
  maxCandidates: 100,
  maxDurationMs: null,
  stopOnNoImprovementIterations: 50,
  currentCandidateStrategyVersionId: SYSTEM_VERSION,
  bestStrategyVersionId: SYSTEM_VERSION,
  bestScore: 0.91,
  stopReason: null,
  startedAt: new Date('2026-08-24T00:00:00.000Z'),
  pausedAt: null,
  stoppedAt: null,
};

describe('per-user leaderboard (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let eventBus: IEventBus;
  let prisma: InMemoryLeaderboardPrisma;
  let resultPort: BacktestResultPortFake;
  const getCurrentLoop = jest.fn(() => Promise.resolve(globalLoop));

  beforeAll(async () => {
    prisma = new InMemoryLeaderboardPrisma();
    resultPort = new BacktestResultPortFake();
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ LEADERBOARD_TOP_K: 3 })],
        }),
        EventsModule,
        LeaderboardModule,
      ],
      controllers: [LoopController],
      providers: [
        PushGateway,
        {
          provide: LoopStatusService,
          useValue: { getCurrent: getCurrentLoop },
        },
        { provide: StrategyLoopService, useValue: {} },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(IBACKTEST_RESULT_PORT)
      .useValue(resultPort)
      .overrideProvider(SupabaseService)
      .useValue({ verifyToken: jest.fn() })
      .overrideGuard(SupabaseJwtGuard)
      .useValue(optionalAuthGuard)
      .compile();

    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    eventBus = module.get<IEventBus>(IEVENT_BUS);

    for (const payload of [
      completion({
        userId: null,
        strategyVersionId: SYSTEM_VERSION,
        backtestResultId: SYSTEM_RESULT,
        strategyName: 'System Momentum',
        metrics: metrics(30, 0.8, 2.1),
      }),
      completion({
        userId: USER_A,
        strategyVersionId: A_VERSION,
        backtestResultId: A_RESULT,
        strategyName: 'Private A',
        metrics: metrics(50, 0.9, 2.5),
      }),
      completion({
        userId: USER_B,
        strategyVersionId: B_VERSION,
        backtestResultId: B_RESULT,
        strategyName: 'Private B',
        metrics: metrics(40, 0.85, 2.3),
      }),
    ]) {
      resultPort.details.set(payload.backtestResultId, detail(payload));
      eventBus.publish(EventType.BacktestCompleted, payload);
      await eventually(
        () =>
          prisma.rows.length >
          [SYSTEM_RESULT, A_RESULT, B_RESULT].indexOf(payload.backtestResultId),
      );
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('scopes list Top-K, ranks, updatedAt and one global loop for anonymous/A/B', async () => {
    const actors = [
      { token: null, owners: [null], updatedAt: '2026-08-24T01:00:00.000Z' },
      {
        token: 'user-a',
        owners: [USER_A, null],
        updatedAt: '2026-08-24T01:00:01.000Z',
      },
      {
        token: 'user-b',
        owners: [USER_B, null],
        updatedAt: '2026-08-24T01:00:02.000Z',
      },
    ] as const;

    const observedLoops: unknown[] = [];
    for (const actor of actors) {
      const listRequest = request(app.getHttpServer()).get('/api/leaderboard');
      const loopRequest = request(app.getHttpServer()).get('/api/loop/current');
      if (actor.token) {
        listRequest.auth(actor.token, { type: 'bearer' });
        loopRequest.auth(actor.token, { type: 'bearer' });
      }
      const list = await listRequest.expect(200);
      const loop = await loopRequest.expect(200);
      const listBody = list.body as {
        entries: Array<{ rank: number; userId: string | null }>;
        updatedAt: string;
      };
      const entries = listBody.entries;

      expect(entries.map((entry) => entry.rank)).toEqual(
        entries.map((_, index) => index + 1),
      );
      expect(new Set(entries.map((entry) => entry.userId))).toEqual(
        new Set(actor.owners),
      );
      expect(listBody.updatedAt).toBe(actor.updatedAt);
      observedLoops.push(loop.body);
    }

    expect(observedLoops).toEqual([
      expect.objectContaining({ id: GLOBAL_LOOP_ID }),
      expect.objectContaining({ id: GLOBAL_LOOP_ID }),
      expect.objectContaining({ id: GLOBAL_LOOP_ID }),
    ]);
    expect(getCurrentLoop).toHaveBeenCalledTimes(3);
    expect(getCurrentLoop.mock.calls.every((args) => args.length === 0)).toBe(
      true,
    );
  });

  it('serves explicit System/Mine projections, keeps omitted Combined, and rejects invalid scope', async () => {
    const additions = [
      completion({
        userId: null,
        strategyVersionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
        backtestResultId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
        strategyName: 'System High One',
        metrics: metrics(500, 0.99, 5),
      }),
      completion({
        userId: null,
        strategyVersionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
        backtestResultId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6',
        strategyName: 'System High Two',
        metrics: metrics(400, 0.98, 4.5),
      }),
      completion({
        userId: null,
        strategyVersionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
        backtestResultId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7',
        strategyName: 'System High Three',
        metrics: metrics(300, 0.97, 4),
      }),
      completion({
        userId: USER_A,
        strategyVersionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8',
        backtestResultId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8',
        strategyName: 'A Below Combined Cutoff',
        metrics: metrics(1, 0.51, 0.5),
      }),
    ];
    for (const payload of additions) {
      resultPort.details.set(payload.backtestResultId, detail(payload));
      const expectedRows = prisma.rows.length + 1;
      eventBus.publish(EventType.BacktestCompleted, payload);
      await eventually(() => prisma.rows.length === expectedRows);
    }

    const systemAnonymous = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .query({ scope: 'system' })
      .expect(200);
    const systemA = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .query({ scope: 'system' })
      .auth('user-a', { type: 'bearer' })
      .expect(200);
    const systemB = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .query({ scope: 'system' })
      .auth('user-b', { type: 'bearer' })
      .expect(200);
    const mineA = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .query({ scope: 'mine' })
      .auth('user-a', { type: 'bearer' })
      .expect(200);
    const mineB = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .query({ scope: 'mine' })
      .auth('user-b', { type: 'bearer' })
      .expect(200);
    const combinedA = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .auth('user-a', { type: 'bearer' })
      .expect(200);
    const callsBeforeAnonymousMine =
      prisma.leaderboardEntry.findMany.mock.calls.length +
      prisma.leaderboardEntry.findFirst.mock.calls.length;
    const anonymousMine = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .query({ scope: 'mine' })
      .expect(200);

    const entries = (response: typeof systemA) =>
      (
        response.body as {
          entries: Array<{ userId: string | null; rank: number }>;
        }
      ).entries;
    expect(
      entries(systemAnonymous).every(({ userId }) => userId === null),
    ).toBe(true);
    expect(systemA.body).toEqual(systemAnonymous.body);
    expect(systemB.body).toEqual(systemAnonymous.body);
    expect(entries(mineA).map(({ userId }) => userId)).toEqual([
      USER_A,
      USER_A,
    ]);
    expect(entries(mineA).map(({ rank }) => rank)).toEqual([1, 2]);
    expect(entries(mineB).map(({ userId }) => userId)).toEqual([USER_B]);
    expect(entries(combinedA).every(({ userId }) => userId === null)).toBe(
      true,
    );
    expect(anonymousMine.body).toMatchObject({
      updatedAt: new Date(0).toISOString(),
      entries: [],
    });
    const scopedUpdatedAt = (userId: string | null) =>
      new Date(
        Math.max(
          ...prisma.rows
            .filter((row) => row.userId === userId)
            .map((row) => row.updatedAt.getTime()),
        ),
      ).toISOString();
    expect((systemAnonymous.body as { updatedAt: string }).updatedAt).toBe(
      scopedUpdatedAt(null),
    );
    expect((mineA.body as { updatedAt: string }).updatedAt).toBe(
      scopedUpdatedAt(USER_A),
    );
    expect((mineB.body as { updatedAt: string }).updatedAt).toBe(
      scopedUpdatedAt(USER_B),
    );
    expect(
      prisma.leaderboardEntry.findMany.mock.calls.length +
        prisma.leaderboardEntry.findFirst.mock.calls.length,
    ).toBe(callsBeforeAnonymousMine);

    await request(app.getHttpServer())
      .get('/api/leaderboard')
      .query({ scope: 'not-a-scope' })
      .expect(400)
      .expect({
        error: 'Invalid leaderboard scope',
        code: 'INVALID_LEADERBOARD_SCOPE',
      });

    resultPort.getById.mockClear();
    const notFound = {
      error: 'Leaderboard entry not found',
      code: 'LEADERBOARD_ENTRY_NOT_FOUND',
    };
    for (const [strategyVersionId, scope, token] of [
      [SYSTEM_VERSION, 'mine', 'user-a'],
      [A_VERSION, 'system', 'user-a'],
      [A_VERSION, 'mine', null],
      [A_VERSION, 'mine', 'user-b'],
      ['dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'mine', 'user-a'],
    ] as const) {
      const detailRequest = request(app.getHttpServer())
        .get(`/api/leaderboard/${strategyVersionId}`)
        .query({ scope });
      if (token) detailRequest.auth(token, { type: 'bearer' });
      await detailRequest.expect(404).expect(notFound);
    }
    expect(resultPort.getById).not.toHaveBeenCalled();
  });

  it('returns identical not-found responses for nonexistent and foreign private details', async () => {
    const notFound = {
      error: 'Leaderboard entry not found',
      code: 'LEADERBOARD_ENTRY_NOT_FOUND',
    };

    await request(app.getHttpServer())
      .get(`/api/leaderboard/${SYSTEM_VERSION}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { userId: string | null };
        expect(body.userId).toBeNull();
      });
    await request(app.getHttpServer())
      .get(`/api/leaderboard/${A_VERSION}`)
      .auth('user-a', { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const body = response.body as { userId: string | null };
        expect(body.userId).toBe(USER_A);
      });

    for (const [token, foreignVersion] of [
      [null, A_VERSION],
      ['user-a', B_VERSION],
      ['user-b', A_VERSION],
    ] as const) {
      const foreign = request(app.getHttpServer()).get(
        `/api/leaderboard/${foreignVersion}`,
      );
      const missing = request(app.getHttpServer()).get(
        '/api/leaderboard/dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      );
      if (token) {
        foreign.auth(token, { type: 'bearer' });
        missing.auth(token, { type: 'bearer' });
      }
      await foreign.expect(404).expect(notFound);
      await missing.expect(404).expect(notFound);
    }
  });

  it('publishes only system rows and redacts private trigger identity over the real websocket', async () => {
    const httpServer = app.getHttpServer() as {
      address(): AddressInfo | string | null;
    };
    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected the E2E HTTP server to expose a TCP address');
    }
    const client = io(`http://127.0.0.1:${address.port}/infrastructure`, {
      transports: ['websocket'],
      forceNew: true,
    });
    await once(client, 'connect');

    try {
      const nextPayload = oncePayload<LeaderboardUpdatedPayload>(
        client,
        'leaderboard:update',
      );
      const privateResult = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4';
      const privateVersion = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
      eventBus.publish(
        EventType.BacktestCompleted,
        completion({
          userId: USER_A,
          backtestResultId: privateResult,
          strategyVersionId: privateVersion,
          strategyName: 'A Secret Realtime',
          metrics: metrics(99, 0.99, 4),
        }),
      );
      const payload = await nextPayload;
      const serialized = JSON.stringify(payload);

      expect(payload.triggeredByBacktestResultId).toBeNull();
      expect(payload.topK.length).toBeGreaterThan(0);
      expect(payload.topK.every((row) => row.userId === null)).toBe(true);
      for (const privateValue of [
        USER_A,
        USER_B,
        privateResult,
        privateVersion,
        'A Secret Realtime',
      ]) {
        expect(serialized).not.toContain(privateValue);
      }
    } finally {
      client.disconnect();
    }
  });
});

function matchesViewer(
  row: PrismaLeaderboardEntry,
  where?: FindManyArguments['where'],
): boolean {
  if (!where) return true;
  if (where.userId !== undefined) return row.userId === where.userId;
  if (where.OR) return where.OR.some((branch) => row.userId === branch.userId);
  return true;
}

function metrics(totalReturn: number, winRate: number, sharpeRatio: number) {
  return {
    totalReturn,
    winRate: winRate as NormalizedRate,
    maxDrawdown: -5,
    sharpeRatio,
    profitFactor: 2,
    totalTrades: 20,
  };
}

function completion(
  overrides: Partial<BacktestCompletedPayload>,
): BacktestCompletedPayload {
  return {
    jobId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    userId: null,
    loopRunId: null,
    backtestResultId: SYSTEM_RESULT,
    strategyVersionId: SYSTEM_VERSION,
    strategyName: 'System Momentum',
    strategyType: StrategyType.RSI,
    isComposite: false,
    pair: 'BTCUSDT',
    timeframe: '1h',
    status: 'SUCCESS',
    metrics: metrics(10, 0.6, 1),
    executedAt: new Date('2026-08-24T00:00:00.000Z'),
    executionTimeMs: 10,
    ...overrides,
  };
}

function detail(payload: BacktestCompletedPayload): BacktestResultDetail {
  return {
    id: payload.backtestResultId,
    userId: payload.userId,
    strategyVersion: {
      id: payload.strategyVersionId,
      strategyId: crypto.randomUUID(),
      version: 1,
      strategyType: payload.strategyType as StrategyType,
      name: payload.strategyName,
      parameters: {},
      isComposite: payload.isComposite,
      userId: payload.userId,
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
    },
    trades: [],
    metrics: payload.metrics,
    executedAt: payload.executedAt,
    executionTimeMs: payload.executionTimeMs,
  };
}

async function eventually(assertion: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!assertion()) {
    if (Date.now() >= deadline)
      throw new Error('Timed out waiting for event delivery');
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

function once(socket: Socket, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      2_000,
    );
    socket.once(event, () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function oncePayload<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      2_000,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}
