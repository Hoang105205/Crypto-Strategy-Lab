import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma, type LeaderboardEntry } from '@prisma/client';
import {
  RankingCriterion,
  type LeaderboardEntryPayload,
  type NormalizedRate,
} from '@crypto-strategy-lab/shared';
import type { PrismaService } from '../database/prisma.service';

const TARGET_FILE = join(__dirname, 'leaderboard.repository.ts');
const TARGET_MODULE = join(__dirname, 'leaderboard.repository');
const TARGET_EXISTS = existsSync(TARGET_FILE);

interface LeaderboardCreateInput {
  userId: string | null;
  strategyVersionId: string;
  strategyName: string;
  strategyType: string;
  isComposite: boolean;
  backtestResultId: string;
  score: number;
  totalReturn: number;
  winRate: NormalizedRate;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  executedAt: Date;
}

interface LeaderboardRepositoryApi {
  create(
    input: LeaderboardCreateInput,
  ): Promise<LeaderboardEntryPayload | null>;
  findByBacktestResultId(
    backtestResultId: string,
  ): Promise<LeaderboardEntryPayload | null>;
  getTopK(
    criterion: RankingCriterion,
    viewerUserId?: string | null,
    scope?: LeaderboardScopeValue,
  ): Promise<LeaderboardEntryPayload[]>;
  findBestByStrategyVersionId(
    strategyVersionId: string,
    viewerUserId?: string | null,
    scope?: LeaderboardScopeValue,
  ): Promise<LeaderboardEntryPayload | null>;
  getUpdatedAt(
    viewerUserId?: string | null,
    scope?: LeaderboardScopeValue,
  ): Promise<Date>;
  findSourceReferences(): Promise<
    Array<{
      id: string;
      userId: string | null;
      strategyVersionId: string;
      backtestResultId: string;
    }>
  >;
  deleteByIds(ids: readonly string[]): Promise<number>;
}

type LeaderboardScopeValue = 'system' | 'mine' | 'combined';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

type LeaderboardRepositoryConstructor = new (
  prisma: PrismaService,
  topK?: number,
) => LeaderboardRepositoryApi;

const loadTarget = (): LeaderboardRepositoryConstructor => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const target = require(TARGET_MODULE) as {
    LeaderboardRepository?: LeaderboardRepositoryConstructor;
  };
  if (typeof target.LeaderboardRepository !== 'function') {
    throw new Error(
      'T022 RED: leaderboard.repository.ts must export LeaderboardRepository.',
    );
  }
  return target.LeaderboardRepository;
};

const normalizedRate = (value: number): NormalizedRate =>
  value as NormalizedRate;

const EXECUTED_AT = new Date('2026-08-16T01:00:00.000Z');
const CREATED_AT = new Date('2026-08-16T01:00:01.000Z');
const UPDATED_AT = new Date('2026-08-16T01:00:02.000Z');

describe('Phase 1 shared ownership contract', () => {
  it('requires nullable userId on LeaderboardEntryPayload', () => {
    const infrastructureTypes = readFileSync(
      join(__dirname, '../../../../libs/shared/src/types/infrastructure.ts'),
      'utf8',
    );
    const entryContract = infrastructureTypes.slice(
      infrastructureTypes.indexOf('export interface LeaderboardEntryPayload'),
      infrastructureTypes.indexOf('export interface SearchLoopConfig'),
    );

    expect(entryContract).toMatch(/^\s*userId: string \| null;/m);

    const entry = {
      rank: 1,
      userId: null,
      strategyVersionId: randomUUID(),
      strategyName: 'System strategy',
      strategyType: 'MA',
      isComposite: false,
      backtestResultId: randomUUID(),
      score: 0.5,
      totalReturn: 20,
      winRate: normalizedRate(0.7),
      maxDrawdown: -10,
      sharpeRatio: 1.5,
      totalTrades: 12,
    } satisfies LeaderboardEntryPayload;

    expect(entry.userId).toBeNull();
  });
});

const row = (overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  id: randomUUID(),
  rank: 0,
  userId: null,
  strategyVersionId: randomUUID(),
  strategyName: 'Moving Average',
  strategyType: 'MA',
  isComposite: false,
  backtestResultId: randomUUID(),
  score: 0.5,
  totalReturn: 20,
  winRate: 0.7,
  maxDrawdown: -10,
  sharpeRatio: 1.5,
  totalTrades: 12,
  executedAt: EXECUTED_AT,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  ...overrides,
});

