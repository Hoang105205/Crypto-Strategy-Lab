import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  UseGuards,
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
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';

@UseGuards(SupabaseJwtGuard)
@Controller('api/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  list(
    @Query('sortBy', LeaderboardSortPipe) sortBy: RankingCriterion,
    @CurrentUser() viewerUserId: string | null = null,
  ): Promise<LeaderboardSnapshot> {
    return this.leaderboard.getLeaderboard(sortBy, viewerUserId);
  }

  @Get(':strategyVersionId')
  async detail(
    @Param('strategyVersionId', LeaderboardStrategyVersionIdPipe)
    strategyVersionId: string,
    @CurrentUser() viewerUserId: string | null = null,
  ): Promise<LeaderboardDetail> {
    try {
      const detail = await this.leaderboard.getDetail(
        strategyVersionId,
        viewerUserId,
      );
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
