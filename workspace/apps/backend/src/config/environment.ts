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
  LEADERBOARD_TOP_K: number;
  SEARCH_LOOP_DEFAULT_ENABLED: boolean;
  SEARCH_LOOP_OPERATOR_USER_IDS: readonly string[];
}

function nonEmpty(value: unknown, fallback: string, name: string): string {
  const resolved =
    value === undefined || value === ''
      ? fallback
      : primitiveString(value, name).trim();
  if (resolved.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return resolved;
}

function primitiveString(value: unknown, name: string): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  throw new Error(`${name} must be a string`);
}

function integer(
  value: unknown,
  fallback: number,
  name: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const resolved =
    value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return resolved;
}

function booleanValue(
  value: unknown,
  fallback: boolean,
  name: string,
): boolean {
  if (value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }

  throw new Error(`${name} must be true, false, 1, or 0`);
}

function uuidList(value: unknown, name: string): readonly string[] {
  if (value === undefined || value === '') return [];

  const values = [
    ...new Set(
      primitiveString(value, name)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (values.some((entry) => !uuidPattern.test(entry))) {
    throw new Error(`${name} must be a comma-separated list of UUIDs`);
  }

  return values;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): ValidatedEnvironment {
  const maxAttempts = integer(
    input.BACKTEST_MAX_ATTEMPTS,
    3,
    'BACKTEST_MAX_ATTEMPTS',
    3,
    3,
  );

  return {
    ...input,
    REDIS_HOST: nonEmpty(input.REDIS_HOST, 'localhost', 'REDIS_HOST'),
    REDIS_PORT: integer(input.REDIS_PORT, 6379, 'REDIS_PORT', 1, 65_535),
    REDIS_USERNAME: input.REDIS_USERNAME
      ? primitiveString(input.REDIS_USERNAME, 'REDIS_USERNAME')
      : undefined,
    REDIS_PASSWORD: input.REDIS_PASSWORD
      ? primitiveString(input.REDIS_PASSWORD, 'REDIS_PASSWORD')
      : undefined,
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
    LEADERBOARD_TOP_K: integer(
      input.LEADERBOARD_TOP_K,
      10,
      'LEADERBOARD_TOP_K',
      1,
      100,
    ),
    SEARCH_LOOP_DEFAULT_ENABLED: booleanValue(
      input.SEARCH_LOOP_DEFAULT_ENABLED,
      false,
      'SEARCH_LOOP_DEFAULT_ENABLED',
    ),
    SEARCH_LOOP_OPERATOR_USER_IDS: uuidList(
      input.SEARCH_LOOP_OPERATOR_USER_IDS,
      'SEARCH_LOOP_OPERATOR_USER_IDS',
    ),
  };
}
