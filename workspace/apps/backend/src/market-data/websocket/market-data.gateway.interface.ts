// IMarketDataGateway — the relay surface MarketDataService uses to push live
// candles and stream-status changes to socket.io clients.
// Owner: Hoang
// See: kb/contracts/market-data.yaml §websocket
//
// Exists as an interface (+ the IMARKET_DATA_GATEWAY DI token) so the service
// and the gateway depend only on this contract — never on each other's class —
// which keeps the module free of circular imports.

import type { Candle } from '@crypto-strategy-lab/shared';

export type MarketDataStreamState =
  'connected' | 'disconnected' | 'reconnected';

export interface IMarketDataGateway {
  emitCandle(symbol: string, timeframe: string, candle: Candle): void;
  emitStatus(state: MarketDataStreamState): void;
}
