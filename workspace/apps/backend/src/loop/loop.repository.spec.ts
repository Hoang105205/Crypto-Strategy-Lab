import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  Prisma,
  type SearchLoopCandidate as PrismaCandidate,
  type SearchLoopRun as PrismaRun,
} from '@prisma/client';
import {
  LoopStatus,
  SearchLoopCandidateStatus,
  StrategyGeneratorType,
  type SearchLoopCandidate,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';
import type { PrismaService } from '../database/prisma.service';

const TARGET_FILE = join(__dirname, 'loop.repository.ts');
const TARGET_MODULE = join(__dirname, 'loop.repository');
const TARGET_EXISTS = existsSync(TARGET_FILE);

interface CreateLoopRunInput {
  generatorType: StrategyGeneratorType;
  maxCandidates: number | null;
  maxDurationMs: number | null;
  stopOnNoImprovementIterations: number;
}

interface CreateLoopCandidateInput {
  loopRunId: string;
  jobId: string;
  strategyVersionId: string;
  iteration: number;
}

interface CompletedCandidateInput {
  loopRunId: string;
  jobId: string;
  backtestResultId: string;
  score: number;
}

interface FailedCandidateInput {
  loopRunId: string;
  jobId: string;
}

interface TerminalCandidateResult {
  applied: boolean;
  run: SearchLoopRun;
  candidate: SearchLoopCandidate;
}

interface LoopRunDetail {
  run: SearchLoopRun;
  candidates: SearchLoopCandidate[];
}

interface LoopRepositoryApi {
  createRun(input: CreateLoopRunInput): Promise<SearchLoopRun>;
  findActiveRun(): Promise<SearchLoopRun | null>;
  findRunById(loopRunId: string): Promise<SearchLoopRun | null>;
  getRunDetail(loopRunId: string): Promise<LoopRunDetail | null>;
  createCandidate(
    input: CreateLoopCandidateInput,
  ): Promise<{ candidate: SearchLoopCandidate; created: boolean }>;
  findInFlightCandidate(loopRunId: string): Promise<SearchLoopCandidate | null>;
  recordCandidateCompleted(
    input: CompletedCandidateInput,
  ): Promise<TerminalCandidateResult>;
  recordCandidateFailed(
    input: FailedCandidateInput,
  ): Promise<TerminalCandidateResult>;
}

type LoopRepositoryConstructor = new (
  prisma: PrismaService,
) => LoopRepositoryApi;

const loadTarget = (): LoopRepositoryConstructor => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const target = require(TARGET_MODULE) as {
    LoopRepository?: LoopRepositoryConstructor;
  };
  if (typeof target.LoopRepository !== 'function') {
    throw new Error('T028 RED: loop.repository.ts must export LoopRepository.');
  }
  return target.LoopRepository;
};

const STARTED_AT = new Date('2026-08-16T02:00:00.000Z');
const UPDATED_AT = new Date('2026-08-16T02:01:00.000Z');

const createRunInput = (
  overrides: Partial<CreateLoopRunInput> = {},
): CreateLoopRunInput => ({
  generatorType: StrategyGeneratorType.RANDOM,
  maxCandidates: 5,
  maxDurationMs: null,
  stopOnNoImprovementIterations: 50,
  ...overrides,
});

const runRow = (overrides: Partial<PrismaRun> = {}): PrismaRun => ({
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
  startedAt: STARTED_AT,
  pausedAt: null,
  stoppedAt: null,
  ...overrides,
});

const candidateRow = (
  loopRunId: string,
  overrides: Partial<PrismaCandidate> = {},
): PrismaCandidate => ({
  id: randomUUID(),
  loopRunId,
  jobId: randomUUID(),
  strategyVersionId: randomUUID(),
  backtestResultId: null,
  iteration: 1,
  score: null,
  status: SearchLoopCandidateStatus.BACKTESTING,
  createdAt: STARTED_AT,
  updatedAt: UPDATED_AT,
  ...overrides,
});

