'use client';

import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getInfrastructureSocket } from '../services/infrastructure-socket';

export type InfrastructureConnectionStatus =
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface InfrastructureSocketState {
  status: InfrastructureConnectionStatus;
  statusText: string;
  isStale: boolean;
}

export interface UseInfrastructureSocketOptions {
  socket?: Socket;
}

const STATUS_TEXT: Record<InfrastructureConnectionStatus, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  disconnected: 'Disconnected',
};

export function useInfrastructureSocket(
  options: UseInfrastructureSocketOptions = {},
): InfrastructureSocketState {
  const socket = options.socket ?? getInfrastructureSocket();
  const [status, setStatus] = useState<InfrastructureConnectionStatus>(() =>
    socket.connected ? 'connected' : 'disconnected',
  );

  useEffect(() => {
    const handleConnect = () => setStatus('connected');
    const handleReconnectAttempt = () => setStatus('reconnecting');
    const handleDisconnect = () => setStatus('disconnected');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
    };
  }, [socket]);

  return {
    status,
    statusText: STATUS_TEXT[status],
    isStale: status !== 'connected',
  };
}
