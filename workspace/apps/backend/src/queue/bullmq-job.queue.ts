import { randomUUID } from 'node:crypto';
import {
  BacktestSource,
  JobStatusValue,
  JobType,
  type BacktestRequestedPayload,
  type IJobQueue,
  type JobStatus,
  type QueueStats,
} from '@crypto-strategy-lab/shared';
import { Queue, type ConnectionOptions, type Job, type JobState } from 'bullmq';
import type {
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import type Redis from 'ioredis';
import {
  BACKTEST_BACKOFF_TYPE,
  BACKTEST_RETRY_DELAYS_MS,
  getBacktestPriority,
} from './bullmq.config';
import type { OwnedRedisConnection } from './redis.connection';
import { QueueError, QueueErrorCode, mapQueueError } from './queue.errors';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPLETED_WINDOW_MS = 24 * 60 * 60 * 1_000;

interface QueueMetadata {
  enqueueToken: string;
  deadLettered: boolean;
  deadLetterReason: string | null;
}

export interface StoredBacktestJob {
  jobType: JobType.BACKTEST;
  payload: BacktestRequestedPayload;
  correlationId: string;
  queueMetadata: QueueMetadata;
}

export interface BullMqJobQueueOptions {
  queueName: string;
  connection: ConnectionOptions;
  maxAttempts: 3;
  retryDelaysMs: readonly [1_000, 4_000];
  retention: {
    ageSeconds: number;
    count: number;
  };
  connectionOwner?: OwnedRedisConnection<Redis>;
}

export class BullMqJobQueue
  implements IJobQueue, OnModuleDestroy, OnApplicationShutdown
{
  private readonly queue: Queue<StoredBacktestJob>;
  private closePromise?: Promise<void>;

  constructor(private readonly options: BullMqJobQueueOptions) {
    this.assertConfiguration(options);
    this.queue = new Queue<StoredBacktestJob>(options.queueName, {
      connection: options.connection,
      defaultJobOptions: {
        attempts: options.maxAttempts,
        backoff: { type: BACKTEST_BACKOFF_TYPE },
        removeOnComplete: {
          age: options.retention.ageSeconds,
          count: options.retention.count,
        },
        removeOnFail: {
          age: options.retention.ageSeconds,
          count: options.retention.count,
        },
      },
    });

    // BullMQ forwards Redis failures through EventEmitter. The public methods
    // below map operation failures to stable QueueError values; this listener
    // prevents a connection error from becoming an unhandled process error.
    this.queue.on('error', () => undefined);
  }

  async enqueue(
    jobType: JobType,
    payload: BacktestRequestedPayload,
    correlationId?: string,
  ): Promise<{ jobId: string }> {
    this.validatePayload(jobType, payload);

    return this.withQueueErrors(async () => {
      if (await this.queue.getJob(payload.jobId)) {
        throw new QueueError(QueueErrorCode.DUPLICATE_JOB_ID);
      }

      const enqueueToken = randomUUID();
      await this.queue.add(
        JobType.BACKTEST,
        {
          jobType: JobType.BACKTEST,
          payload,
          correlationId: correlationId ?? randomUUID(),
          queueMetadata: {
            enqueueToken,
            deadLettered: false,
            deadLetterReason: null,
          },
        },
        {
          jobId: payload.jobId,
          priority: getBacktestPriority(payload.source),
        },
      );

      // Queue.add intentionally de-duplicates a custom jobId without throwing.
      // Re-read the authoritative Redis record so concurrent producers can tell
      // which enqueue token actually won the atomic BullMQ add operation.
      const stored = await this.queue.getJob(payload.jobId);
      if (stored?.data.queueMetadata?.enqueueToken !== enqueueToken) {
        throw new QueueError(QueueErrorCode.DUPLICATE_JOB_ID);
      }

      return { jobId: payload.jobId };
    });
  }

  async getStatus(jobId: string): Promise<JobStatus> {
    return this.withQueueErrors(async () => {
      const job = await this.requireJob(jobId);
      const state = await job.getState();
      const status = this.mapStatus(job, state);

      return {
        jobId,
        status,
        attempt: Math.max(1, job.attemptsStarted),
        lastError:
          status === JobStatusValue.FAILED ||
          status === JobStatusValue.DEAD_LETTER
            ? (job.data.queueMetadata.deadLetterReason ??
              job.failedReason ??
              null)
            : null,
        updatedAt: new Date(job.finishedOn ?? job.processedOn ?? job.timestamp),
      };
    });
  }

  async retry(jobId: string): Promise<void> {
    await this.withQueueErrors(async () => {
      const job = await this.requireJob(jobId);
      const state = await job.getState();
      if (state !== 'failed' || !job.data.queueMetadata.deadLettered) {
        throw new QueueError(QueueErrorCode.JOB_CONFLICT);
      }

      await job.retry('failed', {
        resetAttemptsMade: true,
        resetAttemptsStarted: true,
      });
      await job.updateData({
        ...job.data,
        queueMetadata: {
          ...job.data.queueMetadata,
          deadLettered: false,
          deadLetterReason: null,
        },
      });
    });
  }

  async deadLetter(jobId: string, reason: string): Promise<void> {
    await this.withQueueErrors(async () => {
      const job = await this.requireJob(jobId);
      if ((await job.getState()) !== 'failed') {
        throw new QueueError(QueueErrorCode.JOB_CONFLICT);
      }

      await job.updateData({
        ...job.data,
        queueMetadata: {
          ...job.data.queueMetadata,
          deadLettered: true,
          deadLetterReason: reason,
        },
      });
    });
  }

  async getStats(): Promise<QueueStats> {
    return this.withQueueErrors(async () => {
      const [counts, completedJobs, failedJobs] = await Promise.all([
        this.queue.getJobCounts('waiting', 'prioritized', 'delayed', 'active'),
        this.queue.getJobs(['completed'], 0, -1, false),
        this.queue.getJobs(['failed'], 0, -1, false),
      ]);
      const completedSince = Date.now() - COMPLETED_WINDOW_MS;

      return {
        queued: counts.waiting + counts.prioritized + counts.delayed,
        processing: counts.active,
        completedLast24h: completedJobs.filter(
          ({ finishedOn }) =>
            finishedOn !== undefined && finishedOn >= completedSince,
        ).length,
        deadLettered: failedJobs.filter(
          ({ data }) => data.queueMetadata?.deadLettered === true,
        ).length,
        delayed: counts.delayed,
        // Reaching this return means all Redis-backed snapshot operations above
        // succeeded. An outage rejects with QUEUE_UNAVAILABLE instead of
        // reporting stale counts with redisConnected=false.
        redisConnected: true,
      };
    });
  }

  close(): Promise<void> {
    this.closePromise ??= this.closeOnce();
    return this.closePromise;
  }

  onModuleDestroy(): Promise<void> {
    return this.close();
  }

  onApplicationShutdown(): Promise<void> {
    return this.close();
  }

  private async closeOnce(): Promise<void> {
    await this.queue.close();
    await this.options.connectionOwner?.close();
  }

  private async requireJob(jobId: string): Promise<Job<StoredBacktestJob>> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new QueueError(QueueErrorCode.JOB_NOT_FOUND);
    }
    return job;
  }

  private mapStatus(
    job: Job<StoredBacktestJob>,
    state: JobState | 'unknown',
  ): JobStatusValue {
    switch (state) {
      case 'waiting':
      case 'waiting-children':
      case 'prioritized':
      case 'delayed':
        return JobStatusValue.QUEUED;
      case 'active':
        return JobStatusValue.PROCESSING;
      case 'completed':
        return JobStatusValue.COMPLETED;
      case 'failed':
        return job.data.queueMetadata.deadLettered
          ? JobStatusValue.DEAD_LETTER
          : JobStatusValue.FAILED;
      case 'unknown':
        throw new QueueError(QueueErrorCode.JOB_NOT_FOUND);
      default:
        throw new QueueError(QueueErrorCode.JOB_CONFLICT);
    }
  }

  private validatePayload(
    jobType: JobType,
    payload: BacktestRequestedPayload,
  ): void {
    const validJobId =
      typeof payload?.jobId === 'string' && UUID_PATTERN.test(payload.jobId);
    const validSourceCorrelation =
      (payload?.source === BacktestSource.USER && payload.loopRunId == null) ||
      (payload?.source === BacktestSource.SEARCH_LOOP &&
        typeof payload.loopRunId === 'string' &&
        payload.loopRunId.length > 0);

    if (
      jobType !== JobType.BACKTEST ||
      !validJobId ||
      !validSourceCorrelation
    ) {
      throw new QueueError(QueueErrorCode.INVALID_JOB_PAYLOAD);
    }
  }

  private assertConfiguration(options: BullMqJobQueueOptions): void {
    const validRetryPolicy =
      options.maxAttempts === 3 &&
      options.retryDelaysMs[0] === BACKTEST_RETRY_DELAYS_MS[0] &&
      options.retryDelaysMs[1] === BACKTEST_RETRY_DELAYS_MS[1];
    const validRetention =
      Number.isInteger(options.retention.ageSeconds) &&
      options.retention.ageSeconds > 0 &&
      Number.isInteger(options.retention.count) &&
      options.retention.count > 0;

    if (!options.queueName || !validRetryPolicy || !validRetention) {
      throw new Error('Invalid BullMQ backtest queue configuration');
    }
  }

  private async withQueueErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw mapQueueError(error);
    }
  }
}
