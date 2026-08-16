/* eslint-disable @typescript-eslint/unbound-method -- Jest assertions intentionally inspect typed port mocks. */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  Job,
  Queue,
  Worker as BullWorker,
  type ConnectionOptions,
} from 'bullmq';
import {
  BacktestSource,
  EventType,
  JobType,
  StrategyType,
  type BacktestRequestedPayload,
  type BacktestCompletedPayload,
  type Candle,
  type DeadLetterJob,
  type IBacktester,
  type IBacktestResultPort,
  type IEvaluator,
  type IEventBus,
  type IMarketDataService,
  type IStrategy,
  type IStrategyExecutionPort,
  type SearchLoopBacktestRequestedPayload,
  type StrategyExecutionResult,
  type UserBacktestRequestedPayload,
} from '@crypto-strategy-lab/shared';

const TARGET_FILE = join(__dirname, 'backtest.worker.ts');
const TARGET_MODULE = join(__dirname, 'backtest.worker');
const TARGET_EXISTS = existsSync(TARGET_FILE);

const REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const REDIS_DB = Number(process.env.REDIS_DB ?? 0);
const TEST_TIMEOUT_MS = 12_000;
const POLL_INTERVAL_MS = 20;
const REDIS_PREREQUISITE =
  'T013 Redis prerequisite unavailable. Start Redis 7 before running the ' +
  'real BullMQ retry/non-retryable matrix (from workspace/: docker compose up -d redis).';

type StoredBacktestJob = {
  jobType: JobType.BACKTEST;
  payload: BacktestRequestedPayload;
  correlationId: string;
};
type DeadLetterMirrorInput = Omit<DeadLetterJob, 'id' | 'resolvedAt'>;
type DeadLetterRepositoryApi = {
  mirror(
    input: DeadLetterMirrorInput,
  ): Promise<{ job: DeadLetterJob; created: boolean }>;
};
type BacktestWorkerApi = {
  process(job: Job<StoredBacktestJob>): Promise<void>;
};
type BacktestWorkerConstructor = new (
  marketDataService: IMarketDataService,
  strategyExecutionPort: IStrategyExecutionPort,
  backtester: IBacktester,
  evaluator: IEvaluator,
  resultPort: IBacktestResultPort,
  eventBus: IEventBus,
  deadLetterRepository: DeadLetterRepositoryApi,
) => BacktestWorkerApi;

const loadTarget = (): BacktestWorkerConstructor => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const target = require(TARGET_MODULE) as {
    BacktestWorker?: BacktestWorkerConstructor;
  };
  if (typeof target.BacktestWorker !== 'function') {
    throw new Error('T013 RED: backtest.worker.ts must export BacktestWorker.');
  }
  return target.BacktestWorker;
};

const producerConnection: ConnectionOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  db: REDIS_DB,
};
const workerConnection: ConnectionOptions = {
  ...producerConnection,
  maxRetriesPerRequest: null,
};

const JOB_ID = 'b8257d6b-d9df-47fb-83c1-839b04335e6f';
const CORRELATION_ID = '2660f14b-c12a-4cc1-a33f-a6e48b51ac9a';
const LOOP_RUN_ID = 'dc492a14-ee46-4748-9ef9-3c364689d20d';
const STRATEGY_VERSION_ID = '69e1c401-810a-431f-b2d8-d9f732e7f829';
const RESULT_ID = '3d2be150-1ce6-451e-a8c4-2c4d1b7e4618';
const START_DATE = new Date('2026-08-01T00:00:00.000Z');
const END_DATE = new Date('2026-08-02T00:00:00.000Z');
const EXECUTED_AT = new Date('2026-08-15T03:00:00.000Z');

const userPayload = (jobId = JOB_ID): UserBacktestRequestedPayload => ({
  jobId,
  strategyVersionId: STRATEGY_VERSION_ID,
  pair: 'BTCUSDT',
  timeframe: '1h',
  startDate: START_DATE,
  endDate: END_DATE,
  backtestConfig: {
    initialCapital: 10_000,
    positionSizePercent: 25,
    commission: 0.1,
    slippage: 0.05,
  },
  source: BacktestSource.USER,
  loopRunId: null,
});

