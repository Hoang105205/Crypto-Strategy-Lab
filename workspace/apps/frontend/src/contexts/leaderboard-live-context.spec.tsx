import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LeaderboardScope,
  RankingCriterion,
  type LeaderboardSnapshot,
  type NormalizedRate,
} from "@crypto-strategy-lab/shared";

const testState = vi.hoisted(() => ({
  authLoading: false,
  userId: null as string | null,
  infrastructureStatus: "connected" as
    "connected" | "reconnecting" | "disconnected",
  getLeaderboard: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("./auth-context", () => ({
  useAuth: () => ({
    loading: testState.authLoading,
    user: testState.userId === null ? null : { id: testState.userId },
    session: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("../components/common/infrastructure-provider", () => ({
  useInfrastructure: () => ({
    socket: socketState.current,
    status: testState.infrastructureStatus,
    statusText: testState.infrastructureStatus,
    isStale: testState.infrastructureStatus !== "connected",
  }),
}));

vi.mock("../services/api-client", () => ({
  apiClient: { getLeaderboard: testState.getLeaderboard },
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

  emitFromServer(event: string, payload?: unknown) {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }

  listenerCount(event: string) {
    return this.handlers.get(event)?.size ?? 0;
  }
}

const socketState = { current: new FakeSocket() };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function snapshot(
  criterion: RankingCriterion,
  updatedAt: string,
  ids: string[],
): LeaderboardSnapshot {
  return {
    rankingCriterion: criterion,
    updatedAt: new Date(updatedAt),
    entries: ids.map((id, index) => ({
      rank: index + 1,
      userId: id.startsWith("system")
        ? null
        : id.includes("owner-a")
          ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
          : id.includes("owner-b")
            ? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
            : testState.userId,
      strategyVersionId: id,
      strategyName: id,
      strategyType: "MA_CROSSOVER",
      isComposite: false,
      backtestResultId: `result-${id}`,
      score: 0.9 - index * 0.1,
      totalReturn: 10,
      winRate: 0.6 as NormalizedRate,
      maxDrawdown: -0.1,
      sharpeRatio: 1.2,
      totalTrades: 10,
    })),
  };
}

async function loadContext() {
  return import("./leaderboard-live-context");
}

describe("LeaderboardLiveProvider lifecycle and persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    testState.authLoading = false;
    testState.userId = null;
    testState.infrastructureStatus = "connected";
    testState.getLeaderboard.mockReset();
    testState.disconnect.mockReset();
    socketState.current = new FakeSocket();
  });

  it("defaults OFF, bootstraps once, freezes events, and persists explicit choices", async () => {
    testState.getLeaderboard.mockResolvedValue(
      snapshot(RankingCriterion.SCORE, "2026-08-24T10:00:00.000Z", [
        "system-1",
      ]),
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();

    function Probe() {
      const live = useLeaderboardLive();
      return (
        <div>
          <span data-testid="live">{String(live.isLive)}</span>
          <span data-testid="rows">
            {live.scoreSnapshot?.entries
              .map((entry) => entry.strategyVersionId)
              .join(",") ?? "empty"}
          </span>
          <button onClick={() => live.setIsLive(true)}>enable</button>
          <button onClick={() => live.setIsLive(false)}>disable</button>
        </div>
      );
    }

    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );

    expect(screen.getByTestId("live")).toHaveTextContent("false");
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(0);
    await waitFor(() =>
      expect(screen.getByTestId("rows")).toHaveTextContent("system-1"),
    );
    expect(testState.getLeaderboard).toHaveBeenCalledTimes(1);

    act(() =>
      socketState.current.emitFromServer("leaderboard:update", { topK: [] }),
    );
    expect(testState.getLeaderboard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "enable" }));
    await waitFor(() =>
      expect(screen.getByTestId("live")).toHaveTextContent("true"),
    );
    expect(
      window.localStorage.getItem("crypto-strategy-lab:leaderboard-live"),
    ).toBe("true");
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "disable" }));
    await waitFor(() =>
      expect(screen.getByTestId("live")).toHaveTextContent("false"),
    );
    expect(
      window.localStorage.getItem("crypto-strategy-lab:leaderboard-live"),
    ).toBe("false");
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(0);
    expect(screen.getByTestId("rows")).toHaveTextContent("system-1");
  });

  it("hydrates only an exact viewer envelope and keeps an OFF snapshot through remount", async () => {
    testState.userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    window.localStorage.setItem(
      "crypto-strategy-lab:leaderboard-live",
      "false",
    );
    window.localStorage.setItem(
      "crypto-strategy-lab:leaderboard-cache:v2",
      JSON.stringify({
        version: 2,
        viewerKey: testState.userId,
        activeCriterion: RankingCriterion.SCORE,
        selectedStrategy: null,
        snapshots: {
          [`${LeaderboardScope.COMBINED}:${RankingCriterion.SCORE}`]: {
            rankingCriterion: RankingCriterion.SCORE,
            updatedAt: "2026-08-24T10:00:00.000Z",
            entries: snapshot(
              RankingCriterion.SCORE,
              "2026-08-24T10:00:00.000Z",
              ["system-1", "owner-a"],
            ).entries,
          },
        },
        persistedAt: "2026-08-24T10:00:01.000Z",
      }),
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Probe() {
      const { scoreSnapshot } = useLeaderboardLive();
      return (
        <span>
          {scoreSnapshot?.entries
            .map((entry) => entry.strategyVersionId)
            .join(",") ?? "empty"}
        </span>
      );
    }

    const first = render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("system-1,owner-a")).toBeInTheDocument(),
    );
    expect(testState.getLeaderboard).not.toHaveBeenCalled();
    first.unmount();

    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("system-1,owner-a")).toBeInTheDocument(),
    );
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(0);
    expect(testState.getLeaderboard).not.toHaveBeenCalled();
  });

  it("accepts an authoritative empty epoch snapshot and clears a newer persisted cache", async () => {
    window.localStorage.setItem(
      "crypto-strategy-lab:leaderboard-live",
      "true",
    );
    window.localStorage.setItem(
      "crypto-strategy-lab:leaderboard-cache:v2",
      JSON.stringify({
        version: 2,
        viewerKey: "anonymous",
        activeCriterion: RankingCriterion.SCORE,
        selectedStrategy: null,
        snapshots: {
          [`${LeaderboardScope.COMBINED}:${RankingCriterion.SCORE}`]: {
            rankingCriterion: RankingCriterion.SCORE,
            updatedAt: "2026-08-28T04:35:56.000Z",
            entries: snapshot(
              RankingCriterion.SCORE,
              "2026-08-28T04:35:56.000Z",
              ["system-cached"],
            ).entries,
          },
        },
        persistedAt: "2026-08-28T04:35:57.000Z",
      }),
    );
    testState.getLeaderboard.mockResolvedValue(
      snapshot(RankingCriterion.SCORE, "1970-01-01T00:00:00.000Z", []),
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();

    function Probe() {
      const rows = useLeaderboardLive().combinedScore.snapshot?.entries ?? [];
      return (
        <span data-testid="rows">
          {rows.map((entry) => entry.strategyVersionId).join(",") || "empty"}
        </span>
      );
    }

    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("rows")).toHaveTextContent("empty"),
    );
    expect(testState.getLeaderboard).toHaveBeenCalledTimes(1);
    const persisted = JSON.parse(
      window.localStorage.getItem("crypto-strategy-lab:leaderboard-cache:v2") ??
        "{}",
    ) as {
      snapshots?: Record<string, { entries?: unknown[] }>;
    };
    expect(
      persisted.snapshots?.[
        `${LeaderboardScope.COMBINED}:${RankingCriterion.SCORE}`
      ]?.entries,
    ).toEqual([]);
  });

  it("keeps one handler across route child replacement, reconciles SCORE plus active criterion, and cleans up exactly", async () => {
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "true");
    testState.userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    testState.getLeaderboard.mockImplementation(
      (options: { sortBy: RankingCriterion; scope: LeaderboardScope }) =>
        Promise.resolve(
        snapshot(options.sortBy, "2026-08-24T10:00:00.000Z", [
          "system-1",
          "owner-a",
        ]),
      ),
    );
    const foreign = vi.fn();
    socketState.current.on("loop:progress", foreign);
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();

    function Route({ name }: { name: string }) {
      const live = useLeaderboardLive();
      return (
        <div>
          <span>{name}</span>
          <span data-testid="criterion">{live.activeCriterion}</span>
          <button onClick={() => live.maintainScopedProjections()}>
            maintain
          </button>
          <button
            onClick={() =>
              void live.setActiveCriterion(RankingCriterion.SHARPE_RATIO)
            }
          >
            sharpe
          </button>
        </div>
      );
    }

    const view = render(
      <LeaderboardLiveProvider>
        <Route name="dashboard" />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() =>
      expect(testState.getLeaderboard).toHaveBeenCalledWith(
        {
          sortBy: RankingCriterion.SCORE,
          scope: LeaderboardScope.COMBINED,
          signal: expect.any(AbortSignal),
        },
      ),
    );
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(3));

    view.rerender(
      <LeaderboardLiveProvider>
        <Route name="news" />
      </LeaderboardLiveProvider>,
    );
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "sharpe" }));
    await waitFor(() =>
      expect(screen.getByTestId("criterion")).toHaveTextContent("sharpeRatio"),
    );

    act(() =>
      socketState.current.emitFromServer("leaderboard:update", {
        topK: [{ strategyVersionId: "untrusted" }],
      }),
    );
    await waitFor(() => {
      expect(testState.getLeaderboard).toHaveBeenCalledWith(
        {
          sortBy: RankingCriterion.SCORE,
          scope: LeaderboardScope.COMBINED,
          signal: expect.any(AbortSignal),
        },
      );
      expect(testState.getLeaderboard).toHaveBeenCalledWith(
        {
          sortBy: RankingCriterion.SHARPE_RATIO,
          scope: LeaderboardScope.SYSTEM,
          signal: expect.any(AbortSignal),
        },
      );
    });

    const registration = socketState.current.on.mock.calls.find(
      ([event]) => event === "leaderboard:update",
    );
    view.unmount();
    expect(socketState.current.off).toHaveBeenCalledWith(
      "leaderboard:update",
      registration?.[1],
    );
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(0);
    expect(socketState.current.listenerCount("loop:progress")).toBe(1);
    expect(testState.disconnect).not.toHaveBeenCalled();
  });

  it("attaches before re-enable refetch and rejects an older successful catch-up", async () => {
    const initial = snapshot(
      RankingCriterion.SCORE,
      "2026-08-24T10:00:00.000Z",
      ["system-initial"],
    );
    const catchUp = deferred<LeaderboardSnapshot>();
    const invalidation = deferred<LeaderboardSnapshot>();
    testState.getLeaderboard
      .mockResolvedValueOnce(initial)
      .mockReturnValueOnce(catchUp.promise)
      .mockReturnValueOnce(invalidation.promise);
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Probe() {
      const live = useLeaderboardLive();
      return (
        <>
          <span data-testid="rows">
            {live.scoreSnapshot?.entries[0]?.strategyVersionId}
          </span>
          <button onClick={() => live.setIsLive(true)}>enable</button>
        </>
      );
    }
    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("rows")).toHaveTextContent("system-initial"),
    );

    fireEvent.click(screen.getByRole("button", { name: "enable" }));
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(1);
    expect(socketState.current.on.mock.invocationCallOrder.at(-1)).toBeLessThan(
      testState.getLeaderboard.mock.invocationCallOrder[1],
    );
    act(() =>
      socketState.current.emitFromServer("leaderboard:update", { topK: [] }),
    );
    const newest = snapshot(
      RankingCriterion.SCORE,
      "2026-08-24T10:02:00.000Z",
      ["system-newest"],
    );
    await act(async () => invalidation.resolve(newest));
    await waitFor(() =>
      expect(screen.getByTestId("rows")).toHaveTextContent("system-newest"),
    );
    await act(async () =>
      catchUp.resolve(
        snapshot(RankingCriterion.SCORE, "2026-08-24T10:01:00.000Z", [
          "system-old",
        ]),
      ),
    );
    expect(screen.getByTestId("rows")).toHaveTextContent("system-newest");
  });

  it("refetches on reconnect only while ON", async () => {
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "true");
    testState.getLeaderboard.mockResolvedValue(
      snapshot(RankingCriterion.SCORE, "2026-08-24T10:00:00.000Z", [
        "system-1",
      ]),
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Probe() {
      const live = useLeaderboardLive();
      return <button onClick={() => live.setIsLive(false)}>disable</button>;
    }
    const view = render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() =>
      expect(testState.getLeaderboard).toHaveBeenCalledTimes(1),
    );

    testState.infrastructureStatus = "disconnected";
    view.rerender(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    testState.infrastructureStatus = "connected";
    view.rerender(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() =>
      expect(testState.getLeaderboard).toHaveBeenCalledTimes(2),
    );

    fireEvent.click(screen.getByRole("button", { name: "disable" }));
    testState.infrastructureStatus = "disconnected";
    view.rerender(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    testState.infrastructureStatus = "connected";
    view.rerender(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    expect(testState.getLeaderboard).toHaveBeenCalledTimes(2);
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(0);
  });

  it("invalidates an in-flight Live request before freezing the snapshot OFF", async () => {
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "true");
    const pendingInvalidation = deferred<LeaderboardSnapshot>();
    testState.getLeaderboard
      .mockResolvedValueOnce(
        snapshot(RankingCriterion.SCORE, "2026-08-24T10:00:00.000Z", [
          "system-frozen",
        ]),
      )
      .mockReturnValueOnce(pendingInvalidation.promise);
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();

    function Probe() {
      const live = useLeaderboardLive();
      return (
        <>
          <span data-testid="rows">
            {live.scoreSnapshot?.entries[0]?.strategyVersionId ?? "empty"}
          </span>
          <button onClick={() => live.setIsLive(false)}>disable</button>
        </>
      );
    }

    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("rows")).toHaveTextContent("system-frozen"),
    );

    act(() => socketState.current.emitFromServer("leaderboard:update", {}));
    await waitFor(() =>
      expect(testState.getLeaderboard).toHaveBeenCalledTimes(2),
    );
    const pendingSignal = testState.getLeaderboard.mock.calls[1]?.[0]
      ?.signal as AbortSignal;

    fireEvent.click(screen.getByRole("button", { name: "disable" }));
    expect(pendingSignal.aborted).toBe(true);
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(0);

    await act(async () =>
      pendingInvalidation.resolve(
        snapshot(RankingCriterion.SCORE, "2026-08-24T10:01:00.000Z", [
          "system-must-not-commit",
        ]),
      ),
    );
    expect(screen.getByTestId("rows")).toHaveTextContent("system-frozen");
  });

  it("persists at most SCORE plus the active criterion", async () => {
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "true");
    testState.getLeaderboard.mockImplementation(
      (options: { sortBy: RankingCriterion; scope: LeaderboardScope }) =>
        Promise.resolve(
          snapshot(options.sortBy, "2026-08-24T10:00:00.000Z", [
            options.scope === LeaderboardScope.MINE
              ? `owner-a-${options.sortBy}`
              : `system-${options.sortBy}`,
          ]),
        ),
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();

    function Probe() {
      const live = useLeaderboardLive();
      return (
        <>
          <span data-testid="active-rows">
            {live.activeSnapshot?.entries[0]?.strategyVersionId ?? "empty"}
          </span>
          <button onClick={() => live.maintainScopedProjections()}>
            maintain
          </button>
          <button
            onClick={() =>
              void live.setActiveCriterion(RankingCriterion.SHARPE_RATIO)
            }
          >
            sharpe
          </button>
          <button
            onClick={() =>
              void live.setActiveCriterion(RankingCriterion.TOTAL_RETURN)
            }
          >
            return
          </button>
        </>
      );
    }

    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-rows")).toHaveTextContent(
        "system-score",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "sharpe" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-rows")).toHaveTextContent(
        "system-sharpeRatio",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "return" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-rows")).toHaveTextContent(
        "system-totalReturn",
      ),
    );

    await waitFor(() => {
      const envelope = JSON.parse(
        window.localStorage.getItem("crypto-strategy-lab:leaderboard-cache:v2") ??
          "{}",
      ) as { snapshots?: Record<string, unknown> };
      expect(Object.keys(envelope.snapshots ?? {}).sort()).toEqual([
        `${LeaderboardScope.COMBINED}:${RankingCriterion.SCORE}`,
        `${LeaderboardScope.SYSTEM}:${RankingCriterion.TOTAL_RETURN}`,
      ]);
    });
  });

  it("refetches a previously active criterion instead of showing its stale cache while ON", async () => {
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "true");
    const secondSharpe = deferred<LeaderboardSnapshot>();
    const criterionCalls = new Map<RankingCriterion, number>();
    testState.getLeaderboard.mockImplementation(
      (options: { sortBy: RankingCriterion; scope: LeaderboardScope }) => {
        if (options.scope === LeaderboardScope.MINE) {
          return Promise.resolve(
            snapshot(options.sortBy, "2026-08-24T10:00:00.000Z", [
              `owner-a-${options.sortBy}`,
            ]),
          );
        }
        if (options.scope === LeaderboardScope.COMBINED) {
          return Promise.resolve(
            snapshot(options.sortBy, "2026-08-24T10:00:00.000Z", [
              "system-combined",
            ]),
          );
        }
        const criterion = options.sortBy;
        const call = (criterionCalls.get(criterion) ?? 0) + 1;
        criterionCalls.set(criterion, call);
        if (criterion === RankingCriterion.SHARPE_RATIO && call === 2) {
          return secondSharpe.promise;
        }
        return Promise.resolve(
          snapshot(criterion, `2026-08-24T10:0${call}:00.000Z`, [
            `system-${criterion}-${call}`,
          ]),
        );
      },
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();

    function Probe() {
      const live = useLeaderboardLive();
      return (
        <>
          <span data-testid="active-rows">
            {live.activeSnapshot?.entries[0]?.strategyVersionId ?? "empty"}
          </span>
          <button onClick={() => live.maintainScopedProjections()}>
            maintain
          </button>
          <button
            onClick={() =>
              void live.setActiveCriterion(RankingCriterion.SHARPE_RATIO)
            }
          >
            sharpe
          </button>
          <button
            onClick={() =>
              void live.setActiveCriterion(RankingCriterion.TOTAL_RETURN)
            }
          >
            return
          </button>
        </>
      );
    }

    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-rows")).toHaveTextContent(
        "system-score-1",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "sharpe" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-rows")).toHaveTextContent(
        "system-sharpeRatio-1",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "return" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-rows")).toHaveTextContent(
        "system-totalReturn-1",
      ),
    );

    act(() => socketState.current.emitFromServer("leaderboard:update", {}));
    await waitFor(() =>
      expect(criterionCalls.get(RankingCriterion.TOTAL_RETURN)).toBe(2),
    );
    fireEvent.click(screen.getByRole("button", { name: "sharpe" }));
    expect(screen.getByTestId("active-rows")).not.toHaveTextContent(
      "system-sharpeRatio-1",
    );
    await waitFor(() =>
      expect(criterionCalls.get(RankingCriterion.SHARPE_RATIO)).toBe(2),
    );

    await act(async () =>
      secondSharpe.resolve(
        snapshot(RankingCriterion.SHARPE_RATIO, "2026-08-24T10:03:00.000Z", [
          "system-sharpeRatio-2",
        ]),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId("active-rows")).toHaveTextContent(
        "system-sharpeRatio-2",
      ),
    );
  });
});

