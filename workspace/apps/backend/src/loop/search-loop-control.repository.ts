import { Injectable } from '@nestjs/common';
import {
  StrategyGeneratorType,
  type BacktestConfig,
} from '@crypto-strategy-lab/shared';
import {
  Prisma,
  type SearchLoopControl as PrismaSearchLoopControl,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export const SYSTEM_SEARCH_LOOP_CONTROL_ID = 'system';

export interface SearchLoopAutomationConfig {
  generatorType: StrategyGeneratorType;
  pair: string;
  timeframe: string;
  backtestWindowDays: number;
  backtestConfig: BacktestConfig;
  maxCandidatesPerRun: number | null;
  maxDurationMsPerRun: number | null;
  stopOnNoImprovementIterations: number;
  cooldownMs: number;
}

export interface SearchLoopControlState extends SearchLoopAutomationConfig {
  id: string;
  enabled: boolean;
  failureCount: number;
  nextRunAt: Date | null;
  lastStartedRunId: string | null;
  lastError: string | null;
  leaseOwner: string | null;
  leaseUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchLoopControlSeedResult {
  seeded: boolean;
  state: SearchLoopControlState;
}

const DEFAULT_CONTROL: SearchLoopAutomationConfig = {
  generatorType: StrategyGeneratorType.RANDOM,
  pair: 'BTCUSDT',
  timeframe: '1h',
  backtestWindowDays: 180,
  backtestConfig: {
    initialCapital: 10_000,
    positionSizePercent: 100,
  },
  maxCandidatesPerRun: 100,
  maxDurationMsPerRun: null,
  stopOnNoImprovementIterations: 50,
  cooldownMs: 30_000,
};

@Injectable()
export class SearchLoopControlRepository {
  constructor(private readonly prisma: PrismaService) {}

  async seedIfAbsent(
    defaultEnabled: boolean,
    now = new Date(),
  ): Promise<SearchLoopControlSeedResult> {
    const existing = await this.prisma.searchLoopControl.findUnique({
      where: { id: SYSTEM_SEARCH_LOOP_CONTROL_ID },
    });
    if (existing) {
      return { seeded: false, state: mapControl(existing) };
    }

    try {
      const created = await this.prisma.searchLoopControl.create({
        data: {
          id: SYSTEM_SEARCH_LOOP_CONTROL_ID,
          enabled: defaultEnabled,
          nextRunAt: defaultEnabled ? now : null,
          ...toPersistenceConfig(DEFAULT_CONTROL),
        },
      });
      return { seeded: true, state: mapControl(created) };
    } catch (error: unknown) {
      if (!isUniqueConstraintViolation(error)) throw error;

      const winner = await this.prisma.searchLoopControl.findUniqueOrThrow({
        where: { id: SYSTEM_SEARCH_LOOP_CONTROL_ID },
      });
      return { seeded: false, state: mapControl(winner) };
    }
  }

  async get(): Promise<SearchLoopControlState> {
    const row = await this.prisma.searchLoopControl.upsert({
      where: { id: SYSTEM_SEARCH_LOOP_CONTROL_ID },
      create: {
        id: SYSTEM_SEARCH_LOOP_CONTROL_ID,
        enabled: false,
        ...toPersistenceConfig(DEFAULT_CONTROL),
      },
      update: {},
    });
    return mapControl(row);
  }

  async enable(
    config: SearchLoopAutomationConfig,
    now: Date,
  ): Promise<SearchLoopControlState> {
    const row = await this.prisma.searchLoopControl.upsert({
      where: { id: SYSTEM_SEARCH_LOOP_CONTROL_ID },
      create: {
        id: SYSTEM_SEARCH_LOOP_CONTROL_ID,
        enabled: true,
        ...toPersistenceConfig(config),
        failureCount: 0,
        nextRunAt: now,
        lastError: null,
      },
      update: {
        enabled: true,
        ...toPersistenceConfig(config),
        failureCount: 0,
        nextRunAt: now,
        lastError: null,
      },
    });
    return mapControl(row);
  }

  async configure(
    config: SearchLoopAutomationConfig,
  ): Promise<SearchLoopControlState> {
    const row = await this.prisma.searchLoopControl.upsert({
      where: { id: SYSTEM_SEARCH_LOOP_CONTROL_ID },
      create: {
        id: SYSTEM_SEARCH_LOOP_CONTROL_ID,
        enabled: false,
        ...toPersistenceConfig(config),
      },
      update: toPersistenceConfig(config),
    });
    return mapControl(row);
  }

  async disable(): Promise<SearchLoopControlState> {
    await this.get();
    const row = await this.prisma.searchLoopControl.update({
      where: { id: SYSTEM_SEARCH_LOOP_CONTROL_ID },
      data: {
        enabled: false,
        nextRunAt: null,
        leaseOwner: null,
        leaseUntil: null,
      },
    });
    return mapControl(row);
  }

  async tryAcquireLease(
    owner: string,
    now: Date,
    leaseUntil: Date,
  ): Promise<SearchLoopControlState | null> {
    await this.get();
    const claimed = await this.prisma.searchLoopControl.updateMany({
      where: {
        id: SYSTEM_SEARCH_LOOP_CONTROL_ID,
        enabled: true,
        OR: [
          { leaseOwner: owner },
          { leaseUntil: null },
          { leaseUntil: { lte: now } },
        ],
      },
      data: { leaseOwner: owner, leaseUntil },
    });
    if (claimed.count !== 1) return null;

    const row = await this.prisma.searchLoopControl.findUniqueOrThrow({
      where: { id: SYSTEM_SEARCH_LOOP_CONTROL_ID },
    });
    return mapControl(row);
  }

  async recordHealthy(
    owner: string,
    leaseUntil: Date,
    nextRunAt: Date,
  ): Promise<void> {
    await this.updateOwned(owner, {
      leaseUntil,
      nextRunAt,
      failureCount: 0,
      lastError: null,
    });
  }

  async renewLease(owner: string, leaseUntil: Date): Promise<void> {
    await this.prisma.searchLoopControl.updateMany({
      where: {
        id: SYSTEM_SEARCH_LOOP_CONTROL_ID,
        enabled: true,
        leaseOwner: owner,
      },
      data: { leaseUntil },
    });
  }

  async recordRunStarted(
    owner: string,
    loopRunId: string,
    leaseUntil: Date,
    nextRunAt: Date,
  ): Promise<boolean> {
    return this.updateOwned(owner, {
      leaseUntil,
      nextRunAt,
      lastStartedRunId: loopRunId,
      failureCount: 0,
      lastError: null,
    });
  }

  async recordFailure(
    owner: string,
    error: string,
    failureCount: number,
    leaseUntil: Date,
    nextRunAt: Date,
  ): Promise<void> {
    await this.updateOwned(owner, {
      leaseUntil,
      nextRunAt,
      failureCount,
      lastError: error.slice(0, 1_000),
    });
  }

  async releaseLease(owner: string): Promise<void> {
    await this.prisma.searchLoopControl.updateMany({
      where: { id: SYSTEM_SEARCH_LOOP_CONTROL_ID, leaseOwner: owner },
      data: { leaseOwner: null, leaseUntil: null },
    });
  }

  private async updateOwned(
    owner: string,
    data: {
      leaseUntil: Date;
      nextRunAt: Date;
      failureCount?: number;
      lastStartedRunId?: string;
      lastError?: string | null;
    },
  ): Promise<boolean> {
    const changed = await this.prisma.searchLoopControl.updateMany({
      where: {
        id: SYSTEM_SEARCH_LOOP_CONTROL_ID,
        enabled: true,
        leaseOwner: owner,
      },
      data,
    });
    return changed.count === 1;
  }
}

function toPersistenceConfig(config: SearchLoopAutomationConfig) {
  return {
    generatorType: config.generatorType,
    pair: config.pair,
    timeframe: config.timeframe,
    backtestWindowDays: config.backtestWindowDays,
    initialCapital: config.backtestConfig.initialCapital,
    positionSizePercent: config.backtestConfig.positionSizePercent,
    commission: config.backtestConfig.commission ?? null,
    slippage: config.backtestConfig.slippage ?? null,
    maxCandidatesPerRun: config.maxCandidatesPerRun,
    maxDurationMsPerRun: config.maxDurationMsPerRun,
    stopOnNoImprovementIterations: config.stopOnNoImprovementIterations,
    cooldownMs: config.cooldownMs,
  };
}

function mapControl(row: PrismaSearchLoopControl): SearchLoopControlState {
  return {
    id: row.id,
    enabled: row.enabled,
    generatorType: row.generatorType as StrategyGeneratorType,
    pair: row.pair,
    timeframe: row.timeframe,
    backtestWindowDays: row.backtestWindowDays,
    backtestConfig: {
      initialCapital: row.initialCapital,
      positionSizePercent: row.positionSizePercent,
      ...(row.commission === null ? {} : { commission: row.commission }),
      ...(row.slippage === null ? {} : { slippage: row.slippage }),
    },
    maxCandidatesPerRun: row.maxCandidatesPerRun,
    maxDurationMsPerRun: row.maxDurationMsPerRun,
    stopOnNoImprovementIterations: row.stopOnNoImprovementIterations,
    cooldownMs: row.cooldownMs,
    failureCount: row.failureCount,
    nextRunAt: row.nextRunAt,
    lastStartedRunId: row.lastStartedRunId,
    lastError: row.lastError,
    leaseOwner: row.leaseOwner,
    leaseUntil: row.leaseUntil,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002')
  );
}
