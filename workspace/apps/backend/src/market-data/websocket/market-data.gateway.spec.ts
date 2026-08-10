// MarketDataGateway unit tests — candle relay events/rooms, status broadcast, client lifecycle.
// Server + service are mocked; no real socket.io server is started.

import { Candle } from '@crypto-strategy-lab/shared';

import { MarketDataGateway, candleRoom } from './market-data.gateway';

const makeCandle = (isClosed: boolean): Candle => ({
  symbol: 'BTCUSDT',
  timeframe: '5m',
  openTime: new Date(1754560800000),
  closeTime: new Date(1754561099999),
  open: 118000,
  high: 118200,
  low: 117900,
  close: 118150,
  volume: 125.5,
  isClosed,
});

describe('MarketDataGateway', () => {
  let service: { subscribe: jest.Mock; unsubscribe: jest.Mock };
  let roomEmit: jest.Mock;
  let server: { to: jest.Mock; emit: jest.Mock };
  let gateway: MarketDataGateway;

  beforeEach(() => {
    service = { subscribe: jest.fn(), unsubscribe: jest.fn() };
    roomEmit = jest.fn();
    server = {
      to: jest.fn().mockReturnValue({ emit: roomEmit }),
      emit: jest.fn(),
    };
    gateway = new MarketDataGateway(service as never);
    gateway.server = server as never;
  });

  describe('emitCandle (FR-5)', () => {
    it('emits candle:close to the symbol:timeframe room for closed candles', () => {
      gateway.emitCandle('BTCUSDT', '5m', makeCandle(true));

      expect(server.to).toHaveBeenCalledWith('market-data:candles:BTCUSDT:5m');
      expect(roomEmit).toHaveBeenCalledWith(
        'candle:close',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          timeframe: '5m',
          candle: expect.objectContaining({
            isClosed: true,
            close: 118150,
          }) as unknown,
        }),
      );
    });

    it('emits candle:update for forming candles', () => {
      gateway.emitCandle('BTCUSDT', '5m', makeCandle(false));
      expect(roomEmit).toHaveBeenCalledWith('candle:update', expect.anything());
    });
  });

  describe('emitStatus (market-data:status)', () => {
    it('broadcasts status:reconnected with the contract payload', () => {
      gateway.emitStatus('reconnected');
      expect(server.emit).toHaveBeenCalledWith(
        'status:reconnected',
        expect.objectContaining({
          connected: true,
          exchange: 'binance',
          lastReconnectAt: expect.any(Date) as unknown,
        }),
      );
    });

    it('broadcasts status:disconnected with connected:false', () => {
      gateway.emitStatus('disconnected');
      expect(server.emit).toHaveBeenCalledWith(
        'status:disconnected',
        expect.objectContaining({ connected: false, lastReconnectAt: null }),
      );
    });
  });

  describe('client lifecycle (flow 6c)', () => {
    const fakeClient = () => ({
      id: 'client-1',
      join: jest.fn(),
      leave: jest.fn(),
    });

    it('subscribe joins the candle room and delegates to the service', () => {
      const client = fakeClient();
      gateway.handleConnection(client as never);

      const ack = gateway.handleSubscribe(client as never, {
        symbol: 'BTCUSDT',
        timeframe: '5m',
      });

      expect(service.subscribe).toHaveBeenCalledWith('BTCUSDT', '5m');
      expect(client.join).toHaveBeenCalledWith(candleRoom('BTCUSDT', '5m'));
      expect(ack).toEqual({
        status: 'subscribed',
        symbol: 'BTCUSDT',
        timeframe: '5m',
      });
    });

    it('unsubscribes every stream the client watched on disconnect', () => {
      const client = fakeClient();
      gateway.handleConnection(client as never);
      gateway.handleSubscribe(client as never, {
        symbol: 'BTCUSDT',
        timeframe: '5m',
      });
      gateway.handleSubscribe(client as never, {
        symbol: 'ETHUSDT',
        timeframe: '1h',
      });

      gateway.handleDisconnect(client as never);

      expect(service.unsubscribe).toHaveBeenCalledTimes(2);
      expect(service.unsubscribe).toHaveBeenCalledWith('BTCUSDT', '5m');
      expect(service.unsubscribe).toHaveBeenCalledWith('ETHUSDT', '1h');
    });
  });
});
