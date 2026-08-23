/* eslint-disable @typescript-eslint/unbound-method -- integration assertions inspect contract fakes. */
import {
  Module,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  BacktestSource,
  EventType,
  JobStatusValue,
  JobType,
  LoopStatus,
  SearchLoopCandidateStatus,
  StrategyGeneratorType,
  type BacktestCompletedPayload,
  type BacktestFailedPayload,
  type BacktestRequestedPayload,
  type IEventBus,
  type IJobQueue,
  type IStrategyCandidatePort,
  type JobStatus,
  type NormalizedRate,
  type SearchLoopConfig,
  type SearchLoopProgressPayload,
  type SearchLoopRun,
  type SearchLoopStoppedPayload,
} from '@crypto-strategy-lab/shared';
import type {
  SearchLoopCandidate as PrismaCandidate,
  SearchLoopRun as PrismaRun,
} from '@prisma/client';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../database/prisma.service';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import { SupabaseService } from '../auth/supabase.service';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { ScoringPolicy } from '../leaderboard/scoring-policy';
import { QueueModule } from '../queue/queue.module';
import {
  IEVENT_BUS,
  IJOB_QUEUE,
  ISCORING_POLICY,
  ISTRATEGY_CANDIDATE_PORT,
} from '../shared/tokens';
import { StrategyModule } from '../strategy/strategy.module';
import { LoopStatusService } from './loop-status.service';
import { LoopModule } from './loop.module';
import { StrategyLoopService } from './strategy-loop.service';

const STARTED_AT = new Date('2026-08-16T03:00:00.000Z');

interface EnqueuedJob {
  jobType: JobType;
  payload: BacktestRequestedPayload;
  correlationId: string;
}

class ContractJobQueueFake implements IJobQueue {
  readonly enqueued: EnqueuedJob[] = [];
  readonly statuses = new Map<string, JobStatus>();
  statusOutage = false;

  readonly enqueue = jest.fn<IJobQueue['enqueue']>(
    async (jobType, payload, correlationId) => {
      const identity = correlationId ?? randomUUID();
      this.enqueued.push({ jobType, payload, correlationId: identity });
      this.statuses.set(payload.jobId, {
        jobId: payload.jobId,
        status: JobStatusValue.QUEUED,
        attempt: 0,
        lastError: null,
        updatedAt: new Date(),
      });
      return { jobId: payload.jobId };
    },
  );

  readonly getStatus = jest.fn<IJobQueue['getStatus']>(async (jobId) => {
    if (this.statusOutage) {
      throw Object.assign(new Error('private redis endpoint'), {
        code: 'QUEUE_UNAVAILABLE',
      });
    }
    const status = this.statuses.get(jobId);
    if (!status) {
      throw Object.assign(new Error('missing queue job'), {
        code: 'JOB_NOT_FOUND',
      });
    }
    return status;
  });

  readonly retry = jest.fn<IJobQueue['retry']>();
  readonly deadLetter = jest.fn<IJobQueue['deadLetter']>();
  readonly getStats = jest.fn<IJobQueue['getStats']>();

  seed(jobId: string, status: JobStatusValue): void {
    this.statuses.set(jobId, {
      jobId,
      status,
      attempt: status === JobStatusValue.PROCESSING ? 1 : 0,
      lastError: null,
      updatedAt: new Date(),
    });
  }
}

type CandidateOutcome =
  { strategyVersionId: string; strategyName: string } | Error;

class ContractCandidatePortFake implements IStrategyCandidatePort {
  readonly calls: StrategyGeneratorType[] = [];
  readonly outcomes: CandidateOutcome[] = [];
  private generated = 0;

  async generateCandidate(generatorType: StrategyGeneratorType) {
    this.calls.push(generatorType);
    const outcome = this.outcomes.shift();
    if (outcome instanceof Error) throw outcome;
    if (outcome) return outcome;

    const sequence = this.generated++;
    return {
      strategyVersionId: uuidFor(1_000 + sequence),
      strategyName: `Candidate ${sequence + 1}`,
    };
  }
}

const placeholderQueue = new ContractJobQueueFake();
const placeholderGenerator = new ContractCandidatePortFake();

@Module({
  providers: [{ provide: IJOB_QUEUE, useValue: placeholderQueue }],
  exports: [IJOB_QUEUE],
})
class ContractQueueModule {}

