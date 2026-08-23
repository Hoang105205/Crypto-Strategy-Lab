import { Inject, Injectable } from '@nestjs/common';
import {
  EventType,
  JobType,
  type BacktestCompletedPayload,
  type BacktestDeadLetteredPayload,
  type BacktestFailedPayload,
  type BacktestRequestedPayload,
  type EvaluationMetrics,
  type IBacktester,
  type IBacktestResultPort,
  type IEvaluator,
  type IEventBus,
  type IMarketDataService,
  type IStrategyExecutionPort,
  type NormalizedRate,
} from '@crypto-strategy-lab/shared';
import { Job, UnrecoverableError } from 'bullmq';
import {
  IBACKTESTER,
  IBACKTEST_RESULT_PORT,
  IEVALUATOR,
  IEVENT_BUS,
  IMARKET_DATA_SERVICE,
  ISTRATEGY_EXECUTION_PORT,
} from '../shared/tokens';
import type { StoredBacktestJob } from './bullmq-job.queue';
import { DeadLetterRepository } from './dead-letter.repository';

const WorkerFailureCode = {
  NO_HISTORICAL_CANDLES: 'NO_HISTORICAL_CANDLES',
  STRATEGY_VERSION_NOT_FOUND: 'STRATEGY_VERSION_NOT_FOUND',
  MARKET_DATA_UNAVAILABLE: 'MARKET_DATA_UNAVAILABLE',
  STRATEGY_ENGINE_UNAVAILABLE: 'STRATEGY_ENGINE_UNAVAILABLE',
  BACKTEST_EXECUTION_FAILED: 'BACKTEST_EXECUTION_FAILED',
  EVALUATION_FAILED: 'EVALUATION_FAILED',
  INVALID_EVALUATION_METRICS: 'INVALID_EVALUATION_METRICS',
  RESULT_PERSISTENCE_FAILED: 'RESULT_PERSISTENCE_FAILED',
} as const;

type WorkerFailureCodeValue =
  (typeof WorkerFailureCode)[keyof typeof WorkerFailureCode];

class WorkerFailure extends Error {
  constructor(
    readonly code: WorkerFailureCodeValue,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = 'WorkerFailure';
  }
}

@Injectable()
export class BacktestWorker {
  /** Coalesces overlapping BullMQ stalled delivery inside this worker process. */
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    @Inject(IMARKET_DATA_SERVICE)
    private readonly marketDataService: IMarketDataService,
    @Inject(ISTRATEGY_EXECUTION_PORT)
    private readonly strategyExecutionPort: IStrategyExecutionPort,
    @Inject(IBACKTESTER)
    private readonly backtester: IBacktester,
    @Inject(IEVALUATOR)
    private readonly evaluator: IEvaluator,
    @Inject(IBACKTEST_RESULT_PORT)
    private readonly resultPort: IBacktestResultPort,
    @Inject(IEVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly deadLetterRepository: DeadLetterRepository,
  ) {}

  process(job: Job<StoredBacktestJob>): Promise<void> {
    const jobId = job.data.payload.jobId;
    const active = this.inFlight.get(jobId);
    if (active) return active;

    const processing = this.execute(job).finally(() => {
      if (this.inFlight.get(jobId) === processing) {
        this.inFlight.delete(jobId);
      }
    });
    this.inFlight.set(jobId, processing);
    return processing;
  }

  private async execute(job: Job<StoredBacktestJob>): Promise<void> {
    const { payload, correlationId } = job.data;
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;

    try {
      const startedAt = Date.now();
      // BullMQ serializes job data as JSON, so Date values cross the Redis
      // boundary as ISO strings even though the public producer contract uses
      // Date. Rehydrate once at the worker boundary before calling domain ports.
      const startDate = rehydrateDate(payload.startDate);
      const endDate = rehydrateDate(payload.endDate);
      const candles = await this.stage(
        WorkerFailureCode.MARKET_DATA_UNAVAILABLE,
        () =>
          this.marketDataService.getCandlesRange(
            payload.pair,
            payload.timeframe,
            startDate,
            endDate,
          ),
      );
      if (candles.length === 0) {
        throw new WorkerFailure(
          WorkerFailureCode.NO_HISTORICAL_CANDLES,
          false,
        );
      }

      const resolved = await this.stage(
        WorkerFailureCode.STRATEGY_ENGINE_UNAVAILABLE,
        () =>
          this.strategyExecutionPort.resolveVersion(payload.strategyVersionId),
      );
      if (!resolved) {
        throw new WorkerFailure(
          WorkerFailureCode.STRATEGY_VERSION_NOT_FOUND,
          false,
        );
      }

      const trades = await this.stage(
        WorkerFailureCode.BACKTEST_EXECUTION_FAILED,
        () => this.backtester.run(resolved.strategy, candles, payload.backtestConfig),
      );
      const rawMetrics = await this.stage(
        WorkerFailureCode.EVALUATION_FAILED,
        () => this.evaluator.evaluate(trades, payload.backtestConfig.initialCapital),
      );
      const metrics = normalizeMetrics(rawMetrics);
      const executedAt = new Date();
      const executionTimeMs = Math.max(0, Date.now() - startedAt);

      const saved = await this.stage(
        WorkerFailureCode.RESULT_PERSISTENCE_FAILED,
        () =>
          this.resultPort.save({
            jobId: payload.jobId,
            userId: payload.userId,
            strategyVersionId: payload.strategyVersionId,
            pair: payload.pair,
            timeframe: payload.timeframe,
            startDate,
            endDate,
            ...metrics,
            trades,
            executedAt,
            executionTimeMs,
          }),
      );

      const completion: BacktestCompletedPayload = {
        jobId: payload.jobId,
        correlationId,
        userId: payload.userId,
        loopRunId: payload.loopRunId,
        backtestResultId: saved.id,
        strategyVersionId: payload.strategyVersionId,
        strategyName: resolved.version.name,
        strategyType: resolved.version.strategyType,
        isComposite: resolved.version.isComposite,
        pair: payload.pair,
        timeframe: payload.timeframe,
        status: 'SUCCESS',
        metrics: {
          totalReturn: saved.totalReturn,
          winRate: normalizeWinRate(saved.winRate),
          maxDrawdown: saved.maxDrawdown,
          sharpeRatio: saved.sharpeRatio,
          profitFactor: saved.profitFactor,
          totalTrades: saved.totalTrades,
        },
        executedAt: saved.executedAt,
        executionTimeMs: saved.executionTimeMs,
      };
      this.eventBus.publish(
        EventType.BacktestCompleted,
        completion,
        correlationId,
      );
    } catch (error: unknown) {
      const failure = toWorkerFailure(error);
      if (failure.retryable && attempt < maxAttempts) throw failure;

      await this.publishTerminal(
        job,
        payload,
        correlationId,
        attempt,
        failure.code,
      );
      if (!failure.retryable) {
        throw new UnrecoverableError(failure.code);
      }
      throw failure;
    }
  }

