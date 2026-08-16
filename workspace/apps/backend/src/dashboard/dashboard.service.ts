import { Inject, Injectable } from '@nestjs/common';
import {
  RankingCriterion,
  type IJobQueue,
  type LeaderboardSnapshot,
  type QueueStats,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { LoopStatusService } from '../loop/loop-status.service';
import { IJOB_QUEUE } from '../shared/tokens';

const DASHBOARD_LEADERBOARD_LIMIT = 5;

export interface DashboardSummary {
  leaderboard: LeaderboardSnapshot;
  loop: SearchLoopRun | null;
  queue: QueueStats;
  generatedAt: Date;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly loopStatus: LoopStatusService,
    @Inject(IJOB_QUEUE) private readonly jobQueue: IJobQueue,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const [leaderboard, loop, queue] = await Promise.all([
      this.leaderboard.getLeaderboard(RankingCriterion.SCORE),
      this.loopStatus.getCurrent(),
      this.jobQueue.getStats(),
    ]);

    return {
      leaderboard: {
        rankingCriterion: leaderboard.rankingCriterion,
        updatedAt: leaderboard.updatedAt,
        entries: leaderboard.entries.slice(0, DASHBOARD_LEADERBOARD_LIMIT),
      },
      loop,
      queue,
      generatedAt: new Date(),
    };
  }
}
