// StrategyRegistry — Central registry for managing and looking up IStrategy plugins
// Owner: Huy / Thuan | See: ADR-0003 & kb/contracts/strategy.yaml

import { Injectable, Logger } from '@nestjs/common';
import { Candle, Signal, IStrategy, StrategyType } from '@crypto-strategy-lab/shared';

@Injectable()
export class StrategyRegistry {
  private readonly logger = new Logger(StrategyRegistry.name);
  private readonly strategies = new Map<string, IStrategy>();

  /**
   * Register a new strategy plugin instance into the registry.
   * Throws an Error if a strategy with the same name or composite key already exists.
   */
  register(strategy: IStrategy): void {
    if (!strategy) {
      throw new Error('Strategy instance cannot be null or undefined');
    }

    const key = `${strategy.getType()}:${strategy.getName()}`;
    const name = strategy.getName();

    if (this.strategies.has(key) || this.strategies.has(name)) {
      throw new Error(
        `Strategy collision: strategy '${name}' or key '${key}' is already registered`,
      );
    }

    this.strategies.set(key, strategy);
    this.strategies.set(name, strategy);
    this.logger.log(`Registered strategy plugin: [${key}]`);
  }

  /**
   * Get registered strategy by name or composite key (type:name)
   */
  get(nameOrType: string): IStrategy | undefined {
    return this.strategies.get(nameOrType);
  }

  /**
   * Delegates candle analysis to the registered strategy by name or composite key.
   * Throws an Error if the strategy is not found.
   */
  analyze(nameOrType: string, candles: Candle[]): Signal {
    const strategy = this.get(nameOrType);
    if (!strategy) {
      throw new Error(`Strategy '${nameOrType}' not found in registry`);
    }
    return strategy.analyze(candles);
  }

  /**
   * List all registered strategies (deduplicated)
   */
  getAll(): IStrategy[] {
    const uniqueMap = new Map<string, IStrategy>();
    for (const [_, strat] of this.strategies.entries()) {
      uniqueMap.set(strat.getName(), strat);
    }
    return Array.from(uniqueMap.values());
  }

  /**
   * Check if a strategy type/name is registered
   */
  has(nameOrType: string): boolean {
    return this.strategies.has(nameOrType);
  }

  /**
   * Unregister/delete a strategy by name
   */
  unregister(name: string): boolean {
    const strat = this.strategies.get(name);
    if (!strat) return false;
    const key = `${strat.getType()}:${strat.getName()}`;
    this.strategies.delete(name);
    this.strategies.delete(key);
    this.logger.log(`Unregistered strategy plugin: [${name}]`);
    return true;
  }
}

