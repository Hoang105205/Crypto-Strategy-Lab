import { Module } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import {
  BacktestSource,
  EventType,
  JobStatusValue,
  LoopStatus,
  SearchLoopCandidateStatus,
  StrategyGeneratorType,
  type IEventBus,
  type IJobQueue,
  type IStrategyCandidatePort,
  type SearchLoopCandidate,
  type SearchLoopConfig,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { EventsModule } from '../events/events.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { QueueModule } from '../queue/queue.module';
import {
  IEVENT_BUS,
  IJOB_QUEUE,
  ISCORING_POLICY,
  ISTRATEGY_CANDIDATE_PORT,
} from '../shared/tokens';
import { StrategyModule } from '../strategy/strategy.module';
import { LoopController } from './loop.controller';
import { LoopRepository } from './loop.repository';
import { LoopStatusService } from './loop-status.service';
import { LoopModule } from './loop.module';
import { StrategyLoopService } from './strategy-loop.service';

const STARTED_AT = new Date('2026-08-16T03:00:00.000Z');
const LOOP_RUN_ID = '69e1c401-810a-431f-b2d8-d9f732e7f829';
const STRATEGY_VERSION_ID = '9c06305c-a7d7-47e7-873f-7500e3b394de';

const prisma = {
  searchLoopRun: {
    findFirst: jest.fn<() => Promise<null>>(),
  },
};

const eventBus = {
  publish: jest.fn<IEventBus['publish']>(),
  subscribe: jest.fn<IEventBus['subscribe']>(),
  unsubscribe: jest.fn<IEventBus['unsubscribe']>(),
} as jest.Mocked<IEventBus>;

const jobQueue = {
  enqueue: jest.fn<IJobQueue['enqueue']>(),
  getStatus: jest.fn<IJobQueue['getStatus']>(),
  retry: jest.fn<IJobQueue['retry']>(),
  deadLetter: jest.fn<IJobQueue['deadLetter']>(),
  getStats: jest.fn<IJobQueue['getStats']>(),
} as jest.Mocked<IJobQueue>;

const candidatePort = {
  generateCandidate: jest.fn<IStrategyCandidatePort['generateCandidate']>(),
} as jest.Mocked<IStrategyCandidatePort>;

const scoringPolicy = {
  calculateScore: jest.fn<(input: unknown) => number>(),
};

@Module({
  providers: [{ provide: PrismaService, useValue: prisma }],
  exports: [PrismaService],
})
class TestDatabaseModule {}

@Module({
  providers: [{ provide: IEVENT_BUS, useValue: eventBus }],
  exports: [IEVENT_BUS],
})
class TestEventsModule {}

@Module({
  providers: [{ provide: IJOB_QUEUE, useValue: jobQueue }],
  exports: [IJOB_QUEUE],
})
class TestQueueModule {}

@Module({
  providers: [{ provide: ISTRATEGY_CANDIDATE_PORT, useValue: candidatePort }],
  exports: [ISTRATEGY_CANDIDATE_PORT],
})
class TestStrategyModule {}

@Module({
  providers: [{ provide: ISCORING_POLICY, useValue: scoringPolicy }],
  exports: [ISCORING_POLICY],
})
class TestScoringModule {}

describe('LoopModule wiring and lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.searchLoopRun.findFirst.mockResolvedValue(null);
    eventBus.subscribe.mockImplementation(() => jest.fn());
    jobQueue.enqueue.mockImplementation(async (_type, payload) => ({
      jobId: payload.jobId,
    }));
    jobQueue.getStatus.mockResolvedValue({
      jobId: '93a88d62-c2a3-4cb9-bef9-14c22777fc19',
      status: JobStatusValue.QUEUED,
      attempt: 0,
      lastError: null,
      updatedAt: STARTED_AT,
    });
    candidatePort.generateCandidate.mockResolvedValue({
      strategyVersionId: STRATEGY_VERSION_ID,
      strategyName: 'Generated candidate',
    });
    scoringPolicy.calculateScore.mockReturnValue(0.5);
  });

  it('boots with public seam modules and resolves the owned providers/controller', async () => {
    const module = await compileLoopModule().compile();
    await module.init();

    expect(module.get(LoopRepository)).toBeInstanceOf(LoopRepository);
    expect(module.get(LoopStatusService)).toBeInstanceOf(LoopStatusService);
    expect(module.get(StrategyLoopService)).toBeInstanceOf(StrategyLoopService);
    expect(module.get(LoopController)).toBeInstanceOf(LoopController);
    expect(module.get(IEVENT_BUS)).toBe(eventBus);
    expect(module.get(IJOB_QUEUE)).toBe(jobQueue);
    expect(module.get(ISTRATEGY_CANDIDATE_PORT)).toBe(candidatePort);
    expect(module.get(ISCORING_POLICY)).toBe(scoringPolicy);

    await module.close();
  });

  it('subscribes to both terminal events once and runs reconciliation once', async () => {
    const reconcileAfterRestart = jest.fn<() => Promise<null>>();
    reconcileAfterRestart.mockResolvedValue(null);
    const status = { reconcileAfterRestart };
    const completed = jest.fn<() => Promise<void>>().mockResolvedValue();
    const failed = jest.fn<() => Promise<void>>().mockResolvedValue();
    const service = {
      handleBacktestCompleted: completed,
      handleBacktestFailed: failed,
    };
    const module = await compileLoopModule()
      .overrideProvider(LoopStatusService)
      .useValue(status)
      .overrideProvider(StrategyLoopService)
      .useValue(service)
      .compile();

    await module.init();
    const lifecycle = module.get(LoopModule);
    await lifecycle.onModuleInit();

    expect(reconcileAfterRestart).toHaveBeenCalledTimes(1);
    expect(eventBus.subscribe).toHaveBeenCalledTimes(2);
    expect(eventBus.subscribe.mock.calls.map(([type]) => type)).toEqual([
      EventType.BacktestCompleted,
      EventType.BacktestFailed,
    ]);

    const completedHandler = eventBus.subscribe.mock.calls[0][1];
    const failedHandler = eventBus.subscribe.mock.calls[1][1];
    await completedHandler({} as never);
    await failedHandler({} as never);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledTimes(1);

    await module.close();
  });

  it('accepts orphan reconciliation and does not repeat it', async () => {
    const orphan = run({
      status: LoopStatus.FAILED,
      stopReason: 'orphaned_after_restart',
      stoppedAt: STARTED_AT,
    });
    const reconcileAfterRestart = jest
      .fn<() => Promise<SearchLoopRun | null>>()
      .mockResolvedValue(orphan);
    const module = await compileLoopModule()
      .overrideProvider(LoopStatusService)
      .useValue({ reconcileAfterRestart })
      .compile();

    await expect(module.init()).resolves.toBe(module);
    await module.get(LoopModule).onModuleInit();
    expect(reconcileAfterRestart).toHaveBeenCalledTimes(1);

    await module.close();
  });

  it('keeps boot clean when queue reconciliation is unavailable instead of creating an orphan', async () => {
    const reconcileAfterRestart = jest
      .fn<() => Promise<SearchLoopRun | null>>()
      .mockRejectedValue(
        Object.assign(new Error('sensitive redis detail'), {
          code: 'QUEUE_UNAVAILABLE',
        }),
      );
    const fail = jest.fn();
    const module = await compileLoopModule()
      .overrideProvider(LoopStatusService)
      .useValue({ reconcileAfterRestart, fail })
      .compile();

    await expect(module.init()).resolves.toBe(module);
    expect(reconcileAfterRestart).toHaveBeenCalledTimes(1);
    expect(fail).not.toHaveBeenCalled();

    await module.close();
  });

  it('cleans both subscriptions idempotently on shutdown', async () => {
    const cleanups = [jest.fn(), jest.fn()];
    eventBus.subscribe
      .mockReturnValueOnce(cleanups[0])
      .mockReturnValueOnce(cleanups[1]);
    const module = await compileLoopModule().compile();
    await module.init();
    const lifecycle = module.get(LoopModule);

    await module.close();
    lifecycle.onModuleDestroy();

    expect(eventBus.unsubscribe).toHaveBeenCalledTimes(2);
    expect(eventBus.unsubscribe).toHaveBeenNthCalledWith(1, cleanups[0]);
    expect(eventBus.unsubscribe).toHaveBeenNthCalledWith(2, cleanups[1]);
  });

  it('uses an overridden candidate provider through the symbol seam', async () => {
    const replacement = {
      generateCandidate: jest
        .fn<IStrategyCandidatePort['generateCandidate']>()
        .mockResolvedValue({
          strategyVersionId: STRATEGY_VERSION_ID,
          strategyName: 'Replacement candidate',
        }),
    };
    const repository = orchestrationRepository();
    const status = orchestrationStatus();
    const module = await compileLoopModule()
      .overrideProvider(ISTRATEGY_CANDIDATE_PORT)
      .useValue(replacement)
      .overrideProvider(LoopRepository)
      .useValue(repository)
      .overrideProvider(LoopStatusService)
      .useValue(status)
      .compile();
    await module.init();

    await module.get(StrategyLoopService).start(loopConfig());

    expect(module.get(ISTRATEGY_CANDIDATE_PORT)).toBe(replacement);
    expect(replacement.generateCandidate).toHaveBeenCalledWith(
      StrategyGeneratorType.RANDOM,
    );
    expect(jobQueue.enqueue).toHaveBeenCalledWith(
      'BACKTEST',
      expect.objectContaining({
        source: BacktestSource.SEARCH_LOOP,
        strategyVersionId: STRATEGY_VERSION_ID,
      }),
      expect.any(String),
    );

    await module.close();
  });
});

