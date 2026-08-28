import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LoopStatus,
  RankingCriterion,
  StrategyGeneratorType,
  type LeaderboardSnapshot,
  type NormalizedRate,
} from "@crypto-strategy-lab/shared";
import type { DashboardSummary } from "../services/api-client";

const liveState = vi.hoisted(() => ({
  setIsLive: vi.fn(),
  refetch: vi.fn(),
  combinedRefetch: vi.fn(),
  value: {} as Record<string, unknown>,
}));

vi.mock("../contexts/leaderboard-live-context", () => ({
  useLeaderboardLive: () => liveState.value,
}));

vi.mock("../services/api-client", () => ({
  apiClient: { getDashboardSummary: vi.fn() },
}));

vi.mock("../services/infrastructure-socket", () => ({
  getInfrastructureSocket: vi.fn(),
}));

type Handler = (...args: unknown[]) => void;

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
  readonly disconnect = vi.fn();

  emitFromServer(event: string, payload?: unknown) {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }

  listenerCount(event: string) {
    return this.handlers.get(event)?.size ?? 0;
  }
}

function leaderboard(ids: string[]): LeaderboardSnapshot {
  return {
    rankingCriterion: RankingCriterion.SCORE,
    updatedAt: new Date("2026-08-24T10:00:00.000Z"),
    entries: ids.map((id, index) => ({
      rank: index + 1,
      userId: null,
      strategyVersionId: id,
      strategyName: id,
      strategyType: "MA_CROSSOVER",
      isComposite: false,
      backtestResultId: `result-${id}`,
      score: 1 - index / 10,
      totalReturn: 1,
      winRate: 0.5 as NormalizedRate,
      maxDrawdown: -0.1,
      sharpeRatio: 1,
      totalTrades: 2,
    })),
  };
}

function summaryFixture(): DashboardSummary {
  return {
    leaderboard: leaderboard(["bff-row-must-not-own"]),
    loop: {
      id: "11111111-1111-4111-8111-111111111111",
      status: LoopStatus.RUNNING,
      generatorType: StrategyGeneratorType.RANDOM,
      iteration: 1,
      testedCandidates: 1,
      maxCandidates: 10,
      maxDurationMs: null,
      stopOnNoImprovementIterations: 5,
      currentCandidateStrategyVersionId: null,
      bestStrategyVersionId: null,
      bestScore: null,
      stopReason: null,
      startedAt: new Date("2026-08-24T09:00:00.000Z"),
      pausedAt: null,
      stoppedAt: null,
    },
    queue: {
      queued: 1,
      processing: 1,
      completedLast24h: 2,
      deadLettered: 0,
      delayed: 0,
      redisConnected: true,
    },
    generatedAt: new Date("2026-08-24T10:00:01.000Z"),
  };
}