const searchPayload = (jobId = JOB_ID): SearchLoopBacktestRequestedPayload => ({
  ...userPayload(jobId),
  source: BacktestSource.SEARCH_LOOP,
  loopRunId: LOOP_RUN_ID,
});

const candle: Candle = {
  symbol: 'BTCUSDT',
  timeframe: '1h',
  openTime: START_DATE,
  closeTime: END_DATE,
  open: 60_000,
  high: 61_000,
  low: 59_500,
  close: 60_500,
  volume: 125,
  isClosed: true,
};

const strategy: jest.Mocked<IStrategy> = {
  analyze: jest.fn(),
  getName: jest.fn(() => 'Moving Average'),
  getType: jest.fn(() => StrategyType.MA),
  getParameters: jest.fn(() => ({ period: 20 })),
};

const resolvedStrategy: StrategyExecutionResult<IStrategy> = {
  version: {
    id: STRATEGY_VERSION_ID,
    strategyType: StrategyType.MA,
    name: 'Moving Average',
    version: 1,
    parameters: { period: 20 },
    isComposite: false,
    createdAt: START_DATE,
  },
  strategy,
};

const trades = [
  {
    entryDate: START_DATE,
    exitDate: END_DATE,
    entryPrice: 60_000,
    exitPrice: 61_000,
    side: 'LONG',
    pnl: 100,
    quantity: 0.1,
  },
];
const metrics = {
  totalReturn: 12.5,
  winRate: 0.6,
  maxDrawdown: -8,
  sharpeRatio: 1.4,
  profitFactor: 1.8,
  totalTrades: 1,
};
const completedMetrics: BacktestCompletedPayload['metrics'] = {
  ...metrics,
  winRate: metrics.winRate as BacktestCompletedPayload['metrics']['winRate'],
};
const savedResult = {
  id: RESULT_ID,
  jobId: JOB_ID,
  strategyVersionId: STRATEGY_VERSION_ID,
  pair: 'BTCUSDT',
  timeframe: '1h',
  startDate: START_DATE,
  endDate: END_DATE,
  ...metrics,
  trades,
  executedAt: EXECUTED_AT,
  executionTimeMs: 250,
};

const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  description: string,
  timeoutMs = TEST_TIMEOUT_MS,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch (error: unknown) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  const detail =
    lastError instanceof Error ? ` Last observation: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${description}.${detail}`);
};

