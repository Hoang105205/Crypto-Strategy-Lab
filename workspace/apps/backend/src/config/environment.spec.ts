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
      LEADERBOARD_TOP_K: 10,
      SEARCH_LOOP_DEFAULT_ENABLED: false,
      SEARCH_LOOP_OPERATOR_USER_IDS: [],
    });
  });

  it.each([
    ['true', true],
    [' TRUE ', true],
    ['1', true],
    [true, true],
    ['false', false],
    [' FALSE ', false],
    ['0', false],
    [false, false],
  ])('parses SEARCH_LOOP_DEFAULT_ENABLED=%p', (value, expected) => {
    expect(
      validateEnvironment({ SEARCH_LOOP_DEFAULT_ENABLED: value })
        .SEARCH_LOOP_DEFAULT_ENABLED,
    ).toBe(expected);
  });

  it('rejects an ambiguous Search Loop default', () => {
    expect(() =>
      validateEnvironment({ SEARCH_LOOP_DEFAULT_ENABLED: 'yes' }),
    ).toThrow('SEARCH_LOOP_DEFAULT_ENABLED');
  });

  it('parses, trims, and de-duplicates Search Loop operator user IDs', () => {
    const first = '1d3f9f46-5f13-4c8f-9ae2-6c386fbf4b13';
    const second = 'c6c0ff8d-d034-49a6-84d1-bcd43516c306';

    expect(
      validateEnvironment({
        SEARCH_LOOP_OPERATOR_USER_IDS: `${first}, ${second},${first}`,
      }).SEARCH_LOOP_OPERATOR_USER_IDS,
    ).toEqual([first, second]);
  });

  it('rejects malformed Search Loop operator user IDs', () => {
    expect(() =>
      validateEnvironment({ SEARCH_LOOP_OPERATOR_USER_IDS: 'not-a-uuid' }),
    ).toThrow('SEARCH_LOOP_OPERATOR_USER_IDS');
  });

  it.each([
    [{ REDIS_PORT: 0 }, 'REDIS_PORT'],
    [{ REDIS_DB: -1 }, 'REDIS_DB'],
    [{ BACKTEST_WORKER_CONCURRENCY: 33 }, 'BACKTEST_WORKER_CONCURRENCY'],
    [{ BACKTEST_MAX_ATTEMPTS: 4 }, 'BACKTEST_MAX_ATTEMPTS'],
    [
      { BACKTEST_JOB_RETENTION_AGE_SECONDS: 0 },
      'BACKTEST_JOB_RETENTION_AGE_SECONDS',
    ],
    [{ BACKTEST_JOB_RETENTION_COUNT: 0 }, 'BACKTEST_JOB_RETENTION_COUNT'],
    [{ LEADERBOARD_TOP_K: 0 }, 'LEADERBOARD_TOP_K'],
    [{ LEADERBOARD_TOP_K: 101 }, 'LEADERBOARD_TOP_K'],
  ])('rejects invalid queue configuration %#', (input, field) => {
    expect(() => validateEnvironment(input)).toThrow(field);
  });
});
