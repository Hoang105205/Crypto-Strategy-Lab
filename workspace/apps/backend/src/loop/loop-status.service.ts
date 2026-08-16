import { Inject, Injectable } from '@nestjs/common';
import {
  JobStatusValue,
  LoopStatus,
  type IJobQueue,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';
import { IJOB_QUEUE } from '../shared/tokens';
import {
  LoopError,
  LoopErrorCode,
  LoopRepository,
  type LoopRunDetail,
} from './loop.repository';

const ACTIVE_STATUSES = [LoopStatus.RUNNING, LoopStatus.PAUSED] as const;

@Injectable()
export class LoopStatusService {
  constructor(
    private readonly repository: LoopRepository,
    @Inject(IJOB_QUEUE) private readonly jobQueue: IJobQueue,
  ) {}

  pause(loopRunId: string): Promise<SearchLoopRun> {
    return this.transition(loopRunId, [LoopStatus.RUNNING], {
      status: LoopStatus.PAUSED,
      pausedAt: new Date(),
    });
  }

  resume(loopRunId: string): Promise<SearchLoopRun> {
    return this.transition(loopRunId, [LoopStatus.PAUSED], {
      status: LoopStatus.RUNNING,
      pausedAt: null,
    });
  }

  stop(loopRunId: string): Promise<SearchLoopRun> {
    return this.transition(loopRunId, ACTIVE_STATUSES, {
      status: LoopStatus.STOPPED_BY_USER,
      stopReason: 'user_requested',
      stoppedAt: new Date(),
    });
  }

  complete(loopRunId: string, stopReason: string): Promise<SearchLoopRun> {
    return this.transition(loopRunId, [LoopStatus.RUNNING], {
      status: LoopStatus.COMPLETED,
      stopReason,
      stoppedAt: new Date(),
    });
  }

  fail(loopRunId: string, stopReason: string): Promise<SearchLoopRun> {
    return this.transition(loopRunId, ACTIVE_STATUSES, {
      status: LoopStatus.FAILED,
      stopReason,
      stoppedAt: new Date(),
    });
  }

  getCurrent(): Promise<SearchLoopRun | null> {
    return this.repository.findActiveRun();
  }

  getDetail(loopRunId: string): Promise<LoopRunDetail | null> {
    return this.repository.getRunDetail(loopRunId);
  }

  async reconcileAfterRestart(): Promise<SearchLoopRun | null> {
    const active = await this.repository.findActiveRun();
    if (!active) return null;

    const candidate = await this.repository.findInFlightCandidate(active.id);
    if (!candidate) {
      return this.fail(active.id, 'orphaned_after_restart');
    }

    try {
      const queueStatus = await this.jobQueue.getStatus(candidate.jobId);
      if (
        queueStatus.status === JobStatusValue.QUEUED ||
        queueStatus.status === JobStatusValue.PROCESSING
      ) {
        return active;
      }
      return this.fail(active.id, 'orphaned_after_restart');
    } catch (error: unknown) {
      if (hasErrorCode(error, 'JOB_NOT_FOUND')) {
        return this.fail(active.id, 'orphaned_after_restart');
      }
      throw error;
    }
  }

  private async transition(
    loopRunId: string,
    expected: readonly LoopStatus[],
    update: Partial<SearchLoopRun>,
  ): Promise<SearchLoopRun> {
    const current = await this.repository.findRunById(loopRunId);
    if (!current) {
      throw new LoopError(LoopErrorCode.LOOP_NOT_FOUND, loopRunId);
    }
    if (!expected.includes(current.status)) {
      throw new LoopError(LoopErrorCode.INVALID_LOOP_TRANSITION, loopRunId);
    }

    const changed = await this.repository.transitionRun(
      loopRunId,
      expected,
      update,
    );
    if (!changed) {
      throw new LoopError(LoopErrorCode.INVALID_LOOP_TRANSITION, loopRunId);
    }
    return changed;
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
