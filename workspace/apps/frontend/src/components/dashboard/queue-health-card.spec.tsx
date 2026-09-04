import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

interface QueueStats {
  queued: number;
  processing: number;
  completedLast24h: number;
  deadLettered: number;
  delayed: number;
  redisConnected: boolean;
}

interface QueueHealthCardProps {
  stats: QueueStats | null;
  loading?: boolean;
  error?: Error | null;
  isStale?: boolean;
  lastSuccessfulAt?: Date | null;
  onRetry(): void;
}

interface QueueHealthCardModule {
  QueueHealthCard(props: QueueHealthCardProps): ReactElement;
}

const zeroStats: QueueStats = {
  queued: 0,
  processing: 0,
  completedLast24h: 0,
  deadLettered: 0,
  delayed: 0,
  redisConnected: true,
};

async function loadCard(): Promise<QueueHealthCardModule> {
  const modulePath = './queue-health-card';
  return import(/* @vite-ignore */ modulePath) as Promise<QueueHealthCardModule>;
}

describe('QueueHealthCard contract', () => {
  it('renders all six authoritative fields and distinguishes disconnected Redis from healthy zero counts', async () => {
    const { QueueHealthCard } = await loadCard();
    const { rerender } = render(
      <QueueHealthCard stats={zeroStats} onRetry={vi.fn()} />,
    );
    const card = screen.getByRole('region', { name: /queue health/i });
    for (const label of [
      'Queued',
      'Processing',
      'Completed last 24h',
      'Dead-lettered',
      'Delayed',
    ]) {
      expect(within(card).getByText(label).parentElement).toHaveTextContent('0');
    }
    expect(within(card).getByRole('status')).toHaveTextContent(/connected/i);

    rerender(
      <QueueHealthCard
        stats={{ ...zeroStats, redisConnected: false }}
        onRetry={vi.fn()}
      />,
    );
    expect(within(card).getByRole('status')).toHaveTextContent(/disconnected/i);
    expect(within(card).queryByText(/healthy/i)).not.toBeInTheDocument();
  });

  it('preserves loading dimensions and retains last-success data/timestamp through stale error', async () => {
    const { QueueHealthCard } = await loadCard();
    const retry = vi.fn();
    const timestamp = new Date('2026-08-16T10:00:00.000Z');
    const { rerender } = render(
      <QueueHealthCard stats={null} loading onRetry={retry} />,
    );
    expect(
      screen.getByRole('status', { name: /loading queue health/i }).style.minHeight,
    ).toMatch(/px$/);

    rerender(
      <QueueHealthCard
        stats={{ ...zeroStats, queued: 7 }}
        error={new Error('redis://secret.internal connection refused')}
        isStale
        lastSuccessfulAt={timestamp}
        onRetry={retry}
      />,
    );
    expect(screen.getByText('Queued').parentElement).toHaveTextContent('7');
    expect(screen.getByText(/stale|disconnected/i)).toBeInTheDocument();
    expect(screen.getByText(/last updated/i)).toHaveTextContent(timestamp.toLocaleString());
    expect(screen.queryByText(/redis:\/\/|secret\.internal/i)).not.toBeInTheDocument();
    const retryButtons = screen.getAllByRole('button', { name: /retry/i });
    expect(retryButtons).toHaveLength(1);
    expect(retryButtons[0].className).toMatch(/focus-visible:/);
    fireEvent.click(retryButtons[0]);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
