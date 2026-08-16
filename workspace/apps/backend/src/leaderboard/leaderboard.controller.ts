import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import {
  RankingCriterion,
  type LeaderboardSnapshot,
} from '@crypto-strategy-lab/shared';
import {
  LeaderboardErrorCode,
  LeaderboardSortPipe,
  LeaderboardStrategyVersionIdPipe,
} from './leaderboard.dto';
import {
  LeaderboardService,
  StrategyEngineUnavailableError,
  type LeaderboardDetail,
} from './leaderboard.service';

@Controller('api/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  list(
    @Query('sortBy', LeaderboardSortPipe) sortBy: RankingCriterion,
  ): Promise<LeaderboardSnapshot> {
    return this.leaderboard.getLeaderboard(sortBy);
  }

  @Get(':strategyVersionId')
  async detail(
    @Param('strategyVersionId', LeaderboardStrategyVersionIdPipe)
    strategyVersionId: string,
  ): Promise<LeaderboardDetail> {
    try {
      const detail = await this.leaderboard.getDetail(strategyVersionId);
      if (detail) return detail;
      throw stableError(
        HttpStatus.NOT_FOUND,
        'Leaderboard entry not found',
        LeaderboardErrorCode.LEADERBOARD_ENTRY_NOT_FOUND,
      );
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      if (error instanceof StrategyEngineUnavailableError) {
        throw stableError(
          HttpStatus.SERVICE_UNAVAILABLE,
          'Strategy Engine is unavailable',
          LeaderboardErrorCode.STRATEGY_ENGINE_UNAVAILABLE,
        );
      }
      throw error;
    }
  }
}

function stableError(
  status: HttpStatus,
  error: string,
  code: LeaderboardErrorCode,
): HttpException {
  return new HttpException({ error, code }, status);
}