  private async publishTerminal(
    job: Job<StoredBacktestJob>,
    payload: BacktestRequestedPayload,
    correlationId: string,
    attempts: number,
    lastError: string,
  ): Promise<void> {
    // Mark the authoritative Redis lifecycle before mirroring/publishing. This
    // lets IJobQueue project DEAD_LETTER and makes an operator retry eligible.
    // Unit fixtures predating the production BullMQ integration may omit
    // updateData; real BullMQ Job instances always provide it.
    if (typeof job.updateData === 'function') {
      await job.updateData({
        ...job.data,
        queueMetadata: {
          enqueueToken:
            job.data.queueMetadata?.enqueueToken ?? String(job.id ?? payload.jobId),
          deadLettered: true,
          deadLetterReason: lastError,
        },
      });
    }
    const deadLetteredAt = new Date();
    const mirrored = await this.deadLetterRepository.mirror({
      jobId: payload.jobId,
      jobType: JobType.BACKTEST,
      payload: { ...payload },
      attempts,
      lastError,
      deadLetteredAt,
    });
    if (!mirrored.created) return;

    const failed: BacktestFailedPayload = {
      jobId: payload.jobId,
      correlationId,
      loopRunId: payload.loopRunId,
      strategyVersionId: payload.strategyVersionId,
      error: lastError,
      attempt: attempts,
    };
    const deadLettered: BacktestDeadLetteredPayload = {
      jobId: payload.jobId,
      correlationId,
      jobType: JobType.BACKTEST,
      lastError,
      attempts,
      deadLetteredAt: mirrored.job.deadLetteredAt,
    };
    this.eventBus.publish(EventType.BacktestFailed, failed, correlationId);
    this.eventBus.publish(
      EventType.BacktestDeadLettered,
      deadLettered,
      correlationId,
    );
  }

  private async stage<T>(
    code: WorkerFailureCodeValue,
    operation: () => T | Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof WorkerFailure) throw error;
      throw new WorkerFailure(code, true, { cause: error });
    }
  }
}

function rehydrateDate(value: Date): Date {
  const date = value instanceof Date ? value : new Date(value as unknown as string);
  if (!Number.isFinite(date.getTime())) {
    throw new WorkerFailure(
      WorkerFailureCode.BACKTEST_EXECUTION_FAILED,
      false,
    );
  }
  return date;
}

function normalizeMetrics(metrics: EvaluationMetrics): EvaluationMetrics & {
  winRate: NormalizedRate;
} {
  const numeric = [
    metrics.totalReturn,
    metrics.maxDrawdown,
    metrics.sharpeRatio,
    metrics.profitFactor,
  ];
  if (
    numeric.some((value) => !Number.isFinite(value)) ||
    !Number.isInteger(metrics.totalTrades) ||
    metrics.totalTrades < 0
  ) {
    throw new WorkerFailure(
      WorkerFailureCode.INVALID_EVALUATION_METRICS,
      true,
    );
  }
  return { ...metrics, winRate: normalizeWinRate(metrics.winRate) };
}

function normalizeWinRate(value: number): NormalizedRate {
  if (!Number.isFinite(value)) {
    throw new WorkerFailure(
      WorkerFailureCode.INVALID_EVALUATION_METRICS,
      true,
    );
  }
  const normalized = value > 1 && value <= 100 ? value / 100 : value;
  if (normalized < 0 || normalized > 1) {
    throw new WorkerFailure(
      WorkerFailureCode.INVALID_EVALUATION_METRICS,
      true,
    );
  }
  return normalized as NormalizedRate;
}

function toWorkerFailure(error: unknown): WorkerFailure {
  return error instanceof WorkerFailure
    ? error
    : new WorkerFailure(WorkerFailureCode.BACKTEST_EXECUTION_FAILED, true, {
        cause: error,
      });
}
