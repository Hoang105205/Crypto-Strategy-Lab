// StrategyModule — plugin registry, strategies, composite, backtester, evaluator, search
// Owner: Huy
// See: kb/modules/strategy-engine.md, kb/contracts/strategy.yaml, ADR-0003, ADR-0008

import { Module } from '@nestjs/common';
import { StrategyRegistry } from './registry/strategy.registry';

import {
  MovingAverageStrategy,
  RsiStrategy,
  BollingerBandsStrategy,
  SupportResistanceStrategy,
} from './strategies';

import { CompositeStrategy } from './composite';

@Module({
  providers: [
    StrategyRegistry,
    MovingAverageStrategy,
    RsiStrategy,
    BollingerBandsStrategy,
    SupportResistanceStrategy,
    CompositeStrategy,
  ],
  exports: [StrategyRegistry, CompositeStrategy],
})
export class StrategyModule {}