const mapRun = (row: PrismaRun): SearchLoopRun => ({
  ...row,
  status: row.status as LoopStatus,
  generatorType: row.generatorType as StrategyGeneratorType,
});

const mapCandidate = (row: PrismaCandidate): SearchLoopCandidate => ({
  ...row,
  status: row.status as SearchLoopCandidateStatus,
});

const knownUniqueError = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
    meta: { target: ['jobId'] },
  });

interface PrismaHarness {
  prisma: jest.Mocked<PrismaService>;
  runs: PrismaRun[];
  candidates: PrismaCandidate[];
  transactionMock: jest.Mock;
  forbiddenAccesses: PropertyKey[];
}

const createPrismaHarness = (): PrismaHarness => {
  const runs: PrismaRun[] = [];
  const candidates: PrismaCandidate[] = [];
  const forbiddenAccesses: PropertyKey[] = [];

  const activeStatuses = new Set<string>([
    LoopStatus.RUNNING,
    LoopStatus.PAUSED,
  ]);

  const runDelegate = {
    findFirst: jest.fn(async (args?: Record<string, unknown>) => {
      const statuses = extractStatuses(args);
      const found = runs.find((run) =>
        statuses.length > 0
          ? statuses.includes(run.status)
          : activeStatuses.has(run.status),
      );
      // Capture the read before yielding so an implementation without the
      // application mutex exposes the classic check-then-create race.
      await Promise.resolve();
      return found ? { ...found } : null;
    }),
    findUnique: jest.fn(async (args: { where: { id: string } }) => {
      const found = runs.find((run) => run.id === args.where.id);
      return found ? { ...found } : null;
    }),
    create: jest.fn(async (args: { data: Record<string, unknown> }) => {
      const created = runRow({
        ...(args.data as Partial<PrismaRun>),
        id: (args.data.id as string | undefined) ?? randomUUID(),
        startedAt:
          (args.data.startedAt as Date | undefined) ?? new Date(STARTED_AT),
      });
      runs.push(created);
      return { ...created };
    }),
    update: jest.fn(
      async (args: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const index = runs.findIndex((run) => run.id === args.where.id);
        if (index < 0) throw new Error('Run not found');
        runs[index] = applyUpdate(runs[index], args.data);
        return { ...runs[index] };
      },
    ),
    updateMany: jest.fn(
      async (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const matches = runs
          .map((run, index) => ({ run, index }))
          .filter(({ run }) => matchesWhere(run, args.where));
        for (const { index } of matches) {
          runs[index] = applyUpdate(runs[index], args.data);
        }
        return { count: matches.length };
      },
    ),
  };

  const candidateDelegate = {
    create: jest.fn(async (args: { data: Record<string, unknown> }) => {
      const jobId = args.data.jobId as string;
      if (candidates.some((candidate) => candidate.jobId === jobId)) {
        throw knownUniqueError();
      }
      await Promise.resolve();
      if (candidates.some((candidate) => candidate.jobId === jobId)) {
        throw knownUniqueError();
      }
      const created = candidateRow(args.data.loopRunId as string, {
        ...(args.data as Partial<PrismaCandidate>),
        id: (args.data.id as string | undefined) ?? randomUUID(),
      });
      candidates.push(created);
      return { ...created };
    }),
    findUnique: jest.fn(
      async (args: { where: { jobId?: string; id?: string } }) => {
        const found = candidates.find(
          (candidate) =>
            (args.where.jobId !== undefined &&
              candidate.jobId === args.where.jobId) ||
            (args.where.id !== undefined && candidate.id === args.where.id),
        );
        return found ? { ...found } : null;
      },
    ),
    findFirst: jest.fn(async (args: { where: Record<string, unknown> }) => {
      const found = candidates.find((candidate) =>
        matchesWhere(candidate, args.where),
      );
      return found ? { ...found } : null;
    }),
    findMany: jest.fn(
      async (args?: {
        where?: Record<string, unknown>;
        orderBy?: Record<string, 'asc' | 'desc'>;
      }) => {
        const filtered = candidates.filter((candidate) =>
          args?.where ? matchesWhere(candidate, args.where) : true,
        );
        if (args?.orderBy?.iteration) {
          const direction = args.orderBy.iteration === 'asc' ? 1 : -1;
          return [...filtered].sort(
            (left, right) =>
              direction * (left.iteration - right.iteration) ||
              left.id.localeCompare(right.id),
          );
        }
        return filtered.map((candidate) => ({ ...candidate }));
      },
    ),
    update: jest.fn(
      async (args: {
        where: { id?: string; jobId?: string };
        data: Record<string, unknown>;
      }) => {
        const index = candidates.findIndex(
          (candidate) =>
            (args.where.id !== undefined && candidate.id === args.where.id) ||
            (args.where.jobId !== undefined &&
              candidate.jobId === args.where.jobId),
        );
        if (index < 0) throw new Error('Candidate not found');
        candidates[index] = applyUpdate(candidates[index], args.data);
        return { ...candidates[index] };
      },
    ),
    updateMany: jest.fn(
      async (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const matches = candidates
          .map((candidate, index) => ({ candidate, index }))
          .filter(({ candidate }) => matchesWhere(candidate, args.where));
        for (const { index } of matches) {
          candidates[index] = applyUpdate(candidates[index], args.data);
        }
        return { count: matches.length };
      },
    ),
  };

  let prisma!: jest.Mocked<PrismaService>;
  const transactionMock = jest.fn(async (operation: unknown) => {
    if (typeof operation !== 'function') {
      throw new Error('T028 fixture requires an interactive transaction');
    }
    return (operation as (client: PrismaService) => Promise<unknown>)(prisma);
  });

  const allowed: Record<PropertyKey, unknown> = {
    searchLoopRun: runDelegate,
    searchLoopCandidate: candidateDelegate,
    $transaction: transactionMock,
  };
  prisma = new Proxy(allowed, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) {
        return Reflect.get(target, property, receiver);
      }
      forbiddenAccesses.push(property);
      throw new Error(
        `Forbidden Prisma model access from LoopRepository: ${String(property)}`,
      );
    },
  }) as unknown as jest.Mocked<PrismaService>;

  return { prisma, runs, candidates, transactionMock, forbiddenAccesses };
};

