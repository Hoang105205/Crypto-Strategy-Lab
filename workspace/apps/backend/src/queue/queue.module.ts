// QueueModule — BullMQ/Redis queue, in-process worker, DLQ audit and REST API.
// Owner: Phuong | ADR-0013

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';
import type Redis from 'ioredis';
import {
  validateEnvironment,
  type ValidatedEnvironment,
} from '../config/environment';
import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { IJOB_QUEUE } from '../shared/tokens';
import { StrategyRuntimeModule } from '../strategy/strategy-runtime.module';
import { BacktestWorker } from './backtest.worker';
import { BullMqJobQueue } from './bullmq-job.queue';
import {
  createBullMqConfig,
  type BullMqBacktestConfig,
} from './bullmq.config';
import { BullMqWorkerHost } from './bullmq-worker.host';
import { DeadLetterRepository } from './dead-letter.repository';
import { QueueController } from './queue.controller';
import {
  createProducerRedisConnection,
  createWorkerRedisConnection,
  type OwnedRedisConnection,
} from './redis.connection';
import {
  BULLMQ_BACKTEST_CONFIG,
  PRODUCER_REDIS_CONNECTION,
  QUEUE_ENVIRONMENT,
  WORKER_REDIS_CONNECTION,
} from './queue.tokens';

const ENVIRONMENT_KEYS = [
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_USERNAME',
  'REDIS_PASSWORD',
  'REDIS_DB',
  'BACKTEST_QUEUE_NAME',
  'BACKTEST_WORKER_CONCURRENCY',
  'BACKTEST_MAX_ATTEMPTS',
  'BACKTEST_JOB_RETENTION_AGE_SECONDS',
  'BACKTEST_JOB_RETENTION_COUNT',
] as const;

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EventsModule,
    MarketDataModule,
    StrategyRuntimeModule,
  ],
  controllers: [QueueController],
  providers: [
    {
      provide: QUEUE_ENVIRONMENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ValidatedEnvironment => {
        const input = Object.fromEntries(
          ENVIRONMENT_KEYS.map((key) => [key, config.get(key)]),
        );
        return validateEnvironment(input);
      },
    },
    {
      provide: BULLMQ_BACKTEST_CONFIG,
      inject: [QUEUE_ENVIRONMENT],
      useFactory: createBullMqConfig,
    },
    {
      provide: PRODUCER_REDIS_CONNECTION,
      inject: [QUEUE_ENVIRONMENT],
      useFactory: createProducerRedisConnection,
    },
    {
      provide: WORKER_REDIS_CONNECTION,
      inject: [QUEUE_ENVIRONMENT],
      useFactory: createWorkerRedisConnection,
    },
    {
      provide: BullMqJobQueue,
      inject: [BULLMQ_BACKTEST_CONFIG, PRODUCER_REDIS_CONNECTION],
      useFactory: (
        config: BullMqBacktestConfig,
        producer: OwnedRedisConnection<Redis>,
      ): BullMqJobQueue => {
        const retention = retentionFrom(config);
        return new BullMqJobQueue({
          queueName: config.queueName,
          connection: producer.client as unknown as ConnectionOptions,
          maxAttempts: config.attempts,
          retryDelaysMs: config.retryDelaysMs,
          retention,
          connectionOwner: producer,
        });
      },
    },
    { provide: IJOB_QUEUE, useExisting: BullMqJobQueue },
    DeadLetterRepository,
    BacktestWorker,
    {
      provide: BullMqWorkerHost,
      inject: [
        BULLMQ_BACKTEST_CONFIG,
        WORKER_REDIS_CONNECTION,
        BacktestWorker,
      ],
      useFactory: (
        config: BullMqBacktestConfig,
        workerConnection: OwnedRedisConnection<Redis>,
        processor: BacktestWorker,
      ): BullMqWorkerHost =>
        new BullMqWorkerHost({
          config,
          connection: workerConnection.client as unknown as ConnectionOptions,
          connectionOwner: workerConnection,
          processor,
        }),
    },
  ],
  exports: [IJOB_QUEUE],
})
export class QueueModule {}

function retentionFrom(config: BullMqBacktestConfig): {
  ageSeconds: number;
  count: number;
} {
  const retention = config.defaultJobOptions.removeOnComplete;
  if (
    !retention ||
    typeof retention !== 'object' ||
    !('age' in retention) ||
    !('count' in retention) ||
    typeof retention.age !== 'number' ||
    typeof retention.count !== 'number'
  ) {
    throw new Error('Invalid BullMQ retention configuration');
  }
  return { ageSeconds: retention.age, count: retention.count };
}
