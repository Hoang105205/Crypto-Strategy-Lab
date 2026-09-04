import { HttpException } from '@nestjs/common';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RankingCriterion,
  StrategyType,
  type LeaderboardSnapshot,
} from '@crypto-strategy-lab/shared';
import { LeaderboardController } from './leaderboard.controller';
import {
  LeaderboardErrorCode,
  LeaderboardSortPipe,
  LeaderboardStrategyVersionIdPipe,
} from './leaderboard.dto';
import {
  StrategyEngineUnavailableError,
  type LeaderboardDetail,
} from './leaderboard.service';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';

const STRATEGY_VERSION_ID = '69e1c401-810a-431f-b2d8-d9f732e7f829';
const RESULT_ID = '3d2be150-1ce6-451e-a8c4-2c4d1b7e4618';
const UPDATED_AT = new Date('2026-08-16T03:00:00.000Z');
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

const snapshot: LeaderboardSnapshot = {
  rankingCriterion: RankingCriterion.SCORE,
  updatedAt: UPDATED_AT,
  entries: [],
};

const detail: LeaderboardDetail = {
  rank: 1,
  userId: null,
  strategyVersionId: STRATEGY_VERSION_ID,
  strategyName: 'Moving Average',
  strategyType: 'MA',
  isComposite: false,
  backtestResultId: RESULT_ID,
  score: 0.46,
  totalReturn: 20,
  winRate: 0.6 as LeaderboardDetail['winRate'],
  maxDrawdown: -10,
  sharpeRatio: 1.2,
  totalTrades: 10,
  strategyVersion: {
    id: STRATEGY_VERSION_ID,
    strategyType: StrategyType.MA,
    name: 'Moving Average',
    version: 1,
    parameters: { period: 20 },
    isComposite: false,
    childVersionIds: [],
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  },
  trades: [],
  executedAt: UPDATED_AT,
};

describe('Leaderboard DTO validation', () => {
  const sortPipe = new LeaderboardSortPipe();
  const idPipe = new LeaderboardStrategyVersionIdPipe();

  it('defaults sortBy to score and accepts every shared criterion', () => {
    expect(sortPipe.transform(undefined)).toBe(RankingCriterion.SCORE);
    for (const criterion of Object.values(RankingCriterion)) {
      expect(sortPipe.transform(criterion)).toBe(criterion);
    }
  });

  it('returns stable INVALID_SORT_CRITERION without reflecting raw input', () => {
    expectStableHttpError(
      () => sortPipe.transform('raw-secret-sort'),
      400,
      LeaderboardErrorCode.INVALID_SORT_CRITERION,
    );
  });

  it('accepts UUID strategyVersionId and maps malformed IDs to stable not-found', () => {
    expect(idPipe.transform(STRATEGY_VERSION_ID)).toBe(STRATEGY_VERSION_ID);
    expectStableHttpError(
      () => idPipe.transform('not-a-uuid'),
      404,
      LeaderboardErrorCode.LEADERBOARD_ENTRY_NOT_FOUND,
    );
  });

  it('defines exactly system, mine, combined and validates scope with Combined default', () => {
    const shared = require('@crypto-strategy-lab/shared') as {
      LeaderboardScope?: Record<string, string>;
    };
    const dto = require('./leaderboard.dto') as {
      LeaderboardScopePipe?: new () => {
        transform(value: string | undefined): string;
      };
    };

    expect(shared.LeaderboardScope).toEqual({
      SYSTEM: 'system',
      MINE: 'mine',
      COMBINED: 'combined',
    });
    expect(dto.LeaderboardScopePipe).toEqual(expect.any(Function));
    const scopePipe = new dto.LeaderboardScopePipe!();
    expect(scopePipe.transform(undefined)).toBe('combined');
    expect(scopePipe.transform('')).toBe('combined');
    for (const scope of ['system', 'mine', 'combined']) {
      expect(scopePipe.transform(scope)).toBe(scope);
    }
    expectStableHttpError(
      () => scopePipe.transform('foreign-user'),
      400,
      'INVALID_LEADERBOARD_SCOPE' as LeaderboardErrorCode,
    );
  });
});

