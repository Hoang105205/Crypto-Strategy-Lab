import { BacktestSource } from '@crypto-strategy-lab/shared';

export class BacktestRequestedEvent {
  jobId: string;
  strategyVersionId: string;
  pair: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  backtestConfig: {
    initialCapital: number;
    positionSizePercent: number;
    commission?: number;
    slippage?: number;
  };
  source: BacktestSource;
  loopRunId: string | null;
}