@Module({
  providers: [
    { provide: ISTRATEGY_CANDIDATE_PORT, useValue: placeholderGenerator },
  ],
  exports: [ISTRATEGY_CANDIDATE_PORT],
})
class ContractStrategyModule {}

@Module({
  providers: [
    ScoringPolicy,
    { provide: ISCORING_POLICY, useExisting: ScoringPolicy },
  ],
  exports: [ISCORING_POLICY],
})
class ContractScoringModule {}

interface HarnessOptions {
  generator?: ContractCandidatePortFake;
  seed?: (prisma: InMemoryLoopPrisma, queue: ContractJobQueueFake) => void;
}

interface Harness {
  app: INestApplication;
  module: TestingModule;
  prisma: InMemoryLoopPrisma;
  queue: ContractJobQueueFake;
  generator: ContractCandidatePortFake;
  eventBus: IEventBus;
  service: StrategyLoopService;
  status: LoopStatusService;
  requested: BacktestRequestedPayload[];
  progress: SearchLoopProgressPayload[];
  stopped: SearchLoopStoppedPayload[];
  authGuard: { canActivate: jest.Mock<(context: ExecutionContext) => boolean> };
}

const openHarnesses: Harness[] = [];

afterEach(async () => {
  while (openHarnesses.length > 0) {
    await openHarnesses.pop()?.app.close();
  }
});

describe('Loop integration: completion and configured bounds', () => {
  it('naturally completes maxCandidates=5 with five terminal candidates and no sixth request', async () => {
    const harness = await createHarness();
    const started = await harness.service.start(config({ maxCandidates: 5 }));

    for (let index = 0; index < 5; index += 1) {
      await eventually(() => harness.queue.enqueued.length === index + 1);
      publishCompleted(harness, index, 10 + index * 10);
      await eventually(
        () => terminalCandidates(harness, started.id) === index + 1,
      );
    }

    await eventually(
      () => harness.prisma.run(started.id)?.status === LoopStatus.COMPLETED,
    );
    await settleEvents();

    expect(harness.queue.enqueued).toHaveLength(5);
    expect(harness.requested).toHaveLength(5);
    expect(harness.prisma.candidatesFor(started.id)).toHaveLength(5);
    expect(harness.prisma.run(started.id)).toMatchObject({
      status: LoopStatus.COMPLETED,
      testedCandidates: 5,
      stopReason: 'max_candidates_reached',
    });
    expect(harness.stopped).toEqual([
      expect.objectContaining({
        loopRunId: started.id,
        stopReason: 'max_candidates_reached',
        testedCandidates: 5,
      }),
    ]);
  });

  it('stops at the configured maximum duration', async () => {
    const harness = await createHarness();
    const started = await harness.service.start(
      config({ maxCandidates: null, maxDurationMs: 1 }),
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 2));

    publishCompleted(harness, 0, 10);
    await eventually(
      () => harness.prisma.run(started.id)?.status === LoopStatus.COMPLETED,
    );

    expect(harness.prisma.run(started.id)?.stopReason).toBe(
      'max_duration_reached',
    );
    expect(harness.queue.enqueued).toHaveLength(1);
  });

  it('stops after the configured consecutive no-improvement limit', async () => {
    const harness = await createHarness();
    const started = await harness.service.start(
      config({
        maxCandidates: null,
        maxDurationMs: null,
        stopOnNoImprovementIterations: 2,
      }),
    );

    for (let index = 0; index < 3; index += 1) {
      await eventually(() => harness.queue.enqueued.length === index + 1);
      publishCompleted(harness, index, 10);
      await eventually(
        () => terminalCandidates(harness, started.id) === index + 1,
      );
    }
    await eventually(
      () => harness.prisma.run(started.id)?.status === LoopStatus.COMPLETED,
    );

    expect(harness.queue.enqueued).toHaveLength(3);
    expect(harness.prisma.run(started.id)?.stopReason).toBe(
      'no_improvement_limit_reached',
    );
  });
});

