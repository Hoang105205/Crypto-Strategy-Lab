import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import {
  IBACKTESTER,
  IBACKTEST_RESULT_PORT,
  IEVALUATOR,
  ISTRATEGY_EXECUTION_PORT,
} from '../shared/tokens';
import { BacktesterService } from './backtester';
import { EvaluatorService } from './evaluator';
import { BacktestResultPort, StrategyExecutionPort } from './ports';
import { StrategyRegistry } from './registry/strategy.registry';
import {
  AtrStrategy,
  BollingerBandsStrategy,
  MacdStrategy,
  MovingAverageStrategy,
  RsiStrategy,
  StochasticStrategy,
  SupportResistanceStrategy,
} from './strategies';
import { StrategyVersioningService } from './versioning';

@Module({
  imports: [DatabaseModule],
  providers: [
    StrategyRegistry,
    MovingAverageStrategy,
    RsiStrategy,
    BollingerBandsStrategy,
    SupportResistanceStrategy,
    MacdStrategy,
    StochasticStrategy,
    AtrStrategy,
    BacktesterService,
    EvaluatorService,
    StrategyVersioningService,
    StrategyExecutionPort,
    BacktestResultPort,
    { provide: IBACKTESTER, useExisting: BacktesterService },
    { provide: IEVALUATOR, useExisting: EvaluatorService },
    { provide: ISTRATEGY_EXECUTION_PORT, useExisting: StrategyExecutionPort },
    { provide: IBACKTEST_RESULT_PORT, useExisting: BacktestResultPort },
  ],
  exports: [
    StrategyRegistry,
    BacktesterService,
    EvaluatorService,
    StrategyVersioningService,
    IBACKTESTER,
    IEVALUATOR,
    ISTRATEGY_EXECUTION_PORT,
    IBACKTEST_RESULT_PORT,
  ],
})
export class StrategyRuntimeModule {}
