// Strategy Engine types — sourced from kb/contracts/strategy.yaml
// Owner: Huy | Status: Active

import { StrategyType, SignalAction, CombinerType } from "./enums";

export interface BacktestConfig {
  initialCapital: number;
  positionSizePercent: number;
  commission?: number;
  slippage?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

export interface EvaluationMetrics {
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  totalTrades: number;
}

export interface Signal {
  action: SignalAction;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface StrategyVersion {
  id: string;
  userId?: string | null; // null = system-discovered (shared), non-null = user-created (private). See ADR-0016
  strategyType: StrategyType;
  name: string;
  version: number;
  parameters: Record<string, unknown>;
  parentVersionId?: string;
  isComposite: boolean;
  childVersionIds?: string[];
  combinerType?: CombinerType;
  combinerWeights?: Record<string, number>;
  createdAt: Date;
}

/** Strategy-owned immutable reference returned to search-loop consumers. */
export interface StrategyCandidateReference {
  strategyVersionId: string;
  strategyName: string;
}

export interface Trade {
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  side: string; // "LONG" | "SHORT"
  pnl: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  transactionCost?: number;
  slippage?: number;
  volumeUsd?: number;
}

export interface BacktestResult {
  id: string;
  /** Producer job identity used to make result persistence idempotent. */
  jobId: string;
  userId?: string | null; // null = system backtest, non-null = user-initiated. See ADR-0016
  strategyVersionId: string;
  pair: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  totalTrades: number;
  trades: Trade[];
  executedAt: Date;
  executionTimeMs: number;
}

/** Strategy-owned detail projection used by read-only cross-module consumers. */
export interface BacktestResultDetail extends BacktestResult {
  strategyVersion: StrategyVersion;
}

export interface StrategyExecutionResult<TStrategy = unknown> {
  version: StrategyVersion;
  strategy: TStrategy;
}

export type BacktestResultCreateInput = Omit<BacktestResult, "id">;