describe('Loop integration: terminal failure and idempotency', () => {
  it('records a failed candidate and continues with its successor', async () => {
    const harness = await createHarness();
    const started = await harness.service.start(config({ maxCandidates: 2 }));

    publishFailed(harness, 0);
    await eventually(() => harness.queue.enqueued.length === 2);
    publishCompleted(harness, 1, 20);
    await eventually(
      () => harness.prisma.run(started.id)?.status === LoopStatus.COMPLETED,
    );

    expect(
      harness.prisma.candidatesFor(started.id).map((item) => item.status),
    ).toEqual([
      SearchLoopCandidateStatus.FAILED,
      SearchLoopCandidateStatus.EVALUATED,
    ]);
    expect(harness.prisma.run(started.id)).toMatchObject({
      testedCandidates: 2,
      stopReason: 'max_candidates_reached',
    });
  });

  it('accounts a duplicate terminal event once and creates one successor', async () => {
    const harness = await createHarness();
    const started = await harness.service.start(config({ maxCandidates: 2 }));

    publishCompleted(harness, 0, 10);
    publishCompleted(harness, 0, 10);
    await eventually(() => harness.queue.enqueued.length === 2);
    await settleEvents();

    expect(harness.prisma.run(started.id)?.testedCandidates).toBe(1);
    expect(harness.progress).toHaveLength(1);
    expect(harness.queue.enqueued).toHaveLength(2);

    publishCompleted(harness, 1, 20);
    await eventually(
      () => harness.prisma.run(started.id)?.status === LoopStatus.COMPLETED,
    );
  });
});

describe('Loop integration: commands and races', () => {
  it('pauses without cancelling in-flight work and resumes the same run', async () => {
    const harness = await createHarness();
    const started = await harness.service.start(config({ maxCandidates: 2 }));

    const paused = await harness.service.pause(started.id);
    publishCompleted(harness, 0, 10);
    await eventually(() => terminalCandidates(harness, started.id) === 1);
    await settleEvents();

    expect(paused).toMatchObject({
      id: started.id,
      status: LoopStatus.PAUSED,
    });
    expect(harness.queue.enqueued).toHaveLength(1);
    expect(harness.progress).toHaveLength(0);

    const resumed = await harness.service.resume(started.id);
    await eventually(() => harness.queue.enqueued.length === 2);
    expect(resumed).toMatchObject({
      id: started.id,
      status: LoopStatus.RUNNING,
      testedCandidates: 1,
    });

    publishCompleted(harness, 1, 20);
    await eventually(
      () => harness.prisma.run(started.id)?.status === LoopStatus.COMPLETED,
    );
  });

  it('stops by user, persists a late result, and emits no later progress/successor', async () => {
    const harness = await createHarness();
    const started = await harness.service.start(config({ maxCandidates: 5 }));

    await harness.service.stop(started.id);
    await eventually(() => harness.stopped.length === 1);
    publishCompleted(harness, 0, 10);
    await eventually(() => terminalCandidates(harness, started.id) === 1);
    await settleEvents();

    expect(harness.prisma.run(started.id)).toMatchObject({
      status: LoopStatus.STOPPED_BY_USER,
      testedCandidates: 1,
      stopReason: 'user_requested',
    });
    expect(harness.queue.enqueued).toHaveLength(1);
    expect(harness.progress).toHaveLength(0);
    expect(harness.stopped).toHaveLength(1);
  });

  it('allows exactly one concurrent start', async () => {
    const harness = await createHarness();
    const outcomes = await Promise.allSettled([
      harness.service.start(config({ maxCandidates: 1 })),
      harness.service.start(config({ maxCandidates: 1 })),
    ]);

    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    const rejected = outcomes.find(
      (item): item is PromiseRejectedResult => item.status === 'rejected',
    );
    expect(rejected?.reason).toMatchObject({ code: 'LOOP_ALREADY_ACTIVE' });
    expect(harness.prisma.runs).toHaveLength(1);
    expect(harness.queue.enqueued).toHaveLength(1);
  });

  it('fails with generator_error after exactly three generation failures', async () => {
    const generator = new ContractCandidatePortFake();
    generator.outcomes.push(
      new Error('generation one'),
      new Error('generation two'),
      new Error('generation three'),
    );
    const harness = await createHarness({ generator });
    const started = await harness.service.start(config({ maxCandidates: 5 }));

    await eventually(
      () => harness.prisma.run(started.id)?.status === LoopStatus.FAILED,
    );
    expect(generator.calls).toHaveLength(3);
    expect(harness.queue.enqueued).toHaveLength(0);
    expect(harness.prisma.run(started.id)?.stopReason).toBe('generator_error');
    expect(harness.stopped).toEqual([
      expect.objectContaining({ stopReason: 'generator_error' }),
    ]);
  });
});

