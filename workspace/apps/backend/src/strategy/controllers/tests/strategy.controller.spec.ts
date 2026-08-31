import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type {
  IEventBus,
  IJobQueue,
  IStrategy,
  IStrategyExecutionPort,
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
import { RequireAuth } from '../../../auth/require-auth.guard';

type StrategyVersioningMock = {
  createVersion: jest.Mock<StrategyVersioningService['createVersion']>;
  getVersion: jest.Mock<StrategyVersioningService['getVersion']>;
  getVersionsByName: jest.Mock<StrategyVersioningService['getVersionsByName']>;
  getAllVersions: jest.Mock<StrategyVersioningService['getAllVersions']>;
};

type JobQueueMock = {
  [K in keyof IJobQueue]: IJobQueue[K] extends (
    ...args: infer Args
  ) => infer Result
    ? jest.Mock<(...args: Args) => Result>
    : IJobQueue[K];
};

type EventBusMock = {
  [K in keyof IEventBus]: IEventBus[K] extends (
    ...args: infer Args
  ) => infer Result
    ? jest.Mock<(...args: Args) => Result>
    : IEventBus[K];
};

describe('StrategyController', () => {
  const USER_ID = 'f42a4238-8630-4c22-8a47-099028464d17';
  let controller: StrategyController;
  let registry: StrategyRegistry;
  let versioning: StrategyVersioningMock;
  let jobQueue: JobQueueMock;
  let eventBus: EventBusMock;
  let executionPort: jest.Mocked<IStrategyExecutionPort>;
  let prisma: PrismaService;
  let versions: StrategyVersion[];
  let findBacktestResult: jest.Mock<() => Promise<unknown>>;

  beforeEach(() => {
    registry = new StrategyRegistry();
    versions = [];

    const createVersion = jest.fn(
      (strategy: IStrategy): Promise<StrategyVersion> => {
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
        return Promise.resolve(version);
      },
    );

    versioning = {
      createVersion,
      getVersion: jest.fn((id: string) =>
        Promise.resolve(versions.find((candidate) => candidate.id === id)),
      ),
      getVersionsByName: jest.fn((name: string, userId?: string | null) => {
        void userId;
        return Promise.resolve(
          versions.filter((candidate) => candidate.name === name),
        );
      }),
      getAllVersions: jest.fn((userId?: string | null) => {
        void userId;
        return Promise.resolve(versions);
      }),
    };

    jobQueue = {
      enqueue: jest.fn<IJobQueue['enqueue']>((_type, payload) =>
        Promise.resolve({ jobId: payload.jobId }),
      ),
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
    executionPort = {
      resolveVersion: jest.fn<IStrategyExecutionPort['resolveVersion']>(),
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
      versioning as unknown as StrategyVersioningService,
      jobQueue,
      eventBus,
      executionPort,
      prisma,
    );
  });

  it('GET /api/strategies returns all registered strategies marked with isSystem and canDelete', async () => {
    const result = await controller.getAllStrategies(null);

    expect(result.length).toBeGreaterThanOrEqual(2);
    const ma = (result as Array<{ name: string; isSystem: boolean; canDelete: boolean }>).find(
      (strategy) => strategy.name === 'MovingAverage',
    );
    expect(ma).toBeDefined();
    expect(ma?.isSystem).toBe(true);
    expect(ma?.canDelete).toBe(false);
  });

  it('DELETE /api/strategies/:name throws 403 for system strategies in DB or registry', async () => {
    await expect(controller.deleteStrategy('MovingAverage', USER_ID)).rejects.toThrow(
      "Cannot delete system strategy 'MovingAverage'",
    );

    versions.push({
      id: randomUUID(),
      userId: null,
      strategyType: StrategyType.COMPOSITE,
      name: 'SystemComposite',
      version: 1,
      parameters: {},
      isComposite: true,
      childVersionIds: [],
      createdAt: new Date(),
    });

    await expect(controller.deleteStrategy('SystemComposite', USER_ID)).rejects.toThrow(
      "Cannot delete system strategy 'SystemComposite'",
    );
  });

  it('POST /api/strategies/composite registers and versions a composite', async () => {
    const result = await controller.createComposite(
      {
        name: 'TestComposite',
        childStrategyNames: ['MovingAverage', 'RelativeStrengthIndex'],
        combinerType: CombinerType.MAJORITY_VOTE,
      },
      USER_ID,
    );

    expect(result.strategy.name).toBe('TestComposite');
    // Composites are no longer automatically put in the global registry (ADR-0016 compliance)
    expect(registry.get('TestComposite')).toBeUndefined();
    expect(versioning.createVersion as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('resolves a private composite child with the authenticated user', async () => {
    const privateChild: StrategyVersion = {
      id: randomUUID(),
      userId: USER_ID,
      strategyType: StrategyType.COMPOSITE,
      name: 'PrivateChild',
      version: 1,
      parameters: {},
      isComposite: true,
      childVersionIds: [],
      createdAt: new Date(),
    };
    versions.push(privateChild);
    executionPort.resolveVersion.mockResolvedValue({
      version: privateChild,
      strategy: registry.get('MovingAverage')!,
    });

    await controller.createComposite(
      {
        name: 'ParentComposite',
        childStrategyNames: ['PrivateChild', 'RelativeStrengthIndex'],
        combinerType: CombinerType.MAJORITY_VOTE,
      },
      USER_ID,
    );

    expect(executionPort.resolveVersion).toHaveBeenCalledWith(
      privateChild.id,
      USER_ID,
    );
  });

  it('requires authentication for user-owned strategy writes and result polling', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, StrategyController.prototype.createComposite),
    ).toEqual([RequireAuth]);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, StrategyController.prototype.requestBacktest),
    ).toEqual([RequireAuth]);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, StrategyController.prototype.getBacktestResult),
    ).toEqual([RequireAuth]);
  });

  it('POST /api/strategies/backtest enqueues before publishing BacktestRequested', async () => {
    const result = await controller.requestBacktest(
      {
        strategyName: 'MovingAverage',
        pair: 'BTCUSDT',
        timeframe: '1h',
        startDate: new Date(),
        endDate: new Date(),
      },
      USER_ID,
    );

    expect(result.status).toBe(JobStatusValue.QUEUED);
    expect(jobQueue.enqueue as jest.Mock).toHaveBeenCalledWith(
      JobType.BACKTEST,
      expect.objectContaining({
        jobId: result.jobId,
        pair: 'BTCUSDT',
        strategyVersionId: result.strategyVersionId,
        userId: USER_ID,
      }),
      expect.any(String),
    );
    expect(eventBus.publish as jest.Mock).toHaveBeenCalledWith(
      EventType.BacktestRequested,
      expect.objectContaining({
        jobId: result.jobId,
        pair: 'BTCUSDT',
        userId: USER_ID,
      }),
      expect.any(String),
    );
    expect(jobQueue.enqueue.mock.invocationCallOrder[0]).toBeLessThan(
      eventBus.publish.mock.invocationCallOrder[0],
    );
  });

  it('GET /api/strategies/:id returns an immutable strategy version', async () => {
    const created = await controller.createComposite(
      {
        name: 'TestVersionById',
        childStrategyNames: ['MovingAverage', 'RelativeStrengthIndex'],
        combinerType: CombinerType.MAJORITY_VOTE,
      },
      null,
    );

    const version = await controller.getStrategyById(
      created.strategy.versionId,
      null,
    );

    expect(version.id).toBe(created.strategy.versionId);
    expect(version.name).toBe('TestVersionById');
  });

  it('GET /api/strategies/:name/versions returns created versions', async () => {
    await controller.requestBacktest(
      {
        strategyName: 'MovingAverage',
        pair: 'BTCUSDT',
        timeframe: '1h',
        startDate: new Date(),
        endDate: new Date(),
      },
      null,
    );

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

    const result = await controller.getBacktestResult(id, USER_ID);

    expect(result.id).toBe(id);
    expect(result.totalReturn).toBe(10.5);
    expect(result.winRate).toBe(0.6);
    expect(findBacktestResult).toHaveBeenCalledWith({
      where: {
        jobId: id,
        userId: USER_ID,
      },
    });
  });

  it('GET /api/strategies/backtest/:id throws 404 when absent', async () => {
    findBacktestResult.mockResolvedValue(null);

    await expect(
      controller.getBacktestResult('invalid_id', null),
    ).rejects.toThrow("BacktestResult 'invalid_id' not found");
  });
});
