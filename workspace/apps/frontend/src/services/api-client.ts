"use client";

// API client — typed fetch wrappers for the Market Data REST endpoints.
// Owner: Hoang
// See: sdd_artifacts/market-data-frontend/contracts/frontend-api.md (SSoT)

import type {
  BacktestConfig,
  Candle,
  LeaderboardEntryPayload,
  LeaderboardScope,
  LeaderboardSnapshot,
  LoopStatus,
  QueueStats,
  RankingCriterion,
  SearchLoopCandidate,
  SearchLoopRun,
  StrategyGeneratorType,
  StrategyVersion,
  Subscription,
  Trade,
  TradingPair,
} from "@crypto-strategy-lab/shared";
import { API_BASE_URL } from "../lib/constants";
import { supabase } from "../lib/supabase-client";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface ErrorBody {
  error?: unknown;
  message?: unknown;
  code?: unknown;
}

/** Shared HTTP boundary. Domain methods remain responsible for decoding JSON dates. */
export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string>) },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrorBody;
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : `HTTP ${res.status}`;
    const code =
      typeof body.code === "string" ? body.code : `HTTP_${res.status}`;
    throw new ApiClientError(message, res.status, code);
  }

  return res.json() as Promise<T>;
}

type SearchLoopRunWire = Omit<
  SearchLoopRun,
  "startedAt" | "pausedAt" | "stoppedAt"
> & {
  startedAt: string;
  pausedAt: string | null;
  stoppedAt: string | null;
};

type SearchLoopCandidateWire = Omit<
  SearchLoopCandidate,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type LeaderboardSnapshotWire = Omit<LeaderboardSnapshot, "updatedAt"> & {
  updatedAt: string;
};

type StrategyVersionWire = Omit<StrategyVersion, "createdAt"> & {
  createdAt: string;
};

type TradeWire = Omit<Trade, "entryDate" | "exitDate"> & {
  entryDate: string;
  exitDate: string;
};

interface DashboardSummaryWire {
  leaderboard: LeaderboardSnapshotWire;
  loop: SearchLoopRunWire | null;
  queue: QueueStats;
  generatedAt: string;
}

export interface DashboardSummary {
  leaderboard: LeaderboardSnapshot;
  loop: SearchLoopRun | null;
  queue: QueueStats;
  generatedAt: Date;
}

interface LeaderboardDetailWire extends LeaderboardEntryPayload {
  strategyVersion: StrategyVersionWire;
  trades: TradeWire[];
  executedAt: string;
}

export interface LeaderboardDetail extends LeaderboardEntryPayload {
  strategyVersion: StrategyVersion;
  trades: Trade[];
  executedAt: Date;
}

export interface LeaderboardListOptions {
  sortBy?: RankingCriterion;
  scope?: LeaderboardScope;
  signal?: AbortSignal;
}

export interface LeaderboardDetailOptions {
  scope?: LeaderboardScope;
  signal?: AbortSignal;
}

export interface StartLoopRequest {
  generatorType: StrategyGeneratorType;
  pair: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  backtestConfig: BacktestConfig;
  maxCandidates?: number;
  maxDurationMs?: number;
  stopOnNoImprovementIterations?: number;
}

export interface LoopCommandResponse {
  loopRunId: string;
  status: LoopStatus;
}

export interface SearchLoopAutomationRequest {
  generatorType: StrategyGeneratorType;
  pair: string;
  timeframe: string;
  backtestWindowDays?: number;
  backtestConfig: BacktestConfig;
  maxCandidatesPerRun?: number | null;
  maxDurationMsPerRun?: number | null;
  stopOnNoImprovementIterations?: number;
  cooldownMs?: number;
}

