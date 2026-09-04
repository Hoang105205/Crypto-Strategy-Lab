import {
  LeaderboardScope,
  RankingCriterion,
  StrategyGeneratorType,
  StrategyType,
} from "@crypto-strategy-lab/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  getSession: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../lib/supabase-client", () => ({
  supabase: {
    auth: { getSession: testState.getSession },
  },
}));

import { apiClient } from "./api-client";

const STRATEGY_VERSION_ID = "strategy/version with spaces";
const UPDATED_AT = "2026-08-25T09:30:00.000Z";

describe("scoped leaderboard API client", () => {
  beforeEach(() => {
    testState.getSession.mockReset();
    testState.getSession.mockResolvedValue({
      data: { session: { access_token: "session-token-a" } },
    });
    testState.fetch.mockReset();
    vi.stubGlobal("fetch", testState.fetch);
  });

  it("encodes list sortBy and scope with URLSearchParams, preserves AbortSignal, and decodes updatedAt", async () => {
    const controller = new AbortController();
    testState.fetch.mockResolvedValue(okResponse(snapshotWire()));

    const result = await apiClient.getLeaderboard({
      sortBy: RankingCriterion.SHARPE_RATIO,
      scope: LeaderboardScope.MINE,
      signal: controller.signal,
    });

    expect(testState.fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/leaderboard?sortBy=sharpeRatio&scope=mine",
      {
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer session-token-a",
        },
      },
    );
    expect(result).toEqual({
      rankingCriterion: RankingCriterion.SHARPE_RATIO,
      updatedAt: new Date(UPDATED_AT),
      entries: [],
    });
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it("keeps omitted-scope and legacy positional list URLs while retaining the positional AbortSignal", async () => {
    const controller = new AbortController();
    testState.fetch.mockResolvedValue(okResponse(snapshotWire()));

    await apiClient.getLeaderboard();
    await apiClient.getLeaderboard(RankingCriterion.SCORE, controller.signal);

    expect(testState.fetch.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/leaderboard",
    );
    expect(testState.fetch.mock.calls[1]).toEqual([
      "http://localhost:3001/api/leaderboard?sortBy=score",
      expect.objectContaining({ signal: controller.signal }),
    ]);
  });

  it("encodes the same optional scope for detail and decodes the unchanged detail dates", async () => {
    const controller = new AbortController();
    testState.fetch.mockResolvedValue(okResponse(detailWire()));

    const result = await apiClient.getLeaderboardDetail(STRATEGY_VERSION_ID, {
      scope: LeaderboardScope.SYSTEM,
      signal: controller.signal,
    });

    expect(testState.fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/leaderboard/strategy%2Fversion%20with%20spaces?scope=system",
      {
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer session-token-a",
        },
      },
    );
    expect(result.strategyVersion.createdAt).toBeInstanceOf(Date);
    expect(result.trades[0]?.entryDate).toBeInstanceOf(Date);
    expect(result.trades[0]?.exitDate).toBeInstanceOf(Date);
    expect(result.executedAt).toBeInstanceOf(Date);
    expect(Object.keys(result).sort()).toEqual(
      [
        "backtestResultId",
        "executedAt",
        "isComposite",
        "maxDrawdown",
        "rank",
        "score",
        "sharpeRatio",
        "strategyName",
        "strategyType",
        "strategyVersion",
        "strategyVersionId",
        "totalReturn",
        "totalTrades",
        "trades",
        "userId",
        "winRate",
      ].sort(),
    );
  });

  it("keeps the legacy detail URL when scope is omitted", async () => {
    testState.fetch.mockResolvedValue(okResponse(detailWire()));

    await apiClient.getLeaderboardDetail(STRATEGY_VERSION_ID);

    expect(testState.fetch.mock.calls[0]?.[0]).toBe(
      "http://localhost:3001/api/leaderboard/strategy%2Fversion%20with%20spaces",
    );
  });

  it("derives Authorization only from each current Supabase session", async () => {
    testState.fetch.mockResolvedValue(okResponse(snapshotWire()));
    testState.getSession
      .mockResolvedValueOnce({
        data: { session: { access_token: "fresh-session-token" } },
      })
      .mockResolvedValueOnce({ data: { session: null } });

    await apiClient.getLeaderboard({ scope: LeaderboardScope.SYSTEM });
    await apiClient.getLeaderboard({ scope: LeaderboardScope.SYSTEM });

    expect(testState.getSession).toHaveBeenCalledTimes(2);
    expect(testState.fetch.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fresh-session-token",
      },
    });
    expect(testState.fetch.mock.calls[1]?.[1]).toMatchObject({
      headers: { "Content-Type": "application/json" },
    });
    expect(
      (testState.fetch.mock.calls[1]?.[1] as RequestInit).headers,
    ).not.toHaveProperty("Authorization");
  });

  it("attaches the current user token to every Strategy Builder request", async () => {
    testState.fetch
      .mockResolvedValueOnce(okResponse([]))
      .mockResolvedValueOnce(okResponse({ message: "created" }))
      .mockResolvedValueOnce(
        okResponse({
          jobId: "user-job-1",
          strategyVersionId: "user-version-1",
          status: "QUEUED",
        }),
      )
      .mockResolvedValueOnce(okResponse({ trades: [] }));

    await apiClient.getStrategies();
    await apiClient.createCompositeStrategy({
      name: "User Composite",
      childStrategyNames: ["MovingAverage", "RelativeStrengthIndex"],
      combinerType: "MAJORITY_VOTE",
    });
    await apiClient.requestUserBacktest({
      strategyName: "User Composite",
      pair: "BTCUSDT",
      timeframe: "1h",
      initialCapital: 10_000,
      startDate: "2026-07-01",
      endDate: "2026-08-01",
    });
    await apiClient.getUserBacktestResult("user-job-1");

    expect(testState.fetch.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:3001/api/strategies",
      "http://localhost:3001/api/strategies/composite",
      "http://localhost:3001/api/strategies/backtest",
      "http://localhost:3001/api/strategies/backtest/user-job-1",
    ]);
    for (const [, init] of testState.fetch.mock.calls) {
      expect(init).toMatchObject({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer session-token-a",
        },
      });
    }
  });

  it("persists 24/7 Search Loop desired state through authenticated control APIs", async () => {
    testState.fetch
      .mockResolvedValueOnce(okResponse(searchLoopControlWire(true)))
      .mockResolvedValueOnce(okResponse(searchLoopControlWire(true)))
      .mockResolvedValueOnce(okResponse(searchLoopControlWire(false)));
    const input = {
      generatorType: StrategyGeneratorType.RANDOM,
      pair: "BTCUSDT",
      timeframe: "1h",
      backtestWindowDays: 180,
      backtestConfig: {
        initialCapital: 10_000,
        positionSizePercent: 100,
      },
      maxCandidatesPerRun: 100,
      cooldownMs: 30_000,
    };

    const enabled = await apiClient.enableSearchLoopAutomation(input);
    const current = await apiClient.getSearchLoopControl();
    const disabled = await apiClient.disableSearchLoopAutomation();

    expect(enabled.enabled).toBe(true);
    expect(current.createdAt).toBeInstanceOf(Date);
    expect(current.leaseUntil).toBeInstanceOf(Date);
    expect(disabled.enabled).toBe(false);
    expect(testState.fetch.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:3001/api/loop/control/enable",
      "http://localhost:3001/api/loop/control",
      "http://localhost:3001/api/loop/control/disable",
    ]);
    expect(testState.fetch.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer session-token-a",
      },
    });
  });

  it("does not expose ownership or auth override fields in leaderboard options", () => {
    if (false) {
      void apiClient.getLeaderboard({
        scope: LeaderboardScope.MINE,
        // @ts-expect-error ownership comes only from the verified current session
        userId: "a",
      });
      void apiClient.getLeaderboardDetail("id", {
        scope: LeaderboardScope.MINE,
        // @ts-expect-error detail options cannot select an owner
        owner: "a",
      });
      void apiClient.getLeaderboard({
        scope: LeaderboardScope.SYSTEM,
        // @ts-expect-error scoped options cannot override Authorization
        headers: { Authorization: "Bearer forged" },
      });
    }
    expect(true).toBe(true);
  });
});

