import { HttpException } from '@nestjs/common';
import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  EventType,
  JobStatusValue,
  JobType,
  StrategyType,
  type IEventBus,
  type IJobQueue,
  type IStrategy,
  type StrategyVersion,
} from '@crypto-strategy-lab/shared';
import { StrategyController } from './strategy.controller';

const VERSION: StrategyVersion = {
  id: '69e1c401-810a-431f-b2d8-d9f732e7f829',
  strategyType: StrategyType.MA,
  name: 'MovingAverage',
  version: 1,
  parameters: { period: 14 },
  isComposite: false,
  createdAt: new Date('2026-08-16T00:00:00.000Z'),
};
const STRATEGY = {
  getName: () => VERSION.name,
  getType: () => VERSION.strategyType,
  getParameters: () => VERSION.parameters,
  analyze: jest.fn(),
} as unknown as IStrategy;

describe('StrategyController USER queue producer (T019)', () => {
  let jobQueue: jest.Mocked<IJobQueue>;
  let eventBus: jest.Mocked<IEventBus>;
  let enqueueAccepted: () => void;
  let controller: StrategyController;

  beforeEach(() => {
    jobQueue = {
      enqueue: jest.fn<IJobQueue['enqueue']>(
        () =>
          new Promise<{ jobId: string }>((resolve) => {
            enqueueAccepted = () => resolve({ jobId: 'accepted' });
          }),
      ),
      getStatus: jest.fn<IJobQueue['getStatus']>(),
      retry: jest.fn<IJobQueue['retry']>(),
      deadLetter: jest.fn<IJobQueue['deadLetter']>(),
      getStats: jest.fn<IJobQueue['getStats']>(),
    };
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    } as unknown as jest.Mocked<IEventBus>;

    controller = new StrategyController(
      { get: jest.fn(() => STRATEGY) } as never,
      { createVersion: jest.fn(async () => VERSION) } as never,
      jobQueue,
      eventBus,
      {} as never,
    );
  });

  it('generates identities, awaits durable enqueue, then publishes BacktestRequested', async () => {
    const request = controller.requestBacktest({
      strategyName: VERSION.name,
      pair: 'BTCUSDT',
      timeframe: '1h',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-08-02T00:00:00.000Z'),
    });

    await waitFor(() => jobQueue.enqueue.mock.calls.length === 1);
    expect(eventBus.publish).not.toHaveBeenCalled();
    const [jobType, payload, correlationId] = jobQueue.enqueue.mock.calls[0];
    expect(jobType).toBe(JobType.BACKTEST);
    expect(payload.jobId).toMatch(UUID_PATTERN);
    expect(correlationId).toMatch(UUID_PATTERN);
    enqueueAccepted();

    await expect(request).resolves.toEqual({
      jobId: payload.jobId,
      strategyVersionId: VERSION.id,
      status: JobStatusValue.QUEUED,
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      EventType.BacktestRequested,
      payload,
      correlationId,
    );
    expect(jobQueue.enqueue.mock.invocationCallOrder[0]).toBeLessThan(
      eventBus.publish.mock.invocationCallOrder[0],
    );
  });

  it('returns stable 503 and publishes nothing when Redis does not accept enqueue', async () => {
    jobQueue.enqueue.mockRejectedValueOnce(
      new Error('redis://worker:secret@redis.internal:6379'),
    );

    try {
      await controller.requestBacktest({
        strategyName: VERSION.name,
        pair: 'BTCUSDT',
        timeframe: '1h',
        startDate: new Date(),
        endDate: new Date(),
      });
      throw new Error('Expected requestBacktest to reject');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      const response = (error as HttpException).getResponse();
      expect((error as HttpException).getStatus()).toBe(503);
      expect(response).toEqual({
        error: 'Queue service is unavailable',
        code: 'QUEUE_UNAVAILABLE',
      });
      expect(JSON.stringify(response)).not.toContain('secret');
    }
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for producer operation');
}