const canReachRedis = (): Promise<boolean> =>
  new Promise((resolve) => {
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

const terminalRecord = (
  payload: BacktestRequestedPayload,
  attempts: number,
  lastError: string,
): DeadLetterJob => ({
  id: randomUUID(),
  jobId: payload.jobId,
  jobType: JobType.BACKTEST,
  payload: { ...payload },
  attempts,
  lastError,
  deadLetteredAt: new Date(),
  resolvedAt: null,
});

describe('BacktestWorker contract (T013)', () => {
  let redisAvailable = false;

  beforeAll(async () => {
    redisAvailable = await canReachRedis();
    if (!redisAvailable) console.warn(REDIS_PREREQUISITE);
  });

  it('has the production BacktestWorker target required by T016', () => {
    if (!TARGET_EXISTS) {
      throw new Error(
        'T013 RED: BacktestWorker is not implemented yet. ' +
          'T016 must add src/queue/backtest.worker.ts; this is not an import-path failure.',
      );
    }
    expect(loadTarget()).toBeDefined();
  });

  it('keeps Queue behind shared ports without Prisma or Strategy implementation imports', () => {
    if (!TARGET_EXISTS) return;
    const source = readFileSync(TARGET_FILE, 'utf8');
    expect(source).not.toMatch(/@prisma\/client|PrismaService/);
    expect(source).not.toMatch(/from ['"]\.\.\/strategy\//);
  });

  const describeWithTarget = TARGET_EXISTS ? describe : describe.skip;

  describeWithTarget('domain pipeline through shared module ports', () => {
    let WorkerTarget: BacktestWorkerConstructor;
    let marketDataService: jest.Mocked<IMarketDataService>;
    let strategyExecutionPort: jest.Mocked<IStrategyExecutionPort>;
    let backtester: jest.Mocked<IBacktester>;
    let evaluator: jest.Mocked<IEvaluator>;
    let resultPort: jest.Mocked<IBacktestResultPort>;
    let eventBus: jest.Mocked<IEventBus>;
    let deadLetterRepository: jest.Mocked<DeadLetterRepositoryApi>;

    const createWorker = (): BacktestWorkerApi =>
      new WorkerTarget(
        marketDataService,
        strategyExecutionPort,
        backtester,
        evaluator,
        resultPort,
        eventBus,
        deadLetterRepository,
      );

    const jobFixture = (
      payload: BacktestRequestedPayload = userPayload(),
      attemptsMade = 0,
      attempts = 3,
    ): Job<StoredBacktestJob> =>
      ({
        id: payload.jobId,
        name: JobType.BACKTEST,
        data: {
          jobType: JobType.BACKTEST,
          payload,
          correlationId: CORRELATION_ID,
        },
        attemptsMade,
        opts: { attempts },
      }) as Job<StoredBacktestJob>;

    beforeEach(() => {
      WorkerTarget = loadTarget();
      marketDataService = {
        getCandles: jest.fn<IMarketDataService['getCandles']>(),
        getCandlesRange: jest
          .fn<IMarketDataService['getCandlesRange']>()
          .mockResolvedValue([candle]),
        subscribe: jest.fn<IMarketDataService['subscribe']>(),
        unsubscribe: jest.fn<IMarketDataService['unsubscribe']>(),
      };
      strategyExecutionPort = {
        resolveVersion: jest
          .fn<IStrategyExecutionPort['resolveVersion']>()
          .mockResolvedValue(resolvedStrategy),
      };
      backtester = { run: jest.fn<IBacktester['run']>(() => trades) };
      evaluator = { evaluate: jest.fn<IEvaluator['evaluate']>(() => metrics) };
      resultPort = {
        save: jest
          .fn<IBacktestResultPort['save']>()
          .mockResolvedValue(savedResult),
        getById: jest.fn<IBacktestResultPort['getById']>(),
      };
      eventBus = {
        publish: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      } as unknown as jest.Mocked<IEventBus>;
      deadLetterRepository = {
        mirror: jest.fn(),
      };
    });

    it('calls only approved ports and publishes completion after result persistence resolves', async () => {
      let releaseSave!: (value: typeof savedResult) => void;
      resultPort.save.mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseSave = resolve;
          }),
      );
      const worker = createWorker();
      const processing = worker.process(jobFixture());

      await waitFor(
        () => resultPort.save.mock.calls.length === 1,
        'result save',
      );
      expect(eventBus.publish).not.toHaveBeenCalled();
      releaseSave(savedResult);
      await processing;

      expect(marketDataService.getCandlesRange).toHaveBeenCalledWith(
        'BTCUSDT',
        '1h',
        START_DATE,
        END_DATE,
      );
      expect(strategyExecutionPort.resolveVersion).toHaveBeenCalledWith(
        STRATEGY_VERSION_ID,
      );
      expect(backtester.run).toHaveBeenCalledWith(
        strategy,
        [candle],
        userPayload().backtestConfig,
      );
      expect(evaluator.evaluate).toHaveBeenCalledWith(trades, 10_000);
      expect(resultPort.save).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: JOB_ID,
          strategyVersionId: STRATEGY_VERSION_ID,
          winRate: 0.6,
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        EventType.BacktestCompleted,
        {
          jobId: JOB_ID,
          correlationId: CORRELATION_ID,
          loopRunId: null,
          backtestResultId: RESULT_ID,
          strategyVersionId: STRATEGY_VERSION_ID,
          strategyName: 'Moving Average',
          strategyType: StrategyType.MA,
          isComposite: false,
          pair: 'BTCUSDT',
          timeframe: '1h',
          status: 'SUCCESS',
          metrics: completedMetrics,
          executedAt: EXECUTED_AT,
          executionTimeMs: 250,
        },
        CORRELATION_ID,
      );
      expect(resultPort.save.mock.invocationCallOrder[0]).toBeLessThan(
        eventBus.publish.mock.invocationCallOrder[0],
      );
      expect(deadLetterRepository.mirror).not.toHaveBeenCalled();
    });

    it('normalizes evaluator percentage winRate before persistence and publication', async () => {
      evaluator.evaluate.mockReturnValue({ ...metrics, winRate: 60 });
      resultPort.save.mockImplementation(async (input) => ({
        id: RESULT_ID,
        ...input,
      }));

      await createWorker().process(jobFixture());

      expect(resultPort.save).toHaveBeenCalledWith(
        expect.objectContaining({ winRate: 0.6 }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        EventType.BacktestCompleted,
        expect.objectContaining({
          metrics: expect.objectContaining({ winRate: 0.6 }),
        }),
        CORRELATION_ID,
      );
    });

    it('coalesces stalled duplicate processing by jobId into one result and completion effect', async () => {
      let releaseSave!: (value: typeof savedResult) => void;
      resultPort.save.mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseSave = resolve;
          }),
      );
      const worker = createWorker();
      const redelivered = jobFixture();
      const first = worker.process(redelivered);
      const duplicate = worker.process(redelivered);

      await waitFor(
        () => resultPort.save.mock.calls.length === 1,
        'one save claim',
      );
      releaseSave(savedResult);
      await Promise.all([first, duplicate]);

      expect(resultPort.save).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('coalesces a stalled terminal redelivery into one mirror and one terminal event pair', async () => {
      const payload = searchPayload();
      marketDataService.getCandlesRange.mockResolvedValue([]);
      deadLetterRepository.mirror.mockResolvedValue({
        job: terminalRecord(payload, 1, 'NO_HISTORICAL_CANDLES'),
        created: true,
      });
      const worker = createWorker();
      const redelivered = jobFixture(payload);

      const outcomes = await Promise.allSettled([
        worker.process(redelivered),
        worker.process(redelivered),
      ]);

      expect(outcomes.every(({ status }) => status === 'rejected')).toBe(true);
      expect(deadLetterRepository.mirror).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      expect(
        eventBus.publish.mock.calls.map(([eventType]) => eventType),
      ).toEqual([EventType.BacktestFailed, EventType.BacktestDeadLettered]);
    });

    describe('real BullMQ failure lifecycle', () => {
      let queue: Queue<StoredBacktestJob> | undefined;
      let bullWorker: BullWorker<StoredBacktestJob> | undefined;

      const runJob = async (
        worker: BacktestWorkerApi,
        payload: BacktestRequestedPayload,
        backoffStrategy: (attemptsMade: number, type?: string) => number,
      ): Promise<Job<StoredBacktestJob>> => {
        const queueName = `csl-t013-worker-${process.pid}-${randomUUID()}`;
        queue = new Queue<StoredBacktestJob>(queueName, {
          connection: producerConnection,
        });
        bullWorker = new BullWorker<StoredBacktestJob>(
          queueName,
          (job) => worker.process(job),
          {
            connection: workerConnection,
            settings: { backoffStrategy },
          },
        );
        bullWorker.on('error', () => undefined);
        await queue.add(
          JobType.BACKTEST,
          { jobType: JobType.BACKTEST, payload, correlationId: CORRELATION_ID },
          {
            jobId: payload.jobId,
            attempts: 3,
            backoff: { type: 't013' },
            removeOnFail: false,
          },
        );
        const stored = await queue.getJob(payload.jobId);
        if (!stored) throw new Error('T013 fixture failed to store BullMQ job');
        return stored;
      };

      beforeAll(() => {
        if (!redisAvailable) throw new Error(REDIS_PREREQUISITE);
      });

      afterEach(async () => {
        if (bullWorker) await bullWorker.close();
        if (queue) {
          await queue.obliterate({ force: true });
          await queue.close();
        }
        bullWorker = undefined;
        queue = undefined;
      });

      it.each([
        {
          name: 'zero historical candles',
          arrange: () =>
            marketDataService.getCandlesRange.mockResolvedValue([]),
          expectedError: 'NO_HISTORICAL_CANDLES',
        },
        {
          name: 'missing Strategy Version',
          arrange: () =>
            strategyExecutionPort.resolveVersion.mockResolvedValue(null),
          expectedError: 'STRATEGY_VERSION_NOT_FOUND',
        },
      ])(
        'skips remaining attempts for $name',
        async ({ arrange, expectedError }) => {
          arrange();
          const payload = searchPayload(randomUUID());
          deadLetterRepository.mirror.mockResolvedValue({
            job: terminalRecord(payload, 1, expectedError),
            created: true,
          });
          const stored = await runJob(createWorker(), payload, () => 1_000);

          await waitFor(
            async () => (await stored.getState()) === 'failed',
            `${expectedError} job to become terminal`,
          );

          const terminal = await queue?.getJob(payload.jobId);
          expect(terminal?.attemptsMade).toBe(1);
          expect(deadLetterRepository.mirror).toHaveBeenCalledTimes(1);
          expect(eventBus.publish).toHaveBeenCalledTimes(2);
          expect(eventBus.publish).toHaveBeenNthCalledWith(
            1,
            EventType.BacktestFailed,
            expect.objectContaining({
              jobId: payload.jobId,
              correlationId: CORRELATION_ID,
              loopRunId: LOOP_RUN_ID,
              strategyVersionId: STRATEGY_VERSION_ID,
              attempt: 1,
            }),
            CORRELATION_ID,
          );
          expect(eventBus.publish).toHaveBeenNthCalledWith(
            2,
            EventType.BacktestDeadLettered,
            expect.objectContaining({
              jobId: payload.jobId,
              correlationId: CORRELATION_ID,
              jobType: JobType.BACKTEST,
              attempts: 1,
            }),
            CORRELATION_ID,
          );
        },
      );

      it('uses 1s/4s backoff, executes exactly three times, and emits terminal effects only after exhaustion', async () => {
        const payload = userPayload(randomUUID());
        const executionTimes: number[] = [];
        const observedDelays: number[] = [];
        backtester.run.mockImplementation(() => {
          executionTimes.push(Date.now());
          throw new Error('retryable processor failure');
        });
        deadLetterRepository.mirror.mockResolvedValue({
          job: terminalRecord(payload, 3, 'retryable processor failure'),
          created: true,
        });
        const stored = await runJob(createWorker(), payload, (attemptsMade) => {
          const delay = attemptsMade === 1 ? 1_000 : 4_000;
          observedDelays.push(delay);
          return delay;
        });

        await waitFor(() => executionTimes.length === 1, 'attempt one');
        expect(eventBus.publish).not.toHaveBeenCalled();
        await waitFor(() => executionTimes.length === 2, 'attempt two');
        expect(eventBus.publish).not.toHaveBeenCalled();
        await waitFor(
          async () => (await stored.getState()) === 'failed',
          'attempt three terminal failure',
        );

        expect(executionTimes).toHaveLength(3);
        expect(observedDelays).toEqual([1_000, 4_000]);
        expect(executionTimes[1] - executionTimes[0]).toBeGreaterThanOrEqual(
          850,
        );
        expect(executionTimes[2] - executionTimes[1]).toBeGreaterThanOrEqual(
          3_500,
        );
        expect(deadLetterRepository.mirror).toHaveBeenCalledTimes(1);
        expect(eventBus.publish).toHaveBeenCalledTimes(2);
        expect(
          deadLetterRepository.mirror.mock.invocationCallOrder[0],
        ).toBeLessThan(eventBus.publish.mock.invocationCallOrder[0]);
      }, TEST_TIMEOUT_MS);
    });
  });
});
