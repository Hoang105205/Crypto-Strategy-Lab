export class BacktestRequestedEvent {
  jobId: string;
  strategyVersionId: string;
  pair: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  positionSizePercent: number;
  executedAt: Date;
}
