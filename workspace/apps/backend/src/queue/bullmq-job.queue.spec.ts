import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import {
  Queue,
  UnrecoverableError,
  Worker,
  type ConnectionOptions,
  type Job,
} from 'bullmq';
import {
  BacktestSource,
  JobStatusValue,
  JobType,
  type BacktestRequestedPayload,
  type IJobQueue,
  type SearchLoopBacktestRequestedPayload,
  type UserBacktestRequestedPayload,
} from '@crypto-strategy-lab/shared';

/**
 * T012 is an executable RED specification. The production target is introduced
 * by T015, so the target module is loaded dynamically to keep this file
 * type-checkable before that implementation exists.
 */
const TARGET_FILE = join(__dirname, 'bullmq-job.queue.ts');
const TARGET_MODULE = join(__dirname, 'bullmq-job.queue');
const TARGET_EXISTS = existsSync(TARGET_FILE);

const REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const REDIS_DB = Number(process.env.REDIS_DB ?? 0);
const TEST_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 20;
const RETENTION_AGE_SECONDS = 60;
const RETENTION_COUNT = 2;

const REDIS_PREREQUISITE =
  'T012 Redis prerequisite unavailable. Start Redis 7 before running the ' +
  'adapter behavior matrix (from workspace/: docker compose up -d redis).';

interface StoredBacktestJob {
  jobType: JobType.BACKTEST;
  payload: BacktestRequestedPayload;
  correlationId: string;
}

interface BullMqJobQueueOptions {
  queueName: string;
  connection: ConnectionOptions;
  maxAttempts: 3;
  retryDelaysMs: readonly [1_000, 4_000];
  retention: {
    ageSeconds: number;
    count: number;
  };
}

type TestableJobQueue = IJobQueue & {
  close?: () => Promise<void>;
};

type BullMqJobQueueConstructor = new (
  options: BullMqJobQueueOptions,
) => TestableJobQueue;

interface BullMqJobQueueModule {
  BullMqJobQueue?: BullMqJobQueueConstructor;
}

interface AdapterHarness {
  adapter: TestableJobQueue;
  inspector: Queue<StoredBacktestJob>;
  queueName: string;
}

const producerConnection: ConnectionOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  db: REDIS_DB,
};

const workerConnection: ConnectionOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  db: REDIS_DB,
  maxRetriesPerRequest: null,
};

const strategyVersionId = '69e1c401-810a-431f-b2d8-d9f732e7f829';
const loopRunId = 'dc492a14-ee46-4748-9ef9-3c364689d20d';
const correlationId = '2660f14b-c12a-4cc1-a33f-a6e48b51ac9a';
const startDate = new Date('2026-08-01T00:00:00.000Z');
const endDate = new Date('2026-08-02T00:00:00.000Z');

const userPayload = (
  jobId: string = randomUUID(),
): UserBacktestRequestedPayload => ({
  jobId,
  strategyVersionId,
  pair: 'BTCUSDT',
  timeframe: '1h',
  startDate,
  endDate,
  backtestConfig: {
    initialCapital: 10_000,
    positionSizePercent: 25,
    commission: 0.1,
    slippage: 0.05,
  },
  source: BacktestSource.USER,
  loopRunId: null,
});

const searchLoopPayload = (
  jobId: string = randomUUID(),
): SearchLoopBacktestRequestedPayload => ({
  ...userPayload(jobId),
  source: BacktestSource.SEARCH_LOOP,
  loopRunId,
});

const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  description: string,
  timeoutMs = TEST_TIMEOUT_MS,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (error: unknown) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const suffix =
    lastError instanceof Error ? ` Last observation: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${description}.${suffix}`);
};