interface SearchLoopControlWire {
  id: string;
  enabled: boolean;
  generatorType: StrategyGeneratorType;
  pair: string;
  timeframe: string;
  backtestWindowDays: number;
  backtestConfig: BacktestConfig;
  maxCandidatesPerRun: number | null;
  maxDurationMsPerRun: number | null;
  stopOnNoImprovementIterations: number;
  cooldownMs: number;
  failureCount: number;
  nextRunAt: string | null;
  lastStartedRunId: string | null;
  lastError: string | null;
  leaseOwner: string | null;
  leaseUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchLoopControl
  extends Omit<
    SearchLoopControlWire,
    "nextRunAt" | "leaseUntil" | "createdAt" | "updatedAt"
  > {
  nextRunAt: Date | null;
  leaseUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LoopDetailWire extends SearchLoopRunWire {
  candidates: SearchLoopCandidateWire[];
}

export interface LoopDetail extends SearchLoopRun {
  candidates: SearchLoopCandidate[];
}

export interface StrategyCatalogItem {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
}

export interface CreateCompositeStrategyRequest {
  name: string;
  childStrategyNames: string[];
  combinerType: string;
  combinerWeights?: Record<string, number>;
}

export interface UserBacktestRequest {
  strategyName: string;
  pair: string;
  timeframe: string;
  initialCapital: number;
  startDate: string;
  endDate: string;
  commission?: number;
  slippage?: number;
}

export interface UserBacktestJob {
  jobId: string;
  strategyVersionId: string;
  status: string;
}

export interface UserBacktestResult {
  trades?: unknown;
}

function parseLoopRun(raw: SearchLoopRunWire): SearchLoopRun {
  return {
    ...raw,
    startedAt: new Date(raw.startedAt),
    pausedAt: raw.pausedAt === null ? null : new Date(raw.pausedAt),
    stoppedAt: raw.stoppedAt === null ? null : new Date(raw.stoppedAt),
  };
}

function parseLeaderboardSnapshot(
  raw: LeaderboardSnapshotWire,
): LeaderboardSnapshot {
  return { ...raw, updatedAt: new Date(raw.updatedAt) };
}

function parseSearchLoopControl(
  raw: SearchLoopControlWire,
): SearchLoopControl {
  return {
    ...raw,
    nextRunAt: raw.nextRunAt === null ? null : new Date(raw.nextRunAt),
    leaseUntil: raw.leaseUntil === null ? null : new Date(raw.leaseUntil),
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

/** Parse ISO8601 date strings from the backend into Date objects. */
function parseCandle(raw: Candle): Candle {
  return {
    ...raw,
    openTime: new Date(raw.openTime),
    closeTime: new Date(raw.closeTime),
  };
}

export const apiClient = {
  async getStrategies(): Promise<StrategyCatalogItem[]> {
    return apiRequest<StrategyCatalogItem[]>("/api/strategies");
  },

  async createCompositeStrategy(
    input: CreateCompositeStrategyRequest,
  ): Promise<void> {
    await apiRequest("/api/strategies/composite", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async requestUserBacktest(
    input: UserBacktestRequest,
  ): Promise<UserBacktestJob> {
    return apiRequest<UserBacktestJob>("/api/strategies/backtest", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async getUserBacktestResult(jobId: string): Promise<UserBacktestResult> {
    return apiRequest<UserBacktestResult>(
      `/api/strategies/backtest/${encodeURIComponent(jobId)}`,
    );
  },

  async deleteUserStrategy(strategyName: string): Promise<void> {
    await apiRequest(
      `/api/strategies/${encodeURIComponent(strategyName)}`,
      { method: "DELETE" },
    );
  },

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number = 500,
  ): Promise<Candle[]> {
    const params = new URLSearchParams({
      symbol,
      timeframe,
      limit: String(limit),
    });
    const raw = await apiRequest<Candle[]>(
      `/api/market-data/candles?${params}`,
    );
    return raw.map(parseCandle);
  },

  async getPairs(): Promise<TradingPair[]> {
    return apiRequest<TradingPair[]>("/api/market-data/pairs");
  },

  async getSubscriptions(): Promise<Subscription[]> {
    const raw = await apiRequest<Subscription[]>(
      "/api/market-data/subscriptions",
    );
    return raw.map((s) => ({
      ...s,
      subscribedAt: new Date(s.subscribedAt),
    }));
  },

  async subscribe(symbol: string, timeframe: string): Promise<void> {
    await apiRequest("/api/market-data/subscribe", {
      method: "POST",
      body: JSON.stringify({ symbol, timeframe }),
    });
  },

  async unsubscribe(symbol: string, timeframe: string): Promise<void> {
    await apiRequest("/api/market-data/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ symbol, timeframe }),
    });
  },

  async getDashboardSummary(): Promise<DashboardSummary> {
    const raw = await apiRequest<DashboardSummaryWire>(
      "/api/dashboard/summary",
    );
    return {
      ...raw,
      leaderboard: parseLeaderboardSnapshot(raw.leaderboard),
      loop: raw.loop === null ? null : parseLoopRun(raw.loop),
      generatedAt: new Date(raw.generatedAt),
    };
  },

  async getLeaderboard(
    sortByOrOptions?: RankingCriterion | LeaderboardListOptions,
    legacySignal?: AbortSignal,
  ): Promise<LeaderboardSnapshot> {
    const options: LeaderboardListOptions =
      typeof sortByOrOptions === "object" && sortByOrOptions !== null
        ? sortByOrOptions
        : { sortBy: sortByOrOptions, signal: legacySignal };
    const params = new URLSearchParams();
    if (options.sortBy) params.set("sortBy", options.sortBy);
    if (options.scope) params.set("scope", options.scope);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const raw = await apiRequest<LeaderboardSnapshotWire>(
      `/api/leaderboard${suffix}`,
      { signal: options.signal },
    );
    return parseLeaderboardSnapshot(raw);
  },

  async getLeaderboardDetail(
    strategyVersionId: string,
    options: LeaderboardDetailOptions = {},
  ): Promise<LeaderboardDetail> {
    const params = new URLSearchParams();
    if (options.scope) params.set("scope", options.scope);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const raw = await apiRequest<LeaderboardDetailWire>(
      `/api/leaderboard/${encodeURIComponent(strategyVersionId)}${suffix}`,
      options.signal ? { signal: options.signal } : undefined,
    );
    return {
      ...raw,
      strategyVersion: {
        ...raw.strategyVersion,
        createdAt: new Date(raw.strategyVersion.createdAt),
      },
      trades: raw.trades.map((trade) => ({
        ...trade,
        entryDate: new Date(trade.entryDate),
        exitDate: new Date(trade.exitDate),
      })),
      executedAt: new Date(raw.executedAt),
    };
  },

  async startLoop(input: StartLoopRequest): Promise<LoopCommandResponse> {
    return apiRequest<LoopCommandResponse>("/api/loop/start", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async getSearchLoopControl(): Promise<SearchLoopControl> {
    const raw = await apiRequest<SearchLoopControlWire>("/api/loop/control");
    return parseSearchLoopControl(raw);
  },

  async enableSearchLoopAutomation(
    input: SearchLoopAutomationRequest,
  ): Promise<SearchLoopControl> {
    const raw = await apiRequest<SearchLoopControlWire>(
      "/api/loop/control/enable",
      { method: "POST", body: JSON.stringify(input) },
    );
    return parseSearchLoopControl(raw);
  },

  async disableSearchLoopAutomation(): Promise<SearchLoopControl> {
    const raw = await apiRequest<SearchLoopControlWire>(
      "/api/loop/control/disable",
      { method: "POST" },
    );
    return parseSearchLoopControl(raw);
  },

  async configureSearchLoopAutomation(
    input: SearchLoopAutomationRequest,
  ): Promise<SearchLoopControl> {
    const raw = await apiRequest<SearchLoopControlWire>(
      "/api/loop/control/config",
      { method: "PUT", body: JSON.stringify(input) },
    );
    return parseSearchLoopControl(raw);
  },

  async pauseLoop(loopRunId: string): Promise<LoopCommandResponse> {
    return apiRequest<LoopCommandResponse>(
      `/api/loop/${encodeURIComponent(loopRunId)}/pause`,
      { method: "POST" },
    );
  },

  async resumeLoop(loopRunId: string): Promise<LoopCommandResponse> {
    return apiRequest<LoopCommandResponse>(
      `/api/loop/${encodeURIComponent(loopRunId)}/resume`,
      { method: "POST" },
    );
  },

  async stopLoop(loopRunId: string): Promise<LoopCommandResponse> {
    return apiRequest<LoopCommandResponse>(
      `/api/loop/${encodeURIComponent(loopRunId)}/stop`,
      { method: "POST" },
    );
  },

  async getCurrentLoop(): Promise<SearchLoopRun | null> {
    const raw = await apiRequest<SearchLoopRunWire | null>("/api/loop/current");
    return raw === null ? null : parseLoopRun(raw);
  },

  async getLoopDetail(loopRunId: string): Promise<LoopDetail> {
    const raw = await apiRequest<LoopDetailWire>(
      `/api/loop/${encodeURIComponent(loopRunId)}`,
    );
    return {
      ...parseLoopRun(raw),
      candidates: raw.candidates.map((candidate) => ({
        ...candidate,
        createdAt: new Date(candidate.createdAt),
        updatedAt: new Date(candidate.updatedAt),
      })),
    };
  },
};
