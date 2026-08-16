import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  JobStatusValue,
  JobType,
  type DeadLetterJob,
  type IJobQueue,
  type QueueStats,
} from '@crypto-strategy-lab/shared';
import { IJOB_QUEUE } from '../shared/tokens';
import { DeadLetterRepository } from './dead-letter.repository';
import { QueueController } from './queue.controller';
import { QueueError, QueueErrorCode } from './queue.errors';

const JOB_ID = 'b8257d6b-d9df-47fb-83c1-839b04335e6f';
const STATS: QueueStats = {
  queued: 2,
  processing: 1,
  completedLast24h: 5,
  deadLettered: 1,
  delayed: 1,
  redisConnected: true,
};
const DEAD_LETTERED_AT = new Date('2026-08-16T03:00:00.000Z');
const DEAD_LETTER: DeadLetterJob = {
  id: 'f5e2c094-5ea8-4054-a6d8-14444337dfbb',
  jobId: JOB_ID,
  jobType: JobType.BACKTEST,
  payload: { jobId: JOB_ID },
  attempts: 3,
  lastError: 'BACKTEST_EXECUTION_FAILED',
  deadLetteredAt: DEAD_LETTERED_AT,
  resolvedAt: null,
};

describe('QueueController stable REST contract (T018)', () => {
  let app: INestApplication;
  let jobQueue: jest.Mocked<IJobQueue>;
  let deadLetters: jest.Mocked<DeadLetterRepository>;

  beforeEach(async () => {
    jobQueue = {
      enqueue: jest.fn<IJobQueue['enqueue']>(),
      getStatus: jest.fn<IJobQueue['getStatus']>(),
      retry: jest.fn<IJobQueue['retry']>().mockResolvedValue(undefined),
      deadLetter: jest.fn<IJobQueue['deadLetter']>(),
      getStats: jest.fn<IJobQueue['getStats']>().mockResolvedValue(STATS),
    };
    deadLetters = {
      mirror: jest.fn<DeadLetterRepository['mirror']>(),
      list: jest
        .fn<DeadLetterRepository['list']>()
        .mockResolvedValue([DEAD_LETTER]),
      findUnresolved: jest.fn<DeadLetterRepository['findUnresolved']>(),
      resolveAndRequeue: jest
        .fn<DeadLetterRepository['resolveAndRequeue']>()
        .mockImplementation(async (_jobId, requeue) => requeue()),
    } as unknown as jest.Mocked<DeadLetterRepository>;

    const module = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        { provide: IJOB_QUEUE, useValue: jobQueue },
        { provide: DeadLetterRepository, useValue: deadLetters },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the shared QueueStats projection', async () => {
    await request(app.getHttpServer())
      .get('/api/queue/stats')
      .expect(200)
      .expect(STATS);
  });

  it('returns durable dead letters newest-first from the repository', async () => {
    await request(app.getHttpServer())
      .get('/api/queue/dead-letter')
      .expect(200)
      .expect([
        {
          ...DEAD_LETTER,
          deadLetteredAt: DEAD_LETTERED_AT.toISOString(),
        },
      ]);
    expect(deadLetters.list).toHaveBeenCalledTimes(1);
  });

  it('claims the audit row, retries the same job, and returns QUEUED', async () => {
    await request(app.getHttpServer())
      .post(`/api/queue/dead-letter/${JOB_ID}/retry`)
      .expect(200)
      .expect({ jobId: JOB_ID, status: JobStatusValue.QUEUED });

    expect(deadLetters.resolveAndRequeue).toHaveBeenCalledWith(
      JOB_ID,
      expect.any(Function),
    );
    expect(jobQueue.retry).toHaveBeenCalledWith(JOB_ID);
  });

  it('rejects a malformed jobId with a stable validation body', async () => {
    await request(app.getHttpServer())
      .post('/api/queue/dead-letter/not-a-uuid/retry')
      .expect(400)
      .expect({
        error: 'Invalid job ID',
        code: QueueErrorCode.INVALID_JOB_PAYLOAD,
      });
    expect(deadLetters.resolveAndRequeue).not.toHaveBeenCalled();
  });

  it.each([
    [QueueErrorCode.JOB_NOT_FOUND, 404, 'Job not found'],
    [QueueErrorCode.JOB_ALREADY_RESOLVED, 409, 'Job is already resolved'],
    [QueueErrorCode.QUEUE_UNAVAILABLE, 503, 'Queue service is unavailable'],
    [
      QueueErrorCode.STRATEGY_ENGINE_UNAVAILABLE,
      503,
      'Strategy Engine is unavailable',
    ],
  ] as const)(
    'maps %s to stable HTTP %i',
    async (code, status, message) => {
      deadLetters.resolveAndRequeue.mockRejectedValueOnce(
        new QueueError(code),
      );

      await request(app.getHttpServer())
        .post(`/api/queue/dead-letter/${JOB_ID}/retry`)
        .expect(status)
        .expect({ error: message, code });
    },
  );

  it('maps an unknown provider exception without leaking its raw message', async () => {
    jobQueue.getStats.mockRejectedValueOnce(
      new Error('redis://worker:secret@redis.internal:6379'),
    );

    const response = await request(app.getHttpServer())
      .get('/api/queue/stats')
      .expect(503)
      .expect({
        error: 'Queue service is unavailable',
        code: QueueErrorCode.QUEUE_UNAVAILABLE,
      });
    expect(response.text).not.toContain('secret');
    expect(response.text).not.toContain('redis.internal');
  });

  it('does not import BullMQ concrete internals in the controller', () => {
    const source = readFileSync(join(__dirname, 'queue.controller.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]bullmq['"]/);
    expect(source).not.toMatch(/bullmq-job\.queue/);
  });
});
