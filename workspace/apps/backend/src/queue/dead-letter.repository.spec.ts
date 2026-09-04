import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '@prisma/client';
import { JobType, type DeadLetterJob } from '@crypto-strategy-lab/shared';
import type { PrismaService } from '../database/prisma.service';

const TARGET_FILE = join(__dirname, 'dead-letter.repository.ts');
const TARGET_MODULE = join(__dirname, 'dead-letter.repository');
const TARGET_EXISTS = existsSync(TARGET_FILE);

type DeadLetterMirrorInput = Omit<DeadLetterJob, 'id' | 'resolvedAt'>;
type DeadLetterRepositoryApi = {
  mirror(
    input: DeadLetterMirrorInput,
  ): Promise<{ job: DeadLetterJob; created: boolean }>;
  list(): Promise<DeadLetterJob[]>;
  findUnresolved(jobId: string): Promise<DeadLetterJob | null>;
  resolveAndRequeue(jobId: string, requeue: () => Promise<void>): Promise<void>;
};
type DeadLetterRepositoryConstructor = new (
  prisma: PrismaService,
) => DeadLetterRepositoryApi;

const loadTarget = (): DeadLetterRepositoryConstructor => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const target = require(TARGET_MODULE) as {
    DeadLetterRepository?: DeadLetterRepositoryConstructor;
  };
  if (typeof target.DeadLetterRepository !== 'function') {
    throw new Error(
      'T013 RED: dead-letter.repository.ts must export DeadLetterRepository.',
    );
  }
  return target.DeadLetterRepository;
};

const JOB_ID = 'b8257d6b-d9df-47fb-83c1-839b04335e6f';
const DEAD_LETTERED_AT = new Date('2026-08-15T03:00:00.000Z');

const mirrorInput = (
  overrides: Partial<DeadLetterMirrorInput> = {},
): DeadLetterMirrorInput => ({
  jobId: JOB_ID,
  jobType: JobType.BACKTEST,
  payload: {
    jobId: JOB_ID,
    strategyVersionId: '69e1c401-810a-431f-b2d8-d9f732e7f829',
  },
  attempts: 3,
  lastError: 'terminal adapter-spec failure',
  deadLetteredAt: DEAD_LETTERED_AT,
  ...overrides,
});

const record = (overrides: Partial<DeadLetterJob> = {}): DeadLetterJob => ({
  id: randomUUID(),
  ...mirrorInput(),
  resolvedAt: null,
  ...overrides,
});

const knownUniqueError = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
    meta: { target: ['jobId'] },
  });

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

