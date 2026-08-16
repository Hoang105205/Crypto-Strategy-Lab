import { Injectable } from '@nestjs/common';
import {
  LoopStatus,
  SearchLoopCandidateStatus,
  StrategyGeneratorType,
  type SearchLoopCandidate,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';
import {
  Prisma,
  type SearchLoopCandidate as PrismaSearchLoopCandidate,
  type SearchLoopRun as PrismaSearchLoopRun,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const ACTIVE_LOOP_STATUSES = [LoopStatus.RUNNING, LoopStatus.PAUSED] as const;

export const LoopErrorCode = {
  LOOP_ALREADY_ACTIVE: 'LOOP_ALREADY_ACTIVE',
  LOOP_NOT_FOUND: 'LOOP_NOT_FOUND',
  LOOP_CANDIDATE_NOT_FOUND: 'LOOP_CANDIDATE_NOT_FOUND',
  INVALID_LOOP_TRANSITION: 'INVALID_LOOP_TRANSITION',
} as const;

export type LoopErrorCodeValue =
  (typeof LoopErrorCode)[keyof typeof LoopErrorCode];

export class LoopError extends Error {
  constructor(
    readonly code: LoopErrorCodeValue,
    readonly loopRunId?: string,
    options?: ErrorOptions,
  ) {
    super(loopErrorMessage(code), options);
    this.name = 'LoopError';
  }
}

export interface CreateLoopRunInput {
  generatorType: StrategyGeneratorType;
  maxCandidates: number | null;
  maxDurationMs: number | null;
  stopOnNoImprovementIterations: number;
}

export interface CreateLoopCandidateInput {
  loopRunId: string;
  jobId: string;
  strategyVersionId: string;
  iteration: number;
}

export interface CompletedCandidateInput {
  loopRunId: string;
  jobId: string;
  backtestResultId: string;
  score: number;
}

export interface FailedCandidateInput {
  loopRunId: string;
  jobId: string;
}

export interface LoopRunDetail {
  run: SearchLoopRun;
  candidates: SearchLoopCandidate[];
}

export interface CreateLoopCandidateResult {
  candidate: SearchLoopCandidate;
  created: boolean;
}

export interface TerminalCandidateResult {
  applied: boolean;
  run: SearchLoopRun;
  candidate: SearchLoopCandidate;
}

@Injectable()
export class LoopRepository {
  private startLock: Promise<void> = Promise.resolve();

  constructor(private readonly prisma: PrismaService) {}

  createRun(input: CreateLoopRunInput): Promise<SearchLoopRun> {
    return this.withStartLock(() =>
      this.prisma.$transaction(async (transaction) => {
        const active = await transaction.searchLoopRun.findFirst({
          where: { status: { in: [...ACTIVE_LOOP_STATUSES] } },
        });
        if (active) {
          throw new LoopError(LoopErrorCode.LOOP_ALREADY_ACTIVE, active.id);
        }

        const created = await transaction.searchLoopRun.create({
          data: {
            status: LoopStatus.RUNNING,
            generatorType: input.generatorType,
            iteration: 0,
            testedCandidates: 0,
            maxCandidates: input.maxCandidates,
            maxDurationMs: input.maxDurationMs,
            stopOnNoImprovementIterations: input.stopOnNoImprovementIterations,
            currentCandidateStrategyVersionId: null,
            bestStrategyVersionId: null,
            bestScore: null,
            stopReason: null,
            pausedAt: null,
            stoppedAt: null,
          },
        });
        return mapRun(created);
      }),
    );
  }

  async findActiveRun(): Promise<SearchLoopRun | null> {
    const row = await this.prisma.searchLoopRun.findFirst({
      where: { status: { in: [...ACTIVE_LOOP_STATUSES] } },
    });
    return row ? mapRun(row) : null;
  }

  async findRunById(loopRunId: string): Promise<SearchLoopRun | null> {
    const row = await this.prisma.searchLoopRun.findUnique({
      where: { id: loopRunId },
    });
    return row ? mapRun(row) : null;
  }

  async getRunDetail(loopRunId: string): Promise<LoopRunDetail | null> {
    const run = await this.prisma.searchLoopRun.findUnique({
      where: { id: loopRunId },
    });
    if (!run) return null;

    const candidates = await this.prisma.searchLoopCandidate.findMany({
      where: { loopRunId },
      orderBy: { iteration: 'asc' },
    });
    return {
      run: mapRun(run),
      candidates: candidates.map(mapCandidate),
    };
  }

  async createCandidate(
    input: CreateLoopCandidateInput,
  ): Promise<CreateLoopCandidateResult> {
    try {
      const created = await this.prisma.searchLoopCandidate.create({
        data: {
          loopRunId: input.loopRunId,
          jobId: input.jobId,
          strategyVersionId: input.strategyVersionId,
          iteration: input.iteration,
          status: SearchLoopCandidateStatus.BACKTESTING,
          backtestResultId: null,
          score: null,
        },
      });
      return { candidate: mapCandidate(created), created: true };
    } catch (error: unknown) {
      if (!isUniqueConflict(error)) throw error;

      const existing = await this.prisma.searchLoopCandidate.findUnique({
        where: { jobId: input.jobId },
      });
      if (!existing) throw error;
      return { candidate: mapCandidate(existing), created: false };
    }
  }

  async findInFlightCandidate(
    loopRunId: string,
  ): Promise<SearchLoopCandidate | null> {
    const row = await this.prisma.searchLoopCandidate.findFirst({
      where: {
        loopRunId,
        status: SearchLoopCandidateStatus.BACKTESTING,
      },
    });
    return row ? mapCandidate(row) : null;
  }

  recordCandidateCompleted(
    input: CompletedCandidateInput,
  ): Promise<TerminalCandidateResult> {
    return this.recordTerminalCandidate(input, {
      status: SearchLoopCandidateStatus.EVALUATED,
      backtestResultId: input.backtestResultId,
      score: input.score,
    });
  }

  recordCandidateFailed(
    input: FailedCandidateInput,
  ): Promise<TerminalCandidateResult> {
    return this.recordTerminalCandidate(input, {
      status: SearchLoopCandidateStatus.FAILED,
      backtestResultId: null,
      score: null,
    });
  }

  async transitionRun(
    loopRunId: string,
    expected: readonly LoopStatus[],
    update: Partial<SearchLoopRun>,
  ): Promise<SearchLoopRun | null> {
    const changed = await this.prisma.searchLoopRun.updateMany({
      where: { id: loopRunId, status: { in: [...expected] } },
      data: transitionData(update),
    });
    if (changed.count !== 1) return null;
    return this.findRunById(loopRunId);
  }

  private recordTerminalCandidate(
    input: FailedCandidateInput,
    terminal: {
      status:
        SearchLoopCandidateStatus.EVALUATED | SearchLoopCandidateStatus.FAILED;
      backtestResultId: string | null;
      score: number | null;
    },
  ): Promise<TerminalCandidateResult> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.searchLoopCandidate.findUnique({
        where: { jobId: input.jobId },
      });
      if (!existing || existing.loopRunId !== input.loopRunId) {
        throw new LoopError(
          LoopErrorCode.LOOP_CANDIDATE_NOT_FOUND,
          input.loopRunId,
        );
      }

      const existingRun = await transaction.searchLoopRun.findUnique({
        where: { id: input.loopRunId },
      });
      if (!existingRun) {
        throw new LoopError(LoopErrorCode.LOOP_NOT_FOUND, input.loopRunId);
      }

      if (existing.status !== SearchLoopCandidateStatus.BACKTESTING) {
        return {
          applied: false,
          run: mapRun(existingRun),
          candidate: mapCandidate(existing),
        };
      }

      const claim = await transaction.searchLoopCandidate.updateMany({
        where: {
          id: existing.id,
          loopRunId: input.loopRunId,
          status: SearchLoopCandidateStatus.BACKTESTING,
        },
        data: terminal,
      });
      if (claim.count !== 1) {
        const replay = await transaction.searchLoopCandidate.findUnique({
          where: { jobId: input.jobId },
        });
        const replayRun = await transaction.searchLoopRun.findUnique({
          where: { id: input.loopRunId },
        });
        if (!replay || !replayRun) {
          throw new LoopError(
            LoopErrorCode.LOOP_CANDIDATE_NOT_FOUND,
            input.loopRunId,
          );
        }
        return {
          applied: false,
          run: mapRun(replayRun),
          candidate: mapCandidate(replay),
        };
      }

      const updatedRun = await transaction.searchLoopRun.update({
        where: { id: input.loopRunId },
        data: { testedCandidates: { increment: 1 } },
      });
      const updatedCandidate = await transaction.searchLoopCandidate.findUnique(
        {
          where: { jobId: input.jobId },
        },
      );
      if (!updatedCandidate) {
        throw new LoopError(
          LoopErrorCode.LOOP_CANDIDATE_NOT_FOUND,
          input.loopRunId,
        );
      }

      return {
        applied: true,
        run: mapRun(updatedRun),
        candidate: mapCandidate(updatedCandidate),
      };
    });
  }

  private async withStartLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.startLock;
    let release!: () => void;
    this.startLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

