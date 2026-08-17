'use client';

import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../lib/constants';

const INFRASTRUCTURE_NAMESPACE = '/infrastructure';

let infrastructureSocket: Socket | null = null;

export function getInfrastructureSocket(): Socket {
  if (infrastructureSocket === null) {
    infrastructureSocket = io(`${API_BASE_URL}${INFRASTRUCTURE_NAMESPACE}`, {
      transports: ['websocket'],
      reconnection: true,
    });
  }

  return infrastructureSocket;
}

/** Explicit lifecycle seam used by tests and application teardown. */
export function disconnectInfrastructureSocket(): void {
  if (infrastructureSocket === null) return;

  infrastructureSocket.disconnect();
  infrastructureSocket = null;
}
