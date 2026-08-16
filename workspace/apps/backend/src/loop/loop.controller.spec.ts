import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test } from '@nestjs/testing';
import {
  LoopStatus,
  SearchLoopCandidateStatus,
  StrategyGeneratorType,
  type SearchLoopCandidate,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';
import request from 'supertest';

const CONTROLLER_FILE = join(__dirname, 'loop.controller.ts');
const CONTROLLER_MODULE = join(__dirname, 'loop.controller');
const DTO_FILE = join(__dirname, 'loop.dto.ts');
const SERVICE_MODULE = join(__dirname, 'strategy-loop.service');
const STATUS_MODULE = join(__dirname, 'loop-status.service');
const TARGET_EXISTS = existsSync(CONTROLLER_FILE) && existsSync(DTO_FILE);

type NestClass = new (...args: never[]) => object;

const loadExport = <T>(modulePath: string, exportName: string): T => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require(modulePath) as Record<string, unknown>;
  const value = module[exportName];
  if (value === undefined) {
    throw new Error(`T029 RED: ${modulePath} must export ${exportName}.`);
  }
  return value as T;
};

const STARTED_AT = new Date('2026-08-16T03:00:00.000Z');
const LOOP_RUN_ID = '69e1c401-810a-431f-b2d8-d9f732e7f829';

const run = (overrides: Partial<SearchLoopRun> = {}): SearchLoopRun => ({
  id: LOOP_RUN_ID,
  status: LoopStatus.RUNNING,
  generatorType: StrategyGeneratorType.RANDOM,
  iteration: 1,
  testedCandidates: 0,
  maxCandidates: null,
  maxDurationMs: null,
  stopOnNoImprovementIterations: 50,
  currentCandidateStrategyVersionId: null,
  bestStrategyVersionId: null,
  bestScore: null,
  stopReason: null,
  startedAt: STARTED_AT,
  pausedAt: null,
  stoppedAt: null,
  ...overrides,
});

const candidate = (
  overrides: Partial<SearchLoopCandidate> = {},
): SearchLoopCandidate => ({
  id: randomUUID(),
  loopRunId: LOOP_RUN_ID,
  jobId: randomUUID(),
  strategyVersionId: randomUUID(),
  backtestResultId: null,
  iteration: 1,
  score: null,
  status: SearchLoopCandidateStatus.BACKTESTING,
  createdAt: STARTED_AT,
  updatedAt: STARTED_AT,
  ...overrides,
});

const validStartBody = () => ({
  generatorType: StrategyGeneratorType.RANDOM,
  pair: 'BTC/USDT',
  timeframe: '1h',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-02-01T00:00:00.000Z',
  backtestConfig: {
    initialCapital: 10_000,
    positionSizePercent: 10,
    commission: 0.001,
    slippage: 0.001,
  },
});

const domainError = (code: string): Error & { code: string } =>
  Object.assign(new Error('sensitive internal dependency detail'), { code });

describe('T029 LoopController target', () => {
  it('is RED until LoopController and its public DTO boundary exist', () => {
    if (!existsSync(CONTROLLER_FILE)) {
      throw new Error(
        'T029 RED: missing loop/loop.controller.ts; REST contract tests are intentionally pending.',
      );
    }
    if (!existsSync(DTO_FILE)) {
      throw new Error(
        'T029 RED: missing loop/loop.dto.ts; REST validation tests are intentionally pending.',
      );
    }
    expect(loadExport(CONTROLLER_MODULE, 'LoopController')).toBeDefined();
  });
});

const describeWithTarget = TARGET_EXISTS ? describe : describe.skip;