describe('LeaderboardController', () => {
  it('delegates list and detail reads without recomputing projections', async () => {
    const service = serviceFake();
    const controller = new LeaderboardController(service as never);

    await expect(controller.list(RankingCriterion.SCORE)).resolves.toBe(
      snapshot,
    );
    await expect(controller.detail(STRATEGY_VERSION_ID)).resolves.toBe(detail);
    expect(service.getLeaderboard).toHaveBeenCalledWith(
      RankingCriterion.SCORE,
      null,
      'combined',
    );
    expect(service.getDetail).toHaveBeenCalledWith(
      STRATEGY_VERSION_ID,
      null,
      'combined',
    );
  });

  it.each(['system', 'mine', 'combined'] as const)(
    'passes explicit %s scope and verified viewer to list and detail',
    async (scope) => {
      const service = serviceFake();
      const controller = new LeaderboardController(
        service as never,
      ) as unknown as {
        list(
          criterion: RankingCriterion,
          viewerUserId: string | null,
          scope: string,
        ): Promise<LeaderboardSnapshot>;
        detail(
          strategyVersionId: string,
          viewerUserId: string | null,
          scope: string,
        ): Promise<LeaderboardDetail>;
      };

      await controller.list(RankingCriterion.SHARPE_RATIO, USER_A, scope);
      await controller.detail(STRATEGY_VERSION_ID, USER_A, scope);

      expect(service.getLeaderboard).toHaveBeenCalledWith(
        RankingCriterion.SHARPE_RATIO,
        USER_A,
        scope,
      );
      expect(service.getDetail).toHaveBeenCalledWith(
        STRATEGY_VERSION_ID,
        USER_A,
        scope,
      );
    },
  );

  it('returns stable LEADERBOARD_ENTRY_NOT_FOUND', async () => {
    const service = serviceFake();
    service.getDetail.mockResolvedValue(null);
    const controller = new LeaderboardController(service as never);

    await expectStableAsyncHttpError(
      controller.detail(STRATEGY_VERSION_ID),
      404,
      LeaderboardErrorCode.LEADERBOARD_ENTRY_NOT_FOUND,
    );
  });

  it('sanitizes Strategy provider failure as STRATEGY_ENGINE_UNAVAILABLE', async () => {
    const service = serviceFake();
    service.getDetail.mockRejectedValue(new StrategyEngineUnavailableError());
    const controller = new LeaderboardController(service as never);

    await expectStableAsyncHttpError(
      controller.detail(STRATEGY_VERSION_ID),
      503,
      LeaderboardErrorCode.STRATEGY_ENGINE_UNAVAILABLE,
    );
  });
});

describe('T011 optional-auth controller scope', () => {
  it('uses SupabaseJwtGuard and CurrentUser on every list/detail read without RequireAuth', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, LeaderboardController)).toEqual(
      [SupabaseJwtGuard],
    );

    const listArgs = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      LeaderboardController,
      'list',
    ) as Record<string, { index: number }> | undefined;
    const detailArgs = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      LeaderboardController,
      'detail',
    ) as Record<string, { index: number }> | undefined;
    expect(Object.values(listArgs ?? {}).some(({ index }) => index === 1)).toBe(
      true,
    );
    expect(
      Object.values(detailArgs ?? {}).some(({ index }) => index === 1),
    ).toBe(true);

    const source = readFileSync(
      join(__dirname, 'leaderboard.controller.ts'),
      'utf8',
    );
    expect(source.match(/@CurrentUser\(\)/g)).toHaveLength(2);
    expect(source).not.toContain('RequireAuth');
  });

  it.each([
    ['anonymous', null],
    ['user A', USER_A],
    ['user B', USER_B],
  ] as const)(
    'passes %s viewer identity unchanged to list and detail service reads',
    async (_actor, viewerUserId) => {
      const service = serviceFake();
      const controller = new LeaderboardController(service as never);

      await controller.list(RankingCriterion.SCORE, viewerUserId);
      await controller.detail(STRATEGY_VERSION_ID, viewerUserId);

      expect(service.getLeaderboard).toHaveBeenCalledWith(
        RankingCriterion.SCORE,
        viewerUserId,
        'combined',
      );
      expect(service.getDetail).toHaveBeenCalledWith(
        STRATEGY_VERSION_ID,
        viewerUserId,
        'combined',
      );
    },
  );
});

function serviceFake() {
  return {
    getLeaderboard: jest.fn().mockResolvedValue(snapshot),
    getDetail: jest.fn().mockResolvedValue(detail),
  };
}

function expectStableHttpError(
  operation: () => unknown,
  status: number,
  code: LeaderboardErrorCode,
): void {
  try {
    operation();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(status);
    expectStableBody((error as HttpException).getResponse(), code);
    return;
  }
  throw new Error(`Expected stable HTTP ${status} ${code}`);
}

async function expectStableAsyncHttpError(
  operation: Promise<unknown>,
  status: number,
  code: LeaderboardErrorCode,
): Promise<void> {
  try {
    await operation;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(status);
    expectStableBody((error as HttpException).getResponse(), code);
    return;
  }
  throw new Error(`Expected stable HTTP ${status} ${code}`);
}

function expectStableBody(
  response: string | object,
  code: LeaderboardErrorCode,
): void {
  expect(typeof response).toBe('object');
  const body = response as { error?: unknown; code?: unknown };
  expect(typeof body.error).toBe('string');
  expect(body.code).toBe(code);
}
