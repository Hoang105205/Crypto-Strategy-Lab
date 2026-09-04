import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BacktestSource,
  EventType,
  JobType,
  LoopStatus,
  SearchLoopCandidateStatus,
  StrategyGeneratorType,
  type BacktestCompletedPayload,
  type BacktestFailedPayload,
  type EventEnvelope,
  type IEventBus,
  type IJobQueue,
  type SearchLoopCandidate,
  type SearchLoopConfig,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';

const TARGET_FILE = join(__dirname, 'strategy-loop.service.ts');
const TARGET_MODULE = join(__dirname, 'strategy-loop.service');
const TARGET_EXISTS = existsSync(TARGET_FILE);

/**
 * T029 contract gate: the existing generators return an in-memory IStrategy.
 * Loop cannot enqueue a backtest until Strategy owns and returns an immutable
 * StrategyVersion id. This is the smallest test-facing result required after
 * that boundary is reconciled; it is deliberately not implemented in T029.
 */
interface GeneratedCandidateReference {
  strategyVersionId: string;
  strategyName: string;
}

interface LoopCandidateGeneratorPort {
  generateCandidate(
    generatorType: StrategyGeneratorType,
  ): Promise<GeneratedCandidateReference>;
}

/** T029 contract gate: Loop and Leaderboard must use the same scoring policy. */
interface LoopScoringPolicyPort {
  calculateScore(metrics: BacktestCompletedPayload['metrics']): number;
}

interface CandidateTerminalResult {
  applied: boolean;
  run: SearchLoopRun;
  candidate: SearchLoopCandidate;
}

interface LoopRepositoryPort {
  createRun(config: SearchLoopConfig): Promise<SearchLoopRun>;
  createCandidate(input: {
    loopRunId: string;
    jobId: string;
    strategyVersionId: string;
    iteration: number;
  }): Promise<SearchLoopCandidate>;
  recordCandidateCompleted(input: {
    loopRunId: string;
    jobId: string;
    backtestResultId: string;
    score: number;
  }): Promise<CandidateTerminalResult>;
  recordCandidateFailed(input: {
    loopRunId: string;
    jobId: string;
  }): Promise<CandidateTerminalResult>;
}

interface LoopStatusPort {
  getCurrent(): Promise<SearchLoopRun | null>;
  pause(loopRunId: string): Promise<SearchLoopRun>;
  resume(loopRunId: string): Promise<SearchLoopRun>;
  stop(loopRunId: string): Promise<SearchLoopRun>;
  complete(loopRunId: string, stopReason: string): Promise<SearchLoopRun>;
  fail(loopRunId: string, stopReason: string): Promise<SearchLoopRun>;
}

type StartLoopInput = Omit<
  SearchLoopConfig,
  'maxCandidates' | 'maxDurationMs' | 'stopOnNoImprovementIterations'
> & {
  maxCandidates?: number | null;
  maxDurationMs?: number | null;
  stopOnNoImprovementIterations?: number;
};

interface StrategyLoopServiceApi {
  start(config: StartLoopInput): Promise<SearchLoopRun>;
  pause(loopRunId: string): Promise<SearchLoopRun>;
  resume(loopRunId: string): Promise<SearchLoopRun>;
  stop(loopRunId: string): Promise<SearchLoopRun>;
  handleBacktestCompleted(
    envelope: EventEnvelope<BacktestCompletedPayload>,
  ): Promise<void>;
  handleBacktestFailed(
    envelope: EventEnvelope<BacktestFailedPayload>,
  ): Promise<void>;
}

type MockFunctions<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Result
    ? jest.Mock<(...args: Args) => Result>
    : T[K];
};

type StrategyLoopServiceConstructor = new (
  repository: LoopRepositoryPort,
  status: LoopStatusPort,
  generator: LoopCandidateGeneratorPort,
  scoringPolicy: LoopScoringPolicyPort,
  jobQueue: IJobQueue,
  eventBus: IEventBus,
) => StrategyLoopServiceApi;

const loadTarget = (): StrategyLoopServiceConstructor => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const target = require(TARGET_MODULE) as {
    StrategyLoopService?: StrategyLoopServiceConstructor;
  };
  if (typeof target.StrategyLoopService !== 'function') {
    throw new Error(
      'T029 RED: strategy-loop.service.ts must export StrategyLoopService.',
    );
  }
  return target.StrategyLoopService;
};