describe("T017 scoped projection cache contract (RED)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    testState.authLoading = false;
    testState.userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    testState.infrastructureStatus = "connected";
    testState.getLeaderboard.mockReset();
    socketState.current = new FakeSocket();
  });

  it("rejects criterion-only v1 data and hydrates only an exact-viewer v2 projection envelope", async () => {
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "false");
    window.localStorage.setItem(
      "crypto-strategy-lab:leaderboard-cache:v1",
      JSON.stringify({
        version: 1,
        viewerKey: testState.userId,
        activeCriterion: RankingCriterion.SCORE,
        selectedStrategyVersionId: null,
        snapshots: {
          score: {
            ...snapshot(
              RankingCriterion.SCORE,
              "2026-08-24T10:00:00.000Z",
              ["owner-a-v1-must-not-render"],
            ),
            updatedAt: "2026-08-24T10:00:00.000Z",
          },
        },
        persistedAt: "2026-08-24T10:00:01.000Z",
      }),
    );
    testState.getLeaderboard.mockResolvedValue(
      snapshot(RankingCriterion.SCORE, "2026-08-24T10:01:00.000Z", [
        "system-authoritative",
        "owner-a-authoritative",
      ]),
    );
    const {
      LEADERBOARD_CACHE_STORAGE_KEY,
      LeaderboardLiveProvider,
      useLeaderboardLive,
    } = await loadContext();

    function Probe() {
      const live = useLeaderboardLive();
      return (
        <span data-testid="combined">
          {live.combinedScore?.snapshot?.entries
            .map((entry) => entry.strategyVersionId)
            .join(",") ?? "empty"}
        </span>
      );
    }

    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    expect(LEADERBOARD_CACHE_STORAGE_KEY).toBe(
      "crypto-strategy-lab:leaderboard-cache:v2",
    );
    expect(screen.getByTestId("combined")).not.toHaveTextContent(
      "owner-a-v1-must-not-render",
    );
    await waitFor(() =>
      expect(screen.getByTestId("combined")).toHaveTextContent(
        "system-authoritative,owner-a-authoritative",
      ),
    );
  });

  it("rejects a cached Mine projection containing System rows instead of showing both tables identically", async () => {
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "false");
    const cachedSystem = snapshot(
      RankingCriterion.SCORE,
      "2026-08-24T10:00:00.000Z",
      ["system-copied-into-mine"],
    );
    window.localStorage.setItem(
      "crypto-strategy-lab:leaderboard-cache:v2",
      JSON.stringify({
        version: 2,
        viewerKey: testState.userId,
        activeCriterion: RankingCriterion.SCORE,
        selectedStrategy: null,
        snapshots: {
          [`${LeaderboardScope.MINE}:${RankingCriterion.SCORE}`]: {
            ...cachedSystem,
            updatedAt: cachedSystem.updatedAt.toISOString(),
          },
        },
        persistedAt: "2026-08-24T10:00:01.000Z",
      }),
    );
    testState.getLeaderboard.mockImplementation(
      (options: { sortBy: RankingCriterion; scope?: LeaderboardScope }) =>
        Promise.resolve(
          snapshot(options.sortBy, "2026-08-24T10:01:00.000Z", [
            options.scope === LeaderboardScope.MINE
              ? "owner-a-authoritative-mine"
              : "system-authoritative",
          ]),
        ),
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Probe() {
      const live = useLeaderboardLive();
      return (
        <>
          <span data-testid="mine-integrity">
            {live.mine.snapshot?.entries
              .map((entry) => entry.strategyVersionId)
              .join(",") ?? "empty"}
          </span>
          <button onClick={() => live.maintainScopedProjections()}>
            maintain
          </button>
        </>
      );
    }

    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    expect(screen.getByTestId("mine-integrity")).toHaveTextContent("empty");
    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    await waitFor(() =>
      expect(screen.getByTestId("mine-integrity")).toHaveTextContent(
        "owner-a-authoritative-mine",
      ),
    );
    expect(screen.getByTestId("mine-integrity")).not.toHaveTextContent(
      "system-copied-into-mine",
    );
  });

  it("starts distinct System and Mine reads concurrently, deduplicates exact keys, and exposes independent state", async () => {
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "false");
    const systemRead = deferred<LeaderboardSnapshot>();
    const mineRead = deferred<LeaderboardSnapshot>();
    testState.getLeaderboard.mockImplementation(
      (options: { sortBy: RankingCriterion; scope?: LeaderboardScope }) => {
        if (options.scope === LeaderboardScope.SYSTEM) return systemRead.promise;
        if (options.scope === LeaderboardScope.MINE) return mineRead.promise;
        return Promise.resolve(
          snapshot(options.sortBy, "2026-08-24T10:00:00.000Z", [
            "system-combined",
            "owner-a-combined",
          ]),
        );
      },
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Probe() {
      const live = useLeaderboardLive();
      return (
        <>
          <span data-testid="system-state">
            {live.system?.loading ? "loading" : live.system?.snapshot?.entries[0]?.strategyVersionId ?? "empty"}
          </span>
          <span data-testid="mine-state">
            {live.mine?.loading ? "loading" : live.mine?.snapshot?.entries[0]?.strategyVersionId ?? "empty"}
          </span>
          <button onClick={() => live.maintainScopedProjections?.()}>
            maintain
          </button>
        </>
      );
    }
    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(3));
    expect(testState.getLeaderboard).toHaveBeenCalledWith({
      sortBy: RankingCriterion.SCORE,
      scope: LeaderboardScope.SYSTEM,
      signal: expect.any(AbortSignal),
    });
    expect(testState.getLeaderboard).toHaveBeenCalledWith({
      sortBy: RankingCriterion.SCORE,
      scope: LeaderboardScope.MINE,
      signal: expect.any(AbortSignal),
    });
    expect(screen.getByTestId("system-state")).toHaveTextContent("loading");
    expect(screen.getByTestId("mine-state")).toHaveTextContent("loading");

    await act(async () =>
      systemRead.resolve(
        snapshot(RankingCriterion.SCORE, "2026-08-24T10:01:00.000Z", [
          "system-only",
        ]),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId("system-state")).toHaveTextContent("system-only"),
    );
    expect(screen.getByTestId("mine-state")).toHaveTextContent("loading");
    await act(async () =>
      mineRead.resolve(
        snapshot(RankingCriterion.SCORE, "2026-08-24T10:02:00.000Z", [
          "owner-a-only",
        ]),
      ),
    );
  });

  it("retains Combined SCORE and prunes scoped projections to the active criterion in v2", async () => {
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "false");
    testState.getLeaderboard.mockImplementation(
      (options: { sortBy: RankingCriterion; scope?: LeaderboardScope }) =>
        Promise.resolve(
          snapshot(options.sortBy, "2026-08-24T10:00:00.000Z", [
            `${options.scope ?? LeaderboardScope.COMBINED}-${options.sortBy}`,
          ]),
        ),
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Probe() {
      const live = useLeaderboardLive();
      return (
        <>
          <button onClick={() => live.maintainScopedProjections?.()}>
            maintain
          </button>
          <button
            onClick={() => void live.setActiveCriterion(RankingCriterion.SHARPE_RATIO)}
          >
            sharpe
          </button>
        </>
      );
    }
    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole("button", { name: "sharpe" }));
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(5));

    const envelope = JSON.parse(
      window.localStorage.getItem("crypto-strategy-lab:leaderboard-cache:v2") ?? "{}",
    ) as { version?: number; viewerKey?: string; snapshots?: Record<string, unknown> };
    expect(envelope.version).toBe(2);
    expect(envelope.viewerKey).toBe(testState.userId);
    expect(Object.keys(envelope.snapshots ?? {}).sort()).toEqual([
      `${LeaderboardScope.COMBINED}:${RankingCriterion.SCORE}`,
      `${LeaderboardScope.MINE}:${RankingCriterion.SHARPE_RATIO}`,
      `${LeaderboardScope.SYSTEM}:${RankingCriterion.SHARPE_RATIO}`,
    ]);
  });

  it("skips anonymous Mine HTTP and exposes a neutral Mine projection", async () => {
    testState.userId = null;
    testState.getLeaderboard.mockImplementation(
      (options: { sortBy: RankingCriterion; scope?: LeaderboardScope }) =>
        Promise.resolve(
          snapshot(options.sortBy, "2026-08-24T10:00:00.000Z", ["system-safe"]),
        ),
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Probe() {
      const live = useLeaderboardLive();
      return (
        <>
          <span data-testid="mine-neutral">
            {String(live.mine?.loading)}:{String(live.mine?.snapshot === null)}
          </span>
          <button onClick={() => live.maintainScopedProjections?.()}>
            maintain
          </button>
        </>
      );
    }
    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(2));
    expect(
      testState.getLeaderboard.mock.calls.some(
        ([options]) => options.scope === LeaderboardScope.MINE,
      ),
    ).toBe(false);
    expect(screen.getByTestId("mine-neutral")).toHaveTextContent("false:true");
  });
});

