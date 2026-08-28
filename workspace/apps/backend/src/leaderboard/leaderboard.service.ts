import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  EventType,
  LeaderboardScope,
  RankingCriterion,
  type BacktestResultDetail,
  type BacktestCompletedPayload,
  type EventEnvelope,
  type EventSubscription,
  type IBacktestResultPort,
  type IEventBus,
  type LeaderboardEntryPayload,
  type NormalizedRate,
  type LeaderboardSnapshot,
  type StrategyVersion,
  type Trade,
} from '@crypto-strategy-lab/shared';
import { IBACKTEST_RESULT_PORT, IEVENT_BUS } from '../shared/tokens';
import { LeaderboardRepository } from './leaderboard.repository';
import { ISCORING_POLICY } from '../shared/tokens';
import type { IScoringPolicy } from './scoring-policy';

export const LEADERBOARD_ORPHAN_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export interface LeaderboardDetail extends LeaderboardEntryPayload {
  strategyVersion: StrategyVersion;
  trades: Trade[];
  executedAt: Date;
}

export class StrategyEngineUnavailableError extends Error {
  constructor() {
    super('Strategy Engine is unavailable');
    this.name = 'StrategyEngineUnavailableError';
  }
}

@Injectable()
export class LeaderboardService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeaderboardService.name);
  private subscription: EventSubscription | null = null;
  private cleanupInFlight: Promise<number> | null = null;

  constructor(
    @Inject(IEVENT_BUS) private readonly eventBus: IEventBus,
    private readonly repository: LeaderboardRepository,
    @Inject(ISCORING_POLICY)
    private readonly scoringPolicy: IScoringPolicy,
    @Inject(IBACKTEST_RESULT_PORT)
    private readonly resultPort: IBacktestResultPort,
  ) {}

  onModuleInit(): void {
    if (this.subscription) return;
    this.subscription = this.eventBus.subscribe(
      EventType.BacktestCompleted,
      (envelope) => this.handleBacktestCompleted(envelope),
    );
    void this.cleanupOrphans().catch((error: unknown) => {
      const detail =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
      this.logger.error(
        'Leaderboard orphan cleanup failed during startup',
        detail,
      );
    });
  }

  onModuleDestroy(): void {
    if (!this.subscription) return;
    const subscription = this.subscription;
    this.subscription = null;
    this.eventBus.unsubscribe(subscription);
  }

  @Interval(
    'leaderboard-orphan-cleanup',
    LEADERBOARD_ORPHAN_CLEANUP_INTERVAL_MS,
  )
  cleanupOrphans(): Promise<number> {
    if (this.cleanupInFlight) return this.cleanupInFlight;
    const cleanup = this.performOrphanCleanup().finally(() => {
      if (this.cleanupInFlight === cleanup) this.cleanupInFlight = null;
    });
    this.cleanupInFlight = cleanup;
    return cleanup;
  }

  private async performOrphanCleanup(): Promise<number> {
    const references = await this.repository.findSourceReferences();
    const checks = await Promise.allSettled(
      references.map((reference) =>
        this.resultPort.getById(reference.backtestResultId),
      ),
    );
    const orphanIds = references.flatMap((reference, index) => {
      const check = checks[index];
      if (check?.status !== 'fulfilled') return [];
      const source = check.value;
      return source === null ||
        source.strategyVersionId !== reference.strategyVersionId ||
        source.userId !== reference.userId
        ? [reference.id]
        : [];
    });
    if (orphanIds.length === 0) return 0;
    const deleted = await this.repository.deleteByIds(orphanIds);
    if (deleted > 0) {
      await this.repository.rerank();
      this.logger.warn(`Removed ${deleted} orphaned leaderboard entries`);
    }
    return deleted;
  }

  async handleBacktestCompleted(
    envelope: EventEnvelope<
      BacktestCompletedPayload,
      typeof EventType.BacktestCompleted
    >,
  ): Promise<void> {
    const normalized = normalizePayload(envelope.payload);
    if (!normalized) return;

    const existing = await this.repository.findByBacktestResultId(
      normalized.backtestResultId,
    );
    if (existing) return;

    const score = this.scoringPolicy.calculateScore(normalized.metrics);
    if (!Number.isFinite(score)) return;

    const created = await this.repository.create({
      userId: normalized.userId,
      strategyVersionId: normalized.strategyVersionId,
      strategyName: normalized.strategyName,
      strategyType: normalized.strategyType,
      isComposite: normalized.isComposite,
      backtestResultId: normalized.backtestResultId,
      score,
      totalReturn: normalized.metrics.totalReturn,
      winRate: normalized.metrics.winRate,
      maxDrawdown: normalized.metrics.maxDrawdown,
      sharpeRatio: normalized.metrics.sharpeRatio,
      totalTrades: normalized.metrics.totalTrades,
      executedAt: normalized.executedAt,
    });
    if (!created) return;

    await this.repository.rerank();
    const topK = await this.repository.getTopK(
      RankingCriterion.SCORE,
      null,
      LeaderboardScope.SYSTEM,
    );
    const updatedAt = await this.repository.getUpdatedAt(
      null,
      LeaderboardScope.SYSTEM,
    );

    this.eventBus.publish(
      EventType.LeaderboardUpdated,
      {
        updatedAt,
        triggeredByBacktestResultId:
          normalized.userId === null ? normalized.backtestResultId : null,
        rankingCriterion: RankingCriterion.SCORE,
        topK,
      },
      envelope.correlationId,
    );
  }

  async getDetail(
    strategyVersionId: string,
    viewerUserId: string | null = null,
    scope: LeaderboardScope = LeaderboardScope.COMBINED,
  ): Promise<LeaderboardDetail | null> {
    const entry = await this.repository.findBestByStrategyVersionId(
      strategyVersionId,
      viewerUserId,
      scope,
    );
    if (!entry) return null;

    let result: BacktestResultDetail | null;
    try {
      result = await this.resultPort.getById(entry.backtestResultId);
    } catch {
      throw new StrategyEngineUnavailableError();
    }
    if (!result) return null;

    return {
      ...entry,
      strategyVersion: result.strategyVersion,
      trades: result.trades,
      executedAt: result.executedAt,
    };
  }

  async getLeaderboard(
    criterion: RankingCriterion = RankingCriterion.SCORE,
    viewerUserId: string | null = null,
    scope: LeaderboardScope = LeaderboardScope.COMBINED,
  ): Promise<LeaderboardSnapshot> {
    const projectedEntries = await this.repository.getTopK(
      criterion,
      viewerUserId,
      scope,
    );
    const sourceResults = await Promise.all(
      projectedEntries.map((entry) =>
        this.resultPort.getById(entry.backtestResultId),
      ),
    );
    const entries = projectedEntries
      .filter((entry, index) => {
        const source = sourceResults[index];
        return (
          source != null &&
          source.strategyVersionId === entry.strategyVersionId &&
          source.userId === entry.userId
        );
      })
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    const updatedAt =
      entries.length === 0
        ? new Date(0)
        : await this.repository.getUpdatedAt(viewerUserId, scope);
    return { rankingCriterion: criterion, updatedAt, entries };
  }
}

interface NormalizedCompletion extends Omit<
  BacktestCompletedPayload,
  'metrics'
> {
  metrics: BacktestCompletedPayload['metrics'];
}

function normalizePayload(
  payload: BacktestCompletedPayload,
): NormalizedCompletion | null {
  const { metrics } = payload;
  if (
    !isFiniteNumber(metrics.totalReturn) ||
    !isFiniteNumber(metrics.winRate) ||
    !isFiniteNumber(metrics.maxDrawdown) ||
    !isFiniteNumber(metrics.sharpeRatio) ||
    !isFiniteNumber(metrics.profitFactor) ||
    metrics.winRate < 0 ||
    metrics.winRate > 1 ||
    !Number.isInteger(metrics.totalTrades) ||
    metrics.totalTrades < 0 ||
    !(payload.executedAt instanceof Date) ||
    !Number.isFinite(payload.executedAt.getTime())
  ) {
    return null;
  }

  const zeroTrades = metrics.totalTrades === 0;
  return {
    ...payload,
    metrics: {
      ...metrics,
      totalReturn: zeroTrades ? 0 : metrics.totalReturn,
      winRate: (zeroTrades ? 0 : metrics.winRate) as NormalizedRate,
    },
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
