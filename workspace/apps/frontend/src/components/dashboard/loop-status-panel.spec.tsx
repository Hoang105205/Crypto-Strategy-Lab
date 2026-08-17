import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

type LoopStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED_BY_USER' | 'FAILED';

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

interface StartRequest {
  generatorType: 'RANDOM' | 'DOMAIN_GUIDED';
  pair: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  backtestConfig: { initialCapital: number; positionSizePercent: number };
  maxCandidates?: number;
  maxDurationMs?: number;
  stopOnNoImprovementIterations?: number;
}

interface LoopApi {
  startLoop(input: StartRequest): Promise<unknown>;
  pauseLoop(loopRunId: string): Promise<unknown>;
  resumeLoop(loopRunId: string): Promise<unknown>;
  stopLoop(loopRunId: string): Promise<unknown>;
}

interface LoopStatusPanelProps {
  loop: LoopRun | null;
  loading?: boolean;
  error?: Error | null;
  isStale?: boolean;
  lastSuccessfulAt?: Date | null;
  startRequest: StartRequest;
  api: LoopApi;
  onRefresh(): void | Promise<void>;
}

interface LoopStatusPanelModule {
  LoopStatusPanel(props: LoopStatusPanelProps): ReactElement;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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

const startRequest: StartRequest = {
  generatorType: 'RANDOM',
  pair: 'BTCUSDT',
  timeframe: '1h',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-08-01T00:00:00.000Z',
  backtestConfig: { initialCapital: 10_000, positionSizePercent: 10 },
  maxCandidates: 10,
};

function api(overrides: Partial<LoopApi> = {}): LoopApi {
  return {
    startLoop: vi.fn().mockResolvedValue({ loopRunId: run().id, status: 'RUNNING' }),
    pauseLoop: vi.fn().mockResolvedValue({ loopRunId: run().id, status: 'PAUSED' }),
    resumeLoop: vi.fn().mockResolvedValue({ loopRunId: run().id, status: 'RUNNING' }),
    stopLoop: vi.fn().mockResolvedValue({ loopRunId: run().id, status: 'STOPPED_BY_USER' }),
    ...overrides,
  };
}

async function loadPanel(): Promise<LoopStatusPanelModule> {
  const modulePath = './loop-status-panel';
  return import(/* @vite-ignore */ modulePath) as Promise<LoopStatusPanelModule>;
}

describe('LoopStatusPanel contract', () => {
  it('shows status, iteration, tested/current/best values, and accessible bounded progress', async () => {
    const { LoopStatusPanel } = await loadPanel();
    render(
      <LoopStatusPanel
        loop={run()}
        startRequest={startRequest}
        api={api()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('RUNNING');
    expect(screen.getByText(/iteration/i).parentElement).toHaveTextContent('4');
    expect(screen.getByText(/tested candidates/i).parentElement).toHaveTextContent('3');
    expect(screen.getByText(/current candidate/i).parentElement).toHaveTextContent('version-4');
    expect(screen.getByText(/best score/i).parentElement).toHaveTextContent('0.72');
    expect(screen.getByRole('progressbar', { name: /search loop progress/i })).toHaveAttribute(
      'aria-valuemax',
      '10',
    );
  });

  it('exposes only controls valid for the current state and calls all four typed methods exactly', async () => {
    const { LoopStatusPanel } = await loadPanel();
    const loopApi = api();
    const refresh = vi.fn();
    const { rerender } = render(
      <LoopStatusPanel
        loop={null}
        startRequest={startRequest}
        api={loopApi}
        onRefresh={refresh}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    const start = screen.getByRole('button', { name: /start search loop/i });
    expect(start.className).toMatch(/focus-visible:/);
    fireEvent.click(start);
    await waitFor(() => expect(loopApi.startLoop).toHaveBeenCalledWith(startRequest));

    rerender(
      <LoopStatusPanel
        loop={run()}
        startRequest={startRequest}
        api={loopApi}
        onRefresh={refresh}
      />,
    );
    expect(screen.queryByRole('button', { name: /start|resume/i })).not.toBeInTheDocument();
    const pause = screen.getByRole('button', { name: /pause/i });
    expect(pause.className).toMatch(/focus-visible:/);
    fireEvent.click(pause);
    await waitFor(() => expect(loopApi.pauseLoop).toHaveBeenCalledWith(run().id));
    const stop = screen.getByRole('button', { name: /stop/i });
    expect(stop.className).toMatch(/focus-visible:/);
    fireEvent.click(stop);
    await waitFor(() => expect(loopApi.stopLoop).toHaveBeenCalledWith(run().id));

    rerender(
      <LoopStatusPanel
        loop={run({ status: 'PAUSED', pausedAt: new Date() })}
        startRequest={startRequest}
        api={loopApi}
        onRefresh={refresh}
      />,
    );
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
    const resume = screen.getByRole('button', { name: /resume/i });
    expect(resume.className).toMatch(/focus-visible:/);
    fireEvent.click(resume);
    await waitFor(() => expect(loopApi.resumeLoop).toHaveBeenCalledWith(run().id));
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it('disables controls while a command is pending and prevents double submission', async () => {
    const { LoopStatusPanel } = await loadPanel();
    const pending = deferred<unknown>();
    const loopApi = api({ pauseLoop: vi.fn().mockReturnValue(pending.promise) });
    render(
      <LoopStatusPanel
        loop={run()}
        startRequest={startRequest}
        api={loopApi}
        onRefresh={vi.fn()}
      />,
    );

    const pause = screen.getByRole('button', { name: /pause/i });
    fireEvent.click(pause);
    fireEvent.click(pause);
    expect(loopApi.pauseLoop).toHaveBeenCalledTimes(1);
    expect(pause).toBeDisabled();
    expect(screen.getByRole('button', { name: /stop/i })).toBeDisabled();
    pending.resolve({ loopRunId: run().id, status: 'PAUSED' });
    await waitFor(() => expect(pause).not.toBeDisabled());
  });

  it('updates live values in place and retains timestamp with explicit stale text', async () => {
    const { LoopStatusPanel } = await loadPanel();
    const timestamp = new Date('2026-08-16T10:00:00.000Z');
    const { rerender } = render(
      <LoopStatusPanel
        loop={run()}
        isStale
        lastSuccessfulAt={timestamp}
        startRequest={startRequest}
        api={api()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText(/stale|disconnected|reconnecting/i)).toBeInTheDocument();
    expect(screen.getByText(/last updated/i)).toHaveTextContent(timestamp.toLocaleString());

    rerender(
      <LoopStatusPanel
        loop={run({ iteration: 5, testedCandidates: 4, bestScore: 0.8 })}
        isStale
        lastSuccessfulAt={timestamp}
        startRequest={startRequest}
        api={api()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText(/iteration/i).parentElement).toHaveTextContent('5');
    expect(screen.getByText(/tested candidates/i).parentElement).toHaveTextContent('4');
    expect(screen.getByText(/best score/i).parentElement).toHaveTextContent('0.8');
  });
});