describe("T018 scoped realtime lifecycle contract (RED)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "true");
    testState.authLoading = false;
    testState.userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    testState.infrastructureStatus = "connected";
    testState.getLeaderboard.mockReset();
    socketState.current = new FakeSocket();
  });

  it("uses one subscribe-before-catch-up handler and fans invalidation/reconnect out through authoritative scoped REST", async () => {
    testState.getLeaderboard.mockImplementation(
      (options: { sortBy: RankingCriterion; scope?: LeaderboardScope }) =>
        Promise.resolve(
          snapshot(options.sortBy, "2026-08-24T10:00:00.000Z", [
            `${options.scope ?? LeaderboardScope.COMBINED}-authoritative`,
          ]),
        ),
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Route({ name }: { name: string }) {
      const live = useLeaderboardLive();
      return (
        <>
          <span>{name}</span>
          <span data-testid="system-row">
            {live.system?.snapshot?.entries[0]?.strategyVersionId ?? "empty"}
          </span>
          <span data-testid="mine-row">
            {live.mine?.snapshot?.entries[0]?.strategyVersionId ?? "empty"}
          </span>
          <button onClick={() => live.maintainScopedProjections?.()}>
            maintain
          </button>
          <button onClick={() => live.setIsLive(false)}>disable</button>
        </>
      );
    }
    const view = render(
      <LeaderboardLiveProvider>
        <Route name="leaderboard" />
      </LeaderboardLiveProvider>,
    );
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(1);
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(1));
    const registrationOrder = socketState.current.on.mock.invocationCallOrder.find(
      (_, index) => socketState.current.on.mock.calls[index]?.[0] === "leaderboard:update",
    );
    expect(registrationOrder).toBeLessThan(
      testState.getLeaderboard.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );

    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(3));
    view.rerender(
      <LeaderboardLiveProvider>
        <Route name="news" />
      </LeaderboardLiveProvider>,
    );
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(1);

    act(() =>
      socketState.current.emitFromServer("leaderboard:update", {
        topK: [
          {
            strategyVersionId: "event-private-poison-must-never-render",
          },
        ],
      }),
    );
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(6));
    expect(screen.getByTestId("system-row")).not.toHaveTextContent("poison");
    expect(screen.getByTestId("mine-row")).not.toHaveTextContent("poison");

    testState.infrastructureStatus = "disconnected";
    view.rerender(
      <LeaderboardLiveProvider>
        <Route name="news" />
      </LeaderboardLiveProvider>,
    );
    testState.infrastructureStatus = "connected";
    view.rerender(
      <LeaderboardLiveProvider>
        <Route name="news" />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(9));

    fireEvent.click(screen.getByRole("button", { name: "disable" }));
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(0);
    act(() => socketState.current.emitFromServer("leaderboard:update", { topK: [] }));
    expect(testState.getLeaderboard).toHaveBeenCalledTimes(9);
  });

  it("aborts every maintained in-flight scope before freezing Live OFF", async () => {
    const reads = new Map<LeaderboardScope, ReturnType<typeof deferred<LeaderboardSnapshot>>>();
    testState.getLeaderboard.mockImplementation(
      (options: { sortBy: RankingCriterion; scope?: LeaderboardScope }) => {
        const scope = options.scope ?? LeaderboardScope.COMBINED;
        const read = deferred<LeaderboardSnapshot>();
        reads.set(scope, read);
        return read.promise;
      },
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Probe() {
      const live = useLeaderboardLive();
      return (
        <>
          <button onClick={() => live.maintainScopedProjections?.()}>
            maintain
          </button>
          <button onClick={() => live.setIsLive(false)}>disable</button>
        </>
      );
    }
    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(3));
    const signals = testState.getLeaderboard.mock.calls.map(
      ([options]) => options.signal as AbortSignal,
    );
    fireEvent.click(screen.getByRole("button", { name: "disable" }));
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(socketState.current.listenerCount("leaderboard:update")).toBe(0);
  });
});

