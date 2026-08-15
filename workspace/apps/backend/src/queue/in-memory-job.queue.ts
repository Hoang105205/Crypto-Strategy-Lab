import { Injectable } from '@nestjs/common';
import {
  JobStatusValue,
  type BacktestRequestedPayload,
  type IJobQueue,
  type JobStatus,
  type JobType,
  type QueueStats,
} from '@crypto-strategy-lab/shared';

/**
 * Development queue adapter. It accepts and tracks jobs in memory so the
 * modular monolith can boot before the durable BullMQ adapter is introduced.
 */
@Injectable()
export class InMemoryJobQueue implements IJobQueue {
  private readonly jobs = new Map<string, JobStatus>();

  async enqueue(
    _jobType: JobType,
    payload: BacktestRequestedPayload,
    _correlationId?: string,
  ): Promise<{ jobId: string }> {
    if (!payload.jobId) {
      throw new Error('JOB_ID_REQUIRED');
    }
    if (this.jobs.has(payload.jobId)) {
      throw new Error('DUPLICATE_JOB_ID');
    }

    this.jobs.set(payload.jobId, {
      jobId: payload.jobId,
      status: JobStatusValue.QUEUED,
      attempt: 0,
      lastError: null,
      updatedAt: new Date(),
    });

    return { jobId: payload.jobId };
  }

  async getStatus(jobId: string): Promise<JobStatus> {
    const status = this.jobs.get(jobId);
    if (!status) {
      throw new Error('JOB_NOT_FOUND');
    }
    return { ...status };
  }

  async retry(jobId: string): Promise<void> {
    const status = this.jobs.get(jobId);
    if (!status) {
      throw new Error('JOB_NOT_FOUND');
    }

    this.jobs.set(jobId, {
      ...status,
      status: JobStatusValue.QUEUED,
      lastError: null,
      updatedAt: new Date(),
    });
  }

  async deadLetter(jobId: string, reason: string): Promise<void> {
    const status = this.jobs.get(jobId);
    if (!status) {
      throw new Error('JOB_NOT_FOUND');
    }

    this.jobs.set(jobId, {
      ...status,
      status: JobStatusValue.DEAD_LETTER,
      lastError: reason,
      updatedAt: new Date(),
    });
  }

  async getStats(): Promise<QueueStats> {
    const statuses = [...this.jobs.values()];
    return {
      queued: statuses.filter((job) => job.status === JobStatusValue.QUEUED).length,
      processing: statuses.filter((job) => job.status === JobStatusValue.PROCESSING).length,
      completedLast24h: statuses.filter((job) => job.status === JobStatusValue.COMPLETED).length,
      deadLettered: statuses.filter((job) => job.status === JobStatusValue.DEAD_LETTER).length,
      delayed: 0,
      redisConnected: false,
    };
  }
}
