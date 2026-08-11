// StrategyRegistry — Central registry for managing and looking up IStrategy plugins
// Owner: Huy / Thuan | See: ADR-0003 & kb/contracts/strategy.yaml

import { Injectable, Logger } from '@nestjs/common';
import { IStrategy, StrategyType } from '@crypto-strategy-lab/shared';

@Injectable()
export class StrategyRegistry {
  private readonly logger = new Logger(StrategyRegistry.name);
  private readonly strategies = new Map<string, IStrategy>();

  /**
   * Register a new strategy plugin instance into the registry
   */
  register(strategy: IStrategy): void {
    const key = `${strategy.getType()}:${strategy.getName()}`;
    this.strategies.set(key, strategy);
    this.strategies.set(strategy.getName(), strategy);
    this.logger.log(`Registered strategy plugin: [${key}]`);
  }

  /**
   * Get registered strategy by name or type
   */
  get(nameOrType: string): IStrategy | undefined {
    return this.strategies.get(nameOrType);
  }

  /**
   * List all registered strategies
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
}
