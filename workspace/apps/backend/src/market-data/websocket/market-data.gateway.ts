// MarketDataGateway — socket.io gateway (namespace `market-data`) relaying live candles/status
// Owner: Hoang
// See: kb/contracts/market-data.yaml §websocket, kb/flows/realtime-market-data.md (steps 5–6c)
//
// Channels: `market-data:candles` (events candle:update / candle:close, per-symbol:timeframe rooms)
//           `market-data:status`  (events status:connected / status:disconnected / status:reconnected)

import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Candle } from '@crypto-strategy-lab/shared';
import type { IMarketDataService } from '@crypto-strategy-lab/shared';

import { IMARKET_DATA_SERVICE } from '../../shared/tokens';
import { EXCHANGE_NAME } from '../../shared/constants';
import type {
  IMarketDataGateway,
  MarketDataStreamState,
} from './market-data.gateway.interface';

export type { MarketDataStreamState } from './market-data.gateway.interface';

export function candleRoom(symbol: string, timeframe: string): string {
  return `market-data:candles:${symbol}:${timeframe}`;
}

interface SubscribePayload {
  symbol: string;
  timeframe: string;
}

@WebSocketGateway({ namespace: 'market-data', cors: { origin: true } })
export class MarketDataGateway
  implements OnGatewayConnection, OnGatewayDisconnect, IMarketDataGateway
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MarketDataGateway.name);

  /** Per-client subscribed `symbol:timeframe` keys — used to unsubscribe on disconnect (flow 6c). */
  private readonly clientSubscriptions = new Map<string, Set<string>>();

  constructor(
    @Inject(IMARKET_DATA_SERVICE)
    private readonly service: IMarketDataService,
  ) {}

  handleConnection(client: Socket): void {
    this.clientSubscriptions.set(client.id, new Set());
  }

  handleDisconnect(client: Socket): void {
    const keys = this.clientSubscriptions.get(client.id);
    if (keys) {
      for (const key of keys) {
        const [symbol, timeframe] = key.split(':');
        this.service.unsubscribe(symbol, timeframe);
      }
    }
    this.clientSubscriptions.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Socket-level subscribe: joins the per-symbol:timeframe room AND delegates to
   * MarketDataService.subscribe() (deduplicated — shared with REST subscribe, BR-1).
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload,
  ): { status: string; symbol: string; timeframe: string } {
    const { symbol, timeframe } = payload;
    this.service.subscribe(symbol, timeframe);
    this.clientSubscriptions.get(client.id)?.add(`${symbol}:${timeframe}`);
    void client.join(candleRoom(symbol, timeframe));
    return { status: 'subscribed', symbol, timeframe };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload,
  ): { status: string } {
    const { symbol, timeframe } = payload;
    this.service.unsubscribe(symbol, timeframe);
    this.clientSubscriptions.get(client.id)?.delete(`${symbol}:${timeframe}`);
    void client.leave(candleRoom(symbol, timeframe));
    return { status: 'unsubscribed' };
  }

  /** Called by MarketDataService for every live candle (contract payload shape). */
  emitCandle(symbol: string, timeframe: string, candle: Candle): void {
    if (!this.server) return;
    const event = candle.isClosed ? 'candle:close' : 'candle:update';
    this.server.to(candleRoom(symbol, timeframe)).emit(event, {
      symbol,
      timeframe,
      candle: {
        openTime: candle.openTime,
        closeTime: candle.closeTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        isClosed: candle.isClosed,
      },
    });
  }

  /** Called by MarketDataService on adapter state changes (contract `market-data:status`). */
  emitStatus(state: MarketDataStreamState): void {
    if (!this.server) return;
    this.server.emit(`status:${state}`, {
      connected: state !== 'disconnected',
      exchange: EXCHANGE_NAME,
      lastReconnectAt: state === 'reconnected' ? new Date() : null,
    });
  }
}
