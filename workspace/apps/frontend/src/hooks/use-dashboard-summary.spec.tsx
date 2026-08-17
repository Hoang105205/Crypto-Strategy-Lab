import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

interface LoopState {
  id: string;
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED_BY_USER' | 'FAILED';
  generatorType: 'RANDOM' | 'DOMAIN_GUIDED';
  iteration: number;
  testedCandidates: number;
  maxCandidates: number | null;
  maxDurationMs: number | null;
  stopOnNoImprovementIterations: number;
  currentCandidateStrategyVersionId: string | null;
  bestStrategyVersionId: string | null;
  bestScore: number | null;
  stopReason: string | null;
  startedAt: Date;
  pausedAt: Date | null;
  stoppedAt: Date | null;
}

interface DashboardSummary {
  leaderboard: {
    rankingCriterion: 'score';
    updatedAt: Date;
    entries: unknown[];
  };
  loop: LoopState | null;
  queue: {
    queued: number;
    processing: number;
    completedLast24h: number;
    deadLettered: number;
    delayed: number;
    redisConnected: boolean;
  };
  generatedAt: Date;
}

interface DashboardHookState {
  data: DashboardSummary | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  lastSuccessfulAt: Date | null;
  refetch(): Promise<void>;
}

interface DashboardHookModule {
  useDashboardSummary(options: {
    getDashboardSummary(): Promise<DashboardSummary>;
    socket: FakeSocket;
  }): DashboardHookState;
}

class FakeSocket {
  private readonly handlers = new Map<string, Set<Handler>>();
  readonly on = vi.fn((event: string, handler: Handler) => {
    const listeners = this.handlers.get(event) ?? new Set<Handler>();
    listeners.add(handler);
    this.handlers.set(event, listeners);
    return this;
  });
  readonly off = vi.fn((event: string, handler: Handler) => {
    this.handlers.get(event)?.delete(handler);
    return this;
  });