const STARTED_AT = new Date('2026-08-16T03:00:00.000Z');
const STOPPED_AT = new Date('2026-08-16T03:05:00.000Z');

const config = (
  overrides: Partial<SearchLoopConfig> = {},
): SearchLoopConfig => ({
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
  maxCandidates: 50,
  maxDurationMs: null,
  stopOnNoImprovementIterations: 10,
  ...overrides,
});

const run = (overrides: Partial<SearchLoopRun> = {}): SearchLoopRun => ({
  id: randomUUID(),
  status: LoopStatus.RUNNING,
  generatorType: StrategyGeneratorType.RANDOM,
  iteration: 1,
  testedCandidates: 0,
  maxCandidates: 50,
  maxDurationMs: null,
  stopOnNoImprovementIterations: 10,
  currentCandidateStrategyVersionId: null,
  bestStrategyVersionId: null,
  bestScore: null,
  stopReason: null,
  startedAt: STARTED_AT,
  pausedAt: null,
  stoppedAt: null,
  ...overrides,
});

const candidate = (
  loopRunId: string,
  overrides: Partial<SearchLoopCandidate> = {},
): SearchLoopCandidate => ({
  id: randomUUID(),
  loopRunId,
  jobId: randomUUID(),
  strategyVersionId: randomUUID(),
  backtestResultId: null,
  iteration: 1,
  score: null,
  status: SearchLoopCandidateStatus.BACKTESTING,
  createdAt: STARTED_AT,
  updatedAt: STARTED_AT,
  ...overrides,
});

const completedEnvelope = (
  loopRunId: string,
  jobId: string,
  strategyVersionId: string,
): EventEnvelope<BacktestCompletedPayload> => ({
  eventId: randomUUID(),
  eventType: EventType.BacktestCompleted,
  eventVersion: 1,
  occurredAt: STOPPED_AT,
  correlationId: randomUUID(),
  payload: {
    jobId,
    correlationId: randomUUID(),
    userId: null,
    loopRunId,
    backtestResultId: randomUUID(),
    strategyVersionId,
    strategyName: 'Generated candidate',
    strategyType: 'SMA_CROSSOVER',
    isComposite: false,
    pair: 'BTC/USDT',
    timeframe: '1h',
    status: 'SUCCESS',
    metrics: {
      totalReturn: 12,
      winRate: 0.6 as BacktestCompletedPayload['metrics']['winRate'],
      maxDrawdown: 8,
      sharpeRatio: 1.2,
      profitFactor: 1.5,
      totalTrades: 20,
    },
    executedAt: STOPPED_AT,
    executionTimeMs: 2_000,
  },
});

const failedEnvelope = (
  loopRunId: string,
  jobId: string,
  strategyVersionId: string,
): EventEnvelope<BacktestFailedPayload> => ({
  eventId: randomUUID(),
  eventType: EventType.BacktestFailed,
  eventVersion: 1,
  occurredAt: STOPPED_AT,
  correlationId: randomUUID(),
  payload: {
    jobId,
    correlationId: randomUUID(),
    loopRunId,
    strategyVersionId,
    error: 'worker failed',
    attempt: 3,
  },
});

const isUuid = (value: unknown): boolean =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

