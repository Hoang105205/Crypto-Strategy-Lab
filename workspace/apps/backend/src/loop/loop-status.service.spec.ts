import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  JobStatusValue,
  LoopStatus,
  SearchLoopCandidateStatus,
  StrategyGeneratorType,
  type IJobQueue,
  type SearchLoopCandidate,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';

const TARGET_FILE = join(__dirname, 'loop-status.service.ts');
const TARGET_MODULE = join(__dirname, 'loop-status.service');
const TARGET_EXISTS = existsSync(TARGET_FILE);

interface LoopRunDetail {
  run: SearchLoopRun;
  candidates: SearchLoopCandidate[];
}

interface LoopRepositoryPort {
  findActiveRun(): Promise<SearchLoopRun | null>;
  findRunById(loopRunId: string): Promise<SearchLoopRun | null>;
  getRunDetail(loopRunId: string): Promise<LoopRunDetail | null>;
  findInFlightCandidate(loopRunId: string): Promise<SearchLoopCandidate | null>;
  transitionRun(
    loopRunId: string,
    expected: readonly LoopStatus[],
    update: Partial<SearchLoopRun>,
  ): Promise<SearchLoopRun | null>;
}

interface LoopStatusServiceApi {
  pause(loopRunId: string): Promise<SearchLoopRun>;
  resume(loopRunId: string): Promise<SearchLoopRun>;
  stop(loopRunId: string): Promise<SearchLoopRun>;
  complete(loopRunId: string, stopReason: string): Promise<SearchLoopRun>;
  fail(loopRunId: string, stopReason: string): Promise<SearchLoopRun>;
  getCurrent(): Promise<SearchLoopRun | null>;
  getDetail(loopRunId: string): Promise<LoopRunDetail | null>;
  reconcileAfterRestart(): Promise<SearchLoopRun | null>;
}

type LoopStatusServiceConstructor = new (
  repository: LoopRepositoryPort,
  jobQueue: IJobQueue,
) => LoopStatusServiceApi;

const loadTarget = (): LoopStatusServiceConstructor => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const target = require(TARGET_MODULE) as {
    LoopStatusService?: LoopStatusServiceConstructor;
  };
  if (typeof target.LoopStatusService !== 'function') {
    throw new Error(
      'T028 RED: loop-status.service.ts must export LoopStatusService.',
    );
  }
  return target.LoopStatusService;
};

const STARTED_AT = new Date('2026-08-16T03:00:00.000Z');

const run = (overrides: Partial<SearchLoopRun> = {}): SearchLoopRun => ({
  id: randomUUID(),
  status: LoopStatus.RUNNING,
  generatorType: StrategyGeneratorType.RANDOM,
  iteration: 2,
  testedCandidates: 1,
  maxCandidates: 5,
  maxDurationMs: null,
  stopOnNoImprovementIterations: 50,
  currentCandidateStrategyVersionId: randomUUID(),
  bestStrategyVersionId: randomUUID(),
  bestScore: 0.5,
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
  iteration: 2,
  score: null,
  status: SearchLoopCandidateStatus.BACKTESTING,
  createdAt: STARTED_AT,
  updatedAt: STARTED_AT,
  ...overrides,
});

interface StatusHarness {
  repository: LoopRepositoryPort;
  jobQueue: jest.Mocked<IJobQueue>;
  runs: Map<string, SearchLoopRun>;
  candidates: Map<string, SearchLoopCandidate[]>;
  transitionMock: jest.MockedFunction<LoopRepositoryPort['transitionRun']>;
}

const createStatusHarness = (
  initialRuns: SearchLoopRun[] = [],
): StatusHarness => {
  const runs = new Map(initialRuns.map((value) => [value.id, { ...value }]));
  const candidates = new Map<string, SearchLoopCandidate[]>();

  const findActiveRun = jest.fn(
    async () =>
      [...runs.values()].find(
        ({ status }) =>
          status === LoopStatus.RUNNING || status === LoopStatus.PAUSED,
      ) ?? null,
  );
  const findRunById = jest.fn(
    async (loopRunId: string) => runs.get(loopRunId) ?? null,
  );
  const getRunDetail = jest.fn(async (loopRunId: string) => {
    const found = runs.get(loopRunId);
    return found
      ? { run: found, candidates: candidates.get(loopRunId) ?? [] }
      : null;
  });
  const findInFlightCandidate = jest.fn(
    async (loopRunId: string) =>
      (candidates.get(loopRunId) ?? []).find(
        ({ status }) => status === SearchLoopCandidateStatus.BACKTESTING,
      ) ?? null,
  );
  const transitionMock = jest.fn<LoopRepositoryPort['transitionRun']>(
    async (loopRunId, expected, update) => {
      const current = runs.get(loopRunId);
      if (!current || !expected.includes(current.status)) return null;
      const changed = { ...current, ...update };
      runs.set(loopRunId, changed);
      return changed;
    },
  );

  const repository: LoopRepositoryPort = {
    findActiveRun,
    findRunById,
    getRunDetail,
    findInFlightCandidate,
    transitionRun: transitionMock,
  };

  const jobQueue: jest.Mocked<IJobQueue> = {
    enqueue: jest.fn<IJobQueue['enqueue']>(),
    getStatus: jest.fn<IJobQueue['getStatus']>(),
    retry: jest.fn<IJobQueue['retry']>(),
    deadLetter: jest.fn<IJobQueue['deadLetter']>(),
    getStats: jest.fn<IJobQueue['getStats']>(),
  };

  return { repository, jobQueue, runs, candidates, transitionMock };
};