const expectRejectedCode = async (
  operation: Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation;
  } catch (error: unknown) {
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected operation to reject with code ${code}`);
};

const loadTarget = (): BullMqJobQueueConstructor => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const target = require(TARGET_MODULE) as BullMqJobQueueModule;
  if (typeof target.BullMqJobQueue !== 'function') {
    throw new Error(
      'T012 RED: bullmq-job.queue.ts must export BullMqJobQueue implementing IJobQueue.',
    );
  }
  return target.BullMqJobQueue;
};

const canReachRedis = (): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = createConnection({
      host: REDIS_HOST,
      port: REDIS_PORT,
      timeout: 300,
    });
    let settled = false;

    const finish = (available: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(available);
    };

    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });

describe('BullMqJobQueue Redis-backed contract (T012)', () => {
  let redisAvailable = false;

  beforeAll(async () => {
    redisAvailable = await canReachRedis();
    if (!redisAvailable) {
      console.warn(REDIS_PREREQUISITE);
    }
  });

  it('has the production BullMqJobQueue target required by ADR-0013', () => {
    if (!TARGET_EXISTS) {
      throw new Error(
        'T012 RED: BullMqJobQueue production capability is not implemented yet. ' +
          'T015 must add src/queue/bullmq-job.queue.ts; this is not a test import-path failure.',
      );
    }

    expect(loadTarget()).toBeDefined();
  });

  const describeWithTarget = TARGET_EXISTS ? describe : describe.skip;

  describeWithTarget(
    'production adapter behavior against isolated Redis state',
    () => {
      let Target: BullMqJobQueueConstructor;
      let harness: AdapterHarness | undefined;
      const workers: Array<Worker<StoredBacktestJob>> = [];
      const pendingReleases: Array<() => void> = [];

      const createHarness = (
        connection: ConnectionOptions = producerConnection,
      ): AdapterHarness => {
        const queueName = `csl-t012-${process.pid}-${randomUUID()}`;
        const options: BullMqJobQueueOptions = {
          queueName,
          connection,
          maxAttempts: 3,
          retryDelaysMs: [1_000, 4_000],
          retention: {
            ageSeconds: RETENTION_AGE_SECONDS,
            count: RETENTION_COUNT,
          },
        };
        const adapter = new Target(options);
        const inspector = new Queue<StoredBacktestJob>(queueName, {
          connection: producerConnection,
        });

        harness = { adapter, inspector, queueName };
        return harness;
      };

      const startWorker = (
        queueName: string,
        processor: (job: Job<StoredBacktestJob>) => Promise<unknown>,
        customBackoff?: () => number,
      ): Worker<StoredBacktestJob> => {
        const worker = new Worker<StoredBacktestJob>(queueName, processor, {
          connection: workerConnection,
          ...(customBackoff
            ? { settings: { backoffStrategy: customBackoff } }
            : {}),
        });
        worker.on('error', () => undefined);
        workers.push(worker);
        return worker;
      };

      const closeWorker = async (
        worker: Worker<StoredBacktestJob>,
      ): Promise<void> => {
        const index = workers.indexOf(worker);
        if (index >= 0) {
          workers.splice(index, 1);
        }
        await worker.close();
      };

      beforeAll(() => {
        if (!redisAvailable) {
          throw new Error(REDIS_PREREQUISITE);
        }
        Target = loadTarget();
      });

      afterEach(async () => {
        for (const release of pendingReleases.splice(0)) {
          release();
        }
        await Promise.allSettled(
          workers.splice(0).map((worker) => worker.close()),
        );

        if (harness) {
          if (harness.adapter.close) {
            await harness.adapter.close();
          }
          await harness.inspector.obliterate({ force: true });
          await harness.inspector.close();
          harness = undefined;
        }
      });

      describe('payload validation', () => {
        it.each([
          {
            name: 'empty jobId',
            payload: userPayload(''),
          },
          {
            name: 'non-UUID jobId',
            payload: userPayload('not-a-uuid'),
          },
          {
            name: 'USER request with a Loop ID',
            payload: {
              ...userPayload(),
              loopRunId,
            } as unknown as BacktestRequestedPayload,
          },
          {
            name: 'SEARCH_LOOP request without a Loop ID',
            payload: {
              ...searchLoopPayload(),
              loopRunId: null,
            } as unknown as BacktestRequestedPayload,
          },
        ])('rejects $name before storing a Redis job', async ({ payload }) => {
          const { adapter, inspector } = createHarness();

          await expectRejectedCode(
            adapter.enqueue(JobType.BACKTEST, payload, correlationId),
            'INVALID_JOB_PAYLOAD',
          );

          expect(
            await inspector.getJobCountByTypes(
              'waiting',
              'prioritized',
              'delayed',
              'active',
              'completed',
              'failed',
            ),
          ).toBe(0);
        });
      });

      it('preserves producer UUID/correlation data and rejects a duplicate without a second job', async () => {
        const { adapter, inspector } = createHarness();
        const payload = userPayload();

        await expect(
          adapter.enqueue(JobType.BACKTEST, payload, correlationId),
        ).resolves.toEqual({ jobId: payload.jobId });

        const stored = await inspector.getJob(payload.jobId);
        expect(stored?.id).toBe(payload.jobId);
        expect(stored?.data.jobType).toBe(JobType.BACKTEST);
        expect(stored?.data.correlationId).toBe(correlationId);
        expect(stored?.data.payload).toMatchObject({
          jobId: payload.jobId,
          source: BacktestSource.USER,
          loopRunId: null,
        });

        await expectRejectedCode(
          adapter.enqueue(JobType.BACKTEST, payload, correlationId),
          'DUPLICATE_JOB_ID',
        );

        expect(
          await inspector.getJobCountByTypes('waiting', 'prioritized'),
        ).toBe(1);
      });

      it('runs USER priority 1 before SEARCH_LOOP priority 10 and keeps FIFO within each priority', async () => {
        const { adapter, queueName } = createHarness();
        const searchFirst = searchLoopPayload();
        const searchSecond = searchLoopPayload();
        const userFirst = userPayload();
        const userSecond = userPayload();

        await adapter.enqueue(JobType.BACKTEST, searchFirst, correlationId);
        await adapter.enqueue(JobType.BACKTEST, searchSecond, correlationId);
        await adapter.enqueue(JobType.BACKTEST, userFirst, correlationId);
        await adapter.enqueue(JobType.BACKTEST, userSecond, correlationId);

        const executionOrder: string[] = [];
        startWorker(queueName, (job) => {
          executionOrder.push(job.id ?? 'missing-id');
          return Promise.resolve();
        });

        await waitFor(
          () => executionOrder.length === 4,
          'all prioritized jobs to execute',
        );

        expect(executionOrder).toEqual([
          userFirst.jobId,
          userSecond.jobId,
          searchFirst.jobId,
          searchSecond.jobId,
        ]);
      });

      it('maps waiting, active and completed BullMQ states into contract status/stats', async () => {
        const { adapter, inspector, queueName } = createHarness();
        const payload = userPayload();
        await adapter.enqueue(JobType.BACKTEST, payload, correlationId);

        await expect(adapter.getStatus(payload.jobId)).resolves.toMatchObject({
          jobId: payload.jobId,
          status: JobStatusValue.QUEUED,
          attempt: 1,
          lastError: null,
        });
        await expect(adapter.getStats()).resolves.toMatchObject({
          queued: 1,
          processing: 0,
          delayed: 0,
          redisConnected: true,
        });

        let releaseActive!: () => void;
        const activeGate = new Promise<void>((resolve) => {
          releaseActive = resolve;
        });
        pendingReleases.push(releaseActive);
        startWorker(queueName, async () => activeGate);

        await waitFor(
          async () => (await inspector.getJobState(payload.jobId)) === 'active',
          'job to enter active state',
        );
        await expect(adapter.getStatus(payload.jobId)).resolves.toMatchObject({
          status: JobStatusValue.PROCESSING,
          attempt: 1,
        });
        await expect(adapter.getStats()).resolves.toMatchObject({
          queued: 0,
          processing: 1,
        });

        releaseActive();
        pendingReleases.splice(pendingReleases.indexOf(releaseActive), 1);
        await waitFor(
          async () =>
            (await inspector.getJobState(payload.jobId)) === 'completed',
          'job to complete',
        );
        await expect(adapter.getStatus(payload.jobId)).resolves.toMatchObject({
          status: JobStatusValue.COMPLETED,
          attempt: 1,
          lastError: null,
        });
        await expect(adapter.getStats()).resolves.toMatchObject({
          queued: 0,
          processing: 0,
          completedLast24h: 1,
        });
      });

      it('maps a retry delay to QUEUED plus the delayed QueueStats count', async () => {
        const { adapter, inspector, queueName } = createHarness();
        const payload = userPayload();
        await adapter.enqueue(JobType.BACKTEST, payload, correlationId);

        startWorker(
          queueName,
          () => Promise.reject(new Error('retryable adapter-spec failure')),
          () => 60_000,
        );

        await waitFor(
          async () =>
            (await inspector.getJobState(payload.jobId)) === 'delayed',
          'failed attempt to enter delayed retry state',
        );

        await expect(adapter.getStatus(payload.jobId)).resolves.toMatchObject({
          jobId: payload.jobId,
          status: JobStatusValue.QUEUED,
          attempt: 1,
          lastError: null,
        });
        await expect(adapter.getStats()).resolves.toMatchObject({
          queued: 1,
          delayed: 1,
          processing: 0,
        });
      });

      it('configures three attempts and bounded completed/failed retention on every job', async () => {
        const { adapter, inspector } = createHarness();
        const payload = userPayload();
        await adapter.enqueue(JobType.BACKTEST, payload, correlationId);

        const stored = await inspector.getJob(payload.jobId);
        expect(stored?.opts.attempts).toBe(3);
        expect(stored?.opts.removeOnComplete).toEqual({
          age: RETENTION_AGE_SECONDS,
          count: RETENTION_COUNT,
        });
        expect(stored?.opts.removeOnFail).toEqual({
          age: RETENTION_AGE_SECONDS,
          count: RETENTION_COUNT,
        });
      });

      it('maps failed/dead-letter states and manually retries the same payload with attempts reset', async () => {
        const { adapter, inspector, queueName } = createHarness();
        const payload = searchLoopPayload();
        await adapter.enqueue(JobType.BACKTEST, payload, correlationId);

        const failingWorker = startWorker(queueName, () =>
          Promise.reject(
            new UnrecoverableError('non-retryable adapter-spec failure'),
          ),
        );
        await waitFor(
          async () => (await inspector.getJobState(payload.jobId)) === 'failed',
          'job to enter failed state',
        );
        await closeWorker(failingWorker);

        await expect(adapter.getStatus(payload.jobId)).resolves.toMatchObject({
          status: JobStatusValue.FAILED,
          attempt: 1,
          lastError: 'non-retryable adapter-spec failure',
        });

        await adapter.deadLetter(
          payload.jobId,
          'non-retryable adapter-spec failure',
        );
        await expect(adapter.getStatus(payload.jobId)).resolves.toMatchObject({
          status: JobStatusValue.DEAD_LETTER,
          attempt: 1,
        });
        await expect(adapter.getStats()).resolves.toMatchObject({
          deadLettered: 1,
        });

        await adapter.retry(payload.jobId);
        await expect(adapter.getStatus(payload.jobId)).resolves.toMatchObject({
          jobId: payload.jobId,
          status: JobStatusValue.QUEUED,
          attempt: 1,
          lastError: null,
        });

        const retried = await inspector.getJob(payload.jobId);
        expect(retried?.id).toBe(payload.jobId);
        expect(retried?.attemptsMade).toBe(0);
        expect(retried?.data.jobType).toBe(JobType.BACKTEST);
        expect(retried?.data.correlationId).toBe(correlationId);
        expect(retried?.data.payload).toMatchObject({
          jobId: payload.jobId,
          source: BacktestSource.SEARCH_LOOP,
          loopRunId,
        });
        expect(['waiting', 'prioritized']).toContain(await retried?.getState());
      });

      it('returns stable JOB_NOT_FOUND instead of leaking a BullMQ lookup detail', async () => {
        const { adapter } = createHarness();

        await expectRejectedCode(
          adapter.getStatus(randomUUID()),
          'JOB_NOT_FOUND',
        );
      });

      it('returns stable QUEUE_UNAVAILABLE when the producer Redis connection is unavailable', async () => {
        const unavailableConnection: ConnectionOptions = {
          host: '127.0.0.1',
          port: 1,
          db: REDIS_DB,
          connectTimeout: 100,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          retryStrategy: () => null,
        };
        const { adapter } = createHarness(unavailableConnection);

        await expectRejectedCode(
          adapter.enqueue(JobType.BACKTEST, userPayload(), correlationId),
          'QUEUE_UNAVAILABLE',
        );
      });
    },
  );
});
