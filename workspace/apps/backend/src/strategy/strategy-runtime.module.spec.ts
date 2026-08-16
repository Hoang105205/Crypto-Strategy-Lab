import { Inject, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  IBacktester,
  IBacktestResultPort,
  IEvaluator,
  IStrategyExecutionPort,
} from '@crypto-strategy-lab/shared';
import { PrismaService } from '../database/prisma.service';
import {
  IBACKTESTER,
  IBACKTEST_RESULT_PORT,
  IEVALUATOR,
  ISTRATEGY_EXECUTION_PORT,
} from '../shared/tokens';
import { StrategyRuntimeModule } from './strategy-runtime.module';

@Injectable()
class WorkerPortConsumer {
  constructor(
    @Inject(IBACKTESTER) readonly backtester: IBacktester,
    @Inject(IEVALUATOR) readonly evaluator: IEvaluator,
    @Inject(ISTRATEGY_EXECUTION_PORT)
    readonly strategyExecution: IStrategyExecutionPort,
    @Inject(IBACKTEST_RESULT_PORT)
    readonly results: IBacktestResultPort,
  ) {}
}

describe('StrategyRuntimeModule', () => {
  it('binds and exports all four Strategy-owned worker ports', async () => {
    const module = await Test.createTestingModule({
      imports: [StrategyRuntimeModule],
      providers: [WorkerPortConsumer],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    await module.init();
    const consumer = module.get(WorkerPortConsumer);
    expect(consumer.backtester).toBeDefined();
    expect(consumer.evaluator).toBeDefined();
    expect(consumer.strategyExecution).toBeDefined();
    expect(consumer.results).toBeDefined();
    await module.close();
  });
});
