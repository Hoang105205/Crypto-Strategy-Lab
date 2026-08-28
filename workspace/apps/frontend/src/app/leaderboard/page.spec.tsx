import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const useLeaderboardMock = vi.hoisted(() => vi.fn());
const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock('../../hooks/use-leaderboard', () => ({ useLeaderboard: useLeaderboardMock }));
vi.mock('../../contexts/auth-context', () => ({ useAuth: useAuthMock }));
vi.mock('../../components/common/infrastructure-provider', () => ({
  useInfrastructure: () => ({ statusText: 'Connected' }),
}));
vi.mock('../../components/leaderboard/leaderboard-detail', () => ({
  LeaderboardDetail: ({ strategyVersionId, sourceScope }: { strategyVersionId: string | null; sourceScope: string }) => (
    <aside data-testid="shared-detail">Detail {sourceScope}:{strategyVersionId ?? 'none'}</aside>
  ),
}));

function snapshot(name: string, id: string) {
  return {
    rankingCriterion: 'score',
    updatedAt: new Date('2026-08-25T10:00:00.000Z'),
    entries: [{
      rank: 1, strategyVersionId: id, strategyName: name, strategyType: 'RSI', isComposite: false,
      backtestResultId: `${id}-result`, score: 0.9, totalReturn: 14, winRate: 0.6,
      maxDrawdown: -4, sharpeRatio: 1.5, totalTrades: 12,
    }],
  };
}

function projection(scope: 'system' | 'mine', overrides: Record<string, unknown> = {}) {
  return {
    snapshot: snapshot(scope === 'system' ? 'System Alpha' : 'Mine Alpha', `${scope}-id`),
    loading: false, error: null, isStale: false,
    lastSuccessfulAt: new Date('2026-08-25T10:00:00.000Z'),
    refetch: vi.fn().mockResolvedValue(undefined), ...overrides,
  };
}

function leaderboardState(overrides: Record<string, unknown> = {}) {
  return {
    system: projection('system'), mine: projection('mine'), selectedStrategy: null,
    setSelectedStrategy: vi.fn(), sortBy: 'score', setSortBy: vi.fn(), ...overrides,
  };
}

async function loadPage() {
  return (await import('./page')).default;
}

describe('/leaderboard two-box page', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useLeaderboardMock.mockReset();
    useAuthMock.mockReturnValue({ user: { id: 'user-a' }, loading: false });
    useLeaderboardMock.mockReturnValue(leaderboardState());
  });

  it('renders scoped cards from one shared criterion in System -> Mine -> Detail source order', async () => {
    const setSortBy = vi.fn();
    const setSelectedStrategy = vi.fn();
    useLeaderboardMock.mockReturnValue(leaderboardState({ setSortBy, setSelectedStrategy }));
    const Page = await loadPage();
    render(<Page />);

    const systemHeading = screen.getByRole('heading', { name: 'System Leaderboard' });
    const mineHeading = screen.getByRole('heading', { name: 'My Strategies' });
    expect(screen.getByRole('table', { name: 'System leaderboard rankings' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'My strategies rankings' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Ranking criterion')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Ranking criterion'), { target: { value: 'sharpeRatio' } });
    expect(setSortBy).toHaveBeenCalledWith('sharpeRatio');

    fireEvent.click(screen.getByRole('button', { name: /select system alpha/i }));
    expect(setSelectedStrategy).toHaveBeenCalledWith({ strategyVersionId: 'system-id', sourceScope: 'system' });
    fireEvent.click(screen.getByRole('button', { name: /select mine alpha/i }));
    expect(setSelectedStrategy).toHaveBeenCalledWith({ strategyVersionId: 'mine-id', sourceScope: 'mine' });

    const systemCard = systemHeading.closest('section')!;
    const mineCard = mineHeading.closest('section')!;
    const detail = screen.getByTestId('shared-detail');
    expect(systemCard.compareDocumentPosition(mineCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mineCard.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('ranking-column')).toHaveClass('space-y-6');
    expect(screen.getByTestId('leaderboard-workspace')).toHaveClass('lg:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)]');
  });

  it('keeps System public and gives anonymous My Strategies an accessible sign-in state', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    useLeaderboardMock.mockReturnValue(leaderboardState({ mine: projection('mine', { snapshot: null }) }));
    const Page = await loadPage();
    render(<Page />);

    expect(screen.getByRole('table', { name: 'System leaderboard rankings' })).toBeInTheDocument();
    const mine = screen.getByRole('region', { name: 'My Strategies' });
    expect(within(mine).getByText(/sign in to view your strategies/i)).toBeInTheDocument();
    expect(within(mine).getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login?redirect=/leaderboard');
    expect(screen.queryByRole('table', { name: 'My strategies rankings' })).not.toBeInTheDocument();
  });

  it('shows one primary /strategy CTA for authenticated empty Mine without replacing System', async () => {
    useLeaderboardMock.mockReturnValue(leaderboardState({ mine: projection('mine', { snapshot: { ...snapshot('unused', 'unused'), entries: [] } }) }));
    const Page = await loadPage();
    render(<Page />);
    expect(screen.getByRole('table', { name: 'System leaderboard rankings' })).toBeInTheDocument();
    const mine = screen.getByRole('region', { name: 'My Strategies' });
    expect(within(mine).getByText(/no strategies ranked yet/i)).toBeInTheDocument();
    const actions = within(mine).getAllByRole('link');
    expect(actions).toHaveLength(1);
    expect(actions[0]).toHaveAttribute('href', '/strategy');
    expect(actions[0].className).toMatch(/bg-primary/);
  });

  it('renders partial loading, error, retry, and stale states independently per card', async () => {
    const mineRetry = vi.fn().mockResolvedValue(undefined);
    useLeaderboardMock.mockReturnValue(leaderboardState({
      system: projection('system', { isStale: true, error: new Error('offline') }),
      mine: projection('mine', { snapshot: null, error: new Error('private'), refetch: mineRetry }),
    }));
    const Page = await loadPage();
    const { rerender } = render(<Page />);
    expect(screen.getByRole('table', { name: 'System leaderboard rankings' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /system leaderboard is stale/i })).toBeInTheDocument();
    expect(screen.getByRole('alert', { name: /my strategies unavailable/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry my strategies/i }));
    expect(mineRetry).toHaveBeenCalledTimes(1);

    useLeaderboardMock.mockReturnValue(leaderboardState({ mine: projection('mine', { snapshot: null, loading: true }) }));
    rerender(<Page />);
    expect(screen.getByRole('table', { name: 'System leaderboard rankings' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading my strategies/i })).toBeInTheDocument();
  });
});
