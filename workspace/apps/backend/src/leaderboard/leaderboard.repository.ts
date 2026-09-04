import { Injectable } from '@nestjs/common';
import {
  LeaderboardScope,
  RankingCriterion,
  type LeaderboardEntryPayload,
  type NormalizedRate,
} from '@crypto-strategy-lab/shared';
import {
  Prisma,
  type LeaderboardEntry as PrismaLeaderboardEntry,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ScoringPolicy } from './scoring-policy';

export const DEFAULT_LEADERBOARD_TOP_K = 10;

export interface LeaderboardCreateInput {
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

export interface LeaderboardSourceReference {
  id: string;
  userId: string | null;
  strategyVersionId: string;
  backtestResultId: string;
}

@Injectable()
export class LeaderboardRepository {
  private readonly scoringPolicy = new ScoringPolicy();
  private readonly topK: number;

  constructor(
    private readonly prisma: PrismaService,
    topK: number = DEFAULT_LEADERBOARD_TOP_K,
  ) {
    if (!Number.isInteger(topK) || topK < 1) {
      throw new RangeError('Leaderboard Top-K must be a positive integer');
    }
    this.topK = topK;
  }

  async create(
    input: LeaderboardCreateInput,
  ): Promise<LeaderboardEntryPayload | null> {
    try {
      const entry = await this.prisma.leaderboardEntry.create({
        data: {
          rank: 0,
          ...input,
        },
      });
      return this.map(entry);
    } catch (error: unknown) {
      if (isUniqueConflict(error)) return null;
      throw error;
    }
  }

  async findByBacktestResultId(
    backtestResultId: string,
  ): Promise<LeaderboardEntryPayload | null> {
    const entry = await this.prisma.leaderboardEntry.findUnique({
      where: { backtestResultId },
    });
    return entry ? this.map(entry) : null;
  }

  findSourceReferences(): Promise<LeaderboardSourceReference[]> {
    return this.prisma.leaderboardEntry.findMany({
      select: {
        id: true,
        userId: true,
        strategyVersionId: true,
        backtestResultId: true,
      },
    });
  }

  async deleteByIds(ids: readonly string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.prisma.leaderboardEntry.deleteMany({
      where: { id: { in: [...ids] } },
    });
    return result.count;
  }

  async getTopK(
    criterion: RankingCriterion,
    viewerUserId: string | null = null,
    scope: LeaderboardScope = LeaderboardScope.COMBINED,
  ): Promise<LeaderboardEntryPayload[]> {
    const visibility = resolveVisibility(scope, viewerUserId);
    if (visibility.kind === 'empty') return [];
    if (
      '$queryRaw' in this.prisma &&
      typeof this.prisma.$queryRaw === 'function'
    ) {
      const entries = await this.prisma.$queryRaw<PrismaLeaderboardEntry[]>(
        buildTopKQuery(criterion, visibility, this.topK),
      );
      return entries.map((entry, index) => this.map(entry, index + 1));
    }

    // Unit-test and lightweight adapter fallback. Production Prisma always exposes
    // $queryRaw and therefore uses the bounded PostgreSQL query above.
    const entries = await this.prisma.leaderboardEntry.findMany({
      where: visibility.where,
    });
    const bestPerVersion = this.bestPerStrategyVersion(entries, criterion);
    return bestPerVersion
      .slice(0, this.topK)
      .map((entry, index) => this.map(entry, index + 1));
  }

  async findBestByStrategyVersionId(
    strategyVersionId: string,
    viewerUserId: string | null = null,
    scope: LeaderboardScope = LeaderboardScope.COMBINED,
  ): Promise<LeaderboardEntryPayload | null> {
    const visibility = resolveVisibility(scope, viewerUserId);
    if (visibility.kind === 'empty') return null;
    const entries = await this.prisma.leaderboardEntry.findMany({
      where: visibility.where,
    });
    const ranked = this.bestPerStrategyVersion(entries, RankingCriterion.SCORE);
    const index = ranked.findIndex(
      (entry) => entry.strategyVersionId === strategyVersionId,
    );
    return index >= 0 ? this.map(ranked[index], index + 1) : null;
  }

  async getUpdatedAt(
    viewerUserId: string | null = null,
    scope: LeaderboardScope = LeaderboardScope.COMBINED,
  ): Promise<Date> {
    const visibility = resolveVisibility(scope, viewerUserId);
    if (visibility.kind === 'empty') return new Date(0);
    const latest = await this.prisma.leaderboardEntry.findFirst({
      where: visibility.where,
      orderBy: { updatedAt: 'desc' },
    });
    return latest?.updatedAt ?? new Date(0);
  }

  private bestPerStrategyVersion(
    entries: PrismaLeaderboardEntry[],
    criterion: RankingCriterion,
  ): PrismaLeaderboardEntry[] {
    const sorted = [...entries].sort((left, right) =>
      this.compare(left, right, criterion),
    );
    const seen = new Set<string>();

    return sorted.filter((entry) => {
      if (seen.has(entry.strategyVersionId)) return false;
      seen.add(entry.strategyVersionId);
      return true;
    });
  }

  private compare(
    left: PrismaLeaderboardEntry,
    right: PrismaLeaderboardEntry,
    criterion: RankingCriterion,
  ): number {
    const criterionOrder = this.compareCriterion(left, right, criterion);
    if (criterionOrder !== 0) return criterionOrder;
    return this.scoringPolicy.compare(left, right);
  }