describe('T029 pre-implementation contract gates', () => {
  it('requires a Strategy-owned port that returns an immutable StrategyVersion id', () => {
    const generatorContract = readFileSync(
      join(__dirname, '../../../../libs/shared/src/interfaces/strategy.ts'),
      'utf8',
    );
    const strategyTypes = readFileSync(
      join(__dirname, '../../../../libs/shared/src/types/strategy.ts'),
      'utf8',
    );

    expect(generatorContract).toContain(
      'export interface IStrategyCandidatePort',
    );
    expect(generatorContract).toContain('generateCandidate(');
    expect(strategyTypes).toMatch(
      /interface StrategyCandidateReference[\s\S]*strategyVersionId: string/,
    );
  });

  it('requires one canonical scoring policy token for Leaderboard and Loop', () => {
    const events = readFileSync(
      join(__dirname, '../../../../libs/shared/src/events/index.ts'),
      'utf8',
    );
    const scoring = readFileSync(
      join(__dirname, '../leaderboard/scoring-policy.ts'),
      'utf8',
    );
    const tokens = readFileSync(join(__dirname, '../shared/tokens.ts'), 'utf8');
    const leaderboardModule = readFileSync(
      join(__dirname, '../leaderboard/leaderboard.module.ts'),
      'utf8',
    );
    const completedPayload = events.slice(
      events.indexOf('export interface BacktestCompletedPayload'),
      events.indexOf('export interface BacktestFailedPayload'),
    );

    expect(completedPayload).toContain('metrics: BacktestEvaluationMetrics');
    expect(completedPayload).not.toMatch(/^\s*score:/m);
    expect(scoring).toContain('calculateScore(input: ScoreInput): number');
    expect(tokens).toContain("ISCORING_POLICY = Symbol('IScoringPolicy')");
    expect(leaderboardModule).toContain(
      'provide: ISCORING_POLICY, useExisting: ScoringPolicy',
    );
    expect(leaderboardModule).toContain(
      'exports: [LeaderboardService, ISCORING_POLICY]',
    );
  });

  it('requires a tokenized Strategy adapter to select and materialize candidates', () => {
    const tokens = readFileSync(join(__dirname, '../shared/tokens.ts'), 'utf8');
    const candidatePort = readFileSync(
      join(__dirname, '../strategy/ports/strategy-candidate.port.ts'),
      'utf8',
    );
    const strategyModule = readFileSync(
      join(__dirname, '../strategy/strategy.module.ts'),
      'utf8',
    );

    expect(tokens).toContain(
      "ISTRATEGY_CANDIDATE_PORT = Symbol('IStrategyCandidatePort')",
    );
    expect(candidatePort).toContain('generateCandidates(1, generatorType)');
    expect(candidatePort).toContain('this.versions.createVersion(strategy)');
    expect(candidatePort).toContain('strategyVersionId: version.id');
    expect(strategyModule).toContain('provide: ISTRATEGY_CANDIDATE_PORT,');
    expect(strategyModule).toMatch(/exports:[\s\S]*ISTRATEGY_CANDIDATE_PORT/);
  });
});

describe('T029 StrategyLoopService target', () => {
  it('is RED until StrategyLoopService exists', () => {
    if (!TARGET_EXISTS) {
      throw new Error(
        'T029 RED: missing loop/strategy-loop.service.ts; behavioral tests are intentionally pending.',
      );
    }
    expect(loadTarget()).toBeDefined();
  });
});

const describeWithTarget = TARGET_EXISTS ? describe : describe.skip;

