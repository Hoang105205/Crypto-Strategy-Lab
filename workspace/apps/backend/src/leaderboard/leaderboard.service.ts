import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  EventType,
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
  private subscription: EventSubscription | null = null;

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
  }

  onModuleDestroy(): void {
    if (!this.subscription) return;
    const subscription = this.subscription;
    this.subscription = null;
    this.eventBus.unsubscribe(subscription);
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
    const topK = await this.repository.getTopK(RankingCriterion.SCORE);
    const updatedAt = await this.repository.getUpdatedAt();

    this.eventBus.publish(
      EventType.LeaderboardUpdated,
      {
        updatedAt,
        triggeredByBacktestResultId: normalized.backtestResultId,
        rankingCriterion: RankingCriterion.SCORE,
        topK,
      },
      envelope.correlationId,
    );
  }

  async getDetail(
    strategyVersionId: string,
  ): Promise<LeaderboardDetail | null> {
    const entry =
      await this.repository.findBestByStrategyVersionId(strategyVersionId);
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
  ): Promise<LeaderboardSnapshot> {
    const entries = await this.repository.getTopK(criterion);
    const updatedAt = await this.repository.getUpdatedAt();
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
