import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
type Handler = (...args: unknown[]) => void;

interface InfrastructureSocketState {
  status: ConnectionStatus;
  statusText: string;
  isStale: boolean;
}

interface InfrastructureSocketHookModule {
  useInfrastructureSocket(options: {
    socket: FakeSocket;
  }): InfrastructureSocketState;
}

class FakeEmitter {
  private readonly handlers = new Map<string, Set<Handler>>();
  readonly on = vi.fn((event: string, handler: Handler) => {
    const listeners = this.handlers.get(event) ?? new Set<Handler>();
    listeners.add(handler);
    this.handlers.set(event, listeners);
    return this;
  });
  readonly off = vi.fn((event: string, handler: Handler) => {
    this.handlers.get(event)?.delete(handler);
    return this;
  });

  serverEmit(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((handler) => handler(...args));
  }
}

class FakeSocket extends FakeEmitter {
  readonly io = new FakeEmitter();
  readonly removeAllListeners = vi.fn();
}

async function loadHook(): Promise<InfrastructureSocketHookModule> {
  const modulePath = './use-infrastructure-socket';
  return import(/* @vite-ignore */ modulePath) as Promise<InfrastructureSocketHookModule>;
}

describe('useInfrastructureSocket contract', () => {
  it('exposes connected, reconnecting, and disconnected as readable text states', async () => {
    const { useInfrastructureSocket } = await loadHook();
    const socket = new FakeSocket();
    const { result } = renderHook(() => useInfrastructureSocket({ socket }));

    expect(result.current).toMatchObject({
      status: 'disconnected',
      statusText: expect.stringMatching(/disconnected|connection lost/i),
      isStale: true,
    });

    act(() => socket.serverEmit('connect'));
    expect(result.current).toMatchObject({
      status: 'connected',
      statusText: expect.stringMatching(/connected/i),
      isStale: false,
    });

    act(() => socket.io.serverEmit('reconnect_attempt', 1));
    expect(result.current).toMatchObject({
      status: 'reconnecting',
      statusText: expect.stringMatching(/reconnecting/i),
      isStale: true,
    });

    act(() => socket.serverEmit('disconnect', 'transport close'));
    expect(result.current).toMatchObject({
      status: 'disconnected',
      statusText: expect.stringMatching(/disconnected|connection lost/i),
      isStale: true,
    });
  });

  it('removes every listener with the exact registered reference and never removes all listeners', async () => {
    const { useInfrastructureSocket } = await loadHook();
    const socket = new FakeSocket();
    const { unmount } = renderHook(() => useInfrastructureSocket({ socket }));

    const socketRegistrations = socket.on.mock.calls.map(
      ([event, handler]) => [event, handler] as const,
    );
    const managerRegistrations = socket.io.on.mock.calls.map(
      ([event, handler]) => [event, handler] as const,
    );

    unmount();

    for (const [event, handler] of socketRegistrations) {
      expect(socket.off).toHaveBeenCalledWith(event, handler);
    }
    for (const [event, handler] of managerRegistrations) {
      expect(socket.io.off).toHaveBeenCalledWith(event, handler);
    }
    expect(socket.removeAllListeners).not.toHaveBeenCalled();
  });
});
