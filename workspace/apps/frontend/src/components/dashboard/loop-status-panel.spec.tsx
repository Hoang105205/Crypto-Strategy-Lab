import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

type LoopStatus =
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'STOPPED_BY_USER'
  | 'FAILED';

interface LoopRun {
  id: string;
  status: LoopStatus;
  generatorType: 'RANDOM' | 'DOMAIN_GUIDED';
  iteration: number;
  testedCandidates: number;
  maxCandidates: number | null;
  maxDurationMs: number | null;
  stopOnNoImprovementIterations: number;
  currentCandidateStrategyVersionId: string | null;
  bestStrategyVersionId: string | null;
  bestScore: number | null;
  stopReason: string | null;
  startedAt: Date;
  pausedAt: Date | null;
  stoppedAt: Date | null;
}

interface LoopStatusPanelProps {
  loop: LoopRun | null;
  loading?: boolean;
  error?: Error | null;
  isStale?: boolean;
  lastSuccessfulAt?: Date | null;
  isLeaderboardLive: boolean;
  onLeaderboardLiveChange(value: boolean): void;
  onRefresh(): void | Promise<void>;
}

interface LoopStatusPanelModule {
  LoopStatusPanel(props: LoopStatusPanelProps): ReactElement;
}

function run(overrides: Partial<LoopRun> = {}): LoopRun {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'RUNNING',
    generatorType: 'RANDOM',
    iteration: 4,
    testedCandidates: 3,
    maxCandidates: 10,
    maxDurationMs: null,
    stopOnNoImprovementIterations: 50,
    currentCandidateStrategyVersionId: 'version-4',
    bestStrategyVersionId: 'version-3',
    bestScore: 0.72,
    stopReason: null,
    startedAt: new Date('2026-08-16T09:00:00.000Z'),
    pausedAt: null,
    stoppedAt: null,
    ...overrides,
  };
}

async function loadPanel(): Promise<LoopStatusPanelModule> {
  const modulePath = './loop-status-panel';
  return import(/* @vite-ignore */ modulePath) as Promise<LoopStatusPanelModule>;
}

describe('LoopStatusPanel contract', () => {
  it('shows the global loop status and accessible bounded progress', async () => {
    const { LoopStatusPanel } = await loadPanel();
    render(
      <LoopStatusPanel
        loop={run()}
        isLeaderboardLive
        onLeaderboardLiveChange={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('RUNNING');
    expect(screen.getByText(/system-wide search process/i)).toBeInTheDocument();
    expect(screen.getByText(/iteration/i).parentElement).toHaveTextContent('4');
    expect(screen.getByText(/tested candidates/i).parentElement).toHaveTextContent('3');
    expect(
      screen.getByRole('progressbar', { name: /search loop progress/i }),
    ).toHaveAttribute('aria-valuemax', '10');
  });

  it('exposes a labeled keyboard-focusable switch with visible ON and OFF state', async () => {
    const { LoopStatusPanel } = await loadPanel();
    const onLiveChange = vi.fn();
    const { rerender } = render(
      <LoopStatusPanel
        loop={run()}
        isLeaderboardLive
        onLeaderboardLiveChange={onLiveChange}
        onRefresh={vi.fn()}
      />,
    );

    const liveSwitch = screen.getByRole('switch', { name: 'Live updates' });
    expect(liveSwitch).toHaveAttribute('aria-checked', 'true');
    expect(liveSwitch).toHaveAttribute('type', 'button');
    expect(liveSwitch).toHaveTextContent('ON');
    liveSwitch.focus();
    expect(liveSwitch).toHaveFocus();
    fireEvent.click(liveSwitch);
    expect(onLiveChange).toHaveBeenCalledWith(false);

    rerender(
      <LoopStatusPanel
        loop={run()}
        isLeaderboardLive={false}
        onLeaderboardLiveChange={onLiveChange}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByRole('switch', { name: 'Live updates' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('switch', { name: 'Live updates' })).toHaveTextContent(
      'OFF',
    );
    expect(screen.getByText(/system loop keeps running/i)).toBeInTheDocument();
  });

  it('never renders end-user Start, Pause, Resume, or Stop commands', async () => {
    const { LoopStatusPanel } = await loadPanel();
    const { rerender } = render(
      <LoopStatusPanel
        loop={null}
        isLeaderboardLive
        onLeaderboardLiveChange={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    for (const name of [/start/i, /pause/i, /resume/i, /stop/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }

    rerender(
      <LoopStatusPanel
        loop={run({ status: 'PAUSED' })}
        isLeaderboardLive
        onLeaderboardLiveChange={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    for (const name of [/start/i, /pause/i, /resume/i, /stop/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('retains global status and offers only Retry when a refresh fails', async () => {
    const { LoopStatusPanel } = await loadPanel();
    const refresh = vi.fn();
    render(
      <LoopStatusPanel
        loop={run()}
        error={new Error('unavailable')}
        isStale
        lastSuccessfulAt={new Date('2026-08-16T10:00:00.000Z')}
        isLeaderboardLive={false}
        onLeaderboardLiveChange={vi.fn()}
        onRefresh={refresh}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('RUNNING');
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
