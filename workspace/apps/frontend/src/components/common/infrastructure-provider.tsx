'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Socket } from 'socket.io-client';
import {
  useInfrastructureSocket,
  type InfrastructureSocketState,
} from '../../hooks/use-infrastructure-socket';
import {
  disconnectInfrastructureSocket,
  getInfrastructureSocket,
} from '../../services/infrastructure-socket';

export interface InfrastructureContextValue
  extends InfrastructureSocketState {
  socket: Socket;
}

const InfrastructureContext = createContext<InfrastructureContextValue | null>(
  null,
);

export function InfrastructureProvider({ children }: { children: ReactNode }) {
  const [socket] = useState<Socket>(() => getInfrastructureSocket());
  const connection = useInfrastructureSocket({ socket });
  const { isStale, status, statusText } = connection;
  const value = useMemo(
    () => ({ socket, isStale, status, statusText }),
    [isStale, socket, status, statusText],
  );

  useEffect(
    () => () => {
      disconnectInfrastructureSocket();
    },
    [],
  );

  return (
    <InfrastructureContext.Provider value={value}>
      {children}
    </InfrastructureContext.Provider>
  );
}

export function useInfrastructure(): InfrastructureContextValue {
  const context = useContext(InfrastructureContext);
  if (context === null) {
    throw new Error('useInfrastructure must be used within InfrastructureProvider');
  }
  return context;
}
