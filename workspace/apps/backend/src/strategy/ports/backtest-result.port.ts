import { Injectable } from '@nestjs/common';
import type {
  BacktestResult,
  BacktestResultCreateInput,
  IBacktestResultPort,
  Trade,
} from '@crypto-strategy-lab/shared';
import { Prisma, type BacktestResult as DbBacktestResult } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StrategyPortError } from './strategy-port.error';

@Injectable()
export class BacktestResultPort implements IBacktestResultPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(input: BacktestResultCreateInput): Promise<BacktestResult> {
    const existing = await this.prisma.backtestResult.findUnique({
      where: { jobId: input.jobId },
    });
    if (existing) return this.assertSameRequest(input, existing);

    try {
      const created = await this.prisma.backtestResult.create({
        data: {
          ...input,
          trades: input.trades as unknown as Prisma.InputJsonValue,
        },
      });
      return this.map(created);
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const winner = await this.prisma.backtestResult.findUnique({
        where: { jobId: input.jobId },
      });
      if (!winner) throw error;
      return this.assertSameRequest(input, winner);
    }
  }

  async getById(id: string): Promise<BacktestResult | null> {
    const result = await this.prisma.backtestResult.findUnique({ where: { id } });
    return result ? this.map(result) : null;
  }

  private assertSameRequest(
    input: BacktestResultCreateInput,
    existing: DbBacktestResult,
  ): BacktestResult {
    const sameIdentity =
      existing.strategyVersionId === input.strategyVersionId &&
      existing.pair === input.pair &&
      existing.timeframe === input.timeframe &&
      existing.startDate.getTime() === input.startDate.getTime() &&
      existing.endDate.getTime() === input.endDate.getTime();
    if (!sameIdentity) {
      throw new StrategyPortError(
        'JOB_CONFLICT',
        `Backtest job '${input.jobId}' already owns a different immutable request`,
      );
    }
    return this.map(existing);
  }

  private map(result: DbBacktestResult): BacktestResult {
    return {
      ...result,
      trades: result.trades as unknown as Trade[],
    };
  }
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === 'object' && error !== null && 'code' in error)
  ) && (error as { code?: string }).code === 'P2002';
}
