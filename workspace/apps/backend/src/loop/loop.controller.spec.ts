import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import { SearchLoopOperatorGuard } from './search-loop-operator.guard';

const CONTROLLER_FILE = join(__dirname, 'loop.controller.ts');
const CONTROLLER_MODULE = join(__dirname, 'loop.controller');
const DTO_FILE = join(__dirname, 'loop.dto.ts');
const SERVICE_MODULE = join(__dirname, 'strategy-loop.service');
const STATUS_MODULE = join(__dirname, 'loop-status.service');
const CONTROL_MODULE = join(__dirname, 'search-loop-control.service');
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

const validAutomationBody = () => ({
  generatorType: StrategyGeneratorType.RANDOM,
  pair: 'BTCUSDT',
  timeframe: '1h',
  backtestWindowDays: 180,
  backtestConfig: {
    initialCapital: 10_000,
    positionSizePercent: 100,
    commission: 0.001,
    slippage: 0.001,
  },
  maxCandidatesPerRun: 100,
  stopOnNoImprovementIterations: 50,
  cooldownMs: 30_000,
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
    pause: jest.Mock<(loopRunId: string) => Promise<SearchLoopRun>>;
    resume: jest.Mock<(loopRunId: string) => Promise<SearchLoopRun>>;
    stop: jest.Mock<(loopRunId: string) => Promise<SearchLoopRun>>;
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
  let loopControl: {
    get: jest.Mock<() => Promise<unknown>>;
    enable: jest.Mock<(input: unknown) => Promise<unknown>>;
    disable: jest.Mock<() => Promise<unknown>>;
    configure: jest.Mock<(input: unknown) => Promise<unknown>>;
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
    const SearchLoopControlService = loadExport<NestClass>(
      CONTROL_MODULE,
      'SearchLoopControlService',
    );

    loopService = {
      start: jest
        .fn<(input: unknown) => Promise<SearchLoopRun>>()
        .mockResolvedValue(run()),
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
    const controlState = {
      id: 'system',
      enabled: true,
      generatorType: StrategyGeneratorType.RANDOM,
      pair: 'BTCUSDT',
      timeframe: '1h',
      backtestWindowDays: 180,
      backtestConfig: {
        initialCapital: 10_000,
        positionSizePercent: 100,
      },
      maxCandidatesPerRun: 100,
      maxDurationMsPerRun: null,
      stopOnNoImprovementIterations: 50,
      cooldownMs: 30_000,
      failureCount: 0,
      nextRunAt: null,
      lastStartedRunId: LOOP_RUN_ID,
      lastError: null,
      leaseOwner: null,
      leaseUntil: null,
      createdAt: STARTED_AT,
      updatedAt: STARTED_AT,
    };
    loopControl = {
      get: jest.fn<() => Promise<unknown>>().mockResolvedValue(controlState),
      enable: jest
        .fn<(input: unknown) => Promise<unknown>>()
        .mockResolvedValue(controlState),
      disable: jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue({ ...controlState, enabled: false }),
      configure: jest
        .fn<(input: unknown) => Promise<unknown>>()
        .mockResolvedValue(controlState),
    };

    const module = await Test.createTestingModule({
      controllers: [LoopController],
      providers: [
        { provide: StrategyLoopService, useValue: loopService },
        { provide: LoopStatusService, useValue: loopStatus },
        { provide: SearchLoopControlService, useValue: loopControl },
      ],
    })
      .overrideGuard(SupabaseJwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SearchLoopOperatorGuard)
      .useValue({ canActivate: () => true })
      .compile();
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
          loopService[command as 'pause' | 'resume' | 'stop'],
        ).toHaveBeenCalledWith(LOOP_RUN_ID);
      },
    );

    it('GET /api/loop/current returns the active run or null', async () => {
      await request(app.getHttpServer())
        .get('/api/loop/current')
        .expect(200)
        .expect((response) => {
          const body = response.body as SearchLoopRun;
          expect(body.id).toBe(LOOP_RUN_ID);
        });

      loopStatus.getCurrent.mockResolvedValueOnce(null);
      await request(app.getHttpServer())
        .get('/api/loop/current')
        .expect(200)
        .expect('null');
    });

    it('enables, reads, configures and persistently disables automation', async () => {
      await request(app.getHttpServer())
        .post('/api/loop/control/enable')
        .send(validAutomationBody())
        .expect(200)
        .expect((response) => {
          expect((response.body as { enabled: boolean }).enabled).toBe(true);
        });
      expect(loopControl.enable).toHaveBeenCalledWith(
        expect.objectContaining({
          pair: 'BTCUSDT',
          maxCandidatesPerRun: 100,
        }),
      );

      await request(app.getHttpServer()).get('/api/loop/control').expect(200);
      expect(loopControl.get).toHaveBeenCalledTimes(1);

      await request(app.getHttpServer())
        .put('/api/loop/control/config')
        .send(validAutomationBody())
        .expect(200);
      expect(loopControl.configure).toHaveBeenCalledTimes(1);

      await request(app.getHttpServer())
        .post('/api/loop/control/disable')
        .expect(200)
        .expect((response) => {
          expect((response.body as { enabled: boolean }).enabled).toBe(false);
        });
      expect(loopControl.disable).toHaveBeenCalledTimes(1);
    });

    it('GET /api/loop/:id returns candidates in repository order', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/loop/${LOOP_RUN_ID}`)
        .expect(200);
      const body = response.body as {
        run: SearchLoopRun;
        candidates: SearchLoopCandidate[];
      };

      expect(body.run.id).toBe(LOOP_RUN_ID);
      expect(body.candidates.map((item) => item.iteration)).toEqual([1, 2]);
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
        loopService[command].mockRejectedValueOnce(
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
        loopService[command].mockRejectedValueOnce(
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

describe('operator boundary with global loop semantics', () => {
  const currentUserRouteMethods = [
    'start',
    'pause',
    'resume',
    'stop',
    'getCurrent',
    'detail',
  ] as const;

  const mutationMethods = [
    'start',
    'pause',
    'resume',
    'stop',
    'enableControl',
    'disableControl',
    'configureControl',
  ] as const;

  it('operator-protects mutations while keeping status reads optional-auth', () => {
    const LoopController = loadExport<NestClass>(
      CONTROLLER_MODULE,
      'LoopController',
    );

    expect(Reflect.getMetadata(GUARDS_METADATA, LoopController)).toEqual([
      SupabaseJwtGuard,
    ]);

    for (const method of currentUserRouteMethods) {
      const routeArgs = Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        LoopController,
        method,
      ) as Record<string, { index: number }> | undefined;
      expect(
        Object.values(routeArgs ?? {}).some(({ index }) => index === 1),
      ).toBe(true);
    }

    const source = readFileSync(CONTROLLER_FILE, 'utf8');
    expect(source.match(/@CurrentUser\(\)/g)).toHaveLength(
      currentUserRouteMethods.length,
    );

    for (const method of mutationMethods) {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          (LoopController as unknown as Record<string, unknown>).prototype[
            method
          ],
        ),
      ).toEqual([SearchLoopOperatorGuard]);
    }

    for (const method of ['getControl', 'getCurrent', 'detail']) {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          (LoopController as unknown as Record<string, unknown>).prototype[
            method
          ],
        ),
      ).toBeUndefined();
    }
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
