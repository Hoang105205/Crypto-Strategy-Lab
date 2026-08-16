// Strategy Engine types — sourced from kb/contracts/strategy.yaml
// Owner: Huy | Status: Active

import { StrategyType, SignalAction, CombinerType } from './enums';

export interface BacktestConfig {
  initialCapital: number;
  positionSizePercent: number;
  commission?: number;
  slippage?: number;
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

export interface Trade {
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  side: string; // "LONG" | "SHORT"
  pnl: number;
  quantity: number;
}

export interface BacktestResult {
  id: string;
  /** Producer job identity used to make result persistence idempotent. */
  jobId: string;
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

export interface StrategyExecutionResult<TStrategy = unknown> {
  version: StrategyVersion;
  strategy: TStrategy;
}

export type BacktestResultCreateInput = Omit<BacktestResult, 'id'>;