describe("useDashboardSummary provider composition", () => {
  beforeEach(() => {
    window.localStorage.clear();
    liveState.setIsLive.mockReset();
    liveState.refetch.mockReset();
    liveState.combinedRefetch.mockReset();
    liveState.value = {
      isLive: true,
      setIsLive: liveState.setIsLive,
      scoreSnapshot: leaderboard([
        "provider-1",
        "provider-2",
        "provider-3",
        "provider-4",
        "provider-5",
        "provider-6",
      ]),
      activeSnapshot: null,
      activeCriterion: RankingCriterion.SCORE,
      setActiveCriterion: vi.fn(),
      selectedStrategyVersionId: null,
      setSelectedStrategyVersionId: vi.fn(),
      loading: false,
      error: null,
      isStale: false,
      lastSuccessfulAt: new Date("2026-08-24T10:00:02.000Z"),
      refetch: liveState.refetch,
    };
  });

  it("consumes only Combined SCORE projection state and delegates Dashboard retry to it", async () => {
    liveState.value = {
      ...liveState.value,
      scoreSnapshot: leaderboard(["legacy-alias-must-not-render"]),
      combinedScore: {
        snapshot: leaderboard([
          "combined-1",
          "combined-2",
          "combined-3",
          "combined-4",
          "combined-5",
          "combined-6",
        ]),
        loading: false,
        error: null,
        isStale: false,
        lastSuccessfulAt: new Date("2026-08-24T10:00:02.000Z"),
        refetch: liveState.combinedRefetch,
      },
      system: {
        snapshot: leaderboard(["system-must-not-render"]),
      },
      mine: {
        snapshot: leaderboard(["mine-private-must-not-render"]),
      },
    };
    const { useDashboardSummary } = await import("./use-dashboard-summary");
    const socket = new FakeSocket();
    const getDashboardSummary = vi.fn().mockResolvedValue(summaryFixture());
    const { result } = renderHook(() =>
      useDashboardSummary({ getDashboardSummary, socket }),
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(
      result.current.data?.leaderboard.entries.map(
        (entry) => entry.strategyVersionId,
      ),
    ).toEqual([
      "combined-1",
      "combined-2",
      "combined-3",
      "combined-4",
      "combined-5",
    ]);
    expect(socket.listenerCount("leaderboard:update")).toBe(0);
    await act(async () => result.current.refetch());
    expect(liveState.combinedRefetch).toHaveBeenCalledTimes(1);
    expect(liveState.refetch).not.toHaveBeenCalled();
  });

  it("composes provider SCORE Top-5 with global loop/queue and owns zero leaderboard handlers", async () => {
    const { useDashboardSummary } = await import("./use-dashboard-summary");
    const socket = new FakeSocket();
    const getDashboardSummary = vi.fn().mockResolvedValue(summaryFixture());
    const { result } = renderHook(() =>
      useDashboardSummary({ getDashboardSummary, socket }),
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(
      result.current.data?.leaderboard.entries.map(
        (entry) => entry.strategyVersionId,
      ),
    ).toEqual([
      "provider-1",
      "provider-2",
      "provider-3",
      "provider-4",
      "provider-5",
    ]);
    expect(result.current.data?.loop?.status).toBe(LoopStatus.RUNNING);
    expect(result.current.data?.queue.queued).toBe(1);
    expect(socket.listenerCount("leaderboard:update")).toBe(0);
    expect(result.current.isLeaderboardLive).toBe(true);
  });

  it("delegates Live state/refetch while retaining independent loop listeners", async () => {
    const { useDashboardSummary } = await import("./use-dashboard-summary");
    const socket = new FakeSocket();
    const getDashboardSummary = vi.fn().mockResolvedValue(summaryFixture());
    const { result } = renderHook(() =>
      useDashboardSummary({ getDashboardSummary, socket }),
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => result.current.setIsLeaderboardLive(false));
    expect(liveState.setIsLive).toHaveBeenCalledWith(false);
    expect(socket.listenerCount("leaderboard:update")).toBe(0);
    expect(socket.listenerCount("loop:progress")).toBe(1);

    await act(async () => result.current.refetch());
    expect(getDashboardSummary).toHaveBeenCalledTimes(2);
    expect(liveState.refetch).toHaveBeenCalledWith(RankingCriterion.SCORE);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it("keeps loop progress independent from the frozen provider leaderboard", async () => {
    const { useDashboardSummary } = await import("./use-dashboard-summary");
    const socket = new FakeSocket();
    const getDashboardSummary = vi.fn().mockResolvedValue(summaryFixture());
    const { result } = renderHook(() =>
      useDashboardSummary({
        getDashboardSummary,
        socket,
      }),
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() =>
      socket.emitFromServer("loop:progress", {
        loopRunId: "11111111-1111-4111-8111-111111111111",
        iteration: 4,
        testedCandidates: 4,
        currentCandidate: {
          strategyVersionId: "candidate-4",
          strategyName: "Candidate 4",
          status: "EVALUATING",
        },
        bestScoreSoFar: 0.8,
        bestStrategyVersionId: "candidate-4",
      }),
    );

    expect(result.current.data?.loop?.iteration).toBe(4);
    expect(result.current.data?.leaderboard.entries[0]?.strategyVersionId).toBe(
      "provider-1",
    );
    expect(socket.listenerCount("leaderboard:update")).toBe(0);
  });
});
