// Strategy Engine interfaces — sourced from kb/contracts/strategy.yaml
// Owner: Huy | Status: Active

import { Candle } from "../types/market-data";
import type {
  BacktestConfig,
  BacktestResult,
  BacktestResultDetail,
  BacktestResultCreateInput,
  EvaluationMetrics,
  Signal,
  StrategyCandidateReference,
  StrategyExecutionResult,
  Trade,
} from "../types/strategy";
import { StrategyType } from "../types/enums";
import type { StrategyGeneratorType } from "../types/enums";

export interface IStrategy {
  analyze(candles: Candle[]): Signal;
  analyzeAsync?(candles: Candle[]): Promise<Signal>;
  /** Creates isolated O(1)-per-candle state for a single backtest run. */
  createAnalysisSession?(): IStrategyAnalysisSession;
  getName(): string;
  getType(): StrategyType;
  getParameters(): Record<string, unknown>;
}

export interface IBacktester {
  run(
    strategy: IStrategy,
    candles: Candle[],
    config: BacktestConfig,
  ): Promise<Trade[]>;
}

export interface IEvaluator {
  evaluate(trades: Trade[], initialCapital: number): EvaluationMetrics;
}

export interface IStrategyGenerator {
  generate(count: number): IStrategy[];
}

/**
 * Strategy-owned boundary that selects a generator and materializes its output
 * as a real immutable StrategyVersion before returning control to the caller.
 */
export interface IStrategyCandidatePort {
  generateCandidate(
    generatorType: StrategyGeneratorType,
  ): Promise<StrategyCandidateReference>;
}

export interface IStrategyExecutionPort {
  resolveVersion(
    strategyVersionId: string,
    userId?: string | null,
  ): Promise<StrategyExecutionResult<IStrategy> | null>;
}

export interface IStrategyAnalysisSession {
  next(candle: Candle): Signal | Promise<Signal>;
}

export interface IBacktestResultPort {
  save(input: BacktestResultCreateInput): Promise<BacktestResult>;
  getById(id: string): Promise<BacktestResultDetail | null>;
}

export interface ICombiner {
  combine(signals: Signal[]): Signal;
}
