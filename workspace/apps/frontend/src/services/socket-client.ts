'use client';

// Socket.io client singleton — connection to the /market-data namespace.
// Owner: Hoang
// See: sdd_artifacts/market-data-frontend/research.md D6, contracts/frontend-api.md

import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL, WS_NAMESPACE } from '../lib/constants';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${API_BASE_URL}${WS_NAMESPACE}`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
