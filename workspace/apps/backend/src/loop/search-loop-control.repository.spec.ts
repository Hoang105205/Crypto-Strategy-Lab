import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StrategyGeneratorType } from '@crypto-strategy-lab/shared';
import type { SearchLoopControl } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  SYSTEM_SEARCH_LOOP_CONTROL_ID,
  SearchLoopControlRepository,
} from './search-loop-control.repository';

const NOW = new Date('2026-08-28T12:00:00.000Z');

const row = (
  overrides: Partial<SearchLoopControl> = {},
): SearchLoopControl => ({
  id: SYSTEM_SEARCH_LOOP_CONTROL_ID,
  enabled: false,
  generatorType: StrategyGeneratorType.RANDOM,
  pair: 'BTCUSDT',
  timeframe: '1h',
  backtestWindowDays: 180,
  initialCapital: 10_000,
  positionSizePercent: 100,
  commission: null,
  slippage: null,
  maxCandidatesPerRun: 100,
  maxDurationMsPerRun: null,
  stopOnNoImprovementIterations: 50,
  cooldownMs: 30_000,
  failureCount: 0,
  nextRunAt: null,
  lastStartedRunId: null,
  lastError: null,
  leaseOwner: null,
  leaseUntil: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

describe('SearchLoopControlRepository', () => {
  let prisma: {
    searchLoopControl: {
      findUnique: jest.Mock<() => Promise<SearchLoopControl | null>>;
      create: jest.Mock<() => Promise<SearchLoopControl>>;
      upsert: jest.Mock<() => Promise<SearchLoopControl>>;
      update: jest.Mock<() => Promise<SearchLoopControl>>;
      updateMany: jest.Mock<() => Promise<{ count: number }>>;
      findUniqueOrThrow: jest.Mock<() => Promise<SearchLoopControl>>;
    };
  };
  let repository: SearchLoopControlRepository;

  beforeEach(() => {
    prisma = {
      searchLoopControl: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    prisma.searchLoopControl.upsert.mockResolvedValue(row());
    repository = new SearchLoopControlRepository(
      prisma as unknown as PrismaService,
    );
  });

  it.each([
    [true, NOW],
    [false, null],
  ])(
    'seeds a missing singleton from defaultEnabled=%s',
    async (defaultEnabled, nextRunAt) => {
      prisma.searchLoopControl.findUnique.mockResolvedValue(null);
      prisma.searchLoopControl.create.mockResolvedValue(
        row({ enabled: defaultEnabled, nextRunAt }),
      );

      const result = await repository.seedIfAbsent(defaultEnabled, NOW);

      expect(result).toMatchObject({
        seeded: true,
        state: { enabled: defaultEnabled, nextRunAt },
      });
      expect(prisma.searchLoopControl.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'system',
          enabled: defaultEnabled,
          nextRunAt,
        }),
      });
    },
  );

  it.each([
    [false, true],
    [true, false],
  ])(
    'keeps the database desired state %s when the environment default is %s',
    async (databaseEnabled, environmentEnabled) => {
      prisma.searchLoopControl.findUnique.mockResolvedValue(
        row({ enabled: databaseEnabled }),
      );

      const result = await repository.seedIfAbsent(environmentEnabled, NOW);

      expect(result).toMatchObject({
        seeded: false,
        state: { enabled: databaseEnabled },
      });
      expect(prisma.searchLoopControl.create).not.toHaveBeenCalled();
    },
  );

  it('accepts the row created by another backend during a seed race', async () => {
    prisma.searchLoopControl.findUnique.mockResolvedValue(null);
    prisma.searchLoopControl.create.mockRejectedValue({ code: 'P2002' });
    prisma.searchLoopControl.findUniqueOrThrow.mockResolvedValue(
      row({ enabled: true, nextRunAt: NOW }),
    );

    await expect(repository.seedIfAbsent(false, NOW)).resolves.toMatchObject({
      seeded: false,
      state: { enabled: true },
    });
  });

  it('creates a disabled singleton with safe defaults on first read', async () => {
    const result = await repository.get();

    expect(result).toMatchObject({
      id: 'system',
      enabled: false,
      maxCandidatesPerRun: 100,
      backtestWindowDays: 180,
    });
    expect(prisma.searchLoopControl.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'system' },
        create: expect.objectContaining({ id: 'system', enabled: false }),
      }),
    );
  });

  it('persists enabled desired state and the operator configuration', async () => {
    prisma.searchLoopControl.upsert.mockResolvedValue(
      row({ enabled: true, nextRunAt: NOW }),
    );

    const result = await repository.enable(
      {
        generatorType: StrategyGeneratorType.DOMAIN_GUIDED,
        pair: 'ETHUSDT',
        timeframe: '4h',
        backtestWindowDays: 90,
        backtestConfig: {
          initialCapital: 20_000,
          positionSizePercent: 50,
          commission: 0.001,
        },
        maxCandidatesPerRun: 25,
        maxDurationMsPerRun: null,
        stopOnNoImprovementIterations: 10,
        cooldownMs: 60_000,
      },
      NOW,
    );

    expect(result.enabled).toBe(true);
    expect(prisma.searchLoopControl.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          enabled: true,
          generatorType: StrategyGeneratorType.DOMAIN_GUIDED,
          pair: 'ETHUSDT',
          nextRunAt: NOW,
        }),
      }),
    );
  });

  it('uses one atomic update to acquire or renew a distributed lease', async () => {
    const leaseUntil = new Date(NOW.getTime() + 60_000);
    prisma.searchLoopControl.updateMany.mockResolvedValue({ count: 1 });
    prisma.searchLoopControl.findUniqueOrThrow.mockResolvedValue(
      row({ enabled: true, leaseOwner: 'instance-a', leaseUntil }),
    );

    const claimed = await repository.tryAcquireLease(
      'instance-a',
      NOW,
      leaseUntil,
    );

    expect(claimed?.leaseOwner).toBe('instance-a');
    expect(prisma.searchLoopControl.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'system',
        enabled: true,
        OR: [
          { leaseOwner: 'instance-a' },
          { leaseUntil: null },
          { leaseUntil: { lte: NOW } },
        ],
      },
      data: { leaseOwner: 'instance-a', leaseUntil },
    });
  });

  it('does not read or start work when another live instance owns the lease', async () => {
    prisma.searchLoopControl.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.tryAcquireLease(
        'instance-b',
        NOW,
        new Date(NOW.getTime() + 60_000),
      ),
    ).resolves.toBeNull();
    expect(prisma.searchLoopControl.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
