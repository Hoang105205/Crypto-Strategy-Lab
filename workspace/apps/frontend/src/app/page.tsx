"use client";

// Dashboard Home — Crypto Strategy Lab
// Owner: Hoang
// The dashboard hook composes global loop/queue state with provider-owned SCORE Top-5.
// See: spec.md US1–US5, plan.md Phase 3, DESIGN.md Dashboard route

import { useState } from "react";
import { DashboardGrid } from "../components/dashboard/dashboard-grid";
import { LeaderboardPreview } from "../components/dashboard/leaderboard-preview";
import { LoopStatusPanel } from "../components/dashboard/loop-status-panel";
import { ProtectedRoute } from "../components/auth/protected-route";
import { useDashboardSummary } from "../hooks/use-dashboard-summary";
import { DEFAULT_PAIR } from "../lib/constants";

export default function Home() {
  const [pair, setPair] = useState(DEFAULT_PAIR);
  const [selectedStrategyVersionId, setSelectedStrategyVersionId] = useState<
    string | null
  >(null);
  const dashboard = useDashboardSummary();

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-canvas-dark">
        <DashboardGrid
          pair={pair}
          onPairChange={setPair}
          loopStatusPanel={
            <LoopStatusPanel
              loop={dashboard.data?.loop ?? null}
              loading={dashboard.loading}
              error={dashboard.error}
              isStale={dashboard.isStale}
              lastSuccessfulAt={dashboard.lastSuccessfulAt}
              isLeaderboardLive={dashboard.isLeaderboardLive}
              onLeaderboardLiveChange={dashboard.setIsLeaderboardLive}
              onRefresh={dashboard.refetch}
            />
          }
          leaderboardPreview={
            <LeaderboardPreview
              snapshot={dashboard.data?.leaderboard ?? null}
              loading={dashboard.loading}
              error={dashboard.error}
              isStale={dashboard.isStale}
              lastSuccessfulAt={dashboard.lastSuccessfulAt}
              selectedStrategyVersionId={selectedStrategyVersionId}
              onSelectStrategy={setSelectedStrategyVersionId}
              onRetry={() => void dashboard.refetch()}
            />
          }
        />
      </main>
    </ProtectedRoute>
  );
}
