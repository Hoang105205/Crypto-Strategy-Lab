import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/api-client', () => ({
  apiClient: { getLeaderboard: vi.fn() },
}));

vi.mock('../services/infrastructure-socket', () => ({
  getInfrastructureSocket: vi.fn(),
}));

type Handler = (...args: unknown[]) => void;
type RankingCriterion =
  | 'score'
  | 'totalReturn'
  | 'winRate'
  | 'maxDrawdown'
  | 'sharpeRatio';

interface Entry {
  rank: number;
  strategyVersionId: string;
  strategyName: string;
  strategyType: string;
  isComposite: boolean;
  backtestResultId: string;
  score: number;
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
}

interface LeaderboardSnapshot {
  rankingCriterion: RankingCriterion;
  updatedAt: Date;
  entries: Entry[];
}

interface LeaderboardHookState {
  data: LeaderboardSnapshot | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  lastSuccessfulAt: Date | null;
  sortBy: RankingCriterion;
  setSortBy(value: RankingCriterion): void;
  selectedStrategyVersionId: string | null;
  setSelectedStrategyVersionId(value: string | null): void;
  refetch(): Promise<void>;
}

interface LeaderboardHookModule {
  useLeaderboard(options: {
    getLeaderboard(sortBy: RankingCriterion): Promise<LeaderboardSnapshot>;
    socket: FakeSocket;
  }): LeaderboardHookState;
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
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function entryFixture(id: string, rank = 1): Entry {
  return {
    rank,
    strategyVersionId: id,
    strategyName: `Strategy ${id}`,
    strategyType: 'MA',
    isComposite: false,
    backtestResultId: `result-${id}`,
    score: 0.6,
    totalReturn: 12,
    winRate: 0.55,
    maxDrawdown: -5,
    sharpeRatio: 1.2,
    totalTrades: 20,
  };
}

function snapshotFixture(
  updatedAt: string,
  entries: Entry[] = [entryFixture('version-1')],
  rankingCriterion: RankingCriterion = 'score',
): LeaderboardSnapshot {
  return {
    rankingCriterion,
    updatedAt: new Date(updatedAt),
    entries,
  };
}

async function loadHook(): Promise<LeaderboardHookModule> {
  const modulePath = './use-leaderboard';
  return import(/* @vite-ignore */ modulePath) as Promise<LeaderboardHookModule>;
}

describe('useLeaderboard contract', () => {
  it('retains last-success data and timestamp when disconnected or a refresh fails', async () => {
    const { useLeaderboard } = await loadHook();
    const socket = new FakeSocket();
    const first = snapshotFixture('2026-08-16T10:00:00.000Z');
    const getLeaderboard = vi
      .fn<(sortBy: RankingCriterion) => Promise<LeaderboardSnapshot>>()
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error('Strategy Engine is unavailable'));
    const { result } = renderHook(() =>
      useLeaderboard({ getLeaderboard, socket }),
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
    expect(result.current.error?.message).toBe(
      'Strategy Engine is unavailable',
    );
  });

  it('refetches its authoritative snapshot on reconnect before clearing stale state', async () => {
    const { useLeaderboard } = await loadHook();
    const socket = new FakeSocket();
    const reconnect = deferred<LeaderboardSnapshot>();
    const getLeaderboard = vi
      .fn<(sortBy: RankingCriterion) => Promise<LeaderboardSnapshot>>()
      .mockResolvedValueOnce(snapshotFixture('2026-08-16T10:00:00.000Z'))
      .mockReturnValueOnce(reconnect.promise);
    const { result } = renderHook(() =>
      useLeaderboard({ getLeaderboard, socket }),
    );
    await waitFor(() => expect(getLeaderboard).toHaveBeenCalledTimes(1));

    act(() => socket.serverEmit('disconnect', 'transport close'));
    act(() => socket.serverEmit('connect'));
    expect(getLeaderboard).toHaveBeenCalledTimes(2);
    expect(result.current.isStale).toBe(true);

    const refreshed = snapshotFixture('2026-08-16T10:01:00.000Z');
    await act(async () => reconnect.resolve(refreshed));
    await waitFor(() => expect(result.current.data).toEqual(refreshed));
    expect(result.current.isStale).toBe(false);
  });

  it('treats leaderboard:update as an invalidation and never trusts its system-only rows', async () => {
    const { useLeaderboard } = await loadHook();
    const socket = new FakeSocket();
    const refresh = deferred<LeaderboardSnapshot>();
    const getLeaderboard = vi
      .fn<(sortBy: RankingCriterion) => Promise<LeaderboardSnapshot>>()
      .mockResolvedValueOnce(snapshotFixture('2026-08-16T10:00:00.000Z'))
      .mockReturnValueOnce(refresh.promise);
    const { result } = renderHook(() =>
      useLeaderboard({ getLeaderboard, socket }),
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => {
      result.current.setSortBy('sharpeRatio');
      result.current.setSelectedStrategyVersionId('version-1');
    });
    const untrustedSystemRows = [entryFixture('wire-system-only')];
    act(() =>
      socket.serverEmit('leaderboard:update', {
        updatedAt: '2026-08-16T10:05:00.000Z',
        triggeredByBacktestResultId: null,
        rankingCriterion: 'score',
        topK: untrustedSystemRows,
      }),
    );
    expect(getLeaderboard).toHaveBeenLastCalledWith('sharpeRatio');
    expect(result.current.data?.entries).not.toEqual(untrustedSystemRows);

    const scopedRows = [entryFixture('rest-system'), entryFixture('rest-owner', 2)];
    await act(async () =>
      refresh.resolve(
        snapshotFixture(
          '2026-08-16T10:06:00.000Z',
          scopedRows,
          'sharpeRatio',
        ),
      ),
    );
    await waitFor(() => expect(result.current.data?.entries).toEqual(scopedRows));
    expect(result.current.sortBy).toBe('sharpeRatio');
    expect(result.current.selectedStrategyVersionId).toBe('version-1');
    act(() =>
      socket.serverEmit('leaderboard:update', {
        updatedAt: '2026-08-16T10:05:30.000Z',
        triggeredByBacktestResultId: null,
        rankingCriterion: 'score',
        topK: [],
      }),
    );
    expect(getLeaderboard).toHaveBeenCalledTimes(2);
  });

  it('keeps request-generation and realtime-watermark protection during invalidation refetches', async () => {
    const { useLeaderboard } = await loadHook();
    const socket = new FakeSocket();
    const initialRequest = deferred<LeaderboardSnapshot>();
    const invalidationRequest = deferred<LeaderboardSnapshot>();
    const getLeaderboard = vi
      .fn<(sortBy: RankingCriterion) => Promise<LeaderboardSnapshot>>()
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(invalidationRequest.promise);
    const { result } = renderHook(() =>
      useLeaderboard({ getLeaderboard, socket }),
    );
    await waitFor(() => expect(getLeaderboard).toHaveBeenCalledTimes(1));

    act(() =>
      socket.serverEmit('leaderboard:update', {
        updatedAt: '2026-08-16T10:05:00.000Z',
        triggeredByBacktestResultId: null,
        rankingCriterion: 'score',
        topK: [entryFixture('wire-row')],
      }),
    );
    expect(getLeaderboard).toHaveBeenCalledTimes(2);

    await act(async () =>
      invalidationRequest.resolve(
        snapshotFixture('2026-08-16T10:04:00.000Z', [
          entryFixture('older-than-watermark'),
        ]),
      ),
    );
    expect(result.current.data).toBeNull();

    await act(async () =>
      initialRequest.resolve(
        snapshotFixture('2026-08-16T10:06:00.000Z', [
          entryFixture('obsolete-generation'),
        ]),
      ),
    );
    expect(result.current.data).toBeNull();

    act(() =>
      socket.serverEmit('leaderboard:update', {
        updatedAt: '2026-08-16T10:04:59.000Z',
        triggeredByBacktestResultId: null,
        rankingCriterion: 'score',
        topK: [],
      }),
    );
    expect(getLeaderboard).toHaveBeenCalledTimes(2);
  });

  it('rejects an older request generation that resolves after a newer request', async () => {
    const { useLeaderboard } = await loadHook();
    const socket = new FakeSocket();
    const olderRequest = deferred<LeaderboardSnapshot>();
    const newerRequest = deferred<LeaderboardSnapshot>();
    const getLeaderboard = vi
      .fn<(sortBy: RankingCriterion) => Promise<LeaderboardSnapshot>>()
      .mockReturnValueOnce(olderRequest.promise)
      .mockReturnValueOnce(newerRequest.promise);
    const { result } = renderHook(() =>
      useLeaderboard({ getLeaderboard, socket }),
    );
    await waitFor(() => expect(getLeaderboard).toHaveBeenCalledTimes(1));

    let refetchPromise!: Promise<void>;
    act(() => {
      refetchPromise = result.current.refetch();
    });
    const newer = snapshotFixture('2026-08-16T10:02:00.000Z');
    await act(async () => newerRequest.resolve(newer));
    await refetchPromise;
    expect(result.current.data).toEqual(newer);

    await act(async () =>
      olderRequest.resolve(snapshotFixture('2026-08-16T09:59:00.000Z')),
    );
    expect(result.current.data).toEqual(newer);
  });

  it('preserves the user sort and selected Strategy across manual refreshes', async () => {
    const { useLeaderboard } = await loadHook();
    const socket = new FakeSocket();
    const getLeaderboard = vi
      .fn<(sortBy: RankingCriterion) => Promise<LeaderboardSnapshot>>()
      .mockResolvedValue(snapshotFixture('2026-08-16T10:00:00.000Z'));
    const { result } = renderHook(() =>
      useLeaderboard({ getLeaderboard, socket }),
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => {
      result.current.setSortBy('sharpeRatio');
      result.current.setSelectedStrategyVersionId('version-1');
    });
    await act(async () => result.current.refetch());

    expect(result.current.sortBy).toBe('sharpeRatio');
    expect(result.current.selectedStrategyVersionId).toBe('version-1');
    expect(getLeaderboard).toHaveBeenLastCalledWith('sharpeRatio');
  });
});