describe('Loop integration: restart reconciliation', () => {
  it.each([JobStatusValue.QUEUED, JobStatusValue.PROCESSING])(
    'preserves an active run when its candidate is %s in the queue',
    async (queueStatus) => {
      const identity = restartFixture();
      const harness = await createHarness({
        seed: (prisma, queue) => {
          prisma.runs.push(identity.run);
          prisma.candidates.push(identity.candidate);
          queue.seed(identity.candidate.jobId, queueStatus);
        },
      });

      expect(harness.prisma.run(identity.run.id)).toMatchObject({
        status: LoopStatus.RUNNING,
        stopReason: null,
      });
      expect(harness.queue.getStatus).toHaveBeenCalledWith(
        identity.candidate.jobId,
      );
    },
  );

  it('marks a missing restart job as orphaned_after_restart', async () => {
    const identity = restartFixture();
    const harness = await createHarness({
      seed: (prisma) => {
        prisma.runs.push(identity.run);
        prisma.candidates.push(identity.candidate);
      },
    });

    expect(harness.prisma.run(identity.run.id)).toMatchObject({
      status: LoopStatus.FAILED,
      stopReason: 'orphaned_after_restart',
    });
  });

  it('keeps the run active when restart reconciliation has a dependency outage', async () => {
    const identity = restartFixture();
    const harness = await createHarness({
      seed: (prisma, queue) => {
        prisma.runs.push(identity.run);
        prisma.candidates.push(identity.candidate);
        queue.statusOutage = true;
      },
    });

    expect(harness.prisma.run(identity.run.id)).toMatchObject({
      status: LoopStatus.RUNNING,
      stopReason: null,
    });
  });
});

describe('Loop integration: generator provider replacement', () => {
  it('changes generation only by overriding ISTRATEGY_CANDIDATE_PORT', async () => {
    const replacement = new ContractCandidatePortFake();
    const replacementVersionId = uuidFor(9_999);
    replacement.outcomes.push({
      strategyVersionId: replacementVersionId,
      strategyName: 'Replacement generator candidate',
    });
    const harness = await createHarness({ generator: replacement });
    const started = await harness.service.start(config({ maxCandidates: 1 }));

    expect(harness.module.get(ISTRATEGY_CANDIDATE_PORT)).toBe(replacement);
    expect(replacement.calls).toEqual([StrategyGeneratorType.RANDOM]);
    expect(harness.prisma.candidatesFor(started.id)[0]).toMatchObject({
      strategyVersionId: replacementVersionId,
    });
    expect(harness.queue.enqueued[0]?.payload).toMatchObject({
      strategyVersionId: replacementVersionId,
      source: BacktestSource.SEARCH_LOOP,
    });
  });
});

describe('T018 optional-auth identities observe one global SearchLoopRun', () => {
  it('returns identical current/detail state and never adds viewer data to persistence calls or records', async () => {
    const identity = restartFixture();
    const harness = await createHarness({
      seed: (prisma, queue) => {
        prisma.runs.push(identity.run);
        prisma.candidates.push(identity.candidate);
        queue.seed(identity.candidate.jobId, JobStatusValue.QUEUED);
      },
    });
    harness.authGuard.canActivate.mockClear();
    harness.prisma.searchLoopRun.findFirst.mockClear();
    harness.prisma.searchLoopRun.findUnique.mockClear();
    harness.prisma.searchLoopCandidate.findMany.mockClear();

    const responses: Array<{ current: unknown; detail: unknown }> = [];
    for (const authorization of [undefined, 'Bearer user-a', 'Bearer user-b']) {
      const currentRequest = request(harness.app.getHttpServer()).get(
        '/api/loop/current',
      );
      if (authorization) {
        currentRequest.set('Authorization', authorization);
      }
      const current = await currentRequest.expect(200);

      const detailRequest = request(harness.app.getHttpServer()).get(
        `/api/loop/${identity.run.id}`,
      );
      if (authorization) {
        detailRequest.set('Authorization', authorization);
      }
      const detail = await detailRequest.expect(200);
      responses.push({ current: current.body, detail: detail.body });
    }

    expect(responses[1]).toEqual(responses[0]);
    expect(responses[2]).toEqual(responses[0]);
    expect(harness.authGuard.canActivate).toHaveBeenCalledTimes(6);
    expect(harness.prisma.searchLoopRun.findFirst).toHaveBeenCalledTimes(3);
    expect(harness.prisma.searchLoopRun.findUnique).toHaveBeenCalledTimes(3);
    expect(harness.prisma.searchLoopCandidate.findMany).toHaveBeenCalledTimes(
      3,
    );

    const persistenceEvidence = JSON.stringify({
      runReads: harness.prisma.searchLoopRun.findFirst.mock.calls,
      detailReads: harness.prisma.searchLoopRun.findUnique.mock.calls,
      candidateReads: harness.prisma.searchLoopCandidate.findMany.mock.calls,
      runs: harness.prisma.runs,
      candidates: harness.prisma.candidates,
    });
    expect(persistenceEvidence).not.toContain('userId');
    expect(persistenceEvidence).not.toContain('11111111-1111-4111-8111-111111111111');
    expect(persistenceEvidence).not.toContain('22222222-2222-4222-8222-222222222222');
  });
});

