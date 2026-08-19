import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type {
  IEventBus,
  IJobQueue,
  IStrategy,
  StrategyVersion,
} from '@crypto-strategy-lab/shared';
import {
  CombinerType,
  EventType,
  JobStatusValue,
  JobType,
  StrategyType,
} from '@crypto-strategy-lab/shared';
import { StrategyController } from '../strategy.controller';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { StrategyVersioningService } from '../../versioning/strategy-versioning.service';
import { MovingAverageStrategy } from '../../strategies/moving-average.strategy';
import { RsiStrategy } from '../../strategies/rsi.strategy';
import { PrismaService } from '../../../database/prisma.service';

describe('StrategyController', () => {
  let controller: StrategyController;
  let registry: StrategyRegistry;
  let versioning: jest.Mocked<StrategyVersioningService>;
  let jobQueue: jest.Mocked<IJobQueue>;
  let eventBus: jest.Mocked<IEventBus>;
  let prisma: PrismaService;
  let versions: StrategyVersion[];
  let findBacktestResult: jest.Mock<() => Promise<unknown>>;

  beforeEach(() => {
    registry = new StrategyRegistry();
    versions = [];

    const createVersion = jest.fn(
      async (strategy: IStrategy): Promise<StrategyVersion> => {
        const previous = versions.filter(
          (candidate) => candidate.name === strategy.getName(),
        );
        const version: StrategyVersion = {
          id: randomUUID(),
          strategyType: strategy.getType(),
          name: strategy.getName(),
          version: previous.length + 1,
          parameters: strategy.getParameters(),
          isComposite: strategy.getType() === StrategyType.COMPOSITE,
          childVersionIds: [],
          createdAt: new Date(),
        };
        versions.push(version);
        return version;
      },
    );

    versioning = {
      createVersion,
      getVersion: jest.fn(async (id: string) =>
        versions.find((candidate) => candidate.id === id),
      ),
      getVersionsByName: jest.fn(async (name: string, userId?: string | null) =>
        versions.filter((candidate) => candidate.name === name),
      ),
      getAllVersions: jest.fn(async (userId?: string | null) =>
        versions,
      ),
    } as unknown as jest.Mocked<StrategyVersioningService>;

    jobQueue = {
      enqueue: jest.fn<IJobQueue['enqueue']>(async (_type, payload) => ({
        jobId: payload.jobId,
      })),
      getStatus: jest.fn<IJobQueue['getStatus']>(),
      retry: jest.fn<IJobQueue['retry']>(),
      deadLetter: jest.fn<IJobQueue['deadLetter']>(),
      getStats: jest.fn<IJobQueue['getStats']>(),
    };

    eventBus = {
      publish: jest.fn<IEventBus['publish']>(),
      subscribe: jest.fn<IEventBus['subscribe']>(),
      unsubscribe: jest.fn<IEventBus['unsubscribe']>(),
    };

    const ma = new MovingAverageStrategy(registry);
    const rsi = new RsiStrategy(registry);
    ma.onModuleInit();
    rsi.onModuleInit();

    findBacktestResult = jest.fn<() => Promise<unknown>>();
    prisma = {
      backtestResult: {
        findFirst: findBacktestResult,
      },
    } as unknown as PrismaService;

    controller = new StrategyController(
      registry,
      versioning,
      jobQueue,
      eventBus,
      prisma,
    );
  });

  it('GET /api/strategies returns all registered strategies', async () => {
    const result = await controller.getAllStrategies(null);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some((strategy) => strategy.name === 'MovingAverage')).toBe(
      true,
    );
  });

  it('POST /api/strategies/composite registers and versions a composite', async () => {
    const result = await controller.createComposite({
      name: 'TestComposite',
      childStrategyNames: ['MovingAverage', 'RelativeStrengthIndex'],
      combinerType: CombinerType.MAJORITY_VOTE,
    }, null);

    expect(result.strategy.name).toBe('TestComposite');
    // Composites are no longer automatically put in the global registry (ADR-0016 compliance)
    expect(registry.get('TestComposite')).toBeUndefined();
    expect(versioning.createVersion).toHaveBeenCalledTimes(1);
  });

  it('POST /api/strategies/backtest enqueues before publishing BacktestRequested', async () => {
    const result = await controller.requestBacktest({
      strategyName: 'MovingAverage',
      pair: 'BTCUSDT',
      timeframe: '1h',
      startDate: new Date(),
      endDate: new Date(),
    }, null);

    expect(result.status).toBe(JobStatusValue.QUEUED);
    expect(jobQueue.enqueue).toHaveBeenCalledWith(
      JobType.BACKTEST,
      expect.objectContaining({
        jobId: result.jobId,
        pair: 'BTCUSDT',
        strategyVersionId: result.strategyVersionId,
      }),
      expect.any(String),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      EventType.BacktestRequested,
      expect.objectContaining({ jobId: result.jobId, pair: 'BTCUSDT' }),
      expect.any(String),
    );
    expect(jobQueue.enqueue.mock.invocationCallOrder[0]).toBeLessThan(
      eventBus.publish.mock.invocationCallOrder[0],
    );
  });

  it('GET /api/strategies/:id returns an immutable strategy version', async () => {
    const created = await controller.createComposite({
      name: 'TestVersionById',
      childStrategyNames: ['MovingAverage'],
      combinerType: CombinerType.MAJORITY_VOTE,
    }, null);

    const version = await controller.getStrategyById(created.strategy.versionId, null);

    expect(version.id).toBe(created.strategy.versionId);
    expect(version.name).toBe('TestVersionById');
  });

  it('GET /api/strategies/:name/versions returns created versions', async () => {
    await controller.requestBacktest({
      strategyName: 'MovingAverage',
      pair: 'BTCUSDT',
      timeframe: '1h',
      startDate: new Date(),
      endDate: new Date(),
    }, null);

    const result = await controller.getStrategyVersions('MovingAverage', null);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('MovingAverage');
  });

  it('GET /api/strategies/backtest/:id returns a persisted result', async () => {
    const id = 'mock_id_123';
    findBacktestResult.mockResolvedValue({
      id,
      totalReturn: 10.5,
      winRate: 0.6,
    });

    const result = await controller.getBacktestResult(id, null);

    expect(result.id).toBe(id);
    expect(result.totalReturn).toBe(10.5);
    expect(result.winRate).toBe(0.6);
    expect(prisma.backtestResult.findFirst).toHaveBeenCalledWith({
      where: { 
        jobId: id,
        OR: [
          { userId: null },
          { userId: null },
        ],
      },
    });
  });

  it('GET /api/strategies/backtest/:id throws 404 when absent', async () => {
    findBacktestResult.mockResolvedValue(null);

    await expect(controller.getBacktestResult('invalid_id', null)).rejects.toThrow(
      "BacktestResult 'invalid_id' not found",
    );
  });
});
