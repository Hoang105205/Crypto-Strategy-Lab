// Market Data interfaces — sourced from kb/contracts/market-data.yaml
// Owner: Hoang | Status: Active

import { Candle } from '../types/market-data';

export interface IMarketDataAdapter {
  fetchKlines(
    symbol: string,
    timeframe: string,
    options: { startTime?: Date; endTime?: Date; limit?: number },
  ): Promise<Candle[]>;
  connectStream(symbol: string, timeframe: string): void;
  disconnectStream(symbol: string, timeframe: string): void;
  onCandle(callback: (candle: Candle) => void): void;
  onDisconnect(callback: () => void): void;
  onReconnect(callback: () => void): void;
}

export interface IMarketDataService {
  getCandles(symbol: string, timeframe: string, limit?: number): Promise<Candle[]>;
  getCandlesRange(
    symbol: string,
    timeframe: string,
    startTime: Date,
    endTime: Date,
  ): Promise<Candle[]>;
  subscribe(symbol: string, timeframe: string): void;
  unsubscribe(symbol: string, timeframe: string): void;
}
