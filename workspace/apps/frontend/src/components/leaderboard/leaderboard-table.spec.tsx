import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

type RankingCriterion = 'score' | 'totalReturn' | 'winRate' | 'maxDrawdown' | 'sharpeRatio';
type LeaderboardScope = 'system' | 'mine';

interface Entry {
  rank: number;
  strategyVersionId: string;
  strategyName: string;
  strategyType: string;
  isComposite: boolean;
  backtestResultId: string;
  score: number;
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
}

interface Snapshot { rankingCriterion: RankingCriterion; updatedAt: Date; entries: Entry[] }
interface ProjectionState {
  snapshot: Snapshot | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  lastSuccessfulAt: Date | null;
  refetch(): Promise<void>;
}
interface LeaderboardTableProps {
  heading: string;
  description: string;
  headingId: string;
  tableName: string;
  sourceScope: LeaderboardScope;
  projection: ProjectionState;
  sortBy: RankingCriterion;
  selectedStrategyVersionId: string | null;
  onSortByChange(criterion: RankingCriterion): void;
  onSelectStrategy(strategyVersionId: string, sourceScope: LeaderboardScope): void;
  emptyState: ReactNode;
}
interface LeaderboardTableModule { LeaderboardTable(props: LeaderboardTableProps): ReactElement }

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    rank: 2, strategyVersionId: 'version-2', strategyName: 'Momentum v2', strategyType: 'RSI',
    isComposite: false, backtestResultId: 'result-2', score: 0.81234, totalReturn: 12.345,
    winRate: 0.625, maxDrawdown: -8.2, sharpeRatio: 1.456, totalTrades: 27, ...overrides,
  };
}
function snapshot(entries: Entry[]): Snapshot {
  return { rankingCriterion: 'score', updatedAt: new Date('2026-08-16T10:00:00.000Z'), entries };
}
function projection(overrides: Partial<ProjectionState> = {}): ProjectionState {
  return {
    snapshot: snapshot([entry()]), loading: false, error: null, isStale: false,
    lastSuccessfulAt: new Date('2026-08-16T10:00:00.000Z'), refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
function props(overrides: Partial<LeaderboardTableProps> = {}): LeaderboardTableProps {
  return {
    heading: 'System Leaderboard', description: 'Strategies published by the global Search Loop.',
    headingId: 'system-leaderboard-heading', tableName: 'System leaderboard rankings', sourceScope: 'system',
    projection: projection(), sortBy: 'score', selectedStrategyVersionId: null,
    onSortByChange: vi.fn(), onSelectStrategy: vi.fn(),
    emptyState: <p>No system strategies are ranked.</p>, ...overrides,
  };
}
async function loadTable(): Promise<LeaderboardTableModule> {
  return import('./leaderboard-table') as Promise<LeaderboardTableModule>;
}

describe('LeaderboardTable scoped card contract', () => {
  it('uses supplied accessible identity and forwards keyboard sort/selection with source scope', async () => {
    const { LeaderboardTable } = await loadTable();
    const onSortByChange = vi.fn();
    const onSelectStrategy = vi.fn();
    render(<LeaderboardTable {...props({ onSortByChange, onSelectStrategy })} />);
    expect(screen.getByRole('heading', { name: 'System Leaderboard' })).toHaveAttribute('id', 'system-leaderboard-heading');
    expect(screen.getByText(/global Search Loop/i)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'System leaderboard rankings' });
    expect(within(table).getByRole('columnheader', { name: /score/i })).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(within(table).getByRole('button', { name: /sort by sharpe/i }));
    expect(onSortByChange).toHaveBeenCalledWith('sharpeRatio');
    const select = within(table).getByRole('button', { name: /select momentum v2/i });
    expect(select.className).toMatch(/focus-visible:/);
    fireEvent.click(select);
    expect(onSelectStrategy).toHaveBeenCalledWith('version-2', 'system');
  });

  it('renders independent loading, initial error with retry, empty, and stale-with-data states', async () => {
    const { LeaderboardTable } = await loadTable();
    const retry = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<LeaderboardTable {...props({ projection: projection({ snapshot: null, loading: true }) })} />);
    expect(screen.getByRole('status', { name: /loading system leaderboard/i })).toBeInTheDocument();
    rerender(<LeaderboardTable {...props({ projection: projection({ snapshot: null, loading: false, error: new Error('secret'), refetch: retry }) })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/temporarily unavailable/i);
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry system leaderboard/i }));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<LeaderboardTable {...props({ projection: projection({ snapshot: snapshot([]) }) })} />);
    expect(screen.getByText(/no system strategies are ranked/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    rerender(<LeaderboardTable {...props({ projection: projection({ isStale: true, error: new Error('offline'), refetch: retry }) })} />);
    expect(screen.getByRole('status', { name: /system leaderboard is stale/i })).toHaveTextContent(/last successful/i);
    expect(screen.getByRole('table', { name: 'System leaderboard rankings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry system leaderboard/i })).not.toBeInTheDocument();
  });

  it('retains every financial column and gives this card its own named horizontal scroll region', async () => {
    const { LeaderboardTable } = await loadTable();
    render(<LeaderboardTable {...props()} />);
    const scroll = screen.getByRole('region', { name: /scroll system leaderboard rankings/i });
    expect(scroll).toHaveClass('overflow-x-auto');
    expect(scroll).toHaveAttribute('tabindex', '0');
    const table = screen.getByRole('table', { name: 'System leaderboard rankings' });
    for (const name of ['Rank', 'Strategy', 'Score', 'Return', 'Win Rate', 'Max Drawdown', 'Sharpe', 'Trades']) {
      expect(within(table).getByRole('columnheader', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
    const row = within(table).getByRole('row', { name: /momentum v2/i });
    expect(within(row).getByText('0.8123')).toBeInTheDocument();
    expect(within(row).getByText('+12.35%')).toHaveAttribute('aria-label', expect.stringMatching(/positive return/i));
    expect(within(row).getByText('62.50%')).toBeInTheDocument();
    expect(within(row).getByText('-8.20%')).toBeInTheDocument();
    expect(within(row).getByText('1.46')).toBeInTheDocument();
    expect(within(row).getByText('27')).toBeInTheDocument();
  });
});
