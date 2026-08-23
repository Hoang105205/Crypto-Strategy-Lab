import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  Module,
  type INestApplication,
} from '@nestjs/common';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { GATEWAY_OPTIONS } from '@nestjs/websockets/constants';
import {
  EventType,
  LoopStatus,
  RankingCriterion,
  SearchLoopProgressStatus,
  StrategyGeneratorType,
  type EventPayloadMap,
  type IEventBus,
  type IJobQueue,
  type LeaderboardEntryPayload,
  type LeaderboardSnapshot,
  type NormalizedRate,
  type QueueStats,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { LoopStatusService } from '../loop/loop-status.service';
import { LoopModule } from '../loop/loop.module';
import { QueueModule } from '../queue/queue.module';
import { InfrastructureErrorFilter } from '../shared/infrastructure-error.filter';
import { IEVENT_BUS, IJOB_QUEUE } from '../shared/tokens';
import {
  MarketDataGateway,
  candleRoom,
} from '../market-data/websocket/market-data.gateway';
import { DashboardController } from './dashboard.controller';
import { DashboardModule } from './dashboard.module';
import { DashboardService } from './dashboard.service';
import { PushGateway } from './push.gateway';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import { SupabaseService } from '../auth/supabase.service';

const UPDATED_AT = new Date('2026-08-16T12:59:00.000Z');
const STARTED_AT = new Date('2026-08-16T12:00:00.000Z');
const STOPPED_AT = new Date('2026-08-16T12:10:00.000Z');
const LOOP_RUN_ID = '2446ece1-efb0-440f-86e4-01f3c5cc0e15';
const STRATEGY_VERSION_ID = '39c76876-c8ec-451d-ae50-53b5e4a4804c';
const BACKTEST_RESULT_ID = 'f784cab5-f7a3-486f-8166-4d9f13326edc';
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

const optionalAuthGuard: CanActivate = {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
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

type RelayEventType =
  | typeof EventType.LeaderboardUpdated
  | typeof EventType.SearchLoopStarted
  | typeof EventType.SearchLoopProgress
  | typeof EventType.SearchLoopStopped;

class LeaderboardReaderFake {
  failure: Error | null = null;
  snapshot = leaderboardSnapshot(7);

  readonly getLeaderboard = jest.fn<LeaderboardService['getLeaderboard']>(() =>
    this.failure
      ? Promise.reject(this.failure)
      : Promise.resolve(this.snapshot),
  );
}

class LoopReaderFake {
  failure: Error | null = null;
  current: SearchLoopRun | null = activeLoop();

  readonly getCurrent = jest.fn<LoopStatusService['getCurrent']>(() =>
    this.failure ? Promise.reject(this.failure) : Promise.resolve(this.current),
  );
}

class QueueReaderFake implements IJobQueue {
  failure: Error | null = null;
  stats = queueStats();

  readonly enqueue = jest.fn<IJobQueue['enqueue']>();
  readonly getStatus = jest.fn<IJobQueue['getStatus']>();
  readonly retry = jest.fn<IJobQueue['retry']>();
  readonly deadLetter = jest.fn<IJobQueue['deadLetter']>();
  readonly getStats = jest.fn<IJobQueue['getStats']>(() =>
    this.failure ? Promise.reject(this.failure) : Promise.resolve(this.stats),
  );
}

@Module({
  providers: [
    LeaderboardReaderFake,
    { provide: LeaderboardService, useExisting: LeaderboardReaderFake },
  ],
  exports: [LeaderboardService, LeaderboardReaderFake],
})
class ContractLeaderboardModule {}

@Module({
  providers: [
    LoopReaderFake,
    { provide: LoopStatusService, useExisting: LoopReaderFake },
  ],
  exports: [LoopStatusService, LoopReaderFake],
})
class ContractLoopModule {}

@Module({
  providers: [
    QueueReaderFake,
    { provide: IJOB_QUEUE, useExisting: QueueReaderFake },
  ],
  exports: [IJOB_QUEUE, QueueReaderFake],
})
class ContractQueueModule {}

interface Harness {
  app: INestApplication;
  module: TestingModule;
  leaderboard: LeaderboardReaderFake;
  loop: LoopReaderFake;
  queue: QueueReaderFake;
  eventBus: IEventBus;
  emitter: EventEmitter2;
  closed: boolean;
}

interface DashboardSummaryWire {
  leaderboard: {
    rankingCriterion: RankingCriterion;
    updatedAt: string;
    entries: LeaderboardEntryPayload[];
  };
  loop: unknown;
  queue: QueueStats;
  generatedAt: string;
}

interface StableErrorWire {
  error: string;
  code: string;
}

interface ListeningHttpServer {
  address(): AddressInfo | string | null;
}

const openHarnesses: Harness[] = [];

afterEach(async () => {
  for (const harness of openHarnesses.splice(0)) {
    if (!harness.closed) await harness.app.close();
  }
  jest.restoreAllMocks();
});

describe('DashboardModule integration (T038)', () => {
  it('boots and resolves every public dependency without forwardRef', async () => {
    const harness = await createHarness();
    const source = readFileSync(join(__dirname, 'dashboard.module.ts'), 'utf8');

    expect(harness.module.get(DashboardService)).toBeDefined();
    expect(harness.module.get(DashboardController)).toBeDefined();
    expect(harness.module.get(PushGateway)).toBeDefined();
    expect(harness.module.get(InfrastructureErrorFilter)).toBeDefined();
    expect(harness.module.get(LeaderboardService)).toBe(harness.leaderboard);
    expect(harness.module.get(LoopStatusService)).toBe(harness.loop);
    expect(harness.module.get<IJobQueue>(IJOB_QUEUE)).toBe(harness.queue);
    expect(harness.module.get<IEventBus>(IEVENT_BUS)).toBe(harness.eventBus);
    expect(source).not.toContain('forwardRef');
  });

  it('returns the exact summary wire shape for active and null Loop snapshots', async () => {
    const harness = await createHarness();
    const server = harness.app.getHttpServer() as Parameters<typeof request>[0];

    const activeResponse = await request(server)
      .get('/api/dashboard/summary')
      .expect(HttpStatus.OK);
    const activeBody = activeResponse.body as unknown as DashboardSummaryWire;

    expect(activeBody).toEqual({
      leaderboard: {
        rankingCriterion: RankingCriterion.SCORE,
        updatedAt: UPDATED_AT.toISOString(),
        entries: leaderboardSnapshot(7).entries.slice(0, 5),
      },
      loop: jsonProjection(activeLoop()),
      queue: queueStats(),
      generatedAt: expect.any(String),
    });
    expect(activeBody.leaderboard.entries).toHaveLength(5);
    expect(activeBody.leaderboard.entries.map(({ rank }) => rank)).toEqual([
      11, 12, 13, 14, 15,
    ]);
    expect(new Date(activeBody.generatedAt).toISOString()).toBe(
      activeBody.generatedAt,
    );

    harness.loop.current = null;
    const nullResponse = await request(server)
      .get('/api/dashboard/summary')
      .expect(HttpStatus.OK);
    const nullBody = nullResponse.body as unknown as DashboardSummaryWire;
    expect(nullBody.loop).toBeNull();
    expect(nullBody.queue).toEqual(queueStats());
  });

  it.each([
    [
      'Leaderboard',
      'leaderboard',
      HttpStatus.INTERNAL_SERVER_ERROR,
      'INTERNAL_ERROR',
    ],
    ['Loop', 'loop', HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR'],
    ['Queue', 'queue', HttpStatus.SERVICE_UNAVAILABLE, 'QUEUE_UNAVAILABLE'],
  ] as const)(
    'sanitizes a %s dependency failure into the stable public error contract',
    async (_label, dependency, status, code) => {
      const harness = await createHarness();
      const secret = 'redis://operator:password@private-host:6379';
      const failure = Object.assign(new Error(secret), {
        code: dependency === 'queue' ? 'QUEUE_UNAVAILABLE' : 'PROVIDER_FAILURE',
        stack: `private stack ${secret}`,
      });
      harness[dependency].failure = failure;

      const response = await request(
        harness.app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/api/dashboard/summary')
        .expect(status);
      const body = response.body as unknown as StableErrorWire;

      expect(body).toEqual(
        code === 'QUEUE_UNAVAILABLE'
          ? { error: 'Queue service is unavailable', code }
          : { error: 'Internal server error', code },
      );
      expect(JSON.stringify(body)).not.toContain(secret);
      expect(body).not.toHaveProperty('stack');
      expect(body).not.toHaveProperty('cause');
    },
  );

  it('preserves an already-stable application HttpException', async () => {
    const harness = await createHarness();
    harness.loop.failure = new HttpException(
      { error: 'Search loop not found', code: 'LOOP_NOT_FOUND' },
      HttpStatus.NOT_FOUND,
    );

    const response = await request(
      harness.app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/api/dashboard/summary')
      .expect(HttpStatus.NOT_FOUND);
    const body = response.body as unknown as StableErrorWire;

    expect(body).toEqual({
      error: 'Search loop not found',
      code: 'LOOP_NOT_FOUND',
    });
  });

  it('delivers all four exact channels and payloads on /infrastructure', async () => {
    const harness = await createHarness(true);
    const httpServer =
      harness.app.getHttpServer() as unknown as ListeningHttpServer;
    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected Dashboard test server to listen on a TCP port');
    }
    const client = io(`http://127.0.0.1:${address.port}/infrastructure`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    try {
      await waitForConnection(client);
      const received = relayEventTypes().map((eventType) =>
        oncePayload(client, relayChannels[eventType]),
      );

      for (const eventType of relayEventTypes()) {
        harness.eventBus.publish(eventType, relayFixtures[eventType]);
      }

      await expect(Promise.all(received)).resolves.toEqual(
        relayEventTypes().map((eventType) =>
          jsonProjection(relayFixtures[eventType]),
        ),
      );
    } finally {
      client.disconnect();
    }
  });

  it('isolates gateway delivery failure from publisher and sibling delivery', async () => {
    const harness = await createHarness();
    const gateway = harness.module.get(PushGateway);
    const originalServer = gateway.server;
    const siblingDeliveries: unknown[] = [];
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    harness.eventBus.subscribe(EventType.LeaderboardUpdated, (envelope) => {
      siblingDeliveries.push(envelope);
    });
    gateway.server = {
      emit: () => {
        throw new Error('private socket provider failure');
      },
    } as never;

    expect(() =>
      harness.eventBus.publish(
        EventType.LeaderboardUpdated,
        relayFixtures.LeaderboardUpdated,
      ),
    ).not.toThrow();
    expect(siblingDeliveries).toHaveLength(1);
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SOCKET_EMIT_FAILED',
        eventType: EventType.LeaderboardUpdated,
      }),
    );
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain(
      'private socket provider failure',
    );
    gateway.server = originalServer;
  });

  it('owns one relay listener per event and removes all four on shutdown', async () => {
    const harness = await createHarness();

    for (const eventType of relayEventTypes()) {
      expect(harness.emitter.listenerCount(eventType)).toBe(1);
    }
    expect(harness.emitter.listenerCount(EventType.MarketDataUpdated)).toBe(0);
    expect(harness.emitter.listenerCount(EventType.NewsCollected)).toBe(0);

    await harness.app.close();
    harness.closed = true;

    for (const eventType of relayEventTypes()) {
      expect(harness.emitter.listenerCount(eventType)).toBe(0);
    }
  });

  it('preserves the independent Market Data namespace, rooms, and channels', () => {
    const options = Reflect.getMetadata(GATEWAY_OPTIONS, MarketDataGateway) as
      { namespace?: string } | undefined;
    const source = readFileSync(
      join(__dirname, '../market-data/websocket/market-data.gateway.ts'),
      'utf8',
    );
    const dashboardSource = [
      readFileSync(join(__dirname, 'dashboard.service.ts'), 'utf8'),
      readFileSync(join(__dirname, 'push.gateway.ts'), 'utf8'),
    ].join('\n');

    expect(options?.namespace).toBe('market-data');
    expect(candleRoom('BTCUSDT', '5m')).toBe('market-data:candles:BTCUSDT:5m');
    expect(source).toContain("'candle:update'");
    expect(source).toContain("'candle:close'");
    expect(source).toContain('`status:${state}`');
    expect(dashboardSource).not.toMatch(/MarketDataUpdated|NewsCollected/);
    expect(dashboardSource).not.toMatch(/\.sort\(|calculateScore|rerank/);
  });
});

describe('T016 dashboard optional-auth integration', () => {
  it('passes anonymous/A/B only to leaderboard while loop and queue queries stay global', async () => {
    const harness = await createHarness();
    const server = harness.app.getHttpServer() as Parameters<typeof request>[0];

    await request(server).get('/api/dashboard/summary').expect(200);
    await request(server)
      .get('/api/dashboard/summary')
      .set('Authorization', 'Bearer user-a')
      .expect(200);
    await request(server)
      .get('/api/dashboard/summary')
      .set('Authorization', 'Bearer user-b')
      .expect(200);

    expect(harness.leaderboard.getLeaderboard.mock.calls).toEqual([
      [RankingCriterion.SCORE, null],
      [RankingCriterion.SCORE, USER_A],
      [RankingCriterion.SCORE, USER_B],
    ]);
    expect(harness.loop.getCurrent.mock.calls).toEqual([[], [], []]);
    expect(harness.queue.getStats.mock.calls).toEqual([[], [], []]);
  });
});

async function createHarness(listen = false): Promise<Harness> {
  const module = await Test.createTestingModule({
    imports: [EventEmitterModule.forRoot(), DashboardModule],
  })
    .overrideModule(LeaderboardModule)
    .useModule(ContractLeaderboardModule)
    .overrideModule(LoopModule)
    .useModule(ContractLoopModule)
    .overrideModule(QueueModule)
    .useModule(ContractQueueModule)
    .overrideProvider(SupabaseService)
    .useValue({ verifyToken: jest.fn() })
    .overrideGuard(SupabaseJwtGuard)
    .useValue(optionalAuthGuard)
    .compile();
  const app = module.createNestApplication();
  if (listen) await app.listen(0, '127.0.0.1');
  else await app.init();

  const harness: Harness = {
    app,
    module,
    leaderboard: module.get(LeaderboardReaderFake),
    loop: module.get(LoopReaderFake),
    queue: module.get(QueueReaderFake),
    eventBus: module.get<IEventBus>(IEVENT_BUS),
    emitter: module.get(EventEmitter2),
    closed: false,
  };
  openHarnesses.push(harness);
  return harness;
}

function leaderboardSnapshot(entryCount: number): LeaderboardSnapshot {
  return {
    rankingCriterion: RankingCriterion.SCORE,
    updatedAt: UPDATED_AT,
    entries: Array.from({ length: entryCount }, (_, index) =>
      leaderboardEntry(index),
    ),
  };
}

function leaderboardEntry(index: number): LeaderboardEntryPayload {
  return {
    rank: index + 11,
    userId: null,
    strategyVersionId: `strategy-version-${index + 1}`,
    strategyName: `Strategy ${index + 1}`,
    strategyType: 'MA',
    isComposite: false,
    backtestResultId: `backtest-result-${index + 1}`,
    score: 1 - index / 10,
    totalReturn: 20 - index,
    winRate: normalizedRate(0.7 - index / 100),
    maxDrawdown: -5 - index,
    sharpeRatio: 2 - index / 10,
    totalTrades: 20 + index,
  };
}

function activeLoop(): SearchLoopRun {
  return {
    id: LOOP_RUN_ID,
    status: LoopStatus.RUNNING,
    generatorType: StrategyGeneratorType.RANDOM,
    iteration: 4,
    testedCandidates: 3,
    maxCandidates: 10,
    maxDurationMs: null,
    stopOnNoImprovementIterations: 50,
    currentCandidateStrategyVersionId: STRATEGY_VERSION_ID,
    bestStrategyVersionId: BACKTEST_RESULT_ID,
    bestScore: 0.72,
    stopReason: null,
    startedAt: STARTED_AT,
    pausedAt: null,
    stoppedAt: null,
  };
}

function queueStats(): QueueStats {
  return {
    queued: 7,
    processing: 3,
    completedLast24h: 29,
    deadLettered: 2,
    delayed: 4,
    redisConnected: true,
  };
}

const relayFixtures = {
  [EventType.LeaderboardUpdated]: {
    updatedAt: UPDATED_AT,
    triggeredByBacktestResultId: BACKTEST_RESULT_ID,
    rankingCriterion: RankingCriterion.SCORE,
    topK: [leaderboardEntry(0)],
  },
  [EventType.SearchLoopStarted]: {
    loopRunId: LOOP_RUN_ID,
    config: {
      generatorType: StrategyGeneratorType.RANDOM,
      maxCandidates: 5,
      maxDurationMs: null,
      stopOnNoImprovementIterations: 50,
    },
    startedAt: STARTED_AT,
  },
  [EventType.SearchLoopProgress]: {
    loopRunId: LOOP_RUN_ID,
    iteration: 3,
    testedCandidates: 3,
    currentCandidate: {
      strategyVersionId: STRATEGY_VERSION_ID,
      strategyName: 'Moving Average',
      status: SearchLoopProgressStatus.EVALUATING,
    },
    bestScoreSoFar: 0.72,
    bestStrategyVersionId: STRATEGY_VERSION_ID,
  },
  [EventType.SearchLoopStopped]: {
    loopRunId: LOOP_RUN_ID,
    status: LoopStatus.COMPLETED,
    stopReason: 'max_candidates_reached',
    testedCandidates: 5,
    bestStrategyVersionId: STRATEGY_VERSION_ID,
    bestScore: 0.72,
    startedAt: STARTED_AT,
    stoppedAt: STOPPED_AT,
  },
} satisfies Pick<EventPayloadMap, RelayEventType>;

const relayChannels: Readonly<Record<RelayEventType, string>> = {
  [EventType.LeaderboardUpdated]: 'leaderboard:update',
  [EventType.SearchLoopStarted]: 'loop:started',
  [EventType.SearchLoopProgress]: 'loop:progress',
  [EventType.SearchLoopStopped]: 'loop:stopped',
};

function relayEventTypes(): RelayEventType[] {
  return [
    EventType.LeaderboardUpdated,
    EventType.SearchLoopStarted,
    EventType.SearchLoopProgress,
    EventType.SearchLoopStopped,
  ];
}

function waitForConnection(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Infrastructure socket connection timed out')),
      5_000,
    );
    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function oncePayload(socket: Socket, channel: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Socket event ${channel} timed out`)),
      5_000,
    );
    socket.once(channel, (payload: unknown) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

function jsonProjection<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizedRate(value: number): NormalizedRate {
  return value as NormalizedRate;
}
