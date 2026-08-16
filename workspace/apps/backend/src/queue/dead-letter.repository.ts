import { Injectable } from '@nestjs/common';
import {
  JobType,
  type DeadLetterJob,
} from '@crypto-strategy-lab/shared';
import {
  Prisma,
  type DeadLetterJob as PrismaDeadLetterJob,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QueueError, QueueErrorCode } from './queue.errors';

export type DeadLetterMirrorInput = Omit<
  DeadLetterJob,
  'id' | 'resolvedAt'
>;

export interface DeadLetterMirrorResult {
  job: DeadLetterJob;
  created: boolean;
}

const MAX_ERROR_LENGTH = 1_000;
const FALLBACK_ERROR = 'UNSPECIFIED_TERMINAL_FAILURE';

@Injectable()
export class DeadLetterRepository {
  constructor(private readonly prisma: PrismaService) {}

  mirror(input: DeadLetterMirrorInput): Promise<DeadLetterMirrorResult> {
    return this.withStableErrors(async () => {
      try {
        const created = await this.prisma.deadLetterJob.create({
          data: {
            jobId: input.jobId,
            jobType: input.jobType,
            payload: toJson(input.payload),
            attempts: input.attempts,
            lastError: sanitizeError(input.lastError),
            deadLetteredAt: input.deadLetteredAt,
          },
        });
        return { job: this.map(created), created: true };
      } catch (error: unknown) {
        if (!isUniqueConflict(error)) throw error;

        const existing = await this.prisma.deadLetterJob.findUnique({
          where: { jobId: input.jobId },
        });
        if (!existing) throw error;
        const replay = this.map(existing);
        this.assertSameJob(input, replay);
        return { job: replay, created: false };
      }
    });
  }

  list(): Promise<DeadLetterJob[]> {
    return this.withStableErrors(async () => {
      const rows = await this.prisma.deadLetterJob.findMany({
        orderBy: { deadLetteredAt: 'desc' },
      });
      return rows.map((row) => this.map(row));
    });
  }

  findUnresolved(jobId: string): Promise<DeadLetterJob | null> {
    return this.withStableErrors(async () => {
      const row = await this.prisma.deadLetterJob.findUnique({
        where: { jobId, resolvedAt: null },
      });
      return row ? this.map(row) : null;
    });
  }

  resolveAndRequeue(
    jobId: string,
    requeue: () => Promise<void>,
  ): Promise<void> {
    return this.withStableErrors(() =>
      this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.deadLetterJob.findUnique({
          where: { jobId },
        });
        if (!existing) {
          throw new QueueError(QueueErrorCode.JOB_NOT_FOUND);
        }
        if (existing.resolvedAt !== null) {
          throw new QueueError(QueueErrorCode.JOB_ALREADY_RESOLVED);
        }

        // This conditional write is the database claim. A competing
        // transaction can observe the row, but only one can change null to a
        // timestamp. The transaction is rolled back if Redis rejects requeue.
        const claim = await transaction.deadLetterJob.updateMany({
          where: { jobId, resolvedAt: null },
          data: { resolvedAt: new Date() },
        });
        if (claim.count !== 1) {
          throw new QueueError(QueueErrorCode.JOB_ALREADY_RESOLVED);
        }

        await requeue();
      }),
    );
  }

  private assertSameJob(
    input: DeadLetterMirrorInput,
    existing: DeadLetterJob,
  ): void {
    const sameJob =
      existing.jobType === input.jobType &&
      canonical(existing.payload) === canonical(toJson(input.payload));
    if (!sameJob) {
      throw new QueueError(QueueErrorCode.JOB_CONFLICT);
    }
  }

  private map(row: PrismaDeadLetterJob): DeadLetterJob {
    return {
      id: row.id,
      jobId: row.jobId,
      jobType: row.jobType as JobType,
      payload: row.payload as Record<string, unknown>,
      attempts: row.attempts,
      lastError: row.lastError,
      deadLetteredAt: row.deadLetteredAt,
      resolvedAt: row.resolvedAt,
    };
  }

  private async withStableErrors<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof QueueError) throw error;
      throw new QueueError(QueueErrorCode.QUEUE_UNAVAILABLE, { cause: error });
    }
  }
}

function isUniqueConflict(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError ||
      (typeof error === 'object' && error !== null && 'code' in error)) &&
    (error as { code?: string }).code === 'P2002'
  );
}

function sanitizeError(value: string): string {
  const sanitized = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^@\s/]+)@/gi, '$1[REDACTED]@')
    .replace(
      /\b(password|passwd|pwd|token|secret|authorization)\s*[:=]\s*([^\s,;]+)/gi,
      '$1=[REDACTED]',
    )
    .trim();
  return (sanitized || FALLBACK_ERROR).slice(0, MAX_ERROR_LENGTH);
}

function toJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
