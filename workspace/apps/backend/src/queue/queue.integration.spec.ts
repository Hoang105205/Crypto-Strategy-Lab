import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Queue,
  Worker as BullWorker,
  type ConnectionOptions,
  type Job,
} from 'bullmq';
import type Redis from 'ioredis';
import request from 'supertest';
import {
  BacktestSource,
  EventType,
  JobStatusValue,
  JobType,
  StrategyType,
  type BacktestResult,
  type BacktestResultCreateInput,
  type BacktestRequestedPayload,
  type Candle,
  type DeadLetterJob,
  type IBacktester,
  type IBacktestResultPort,
  type IEvaluator,
  type IEventBus,
  type IMarketDataService,
  type IStrategy,
  type IStrategyExecutionPort,
} from '@crypto-strategy-lab/shared';
import { PrismaService } from '../database/prisma.service';
import { IJOB_QUEUE } from '../shared/tokens';
import { BacktestWorker } from './backtest.worker';
import { BullMqJobQueue, type StoredBacktestJob } from './bullmq-job.queue';
import { createBullMqConfig } from './bullmq.config';
import { BullMqWorkerHost } from './bullmq-worker.host';
import { DeadLetterRepository } from './dead-letter.repository';
import { QueueController } from './queue.controller';
import { QueueError, QueueErrorCode } from './queue.errors';
import {
  createProducerRedisConnection,
  createWorkerRedisConnection,
  type OwnedRedisConnection,
} from './redis.connection';
import type { ValidatedEnvironment } from '../config/environment';

const REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const REDIS_DB = Number(process.env.REDIS_DB ?? 0);
const POLL_INTERVAL_MS = 20;
const DEFAULT_TIMEOUT_MS = 15_000;
const RETRY_TIMEOUT_MS = 20_000;

const START_DATE = new Date('2026-08-01T00:00:00.000Z');
const END_DATE = new Date('2026-08-02T00:00:00.000Z');
const STRATEGY_VERSION_ID = '69e1c401-810a-431f-b2d8-d9f732e7f829';

const candle: Candle = {
  symbol: 'BTCUSDT',
  timeframe: '1h',
  openTime: START_DATE,
  closeTime: END_DATE,
  open: 60_000,
  high: 61_000,
  low: 59_500,
  close: 60_500,
  volume: 125,
  isClosed: true,
};

const trades = [
  {
    entryDate: START_DATE,
    exitDate: END_DATE,
    entryPrice: 60_000,
    exitPrice: 61_000,
    side: 'LONG',
    pnl: 100,
    quantity: 0.1,
  },
];

const metrics = {
  totalReturn: 12.5,
  winRate: 0.6,
  maxDrawdown: -8,
  sharpeRatio: 1.4,
  profitFactor: 1.8,
  totalTrades: 1,
};

const strategy = {
  analyze: jest.fn(),
  getName: jest.fn(() => 'Moving Average'),
  getType: jest.fn(() => StrategyType.MA),
  getParameters: jest.fn(() => ({ period: 20 })),
} as unknown as IStrategy;

const resolvedStrategy = {
  version: {
    id: STRATEGY_VERSION_ID,
    strategyType: StrategyType.MA,
    name: 'Moving Average',
    version: 1,
    parameters: { period: 20 },
    isComposite: false,
    createdAt: START_DATE,
  },
  strategy,
};

type DeadLetterMirrorInput = Omit<DeadLetterJob, 'id' | 'resolvedAt'>;
type PublishedEvent = {
  type: string;
  payload: Record<string, unknown>;
  correlationId?: string;
};

class MemoryDeadLetters {
  private readonly rows = new Map<string, DeadLetterJob>();

  async mirror(
    input: DeadLetterMirrorInput,
  ): Promise<{ job: DeadLetterJob; created: boolean }> {
    const existing = this.rows.get(input.jobId);
    if (existing) return { job: existing, created: false };
    const job: DeadLetterJob = {
      id: randomUUID(),
      ...input,
      resolvedAt: null,
    };
    this.rows.set(input.jobId, job);
    return { job, created: true };
  }

