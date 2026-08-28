import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const testState = vi.hoisted(() => ({
  loopPanelProps: {} as Record<string, unknown>,
  leaderboardPreviewProps: {} as Record<string, unknown>,
  setIsLeaderboardLive: vi.fn(),
  startLoop: vi.fn(),
  pauseLoop: vi.fn(),
  resumeLoop: vi.fn(),
  stopLoop: vi.fn(),
}));

vi.mock("../components/auth/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../components/dashboard/dashboard-grid", () => ({
  DashboardGrid: ({
    loopStatusPanel,
    queueCard,
    leaderboardPreview,
  }: {
    loopStatusPanel: ReactNode;
    queueCard: ReactNode;
    leaderboardPreview: ReactNode;
  }) => (
    <div data-testid="dashboard-grid">
      {loopStatusPanel}
      {queueCard}
      {leaderboardPreview}
    </div>
  ),
}));

vi.mock("../components/dashboard/loop-status-panel", () => ({
  LoopStatusPanel: (props: Record<string, unknown>) => {
    testState.loopPanelProps = props;
    const loop = props.loop as { status?: string } | null;
    const live = props.isLeaderboardLive as boolean;
    const onChange = props.onLeaderboardLiveChange as
      ((value: boolean) => void) | undefined;
    return (
      <section>
        <p>Global loop: {loop?.status ?? "IDLE"}</p>
        <button
          type="button"
          role="switch"
          aria-label="Live updates"
          aria-checked={live}
          onClick={() => onChange?.(!live)}
        >
          {live ? "ON" : "OFF"}
        </button>
      </section>
    );
  },
}));

vi.mock("../components/dashboard/queue-health-card", () => ({
  QueueHealthCard: () => <p>Queue</p>,
}));

vi.mock("../components/dashboard/leaderboard-preview", () => ({
  LeaderboardPreview: (props: Record<string, unknown>) => {
    testState.leaderboardPreviewProps = props;
    return <p>Leaderboard</p>;
  },
}));

vi.mock("../hooks/use-dashboard-summary", () => ({
  useDashboardSummary: () => ({
    data: {
      loop: { status: "RUNNING" },
      queue: null,
      leaderboard: {
        rankingCriterion: "score",
        updatedAt: new Date("2026-08-23T10:00:00.000Z"),
        entries: Array.from({ length: 5 }, (_, index) => ({
          strategyVersionId: `provider-score-${index + 1}`,
        })),
      },
    },
    loading: false,
    error: null,
    isStale: false,
    lastSuccessfulAt: new Date("2026-08-23T10:00:00.000Z"),
    isLeaderboardLive: true,
    setIsLeaderboardLive: testState.setIsLeaderboardLive,
    refetch: vi.fn(),
  }),
}));

vi.mock("../services/api-client", () => ({
  apiClient: {
    startLoop: testState.startLoop,
    pauseLoop: testState.pauseLoop,
    resumeLoop: testState.resumeLoop,
    stopLoop: testState.stopLoop,
  },
}));

describe("Dashboard page live-view wiring", () => {
  beforeEach(() => {
    testState.loopPanelProps = {};
    testState.leaderboardPreviewProps = {};
    testState.setIsLeaderboardLive.mockReset();
    testState.startLoop.mockReset();
    testState.pauseLoop.mockReset();
    testState.resumeLoop.mockReset();
    testState.stopLoop.mockReset();
  });

  it("passes controlled Live state from the dashboard hook without command props", async () => {
    const { default: Home } = await import("./page");
    render(<Home />);

    const liveSwitch = screen.getByRole("switch", { name: "Live updates" });
    expect(liveSwitch).toHaveAttribute("aria-checked", "true");
    expect(testState.loopPanelProps).not.toHaveProperty("startRequest");
    expect(testState.loopPanelProps).not.toHaveProperty("api");
    expect(testState.loopPanelProps).toMatchObject({
      isLeaderboardLive: true,
      onLeaderboardLiveChange: testState.setIsLeaderboardLive,
    });
  });

  it("changes only live-view state and leaves global loop rendering independent", async () => {
    const { default: Home } = await import("./page");
    render(<Home />);

    fireEvent.click(screen.getByRole("switch", { name: "Live updates" }));
    expect(testState.setIsLeaderboardLive).toHaveBeenCalledWith(false);
    expect(screen.getByText("Global loop: RUNNING")).toBeInTheDocument();
    expect(testState.startLoop).not.toHaveBeenCalled();
    expect(testState.pauseLoop).not.toHaveBeenCalled();
    expect(testState.resumeLoop).not.toHaveBeenCalled();
    expect(testState.stopLoop).not.toHaveBeenCalled();
  });

  it("passes the provider-composed SCORE Top-5 snapshot to the Dashboard preview", async () => {
    const { default: Home } = await import("./page");
    render(<Home />);

    const snapshot = testState.leaderboardPreviewProps.snapshot as {
      rankingCriterion: string;
      entries: Array<{ strategyVersionId: string }>;
    };
    expect(snapshot.rankingCriterion).toBe("score");
    expect(snapshot.entries).toHaveLength(5);
    expect(snapshot.entries[0]?.strategyVersionId).toBe("provider-score-1");
  });
});
