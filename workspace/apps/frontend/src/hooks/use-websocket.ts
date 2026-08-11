'use client';

// useWebSocket — manages the socket.io connection lifecycle and exposes
// connection status for the StatusIndicator component.
// Owner: Hoang
// See: sdd_artifacts/market-data-frontend/research.md D6, spec.md FR-7

import { useEffect, useState } from 'react';
import { getSocket } from '../services/socket-client';
import { WS_EVENTS } from '../lib/constants';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface WsStatus {
  status: ConnectionStatus;
  exchange: string | null;
  lastReconnectAt: Date | null;
}

export function useWebSocket(): WsStatus {
  const [wsStatus, setWsStatus] = useState<WsStatus>({
    status: 'disconnected',
    exchange: null,
    lastReconnectAt: null,
  });

  useEffect(() => {
    const socket = getSocket();

    const onConnected = (payload: { exchange?: string }) => {
      setWsStatus({
        status: 'connected',
        exchange: payload.exchange ?? 'binance',
        lastReconnectAt: null,
      });
    };

    const onDisconnected = (payload: { exchange?: string }) => {
      setWsStatus({
        status: 'reconnecting',
        exchange: payload.exchange ?? 'binance',
        lastReconnectAt: null,
      });
    };

    const onReconnected = (payload: {
      exchange?: string;
      lastReconnectAt?: string;
    }) => {
      setWsStatus({
        status: 'connected',
        exchange: payload.exchange ?? 'binance',
        lastReconnectAt: payload.lastReconnectAt
          ? new Date(payload.lastReconnectAt)
          : new Date(),
      });
    };

    socket.on(WS_EVENTS.statusConnected, onConnected);
    socket.on(WS_EVENTS.statusDisconnected, onDisconnected);
    socket.on(WS_EVENTS.statusReconnected, onReconnected);

    return () => {
      socket.off(WS_EVENTS.statusConnected, onConnected);
      socket.off(WS_EVENTS.statusDisconnected, onDisconnected);
      socket.off(WS_EVENTS.statusReconnected, onReconnected);
    };
  }, []);

  return wsStatus;
}
