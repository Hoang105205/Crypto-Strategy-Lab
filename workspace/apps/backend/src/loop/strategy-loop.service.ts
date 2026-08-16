import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BacktestSource,
  EventType,
  JobType,
  LoopStatus,
  SearchLoopProgressStatus,
  type BacktestCompletedPayload,
  type BacktestFailedPayload,
  type EventEnvelope,
  type IEventBus,
  type IJobQueue,
  type IStrategyCandidatePort,
  type SearchLoopCandidate,
  type SearchLoopConfig,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';
import {
  IEVENT_BUS,
  IJOB_QUEUE,
  ISCORING_POLICY,
  ISTRATEGY_CANDIDATE_PORT,
} from '../shared/tokens';
import { LoopRepository } from './loop.repository';
import { LoopStatusService } from './loop-status.service';

const DEFAULT_NO_IMPROVEMENT_LIMIT = 50;
const IMPROVEMENT_EPSILON = 0.01;
const MAX_CONSECUTIVE_GENERATION_FAILURES = 3;

export const StrategyLoopErrorCode = {
  INVALID_LOOP_CONFIG: 'INVALID_LOOP_CONFIG',
  QUEUE_UNAVAILABLE: 'QUEUE_UNAVAILABLE',
} as const;

type StrategyLoopErrorCodeValue =
  (typeof StrategyLoopErrorCode)[keyof typeof StrategyLoopErrorCode];

export class StrategyLoopError extends Error {
  constructor(
    readonly code: StrategyLoopErrorCodeValue,
    options?: ErrorOptions,
  ) {
    super(strategyLoopErrorMessage(code), options);
    this.name = 'StrategyLoopError';
  }
}

export type StartLoopInput = Omit<
  SearchLoopConfig,
  'maxCandidates' | 'maxDurationMs' | 'stopOnNoImprovementIterations'
> & {
  maxCandidates?: number | null;
  maxDurationMs?: number | null;
  stopOnNoImprovementIterations?: number;
};

interface ScoringPolicyPort {
  calculateScore(input: BacktestCompletedPayload['metrics']): number;
}

type CandidateCreation =
  SearchLoopCandidate | { candidate: SearchLoopCandidate; created: boolean };

interface RuntimeContext {
  readonly loopRunId: string;
  readonly config: SearchLoopConfig;
  readonly candidateNames: Map<string, string>;
  generationEpoch: number;
  generationAllowed: boolean;
  iteration: number;
  noImprovementIterations: number;
  bestScore: number | null;
  bestStrategyVersionId: string | null;
  scheduling: Promise<void> | null;
}

@Injectable()
export class StrategyLoopService {
  private readonly contexts = new Map<string, RuntimeContext>();
  private readonly stoppedEvents = new Set<string>();