async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const prisma = new InMemoryLoopPrisma();
  const queue = new ContractJobQueueFake();
  const generator = options.generator ?? new ContractCandidatePortFake();
  const authGuard: Harness['authGuard'] = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const httpRequest = context.switchToHttp().getRequest<{
        headers: { authorization?: string };
        user?: { id: string | null };
      }>();
      const token = httpRequest.headers.authorization?.replace(/^Bearer /, '');
      httpRequest.user = {
        id:
          token === 'user-a'
            ? '11111111-1111-4111-8111-111111111111'
            : token === 'user-b'
              ? '22222222-2222-4222-8222-222222222222'
              : null,
      };
      return true;
    }),
  };
  options.seed?.(prisma, queue);

  const module = await Test.createTestingModule({
    imports: [EventEmitterModule.forRoot(), LoopModule],
  })
    .overrideModule(QueueModule)
    .useModule(ContractQueueModule)
    .overrideModule(StrategyModule)
    .useModule(ContractStrategyModule)
    .overrideModule(LeaderboardModule)
    .useModule(ContractScoringModule)
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(IJOB_QUEUE)
    .useValue(queue)
    .overrideProvider(ISTRATEGY_CANDIDATE_PORT)
    .useValue(generator)
    .overrideProvider(SupabaseService)
    .useValue({ verifyToken: jest.fn() })
    .overrideGuard(SupabaseJwtGuard)
    .useValue(authGuard)
    .compile();
  const app = module.createNestApplication();
  await app.init();

  const eventBus = module.get<IEventBus>(IEVENT_BUS);
  const requested: BacktestRequestedPayload[] = [];
  const progress: SearchLoopProgressPayload[] = [];
  const stopped: SearchLoopStoppedPayload[] = [];
  eventBus.subscribe(EventType.BacktestRequested, ({ payload }) => {
    requested.push(payload);
  });
  eventBus.subscribe(EventType.SearchLoopProgress, ({ payload }) => {
    progress.push(payload);
  });
  eventBus.subscribe(EventType.SearchLoopStopped, ({ payload }) => {
    stopped.push(payload);
  });

  const harness: Harness = {
    app,
    module,
    prisma,
    queue,
    generator,
    eventBus,
    service: module.get(StrategyLoopService),
    status: module.get(LoopStatusService),
    requested,
    progress,
    stopped,
    authGuard,
  };
  openHarnesses.push(harness);
  return harness;
}

function config(overrides: Partial<SearchLoopConfig> = {}): SearchLoopConfig {
  return {
    generatorType: StrategyGeneratorType.RANDOM,
    pair: 'BTC/USDT',
    timeframe: '1h',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-02-01T00:00:00.000Z'),
    backtestConfig: {
      initialCapital: 10_000,
      positionSizePercent: 10,
      commission: 0.001,
      slippage: 0.001,
    },
    maxCandidates: 5,
    maxDurationMs: null,
    stopOnNoImprovementIterations: 50,
    ...overrides,
  };
}

