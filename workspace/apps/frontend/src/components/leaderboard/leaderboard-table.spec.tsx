import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

type RankingCriterion =
  | 'score'
  | 'totalReturn'
  | 'winRate'
  | 'maxDrawdown'
  | 'sharpeRatio';

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

interface Snapshot {
  rankingCriterion: RankingCriterion;
  updatedAt: Date;
  entries: Entry[];
}

interface LeaderboardTableProps {
  snapshot: Snapshot;
  sortBy: RankingCriterion;
  selectedStrategyVersionId: string | null;
  onSortByChange(criterion: RankingCriterion): void;
  onSelectStrategy(strategyVersionId: string): void;
}

interface LeaderboardTableModule {
  LeaderboardTable(props: LeaderboardTableProps): ReactElement;
}

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    rank: 2,
    strategyVersionId: 'version-2',
    strategyName: 'Momentum v2',
    strategyType: 'RSI',
    isComposite: false,
    backtestResultId: 'result-2',
    score: 0.81234,
    totalReturn: 12.345,
    winRate: 0.625,
    maxDrawdown: -8.2,
    sharpeRatio: 1.456,
    totalTrades: 27,
    ...overrides,
  };
}

function snapshot(entries: Entry[]): Snapshot {
  return {
    rankingCriterion: 'score',
    updatedAt: new Date('2026-08-16T10:00:00.000Z'),
    entries,
  };
}

async function loadTable(): Promise<LeaderboardTableModule> {
  const modulePath = './leaderboard-table';
  return import(/* @vite-ignore */ modulePath) as Promise<LeaderboardTableModule>;
}

describe('LeaderboardTable contract', () => {
  it('exposes sortable financial columns with an arrow, aria-sort, and the exact API criterion', async () => {
    const { LeaderboardTable } = await loadTable();
    const onSortByChange = vi.fn();
    render(
      <LeaderboardTable
        snapshot={snapshot([entry()])}
        sortBy="score"
        selectedStrategyVersionId={null}
        onSortByChange={onSortByChange}
        onSelectStrategy={vi.fn()}
      />,
    );

    const scoreHeader = screen.getByRole('columnheader', { name: /score/i });
    expect(scoreHeader).toHaveAttribute('aria-sort', 'descending');
    expect(within(scoreHeader).getByText('↓')).toBeInTheDocument();

    for (const name of ['Return', 'Win Rate', 'Max Drawdown', 'Sharpe']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(name, 'i') })).toHaveAttribute(
        'aria-sort',
        'none',
      );
    }

    const criterionControls: Array<[RegExp, RankingCriterion]> = [
      [/sort by score/i, 'score'],
      [/sort by return/i, 'totalReturn'],
      [/sort by win rate/i, 'winRate'],
      [/sort by max drawdown/i, 'maxDrawdown'],
      [/sort by sharpe/i, 'sharpeRatio'],
    ];
    criterionControls.forEach(([name, criterion], index) => {
      const control = screen.getByRole('button', { name });
      expect(control.className).toMatch(/focus-visible:/);
      fireEvent.click(control);
      expect(onSortByChange).toHaveBeenNthCalledWith(index + 1, criterion);
    });
    expect(onSortByChange).toHaveBeenCalledTimes(criterionControls.length);
  });

  it('formats every required metric and converts normalized winRate to a percentage', async () => {
    const { LeaderboardTable } = await loadTable();
    render(
      <LeaderboardTable
        snapshot={snapshot([entry()])}
        sortBy="score"
        selectedStrategyVersionId="version-2"
        onSortByChange={vi.fn()}
        onSelectStrategy={vi.fn()}
      />,
    );

    const row = screen.getByRole('row', { name: /momentum v2/i });
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(within(row).getByText('#2')).toBeInTheDocument();
    expect(within(row).getByText('0.8123')).toBeInTheDocument();
    const totalReturn = within(row).getByText('+12.35%');
    expect(totalReturn).toHaveAttribute('aria-label', expect.stringMatching(/positive return/i));
    expect(totalReturn.className).toMatch(/trading-up/);
    expect(within(row).getByText('62.50%')).toBeInTheDocument();
    expect(within(row).getByText('-8.20%')).toBeInTheDocument();
    expect(within(row).getByText('1.46')).toBeInTheDocument();
    expect(within(row).getByText('27')).toBeInTheDocument();
  });

  it('keeps every financial column in a horizontally scrollable mobile wrapper', async () => {
    const { LeaderboardTable } = await loadTable();
    render(
      <LeaderboardTable
        snapshot={snapshot([entry()])}
        sortBy="score"
        selectedStrategyVersionId={null}
        onSortByChange={vi.fn()}
        onSelectStrategy={vi.fn()}
      />,
    );

    expect(screen.getByTestId('leaderboard-scroll')).toHaveClass('overflow-x-auto');
    const table = screen.getByRole('table', { name: /strategy leaderboard/i });
    expect(table.className).toMatch(/min-w-/);
    for (const name of [
      'Rank',
      'Strategy',
      'Score',
      'Return',
      'Win Rate',
      'Max Drawdown',
      'Sharpe',
      'Trades',
    ]) {
      expect(within(table).getByRole('columnheader', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
  });

  it('updates realtime Top-K in place while preserving sort and keyboard-accessible selection', async () => {
    const { LeaderboardTable } = await loadTable();
    const onSelectStrategy = vi.fn();
    const { rerender } = render(
      <LeaderboardTable
        snapshot={snapshot([entry({ rank: 1, strategyVersionId: 'version-1', strategyName: 'Trend v1' }), entry()])}
        sortBy="sharpeRatio"
        selectedStrategyVersionId="version-2"
        onSortByChange={vi.fn()}
        onSelectStrategy={onSelectStrategy}
      />,
    );
    const table = screen.getByRole('table', { name: /strategy leaderboard/i });

    rerender(
      <LeaderboardTable
        snapshot={{
          ...snapshot([
            entry({ rank: 1, strategyVersionId: 'version-3', strategyName: 'Composite v3' }),
            entry(),
          ]),
          updatedAt: new Date('2026-08-16T10:01:00.000Z'),
        }}
        sortBy="sharpeRatio"
        selectedStrategyVersionId="version-2"
        onSortByChange={vi.fn()}
        onSelectStrategy={onSelectStrategy}
      />,
    );

    expect(screen.getByRole('table', { name: /strategy leaderboard/i })).toBe(table);
    expect(screen.queryByText('Trend v1')).not.toBeInTheDocument();
    expect(screen.getByText('Composite v3')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /sharpe/i })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    const selectedRow = screen.getByRole('row', { name: /momentum v2/i });
    expect(selectedRow).toHaveAttribute('aria-selected', 'true');
    const selectControl = within(selectedRow).getByRole('button', {
      name: /select momentum v2/i,
    });
    expect(selectControl.className).toMatch(/focus-visible:/);
    fireEvent.click(selectControl);
    expect(onSelectStrategy).toHaveBeenCalledWith('version-2');
  });
});
