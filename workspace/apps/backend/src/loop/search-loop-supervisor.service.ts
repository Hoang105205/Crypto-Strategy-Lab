import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { LoopStatus, type SearchLoopConfig } from '@crypto-strategy-lab/shared';
import { LoopStatusService } from './loop-status.service';
import {
  SearchLoopControlRepository,
  type SearchLoopControlState,
} from './search-loop-control.repository';
import { StrategyLoopService } from './strategy-loop.service';

export const SEARCH_LOOP_SUPERVISOR_INTERVAL_MS = 15_000;
export const SEARCH_LOOP_SUPERVISOR_LEASE_MS = 60_000;
const MAX_FAILURE_BACKOFF_MS = 30 * 60_000;

@Injectable()
export class SearchLoopSupervisorService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SearchLoopSupervisorService.name);
  private readonly ownerId = randomUUID();
  private running = false;

  constructor(
    private readonly controls: SearchLoopControlRepository,
    private readonly loop: StrategyLoopService,
    private readonly status: LoopStatusService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.runOnce();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.controls.releaseLease(this.ownerId);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to release Search Loop lease: ${errorText(error)}`,
      );
    }
  }

  @Interval(SEARCH_LOOP_SUPERVISOR_INTERVAL_MS)
  async runScheduled(): Promise<void> {
    await this.runOnce();
  }

  async runOnce(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.ensureDesiredState(now);
    } catch (error: unknown) {
      this.logger.error(
        `Search Loop supervisor tick failed: ${errorText(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async ensureDesiredState(now: Date): Promise<void> {
    const leaseUntil = addMilliseconds(now, SEARCH_LOOP_SUPERVISOR_LEASE_MS);
    const control = await this.controls.tryAcquireLease(
      this.ownerId,
      now,
      leaseUntil,
    );
    if (!control) return;

    const active = await this.status.getCurrent();
    if (active) {
      if (
        active.status === LoopStatus.RUNNING &&
        !this.loop.hasRuntimeContext(active.id)
      ) {
        await this.status.fail(active.id, 'orphaned_after_restart');
        await this.controls.recordHealthy(
          this.ownerId,
          leaseUntil,
          addMilliseconds(now, control.cooldownMs),
        );
        this.logger.warn(
          `Closed orphaned Search Loop ${active.id}; automation will start a replacement`,
        );
        return;
      }

      await this.controls.recordHealthy(
        this.ownerId,
        leaseUntil,
        addMilliseconds(now, control.cooldownMs),
      );
      return;
    }

    if (control.nextRunAt && control.nextRunAt.getTime() > now.getTime()) {
      await this.controls.renewLease(this.ownerId, leaseUntil);
      return;
    }

    try {
      const started = await this.loop.start(buildRunConfig(control, now));
      const stillEnabled = await this.controls.recordRunStarted(
        this.ownerId,
        started.id,
        leaseUntil,
        addMilliseconds(now, control.cooldownMs),
      );
      if (!stillEnabled) {
        await this.loop.stop(started.id);
        return;
      }
      this.logger.log(`Started automated Search Loop ${started.id}`);
    } catch (error: unknown) {
      if (hasErrorCode(error, 'LOOP_ALREADY_ACTIVE')) {
        await this.controls.recordHealthy(
          this.ownerId,
          leaseUntil,
          addMilliseconds(now, control.cooldownMs),
        );
        return;
      }

      const failureCount = control.failureCount + 1;
      const backoffMs = calculateBackoff(control.cooldownMs, failureCount);
      await this.controls.recordFailure(
        this.ownerId,
        errorText(error),
        failureCount,
        leaseUntil,
        addMilliseconds(now, backoffMs),
      );
      this.logger.warn(
        `Could not start automated Search Loop; retrying in ${backoffMs}ms`,
      );
    }
  }
}

export function buildRunConfig(
  control: SearchLoopControlState,
  now: Date,
): SearchLoopConfig {
  const endDate = latestClosedBoundary(now, control.timeframe);
  const startDate = new Date(
    endDate.getTime() - control.backtestWindowDays * 24 * 60 * 60 * 1_000,
  );
  return {
    generatorType: control.generatorType,
    pair: control.pair,
    timeframe: control.timeframe,
    startDate,
    endDate,
    backtestConfig: control.backtestConfig,
    maxCandidates: control.maxCandidatesPerRun,
    maxDurationMs: control.maxDurationMsPerRun,
    stopOnNoImprovementIterations: control.stopOnNoImprovementIterations,
  };
}

function latestClosedBoundary(now: Date, timeframe: string): Date {
  const match = /^(\d+)(m|h|d)$/i.exec(timeframe.trim());
  if (!match) return new Date(now);

  const amount = Number(match[1]);
  const unitMs =
    match[2].toLowerCase() === 'm'
      ? 60_000
      : match[2].toLowerCase() === 'h'
        ? 60 * 60_000
        : 24 * 60 * 60_000;
  const intervalMs = amount * unitMs;
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
    return new Date(now);
  }
  return new Date(Math.floor(now.getTime() / intervalMs) * intervalMs);
}

function calculateBackoff(cooldownMs: number, failureCount: number): number {
  const exponent = Math.min(Math.max(failureCount - 1, 0), 10);
  return Math.min(cooldownMs * 2 ** exponent, MAX_FAILURE_BACKOFF_MS);
}

function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