  constructor(
    private readonly repository: LoopRepository,
    private readonly status: LoopStatusService,
    @Inject(ISTRATEGY_CANDIDATE_PORT)
    private readonly generator: IStrategyCandidatePort,
    @Inject(ISCORING_POLICY)
    private readonly scoringPolicy: ScoringPolicyPort,
    @Inject(IJOB_QUEUE) private readonly jobQueue: IJobQueue,
    @Inject(IEVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async start(input: StartLoopInput): Promise<SearchLoopRun> {
    const config = normalizeConfig(input);
    const run = await this.repository.createRun(config);
    const context: RuntimeContext = {
      loopRunId: run.id,
      config,
      candidateNames: new Map(),
      generationEpoch: 0,
      generationAllowed: true,
      iteration: run.iteration,
      noImprovementIterations: 0,
      bestScore: run.bestScore,
      bestStrategyVersionId: run.bestStrategyVersionId,
      scheduling: null,
    };
    this.contexts.set(run.id, context);

    this.eventBus.publish(EventType.SearchLoopStarted, {
      loopRunId: run.id,
      config: {
        generatorType: config.generatorType,
        maxCandidates: config.maxCandidates,
        maxDurationMs: config.maxDurationMs,
        stopOnNoImprovementIterations: config.stopOnNoImprovementIterations,
      },
      startedAt: run.startedAt,
    });

    await this.scheduleNext(context);
    return run;
  }

  async pause(loopRunId: string): Promise<SearchLoopRun> {
    const context = this.invalidateGeneration(loopRunId);
    try {
      return await this.status.pause(loopRunId);
    } catch (error: unknown) {
      this.restoreGeneration(context);
      throw error;
    }
  }

  async resume(loopRunId: string): Promise<SearchLoopRun> {
    const run = await this.status.resume(loopRunId);
    const context = this.contexts.get(loopRunId);
    if (context) {
      context.generationAllowed = true;
      context.generationEpoch += 1;
      await this.scheduleNext(context);
    }
    return run;
  }

  async stop(loopRunId: string): Promise<SearchLoopRun> {
    this.invalidateGeneration(loopRunId);
    const run = await this.status.stop(loopRunId);
    this.publishStoppedOnce(run);
    this.cleanup(loopRunId);
    return run;
  }

  async handleBacktestCompleted(
    envelope: EventEnvelope<BacktestCompletedPayload>,
  ): Promise<void> {
    const { payload } = envelope;
    if (!payload.loopRunId) return;

    const score = this.scoringPolicy.calculateScore(payload.metrics);
    const terminal = await this.repository.recordCandidateCompleted({
      loopRunId: payload.loopRunId,
      jobId: payload.jobId,
      backtestResultId: payload.backtestResultId,
      score,
    });
    if (!terminal.applied) return;

    const context = this.contexts.get(payload.loopRunId);
    if (!context || terminal.run.status !== LoopStatus.RUNNING) return;

    const improved =
      context.bestScore === null ||
      score > context.bestScore + IMPROVEMENT_EPSILON;
    if (improved) {
      context.bestScore = score;
      context.bestStrategyVersionId = payload.strategyVersionId;
      context.noImprovementIterations = 0;
    } else {
      context.noImprovementIterations += 1;
    }

    await this.afterTerminalCandidate(
      context,
      terminal.run,
      terminal.candidate,
      envelope.correlationId,
      improved,
    );
  }

  async handleBacktestFailed(
    envelope: EventEnvelope<BacktestFailedPayload>,
  ): Promise<void> {
    const { payload } = envelope;
    if (!payload.loopRunId) return;

    const terminal = await this.repository.recordCandidateFailed({
      loopRunId: payload.loopRunId,
      jobId: payload.jobId,
    });
    if (!terminal.applied) return;

    const context = this.contexts.get(payload.loopRunId);
    if (!context || terminal.run.status !== LoopStatus.RUNNING) return;

    context.noImprovementIterations += 1;
    await this.afterTerminalCandidate(
      context,
      terminal.run,
      terminal.candidate,
      envelope.correlationId,
      false,
    );
  }

  private scheduleNext(context: RuntimeContext): Promise<void> {
    if (context.scheduling) return context.scheduling;

    const scheduling = this.generateAndDispatch(context).finally(() => {
      if (context.scheduling === scheduling) context.scheduling = null;
    });
    context.scheduling = scheduling;
    return scheduling;
  }

  private async generateAndDispatch(context: RuntimeContext): Promise<void> {
    const epoch = context.generationEpoch;
    let generated: Awaited<
      ReturnType<IStrategyCandidatePort['generateCandidate']>
    > | null = null;

    for (
      let attempt = 1;
      attempt <= MAX_CONSECUTIVE_GENERATION_FAILURES;
      attempt += 1
    ) {
      if (!this.canGenerate(context, epoch)) return;
      try {
        generated = await this.generator.generateCandidate(
          context.config.generatorType,
        );
        break;
      } catch (error: unknown) {
        if (!this.canGenerate(context, epoch)) return;
        if (attempt === MAX_CONSECUTIVE_GENERATION_FAILURES) {
          await this.failForGenerator(context);
          return;
        }
      }
    }
    if (!generated || !this.canGenerate(context, epoch)) return;

    if (!this.canGenerate(context, epoch)) return;

    // Linearization point: commands that invalidated generation before this
    // point win. After this point the candidate is in-flight and may finish
    // even if the run is paused/stopped concurrently.
    const iteration = context.iteration + 1;
    const producerJobId = randomUUID();
    const created = (await this.repository.createCandidate({
      loopRunId: context.loopRunId,
      jobId: producerJobId,
      strategyVersionId: generated.strategyVersionId,
      iteration,
    })) as CandidateCreation;
    const candidate = unwrapCandidate(created);
    context.iteration = iteration;
    context.candidateNames.set(candidate.jobId, generated.strategyName);

    const correlationId = randomUUID();
    const request = {
      jobId: candidate.jobId,
      strategyVersionId: candidate.strategyVersionId,
      pair: context.config.pair,
      timeframe: context.config.timeframe,
      startDate: context.config.startDate,
      endDate: context.config.endDate,
      backtestConfig: context.config.backtestConfig,
      source: BacktestSource.SEARCH_LOOP,
      loopRunId: context.loopRunId,
    } as const;

    try {
      await this.jobQueue.enqueue(JobType.BACKTEST, request, correlationId);
    } catch (error: unknown) {
      throw new StrategyLoopError(StrategyLoopErrorCode.QUEUE_UNAVAILABLE, {
        cause: error,
      });
    }

    await this.persistDispatchProgress(context, candidate, iteration);
    this.eventBus.publish(EventType.BacktestRequested, request, correlationId);
  }

  private async afterTerminalCandidate(
    context: RuntimeContext,
    run: SearchLoopRun,
    candidate: SearchLoopCandidate,
    correlationId: string,
    improved: boolean,
  ): Promise<void> {
    const current = await this.status.getCurrent();
    if (
      !context.generationAllowed ||
      current?.id !== run.id ||
      current.status !== LoopStatus.RUNNING
    ) {
      return;
    }

    await this.persistTerminalProgress(context, run, improved);
    this.publishProgress(context, run, candidate, correlationId);

    const stopReason = this.getAutomaticStopReason(context, run);
    if (stopReason) {
      const completed = await this.status.complete(run.id, stopReason);
      this.publishStoppedOnce(completed, correlationId);
      this.cleanup(run.id);
      return;
    }

    await this.scheduleNext(context);
  }

  private getAutomaticStopReason(
    context: RuntimeContext,
    run: SearchLoopRun,
  ): string | null {
    if (
      run.maxCandidates !== null &&
      run.testedCandidates >= run.maxCandidates
    ) {
      return 'max_candidates_reached';
    }
    if (
      run.maxDurationMs !== null &&
      Date.now() - run.startedAt.getTime() >= run.maxDurationMs
    ) {
      return 'max_duration_reached';
    }
    if (context.noImprovementIterations >= run.stopOnNoImprovementIterations) {
      return 'no_improvement_limit_reached';
    }
    return null;
  }

  private publishProgress(
    context: RuntimeContext,
    run: SearchLoopRun,
    candidate: SearchLoopCandidate,
    correlationId: string,
  ): void {
    this.eventBus.publish(
      EventType.SearchLoopProgress,
      {
        loopRunId: run.id,
        iteration: candidate.iteration,
        testedCandidates: run.testedCandidates,
        currentCandidate: {
          strategyVersionId: candidate.strategyVersionId,
          strategyName: context.candidateNames.get(candidate.jobId) ?? null,
          status: SearchLoopProgressStatus.EVALUATING,
        },
        bestScoreSoFar: context.bestScore,
        bestStrategyVersionId: context.bestStrategyVersionId,
      },
      correlationId,
    );
  }

  private publishStoppedOnce(run: SearchLoopRun, correlationId?: string): void {
    if (this.stoppedEvents.has(run.id)) return;
    if (!isTerminal(run.status)) return;

    this.stoppedEvents.add(run.id);
    this.eventBus.publish(
      EventType.SearchLoopStopped,
      {
        loopRunId: run.id,
        status: run.status,
        stopReason: run.stopReason ?? 'unknown',
        testedCandidates: run.testedCandidates,
        bestStrategyVersionId: run.bestStrategyVersionId,
        bestScore: run.bestScore,
        startedAt: run.startedAt,
        stoppedAt: run.stoppedAt ?? new Date(),
      },
      correlationId,
    );
  }

  private async failForGenerator(context: RuntimeContext): Promise<void> {
    if (!this.canGenerate(context, context.generationEpoch)) return;
    const failed = await this.status.fail(context.loopRunId, 'generator_error');
    this.publishStoppedOnce(failed);
    this.cleanup(context.loopRunId);
  }

  private async persistDispatchProgress(
    context: RuntimeContext,
    candidate: SearchLoopCandidate,
    iteration: number,
  ): Promise<void> {
    await this.transitionRunIfAvailable(
      context.loopRunId,
      [LoopStatus.RUNNING, LoopStatus.PAUSED],
      {
        iteration,
        currentCandidateStrategyVersionId: candidate.strategyVersionId,
      },
    );
  }

  private async persistTerminalProgress(
    context: RuntimeContext,
    run: SearchLoopRun,
    improved: boolean,
  ): Promise<void> {
    await this.transitionRunIfAvailable(run.id, [LoopStatus.RUNNING], {
      currentCandidateStrategyVersionId: null,
      bestScore: improved ? context.bestScore : undefined,
      bestStrategyVersionId: improved
        ? context.bestStrategyVersionId
        : undefined,
    });
  }

  private async transitionRunIfAvailable(
    loopRunId: string,
    expected: readonly LoopStatus[],
    update: Partial<SearchLoopRun>,
  ): Promise<void> {
    const repository = this.repository as LoopRepository & {
      transitionRun?: (
        id: string,
        statuses: readonly LoopStatus[],
        changes: Partial<SearchLoopRun>,
      ) => Promise<SearchLoopRun | null>;
    };
    await repository.transitionRun?.(loopRunId, expected, update);
  }

  private invalidateGeneration(loopRunId: string): RuntimeContext | undefined {
    const context = this.contexts.get(loopRunId);
    if (context) {
      context.generationAllowed = false;
      context.generationEpoch += 1;
    }
    return context;
  }

  private restoreGeneration(context: RuntimeContext | undefined): void {
    if (context && this.contexts.get(context.loopRunId) === context) {
      context.generationAllowed = true;
      context.generationEpoch += 1;
    }
  }

  private canGenerate(context: RuntimeContext, epoch: number): boolean {
    return (
      this.contexts.get(context.loopRunId) === context &&
      context.generationAllowed &&
      context.generationEpoch === epoch
    );
  }

  private cleanup(loopRunId: string): void {
    const context = this.contexts.get(loopRunId);
    if (context) {
      context.generationAllowed = false;
      context.generationEpoch += 1;
      context.candidateNames.clear();
    }
    this.contexts.delete(loopRunId);
  }
}

function normalizeConfig(input: StartLoopInput): SearchLoopConfig {
  const maxCandidates = input.maxCandidates ?? null;
  const maxDurationMs = input.maxDurationMs ?? null;
  const stopOnNoImprovementIterations =
    input.stopOnNoImprovementIterations ?? DEFAULT_NO_IMPROVEMENT_LIMIT;

  if (
    !isPositiveIntegerOrNull(maxCandidates) ||
    !isPositiveNumberOrNull(maxDurationMs) ||
    !Number.isInteger(stopOnNoImprovementIterations) ||
    stopOnNoImprovementIterations <= 0 ||
    !(input.startDate instanceof Date) ||
    !Number.isFinite(input.startDate.getTime()) ||
    !(input.endDate instanceof Date) ||
    !Number.isFinite(input.endDate.getTime()) ||
    input.endDate.getTime() <= input.startDate.getTime() ||
    input.pair.trim().length === 0 ||
    input.timeframe.trim().length === 0
  ) {
    throw new StrategyLoopError(StrategyLoopErrorCode.INVALID_LOOP_CONFIG);
  }

  return {
    ...input,
    maxCandidates,
    maxDurationMs,
    stopOnNoImprovementIterations,
  };
}

function unwrapCandidate(created: CandidateCreation): SearchLoopCandidate {
  return 'candidate' in created ? created.candidate : created;
}

function isPositiveIntegerOrNull(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value > 0);
}

function isPositiveNumberOrNull(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value > 0);
}

function isTerminal(
  status: LoopStatus,
): status is
  LoopStatus.COMPLETED | LoopStatus.STOPPED_BY_USER | LoopStatus.FAILED {
  return (
    status === LoopStatus.COMPLETED ||
    status === LoopStatus.STOPPED_BY_USER ||
    status === LoopStatus.FAILED
  );
}

function strategyLoopErrorMessage(code: StrategyLoopErrorCodeValue): string {
  switch (code) {
    case StrategyLoopErrorCode.INVALID_LOOP_CONFIG:
      return 'Invalid search loop configuration';
    case StrategyLoopErrorCode.QUEUE_UNAVAILABLE:
      return 'Backtest queue is unavailable';
  }
}
