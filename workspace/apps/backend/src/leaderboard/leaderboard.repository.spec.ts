import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
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
  rerank(): Promise<void>;
  getTopK(criterion: RankingCriterion): Promise<LeaderboardEntryPayload[]>;
  findBestByStrategyVersionId(
    strategyVersionId: string,
  ): Promise<LeaderboardEntryPayload | null>;
  getUpdatedAt(): Promise<Date>;
}

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

const row = (overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  id: randomUUID(),
  rank: 0,
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

    it('inserts a unique backtestResultId as a rank-zero projection pending rerank', async () => {
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

    it('assigns complete deterministic global ranks with all tie-breaks and identity fallback', async () => {
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
      updateMock.mockImplementation(({ where, data }) => {
        const current = [
          earliest,
          identityFirst,
          later,
          lowerSharpe,
          lowerScore,
        ].find(({ id }) => id === where.id);
        return Promise.resolve({ ...current!, rank: data.rank });
      });
      const repository = new Repository(prisma);

      await repository.rerank();

      expect(updateMock.mock.calls.map(([call]) => call)).toEqual([
        { where: { id: identityFirst.id }, data: { rank: 1 } },
        { where: { id: earliest.id }, data: { rank: 2 } },
        { where: { id: later.id }, data: { rank: 3 } },
        { where: { id: lowerSharpe.id }, data: { rank: 4 } },
        { where: { id: lowerScore.id }, data: { rank: 5 } },
      ]);
      expect(transactionMock).toHaveBeenCalledTimes(1);
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
          payload(higher),
          payload(lower),
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
        [payload(bestAttempt), payload(otherVersion)],
      );
      expect(findManyMock).toHaveBeenCalledWith();
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
      ).resolves.toEqual(payload(best));
      expect(findManyMock).toHaveBeenCalledWith({
        where: { strategyVersionId },
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
      await repository.rerank();
      await repository.getTopK(RankingCriterion.SCORE);
      await repository.findBestByStrategyVersionId(stored.strategyVersionId);
      await repository.getUpdatedAt();

      expect(forbiddenAccesses).toEqual([]);
      expect(Object.hasOwn(prisma, 'strategyVersion')).toBe(false);
      expect(Object.hasOwn(prisma, 'backtestResult')).toBe(false);
    });
  });
});