const expectRejectedCode = async (
  operation: Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation;
  } catch (error: unknown) {
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected operation to reject with code ${code}`);
};

describe('LoopStatusService contract (T028)', () => {
  it('has the production LoopStatusService target required by T030', () => {
    if (!TARGET_EXISTS) {
      throw new Error(
        'T028 RED: LoopStatusService is intentionally not implemented. ' +
          'T030 must add src/loop/loop-status.service.ts; this is not an import-path or fixture failure.',
      );
    }
    expect(loadTarget()).toBeDefined();
  });

  const describeWithTarget = TARGET_EXISTS ? describe : describe.skip;

  describeWithTarget('legal run transitions and restart reconciliation', () => {
    let Service: LoopStatusServiceConstructor;

    beforeEach(() => {
      Service = loadTarget();
    });

    it('pauses RUNNING and records pausedAt without losing progress', async () => {
      const active = run();
      const harness = createStatusHarness([active]);
      const service = new Service(harness.repository, harness.jobQueue);

      const paused = await service.pause(active.id);

      expect(paused).toMatchObject({
        id: active.id,
        status: LoopStatus.PAUSED,
        iteration: active.iteration,
        testedCandidates: active.testedCandidates,
        bestScore: active.bestScore,
      });
      expect(paused.pausedAt).toBeInstanceOf(Date);
      expect(paused.stoppedAt).toBeNull();
    });

    it('resumes PAUSED with the same identity, counters and best result', async () => {
      const paused = run({
        status: LoopStatus.PAUSED,
        pausedAt: new Date('2026-08-16T03:01:00.000Z'),
      });
      const harness = createStatusHarness([paused]);
      const service = new Service(harness.repository, harness.jobQueue);

      await expect(service.resume(paused.id)).resolves.toMatchObject({
        id: paused.id,
        status: LoopStatus.RUNNING,
        iteration: paused.iteration,
        testedCandidates: paused.testedCandidates,
        bestStrategyVersionId: paused.bestStrategyVersionId,
        bestScore: paused.bestScore,
        pausedAt: null,
      });
    });

    it.each([LoopStatus.RUNNING, LoopStatus.PAUSED])(
      'stops %s as STOPPED_BY_USER with deterministic reason',
      async (status) => {
        const active = run({ status });
        const harness = createStatusHarness([active]);
        const service = new Service(harness.repository, harness.jobQueue);

        const stopped = await service.stop(active.id);

        expect(stopped).toMatchObject({
          status: LoopStatus.STOPPED_BY_USER,
          stopReason: 'user_requested',
        });
        expect(stopped.stoppedAt).toBeInstanceOf(Date);
      },
    );

    it('completes only a RUNNING run and preserves the supplied bound reason', async () => {
      const active = run();
      const harness = createStatusHarness([active]);
      const service = new Service(harness.repository, harness.jobQueue);

      await expect(
        service.complete(active.id, 'max_candidates_reached'),
      ).resolves.toMatchObject({
        status: LoopStatus.COMPLETED,
        stopReason: 'max_candidates_reached',
        stoppedAt: expect.any(Date),
      });
    });

    it.each([LoopStatus.RUNNING, LoopStatus.PAUSED])(
      'fails %s with the supplied deterministic reason',
      async (status) => {
        const active = run({ status });
        const harness = createStatusHarness([active]);
        const service = new Service(harness.repository, harness.jobQueue);

        await expect(
          service.fail(active.id, 'generator_error'),
        ).resolves.toMatchObject({
          status: LoopStatus.FAILED,
          stopReason: 'generator_error',
          stoppedAt: expect.any(Date),
        });
      },
    );

    it.each([
      ['pause', LoopStatus.PAUSED],
      ['pause', LoopStatus.COMPLETED],
      ['pause', LoopStatus.STOPPED_BY_USER],
      ['pause', LoopStatus.FAILED],
      ['resume', LoopStatus.RUNNING],
      ['resume', LoopStatus.COMPLETED],
      ['resume', LoopStatus.STOPPED_BY_USER],
      ['resume', LoopStatus.FAILED],
      ['stop', LoopStatus.COMPLETED],
      ['stop', LoopStatus.STOPPED_BY_USER],
      ['stop', LoopStatus.FAILED],
      ['complete', LoopStatus.PAUSED],
      ['complete', LoopStatus.COMPLETED],
      ['complete', LoopStatus.STOPPED_BY_USER],
      ['complete', LoopStatus.FAILED],
      ['fail', LoopStatus.COMPLETED],
      ['fail', LoopStatus.STOPPED_BY_USER],
      ['fail', LoopStatus.FAILED],
    ] as const)(
      'rejects %s from %s without mutating the run',
      async (operation, status) => {
        const current = run({ status });
        const harness = createStatusHarness([current]);
        const service = new Service(harness.repository, harness.jobQueue);

        const action =
          operation === 'pause'
            ? service.pause(current.id)
            : operation === 'resume'
              ? service.resume(current.id)
              : operation === 'stop'
                ? service.stop(current.id)
                : operation === 'complete'
                  ? service.complete(current.id, 'max_candidates_reached')
                  : service.fail(current.id, 'generator_error');

        await expectRejectedCode(action, 'INVALID_LOOP_TRANSITION');
        expect(harness.runs.get(current.id)).toEqual(current);
      },
    );

    it('returns LOOP_NOT_FOUND without invoking a transition', async () => {
      const harness = createStatusHarness();
      const service = new Service(harness.repository, harness.jobQueue);

      await expectRejectedCode(service.pause(randomUUID()), 'LOOP_NOT_FOUND');
      expect(harness.transitionMock).not.toHaveBeenCalled();
    });

    it('returns current active state and ordered detail through repository reads', async () => {
      const active = run();
      const harness = createStatusHarness([active]);
      const first = candidate(active.id, { iteration: 1 });
      const second = candidate(active.id, { iteration: 2 });
      harness.candidates.set(active.id, [first, second]);
      const service = new Service(harness.repository, harness.jobQueue);

      await expect(service.getCurrent()).resolves.toEqual(active);
      await expect(service.getDetail(active.id)).resolves.toEqual({
        run: active,
        candidates: [first, second],
      });
    });

    it.each([JobStatusValue.QUEUED, JobStatusValue.PROCESSING])(
      'keeps a run recoverable when its matching job is %s',
      async (status) => {
        const active = run();
        const inFlight = candidate(active.id);
        const harness = createStatusHarness([active]);
        harness.candidates.set(active.id, [inFlight]);
        harness.jobQueue.getStatus.mockResolvedValue({
          jobId: inFlight.jobId,
          status,
          attempt: 1,
          lastError: null,
          updatedAt: STARTED_AT,
        });
        const service = new Service(harness.repository, harness.jobQueue);

        await expect(service.reconcileAfterRestart()).resolves.toEqual(active);
        expect(harness.jobQueue.getStatus).toHaveBeenCalledWith(inFlight.jobId);
        expect(harness.transitionMock).not.toHaveBeenCalled();
      },
    );

    it('marks an active run orphaned when no in-flight candidate exists', async () => {
      const active = run();
      const harness = createStatusHarness([active]);
      const service = new Service(harness.repository, harness.jobQueue);

      await expect(service.reconcileAfterRestart()).resolves.toMatchObject({
        status: LoopStatus.FAILED,
        stopReason: 'orphaned_after_restart',
        stoppedAt: expect.any(Date),
      });
      expect(harness.jobQueue.getStatus).not.toHaveBeenCalled();
    });

    it('marks an active run orphaned only when queue returns JOB_NOT_FOUND', async () => {
      const active = run();
      const inFlight = candidate(active.id);
      const harness = createStatusHarness([active]);
      harness.candidates.set(active.id, [inFlight]);
      harness.jobQueue.getStatus.mockRejectedValue(
        Object.assign(new Error('Job not found'), { code: 'JOB_NOT_FOUND' }),
      );
      const service = new Service(harness.repository, harness.jobQueue);

      await expect(service.reconcileAfterRestart()).resolves.toMatchObject({
        status: LoopStatus.FAILED,
        stopReason: 'orphaned_after_restart',
      });
      expect(harness.transitionMock).toHaveBeenCalledTimes(1);
    });

    it('propagates QUEUE_UNAVAILABLE and preserves active state for later reconciliation', async () => {
      const active = run();
      const inFlight = candidate(active.id);
      const harness = createStatusHarness([active]);
      harness.candidates.set(active.id, [inFlight]);
      const unavailable = Object.assign(new Error('Queue unavailable'), {
        code: 'QUEUE_UNAVAILABLE',
      });
      harness.jobQueue.getStatus.mockRejectedValue(unavailable);
      const service = new Service(harness.repository, harness.jobQueue);

      await expect(service.reconcileAfterRestart()).rejects.toBe(unavailable);
      expect(harness.runs.get(active.id)).toEqual(active);
      expect(harness.transitionMock).not.toHaveBeenCalled();
    });

    it('does nothing when no active run exists', async () => {
      const harness = createStatusHarness();
      const service = new Service(harness.repository, harness.jobQueue);

      await expect(service.reconcileAfterRestart()).resolves.toBeNull();
      expect(harness.jobQueue.getStatus).not.toHaveBeenCalled();
      expect(harness.transitionMock).not.toHaveBeenCalled();
    });
  });
});