describe('LoopRepository contract (T028)', () => {
  it('has the production LoopRepository target required by T030', () => {
    if (!TARGET_EXISTS) {
      throw new Error(
        'T028 RED: LoopRepository is intentionally not implemented. ' +
          'T030 must add src/loop/loop.repository.ts; this is not an import-path or fixture failure.',
      );
    }
    expect(loadTarget()).toBeDefined();
  });

  const describeWithTarget = TARGET_EXISTS ? describe : describe.skip;

  describeWithTarget('Event Infrastructure-owned Loop persistence', () => {
    let Repository: LoopRepositoryConstructor;
    let harness: PrismaHarness;
    let repository: LoopRepositoryApi;

    beforeEach(() => {
      Repository = loadTarget();
      harness = createPrismaHarness();
      repository = new Repository(harness.prisma);
    });

    it('creates one active run inside an interactive transaction', async () => {
      const created = await repository.createRun(createRunInput());

      expect(created).toMatchObject({
        status: LoopStatus.RUNNING,
        iteration: 0,
        testedCandidates: 0,
        stopOnNoImprovementIterations: 50,
      });
      expect(harness.runs).toHaveLength(1);
      expect(harness.transactionMock).toHaveBeenCalledTimes(1);
    });

    it.each([LoopStatus.RUNNING, LoopStatus.PAUSED])(
      'rejects a second run while an existing run is %s',
      async (status) => {
        const active = runRow({ status });
        harness.runs.push(active);

        await expect(
          repository.createRun(createRunInput()),
        ).rejects.toMatchObject({
          code: 'LOOP_ALREADY_ACTIVE',
          loopRunId: active.id,
        });
        expect(harness.runs).toHaveLength(1);
      },
    );

    it('serializes concurrent starts so exactly one run wins', async () => {
      const outcomes = await Promise.allSettled([
        repository.createRun(createRunInput()),
        repository.createRun(
          createRunInput({
            generatorType: StrategyGeneratorType.DOMAIN_GUIDED,
          }),
        ),
      ]);

      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.filter(({ status }) => status === 'rejected'),
      ).toHaveLength(1);
      expect(harness.runs).toHaveLength(1);
      const rejected = outcomes.find(
        (outcome): outcome is PromiseRejectedResult =>
          outcome.status === 'rejected',
      );
      expect(rejected?.reason).toMatchObject({ code: 'LOOP_ALREADY_ACTIVE' });
    });

    it('allows a new run after the prior run becomes terminal', async () => {
      harness.runs.push(runRow({ status: LoopStatus.COMPLETED }));

      await expect(
        repository.createRun(createRunInput()),
      ).resolves.toMatchObject({
        status: LoopStatus.RUNNING,
      });
      expect(harness.runs).toHaveLength(2);
    });

    it('creates one BACKTESTING candidate and treats duplicate jobId as idempotent', async () => {
      const run = runRow();
      harness.runs.push(run);
      const input: CreateLoopCandidateInput = {
        loopRunId: run.id,
        jobId: randomUUID(),
        strategyVersionId: randomUUID(),
        iteration: 1,
      };

      const first = await repository.createCandidate(input);
      const duplicate = await repository.createCandidate(input);

      expect(first).toMatchObject({
        created: true,
        candidate: {
          ...input,
          status: SearchLoopCandidateStatus.BACKTESTING,
        },
      });
      expect(duplicate).toEqual({
        candidate: first.candidate,
        created: false,
      });
      expect(harness.candidates).toHaveLength(1);
    });

    it('lets exactly one concurrent candidate insert win for a jobId', async () => {
      const run = runRow();
      harness.runs.push(run);
      const input: CreateLoopCandidateInput = {
        loopRunId: run.id,
        jobId: randomUUID(),
        strategyVersionId: randomUUID(),
        iteration: 1,
      };

      const outcomes = await Promise.all([
        repository.createCandidate(input),
        repository.createCandidate(input),
      ]);

      expect(outcomes.filter(({ created }) => created)).toHaveLength(1);
      expect(outcomes.filter(({ created }) => !created)).toHaveLength(1);
      expect(harness.candidates).toHaveLength(1);
    });

    it('returns candidates in stable ascending iteration order', async () => {
      const run = runRow();
      harness.runs.push(run);
      harness.candidates.push(
        candidateRow(run.id, { iteration: 3 }),
        candidateRow(run.id, { iteration: 1 }),
        candidateRow(run.id, { iteration: 2 }),
      );

      const detail = await repository.getRunDetail(run.id);

      expect(detail?.candidates.map(({ iteration }) => iteration)).toEqual([
        1, 2, 3,
      ]);
    });

    it('records completion and increments testedCandidates exactly once', async () => {
      const run = runRow();
      const candidate = candidateRow(run.id);
      harness.runs.push(run);
      harness.candidates.push(candidate);
      const input: CompletedCandidateInput = {
        loopRunId: run.id,
        jobId: candidate.jobId,
        backtestResultId: randomUUID(),
        score: 0.61,
      };

      const first = await repository.recordCandidateCompleted(input);
      const duplicate = await repository.recordCandidateCompleted(input);

      expect(first).toMatchObject({
        applied: true,
        run: { testedCandidates: 1 },
        candidate: {
          status: SearchLoopCandidateStatus.EVALUATED,
          backtestResultId: input.backtestResultId,
          score: input.score,
        },
      });
      expect(duplicate).toMatchObject({
        applied: false,
        run: { testedCandidates: 1 },
      });
      expect(harness.runs[0].testedCandidates).toBe(1);
      expect(harness.transactionMock).toHaveBeenCalledTimes(2);
    });

    it('records terminal failure exactly once without assigning result or score', async () => {
      const run = runRow();
      const candidate = candidateRow(run.id);
      harness.runs.push(run);
      harness.candidates.push(candidate);
      const input = { loopRunId: run.id, jobId: candidate.jobId };

      const first = await repository.recordCandidateFailed(input);
      const duplicate = await repository.recordCandidateFailed(input);

      expect(first).toMatchObject({
        applied: true,
        run: { testedCandidates: 1 },
        candidate: {
          status: SearchLoopCandidateStatus.FAILED,
          backtestResultId: null,
          score: null,
        },
      });
      expect(duplicate).toMatchObject({
        applied: false,
        run: { testedCandidates: 1 },
      });
    });

    it.each([
      LoopStatus.PAUSED,
      LoopStatus.STOPPED_BY_USER,
      LoopStatus.COMPLETED,
    ])(
      'persists a late completion while preserving run status %s',
      async (status) => {
        const run = runRow({ status });
        const candidate = candidateRow(run.id);
        harness.runs.push(run);
        harness.candidates.push(candidate);

        const result = await repository.recordCandidateCompleted({
          loopRunId: run.id,
          jobId: candidate.jobId,
          backtestResultId: randomUUID(),
          score: 0.42,
        });

        expect(result).toMatchObject({
          applied: true,
          run: { status, testedCandidates: 1 },
          candidate: { status: SearchLoopCandidateStatus.EVALUATED },
        });
        expect(harness.runs[0].status).toBe(status);
      },
    );

    it('persists a late terminal failure without reopening a stopped run', async () => {
      const run = runRow({
        status: LoopStatus.STOPPED_BY_USER,
        stopReason: 'user_requested',
        stoppedAt: UPDATED_AT,
      });
      const candidate = candidateRow(run.id);
      harness.runs.push(run);
      harness.candidates.push(candidate);

      const result = await repository.recordCandidateFailed({
        loopRunId: run.id,
        jobId: candidate.jobId,
      });

      expect(result).toMatchObject({
        applied: true,
        run: {
          status: LoopStatus.STOPPED_BY_USER,
          stopReason: 'user_requested',
          testedCandidates: 1,
        },
        candidate: { status: SearchLoopCandidateStatus.FAILED },
      });
    });

    it('finds only the current non-terminal candidate for restart reconciliation', async () => {
      const run = runRow();
      harness.runs.push(run);
      harness.candidates.push(
        candidateRow(run.id, {
          iteration: 1,
          status: SearchLoopCandidateStatus.EVALUATED,
        }),
        candidateRow(run.id, {
          iteration: 2,
          status: SearchLoopCandidateStatus.BACKTESTING,
        }),
      );

      await expect(
        repository.findInFlightCandidate(run.id),
      ).resolves.toMatchObject({
        iteration: 2,
        status: SearchLoopCandidateStatus.BACKTESTING,
      });
    });

    it('never accesses Strategy-owned Prisma delegates', async () => {
      const run = runRow();
      harness.runs.push(run);
      harness.candidates.push(candidateRow(run.id));

      await repository.findActiveRun();
      await repository.findRunById(run.id);
      await repository.getRunDetail(run.id);
      await repository.findInFlightCandidate(run.id);

      expect(harness.forbiddenAccesses).toEqual([]);
      expect(Object.hasOwn(harness.prisma, 'strategyVersion')).toBe(false);
      expect(Object.hasOwn(harness.prisma, 'backtestResult')).toBe(false);
    });
  });
});

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
    if (typeof expected === 'object' && expected !== null) {
      if ('in' in expected) {
        return (expected as { in: unknown[] }).in.includes(actual);
      }
      if ('notIn' in expected) {
        return !(expected as { notIn: unknown[] }).notIn.includes(actual);
      }
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
    if (
      typeof update === 'object' &&
      update !== null &&
      'increment' in update
    ) {
      const current = next[key];
      next[key as keyof T] = (Number(current) +
        Number((update as { increment: number }).increment)) as T[keyof T];
    } else {
      next[key as keyof T] = update as T[keyof T];
    }
  }
  return next;
}