const createInput = (
  overrides: Partial<LeaderboardCreateInput> = {},
): LeaderboardCreateInput => ({
  userId: null,
  strategyVersionId: randomUUID(),
  strategyName: 'Moving Average',
  strategyType: 'MA',
  isComposite: false,
  backtestResultId: randomUUID(),
  score: 0.5,
  totalReturn: 20,
  winRate: normalizedRate(0.7),
  maxDrawdown: -10,
  sharpeRatio: 1.5,
  totalTrades: 12,
  executedAt: EXECUTED_AT,
  ...overrides,
});

const payload = (entry: LeaderboardEntry): LeaderboardEntryPayload => ({
  rank: entry.rank,
  userId: entry.userId,
  strategyVersionId: entry.strategyVersionId,
  strategyName: entry.strategyName,
  strategyType: entry.strategyType,
  isComposite: entry.isComposite,
  backtestResultId: entry.backtestResultId,
  score: entry.score,
  totalReturn: entry.totalReturn,
  winRate: normalizedRate(entry.winRate),
  maxDrawdown: entry.maxDrawdown,
  sharpeRatio: entry.sharpeRatio,
  totalTrades: entry.totalTrades,
});

const knownUniqueError = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
    meta: { target: ['backtestResultId'] },
  });

describe('LeaderboardRepository contract (T022)', () => {
  it('has the production LeaderboardRepository target required by T024', () => {
    if (!TARGET_EXISTS) {
      throw new Error(
        'T022 RED: LeaderboardRepository is intentionally not implemented. ' +
          'T024 must add src/leaderboard/leaderboard.repository.ts.',
      );
    }
    expect(loadTarget()).toBeDefined();
  });

  const describeWithTarget = TARGET_EXISTS ? describe : describe.skip;

  describeWithTarget('Event Infrastructure-owned Prisma persistence', () => {
    let Repository: LeaderboardRepositoryConstructor;
    let createMock: jest.MockedFunction<
      (args: { data: Record<string, unknown> }) => Promise<LeaderboardEntry>
    >;
    let findUniqueMock: jest.MockedFunction<
      (args: unknown) => Promise<LeaderboardEntry | null>
    >;
    let findManyMock: jest.MockedFunction<
      (args?: unknown) => Promise<LeaderboardEntry[]>
    >;
    let findFirstMock: jest.MockedFunction<
      (args?: unknown) => Promise<LeaderboardEntry | null>
    >;
    let updateMock: jest.MockedFunction<
      (args: {
        where: { id: string };
        data: { rank: number };
      }) => Promise<LeaderboardEntry>
    >;
    let deleteManyMock: jest.MockedFunction<
      (args: unknown) => Promise<{ count: number }>
    >;
    let transactionMock: jest.MockedFunction<
      (operation: unknown) => Promise<unknown>
    >;
    let forbiddenAccesses: PropertyKey[];
    let prisma: jest.Mocked<PrismaService>;

    beforeEach(() => {
      Repository = loadTarget();
      createMock = jest.fn();
      findUniqueMock = jest.fn();
      findManyMock = jest.fn();
      findFirstMock = jest.fn();
      updateMock = jest.fn();
      deleteManyMock = jest.fn();
      transactionMock = jest.fn((operation: unknown) => {
        if (Array.isArray(operation)) return Promise.all(operation);
        if (typeof operation === 'function') {
          return (operation as (client: PrismaService) => Promise<unknown>)(
            prisma,
          );
        }
        return Promise.reject(new Error('Unsupported transaction fixture'));
      });
      forbiddenAccesses = [];

      const leaderboardEntry = {
        create: createMock,
        findUnique: findUniqueMock,
        findMany: findManyMock,
        findFirst: findFirstMock,
        update: updateMock,
        deleteMany: deleteManyMock,
      };
      const allowed: Record<PropertyKey, unknown> = {
        leaderboardEntry,
        $transaction: transactionMock,
      };
      prisma = new Proxy(allowed, {
        get(target, property, receiver) {
          if (Reflect.has(target, property)) {
            return Reflect.get(target, property, receiver);
          }
          forbiddenAccesses.push(property);
          throw new Error(
            `Forbidden Prisma model access from LeaderboardRepository: ${String(property)}`,
          );
        },
      }) as unknown as jest.Mocked<PrismaService>;
    });

    it('inserts a unique backtestResultId as a rank-zero stored projection', async () => {
      const input = createInput();
      const stored = row({ ...input, rank: 0, winRate: input.winRate });
      createMock.mockResolvedValue(stored);
      const repository = new Repository(prisma);

      await expect(repository.create(input)).resolves.toEqual(payload(stored));
      expect(createMock).toHaveBeenCalledWith({
        data: { rank: 0, ...input },
      });
    });

    it('treats a sequential unique-key collision as an idempotent duplicate', async () => {
      const input = createInput();
      const stored = row({ ...input, winRate: input.winRate });
      createMock
        .mockResolvedValueOnce(stored)
        .mockRejectedValueOnce(knownUniqueError());
      const repository = new Repository(prisma);

      await expect(repository.create(input)).resolves.toEqual(payload(stored));
      await expect(repository.create(input)).resolves.toBeNull();
      expect(createMock).toHaveBeenCalledTimes(2);
    });

    it('lets exactly one concurrent insert win for the same backtestResultId', async () => {
      const input = createInput();
      const stored = row({ ...input, winRate: input.winRate });
      let claimed = false;
      createMock.mockImplementation(async () => {
        await Promise.resolve();
        if (claimed) throw knownUniqueError();
        claimed = true;
        return stored;
      });
      const repository = new Repository(prisma);

      const outcomes = await Promise.all([
        repository.create(input),
        repository.create(input),
      ]);

      expect(outcomes).toEqual(expect.arrayContaining([payload(stored), null]));
      expect(outcomes.filter((outcome) => outcome !== null)).toHaveLength(1);
    });

    it('assigns deterministic read-time ranks with all tie-breaks and identity fallback', async () => {
      const earliest = row({
        id: 'entry-b',
        backtestResultId: 'result-b',
        score: 0.500_039,
        sharpeRatio: 2,
        maxDrawdown: -12,
        executedAt: new Date('2026-08-16T01:00:00.000Z'),
      });
      const identityFirst = row({
        id: 'entry-a',
        backtestResultId: 'result-a',
        score: 0.500_041,
        sharpeRatio: 2,
        maxDrawdown: -12,
        executedAt: new Date('2026-08-16T01:00:00.000Z'),
      });
      const later = row({
        id: 'entry-c',
        backtestResultId: 'result-c',
        score: 0.500_04,
        sharpeRatio: 2,
        maxDrawdown: -12,
        executedAt: new Date('2026-08-16T02:00:00.000Z'),
      });
      const lowerSharpe = row({
        id: 'entry-d',
        backtestResultId: 'result-d',
        score: 0.500_04,
        sharpeRatio: 1,
        maxDrawdown: -5,
      });
      const lowerScore = row({
        id: 'entry-e',
        backtestResultId: 'result-e',
        score: 0.4,
      });
      findManyMock.mockResolvedValue([
        lowerScore,
        later,
        lowerSharpe,
        earliest,
        identityFirst,
      ]);
      const repository = new Repository(prisma);

      await expect(repository.getTopK(RankingCriterion.SCORE)).resolves.toEqual(
        [
          { ...payload(identityFirst), rank: 1 },
          { ...payload(earliest), rank: 2 },
          { ...payload(later), rank: 3 },
          { ...payload(lowerSharpe), rank: 4 },
          { ...payload(lowerScore), rank: 5 },
        ],
      );
    });

    it('keeps a valid non-Top-K row persisted and addressable by result identity', async () => {
      const outsideTopK = row({ rank: 11, score: -0.4 });
      const topTen = Array.from({ length: 10 }, (_, index) =>
        row({ rank: index + 1, score: 1 - index / 100 }),
      );
      createMock.mockResolvedValue({ ...outsideTopK, rank: 0 });
      findManyMock.mockResolvedValue(topTen);
      findUniqueMock.mockResolvedValue(outsideTopK);
      const repository = new Repository(prisma);

      await repository.create(
        createInput({
          backtestResultId: outsideTopK.backtestResultId,
          score: outsideTopK.score,
        }),
      );
      await expect(
        repository.getTopK(RankingCriterion.SCORE),
      ).resolves.toHaveLength(10);
      await expect(
        repository.findByBacktestResultId(outsideTopK.backtestResultId),
      ).resolves.toEqual(payload(outsideTopK));
      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { backtestResultId: outsideTopK.backtestResultId },
      });
    });

    it.each([
      [RankingCriterion.SCORE, 'score'],
      [RankingCriterion.TOTAL_RETURN, 'totalReturn'],
      [RankingCriterion.WIN_RATE, 'winRate'],
      [RankingCriterion.MAX_DRAWDOWN, 'maxDrawdown'],
      [RankingCriterion.SHARPE_RATIO, 'sharpeRatio'],
    ] as const)(
      'sorts the best-per-version projection for %s',
      async (criterion, field) => {
        const lower = row({
          strategyVersionId: 'version-lower',
          [field]: field === 'maxDrawdown' ? -30 : 0.2,
        });
        const higher = row({
          strategyVersionId: 'version-higher',
          [field]: field === 'maxDrawdown' ? -5 : 0.8,
        });
        findManyMock.mockResolvedValue([lower, higher]);
        const repository = new Repository(prisma);

        await expect(repository.getTopK(criterion)).resolves.toEqual([
          { ...payload(higher), rank: 1 },
          { ...payload(lower), rank: 2 },
        ]);
      },
    );

    it('surfaces only the best entry per strategyVersionId without deleting its history', async () => {
      const versionId = randomUUID();
      const olderAttempt = row({
        strategyVersionId: versionId,
        backtestResultId: 'older-result',
        score: 0.4,
      });
      const bestAttempt = row({
        strategyVersionId: versionId,
        backtestResultId: 'best-result',
        score: 0.8,
      });
      const otherVersion = row({ score: 0.6 });
      findManyMock.mockResolvedValue([olderAttempt, otherVersion, bestAttempt]);
      const repository = new Repository(prisma);

      await expect(repository.getTopK(RankingCriterion.SCORE)).resolves.toEqual(
        [
          { ...payload(bestAttempt), rank: 1 },
          { ...payload(otherVersion), rank: 2 },
        ],
      );
      expect(findManyMock).toHaveBeenCalledWith({ where: { userId: null } });
    });

    it('uses Top-K 10 by default and honors a configured K', async () => {
      const entries = Array.from({ length: 12 }, (_, index) =>
        row({
          rank: index + 1,
          strategyVersionId: `version-${index}`,
          score: 1 - index / 100,
        }),
      );
      findManyMock.mockResolvedValue(entries);

      await expect(
        new Repository(prisma).getTopK(RankingCriterion.SCORE),
      ).resolves.toHaveLength(10);
      await expect(
        new Repository(prisma, 3).getTopK(RankingCriterion.SCORE),
      ).resolves.toHaveLength(3);
    });

    it('uses a bounded PostgreSQL window query in production Prisma', async () => {
      const stored = row({ rank: 99, strategyVersionId: 'version-a' });
      const queryRaw = jest.fn().mockResolvedValue([stored]);
      const broadFindMany = jest.fn();
      const repository = new Repository({
        $queryRaw: queryRaw,
        leaderboardEntry: { findMany: broadFindMany },
      } as unknown as PrismaService);

      await expect(repository.getTopK(RankingCriterion.SCORE)).resolves.toEqual(
        [{ ...payload(stored), rank: 1 }],
      );

      expect(broadFindMany).not.toHaveBeenCalled();
      const query = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
      const sql = query.strings.join(' ');
      expect(sql).toContain('ROW_NUMBER() OVER');
      expect(sql).toContain('PARTITION BY "strategyVersionId"');
      expect(sql).toContain('WHERE "versionRank" = 1');
      expect(sql).toContain('LIMIT');
    });

    it('looks up the best local projection for detail composition by strategyVersionId', async () => {
      const strategyVersionId = randomUUID();
      const worse = row({
        strategyVersionId,
        backtestResultId: 'worse-result',
        score: 0.4,
      });
      const best = row({
        strategyVersionId,
        backtestResultId: 'best-result',
        score: 0.8,
      });
      findManyMock.mockResolvedValue([worse, best]);
      const repository = new Repository(prisma);

      await expect(
        repository.findBestByStrategyVersionId(strategyVersionId),
      ).resolves.toEqual({ ...payload(best), rank: 1 });
      expect(findManyMock).toHaveBeenCalledWith({
        where: { userId: null },
      });
    });

    it('uses only prisma.leaderboardEntry for every persistence and projection operation', async () => {
      const stored = row();
      createMock.mockResolvedValue(stored);
      findUniqueMock.mockResolvedValue(stored);
      findManyMock.mockResolvedValue([stored]);
      findFirstMock.mockResolvedValue(stored);
      updateMock.mockResolvedValue({ ...stored, rank: 1 });
      const repository = new Repository(prisma);

      await repository.create(
        createInput({ backtestResultId: stored.backtestResultId }),
      );
      await repository.findByBacktestResultId(stored.backtestResultId);
      await repository.getTopK(RankingCriterion.SCORE);
      await repository.findBestByStrategyVersionId(stored.strategyVersionId);
      await repository.getUpdatedAt();

      expect(forbiddenAccesses).toEqual([]);
      expect(Object.hasOwn(prisma, 'strategyVersion')).toBe(false);
      expect(Object.hasOwn(prisma, 'backtestResult')).toBe(false);
    });

    it('lists ID-only source references and deletes only explicit entry IDs', async () => {
      const stored = row();
      const reference = {
        id: stored.id,
        userId: stored.userId,
        strategyVersionId: stored.strategyVersionId,
        backtestResultId: stored.backtestResultId,
      };
      findManyMock.mockResolvedValue([
        reference as unknown as PrismaLeaderboardEntry,
      ]);
      deleteManyMock.mockResolvedValue({ count: 1 });
      const repository = new Repository(prisma);

      await expect(repository.findSourceReferences()).resolves.toEqual([
        reference,
      ]);
      expect(findManyMock).toHaveBeenCalledWith({
        select: {
          id: true,
          userId: true,
          strategyVersionId: true,
          backtestResultId: true,
        },
      });
      await expect(repository.deleteByIds([stored.id])).resolves.toBe(1);
      expect(deleteManyMock).toHaveBeenCalledWith({
        where: { id: { in: [stored.id] } },
      });
      await expect(repository.deleteByIds([])).resolves.toBe(0);
      expect(deleteManyMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe('T008 viewer-scoped leaderboard lists', () => {
  it.each([
    ['anonymous', null, [null, null, null]],
    ['user A', USER_A, [null, USER_A, null]],
    ['user B', USER_B, [USER_B, null, USER_B]],
  ] as const)(
    'returns system plus own rows for %s and fills Top-K after filtering',
    async (_actor, viewerUserId, expectedOwners) => {
      const sharedVersion = 'shared-version';
      const rows = [
        row({
          userId: USER_B,
          strategyVersionId: sharedVersion,
          score: 1,
          backtestResultId: 'b-private-best',
        }),
        row({
          userId: viewerUserId === USER_B ? USER_A : USER_B,
          strategyVersionId: 'foreign-version',
          score: 0.95,
          backtestResultId: 'foreign-private',
        }),
        row({
          userId: viewerUserId,
          strategyVersionId: 'own-version',
          score: 0.8,
          backtestResultId: 'own-or-system',
        }),
        row({
          userId: null,
          strategyVersionId: sharedVersion,
          score: 0.7,
          backtestResultId: 'system-shared-version',
        }),
        row({
          userId: null,
          strategyVersionId: 'second-system-version',
          score: 0.9,
          backtestResultId: 'system-second',
        }),
      ];
      const { prisma, findMany } = scopedPrisma(rows);
      const Repository = loadTarget();
      const repository = new Repository(prisma as never, 3);

      const result = await repository.getTopK(
        RankingCriterion.SCORE,
        viewerUserId,
      );

      expect(result.map(({ userId }) => userId)).toEqual(expectedOwners);
      expect(result).toHaveLength(3);
      expect(
        result.map(({ backtestResultId }) => backtestResultId),
      ).not.toContain('foreign-private');
      if (viewerUserId !== USER_B) {
        expect(
          result.map(({ backtestResultId }) => backtestResultId),
        ).toContain('system-shared-version');
        expect(
          result.map(({ backtestResultId }) => backtestResultId),
        ).not.toContain('b-private-best');
      }
      expect(findMany).toHaveBeenCalledWith({
        where: visibilityWhere(viewerUserId),
      });
    },
  );
});

describe('T009 scoped detail, timestamp, Top-K, and response ranks', () => {
  it('computes detail rank from the visible view and hides foreign/nonexistent IDs identically', async () => {
    const system = row({
      userId: null,
      strategyVersionId: 'system-version',
      score: 0.9,
      rank: 20,
    });
    const owned = row({
      userId: USER_A,
      strategyVersionId: 'owned-version',
      score: 0.7,
      rank: 99,
    });
    const foreign = row({
      userId: USER_B,
      strategyVersionId: 'foreign-version',
      score: 1,
      rank: 1,
    });
    const { prisma } = scopedPrisma([foreign, owned, system]);
    const Repository = loadTarget();
    const repository = new Repository(prisma as never);

    await expect(
      repository.findBestByStrategyVersionId('owned-version', USER_A),
    ).resolves.toMatchObject({ userId: USER_A, rank: 2 });
    await expect(
      repository.findBestByStrategyVersionId('foreign-version', USER_A),
    ).resolves.toBeNull();
    await expect(
      repository.findBestByStrategyVersionId('missing-version', USER_A),
    ).resolves.toBeNull();
  });

  it.each([
    ['anonymous', null, new Date('2026-08-16T01:00:03.000Z')],
    ['user A', USER_A, new Date('2026-08-16T01:00:04.000Z')],
    ['user B', USER_B, new Date('2026-08-16T01:00:05.000Z')],
  ] as const)(
    'derives updatedAt only from %s-visible entries',
    async (_actor, viewerUserId, expected) => {
      const rows = [
        row({ userId: null, updatedAt: new Date('2026-08-16T01:00:03.000Z') }),
        row({
          userId: USER_A,
          updatedAt: new Date('2026-08-16T01:00:04.000Z'),
        }),
        row({
          userId: USER_B,
          updatedAt: new Date('2026-08-16T01:00:05.000Z'),
        }),
      ];
      const { prisma, findFirst } = scopedPrisma(rows);
      const Repository = loadTarget();
      const repository = new Repository(prisma as never);

      await expect(repository.getUpdatedAt(viewerUserId)).resolves.toEqual(
        expected,
      );
      expect(findFirst).toHaveBeenCalledWith({
        where: visibilityWhere(viewerUserId),
        orderBy: { updatedAt: 'desc' },
      });
    },
  );

  it('returns contiguous 1..N ranks after visibility, best-per-version, sort, and Top-K', async () => {
    const rows = [
      row({ userId: USER_B, score: 1, rank: 1 }),
      row({ userId: null, score: 0.8, rank: 8, strategyVersionId: 'system' }),
      row({ userId: USER_A, score: 0.7, rank: 12, strategyVersionId: 'owned' }),
    ];
    const { prisma } = scopedPrisma(rows);
    const Repository = loadTarget();
    const repository = new Repository(prisma as never, 10);

    const result = await repository.getTopK(RankingCriterion.SCORE, USER_A);

    expect(result.map(({ rank }) => rank)).toEqual([1, 2]);
    expect(result.map(({ userId }) => userId)).toEqual([null, USER_A]);
  });
});

describe('T004 explicit scope visibility resolver', () => {
  const rows = [
    row({
      userId: null,
      strategyVersionId: 'system-one',
      backtestResultId: 'system-one-result',
      score: 0.9,
      updatedAt: new Date('2026-08-25T01:00:01.000Z'),
    }),
    row({
      userId: null,
      strategyVersionId: 'system-two',
      backtestResultId: 'system-two-result',
      score: 0.8,
      updatedAt: new Date('2026-08-25T01:00:02.000Z'),
    }),
    row({
      userId: USER_A,
      strategyVersionId: 'a-one',
      backtestResultId: 'a-one-result',
      score: 0.7,
      updatedAt: new Date('2026-08-25T01:00:03.000Z'),
    }),
    row({
      userId: USER_A,
      strategyVersionId: 'a-two',
      backtestResultId: 'a-two-result',
      score: 0.6,
      updatedAt: new Date('2026-08-25T01:00:04.000Z'),
    }),
    row({
      userId: USER_B,
      strategyVersionId: 'b-one',
      backtestResultId: 'b-one-result',
      score: 1,
      updatedAt: new Date('2026-08-25T01:00:05.000Z'),
    }),
  ];

  it.each([
    ['system', USER_A, [null, null], { userId: null }],
    ['mine', USER_A, [USER_A, USER_A], { userId: USER_A }],
    [
      'combined',
      USER_A,
      [null, null],
      { OR: [{ userId: null }, { userId: USER_A }] },
    ],
  ] as const)(
    'filters %s before best-per-version, sort, Top-K and local rank',
    async (scope, viewerUserId, expectedOwners, expectedWhere) => {
      const { prisma, findMany } = scopedPrisma(rows);
      const Repository = loadTarget();
      const repository = new Repository(prisma as never, 2);

      const result = await repository.getTopK(
        RankingCriterion.SCORE,
        viewerUserId,
        scope,
      );

      expect(result.map(({ userId }) => userId)).toEqual(expectedOwners);
      expect(result.map(({ rank }) => rank)).toEqual([1, 2]);
      expect(findMany).toHaveBeenCalledWith({ where: expectedWhere });
    },
  );

  it('derives timestamp and SCORE-best detail only from the requested scope', async () => {
    const { prisma } = scopedPrisma(rows);
    const Repository = loadTarget();
    const repository = new Repository(prisma as never, 2);

    await expect(repository.getUpdatedAt(USER_A, 'system')).resolves.toEqual(
      new Date('2026-08-25T01:00:02.000Z'),
    );
    await expect(repository.getUpdatedAt(USER_A, 'mine')).resolves.toEqual(
      new Date('2026-08-25T01:00:04.000Z'),
    );
    await expect(
      repository.findBestByStrategyVersionId('a-one', USER_A, 'mine'),
    ).resolves.toMatchObject({ userId: USER_A, rank: 1 });
    await expect(
      repository.findBestByStrategyVersionId('a-one', USER_A, 'system'),
    ).resolves.toBeNull();
    await expect(
      repository.findBestByStrategyVersionId('b-one', USER_A, 'mine'),
    ).resolves.toBeNull();
  });

  it('short-circuits anonymous Mine without issuing a broad Prisma query', async () => {
    const { prisma, findMany, findFirst } = scopedPrisma(rows);
    const Repository = loadTarget();
    const repository = new Repository(prisma as never, 2);

    await expect(
      repository.getTopK(RankingCriterion.SCORE, null, 'mine'),
    ).resolves.toEqual([]);
    await expect(repository.getUpdatedAt(null, 'mine')).resolves.toEqual(
      new Date(0),
    );
    await expect(
      repository.findBestByStrategyVersionId('a-one', null, 'mine'),
    ).resolves.toBeNull();
    expect(findMany).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

function visibilityWhere(viewerUserId: string | null): object {
  return viewerUserId === null
    ? { userId: null }
    : { OR: [{ userId: null }, { userId: viewerUserId }] };
}

function scopedPrisma(rows: LeaderboardEntry[]): {
  prisma: object;
  findMany: jest.Mock;
  findFirst: jest.Mock;
} {
  const scopedRows = (where?: Record<string, unknown>): LeaderboardEntry[] =>
    rows.filter(
      (entry) =>
        matchesVisibility(entry, where) &&
        (typeof where?.strategyVersionId !== 'string' ||
          entry.strategyVersionId === where.strategyVersionId),
    );
  const findMany = jest.fn((args?: { where?: Record<string, unknown> }) =>
    Promise.resolve(scopedRows(args?.where)),
  );
  const findFirst = jest.fn((args?: { where?: Record<string, unknown> }) =>
    Promise.resolve(
      [...scopedRows(args?.where)].sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      )[0] ?? null,
    ),
  );
  return {
    prisma: { leaderboardEntry: { findMany, findFirst } },
    findMany,
    findFirst,
  };
}

function matchesVisibility(
  entry: LeaderboardEntry,
  where?: Record<string, unknown>,
): boolean {
  if (!where) return true;
  if (Object.hasOwn(where, 'userId')) return entry.userId === where.userId;
  const clauses = where.OR as Array<{ userId: string | null }> | undefined;
  return clauses?.some(({ userId }) => entry.userId === userId) ?? true;
}
