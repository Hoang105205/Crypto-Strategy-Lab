import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from '@jest/globals';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import type { IJobQueue } from '@crypto-strategy-lab/shared';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { IJOB_QUEUE } from '../shared/tokens';
import { BullMqJobQueue } from './bullmq-job.queue';
import type { StoredBacktestJob } from './bullmq-job.queue';
import { BullMqWorkerHost } from './bullmq-worker.host';
import { QueueModule } from './queue.module';
import {
  PRODUCER_REDIS_CONNECTION,
  QUEUE_ENVIRONMENT,
  WORKER_REDIS_CONNECTION,
} from './queue.tokens';
import type { OwnedRedisConnection } from './redis.connection';
import type Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const REDIS_DB = Number(process.env.REDIS_DB ?? 0);
const QUEUE_NAME = `csl-t019-module-${process.pid}-${randomUUID()}`;

describe('QueueModule production wiring (T019)', () => {
  let module: TestingModule;
  let cleanupQueue: Queue<StoredBacktestJob>;
  let producerOwner: OwnedRedisConnection<Redis>;
  let workerOwner: OwnedRedisConnection<Redis>;

  beforeAll(async () => {
    if (!(await canReachRedis())) {
      throw new Error(
        'T019 Redis prerequisite unavailable. Start Redis 7 with docker compose up -d redis.',
      );
    }

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        EventEmitterModule.forRoot(),
        QueueModule,
      ],
    })
      .overrideProvider(QUEUE_ENVIRONMENT)
      .useValue({
        REDIS_HOST,
        REDIS_PORT,
        REDIS_DB,
        BACKTEST_QUEUE_NAME: QUEUE_NAME,
        BACKTEST_WORKER_CONCURRENCY: 3,
        BACKTEST_MAX_ATTEMPTS: 3,
        BACKTEST_JOB_RETENTION_AGE_SECONDS: 60,
        BACKTEST_JOB_RETENTION_COUNT: 20,
      })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    await module.init();

    producerOwner = module.get(PRODUCER_REDIS_CONNECTION);
    workerOwner = module.get(WORKER_REDIS_CONNECTION);
    cleanupQueue = new Queue<StoredBacktestJob>(QUEUE_NAME, {
      connection: { host: REDIS_HOST, port: REDIS_PORT, db: REDIS_DB },
    });
  });

  afterAll(async () => {
    await module.close();
    await cleanupQueue.obliterate({ force: true });
    await cleanupQueue.close();
  });

  it('binds exactly one BullMqJobQueue instance behind IJOB_QUEUE', async () => {
    const byToken = module.get<IJobQueue>(IJOB_QUEUE);
    const concrete = module.get(BullMqJobQueue);
    expect(byToken).toBe(concrete);
    await expect(byToken.getStats()).resolves.toMatchObject({
      redisConnected: true,
    });
    expect(() => module.get('IJobQueue')).toThrow();
  });

  it('runs a BullMQ Worker inside the Nest process', () => {
    expect(module.get(BullMqWorkerHost).isRunning()).toBe(true);
  });

  it('exports IJOB_QUEUE as the public seam for future SEARCH_LOOP producer', () => {
    expect(module.get<IJobQueue>(IJOB_QUEUE)).toBeDefined();
  });

  it('contains no BacktestRequested enqueue subscriber or forwardRef cycle mask', () => {
    const source = productionSource(join(__dirname, '..'));
    expect(source).not.toMatch(
      /subscribe\s*\(\s*EventType\.BacktestRequested/,
    );
    expect(source).not.toMatch(/@OnEvent\s*\(\s*['"]BacktestRequested/);

    const queueModuleSource = readFileSync(
      join(__dirname, 'queue.module.ts'),
      'utf8',
    );
    const strategyModuleSource = readFileSync(
      join(__dirname, '..', 'strategy', 'strategy.module.ts'),
      'utf8',
    );
    expect(`${queueModuleSource}\n${strategyModuleSource}`).not.toMatch(
      /forwardRef\s*\(/,
    );
  });

  it('boots independently of an operation outage and exposes a stable queue error', async () => {
    producerOwner.client.disconnect(false);

    await expect(
      module.get<IJobQueue>(IJOB_QUEUE).getStats(),
    ).rejects.toMatchObject({ code: 'QUEUE_UNAVAILABLE' });
    expect(module.get(BullMqWorkerHost).isRunning()).toBe(true);
  });

  afterAll(() => {
    expect(producerOwner.client.status).toBe('end');
    expect(workerOwner.client.status).toBe('end');
  });
});

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

function productionSource(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return productionSource(path);
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) {
        return [];
      }
      return [readFileSync(path, 'utf8')];
    })
    .join('\n');
}