function publishCompleted(
  harness: Harness,
  queueIndex: number,
  totalReturn: number,
): void {
  const job = requiredJob(harness, queueIndex);
  const payload: BacktestCompletedPayload = {
    jobId: job.payload.jobId,
    correlationId: job.correlationId,
    loopRunId: job.payload.loopRunId,
    backtestResultId: uuidFor(20_000 + queueIndex),
    strategyVersionId: job.payload.strategyVersionId,
    strategyName: `Candidate ${queueIndex + 1}`,
    strategyType: 'Composite',
    isComposite: true,
    pair: job.payload.pair,
    timeframe: job.payload.timeframe,
    status: 'SUCCESS',
    metrics: {
      totalReturn,
      winRate: 0.6 as NormalizedRate,
      maxDrawdown: -10,
      sharpeRatio: 1.2,
      profitFactor: 1.5,
      totalTrades: 10,
    },
    executedAt: new Date(),
    executionTimeMs: 250,
  };
  harness.eventBus.publish(
    EventType.BacktestCompleted,
    payload,
    job.correlationId,
  );
}

function publishFailed(harness: Harness, queueIndex: number): void {
  const job = requiredJob(harness, queueIndex);
  const payload: BacktestFailedPayload = {
    jobId: job.payload.jobId,
    correlationId: job.correlationId,
    loopRunId: job.payload.loopRunId,
    strategyVersionId: job.payload.strategyVersionId,
    error: 'terminal worker failure',
    attempt: 3,
  };
  harness.eventBus.publish(
    EventType.BacktestFailed,
    payload,
    job.correlationId,
  );
}

function requiredJob(harness: Harness, index: number): EnqueuedJob {
  const job = harness.queue.enqueued[index];
  if (!job) throw new Error(`Missing enqueued job at index ${index}`);
  return job;
}

function terminalCandidates(harness: Harness, loopRunId: string): number {
  return harness.prisma
    .candidatesFor(loopRunId)
    .filter(
      (item) =>
        item.status === SearchLoopCandidateStatus.EVALUATED ||
        item.status === SearchLoopCandidateStatus.FAILED,
    ).length;
}