function snapshotWire() {
  return {
    rankingCriterion: RankingCriterion.SHARPE_RATIO,
    updatedAt: UPDATED_AT,
    entries: [],
  };
}

function detailWire() {
  return {
    rank: 1,
    userId: null,
    strategyVersionId: "system-strategy",
    strategyName: "System Strategy",
    strategyType: StrategyType.MA,
    isComposite: false,
    backtestResultId: "system-result",
    score: 0.8,
    totalReturn: 20,
    winRate: 0.6,
    maxDrawdown: -5,
    sharpeRatio: 2,
    totalTrades: 1,
    strategyVersion: {
      id: "system-strategy",
      strategyType: StrategyType.MA,
      name: "System Strategy",
      version: 1,
      parameters: {},
      isComposite: false,
      childVersionIds: [],
      createdAt: "2026-08-25T08:00:00.000Z",
    },
    trades: [
      {
        entryDate: "2026-08-25T08:10:00.000Z",
        exitDate: "2026-08-25T08:20:00.000Z",
      },
    ],
    executedAt: "2026-08-25T08:30:00.000Z",
  };
}

function searchLoopControlWire(enabled: boolean) {
  return {
    id: "system",
    enabled,
    generatorType: StrategyGeneratorType.RANDOM,
    pair: "BTCUSDT",
    timeframe: "1h",
    backtestWindowDays: 180,
    backtestConfig: {
      initialCapital: 10_000,
      positionSizePercent: 100,
    },
    maxCandidatesPerRun: 100,
    maxDurationMsPerRun: null,
    stopOnNoImprovementIterations: 50,
    cooldownMs: 30_000,
    failureCount: 0,
    nextRunAt: UPDATED_AT,
    lastStartedRunId: "loop-run-1",
    lastError: null,
    leaseOwner: "supervisor-1",
    leaseUntil: UPDATED_AT,
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
  };
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}
