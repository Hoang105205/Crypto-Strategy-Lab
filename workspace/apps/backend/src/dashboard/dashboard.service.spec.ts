import {
  LoopStatus,
  RankingCriterion,
  StrategyGeneratorType,
  type IJobQueue,
  type LeaderboardEntryPayload,
  type LeaderboardSnapshot,
  type NormalizedRate,
  type QueueStats,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';
import {
  HttpException,
  HttpStatus,
  RequestMethod,
  type ArgumentsHost,
} from '@nestjs/common';
import {
  EXCEPTION_FILTERS_METADATA,
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { LeaderboardService } from '../leaderboard/leaderboard.service';
import type { LoopStatusService } from '../loop/loop-status.service';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';

const NOW = new Date('2026-08-16T13:00:00.000Z');
const LEADERBOARD_UPDATED_AT = new Date('2026-08-16T12:59:00.000Z');
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

type LeaderboardReader = Pick<LeaderboardService, 'getLeaderboard'>;
type LoopReader = Pick<LoopStatusService, 'getCurrent'>;

interface DashboardSummaryContract {
  leaderboard: LeaderboardSnapshot;
  loop: SearchLoopRun | null;
  queue: QueueStats;
  generatedAt: Date;
}

interface DashboardServiceContract {
  getSummary(viewerUserId?: string | null): Promise<DashboardSummaryContract>;
}

type DashboardServiceConstructor = new (
  leaderboard: LeaderboardReader,
  loopStatus: LoopReader,
  jobQueue: IJobQueue,
) => DashboardServiceContract;

interface DashboardControllerContract {
  getSummary(): Promise<DashboardSummaryContract>;
}

type DashboardControllerConstructor = new (
  dashboard: DashboardServiceContract,
) => DashboardControllerContract;

interface InfrastructureErrorFilterContract {
  catch(exception: unknown, host: ArgumentsHost): void;
}

type InfrastructureErrorFilterConstructor =
  new () => InfrastructureErrorFilterContract;

describe('DashboardService BFF contract (T035)', () => {
  let leaderboard: jest.Mocked<LeaderboardReader>;
  let loopStatus: jest.Mocked<LoopReader>;
  let jobQueue: jest.Mocked<IJobQueue>;
  let service: DashboardServiceContract;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    leaderboard = {
      getLeaderboard: jest.fn<LeaderboardReader['getLeaderboard']>(),
    };
    loopStatus = {
      getCurrent: jest.fn<LoopReader['getCurrent']>(),
    };
    jobQueue = {
      enqueue: jest.fn<IJobQueue['enqueue']>(),
      getStatus: jest.fn<IJobQueue['getStatus']>(),
      retry: jest.fn<IJobQueue['retry']>(),
      deadLetter: jest.fn<IJobQueue['deadLetter']>(),
      getStats: jest.fn<IJobQueue['getStats']>(),
    };

    leaderboard.getLeaderboard.mockResolvedValue(leaderboardSnapshot(7));
    loopStatus.getCurrent.mockResolvedValue(activeLoop());
    jobQueue.getStats.mockResolvedValue(queueStats());

    const DashboardService = loadDashboardService();
    service = new DashboardService(leaderboard, loopStatus, jobQueue);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('composes SCORE Top-5 without reranking and preserves projection metadata', async () => {
    const source = leaderboardSnapshot(7);
    leaderboard.getLeaderboard.mockResolvedValue(source);

    const summary = await service.getSummary();

    expect(leaderboard.getLeaderboard).toHaveBeenCalledTimes(1);
    expect(leaderboard.getLeaderboard).toHaveBeenCalledWith(
      RankingCriterion.SCORE,
      null,
      'combined',
    );
    expect(summary.leaderboard).toEqual({
      rankingCriterion: RankingCriterion.SCORE,
      updatedAt: LEADERBOARD_UPDATED_AT,
      entries: source.entries.slice(0, 5),
    });
    expect(summary.leaderboard.entries).toHaveLength(5);
    expect(summary.leaderboard.entries.map(({ rank }) => rank)).toEqual([
      11, 12, 13, 14, 15,
    ]);
  });

  it('returns the active Loop, the complete Redis-aware QueueStats, and a valid generation time', async () => {
    const loop = activeLoop();
    const queue = queueStats();
    loopStatus.getCurrent.mockResolvedValue(loop);
    jobQueue.getStats.mockResolvedValue(queue);

    const summary = await service.getSummary();

    expect(loopStatus.getCurrent).toHaveBeenCalledTimes(1);
    expect(jobQueue.getStats.mock.calls).toHaveLength(1);
    expect(summary.loop).toBe(loop);
    expect(summary.queue).toEqual({
      queued: 7,
      processing: 3,
      completedLast24h: 29,
      deadLettered: 2,
      delayed: 4,
      redisConnected: true,
    });
    expect(summary.generatedAt).toBeInstanceOf(Date);
    expect(summary.generatedAt.toISOString()).toBe(NOW.toISOString());
  });

  it('preserves an authoritative null when no Search Loop is active', async () => {
    loopStatus.getCurrent.mockResolvedValue(null);

    await expect(service.getSummary()).resolves.toMatchObject({ loop: null });
  });

  it.each([
    ['Leaderboard', 'getLeaderboard'],
    ['Search Loop', 'getCurrent'],
    ['Queue', 'getStats'],
  ] as const)(
    'rejects the whole snapshot when the %s dependency fails instead of returning partial or fake healthy data',
    async (_dependency, method) => {
      const dependencyFailure = Object.assign(
        new Error('raw provider detail must never become a public response'),
        { code: 'DEPENDENCY_UNAVAILABLE' },
      );

      if (method === 'getLeaderboard') {
        leaderboard.getLeaderboard.mockRejectedValue(dependencyFailure);
      } else if (method === 'getCurrent') {
        loopStatus.getCurrent.mockRejectedValue(dependencyFailure);
      } else {
        jobQueue.getStats.mockRejectedValue(dependencyFailure);
      }

      await expect(service.getSummary()).rejects.toBe(dependencyFailure);
    },
  );

  it('does not mutate the authoritative snapshots returned by dependencies', async () => {
    const source = leaderboardSnapshot(7);
    const originalEntries = [...source.entries];
    const loop = activeLoop();
    const queue = queueStats();
    leaderboard.getLeaderboard.mockResolvedValue(source);
    loopStatus.getCurrent.mockResolvedValue(loop);
    jobQueue.getStats.mockResolvedValue(queue);

    await service.getSummary();

    expect(source.entries).toEqual(originalEntries);
    expect(loopStatus.getCurrent.mock.results[0]?.value).toBeDefined();
    expect(queue).toEqual(queueStats());
  });
});

describe('T016 dashboard leaderboard viewer scope', () => {
  it.each([
    ['anonymous', null],
    ['user A', USER_A],
    ['user B', USER_B],
  ] as const)(
    'scopes leaderboard metadata for %s while loop and queue remain global',
    async (_actor, viewerUserId) => {
      const leaderboard: jest.Mocked<LeaderboardReader> = {
        getLeaderboard: jest
          .fn<LeaderboardReader['getLeaderboard']>()
          .mockResolvedValue(leaderboardSnapshot(2)),
      };
      const loopStatus: jest.Mocked<LoopReader> = {
        getCurrent: jest
          .fn<LoopReader['getCurrent']>()
          .mockResolvedValue(activeLoop()),
      };
      const jobQueue = {
        enqueue: jest.fn<IJobQueue['enqueue']>(),
        getStatus: jest.fn<IJobQueue['getStatus']>(),
        retry: jest.fn<IJobQueue['retry']>(),
        deadLetter: jest.fn<IJobQueue['deadLetter']>(),
        getStats: jest
          .fn<IJobQueue['getStats']>()
          .mockResolvedValue(queueStats()),
      };
      const DashboardService = loadDashboardService();
      const service = new DashboardService(leaderboard, loopStatus, jobQueue);

      const summary = await service.getSummary(viewerUserId);

      expect(leaderboard.getLeaderboard).toHaveBeenCalledWith(
        RankingCriterion.SCORE,
        viewerUserId,
        'combined',
      );
      expect(summary.leaderboard.updatedAt).toBe(LEADERBOARD_UPDATED_AT);
      expect(loopStatus.getCurrent).toHaveBeenCalledWith();
      expect(jobQueue.getStats).toHaveBeenCalledWith();
    },
  );
});

describe('Infrastructure error boundary contract (T035)', () => {
  it('preserves an application-created HttpException with the exact stable shape', () => {
    const InfrastructureErrorFilter = loadInfrastructureErrorFilter();
    const filter = new InfrastructureErrorFilter();
    const { host, status, json } = httpHost();
    const exception = new HttpException(
      { error: 'Search loop not found', code: 'LOOP_NOT_FOUND' },
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      error: 'Search loop not found',
      code: 'LOOP_NOT_FOUND',
    });
  });

  it.each([
    [
      'QUEUE_UNAVAILABLE',
      'Queue service is unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
    ],
    [
      'STRATEGY_ENGINE_UNAVAILABLE',
      'Strategy Engine is unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
    ],
  ] as const)(
    'maps known dependency code %s without reflecting its raw message',
    (code, publicMessage, expectedStatus) => {
      const InfrastructureErrorFilter = loadInfrastructureErrorFilter();
      const filter = new InfrastructureErrorFilter();
      const { host, status, json } = httpHost();
      const secret = 'redis://operator:password@private-host:6379';
      const dependencyFailure = Object.assign(new Error(secret), {
        code,
        stack: `sensitive stack ${secret}`,
      });

      filter.catch(dependencyFailure, host);

      expect(status).toHaveBeenCalledWith(expectedStatus);
      expect(json).toHaveBeenCalledWith({ error: publicMessage, code });
      expect(JSON.stringify(json.mock.calls)).not.toContain(secret);
    },
  );

  it('sanitizes an unknown failure as INTERNAL_ERROR without stack, cause, or raw message', () => {
    const InfrastructureErrorFilter = loadInfrastructureErrorFilter();
    const filter = new InfrastructureErrorFilter();
    const { host, status, json } = httpHost();
    const secret = 'redis://operator:password@private-host:6379';
    const dependencyFailure = Object.assign(new Error(secret), {
      code: 'UNRECOGNIZED_PROVIDER_FAILURE',
      stack: `sensitive stack ${secret}`,
    });

    filter.catch(dependencyFailure, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledTimes(1);
    const body = json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('cause');
    expect(JSON.stringify(body)).not.toContain(secret);
  });
});

describe('DashboardController HTTP contract (T035)', () => {
  it('exposes exactly GET /api/dashboard/summary and delegates without recomputation', async () => {
    const summary = {
      leaderboard: leaderboardSnapshot(5),
      loop: activeLoop(),
      queue: queueStats(),
      generatedAt: NOW,
    };
    const getSummary = jest
      .fn<DashboardServiceContract['getSummary']>()
      .mockResolvedValue(summary);
    const dashboard: DashboardServiceContract = { getSummary };
    const DashboardController = loadDashboardController();
    const InfrastructureErrorFilter = loadInfrastructureErrorFilter();
    const controller = new DashboardController(dashboard);
    const controllerPrototype = Object.getPrototypeOf(controller) as object;
    const getSummaryHandler = Reflect.get(
      controllerPrototype,
      'getSummary',
    ) as DashboardControllerContract['getSummary'];

    await expect(controller.getSummary()).resolves.toBe(summary);
    expect(getSummary.mock.calls).toHaveLength(1);
    expect(Reflect.getMetadata(PATH_METADATA, DashboardController)).toBe(
      'api/dashboard',
    );
    expect(Reflect.getMetadata(PATH_METADATA, getSummaryHandler)).toBe(
      'summary',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, getSummaryHandler)).toBe(
      RequestMethod.GET,
    );
    expect(
      Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, DashboardController),
    ).toEqual([InfrastructureErrorFilter]);
    expect(Reflect.getMetadata(GUARDS_METADATA, DashboardController)).toEqual([
      SupabaseJwtGuard,
    ]);
    const routeArgs = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      DashboardController,
      'getSummary',
    ) as Record<string, { index: number }> | undefined;
    expect(
      Object.values(routeArgs ?? {}).some(({ index }) => index === 0),
    ).toBe(true);
  });
});