  private compareCriterion(
    left: PrismaLeaderboardEntry,
    right: PrismaLeaderboardEntry,
    criterion: RankingCriterion,
  ): number {
    switch (criterion) {
      case RankingCriterion.SCORE:
        return this.scoringPolicy.compare(left, right);
      case RankingCriterion.TOTAL_RETURN:
        return compareDescending(left.totalReturn, right.totalReturn);
      case RankingCriterion.WIN_RATE:
        return compareDescending(left.winRate, right.winRate);
      case RankingCriterion.MAX_DRAWDOWN:
        return compareAscending(
          Math.abs(left.maxDrawdown),
          Math.abs(right.maxDrawdown),
        );
      case RankingCriterion.SHARPE_RATIO:
        return compareDescending(left.sharpeRatio, right.sharpeRatio);
      default:
        return assertNever(criterion);
    }
  }

  private map(
    entry: PrismaLeaderboardEntry,
    rank: number = entry.rank,
  ): LeaderboardEntryPayload {
    return {
      rank,
      userId: entry.userId,
      strategyVersionId: entry.strategyVersionId,
      strategyName: entry.strategyName,
      strategyType: entry.strategyType,
      isComposite: entry.isComposite,
      backtestResultId: entry.backtestResultId,
      score: entry.score,
      totalReturn: entry.totalReturn,
      winRate: entry.winRate as NormalizedRate,
      maxDrawdown: entry.maxDrawdown,
      sharpeRatio: entry.sharpeRatio,
      totalTrades: entry.totalTrades,
    };
  }
}

type LeaderboardVisibility =
  | {
      kind: 'query';
      where: Prisma.LeaderboardEntryWhereInput;
      sql: Prisma.Sql;
    }
  | { kind: 'empty' };

function resolveVisibility(
  scope: LeaderboardScope,
  viewerUserId: string | null,
): LeaderboardVisibility {
  switch (scope) {
    case LeaderboardScope.SYSTEM:
      return {
        kind: 'query',
        where: { userId: null },
        sql: Prisma.sql`"userId" IS NULL`,
      };
    case LeaderboardScope.MINE:
      return viewerUserId === null
        ? { kind: 'empty' }
        : {
            kind: 'query',
            where: { userId: viewerUserId },
            sql: Prisma.sql`"userId" = ${viewerUserId}`,
          };
    case LeaderboardScope.COMBINED:
      return {
        kind: 'query',
        where:
          viewerUserId === null
            ? { userId: null }
            : { OR: [{ userId: null }, { userId: viewerUserId }] },
        sql:
          viewerUserId === null
            ? Prisma.sql`"userId" IS NULL`
            : Prisma.sql`("userId" IS NULL OR "userId" = ${viewerUserId})`,
      };
    default:
      return assertNever(scope);
  }
}

function buildTopKQuery(
  criterion: RankingCriterion,
  visibility: Extract<LeaderboardVisibility, { kind: 'query' }>,
  topK: number,
): Prisma.Sql {
  const order = rankingOrderSql(criterion);
  return Prisma.sql`
    WITH "bestPerVersion" AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY "strategyVersionId"
        ORDER BY ${order}
      ) AS "versionRank"
      FROM "LeaderboardEntry"
      WHERE ${visibility.sql}
    )
    SELECT
      "id", "userId", "rank", "strategyVersionId", "strategyName",
      "strategyType", "isComposite", "backtestResultId", "score",
      "totalReturn", "winRate", "maxDrawdown", "sharpeRatio",
      "totalTrades", "executedAt", "createdAt", "updatedAt"
    FROM "bestPerVersion"
    WHERE "versionRank" = 1
    ORDER BY ${order}
    LIMIT ${topK}
  `;
}

function rankingOrderSql(criterion: RankingCriterion): Prisma.Sql {
  const scoreTieBreak = Prisma.sql`
    ROUND("score"::numeric, 4) DESC,
    "sharpeRatio" DESC,
    ABS("maxDrawdown") ASC,
    "executedAt" ASC,
    "backtestResultId" ASC
  `;
  switch (criterion) {
    case RankingCriterion.SCORE:
      return scoreTieBreak;
    case RankingCriterion.TOTAL_RETURN:
      return Prisma.sql`"totalReturn" DESC, ${scoreTieBreak}`;
    case RankingCriterion.WIN_RATE:
      return Prisma.sql`"winRate" DESC, ${scoreTieBreak}`;
    case RankingCriterion.MAX_DRAWDOWN:
      return Prisma.sql`ABS("maxDrawdown") ASC, ${scoreTieBreak}`;
    case RankingCriterion.SHARPE_RATIO:
      return Prisma.sql`"sharpeRatio" DESC, ${scoreTieBreak}`;
    default:
      return assertNever(criterion);
  }
}

function isUniqueConflict(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError ||
      (typeof error === 'object' && error !== null && 'code' in error)) &&
    (error as { code?: string }).code === 'P2002'
  );
}

function compareDescending(left: number, right: number): number {
  if (left > right) return -1;
  if (left < right) return 1;
  return 0;
}

function compareAscending(left: number, right: number): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertNever(value: never): never {
  throw new RangeError(`Unsupported ranking criterion: ${String(value)}`);
}
