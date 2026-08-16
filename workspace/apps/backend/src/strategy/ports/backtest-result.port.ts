import { Injectable } from '@nestjs/common';
import type {
  BacktestResult,
  BacktestResultCreateInput,
  BacktestResultDetail,
  IBacktestResultPort,
  StrategyVersion,
  Trade,
} from '@crypto-strategy-lab/shared';
import { CombinerType, StrategyType } from '@crypto-strategy-lab/shared';
import {
  Prisma,
  type BacktestResult as DbBacktestResult,
} from '@prisma/client';
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

  async getById(id: string): Promise<BacktestResultDetail | null> {
    const result = await this.prisma.backtestResult.findUnique({
      where: { id },
      include: { strategyVersion: true },
    });
    return result ? this.mapDetail(result) : null;
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

  private mapDetail(
    result: Prisma.BacktestResultGetPayload<{
      include: { strategyVersion: true };
    }>,
  ): BacktestResultDetail {
    return {
      ...this.map(result),
      strategyVersion: this.mapVersion(result.strategyVersion),
    };
  }

  private mapVersion(
    version: Prisma.BacktestResultGetPayload<{
      include: { strategyVersion: true };
    }>['strategyVersion'],
  ): StrategyVersion {
    return {
      id: version.id,
      strategyType: version.strategyType as StrategyType,
      name: version.name,
      version: version.version,
      parameters: version.parameters as Record<string, unknown>,
      parentVersionId: version.parentVersionId ?? undefined,
      isComposite: version.isComposite,
      childVersionIds: version.childVersionIds,
      combinerType: (version.combinerType as CombinerType | null) ?? undefined,
      combinerWeights:
        (version.combinerWeights as Record<string, number> | null) ?? undefined,
      createdAt: version.createdAt,
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