async function eventually(assertion: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!assertion()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for Loop integration state');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

async function settleEvents(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function restartFixture(): { run: PrismaRun; candidate: PrismaCandidate } {
  const run = runRow({
    id: uuidFor(30_000),
    status: LoopStatus.RUNNING,
    iteration: 1,
    currentCandidateStrategyVersionId: uuidFor(30_001),
  });
  return {
    run,
    candidate: candidateRow(run.id, {
      jobId: uuidFor(30_002),
      strategyVersionId: run.currentCandidateStrategyVersionId!,
      iteration: 1,
    }),
  };
}

class InMemoryLoopPrisma {
  readonly runs: PrismaRun[] = [];
  readonly candidates: PrismaCandidate[] = [];
  private clock = 0;

  readonly searchLoopRun = {
    findFirst: jest.fn(async (args?: Record<string, unknown>) => {
      const statuses = extractStatuses(args);
      const found = this.runs.find((run) =>
        statuses.length > 0
          ? statuses.includes(run.status)
          : run.status === LoopStatus.RUNNING ||
            run.status === LoopStatus.PAUSED,
      );
      await Promise.resolve();
      return found ? { ...found } : null;
    }),
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      const found = this.runs.find((run) => run.id === where.id);
      return found ? { ...found } : null;
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const created = runRow({
        ...(data as Partial<PrismaRun>),
        id: (data.id as string | undefined) ?? randomUUID(),
        startedAt: (data.startedAt as Date | undefined) ?? new Date(),
      });
      this.runs.push(created);
      return { ...created };
    }),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const index = this.runs.findIndex((run) => run.id === where.id);
        if (index < 0) throw new Error('Run not found');
        this.runs[index] = applyUpdate(this.runs[index], data);
        return { ...this.runs[index] };
      },
    ),
    updateMany: jest.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const matches = this.runs
          .map((run, index) => ({ run, index }))
          .filter(({ run }) => matchesWhere(run, where));
        for (const { index } of matches) {
          this.runs[index] = applyUpdate(this.runs[index], data);
        }
        return { count: matches.length };
      },
    ),
  };

  readonly searchLoopCandidate = {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const jobId = data.jobId as string;
      if (this.candidates.some((candidate) => candidate.jobId === jobId)) {
        throw { code: 'P2002' };
      }
      const created = candidateRow(data.loopRunId as string, {
        ...(data as Partial<PrismaCandidate>),
        id: (data.id as string | undefined) ?? randomUUID(),
        createdAt: new Date(Date.now() + this.clock++),
        updatedAt: new Date(Date.now() + this.clock++),
      });
      this.candidates.push(created);
      return { ...created };
    }),
    findUnique: jest.fn(
      async ({ where }: { where: { jobId?: string; id?: string } }) => {
        const found = this.candidates.find(
          (candidate) =>
            (where.jobId !== undefined && candidate.jobId === where.jobId) ||
            (where.id !== undefined && candidate.id === where.id),
        );
        return found ? { ...found } : null;
      },
    ),
    findFirst: jest.fn(
      async ({ where }: { where: Record<string, unknown> }) => {
        const found = this.candidates.find((candidate) =>
          matchesWhere(candidate, where),
        );
        return found ? { ...found } : null;
      },
    ),
    findMany: jest.fn(
      async ({
        where,
        orderBy,
      }: {
        where?: Record<string, unknown>;
        orderBy?: { iteration?: 'asc' | 'desc' };
      } = {}) => {
        const filtered = this.candidates.filter((candidate) =>
          where ? matchesWhere(candidate, where) : true,
        );
        const direction = orderBy?.iteration === 'desc' ? -1 : 1;
        return [...filtered].sort(
          (left, right) =>
            direction * (left.iteration - right.iteration) ||
            left.id.localeCompare(right.id),
        );
      },
    ),
    updateMany: jest.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const matches = this.candidates
          .map((candidate, index) => ({ candidate, index }))
          .filter(({ candidate }) => matchesWhere(candidate, where));
        for (const { index } of matches) {
          this.candidates[index] = applyUpdate(this.candidates[index], data);
        }
        return { count: matches.length };
      },
    ),
  };

  $transaction<T>(
    operation: (transaction: InMemoryLoopPrisma) => Promise<T>,
  ): Promise<T> {
    return operation(this);
  }

  run(id: string): PrismaRun | undefined {
    return this.runs.find((run) => run.id === id);
  }

  candidatesFor(loopRunId: string): PrismaCandidate[] {
    return [...this.candidates]
      .filter((candidate) => candidate.loopRunId === loopRunId)
      .sort((left, right) => left.iteration - right.iteration);
  }
}

function runRow(overrides: Partial<PrismaRun> = {}): PrismaRun {
  return {
    id: randomUUID(),
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
    startedAt: new Date(STARTED_AT),
    pausedAt: null,
    stoppedAt: null,
    ...overrides,
  };
}

function candidateRow(
  loopRunId: string,
  overrides: Partial<PrismaCandidate> = {},
): PrismaCandidate {
  return {
    id: randomUUID(),
    loopRunId,
    jobId: randomUUID(),
    strategyVersionId: randomUUID(),
    backtestResultId: null,
    iteration: 1,
    score: null,
    status: SearchLoopCandidateStatus.BACKTESTING,
    createdAt: new Date(STARTED_AT),
    updatedAt: new Date(STARTED_AT),
    ...overrides,
  };
}

function extractStatuses(args?: Record<string, unknown>): string[] {
  const where = args?.where as Record<string, unknown> | undefined;
  const status = where?.status;
  if (typeof status === 'string') return [status];
  if (typeof status === 'object' && status !== null && 'in' in status) {
    return (status as { in: string[] }).in;
  }
  return [];
}

function matchesWhere(
  value: Record<string, unknown>,
  where: Record<string, unknown>,
): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = value[key];
    if (typeof expected === 'object' && expected !== null && 'in' in expected) {
      return (expected as { in: unknown[] }).in.includes(actual);
    }
    return actual === expected;
  });
}

function applyUpdate<T extends Record<string, unknown>>(
  value: T,
  data: Record<string, unknown>,
): T {
  const next = { ...value };
  for (const [key, update] of Object.entries(data)) {
    if (update === undefined) continue;
    if (
      typeof update === 'object' &&
      update !== null &&
      'increment' in update
    ) {
      next[key as keyof T] = (Number(next[key]) +
        Number((update as { increment: number }).increment)) as T[keyof T];
    } else {
      next[key as keyof T] = update as T[keyof T];
    }
  }
  return next;
}

function uuidFor(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}
