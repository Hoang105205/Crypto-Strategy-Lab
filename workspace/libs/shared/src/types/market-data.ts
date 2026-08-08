// Market Data types — sourced from kb/contracts/market-data.yaml
// Owner: Hoang | Status: Active

export interface Candle {
  symbol: string;
  timeframe: string;
  openTime: Date;
  closeTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  isActive: boolean;
}

export interface Subscription {
  symbol: string;
  timeframe: string;
  subscribedAt: Date;
  subscriberCount: number;
}