function compileLoopModule(): TestingModuleBuilder {
  return Test.createTestingModule({ imports: [LoopModule] })
    .overrideModule(DatabaseModule)
    .useModule(TestDatabaseModule)
    .overrideModule(EventsModule)
    .useModule(TestEventsModule)
    .overrideModule(QueueModule)
    .useModule(TestQueueModule)
    .overrideModule(StrategyModule)
    .useModule(TestStrategyModule)
    .overrideModule(LeaderboardModule)
    .useModule(TestScoringModule);
}

function run(overrides: Partial<SearchLoopRun> = {}): SearchLoopRun {
  return {
    id: LOOP_RUN_ID,
    status: LoopStatus.RUNNING,
    generatorType: StrategyGeneratorType.RANDOM,
    iteration: 0,
    testedCandidates: 0,
    maxCandidates: 5,
    maxDurationMs: null,
    stopOnNoImprovementIterations: 50,
    currentCandidateStrategyVersionId: null,
    bestStrategyVersionId: null,
    bestScore: null,
    stopReason: null,
    startedAt: STARTED_AT,
    pausedAt: null,
    stoppedAt: null,
    ...overrides,
  };
}

function candidate(jobId: string, iteration: number): SearchLoopCandidate {
  return {
    id: '70fc2d17-c098-4309-b49b-a9c4d376f2a2',
    loopRunId: LOOP_RUN_ID,
    jobId,
    strategyVersionId: STRATEGY_VERSION_ID,
    backtestResultId: null,
    iteration,
    score: null,
    status: SearchLoopCandidateStatus.BACKTESTING,
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
  };
}

function loopConfig(): SearchLoopConfig {
  return {
    generatorType: StrategyGeneratorType.RANDOM,
    pair: 'BTC/USDT',
    timeframe: '1h',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-02-01T00:00:00.000Z'),
    backtestConfig: {
      initialCapital: 10_000,
      positionSizePercent: 10,
    },
    maxCandidates: 5,
    maxDurationMs: null,
    stopOnNoImprovementIterations: 50,
  };
}

function orchestrationRepository() {
  const activeRun = run();
  return {
    createRun: jest.fn().mockResolvedValue(activeRun),
    createCandidate: jest.fn(
      async (input: {
        jobId: string;
        iteration: number;
      }): Promise<SearchLoopCandidate> =>
        candidate(input.jobId, input.iteration),
    ),
    transitionRun: jest.fn().mockResolvedValue(activeRun),
    recordCandidateCompleted: jest.fn(),
    recordCandidateFailed: jest.fn(),
  };
}

function orchestrationStatus() {
  return {
    reconcileAfterRestart: jest.fn().mockResolvedValue(null),
    getCurrent: jest.fn().mockResolvedValue(run()),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  };
}
