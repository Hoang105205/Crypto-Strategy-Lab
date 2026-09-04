"use client";

import { useEffect } from "react";
import {
  LeaderboardScope,
  type RankingCriterion,
} from "@crypto-strategy-lab/shared";
import {
  useLeaderboardLive,
  type ProjectionViewState,
  type SelectedLeaderboardStrategy,
} from "../contexts/leaderboard-live-context";

export interface LeaderboardState {
  system: ProjectionViewState;
  mine: ProjectionViewState;
  selectedStrategy: SelectedLeaderboardStrategy | null;
  setSelectedStrategy(value: SelectedLeaderboardStrategy | null): void;
  data: ProjectionViewState["snapshot"];
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

export function useLeaderboard(): LeaderboardState {
  const leaderboard = useLeaderboardLive();
  const maintainScopedProjections = leaderboard.maintainScopedProjections;
  useEffect(() => {
    maintainScopedProjections?.();
  }, [maintainScopedProjections]);

  return {
    system: leaderboard.system,
    mine: leaderboard.mine,
    selectedStrategy: leaderboard.selectedStrategy,
    setSelectedStrategy: leaderboard.setSelectedStrategy,
    // Legacy one-table aliases remain until the Phase 5 page migration.
    data: leaderboard.system?.snapshot ?? leaderboard.activeSnapshot,
    loading: leaderboard.system?.loading ?? leaderboard.loading,
    error: leaderboard.system?.error ?? leaderboard.error,
    isStale: leaderboard.system?.isStale ?? leaderboard.isStale,
    lastSuccessfulAt:
      leaderboard.system?.lastSuccessfulAt ?? leaderboard.lastSuccessfulAt,
    sortBy: leaderboard.activeCriterion,
    setSortBy: (value) => {
      void leaderboard.setActiveCriterion(value);
    },
    selectedStrategyVersionId:
      leaderboard.selectedStrategy?.strategyVersionId ??
      leaderboard.selectedStrategyVersionId,
    setSelectedStrategyVersionId: (value) => {
      if (leaderboard.setSelectedStrategy !== undefined) {
        leaderboard.setSelectedStrategy(
          value === null
            ? null
            : {
                strategyVersionId: value,
                sourceScope: LeaderboardScope.SYSTEM,
              },
        );
        return;
      }
      leaderboard.setSelectedStrategyVersionId(value);
    },
    refetch: async () => {
      if (leaderboard.system !== undefined && leaderboard.mine !== undefined) {
        await Promise.all([
          leaderboard.system.refetch(),
          leaderboard.mine.refetch(),
        ]);
        return;
      }
      await leaderboard.refetch();
    },
  };
}