describeWithTarget('StrategyLoopService orchestration contract', () => {
  let repository: MockFunctions<LoopRepositoryPort>;
  let status: MockFunctions<LoopStatusPort>;
  let generator: MockFunctions<LoopCandidateGeneratorPort>;
  let scoringPolicy: MockFunctions<LoopScoringPolicyPort>;
  let jobQueue: MockFunctions<IJobQueue>;
  let eventBus: jest.Mocked<IEventBus>;
  let activeRun: SearchLoopRun;
  let firstCandidate: SearchLoopCandidate;
  let service: StrategyLoopServiceApi;

  const eventPayloads = (eventType: string): unknown[] =>
    eventBus.publish.mock.calls
      .filter(([publishedType]) => publishedType === eventType)
      .map(([, payload]) => payload);

  beforeEach(() => {
    activeRun = run();
    firstCandidate = candidate(activeRun.id, {
      strategyVersionId: randomUUID(),
    });
    repository = {
      createRun: jest
        .fn<LoopRepositoryPort['createRun']>()
        .mockResolvedValue(activeRun),
      createCandidate: jest
        .fn<LoopRepositoryPort['createCandidate']>()
        .mockResolvedValue(firstCandidate),
      recordCandidateCompleted:
        jest.fn<LoopRepositoryPort['recordCandidateCompleted']>(),
      recordCandidateFailed:
        jest.fn<LoopRepositoryPort['recordCandidateFailed']>(),
    };
    status = {
      getCurrent: jest
        .fn<LoopStatusPort['getCurrent']>()
        .mockResolvedValue(activeRun),
      pause: jest.fn<LoopStatusPort['pause']>(),
      resume: jest.fn<LoopStatusPort['resume']>(),
      stop: jest.fn<LoopStatusPort['stop']>(),
      complete: jest.fn<LoopStatusPort['complete']>(),
      fail: jest.fn<LoopStatusPort['fail']>(),
    };
    generator = {
      generateCandidate: jest
        .fn<LoopCandidateGeneratorPort['generateCandidate']>()
        .mockResolvedValue({
          strategyVersionId: firstCandidate.strategyVersionId,
          strategyName: 'Generated candidate',
        }),
    };
    scoringPolicy = {
      calculateScore: jest
        .fn<LoopScoringPolicyPort['calculateScore']>()
        .mockReturnValue(0.5),
    };
    jobQueue = {
      enqueue: jest
        .fn<IJobQueue['enqueue']>()
        .mockResolvedValue({ jobId: firstCandidate.jobId }),
      getStatus: jest.fn<IJobQueue['getStatus']>(),
      retry: jest.fn<IJobQueue['retry']>(),
      deadLetter: jest.fn<IJobQueue['deadLetter']>(),
      getStats: jest.fn<IJobQueue['getStats']>(),
    };
    eventBus = {
      publish: jest.fn<IEventBus['publish']>(),
      subscribe: jest.fn<IEventBus['subscribe']>(),
      unsubscribe: jest.fn<IEventBus['unsubscribe']>(),
    } as jest.Mocked<IEventBus>;

    const Target = loadTarget();
    service = new Target(
      repository,
      status,
      generator,
      scoringPolicy,
      jobQueue,
      eventBus,
    );
  });

  describe('configuration and candidate generation', () => {
    it('defaults no-improvement to 50 and keeps numeric bounds disabled', async () => {
      const input = config();
      const withoutDefault: StartLoopInput = {
        ...input,
        maxCandidates: undefined,
        maxDurationMs: undefined,
        stopOnNoImprovementIterations: undefined,
      };

      await service.start(withoutDefault);

      expect(repository.createRun as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          maxCandidates: null,
          maxDurationMs: null,
          stopOnNoImprovementIterations: 50,
        }),
      );
      expect(eventPayloads(EventType.SearchLoopStarted)).toContainEqual(
        expect.objectContaining({
          config: expect.objectContaining({
            maxCandidates: null,
            maxDurationMs: null,
            stopOnNoImprovementIterations: 50,
          }),
        }),
      );
    });

    it.each([
      StrategyGeneratorType.RANDOM,
      StrategyGeneratorType.DOMAIN_GUIDED,
    ])(
      'selects the %s generator without bypassing the generator port',
      async (type) => {
        await service.start(config({ generatorType: type }));

        expect(generator.generateCandidate as jest.Mock).toHaveBeenCalledWith(
          type,
        );
      },
    );

    it.each([
      ['maxCandidates', 0],
      ['maxDurationMs', 0],
      ['stopOnNoImprovementIterations', 0],
    ] as const)(
      'rejects invalid positive bound %s=%s',
      async (field, value) => {
        await expect(
          service.start(config({ [field]: value })),
        ).rejects.toMatchObject({
          code: 'INVALID_LOOP_CONFIG',
        });
        expect(repository.createRun as jest.Mock).not.toHaveBeenCalled();
      },
    );
  });

  describe('durable enqueue-before-event ordering', () => {
    it('uses a producer UUID and one correlationId for enqueue and BacktestRequested', async () => {
      await service.start(config());

      const [, queuePayload, queueCorrelationId] =
        jobQueue.enqueue.mock.calls[0];
      const requestedCall = eventBus.publish.mock.calls.find(
        ([eventType]) => eventType === EventType.BacktestRequested,
      );

      expect(jobQueue.enqueue as jest.Mock).toHaveBeenCalledWith(
        JobType.BACKTEST,
        expect.objectContaining({
          source: BacktestSource.SEARCH_LOOP,
          loopRunId: activeRun.id,
          strategyVersionId: firstCandidate.strategyVersionId,
          userId: null,
        }),
        expect.any(String),
      );
      expect(isUuid(queuePayload.jobId)).toBe(true);
      expect(queuePayload.jobId).toBe(firstCandidate.jobId);
      expect(queuePayload.userId).toBeNull();
      expect(requestedCall?.[1]).toEqual(queuePayload);
      expect(requestedCall?.[2]).toBe(queueCorrelationId);
    });

    it('awaits enqueue acceptance before publishing BacktestRequested', async () => {
      let acceptEnqueue!: (value: { jobId: string }) => void;
      jobQueue.enqueue.mockImplementation(
        () =>
          new Promise((resolve) => {
            acceptEnqueue = resolve;
          }),
      );

      const starting = service.start(config());
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(eventPayloads(EventType.BacktestRequested)).toHaveLength(0);
      acceptEnqueue({ jobId: firstCandidate.jobId });
      await starting;
      expect(eventPayloads(EventType.BacktestRequested)).toHaveLength(1);
    });

    it('does not falsely publish BacktestRequested when enqueue fails', async () => {
      jobQueue.enqueue.mockRejectedValue(new Error('redis unavailable'));

      await expect(service.start(config())).rejects.toMatchObject({
        code: 'QUEUE_UNAVAILABLE',
      });
      expect(eventPayloads(EventType.BacktestRequested)).toHaveLength(0);
    });
  });

  describe('terminal accounting, late results, and successor rules', () => {
    it('scores with the shared policy and accounts once by loopRunId plus jobId', async () => {
      await service.start(config());
      const envelope = completedEnvelope(
        activeRun.id,
        firstCandidate.jobId,
        firstCandidate.strategyVersionId,
      );
      repository.recordCandidateCompleted.mockResolvedValue({
        applied: true,
        run: run({ id: activeRun.id, testedCandidates: 1 }),
        candidate: candidate(activeRun.id, {
          jobId: firstCandidate.jobId,
          status: SearchLoopCandidateStatus.EVALUATED,
          score: 0.5,
        }),
      });

      await service.handleBacktestCompleted(envelope);

      expect(scoringPolicy.calculateScore as jest.Mock).toHaveBeenCalledWith(
        envelope.payload.metrics,
      );
      expect(
        repository.recordCandidateCompleted as jest.Mock,
      ).toHaveBeenCalledWith({
        loopRunId: activeRun.id,
        jobId: firstCandidate.jobId,
        backtestResultId: envelope.payload.backtestResultId,
        score: 0.5,
      });
    });

    it('treats an already-applied terminal result as a no-op', async () => {
      await service.start(config());
      generator.generateCandidate.mockClear();
      repository.recordCandidateCompleted.mockResolvedValue({
        applied: false,
        run: activeRun,
        candidate: firstCandidate,
      });

      await service.handleBacktestCompleted(
        completedEnvelope(
          activeRun.id,
          firstCandidate.jobId,
          firstCandidate.strategyVersionId,
        ),
      );

      expect(generator.generateCandidate as jest.Mock).not.toHaveBeenCalled();
      expect(eventPayloads(EventType.SearchLoopProgress)).toHaveLength(0);
      expect(eventPayloads(EventType.SearchLoopStopped)).toHaveLength(0);
    });

    it.each([
      LoopStatus.PAUSED,
      LoopStatus.COMPLETED,
      LoopStatus.STOPPED_BY_USER,
      LoopStatus.FAILED,
    ])(
      'persists a late result in %s but emits no progress or successor',
      async (loopStatus) => {
        await service.start(config());
        generator.generateCandidate.mockClear();
        repository.recordCandidateCompleted.mockResolvedValue({
          applied: true,
          run: run({ id: activeRun.id, status: loopStatus }),
          candidate: firstCandidate,
        });

        await service.handleBacktestCompleted(
          completedEnvelope(
            activeRun.id,
            firstCandidate.jobId,
            firstCandidate.strategyVersionId,
          ),
        );

        expect(
          repository.recordCandidateCompleted as jest.Mock,
        ).toHaveBeenCalled();
        expect(generator.generateCandidate as jest.Mock).not.toHaveBeenCalled();
        expect(eventPayloads(EventType.SearchLoopProgress)).toHaveLength(0);
      },
    );

    it('applies the same idempotent terminal gate to BacktestFailed', async () => {
      await service.start(config());
      generator.generateCandidate.mockClear();
      repository.recordCandidateFailed.mockResolvedValue({
        applied: false,
        run: activeRun,
        candidate: firstCandidate,
      });

      await service.handleBacktestFailed(
        failedEnvelope(
          activeRun.id,
          firstCandidate.jobId,
          firstCandidate.strategyVersionId,
        ),
      );

      expect(
        repository.recordCandidateFailed as jest.Mock,
      ).toHaveBeenCalledWith({
        loopRunId: activeRun.id,
        jobId: firstCandidate.jobId,
      });
      expect(generator.generateCandidate as jest.Mock).not.toHaveBeenCalled();
      expect(eventPayloads(EventType.SearchLoopProgress)).toHaveLength(0);
    });
  });

  describe('epsilon and exact stop ordering', () => {
    const completeAfterResult = async (
      resultRun: SearchLoopRun,
    ): Promise<void> => {
      repository.recordCandidateCompleted.mockResolvedValue({
        applied: true,
        run: resultRun,
        candidate: firstCandidate,
      });
      status.complete.mockResolvedValue(
        run({
          ...resultRun,
          status: LoopStatus.COMPLETED,
          stoppedAt: STOPPED_AT,
        }),
      );
      await service.handleBacktestCompleted(
        completedEnvelope(
          activeRun.id,
          firstCandidate.jobId,
          firstCandidate.strategyVersionId,
        ),
      );
    };

    it('uses epsilon 0.01: an exactly +0.01 score delta is not improvement', async () => {
      activeRun = run({
        id: activeRun.id,
        bestScore: 0.5,
        bestStrategyVersionId: randomUUID(),
        stopOnNoImprovementIterations: 1,
      });
      repository.createRun.mockResolvedValue(activeRun);
      scoringPolicy.calculateScore.mockReturnValue(0.51);
      await service.start(config({ stopOnNoImprovementIterations: 1 }));

      await completeAfterResult(
        run({
          ...activeRun,
          testedCandidates: 2,
          bestScore: 0.5,
        }),
      );

      expect(status.complete as jest.Mock).toHaveBeenCalledWith(
        activeRun.id,
        'no_improvement_limit_reached',
      );
    });

    it('checks user pause/stop before automatic bounds', async () => {
      await service.start(config({ maxCandidates: 1 }));
      generator.generateCandidate.mockClear();
      repository.recordCandidateCompleted.mockResolvedValue({
        applied: true,
        run: run({
          id: activeRun.id,
          status: LoopStatus.PAUSED,
          testedCandidates: 1,
          maxCandidates: 1,
        }),
        candidate: firstCandidate,
      });

      await service.handleBacktestCompleted(
        completedEnvelope(
          activeRun.id,
          firstCandidate.jobId,
          firstCandidate.strategyVersionId,
        ),
      );

      expect(status.complete as jest.Mock).not.toHaveBeenCalled();
      expect(generator.generateCandidate as jest.Mock).not.toHaveBeenCalled();
    });

    it('checks maxCandidates before maxDuration and no-improvement', async () => {
      await service.start(
        config({
          maxCandidates: 1,
          maxDurationMs: 1,
          stopOnNoImprovementIterations: 1,
        }),
      );
      await completeAfterResult(
        run({
          id: activeRun.id,
          testedCandidates: 1,
          maxCandidates: 1,
          maxDurationMs: 1,
          stopOnNoImprovementIterations: 1,
        }),
      );

      expect(status.complete as jest.Mock).toHaveBeenCalledWith(
        activeRun.id,
        'max_candidates_reached',
      );
    });

    it('checks maxDuration before no-improvement', async () => {
      await service.start(
        config({
          maxCandidates: 50,
          maxDurationMs: 1,
          stopOnNoImprovementIterations: 1,
        }),
      );
      await completeAfterResult(
        run({
          id: activeRun.id,
          testedCandidates: 2,
          maxCandidates: 50,
          maxDurationMs: 1,
          stopOnNoImprovementIterations: 1,
        }),
      );

      expect(status.complete as jest.Mock).toHaveBeenCalledWith(
        activeRun.id,
        'max_duration_reached',
      );
    });
  });

  describe('generation failures and command races', () => {
    it('fails the run after exactly three consecutive generation failures', async () => {
      generator.generateCandidate.mockRejectedValue(new Error('bad candidate'));
      const failedRun = run({
        id: activeRun.id,
        status: LoopStatus.FAILED,
        stopReason: 'generator_error',
        stoppedAt: STOPPED_AT,
      });
      status.fail.mockResolvedValue(failedRun);

      await service.start(config());

      expect(generator.generateCandidate as jest.Mock).toHaveBeenCalledTimes(3);
      expect(status.fail as jest.Mock).toHaveBeenCalledWith(
        activeRun.id,
        'generator_error',
      );
      expect(jobQueue.enqueue as jest.Mock).not.toHaveBeenCalled();
      expect(eventPayloads(EventType.SearchLoopStopped)).toHaveLength(1);
    });

    it('resets the consecutive failure count after a successful generation', async () => {
      generator.generateCandidate
        .mockRejectedValueOnce(new Error('first'))
        .mockRejectedValueOnce(new Error('second'))
        .mockResolvedValueOnce({
          strategyVersionId: firstCandidate.strategyVersionId,
          strategyName: 'Recovered candidate',
        });

      await service.start(config());

      expect(generator.generateCandidate as jest.Mock).toHaveBeenCalledTimes(3);
      expect(status.fail as jest.Mock).not.toHaveBeenCalled();
      expect(jobQueue.enqueue as jest.Mock).toHaveBeenCalledTimes(1);
    });

    it('does not enqueue a generated successor if pause wins the race', async () => {
      await service.start(config());
      generator.generateCandidate.mockClear();
      jobQueue.enqueue.mockClear();
      repository.recordCandidateCompleted.mockResolvedValue({
        applied: true,
        run: run({ id: activeRun.id, status: LoopStatus.PAUSED }),
        candidate: firstCandidate,
      });

      await service.handleBacktestCompleted(
        completedEnvelope(
          activeRun.id,
          firstCandidate.jobId,
          firstCandidate.strategyVersionId,
        ),
      );

      expect(generator.generateCandidate as jest.Mock).not.toHaveBeenCalled();
      expect(jobQueue.enqueue as jest.Mock).not.toHaveBeenCalled();
    });

    it.each([
      ['pause', LoopStatus.PAUSED],
      ['stop', LoopStatus.STOPPED_BY_USER],
    ] as const)(
      'does not enqueue when %s wins while initial generation is in flight',
      async (command, resultingStatus) => {
        let finishGeneration!: (candidate: GeneratedCandidateReference) => void;
        generator.generateCandidate.mockImplementation(
          () =>
            new Promise((resolve) => {
              finishGeneration = resolve;
            }),
        );
        const changed = run({
          id: activeRun.id,
          status: resultingStatus,
          stopReason:
            resultingStatus === LoopStatus.STOPPED_BY_USER
              ? 'stopped_by_user'
              : null,
        });
        status[command].mockResolvedValue(changed);

        const starting = service.start(config());
        await Promise.resolve();
        await Promise.resolve();
        await service[command](activeRun.id);
        status.getCurrent.mockResolvedValue(changed);
        finishGeneration({
          strategyVersionId: firstCandidate.strategyVersionId,
          strategyName: 'Too late candidate',
        });
        await starting;

        expect(jobQueue.enqueue as jest.Mock).not.toHaveBeenCalled();
      },
    );

    it('concurrent resume generates one successor, while concurrent stop publishes once', async () => {
      await service.start(config());
      generator.generateCandidate.mockClear();
      jobQueue.enqueue.mockClear();
      let resumed = false;
      status.resume.mockImplementation(() => {
        if (resumed) {
          throw Object.assign(new Error('already running'), {
            code: 'INVALID_LOOP_TRANSITION',
          });
        }
        resumed = true;
        return Promise.resolve(run({ id: activeRun.id }));
      });
      const stopped = run({
        id: activeRun.id,
        status: LoopStatus.STOPPED_BY_USER,
        stopReason: 'stopped_by_user',
        stoppedAt: STOPPED_AT,
      });
      status.stop.mockResolvedValueOnce(stopped).mockResolvedValueOnce(stopped);

      await Promise.allSettled([
        service.resume(activeRun.id),
        service.resume(activeRun.id),
      ]);
      expect(generator.generateCandidate as jest.Mock).toHaveBeenCalledTimes(1);
      expect(jobQueue.enqueue as jest.Mock).toHaveBeenCalledTimes(1);

      await Promise.all([
        service.stop(activeRun.id),
        service.stop(activeRun.id),
      ]);
      expect(eventPayloads(EventType.SearchLoopStopped)).toHaveLength(1);
    });
  });
});
