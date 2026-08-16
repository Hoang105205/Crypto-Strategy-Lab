import { Injectable } from '@nestjs/common';
import {
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

  async rerank(): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const entries = await transaction.leaderboardEntry.findMany();
      const ranked = [...entries].sort((left, right) =>
        this.scoringPolicy.compare(left, right),
      );

      for (const [index, entry] of ranked.entries()) {
        await transaction.leaderboardEntry.update({
          where: { id: entry.id },
          data: { rank: index + 1 },
        });
      }
    });
  }

  async getTopK(
    criterion: RankingCriterion,
  ): Promise<LeaderboardEntryPayload[]> {
    const entries = await this.prisma.leaderboardEntry.findMany();
    const bestPerVersion = this.bestPerStrategyVersion(entries, criterion);
    return bestPerVersion.slice(0, this.topK).map((entry) => this.map(entry));
  }

  async findBestByStrategyVersionId(
    strategyVersionId: string,
  ): Promise<LeaderboardEntryPayload | null> {
    const entries = await this.prisma.leaderboardEntry.findMany({
      where: { strategyVersionId },
    });
    const best = [...entries].sort((left, right) =>
      this.compare(left, right, RankingCriterion.SCORE),
    )[0];
    return best ? this.map(best) : null;
  }

  async getUpdatedAt(): Promise<Date> {
    const latest = await this.prisma.leaderboardEntry.findFirst({
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

  private map(entry: PrismaLeaderboardEntry): LeaderboardEntryPayload {
    return {
      rank: entry.rank,
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
