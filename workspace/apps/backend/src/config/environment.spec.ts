import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('supplies the contract defaults', () => {
    expect(validateEnvironment({})).toMatchObject({
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_DB: 0,
      BACKTEST_QUEUE_NAME: 'backtest',
      BACKTEST_WORKER_CONCURRENCY: 3,
      BACKTEST_MAX_ATTEMPTS: 3,
      BACKTEST_JOB_RETENTION_AGE_SECONDS: 86_400,
      BACKTEST_JOB_RETENTION_COUNT: 1_000,
    });
  });

  it.each([
    [{ REDIS_PORT: 0 }, 'REDIS_PORT'],
    [{ REDIS_DB: -1 }, 'REDIS_DB'],
    [{ BACKTEST_WORKER_CONCURRENCY: 33 }, 'BACKTEST_WORKER_CONCURRENCY'],
    [{ BACKTEST_MAX_ATTEMPTS: 4 }, 'BACKTEST_MAX_ATTEMPTS'],
    [{ BACKTEST_JOB_RETENTION_AGE_SECONDS: 0 }, 'BACKTEST_JOB_RETENTION_AGE_SECONDS'],
    [{ BACKTEST_JOB_RETENTION_COUNT: 0 }, 'BACKTEST_JOB_RETENTION_COUNT'],
  ])('rejects invalid queue configuration %#', (input, field) => {
    expect(() => validateEnvironment(input)).toThrow(field);
  });
});
