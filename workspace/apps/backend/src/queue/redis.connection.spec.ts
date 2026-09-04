import { describe, expect, it, jest } from '@jest/globals';
import { validateEnvironment } from '../config/environment';
import {
  OwnedRedisConnection,
  createProducerRedisOptions,
  createWorkerRedisOptions,
} from './redis.connection';

describe('Redis connection policies', () => {
  const environment = validateEnvironment({
    REDIS_HOST: 'redis.internal',
    REDIS_PORT: 6380,
    REDIS_USERNAME: 'queue-user',
    REDIS_PASSWORD: 'private-password',
    REDIS_DB: 2,
  });

  it('bounds producer requests and fails instead of buffering false acknowledgements', () => {
    const options = createProducerRedisOptions(environment);

    expect(options).toMatchObject({
      host: 'redis.internal',
      port: 6380,
      username: 'queue-user',
      password: 'private-password',
      db: 2,
      connectTimeout: 1_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    expect(options.retryStrategy?.(1)).toBe(100);
    expect(options.retryStrategy?.(2)).toBeNull();
  });

  it('keeps worker commands and reconnect attempts alive through an outage', () => {
    const options = createWorkerRedisOptions(environment);

    expect(options).toMatchObject({
      host: 'redis.internal',
      port: 6380,
      username: 'queue-user',
      password: 'private-password',
      db: 2,
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
    });
    expect(options.retryStrategy?.(1)).toBe(1_000);
    expect(options.retryStrategy?.(100)).toBe(30_000);
  });

  it('closes an owned client once when teardown is requested repeatedly', async () => {
    const quit = jest.fn<() => Promise<'OK'>>().mockResolvedValue('OK');
    const disconnect = jest.fn<() => void>();
    const owner = new OwnedRedisConnection({
      status: 'ready',
      quit,
      disconnect,
    });

    await Promise.all([owner.close(), owner.close(), owner.close()]);

    expect(quit).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('forces disconnect once when graceful quit fails', async () => {
    const quit = jest
      .fn<() => Promise<'OK'>>()
      .mockRejectedValue(new Error('connection already unavailable'));
    const disconnect = jest.fn<() => void>();
    const owner = new OwnedRedisConnection({
      status: 'reconnecting',
      quit,
      disconnect,
    });

    await Promise.all([owner.close(), owner.close()]);

    expect(quit).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