  serverEmit(event: string, payload?: unknown) {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function loopFixture(overrides: Partial<LoopState> = {}): LoopState {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'RUNNING',
    generatorType: 'RANDOM',
    iteration: 2,
    testedCandidates: 1,
    maxCandidates: 5,
    maxDurationMs: null,
    stopOnNoImprovementIterations: 50,
    currentCandidateStrategyVersionId: 'version-2',
    bestStrategyVersionId: 'version-1',
    bestScore: 0.5,
    stopReason: null,
    startedAt: new Date('2026-08-16T09:00:00.000Z'),
    pausedAt: null,
    stoppedAt: null,
    ...overrides,
  };
}

function summaryFixture(
  generatedAt: string,
  loop: LoopState | null = loopFixture(),
): DashboardSummary {
  return {
    leaderboard: {
      rankingCriterion: 'score',
      updatedAt: new Date(generatedAt),
      entries: [],
    },
    loop,
    queue: {
      queued: 1,
      processing: 2,
      completedLast24h: 3,
      deadLettered: 4,
      delayed: 5,
      redisConnected: true,
    },
    generatedAt: new Date(generatedAt),
  };
}

async function loadHook(): Promise<DashboardHookModule> {
  const modulePath = './use-dashboard-summary';
  return import(/* @vite-ignore */ modulePath) as Promise<DashboardHookModule>;
}

describe('useDashboardSummary contract', () => {
  it('retains the last successful snapshot and timestamp on disconnect and refresh failure', async () => {
    const { useDashboardSummary } = await loadHook();
    const socket = new FakeSocket();
    const first = summaryFixture('2026-08-16T10:00:00.000Z');
    const getDashboardSummary = vi
      .fn<() => Promise<DashboardSummary>>()
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error('Queue service is unavailable'));
    const { result } = renderHook(() =>
      useDashboardSummary({ getDashboardSummary, socket }),
    );

    await waitFor(() => expect(result.current.data).toEqual(first));
    const successfulAt = result.current.lastSuccessfulAt;

    act(() => socket.serverEmit('disconnect', 'transport close'));
    expect(result.current.data).toEqual(first);
    expect(result.current.lastSuccessfulAt).toEqual(successfulAt);
    expect(result.current.isStale).toBe(true);

    await act(async () => result.current.refetch());
    expect(result.current.data).toEqual(first);
    expect(result.current.lastSuccessfulAt).toEqual(successfulAt);
    expect(result.current.error?.message).toBe('Queue service is unavailable');
  });

  it('refetches the authoritative Dashboard snapshot on reconnect and stays stale until it resolves', async () => {
    const { useDashboardSummary } = await loadHook();
    const socket = new FakeSocket();
    const reconnect = deferred<DashboardSummary>();
    const getDashboardSummary = vi
      .fn<() => Promise<DashboardSummary>>()
      .mockResolvedValueOnce(summaryFixture('2026-08-16T10:00:00.000Z'))
      .mockReturnValueOnce(reconnect.promise);
    const { result } = renderHook(() =>
      useDashboardSummary({ getDashboardSummary, socket }),
    );
    await waitFor(() => expect(getDashboardSummary).toHaveBeenCalledTimes(1));

    act(() => socket.serverEmit('disconnect', 'transport close'));
    act(() => socket.serverEmit('connect'));

    expect(getDashboardSummary).toHaveBeenCalledTimes(2);
    expect(result.current.isStale).toBe(true);

    const refreshed = summaryFixture('2026-08-16T10:01:00.000Z');
    await act(async () => reconnect.resolve(refreshed));
    await waitFor(() => expect(result.current.data).toEqual(refreshed));
    expect(result.current.isStale).toBe(false);
  });

  it('rejects an older request generation that resolves after a newer refetch', async () => {
    const { useDashboardSummary } = await loadHook();
    const socket = new FakeSocket();
    const olderRequest = deferred<DashboardSummary>();
    const newerRequest = deferred<DashboardSummary>();
    const getDashboardSummary = vi
      .fn<() => Promise<DashboardSummary>>()
      .mockReturnValueOnce(olderRequest.promise)
      .mockReturnValueOnce(newerRequest.promise);
    const { result } = renderHook(() =>
      useDashboardSummary({ getDashboardSummary, socket }),
    );

    await waitFor(() => expect(getDashboardSummary).toHaveBeenCalledTimes(1));
    let refetchPromise!: Promise<void>;
    act(() => {
      refetchPromise = result.current.refetch();
    });
    const newer = summaryFixture('2026-08-16T10:02:00.000Z');
    await act(async () => newerRequest.resolve(newer));
    await refetchPromise;
    expect(result.current.data).toEqual(newer);

    await act(async () =>
      olderRequest.resolve(summaryFixture('2026-08-16T09:59:00.000Z')),
    );
    expect(result.current.data).toEqual(newer);
  });

  it('does not let an in-flight REST snapshot overwrite newer Loop progress', async () => {
    const { useDashboardSummary } = await loadHook();
    const socket = new FakeSocket();
    const staleRequest = deferred<DashboardSummary>();
    const getDashboardSummary = vi
      .fn<() => Promise<DashboardSummary>>()
      .mockResolvedValueOnce(summaryFixture('2026-08-16T10:00:00.000Z'))
      .mockReturnValueOnce(staleRequest.promise);
    const { result } = renderHook(() =>
      useDashboardSummary({ getDashboardSummary, socket }),
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    let refetchPromise!: Promise<void>;
    act(() => {
      refetchPromise = result.current.refetch();
    });
    act(() =>
      socket.serverEmit('loop:progress', {
        loopRunId: loopFixture().id,
        iteration: 4,
        testedCandidates: 3,
        currentCandidate: {
          strategyVersionId: 'version-4',
          strategyName: 'Candidate 4',
          status: 'EVALUATING',
        },
        bestScoreSoFar: 0.7,
        bestStrategyVersionId: 'version-3',
      }),
    );

    expect(result.current.data?.loop).toMatchObject({
      iteration: 4,
      testedCandidates: 3,
      bestScore: 0.7,
    });

    await act(async () =>
      staleRequest.resolve(
        summaryFixture(
          '2026-08-16T10:00:30.000Z',
          loopFixture({ iteration: 2, testedCandidates: 1 }),
        ),
      ),
    );
    await refetchPromise;
    expect(result.current.data?.loop).toMatchObject({
      iteration: 4,
      testedCandidates: 3,
      bestScore: 0.7,
    });
  });

  it('never regresses Loop counters or resurrects a terminal run', async () => {
    const { useDashboardSummary } = await loadHook();
    const socket = new FakeSocket();
    const getDashboardSummary = vi
      .fn<() => Promise<DashboardSummary>>()
      .mockResolvedValue(summaryFixture('2026-08-16T10:00:00.000Z'));
    const { result } = renderHook(() =>
      useDashboardSummary({ getDashboardSummary, socket }),
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() =>
      socket.serverEmit('loop:progress', {
        loopRunId: loopFixture().id,
        iteration: 5,
        testedCandidates: 4,
        currentCandidate: {
          strategyVersionId: 'version-5',
          strategyName: 'Candidate 5',
          status: 'EVALUATING',
        },
        bestScoreSoFar: 0.8,
        bestStrategyVersionId: 'version-5',
      }),
    );
    act(() =>
      socket.serverEmit('loop:progress', {
        loopRunId: loopFixture().id,
        iteration: 3,
        testedCandidates: 2,
        currentCandidate: {
          strategyVersionId: 'version-3',
          strategyName: 'Candidate 3',
          status: 'EVALUATING',
        },
        bestScoreSoFar: 0.6,
        bestStrategyVersionId: 'version-3',
      }),
    );
    expect(result.current.data?.loop).toMatchObject({
      iteration: 5,
      testedCandidates: 4,
      bestScore: 0.8,
    });

    act(() =>
      socket.serverEmit('loop:stopped', {
        loopRunId: loopFixture().id,
        status: 'COMPLETED',
        stopReason: 'max_candidates_reached',
        testedCandidates: 5,
        bestStrategyVersionId: 'version-5',
        bestScore: 0.8,
        startedAt: '2026-08-16T09:00:00.000Z',
        stoppedAt: '2026-08-16T10:05:00.000Z',
      }),
    );
    act(() =>
      socket.serverEmit('loop:progress', {
        loopRunId: loopFixture().id,
        iteration: 6,
        testedCandidates: 6,
        currentCandidate: {
          strategyVersionId: 'late-version',
          strategyName: 'Late candidate',
          status: 'EVALUATING',
        },
        bestScoreSoFar: 0.9,
        bestStrategyVersionId: 'late-version',
      }),
    );
    expect(result.current.data?.loop).toMatchObject({
      status: 'COMPLETED',
      testedCandidates: 5,
      stopReason: 'max_candidates_reached',
    });
  });
});
