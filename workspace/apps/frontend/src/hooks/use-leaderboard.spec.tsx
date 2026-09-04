import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LeaderboardScope,
  RankingCriterion,
  type LeaderboardSnapshot,
} from "@crypto-strategy-lab/shared";

const testState = vi.hoisted(() => ({
  getInfrastructureSocket: vi.fn(),
  setActiveCriterion: vi.fn(),
  setSelectedStrategyVersionId: vi.fn(),
  refetch: vi.fn(),
  maintainScopedProjections: vi.fn(),
  setSelectedStrategy: vi.fn(),
  value: {} as Record<string, unknown>,
}));

vi.mock("../contexts/leaderboard-live-context", () => ({
  useLeaderboardLive: () => testState.value,
}));

vi.mock("../services/infrastructure-socket", () => ({
  getInfrastructureSocket: testState.getInfrastructureSocket,
}));

vi.mock("../services/api-client", () => ({
  apiClient: {
    getLeaderboard: vi.fn(() =>
      Promise.resolve(snapshot(RankingCriterion.SCORE)),
    ),
  },
}));

vi.mock("./use-leaderboard-live-preference", () => ({
  useLeaderboardLivePreference: () => ({
    isLeaderboardLive: false,
    setIsLeaderboardLive: vi.fn(),
  }),
}));

function snapshot(criterion: RankingCriterion): LeaderboardSnapshot {
  return {
    rankingCriterion: criterion,
    updatedAt: new Date("2026-08-24T10:00:00.000Z"),
    entries: [],
  };
}

describe("useLeaderboard provider adapter", () => {
  beforeEach(() => {
    testState.getInfrastructureSocket.mockReset();
    testState.getInfrastructureSocket.mockReturnValue({
      on: vi.fn(),
      off: vi.fn(),
    });
    testState.setActiveCriterion.mockReset();
    testState.setSelectedStrategyVersionId.mockReset();
    testState.refetch.mockReset();
    testState.maintainScopedProjections.mockReset();
    testState.setSelectedStrategy.mockReset();
    testState.value = {
      isLive: true,
      setIsLive: vi.fn(),
      scoreSnapshot: snapshot(RankingCriterion.SCORE),
      activeSnapshot: snapshot(RankingCriterion.SHARPE_RATIO),
      activeCriterion: RankingCriterion.SHARPE_RATIO,
      setActiveCriterion: testState.setActiveCriterion,
      selectedStrategyVersionId: "strategy-a",
      setSelectedStrategyVersionId: testState.setSelectedStrategyVersionId,
      loading: false,
      error: null,
      isStale: false,
      lastSuccessfulAt: new Date("2026-08-24T10:00:01.000Z"),
      refetch: testState.refetch,
    };
  });

  it("exposes independent System/Mine projections with one shared criterion and scope-aware actions", async () => {
    const systemRefetch = vi.fn().mockResolvedValue(undefined);
    const mineRefetch = vi.fn().mockResolvedValue(undefined);
    const system = {
      snapshot: snapshot(RankingCriterion.SHARPE_RATIO),
      loading: false,
      error: null,
      isStale: false,
      lastSuccessfulAt: new Date("2026-08-24T10:00:01.000Z"),
      refetch: systemRefetch,
    };
    const mine = {
      snapshot: snapshot(RankingCriterion.SHARPE_RATIO),
      loading: true,
      error: null,
      isStale: true,
      lastSuccessfulAt: null,
      refetch: mineRefetch,
    };
    testState.value = {
      ...testState.value,
      system,
      mine,
      activeCriterion: RankingCriterion.SHARPE_RATIO,
      selectedStrategy: {
        strategyVersionId: "mine-strategy",
        sourceScope: LeaderboardScope.MINE,
      },
      setSelectedStrategy: testState.setSelectedStrategy,
      maintainScopedProjections: testState.maintainScopedProjections,
    };
    const { useLeaderboard } = await import("./use-leaderboard");
    const { result } = renderHook(() => useLeaderboard());

    expect(testState.maintainScopedProjections).toHaveBeenCalledTimes(1);
    expect(result.current.system).toBe(system);
    expect(result.current.mine).toBe(mine);
    expect(result.current.sortBy).toBe(RankingCriterion.SHARPE_RATIO);
    expect(result.current.selectedStrategy).toEqual({
      strategyVersionId: "mine-strategy",
      sourceScope: LeaderboardScope.MINE,
    });

    act(() =>
      result.current.setSelectedStrategy({
        strategyVersionId: "system-strategy",
        sourceScope: LeaderboardScope.SYSTEM,
      }),
    );
    await act(async () => result.current.system.refetch());
    await act(async () => result.current.mine.refetch());
    expect(testState.setSelectedStrategy).toHaveBeenCalledWith({
      strategyVersionId: "system-strategy",
      sourceScope: LeaderboardScope.SYSTEM,
    });
    expect(systemRefetch).toHaveBeenCalledTimes(1);
    expect(mineRefetch).toHaveBeenCalledTimes(1);
    expect(testState.getInfrastructureSocket).not.toHaveBeenCalled();
  });

  it("maps active provider state without creating a socket or page cache", async () => {
    const { useLeaderboard } = await import("./use-leaderboard");
    const { result } = renderHook(() => useLeaderboard());

    expect(result.current.data).toBe(testState.value.activeSnapshot);
    expect(result.current.sortBy).toBe(RankingCriterion.SHARPE_RATIO);
    expect(result.current.selectedStrategyVersionId).toBe("strategy-a");
    expect(result.current.loading).toBe(false);
    expect(result.current.isStale).toBe(false);
    expect(testState.getInfrastructureSocket).not.toHaveBeenCalled();
  });

  it("delegates criterion, selection, and explicit refetch to the provider", async () => {
    const { useLeaderboard } = await import("./use-leaderboard");
    const { result } = renderHook(() => useLeaderboard());

    act(() => result.current.setSortBy(RankingCriterion.TOTAL_RETURN));
    act(() => result.current.setSelectedStrategyVersionId("strategy-b"));
    await act(async () => result.current.refetch());

    expect(testState.setActiveCriterion).toHaveBeenCalledWith(
      RankingCriterion.TOTAL_RETURN,
    );
    expect(testState.setSelectedStrategyVersionId).toHaveBeenCalledWith(
      "strategy-b",
    );
    expect(testState.refetch).toHaveBeenCalledWith();
    expect(testState.getInfrastructureSocket).not.toHaveBeenCalled();
  });
});
