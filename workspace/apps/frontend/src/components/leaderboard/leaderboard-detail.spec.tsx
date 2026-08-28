import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { API_BASE_URL } from '../../lib/constants';

vi.mock('../../lib/supabase-client', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  },
}));

interface LeaderboardDetailProps {
  strategyVersionId: string | null;
  sourceScope: 'system' | 'mine' | 'combined';
}

interface LeaderboardDetailModule {
  LeaderboardDetail(props: LeaderboardDetailProps): ReactElement;
}

const strategyVersionId = '11111111-1111-4111-8111-111111111111';

const detailWire = {
  rank: 1,
  strategyVersionId,
  strategyName: 'Momentum v2',
  strategyType: 'RSI',
  isComposite: false,
  backtestResultId: '22222222-2222-4222-8222-222222222222',
  score: 0.81234,
  totalReturn: 12.345,
  winRate: 0.625,
  maxDrawdown: -8.2,
  sharpeRatio: 1.456,
  totalTrades: 1,
  strategyVersion: {
    id: strategyVersionId,
    strategyType: 'RSI',
    name: 'Momentum v2',
    version: 2,
    parameters: { period: 14, oversold: 30 },
    isComposite: false,
    createdAt: '2026-08-10T09:00:00.000Z',
  },
  trades: [
    {
      entryDate: '2026-08-01T10:00:00.000Z',
      exitDate: '2026-08-01T12:00:00.000Z',
      entryPrice: 100,
      exitPrice: 105,
      side: 'LONG',
      pnl: 150.25,
      quantity: 2,
    },
  ],
  executedAt: '2026-08-16T10:00:00.000Z',
};

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function loadDetail(): Promise<LeaderboardDetailModule> {
  const modulePath = './leaderboard-detail';
  return import(/* @vite-ignore */ modulePath) as Promise<LeaderboardDetailModule>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LeaderboardDetail contract', () => {
  it('fetches the exact Strategy Version endpoint and renders immutable version, metrics, and published trades', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, detailWire));
    vi.stubGlobal('fetch', fetchMock);
    const { LeaderboardDetail } = await loadDetail();
    render(<LeaderboardDetail strategyVersionId={strategyVersionId} sourceScope="system" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/leaderboard/${strategyVersionId}?scope=system`,
      expect.objectContaining({ headers: expect.any(Object), signal: expect.any(AbortSignal) }),
    );
    expect(await screen.findByRole('heading', { name: 'Momentum v2' })).toBeInTheDocument();
    expect(screen.getByText(/immutable strategy version/i)).toBeInTheDocument();
    expect(screen.getByText(/version 2/i)).toBeInTheDocument();
    expect(screen.getByText(/period/i).parentElement).toHaveTextContent('14');
    expect(screen.getByText('0.8123')).toBeInTheDocument();
    expect(screen.getByText('+12.35%')).toBeInTheDocument();
    expect(screen.getByText('62.50%')).toBeInTheDocument();
    expect(screen.getByText('-8.20%')).toBeInTheDocument();
    expect(screen.getByText('1.46')).toBeInTheDocument();

    const trades = screen.getByRole('table', { name: /published trades/i });
    expect(within(trades).getByText('LONG')).toBeInTheDocument();
    expect(within(trades).getByText('100.00')).toBeInTheDocument();
    expect(within(trades).getByText('105.00')).toBeInTheDocument();
    expect(within(trades).getByText('+150.25')).toBeInTheDocument();
    expect(within(trades).getByText('2')).toBeInTheDocument();
  });

  it('shows a dimension-preserving accessible loading state while detail is in flight', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
    const { LeaderboardDetail } = await loadDetail();
    render(<LeaderboardDetail strategyVersionId={strategyVersionId} sourceScope="mine" />);

    expect(
      screen.getByRole('status', { name: /loading strategy detail/i }).style.minHeight,
    ).toMatch(/px$/);
    pending.resolve(response(200, detailWire));
    expect(await screen.findByRole('heading', { name: 'Momentum v2' })).toBeInTheDocument();
  });

  it('renders a safe not-found state without leaking the provider response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response(404, {
          code: 'LEADERBOARD_ENTRY_NOT_FOUND',
          error: 'postgres strategy row 111111 missing',
        }),
      ),
    );
    const { LeaderboardDetail } = await loadDetail();
    render(<LeaderboardDetail strategyVersionId={strategyVersionId} sourceScope="mine" />);

    expect(await screen.findByText(/strategy.*not found/i)).toBeInTheDocument();
    expect(screen.queryByText(/postgres|111111 missing/i)).not.toBeInTheDocument();
  });

  it('renders one safe retry for a 503 and retries the same exact detail request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(503, {
          code: 'STRATEGY_ENGINE_UNAVAILABLE',
          error: 'strategy-provider.internal ECONNREFUSED',
        }),
      )
      .mockResolvedValueOnce(response(200, detailWire));
    vi.stubGlobal('fetch', fetchMock);
    const { LeaderboardDetail } = await loadDetail();
    render(<LeaderboardDetail strategyVersionId={strategyVersionId} sourceScope="mine" />);

    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/strategy-provider|ECONNREFUSED/i)).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /retry/i });
    expect(screen.getAllByRole('button', { name: /retry/i })).toHaveLength(1);
    expect(retry.className).toMatch(/focus-visible:/);
    fireEvent.click(retry);

    expect(await screen.findByRole('heading', { name: 'Momentum v2' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `${API_BASE_URL}/api/leaderboard/${strategyVersionId}?scope=mine`,
    );
  });

  it('clears disappearing selection and never commits a delayed response from an old scope', async () => {
    const oldRequest = deferred<Response>();
    const mineWire = {
      ...detailWire,
      strategyName: 'Mine current',
      strategyVersion: { ...detailWire.strategyVersion, name: 'Mine current' },
    };
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(response(200, mineWire));
    vi.stubGlobal('fetch', fetchMock);
    const { LeaderboardDetail } = await loadDetail();
    const { rerender } = render(
      <LeaderboardDetail strategyVersionId={strategyVersionId} sourceScope="system" />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(<LeaderboardDetail strategyVersionId={strategyVersionId} sourceScope="mine" />);
    expect(await screen.findByRole('heading', { name: 'Mine current' })).toBeInTheDocument();
    oldRequest.resolve(response(200, detailWire));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Momentum v2' })).not.toBeInTheDocument());
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_BASE_URL}/api/leaderboard/${strategyVersionId}?scope=system`);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${API_BASE_URL}/api/leaderboard/${strategyVersionId}?scope=mine`);

    rerender(<LeaderboardDetail strategyVersionId={null} sourceScope="mine" />);
    expect(screen.getByText(/select a strategy/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mine current' })).not.toBeInTheDocument();
  });
});
