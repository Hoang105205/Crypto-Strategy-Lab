import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api-client';

const socketIoMock = vi.hoisted(() => vi.fn());

vi.mock('socket.io-client', () => ({
  io: socketIoMock,
}));

interface StableApiError extends Error {
  status: number;
  code: string;
}

interface InfrastructureApiContract {
  getDashboardSummary(): Promise<{
    generatedAt: Date;
    leaderboard: { updatedAt: Date };
  }>;
}

interface InfrastructureSocketModule {
  getInfrastructureSocket(): FakeClientSocket;
  disconnectInfrastructureSocket(): void;
}

class FakeClientSocket {
  readonly disconnect = vi.fn();
}

const dashboardWireFixture = {
  leaderboard: {
    rankingCriterion: 'score',
    updatedAt: '2026-08-16T10:00:00.000Z',
    entries: [],
  },
  loop: null,
  queue: {
    queued: 1,
    processing: 2,
    completedLast24h: 3,
    deadLettered: 4,
    delayed: 5,
    redisConnected: true,
  },
  generatedAt: '2026-08-16T10:00:01.000Z',
};

function apiContract(): InfrastructureApiContract {
  return apiClient as typeof apiClient & InfrastructureApiContract;
}

async function loadInfrastructureSocket(): Promise<InfrastructureSocketModule> {
  const modulePath = './infrastructure-socket';
  return import(/* @vite-ignore */ modulePath) as Promise<InfrastructureSocketModule>;
}

describe('infrastructure REST contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns a typed Dashboard snapshot and parses contract timestamps', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(dashboardWireFixture), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiContract().getDashboardSummary();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/dashboard/summary',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    expect(result.generatedAt).toEqual(
      new Date('2026-08-16T10:00:01.000Z'),
    );
    expect(result.leaderboard.updatedAt).toEqual(
      new Date('2026-08-16T10:00:00.000Z'),
    );
  });

  it('preserves stable error status, code, and public message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'Queue service is unavailable',
            code: 'QUEUE_UNAVAILABLE',
          }),
          { status: 503 },
        ),
      ),
    );

    const error = await apiContract()
      .getDashboardSummary()
      .catch((reason: unknown) => reason as StableApiError);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      status: 503,
      code: 'QUEUE_UNAVAILABLE',
      message: 'Queue service is unavailable',
    });
  });
});

describe('infrastructure Socket.IO singleton contract', () => {
  beforeEach(() => {
    vi.resetModules();
    socketIoMock.mockReset();
  });

  it('is lazy, connects once to /infrastructure, and never selects /market-data', async () => {
    const fakeSocket = new FakeClientSocket();
    socketIoMock.mockReturnValue(fakeSocket);

    const infrastructureSocket = await loadInfrastructureSocket();

    expect(socketIoMock).not.toHaveBeenCalled();

    const first = infrastructureSocket.getInfrastructureSocket();
    const second = infrastructureSocket.getInfrastructureSocket();

    expect(first).toBe(fakeSocket);
    expect(second).toBe(first);
    expect(socketIoMock).toHaveBeenCalledTimes(1);
    expect(socketIoMock).toHaveBeenCalledWith(
      'http://localhost:3001/infrastructure',
      expect.objectContaining({
        transports: ['websocket'],
        reconnection: true,
      }),
    );
    expect(socketIoMock.mock.calls[0]?.[0]).not.toContain('/market-data');
  });

  it('disconnects and clears the singleton idempotently', async () => {
    const firstSocket = new FakeClientSocket();
    const secondSocket = new FakeClientSocket();
    socketIoMock
      .mockReturnValueOnce(firstSocket)
      .mockReturnValueOnce(secondSocket);
    const infrastructureSocket = await loadInfrastructureSocket();

    expect(infrastructureSocket.getInfrastructureSocket()).toBe(firstSocket);
    infrastructureSocket.disconnectInfrastructureSocket();
    infrastructureSocket.disconnectInfrastructureSocket();

    expect(firstSocket.disconnect).toHaveBeenCalledTimes(1);
    expect(infrastructureSocket.getInfrastructureSocket()).toBe(secondSocket);
    expect(socketIoMock).toHaveBeenCalledTimes(2);
  });
});
