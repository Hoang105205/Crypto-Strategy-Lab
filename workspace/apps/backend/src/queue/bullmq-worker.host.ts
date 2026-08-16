import type {
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, type ConnectionOptions } from 'bullmq';
import type Redis from 'ioredis';
import type { StoredBacktestJob } from './bullmq-job.queue';
import type { BullMqBacktestConfig } from './bullmq.config';
import { backtestBackoffStrategy } from './bullmq.config';
import type { BacktestWorker } from './backtest.worker';
import type { OwnedRedisConnection } from './redis.connection';

export interface BullMqWorkerHostOptions {
  config: BullMqBacktestConfig;
  connection: ConnectionOptions;
  connectionOwner: OwnedRedisConnection<Redis>;
  processor: BacktestWorker;
}

/** Owns the in-process BullMQ Worker and its persistent Redis connection. */
export class BullMqWorkerHost
  implements OnModuleDestroy, OnApplicationShutdown
{
  private readonly worker: Worker<StoredBacktestJob>;
  private closePromise?: Promise<void>;

  constructor(private readonly options: BullMqWorkerHostOptions) {
    this.worker = new Worker<StoredBacktestJob>(
      options.config.queueName,
      (job) => options.processor.process(job),
      {
        connection: options.connection,
        concurrency: options.config.concurrency,
        settings: { backoffStrategy: backtestBackoffStrategy },
      },
    );
    this.worker.on('error', () => undefined);
  }

  isRunning(): boolean {
    return this.worker.isRunning();
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
    await this.worker.close();
    await this.options.connectionOwner.close();
  }
}