describe('DeadLetterRepository contract (T013)', () => {
  it('has the production DeadLetterRepository target required by T017', () => {
    if (!TARGET_EXISTS) {
      throw new Error(
        'T013 RED: DeadLetterRepository is not implemented yet. ' +
          'T017 must add src/queue/dead-letter.repository.ts; this is not an import-path failure.',
      );
    }
    expect(loadTarget()).toBeDefined();
  });

  const describeWithTarget = TARGET_EXISTS ? describe : describe.skip;

  describeWithTarget('Event Infrastructure-owned Prisma persistence', () => {
    let Repository: DeadLetterRepositoryConstructor;
    let prisma: jest.Mocked<PrismaService>;
    let createMock: jest.MockedFunction<
      (args: unknown) => Promise<DeadLetterJob>
    >;
    let findUniqueMock: jest.MockedFunction<
      (args: unknown) => Promise<DeadLetterJob | null>
    >;
    let findManyMock: jest.MockedFunction<
      (args: unknown) => Promise<DeadLetterJob[]>
    >;
    let updateManyMock: jest.MockedFunction<
      (args: {
        where?: Record<string, unknown>;
        data: { resolvedAt?: Date | null };
      }) => Promise<{ count: number }>
    >;
    let transactionMock: jest.MockedFunction<
      (operation: unknown) => Promise<unknown>
    >;

    const executeTransaction = <T>(operation: unknown): Promise<T> => {
      if (typeof operation !== 'function') {
        throw new Error('T013 fixture expects an interactive transaction');
      }
      return (operation as (client: PrismaService) => Promise<T>)(prisma);
    };

    beforeEach(() => {
      Repository = loadTarget();
      createMock = jest.fn<(args: unknown) => Promise<DeadLetterJob>>();
      findUniqueMock =
        jest.fn<(args: unknown) => Promise<DeadLetterJob | null>>();
      findManyMock = jest.fn<(args: unknown) => Promise<DeadLetterJob[]>>();
      updateManyMock =
        jest.fn<
          (args: {
            where?: Record<string, unknown>;
            data: { resolvedAt?: Date | null };
          }) => Promise<{ count: number }>
        >();
      transactionMock = jest.fn<(operation: unknown) => Promise<unknown>>();
      prisma = {
        deadLetterJob: {
          create: createMock,
          findUnique: findUniqueMock,
          findMany: findManyMock,
          updateMany: updateManyMock,
        },
        $transaction: transactionMock,
      } as unknown as jest.Mocked<PrismaService>;
    });

    it('mirrors one durable row per jobId and treats Prisma uniqueness as idempotent replay', async () => {
      const stored = record();
      createMock
        .mockResolvedValueOnce(stored)
        .mockRejectedValueOnce(knownUniqueError());
      findUniqueMock.mockResolvedValue(stored);
      const repository = new Repository(prisma);

      await expect(repository.mirror(mirrorInput())).resolves.toEqual({
        job: stored,
        created: true,
      });
      await expect(repository.mirror(mirrorInput())).resolves.toEqual({
        job: stored,
        created: false,
      });

      expect(createMock).toHaveBeenCalledTimes(2);
      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { jobId: JOB_ID },
      });
      expect(Object.hasOwn(prisma, 'strategyVersion')).toBe(false);
      expect(Object.hasOwn(prisma, 'backtestResult')).toBe(false);
    });

    it('preserves terminal audit fields while sanitizing secrets in lastError', async () => {
      const input = mirrorInput({
        lastError:
          'Redis redis://worker:secret@redis.internal:6379 failed\npassword=hunter2',
      });
      createMock.mockResolvedValue(record({
        lastError:
          'Redis redis://[REDACTED]@redis.internal:6379 failed password=[REDACTED]',
      }));
      const repository = new Repository(prisma);

      await repository.mirror(input);

      expect(createMock).toHaveBeenCalledWith({
        data: {
          jobId: input.jobId,
          jobType: input.jobType,
          payload: input.payload,
          attempts: input.attempts,
          lastError:
            'Redis redis://[REDACTED]@redis.internal:6379 failed password=[REDACTED]',
          deadLetteredAt: input.deadLetteredAt,
        },
      });
    });

    it('rejects a duplicate jobId that belongs to a different original payload', async () => {
      createMock.mockRejectedValue(knownUniqueError());
      findUniqueMock.mockResolvedValue(record());
      const repository = new Repository(prisma);

      await expectRejectedCode(
        repository.mirror(
          mirrorInput({
            payload: { jobId: JOB_ID, strategyVersionId: randomUUID() },
          }),
        ),
        'JOB_CONFLICT',
      );
    });

    it('lists the durable audit mirror newest-first', async () => {
      const newest = record({
        deadLetteredAt: new Date('2026-08-15T03:00:00.000Z'),
      });
      const oldest = record({
        jobId: randomUUID(),
        deadLetteredAt: new Date('2026-08-15T01:00:00.000Z'),
      });
      findManyMock.mockResolvedValue([newest, oldest]);
      const repository = new Repository(prisma);

      await expect(repository.list()).resolves.toEqual([newest, oldest]);
      expect(findManyMock).toHaveBeenCalledWith({
        orderBy: { deadLetteredAt: 'desc' },
      });
    });

    it('allows only one concurrent unresolved-to-requeued transition', async () => {
      const stored = record();
      let claimed = false;
      findUniqueMock.mockResolvedValue(stored);
      updateManyMock.mockImplementation(() => {
        if (claimed) {
          return Promise.resolve({ count: 0 });
        }
        claimed = true;
        return Promise.resolve({ count: 1 });
      });
      transactionMock.mockImplementation((operation) =>
        executeTransaction(operation),
      );
      const repository = new Repository(prisma);
      const requeue = jest.fn<() => Promise<void>>().mockResolvedValue();

      const outcomes = await Promise.allSettled([
        repository.resolveAndRequeue(JOB_ID, requeue),
        repository.resolveAndRequeue(JOB_ID, requeue),
      ]);

      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.filter(({ status }) => status === 'rejected'),
      ).toHaveLength(1);
      expect(requeue).toHaveBeenCalledTimes(1);
      const rejected = outcomes.find(({ status }) => status === 'rejected');
      expect(rejected).toMatchObject({
        status: 'rejected',
        reason: { code: 'JOB_ALREADY_RESOLVED' },
      });
    });

    it('rolls back the resolution claim when Redis requeue is not accepted', async () => {
      const stored = record();
      let resolvedAt: Date | null = null;
      findUniqueMock.mockImplementation(() =>
        Promise.resolve(resolvedAt === null ? stored : null),
      );
      updateManyMock.mockImplementation(({ data }) => {
        resolvedAt = data.resolvedAt ?? null;
        return Promise.resolve({ count: 1 });
      });
      transactionMock.mockImplementation(async (operation) => {
        const snapshot = resolvedAt;
        try {
          return await executeTransaction(operation);
        } catch (error: unknown) {
          resolvedAt = snapshot;
          throw error;
        }
      });
      const repository = new Repository(prisma);
      const requeue = jest
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error('Redis unavailable'));

      await expectRejectedCode(
        repository.resolveAndRequeue(JOB_ID, requeue),
        'QUEUE_UNAVAILABLE',
      );
      expect(resolvedAt).toBeNull();
      await expect(repository.findUnresolved(JOB_ID)).resolves.toEqual(stored);
    });

    it('returns stable JOB_NOT_FOUND for an unknown audit record', async () => {
      findUniqueMock.mockResolvedValue(null);
      transactionMock.mockImplementation((operation) =>
        executeTransaction(operation),
      );
      const repository = new Repository(prisma);

      await expectRejectedCode(
        repository.resolveAndRequeue(randomUUID(), () => Promise.resolve()),
        'JOB_NOT_FOUND',
      );
    });
  });
});