  list(): Promise<DeadLetterJob[]> {
    return Promise.resolve(
      [...this.rows.values()].sort(
        (left, right) =>
          right.deadLetteredAt.getTime() - left.deadLetteredAt.getTime(),
      ),
    );
  }

  findUnresolved(jobId: string): Promise<DeadLetterJob | null> {
    const row = this.rows.get(jobId);
    return Promise.resolve(row && row.resolvedAt === null ? row : null);
  }

  async resolveAndRequeue(
    jobId: string,
    requeue: () => Promise<void>,
  ): Promise<void> {
    const row = this.rows.get(jobId);
    if (!row) throw new QueueError(QueueErrorCode.JOB_NOT_FOUND);
    if (row.resolvedAt) {
      throw new QueueError(QueueErrorCode.JOB_ALREADY_RESOLVED);
    }
    await requeue();
    row.resolvedAt = new Date();
  }
}

class ApprovedPortFakes {
  readonly trace: string[] = [];
  readonly events: PublishedEvent[] = [];
  readonly results = new Map<string, BacktestResult>();
  readonly marketData: jest.Mocked<IMarketDataService>;
  readonly strategyExecution: jest.Mocked<IStrategyExecutionPort>;
  readonly backtester: jest.Mocked<IBacktester>;
  readonly evaluator: jest.Mocked<IEvaluator>;
  readonly resultPort: jest.Mocked<IBacktestResultPort>;
  readonly eventBus: jest.Mocked<IEventBus>;
  readonly deadLetters = new MemoryDeadLetters();

  constructor() {
    const publish = jest.fn(
      (eventType: string, payload: unknown, correlationId?: string) => {
        const eventPayload = payload as Record<string, unknown>;
        this.trace.push(
          `event:${eventType}:${String(eventPayload.jobId ?? '')}`,
        );
        this.events.push({
          type: eventType,
          payload: eventPayload,
          correlationId,
        });
      },
    );
    this.marketData = {
      getCandles: jest.fn(),
      getCandlesRange: jest.fn(async () => [candle]),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    this.strategyExecution = {
      resolveVersion: jest.fn(async () => resolvedStrategy),
    };
    this.backtester = { run: jest.fn(() => trades) };
    this.evaluator = { evaluate: jest.fn(() => metrics) };
    this.resultPort = {
      save: jest.fn((input) => this.saveResult(input)),
      getById: jest.fn((id) => {
        const result = [...this.results.values()].find(
          (candidate) => candidate.id === id,
        );
        return Promise.resolve(
          result
            ? { ...result, strategyVersion: resolvedStrategy.version }
            : null,
        );
      }),
    };
    this.eventBus = {
      publish,
      subscribe: jest.fn<IEventBus['subscribe']>(),
      unsubscribe: jest.fn<IEventBus['unsubscribe']>(),
    } as unknown as jest.Mocked<IEventBus>;
  }

  private async saveResult(
    input: BacktestResultCreateInput,
  ): Promise<BacktestResult> {
    const existing = this.results.get(input.jobId);
    if (existing) return existing;
    this.trace.push(`save:${input.jobId}`);
    const result = { id: randomUUID(), ...input };
    this.results.set(input.jobId, result);
    return result;
  }

  completionEvents(): PublishedEvent[] {
    return this.events.filter(
      ({ type }) => type === EventType.BacktestCompleted,
    );
  }

  terminalEvents(): PublishedEvent[] {
    return this.events.filter(
      ({ type }) =>
        type === EventType.BacktestFailed ||
        type === EventType.BacktestDeadLettered,
    );
  }
}

class RedisQueueHarness {
  readonly queueName = `csl-t020-${process.pid}-${randomUUID()}`;
  readonly environment: ValidatedEnvironment;
  readonly inspector: Queue<StoredBacktestJob>;
  adapter!: BullMqJobQueue;
  workerHost?: BullMqWorkerHost;
  workerOwner?: OwnedRedisConnection<Redis>;
  private producerOwner?: OwnedRedisConnection<Redis>;
  private readonly processor: BacktestWorker;

