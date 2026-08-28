import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import {
  LeaderboardScope,
  RankingCriterion,
} from '@crypto-strategy-lab/shared';

export enum LeaderboardErrorCode {
  INVALID_SORT_CRITERION = 'INVALID_SORT_CRITERION',
  INVALID_LEADERBOARD_SCOPE = 'INVALID_LEADERBOARD_SCOPE',
  LEADERBOARD_ENTRY_NOT_FOUND = 'LEADERBOARD_ENTRY_NOT_FOUND',
  STRATEGY_ENGINE_UNAVAILABLE = 'STRATEGY_ENGINE_UNAVAILABLE',
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RANKING_CRITERIA = new Set<string>(Object.values(RankingCriterion));
const LEADERBOARD_SCOPES = new Set<string>(Object.values(LeaderboardScope));

@Injectable()
export class LeaderboardSortPipe implements PipeTransform<
  string | undefined,
  RankingCriterion
> {
  transform(value: string | undefined): RankingCriterion {
    if (value === undefined || value === '') return RankingCriterion.SCORE;
    if (!RANKING_CRITERIA.has(value)) {
      throw new BadRequestException({
        error: 'Invalid leaderboard sort criterion',
        code: LeaderboardErrorCode.INVALID_SORT_CRITERION,
      });
    }
    return value as RankingCriterion;
  }
}

@Injectable()
export class LeaderboardScopePipe implements PipeTransform<
  string | undefined,
  LeaderboardScope
> {
  transform(value: string | undefined): LeaderboardScope {
    if (value === undefined || value === '') return LeaderboardScope.COMBINED;
    if (!LEADERBOARD_SCOPES.has(value)) {
      throw new BadRequestException({
        error: 'Invalid leaderboard scope',
        code: LeaderboardErrorCode.INVALID_LEADERBOARD_SCOPE,
      });
    }
    return value as LeaderboardScope;
  }
}

@Injectable()
export class LeaderboardStrategyVersionIdPipe implements PipeTransform<
  string,
  string
> {
  transform(value: string): string {
    if (!UUID_PATTERN.test(value)) {
      throw new HttpException(
        {
          error: 'Leaderboard entry not found',
          code: LeaderboardErrorCode.LEADERBOARD_ENTRY_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return value;
  }
}
