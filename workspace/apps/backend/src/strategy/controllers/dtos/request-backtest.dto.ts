export class RequestBacktestDto {
  strategyName: string;
  pair: string;
  timeframe: string;
  startDate: string | Date;
  endDate: string | Date;
  initialCapital?: number;
  positionSizePercent?: number;
  commission?: number;
  slippage?: number;
}