  constructor(
    readonly ports = new ApprovedPortFakes(),
    retentionCount = 100,
  ) {
    this.environment = {
      REDIS_HOST,
      REDIS_PORT,
      REDIS_DB,
      BACKTEST_QUEUE_NAME: this.queueName,
      BACKTEST_WORKER_CONCURRENCY: 3,
      BACKTEST_MAX_ATTEMPTS: 3,
      BACKTEST_JOB_RETENTION_AGE_SECONDS: 60,
      BACKTEST_JOB_RETENTION_COUNT: retentionCount,
      LEADERBOARD_TOP_K: 10,
    };
    this.inspector = new Queue<StoredBacktestJob>(this.queueName, {
      connection: redisConnection(),
    });
    this.processor = new BacktestWorker(
      ports.marketData,
      ports.strategyExecution,
      ports.backtester,
      ports.evaluator,
      ports.resultPort,
      ports.eventBus,
      ports.deadLetters as unknown as DeadLetterRepository,
    );
    this.createAdapter();
  }

  payload(
    source: BacktestSource = BacktestSource.USER,
    jobId = randomUUID(),
  ): BacktestRequestedPayload {
    return {
      jobId,
      strategyVersionId: STRATEGY_VERSION_ID,
      pair: 'BTCUSDT',
      timeframe: '1h',
      startDate: START_DATE,
      endDate: END_DATE,
      backtestConfig: {
        initialCapital: 10_000,
        positionSizePercent: 25,
        commission: 0.1,
        slippage: 0.05,
      },
      source,
      loopRunId: source === BacktestSource.SEARCH_LOOP ? randomUUID() : null,
    } as BacktestRequestedPayload;
  }

  async enqueue(payload: BacktestRequestedPayload): Promise<void> {
    await this.adapter.enqueue(JobType.BACKTEST, payload, randomUUID());
  }

  process(job: Job<StoredBacktestJob>): Promise<void> {
    return this.processor.process(job);
  }

  startWorker(concurrency = 3): void {
    if (this.workerHost) throw new Error('Worker is already running');
    const config = {
      ...createBullMqConfig({
        ...this.environment,
        BACKTEST_WORKER_CONCURRENCY: concurrency,
      }),
      concurrency,
    };
    this.workerOwner = createWorkerRedisConnection(this.environment);
    this.workerHost = new BullMqWorkerHost({
      config,
      connection: this.workerOwner.client as unknown as ConnectionOptions,
      connectionOwner: this.workerOwner,
      processor: this.processor,
    });
  }

  stopWorker(): Promise<void> {
    const worker = this.workerHost;
    this.workerHost = undefined;
    this.workerOwner = undefined;
    return worker?.close() ?? Promise.resolve();
  }

  async restartApplicationResources(): Promise<void> {
    await this.stopWorker();
    await this.adapter.close();
    this.createAdapter();
  }

  async close(): Promise<void> {
    await this.stopWorker();
    await this.inspector.obliterate({ force: true });
    await this.adapter.close();
    await this.inspector.close();
  }