function mapRun(row: PrismaSearchLoopRun): SearchLoopRun {
  return {
    ...row,
    status: row.status as LoopStatus,
    generatorType: row.generatorType as StrategyGeneratorType,
  };
}

function mapCandidate(row: PrismaSearchLoopCandidate): SearchLoopCandidate {
  return {
    ...row,
    status: row.status as SearchLoopCandidateStatus,
  };
}

function transitionData(
  update: Partial<SearchLoopRun>,
): Prisma.SearchLoopRunUpdateManyMutationInput {
  return {
    status: update.status,
    iteration: update.iteration,
    testedCandidates: update.testedCandidates,
    maxCandidates: update.maxCandidates,
    maxDurationMs: update.maxDurationMs,
    stopOnNoImprovementIterations: update.stopOnNoImprovementIterations,
    currentCandidateStrategyVersionId: update.currentCandidateStrategyVersionId,
    bestStrategyVersionId: update.bestStrategyVersionId,
    bestScore: update.bestScore,
    stopReason: update.stopReason,
    pausedAt: update.pausedAt,
    stoppedAt: update.stoppedAt,
  };
}

function isUniqueConflict(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError ||
      (typeof error === 'object' && error !== null && 'code' in error)) &&
    (error as { code?: string }).code === 'P2002'
  );
}

function loopErrorMessage(code: LoopErrorCodeValue): string {
  switch (code) {
    case LoopErrorCode.LOOP_ALREADY_ACTIVE:
      return 'A search loop is already active';
    case LoopErrorCode.LOOP_NOT_FOUND:
      return 'Search loop not found';
    case LoopErrorCode.LOOP_CANDIDATE_NOT_FOUND:
      return 'Search loop candidate not found';
    case LoopErrorCode.INVALID_LOOP_TRANSITION:
      return 'Invalid search loop transition';
  }
}
