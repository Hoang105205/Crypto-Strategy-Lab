// Strategy Engine interfaces — sourced from kb/contracts/strategy.yaml
// Owner: Huy | Status: Active

import { Candle } from '../types/market-data';
import { Signal, Trade, EvaluationMetrics, BacktestConfig, StrategyVersion } from '../types/strategy';
import { StrategyType } from '../types/enums';

export interface IStrategy {
  analyze(candles: Candle[]): Signal;
  getName(): string;
  getType(): StrategyType;
  getParameters(): Record<string, unknown>;
}

export interface IBacktester {
  run(strategy: IStrategy, candles: Candle[], config: BacktestConfig): Trade[];
}

export interface IEvaluator {
  evaluate(trades: Trade[], initialCapital: number): EvaluationMetrics;
}

export interface IStrategyGenerator {
  generate(count: number): IStrategy[];
}

export interface ICombiner {
  combine(signals: Signal[]): Signal;
}