  private createAdapter(): void {
    const config = createBullMqConfig(this.environment);
    this.producerOwner = createProducerRedisConnection(this.environment);
    this.adapter = new BullMqJobQueue({
      queueName: this.queueName,
      connection: this.producerOwner.client as unknown as ConnectionOptions,
      maxAttempts: config.attempts,
      retryDelaysMs: config.retryDelaysMs,
      retention: {
        ageSeconds: this.environment.BACKTEST_JOB_RETENTION_AGE_SECONDS,
        count: this.environment.BACKTEST_JOB_RETENTION_COUNT,
      },
      connectionOwner: this.producerOwner,
    });
  }
}

describe('Phase 2 production BullMQ integration checkpoint (T020)', () => {
  const harnesses: RedisQueueHarness[] = [];

  beforeAll(async () => {
    if (!(await canReachRedis())) {
      throw new Error(
        'T020 Redis prerequisite unavailable. Start Redis 7 from workspace with docker compose up -d redis.',
      );
    }
  });

  afterEach(async () => {
    await Promise.allSettled(
      harnesses.splice(0).map((harness) => harness.close()),
    );
  });

  const createHarness = (retentionCount = 100): RedisQueueHarness => {
    const harness = new RedisQueueHarness(
      new ApprovedPortFakes(),
      retentionCount,
    );
    harnesses.push(harness);
    return harness;
  };

  it('runs USER before SEARCH_LOOP and preserves FIFO within each priority', async () => {
    const harness = createHarness();
    const searchFirst = harness.payload(BacktestSource.SEARCH_LOOP);
    const searchSecond = harness.payload(BacktestSource.SEARCH_LOOP);
    const userFirst = harness.payload();
    const userSecond = harness.payload();
    for (const payload of [searchFirst, searchSecond, userFirst, userSecond]) {
      await harness.enqueue(payload);
    }

    harness.startWorker(1);
    await waitFor(
      () => harness.ports.completionEvents().length === 4,
      'four prioritized completion events',
    );

    expect(
      harness.ports.completionEvents().map(({ payload }) => payload.jobId),
    ).toEqual([
      userFirst.jobId,
      userSecond.jobId,
      searchFirst.jobId,
      searchSecond.jobId,
    ]);
  });

  it('reaches peak concurrency three, never exceeds it, and leaves excess jobs queued', async () => {
    const harness = createHarness();
    const gate = deferred<void>();
    let active = 0;
    let peak = 0;
    let started = 0;
    harness.ports.marketData.getCandlesRange.mockImplementation(async () => {
      active += 1;
      started += 1;
      peak = Math.max(peak, active);
      await gate.promise;
      active -= 1;
      return [candle];
    });
    const payloads = Array.from({ length: 5 }, () => harness.payload());
    for (const payload of payloads) await harness.enqueue(payload);

    harness.startWorker(3);
    await waitFor(() => started === 3, 'exactly three concurrent executions');
    await expect(harness.adapter.getStats()).resolves.toMatchObject({
      queued: 2,
      processing: 3,
    });
    expect(peak).toBe(3);

    gate.resolve();
    await waitFor(
      () => harness.ports.completionEvents().length === 5,
      'all five jobs to complete',
    );
    expect(peak).toBe(3);
  });

  it('rehydrates Redis payload dates and saves the result before completion publication', async () => {
    const harness = createHarness();
    const payload = harness.payload();
    await harness.enqueue(payload);
    harness.startWorker(1);

    await waitFor(
      () => harness.ports.completionEvents().length === 1,
      'successful completion',
    );

    const [marketCall] = harness.ports.marketData.getCandlesRange.mock.calls;
    expect(marketCall[2]).toBeInstanceOf(Date);
    expect(marketCall[3]).toBeInstanceOf(Date);
    expect(harness.ports.trace.indexOf(`save:${payload.jobId}`)).toBeLessThan(
      harness.ports.trace.indexOf(
        `event:${EventType.BacktestCompleted}:${payload.jobId}`,
      ),
    );
    await expect(
      harness.adapter.getStatus(payload.jobId),
    ).resolves.toMatchObject({
      status: JobStatusValue.COMPLETED,
    });
  });

  it(
    'survives application-resource restart for waiting and delayed jobs with the same jobId',
    async () => {
      const harness = createHarness();
      const waiting = harness.payload();
      await harness.enqueue(waiting);
      await harness.restartApplicationResources();
      harness.startWorker(1);
      await waitFor(
        async () =>
          (await harness.inspector.getJobState(waiting.jobId)) === 'completed',
        'waiting job after application restart',
      );

      const delayed = harness.payload();
      let attempts = 0;
      harness.ports.backtester.run.mockImplementation(() => {
        attempts += 1;
        if (attempts === 1) throw new Error('transient restart fixture');
        return trades;
      });
      await harness.enqueue(delayed);
      await waitFor(
        async () =>
          (await harness.inspector.getJobState(delayed.jobId)) === 'delayed',
        'job to enter delayed retry',
      );
      await harness.restartApplicationResources();
      harness.startWorker(1);
      await waitFor(
        async () =>
          (await harness.inspector.getJobState(delayed.jobId)) === 'completed',
        'delayed job after application restart',
      );

      const stored = await harness.inspector.getJob(delayed.jobId);
      expect(stored?.id).toBe(delayed.jobId);
      expect(stored?.attemptsMade).toBe(2);
    },
    RETRY_TIMEOUT_MS,
  );

  it(
    'executes three attempts with 1s/4s waits and emits one terminal pair plus one DLQ mirror',
    async () => {
      const harness = createHarness();
      const payload = harness.payload();
      const executionTimes: number[] = [];
      harness.ports.backtester.run.mockImplementation(() => {
        executionTimes.push(Date.now());
        throw new Error('permanent algorithm failure');
      });
      await harness.enqueue(payload);
      harness.startWorker(1);

      await waitFor(
        async () =>
          (await harness.inspector.getJobState(payload.jobId)) === 'failed',
        'terminal failed job',
        RETRY_TIMEOUT_MS,
      );

      expect(executionTimes).toHaveLength(3);
      expect(executionTimes[1] - executionTimes[0]).toBeGreaterThanOrEqual(850);
      expect(executionTimes[2] - executionTimes[1]).toBeGreaterThanOrEqual(
        3_800,
      );
      expect(harness.ports.terminalEvents().map(({ type }) => type)).toEqual([
        EventType.BacktestFailed,
        EventType.BacktestDeadLettered,
      ]);
      await expect(harness.ports.deadLetters.list()).resolves.toHaveLength(1);
      await expect(
        harness.adapter.getStatus(payload.jobId),
      ).resolves.toMatchObject({
        status: JobStatusValue.DEAD_LETTER,
        attempt: 3,
      });
    },
    RETRY_TIMEOUT_MS,
  );

  it('skips retries for zero candles and creates terminal effects exactly once', async () => {
    const harness = createHarness();
    const payload = harness.payload();
    harness.ports.marketData.getCandlesRange.mockResolvedValue([]);
    await harness.enqueue(payload);
    harness.startWorker(1);

    await waitFor(
      async () =>
        (await harness.inspector.getJobState(payload.jobId)) === 'failed',
      'non-retryable terminal job',
    );

    expect(harness.ports.marketData.getCandlesRange).toHaveBeenCalledTimes(1);
    expect(harness.ports.backtester.run).not.toHaveBeenCalled();
    expect(harness.ports.terminalEvents()).toHaveLength(2);
    await expect(harness.ports.deadLetters.list()).resolves.toHaveLength(1);
    await expect(
      harness.adapter.getStatus(payload.jobId),
    ).resolves.toMatchObject({
      status: JobStatusValue.DEAD_LETTER,
      attempt: 1,
    });
  });

  it('coalesces a Redis-backed duplicate delivery without duplicate result or completion side effects', async () => {
    const harness = createHarness();
    const payload = harness.payload();
    await harness.enqueue(payload);
    const stored = await harness.inspector.getJob(payload.jobId);
    if (!stored) throw new Error('Integration fixture did not store the job');

    const gate = deferred<void>();
    harness.ports.resultPort.save.mockImplementation(async (input) => {
      harness.ports.trace.push(`save:${input.jobId}`);
      await gate.promise;
      const result = { id: randomUUID(), ...input };
      harness.ports.results.set(input.jobId, result);
      return result;
    });
    const first = harness.process(stored);
    const duplicate = harness.process(stored);
    await waitFor(
      () => harness.ports.resultPort.save.mock.calls.length === 1,
      'one duplicate-delivery save claim',
    );
    gate.resolve();
    await Promise.all([first, duplicate]);

    expect(harness.ports.resultPort.save).toHaveBeenCalledTimes(1);
    expect(harness.ports.results.size).toBe(1);
    expect(harness.ports.completionEvents()).toHaveLength(1);
  });

  it(
    'recovers a real BullMQ stalled lock without duplicate result or completion effects',
    async () => {
      const harness = createHarness();
      const payload = harness.payload();
      const gate = deferred<void>();
      harness.ports.resultPort.save.mockImplementation(async (input) => {
        harness.ports.trace.push(`save:${input.jobId}`);
        await gate.promise;
        const result = { id: randomUUID(), ...input };
        harness.ports.results.set(input.jobId, result);
        return result;
      });
      await harness.enqueue(payload);

      let stalled = false;
      let recoveryClaimed = false;
      let recoveryWorker: BullWorker<StoredBacktestJob> | undefined;
      const stallingWorker = new BullWorker<StoredBacktestJob>(
        harness.queueName,
        (job) => harness.process(job),
        {
          connection: {
            host: REDIS_HOST,
            port: REDIS_PORT,
            db: REDIS_DB,
            maxRetriesPerRequest: null,
          },
          concurrency: 1,
          lockDuration: 200,
          stalledInterval: 200,
          skipLockRenewal: true,
          maxStalledCount: 1,
        },
      );
      stallingWorker.on('error', () => undefined);
      stallingWorker.on('stalled', (jobId) => {
        if (jobId === payload.jobId) stalled = true;
      });

      try {
        await waitFor(
          () => harness.ports.resultPort.save.mock.calls.length === 1,
          'initial stalled execution to reach result persistence',
        );
        // Prevent the deliberately stalling worker from reclaiming its own job.
        // Starting the recovery worker only after this barrier makes worker
        // ownership deterministic even when the whole backend suite is busy.
        await stallingWorker.pause(true);
        recoveryWorker = new BullWorker<StoredBacktestJob>(
          harness.queueName,
          (job) => harness.process(job),
          {
            connection: {
              host: REDIS_HOST,
              port: REDIS_PORT,
              db: REDIS_DB,
              maxRetriesPerRequest: null,
            },
            concurrency: 1,
            lockDuration: 2_000,
            stalledInterval: 200,
          },
        );
        recoveryWorker.on('error', () => undefined);
        recoveryWorker.on('stalled', (jobId) => {
          if (jobId === payload.jobId) stalled = true;
        });
        recoveryWorker.on('active', (job) => {
          if (job.id === payload.jobId && stalled) recoveryClaimed = true;
        });
        await waitFor(
          () => stalled && recoveryClaimed,
          'BullMQ stalled event and recovered claim',
        );
        gate.resolve();
        await waitFor(
          async () =>
            (await harness.inspector.getJobState(payload.jobId)) ===
            'completed',
          'recovered stalled job completion',
        );

        expect(harness.ports.resultPort.save).toHaveBeenCalledTimes(1);
        expect(harness.ports.results.size).toBe(1);
        expect(harness.ports.completionEvents()).toHaveLength(1);
      } finally {
        gate.resolve();
        await Promise.allSettled([
          stallingWorker.close(true),
          recoveryWorker?.close(true) ?? Promise.resolve(),
        ]);
      }
    },
    DEFAULT_TIMEOUT_MS,
  );

  it('coalesces a Redis-backed terminal redelivery into one mirror and one terminal event pair', async () => {
    const harness = createHarness();
    const payload = harness.payload(BacktestSource.SEARCH_LOOP);
    harness.ports.marketData.getCandlesRange.mockResolvedValue([]);
    await harness.enqueue(payload);
    const stored = await harness.inspector.getJob(payload.jobId);
    if (!stored) throw new Error('Integration fixture did not store the job');

    const outcomes = await Promise.allSettled([
      harness.process(stored),
      harness.process(stored),
    ]);

    expect(outcomes.every(({ status }) => status === 'rejected')).toBe(true);
    await expect(harness.ports.deadLetters.list()).resolves.toHaveLength(1);
    expect(harness.ports.terminalEvents().map(({ type }) => type)).toEqual([
      EventType.BacktestFailed,
      EventType.BacktestDeadLettered,
    ]);
  });

  it('fails producer operations fast with stable QUEUE_UNAVAILABLE', async () => {
    const unavailableEnvironment: ValidatedEnvironment = {
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: 1,
      REDIS_DB,
      BACKTEST_QUEUE_NAME: `csl-t020-unavailable-${randomUUID()}`,
      BACKTEST_WORKER_CONCURRENCY: 3,
      BACKTEST_MAX_ATTEMPTS: 3,
      BACKTEST_JOB_RETENTION_AGE_SECONDS: 60,
      BACKTEST_JOB_RETENTION_COUNT: 10,
      LEADERBOARD_TOP_K: 10,
    };
    const unavailableOwner = createProducerRedisConnection(
      unavailableEnvironment,
    );
    const unavailable = new BullMqJobQueue({
      queueName: unavailableEnvironment.BACKTEST_QUEUE_NAME,
      connection: unavailableOwner.client as unknown as ConnectionOptions,
      maxAttempts: 3,
      retryDelaysMs: [1_000, 4_000],
      retention: { ageSeconds: 60, count: 10 },
      connectionOwner: unavailableOwner,
    });
    const enqueueStartedAt = Date.now();
    await expect(
      unavailable.enqueue(JobType.BACKTEST, createHarness().payload()),
    ).rejects.toMatchObject({ code: QueueErrorCode.QUEUE_UNAVAILABLE });
    expect(Date.now() - enqueueStartedAt).toBeLessThan(3_000);
    await unavailableOwner.close();
    await unavailable.close();
  });

  it(
    'recovers the persistent worker connection after a transport interruption',
    async () => {
      const harness = createHarness();
      harness.startWorker(1);
      const workerClient = harness.workerOwner?.client;
      if (!workerClient) throw new Error('Worker Redis owner was not created');
      await waitFor(
        () => workerClient.status === 'ready',
        'initial worker Redis readiness',
      );
      let reconnectObserved = false;
      workerClient.once('reconnecting', () => {
        reconnectObserved = true;
      });
      const transport = (
        workerClient as unknown as {
          connector: { stream?: { destroy(): void } };
        }
      ).connector.stream;
      if (!transport) throw new Error('Worker Redis transport is unavailable');
      transport.destroy();
      await waitFor(
        () => reconnectObserved && workerClient.status === 'ready',
        'persistent worker Redis reconnect',
      );
      const payload = harness.payload();
      await harness.enqueue(payload);
      await waitFor(
        async () =>
          (await harness.inspector.getJobState(payload.jobId)) === 'completed',
        'job after worker reconnect',
      );
    },
    DEFAULT_TIMEOUT_MS,
  );

  it('graceful shutdown finishes active work, takes no new job, and leaves waiting work recoverable', async () => {
    const harness = createHarness();
    const first = harness.payload();
    const second = harness.payload();
    const gate = deferred<void>();
    let executions = 0;
    harness.ports.marketData.getCandlesRange.mockImplementation(async () => {
      executions += 1;
      if (executions === 1) await gate.promise;
      return [candle];
    });
    await harness.enqueue(first);
    await harness.enqueue(second);
    harness.startWorker(1);
    await waitFor(() => executions === 1, 'active job before shutdown');

    let closed = false;
    const closing = harness.stopWorker().then(() => {
      closed = true;
    });
    await waitFor(
      async () =>
        ['waiting', 'prioritized'].includes(
          await harness.inspector.getJobState(second.jobId),
        ),
      'second job to remain waiting during shutdown',
    );
    expect(closed).toBe(false);
    gate.resolve();
    await closing;
    expect(executions).toBe(1);

    harness.startWorker(1);
    await waitFor(
      async () =>
        (await harness.inspector.getJobState(second.jobId)) === 'completed',
      'waiting job after graceful restart',
    );
  });

  it('lists a DLQ job over REST, manually retries with reset attempts, and preserves identity', async () => {
    const harness = createHarness();
    const payload = harness.payload();
    harness.ports.marketData.getCandlesRange.mockResolvedValue([]);
    await harness.enqueue(payload);
    harness.startWorker(1);
    await waitFor(
      async () =>
        (await harness.inspector.getJobState(payload.jobId)) === 'failed',
      'DLQ job before REST recovery',
    );
    await harness.stopWorker();

    const module = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        { provide: IJOB_QUEUE, useValue: harness.adapter },
        {
          provide: DeadLetterRepository,
          useValue: harness.ports.deadLetters,
        },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    const app: INestApplication = module.createNestApplication();
    await app.init();
    try {
      await request(app.getHttpServer())
        .get('/api/queue/dead-letter')
        .expect(200)
        .expect((response) => {
          expect(response.body).toHaveLength(1);
          expect(response.body[0]).toMatchObject({
            jobId: payload.jobId,
            attempts: 1,
          });
        });
      await request(app.getHttpServer())
        .post(`/api/queue/dead-letter/${payload.jobId}/retry`)
        .expect(200)
        .expect({ jobId: payload.jobId, status: JobStatusValue.QUEUED });
    } finally {
      await app.close();
    }

    const retried = await harness.inspector.getJob(payload.jobId);
    expect(retried?.id).toBe(payload.jobId);
    expect(retried?.attemptsMade).toBe(0);
    expect(retried?.data.payload).toMatchObject({
      ...payload,
      startDate: payload.startDate.toISOString(),
      endDate: payload.endDate.toISOString(),
    });
    expect(['waiting', 'prioritized']).toContain(await retried?.getState());

    harness.ports.marketData.getCandlesRange.mockResolvedValue([candle]);
    harness.startWorker(1);
    await waitFor(
      async () =>
        (await harness.inspector.getJobState(payload.jobId)) === 'completed',
      'manually retried job to complete',
    );
  });

  it('enforces bounded completed retention by configured count and age options', async () => {
    const harness = createHarness(2);
    const payloads = Array.from({ length: 5 }, () => harness.payload());
    for (const payload of payloads) await harness.enqueue(payload);
    harness.startWorker(3);
    await waitFor(
      () => harness.ports.completionEvents().length === 5,
      'five retained-policy completions',
    );
    await waitFor(
      async () =>
        (await harness.inspector.getJobCountByTypes('completed')) === 2,
      'completed retention count to converge',
    );

    const retained = await harness.inspector.getJobs(['completed']);
    expect(retained).toHaveLength(2);
    for (const job of retained) {
      expect(job.opts.removeOnComplete).toEqual({ age: 60, count: 2 });
      expect(job.opts.removeOnFail).toEqual({ age: 60, count: 2 });
    }
  });
});

function redisConnection(): ConnectionOptions {
  return { host: REDIS_HOST, port: REDIS_PORT, db: REDIS_DB };
}

function canReachRedis(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({
      host: REDIS_HOST,
      port: REDIS_PORT,
      timeout: 300,
    });
    let settled = false;
    const finish = (available: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(available);
    };
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  description: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch (error: unknown) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  const detail =
    lastError instanceof Error ? ` Last observation: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${description}.${detail}`);
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