function loadDashboardService(): DashboardServiceConstructor {
  try {
    const module = jest.requireActual<{
      DashboardService?: DashboardServiceConstructor;
    }>('./dashboard.service');
    if (!module.DashboardService) {
      throw new Error('DashboardService export is missing');
    }
    return module.DashboardService;
  } catch (error: unknown) {
    throw new Error(
      'T035 RED: T036 must provide dashboard.service.ts with DashboardService.getSummary()',
      { cause: error },
    );
  }
}

function loadInfrastructureErrorFilter(): InfrastructureErrorFilterConstructor {
  try {
    const module = jest.requireActual<{
      InfrastructureErrorFilter?: InfrastructureErrorFilterConstructor;
    }>('../shared/infrastructure-error.filter');
    if (!module.InfrastructureErrorFilter) {
      throw new Error('InfrastructureErrorFilter export is missing');
    }
    return module.InfrastructureErrorFilter;
  } catch (error: unknown) {
    throw new Error(
      'T035 RED: T036 must provide a reusable InfrastructureErrorFilter',
      { cause: error },
    );
  }
}

function loadDashboardController(): DashboardControllerConstructor {
  try {
    const module = jest.requireActual<{
      DashboardController?: DashboardControllerConstructor;
    }>('./dashboard.controller');
    if (!module.DashboardController) {
      throw new Error('DashboardController export is missing');
    }
    return module.DashboardController;
  } catch (error: unknown) {
    throw new Error(
      'T035 RED: T036 must provide dashboard.controller.ts with GET summary',
      { cause: error },
    );
  }
}

function httpHost(): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
} {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  const response = { status, json };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => response,
      getNext: () => undefined,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function leaderboardSnapshot(entryCount: number): LeaderboardSnapshot {
  return {
    rankingCriterion: RankingCriterion.SCORE,
    updatedAt: LEADERBOARD_UPDATED_AT,
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
    id: '2446ece1-efb0-440f-86e4-01f3c5cc0e15',
    status: LoopStatus.RUNNING,
    generatorType: StrategyGeneratorType.RANDOM,
    iteration: 4,
    testedCandidates: 3,
    maxCandidates: 10,
    maxDurationMs: null,
    stopOnNoImprovementIterations: 50,
    currentCandidateStrategyVersionId: '39c76876-c8ec-451d-ae50-53b5e4a4804c',
    bestStrategyVersionId: 'f784cab5-f7a3-486f-8166-4d9f13326edc',
    bestScore: 0.72,
    stopReason: null,
    startedAt: new Date('2026-08-16T12:00:00.000Z'),
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

function normalizedRate(value: number): NormalizedRate {
  if (value < 0 || value > 1) {
    throw new RangeError('Normalized rate fixture must be between 0 and 1');
  }
  return value as NormalizedRate;
}