describe("T019 identity and scoped selection contract (RED)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    testState.authLoading = false;
    testState.userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    testState.infrastructureStatus = "connected";
    testState.getLeaderboard.mockReset();
    socketState.current = new FakeSocket();
  });

  it("records sourceScope and clears selection when its source projection loses visibility", async () => {
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "false");
    let mineCalls = 0;
    testState.getLeaderboard.mockImplementation(
      (options: { sortBy: RankingCriterion; scope?: LeaderboardScope }) => {
        if (options.scope === LeaderboardScope.MINE) mineCalls += 1;
        const ids =
          options.scope === LeaderboardScope.MINE && mineCalls > 1
            ? []
            : options.scope === LeaderboardScope.MINE
              ? ["owner-a-selected"]
              : ["system-safe"];
        return Promise.resolve(
          snapshot(options.sortBy, `2026-08-24T10:0${mineCalls}:00.000Z`, ids),
        );
      },
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Probe() {
      const live = useLeaderboardLive();
      return (
        <>
          <span data-testid="selection">
            {live.selectedStrategy === null
              ? "none"
              : `${live.selectedStrategy.sourceScope}:${live.selectedStrategy.strategyVersionId}`}
          </span>
          <button onClick={() => live.maintainScopedProjections?.()}>
            maintain
          </button>
          <button
            onClick={() =>
              live.setSelectedStrategy?.({
                strategyVersionId: "owner-a-selected",
                sourceScope: LeaderboardScope.MINE,
              })
            }
          >
            select mine
          </button>
          <button onClick={() => void live.mine?.refetch()}>refresh mine</button>
        </>
      );
    }
    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole("button", { name: "select mine" }));
    expect(screen.getByTestId("selection")).toHaveTextContent(
      `${LeaderboardScope.MINE}:owner-a-selected`,
    );
    fireEvent.click(screen.getByRole("button", { name: "refresh mine" }));
    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("none"));
  });

  it.each([
    ["B", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    ["anonymous", null],
  ])(
    "clears all A projections and detail eligibility before %s paint, then rejects delayed A scope responses",
    async (_label, nextViewer) => {
      window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "true");
      const callsByViewer = new Map<string, number>();
      const delayedA: Array<ReturnType<typeof deferred<LeaderboardSnapshot>>> = [];
      testState.getLeaderboard.mockImplementation(
        (options: { sortBy: RankingCriterion; scope?: LeaderboardScope }) => {
          const viewer = testState.userId ?? "anonymous";
          const call = (callsByViewer.get(viewer) ?? 0) + 1;
          callsByViewer.set(viewer, call);
          const scope = options.scope ?? LeaderboardScope.COMBINED;
          if (viewer.startsWith("aaaaaaaa") && call > 3) {
            const pending = deferred<LeaderboardSnapshot>();
            delayedA.push(pending);
            return pending.promise;
          }
          const ids =
            scope === LeaderboardScope.MINE
              ? viewer === "anonymous"
                ? []
                : [viewer.startsWith("aaaaaaaa") ? "owner-a-current" : "owner-b-current"]
              : [viewer === "anonymous" ? "system-anonymous" : `system-${viewer[0]}`];
          return Promise.resolve(
            snapshot(options.sortBy, "2026-08-24T10:00:00.000Z", ids),
          );
        },
      );
      const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
      function Probe() {
        const live = useLeaderboardLive();
        return (
          <>
            <span data-testid="all-rows">
              {[live.combinedScore, live.system, live.mine]
                .flatMap((projection) => projection?.snapshot?.entries ?? [])
                .map((entry) => entry.strategyVersionId)
                .join(",") || "empty"}
            </span>
            <span data-testid="selection">
              {live.selectedStrategy?.strategyVersionId ?? "none"}
            </span>
            <span data-testid="live-value">{String(live.isLive)}</span>
            <button onClick={() => live.maintainScopedProjections?.()}>
              maintain
            </button>
            <button
              onClick={() =>
                live.setSelectedStrategy?.({
                  strategyVersionId: "owner-a-current",
                  sourceScope: LeaderboardScope.MINE,
                })
              }
            >
              select mine
            </button>
          </>
        );
      }
      const view = render(
        <LeaderboardLiveProvider>
          <Probe />
        </LeaderboardLiveProvider>,
      );
      await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole("button", { name: "maintain" }));
      await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(3));
      fireEvent.click(screen.getByRole("button", { name: "select mine" }));
      expect(screen.getByTestId("selection")).toHaveTextContent("owner-a-current");

      act(() => socketState.current.emitFromServer("leaderboard:update", {}));
      await waitFor(() => expect(delayedA).toHaveLength(3));
      const delayedSignals = testState.getLeaderboard.mock.calls
        .slice(3, 6)
        .map(([options]) => options.signal as AbortSignal);

      testState.userId = nextViewer;
      view.rerender(
        <LeaderboardLiveProvider>
          <Probe />
        </LeaderboardLiveProvider>,
      );
      expect(screen.getByTestId("all-rows")).toHaveTextContent("empty");
      expect(screen.getByTestId("selection")).toHaveTextContent("none");
      expect(screen.getByTestId("live-value")).toHaveTextContent("true");
      expect(delayedSignals.every((signal) => signal.aborted)).toBe(true);

      await act(async () => {
        delayedA.forEach((pending, index) =>
          pending.resolve(
            snapshot(RankingCriterion.SCORE, "2026-08-24T10:10:00.000Z", [
              `owner-a-delayed-${index}`,
            ]),
          ),
        );
        await Promise.all(delayedA.map(({ promise }) => promise));
      });
      expect(screen.getByTestId("all-rows")).not.toHaveTextContent("owner-a-delayed");
      await waitFor(() =>
        expect(screen.getByTestId("all-rows")).not.toHaveTextContent("empty"),
      );
      expect(screen.getByTestId("all-rows")).not.toHaveTextContent("owner-a-current");
    },
  );

  it("uses request generations and per-key watermarks so an older superseded Mine read cannot overwrite the newest", async () => {
    window.localStorage.setItem("crypto-strategy-lab:leaderboard-live", "false");
    const mineRefreshes: Array<ReturnType<typeof deferred<LeaderboardSnapshot>>> = [];
    let mineCalls = 0;
    testState.getLeaderboard.mockImplementation(
      (options: { sortBy: RankingCriterion; scope?: LeaderboardScope }) => {
        if (options.scope === LeaderboardScope.MINE) {
          mineCalls += 1;
          if (mineCalls > 1) {
            const read = deferred<LeaderboardSnapshot>();
            mineRefreshes.push(read);
            return read.promise;
          }
          return Promise.resolve(
            snapshot(options.sortBy, "2026-08-24T10:00:00.000Z", ["owner-a-base"]),
          );
        }
        return Promise.resolve(
          snapshot(options.sortBy, "2026-08-24T10:00:00.000Z", ["system-safe"]),
        );
      },
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Probe() {
      const live = useLeaderboardLive();
      return (
        <>
          <span data-testid="mine-row">
            {live.mine?.snapshot?.entries[0]?.strategyVersionId ?? "empty"}
          </span>
          <button onClick={() => live.maintainScopedProjections?.()}>
            maintain
          </button>
          <button onClick={() => void live.mine?.refetch()}>refresh</button>
        </>
      );
    }
    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    await waitFor(() => expect(testState.getLeaderboard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "maintain" }));
    await waitFor(() => expect(screen.getByTestId("mine-row")).toHaveTextContent("owner-a-base"));
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(mineRefreshes).toHaveLength(2));
    const refreshSignals = testState.getLeaderboard.mock.calls
      .filter(([options]) => options.scope === LeaderboardScope.MINE)
      .slice(1)
      .map(([options]) => options.signal as AbortSignal);
    expect(refreshSignals[0]?.aborted).toBe(true);
    await act(async () =>
      mineRefreshes[1]?.resolve(
        snapshot(RankingCriterion.SCORE, "2026-08-24T10:02:00.000Z", ["owner-a-newest"]),
      ),
    );
    await waitFor(() => expect(screen.getByTestId("mine-row")).toHaveTextContent("owner-a-newest"));
    await act(async () =>
      mineRefreshes[0]?.resolve(
        snapshot(RankingCriterion.SCORE, "2026-08-24T10:01:00.000Z", ["owner-a-older"]),
      ),
    );
    expect(screen.getByTestId("mine-row")).toHaveTextContent("owner-a-newest");
  });
});