describeWithTarget('LoopController stable REST contract', () => {
  let app: INestApplication;
  let loopService: {
    start: jest.Mock<(input: unknown) => Promise<SearchLoopRun>>;
  };
  let loopStatus: {
    pause: jest.Mock<(loopRunId: string) => Promise<SearchLoopRun>>;
    resume: jest.Mock<(loopRunId: string) => Promise<SearchLoopRun>>;
    stop: jest.Mock<(loopRunId: string) => Promise<SearchLoopRun>>;
    getCurrent: jest.Mock<() => Promise<SearchLoopRun | null>>;
    getDetail: jest.Mock<
      (loopRunId: string) => Promise<{
        run: SearchLoopRun;
        candidates: SearchLoopCandidate[];
      } | null>
    >;
  };

  beforeEach(async () => {
    const LoopController = loadExport<NestClass>(
      CONTROLLER_MODULE,
      'LoopController',
    );
    const StrategyLoopService = loadExport<NestClass>(
      SERVICE_MODULE,
      'StrategyLoopService',
    );
    const LoopStatusService = loadExport<NestClass>(
      STATUS_MODULE,
      'LoopStatusService',
    );

    loopService = {
      start: jest
        .fn<(input: unknown) => Promise<SearchLoopRun>>()
        .mockResolvedValue(run()),
    };
    loopStatus = {
      pause: jest
        .fn<(loopRunId: string) => Promise<SearchLoopRun>>()
        .mockResolvedValue(run({ status: LoopStatus.PAUSED })),
      resume: jest
        .fn<(loopRunId: string) => Promise<SearchLoopRun>>()
        .mockResolvedValue(run()),
      stop: jest
        .fn<(loopRunId: string) => Promise<SearchLoopRun>>()
        .mockResolvedValue(
          run({
            status: LoopStatus.STOPPED_BY_USER,
            stopReason: 'stopped_by_user',
          }),
        ),
      getCurrent: jest
        .fn<() => Promise<SearchLoopRun | null>>()
        .mockResolvedValue(run()),
      getDetail: jest
        .fn<
          (loopRunId: string) => Promise<{
            run: SearchLoopRun;
            candidates: SearchLoopCandidate[];
          } | null>
        >()
        .mockResolvedValue({
          run: run(),
          candidates: [
            candidate({ iteration: 1 }),
            candidate({ iteration: 2 }),
          ],
        }),
    };

    const module = await Test.createTestingModule({
      controllers: [LoopController],
      providers: [
        { provide: StrategyLoopService, useValue: loopService },
        { provide: LoopStatusService, useValue: loopStatus },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('success statuses and DTO normalization', () => {
    it('POST /api/loop/start returns 201 and defaults no-improvement to 50', async () => {
      await request(app.getHttpServer())
        .post('/api/loop/start')
        .send(validStartBody())
        .expect(201)
        .expect({ loopRunId: LOOP_RUN_ID, status: LoopStatus.RUNNING });

      expect(loopService.start).toHaveBeenCalledWith(
        expect.objectContaining({
          maxCandidates: null,
          maxDurationMs: null,
          stopOnNoImprovementIterations: 50,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-02-01T00:00:00.000Z'),
        }),
      );
    });

    it.each([
      ['pause', LoopStatus.PAUSED],
      ['resume', LoopStatus.RUNNING],
      ['stop', LoopStatus.STOPPED_BY_USER],
    ])(
      'POST /api/loop/:id/%s returns stable 200 shape',
      async (command, expectedStatus) => {
        await request(app.getHttpServer())
          .post(`/api/loop/${LOOP_RUN_ID}/${command}`)
          .expect(200)
          .expect({ loopRunId: LOOP_RUN_ID, status: expectedStatus });

        expect(
          loopStatus[command as 'pause' | 'resume' | 'stop'],
        ).toHaveBeenCalledWith(LOOP_RUN_ID);
      },
    );

    it('GET /api/loop/current returns the active run or null', async () => {
      await request(app.getHttpServer())
        .get('/api/loop/current')
        .expect(200)
        .expect((response) => {
          expect(response.body.id).toBe(LOOP_RUN_ID);
        });

      loopStatus.getCurrent.mockResolvedValueOnce(null);
      await request(app.getHttpServer())
        .get('/api/loop/current')
        .expect(200)
        .expect('null');
    });

    it('GET /api/loop/:id returns candidates in repository order', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/loop/${LOOP_RUN_ID}`)
        .expect(200);

      expect(response.body.run.id).toBe(LOOP_RUN_ID);
      expect(
        response.body.candidates.map(
          (item: { iteration: number }) => item.iteration,
        ),
      ).toEqual([1, 2]);
      expect(loopStatus.getDetail).toHaveBeenCalledWith(LOOP_RUN_ID);
    });
  });

  describe('INVALID_LOOP_CONFIG (400)', () => {
    it.each([
      ['unknown generator', { generatorType: 'GENETIC' }],
      ['blank pair', { pair: ' ' }],
      ['blank timeframe', { timeframe: '' }],
      ['invalid start date', { startDate: 'not-a-date' }],
      [
        'reversed date range',
        {
          startDate: '2026-03-01T00:00:00.000Z',
          endDate: '2026-02-01T00:00:00.000Z',
        },
      ],
      ['non-positive maxCandidates', { maxCandidates: 0 }],
      ['non-positive maxDurationMs', { maxDurationMs: -1 }],
      [
        'non-positive no-improvement bound',
        { stopOnNoImprovementIterations: 0 },
      ],
      [
        'invalid initial capital',
        {
          backtestConfig: {
            ...validStartBody().backtestConfig,
            initialCapital: 0,
          },
        },
      ],
      [
        'invalid position size',
        {
          backtestConfig: {
            ...validStartBody().backtestConfig,
            positionSizePercent: 101,
          },
        },
      ],
      [
        'negative execution cost',
        {
          backtestConfig: {
            ...validStartBody().backtestConfig,
            commission: -1,
          },
        },
      ],
    ])('rejects %s without invoking orchestration', async (_name, override) => {
      await expectStableError(
        request(app.getHttpServer())
          .post('/api/loop/start')
          .send({ ...validStartBody(), ...override }),
        400,
        'INVALID_LOOP_CONFIG',
      );
      expect(loopService.start).not.toHaveBeenCalled();
    });
  });

  describe('stable domain and dependency errors', () => {
    it.each([
      ['LOOP_ALREADY_ACTIVE', 409],
      ['STRATEGY_ENGINE_UNAVAILABLE', 503],
    ] as const)(
      'maps start failure %s to HTTP %s',
      async (code, statusCode) => {
        loopService.start.mockRejectedValueOnce(domainError(code));

        await expectStableError(
          request(app.getHttpServer())
            .post('/api/loop/start')
            .send(validStartBody()),
          statusCode,
          code,
        );
      },
    );

    it.each(['pause', 'resume', 'stop'] as const)(
      'maps %s LOOP_NOT_FOUND to 404',
      async (command) => {
        loopStatus[command].mockRejectedValueOnce(
          domainError('LOOP_NOT_FOUND'),
        );

        await expectStableError(
          request(app.getHttpServer()).post(
            `/api/loop/${LOOP_RUN_ID}/${command}`,
          ),
          404,
          'LOOP_NOT_FOUND',
        );
      },
    );

    it.each(['pause', 'resume', 'stop'] as const)(
      'maps %s INVALID_LOOP_TRANSITION to 409',
      async (command) => {
        loopStatus[command].mockRejectedValueOnce(
          domainError('INVALID_LOOP_TRANSITION'),
        );

        await expectStableError(
          request(app.getHttpServer()).post(
            `/api/loop/${LOOP_RUN_ID}/${command}`,
          ),
          409,
          'INVALID_LOOP_TRANSITION',
        );
      },
    );

    it('returns LOOP_NOT_FOUND for missing detail and malformed UUID', async () => {
      loopStatus.getDetail.mockResolvedValueOnce(null);
      await expectStableError(
        request(app.getHttpServer()).get(`/api/loop/${LOOP_RUN_ID}`),
        404,
        'LOOP_NOT_FOUND',
      );
      expect(loopStatus.getDetail).toHaveBeenCalledTimes(1);

      await expectStableError(
        request(app.getHttpServer()).get('/api/loop/not-a-uuid'),
        404,
        'LOOP_NOT_FOUND',
      );
      expect(loopStatus.getDetail).toHaveBeenCalledTimes(1);
    });
  });
});

async function expectStableError(
  pendingRequest: PromiseLike<{ status: number; body: unknown; text: string }>,
  status: number,
  code: string,
): Promise<void> {
  const response = await pendingRequest;
  expect(response.status).toBe(status);
  expect(response.body).toEqual({
    error: expect.any(String),
    code,
  });
  expect(response.text).not.toContain('sensitive internal dependency detail');
}
