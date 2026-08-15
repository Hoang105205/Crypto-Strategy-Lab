export interface ValidatedEnvironment extends Record<string, unknown> {
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_USERNAME?: string;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;
  BACKTEST_QUEUE_NAME: string;
  BACKTEST_WORKER_CONCURRENCY: number;
  BACKTEST_MAX_ATTEMPTS: 3;
  BACKTEST_JOB_RETENTION_AGE_SECONDS: number;
  BACKTEST_JOB_RETENTION_COUNT: number;
}

function nonEmpty(value: unknown, fallback: string, name: string): string {
  const resolved = value === undefined || value === '' ? fallback : String(value).trim();
  if (resolved.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return resolved;
}

function integer(
  value: unknown,
  fallback: number,
  name: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const resolved = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return resolved;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): ValidatedEnvironment {
  const maxAttempts = integer(input.BACKTEST_MAX_ATTEMPTS, 3, 'BACKTEST_MAX_ATTEMPTS', 3, 3);

  return {
    ...input,
    REDIS_HOST: nonEmpty(input.REDIS_HOST, 'localhost', 'REDIS_HOST'),
    REDIS_PORT: integer(input.REDIS_PORT, 6379, 'REDIS_PORT', 1, 65_535),
    REDIS_USERNAME: input.REDIS_USERNAME ? String(input.REDIS_USERNAME) : undefined,
    REDIS_PASSWORD: input.REDIS_PASSWORD ? String(input.REDIS_PASSWORD) : undefined,
    REDIS_DB: integer(input.REDIS_DB, 0, 'REDIS_DB', 0),
    BACKTEST_QUEUE_NAME: nonEmpty(
      input.BACKTEST_QUEUE_NAME,
      'backtest',
      'BACKTEST_QUEUE_NAME',
    ),
    BACKTEST_WORKER_CONCURRENCY: integer(
      input.BACKTEST_WORKER_CONCURRENCY,
      3,
      'BACKTEST_WORKER_CONCURRENCY',
      1,
      32,
    ),
    BACKTEST_MAX_ATTEMPTS: maxAttempts as 3,
    BACKTEST_JOB_RETENTION_AGE_SECONDS: integer(
      input.BACKTEST_JOB_RETENTION_AGE_SECONDS,
      86_400,
      'BACKTEST_JOB_RETENTION_AGE_SECONDS',
      1,
    ),
    BACKTEST_JOB_RETENTION_COUNT: integer(
      input.BACKTEST_JOB_RETENTION_COUNT,
      1_000,
      'BACKTEST_JOB_RETENTION_COUNT',
      1,
    ),
  };
}
