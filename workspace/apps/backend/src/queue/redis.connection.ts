import Redis, { type RedisOptions } from 'ioredis';
import type { ValidatedEnvironment } from '../config/environment';

const PRODUCER_CONNECT_TIMEOUT_MS = 1_000;
const PRODUCER_RECONNECT_DELAY_MS = 100;
const WORKER_RECONNECT_BASE_DELAY_MS = 1_000;
const WORKER_RECONNECT_MAX_DELAY_MS = 30_000;

type OwnedRedisClient = Pick<Redis, 'status' | 'quit' | 'disconnect'>;

function sharedRedisOptions(environment: ValidatedEnvironment): RedisOptions {
  return {
    host: environment.REDIS_HOST,
    port: environment.REDIS_PORT,
    username: environment.REDIS_USERNAME,
    password: environment.REDIS_PASSWORD,
    db: environment.REDIS_DB,
  };
}

/**
 * HTTP-producing paths must stop quickly rather than buffer an enqueue that has
 * not been acknowledged by Redis.
 */
export function createProducerRedisOptions(
  environment: ValidatedEnvironment,
): RedisOptions {
  return {
    ...sharedRedisOptions(environment),
    connectTimeout: PRODUCER_CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (attempt) =>
      attempt === 1 ? PRODUCER_RECONNECT_DELAY_MS : null,
  };
}

/** Workers are long-lived infrastructure and keep retrying until Redis returns. */
export function createWorkerRedisOptions(
  environment: ValidatedEnvironment,
): RedisOptions {
  return {
    ...sharedRedisOptions(environment),
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    retryStrategy: (attempt) =>
      Math.min(
        attempt * WORKER_RECONNECT_BASE_DELAY_MS,
        WORKER_RECONNECT_MAX_DELAY_MS,
      ),
  };
}

/**
 * Owns exactly one externally supplied BullMQ Redis client. BullMQ resources
 * using this client must close first; then this owner closes the shared client.
 */
export class OwnedRedisConnection<TClient extends OwnedRedisClient = Redis> {
  private closePromise?: Promise<void>;

  constructor(readonly client: TClient) {}

  close(): Promise<void> {
    this.closePromise ??= this.closeOnce();
    return this.closePromise;
  }

  private async closeOnce(): Promise<void> {
    if (this.client.status === 'end') {
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect(false);
    }
  }
}

export function createProducerRedisConnection(
  environment: ValidatedEnvironment,
): OwnedRedisConnection<Redis> {
  return new OwnedRedisConnection(
    new Redis(createProducerRedisOptions(environment)),
  );
}

export function createWorkerRedisConnection(
  environment: ValidatedEnvironment,
): OwnedRedisConnection<Redis> {
  return new OwnedRedisConnection(
    new Redis(createWorkerRedisOptions(environment)),
  );
}