describe("LeaderboardLiveProvider viewer boundary", () => {
  beforeEach(() => {
    window.localStorage.clear();
    testState.authLoading = false;
    testState.userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    testState.infrastructureStatus = "connected";
    testState.getLeaderboard.mockReset();
    socketState.current = new FakeSocket();
  });

  it("rejects malformed or mismatched persisted envelopes instead of filtering rows", async () => {
    window.localStorage.setItem(
      "crypto-strategy-lab:leaderboard-live",
      "false",
    );
    window.localStorage.setItem(
      "crypto-strategy-lab:leaderboard-cache:v1",
      "{bad-json",
    );
    testState.getLeaderboard.mockResolvedValue(
      snapshot(RankingCriterion.SCORE, "2026-08-24T10:00:00.000Z", [
        "system-safe",
        "owner-a",
      ]),
    );
    const { LeaderboardLiveProvider, useLeaderboardLive } = await loadContext();
    function Probe() {
      return (
        <span>
          {useLeaderboardLive().scoreSnapshot?.entries[0]?.strategyVersionId ??
            "empty"}
        </span>
      );
    }
    render(
      <LeaderboardLiveProvider>
        <Probe />
      </LeaderboardLiveProvider>,
    );
    expect(screen.getByText("empty")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("system-safe")).toBeInTheDocument(),
    );
    expect(testState.getLeaderboard).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["B", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    ["anonymous", null],
  ])(
    "clears A before %s renders, aborts A, preserves preference, and rejects delayed A success",
    async (_label, nextUserId) => {
      window.localStorage.setItem(
        "crypto-strategy-lab:leaderboard-live",
        "true",
      );
      const initialA = snapshot(
        RankingCriterion.SCORE,
        "2026-08-24T10:00:00.000Z",
        ["system-a", "owner-a"],
      );
      const delayedA = deferred<LeaderboardSnapshot>();
      const nextViewer = deferred<LeaderboardSnapshot>();
      testState.getLeaderboard
        .mockResolvedValueOnce(initialA)
        .mockReturnValueOnce(delayedA.promise)
        .mockReturnValueOnce(nextViewer.promise);
      const { LeaderboardLiveProvider, useLeaderboardLive } =
        await loadContext();
      function Probe() {
        const live = useLeaderboardLive();
        return (
          <span data-testid="rows">
            {live.scoreSnapshot?.entries
              .map((entry) => entry.strategyVersionId)
              .join(",") ?? "empty"}
          </span>
        );
      }
      const view = render(
        <LeaderboardLiveProvider>
          <Probe />
        </LeaderboardLiveProvider>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("rows")).toHaveTextContent("owner-a"),
      );

      act(() =>
        socketState.current.emitFromServer("leaderboard:update", { topK: [] }),
      );
      await waitFor(() =>
        expect(testState.getLeaderboard).toHaveBeenCalledTimes(2),
      );
      const capturedSignal = testState.getLeaderboard.mock.calls[1]?.[0]
        ?.signal as AbortSignal;

      testState.userId = nextUserId;
      view.rerender(
        <LeaderboardLiveProvider>
          <Probe />
        </LeaderboardLiveProvider>,
      );
      expect(screen.getByTestId("rows")).toHaveTextContent("empty");
      expect(capturedSignal.aborted).toBe(true);
      expect(
        window.localStorage.getItem("crypto-strategy-lab:leaderboard-live"),
      ).toBe("true");
      expect(
        window.localStorage.getItem("crypto-strategy-lab:leaderboard-cache:v2"),
      ).toBeNull();

      await act(async () =>
        delayedA.resolve(
          snapshot(RankingCriterion.SCORE, "2026-08-24T10:10:00.000Z", [
            "system-a-late",
            "owner-a-late",
          ]),
        ),
      );
      expect(screen.getByTestId("rows")).toHaveTextContent("empty");

      const expectedIds =
        nextUserId === null ? ["system-anonymous"] : ["system-b", "owner-b"];
      await act(async () =>
        nextViewer.resolve(
          snapshot(
            RankingCriterion.SCORE,
            "2026-08-24T10:11:00.000Z",
            expectedIds,
          ),
        ),
      );
      await waitFor(() =>
        expect(screen.getByTestId("rows")).toHaveTextContent(
          expectedIds.join(","),
        ),
      );
      expect(screen.getByTestId("rows")).not.toHaveTextContent("owner-a");
    },
  );
});
