import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  LoopStatus,
  StrategyGeneratorType,
  type SearchLoopRun,
} from '@crypto-strategy-lab/shared';
import { LoopStatusService } from './loop-status.service';
import {
  SearchLoopControlRepository,
  type SearchLoopControlState,
} from './search-loop-control.repository';
import {
  SEARCH_LOOP_SUPERVISOR_LEASE_MS,
  SearchLoopSupervisorService,
  buildRunConfig,
} from './search-loop-supervisor.service';
import { StrategyLoopService } from './strategy-loop.service';

const NOW = new Date('2026-08-28T11:37:42.000Z');
const RUN_ID = '69e1c401-810a-431f-b2d8-d9f732e7f829';

const control = (
  overrides: Partial<SearchLoopControlState> = {},
): SearchLoopControlState => ({
  id: 'system',
  enabled: true,
  generatorType: StrategyGeneratorType.RANDOM,
  pair: 'BTCUSDT',
  timeframe: '1h',
  backtestWindowDays: 180,
  backtestConfig: {
    initialCapital: 10_000,
    positionSizePercent: 100,
  },
  maxCandidatesPerRun: 100,
  maxDurationMsPerRun: null,
  stopOnNoImprovementIterations: 50,
  cooldownMs: 30_000,
  failureCount: 0,
  nextRunAt: NOW,
  lastStartedRunId: null,
  lastError: null,
  leaseOwner: null,
  leaseUntil: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const run = (overrides: Partial<SearchLoopRun> = {}): SearchLoopRun => ({
  id: RUN_ID,
  status: LoopStatus.RUNNING,
  generatorType: StrategyGeneratorType.RANDOM,
  iteration: 1,
  testedCandidates: 0,
  maxCandidates: 100,
  maxDurationMs: null,
  stopOnNoImprovementIterations: 50,
  currentCandidateStrategyVersionId: null,
  bestStrategyVersionId: null,
  bestScore: null,
  stopReason: null,
  startedAt: NOW,
  pausedAt: null,
  stoppedAt: null,
  ...overrides,
});

describe('SearchLoopSupervisorService', () => {
  let controls: jest.Mocked<SearchLoopControlRepository>;
  let loop: jest.Mocked<StrategyLoopService>;
  let status: jest.Mocked<LoopStatusService>;
  let supervisor: SearchLoopSupervisorService;

  beforeEach(() => {
    controls = {
      tryAcquireLease: jest.fn(),
      recordHealthy: jest.fn(),
      renewLease: jest.fn(),
      recordRunStarted: jest.fn(),
      recordFailure: jest.fn(),
      releaseLease: jest.fn(),
    } as unknown as jest.Mocked<SearchLoopControlRepository>;
    loop = {
      start: jest.fn(),
      stop: jest.fn(),
      hasRuntimeContext: jest.fn(),
    } as unknown as jest.Mocked<StrategyLoopService>;
    status = {
      getCurrent: jest.fn(),
      fail: jest.fn(),
    } as unknown as jest.Mocked<LoopStatusService>;
    controls.recordRunStarted.mockResolvedValue(true);
    supervisor = new SearchLoopSupervisorService(controls, loop, status);
  });

  it('does nothing when automation is disabled or another instance owns the lease', async () => {
    controls.tryAcquireLease.mockResolvedValue(null);

    await supervisor.runOnce(NOW);

    expect(status.getCurrent).not.toHaveBeenCalled();
    expect(loop.start).not.toHaveBeenCalled();
  });

  it('starts a bounded run with a rolling window and records lease ownership', async () => {
    controls.tryAcquireLease.mockResolvedValue(control());
    status.getCurrent.mockResolvedValue(null);
    loop.start.mockResolvedValue(run());

    await supervisor.runOnce(NOW);

    expect(loop.start).toHaveBeenCalledWith({
      generatorType: StrategyGeneratorType.RANDOM,
      pair: 'BTCUSDT',
      timeframe: '1h',
      startDate: new Date('2026-03-01T11:00:00.000Z'),
      endDate: new Date('2026-08-28T11:00:00.000Z'),
      backtestConfig: {
        initialCapital: 10_000,
        positionSizePercent: 100,
      },
      maxCandidates: 100,
      maxDurationMs: null,
      stopOnNoImprovementIterations: 50,
    });
    expect(controls.recordRunStarted).toHaveBeenCalledWith(
      expect.any(String),
      RUN_ID,
      new Date(NOW.getTime() + SEARCH_LOOP_SUPERVISOR_LEASE_MS),
      new Date(NOW.getTime() + 30_000),
    );
  });

  it('keeps one healthy active run instead of starting a duplicate', async () => {
    controls.tryAcquireLease.mockResolvedValue(control());
    status.getCurrent.mockResolvedValue(run());
    loop.hasRuntimeContext.mockReturnValue(true);

    await supervisor.runOnce(NOW);

    expect(loop.start).not.toHaveBeenCalled();
    expect(controls.recordHealthy).toHaveBeenCalled();
  });

  it('closes a stale run after restart so the next tick can replace it', async () => {
    controls.tryAcquireLease.mockResolvedValue(control());
    status.getCurrent.mockResolvedValue(run());
    loop.hasRuntimeContext.mockReturnValue(false);
    status.fail.mockResolvedValue(
      run({ status: LoopStatus.FAILED, stopReason: 'orphaned_after_restart' }),
    );

    await supervisor.runOnce(NOW);

    expect(status.fail).toHaveBeenCalledWith(RUN_ID, 'orphaned_after_restart');
    expect(loop.start).not.toHaveBeenCalled();

    controls.tryAcquireLease.mockResolvedValue(
      control({ nextRunAt: new Date(NOW.getTime() + 30_000) }),
    );
    status.getCurrent.mockResolvedValue(null);
    loop.start.mockResolvedValue(run({ id: 'replacement-run' }));
    await supervisor.runOnce(new Date(NOW.getTime() + 30_000));

    expect(loop.start).toHaveBeenCalledTimes(1);
    expect(controls.recordRunStarted).toHaveBeenLastCalledWith(
      expect.any(String),
      'replacement-run',
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('persists exponential retry state when a run cannot start', async () => {
    controls.tryAcquireLease.mockResolvedValue(control({ failureCount: 2 }));
    status.getCurrent.mockResolvedValue(null);
    loop.start.mockRejectedValue(new Error('queue offline'));

    await supervisor.runOnce(NOW);

    expect(controls.recordFailure).toHaveBeenCalledWith(
      expect.any(String),
      'queue offline',
      3,
      expect.any(Date),
      new Date(NOW.getTime() + 120_000),
    );
  });

  it('does not start early while persisted backoff or cooldown is active', async () => {
    controls.tryAcquireLease.mockResolvedValue(
      control({ nextRunAt: new Date(NOW.getTime() + 1_000) }),
    );
    status.getCurrent.mockResolvedValue(null);

    await supervisor.runOnce(NOW);

    expect(loop.start).not.toHaveBeenCalled();
    expect(controls.renewLease).toHaveBeenCalled();
  });

  it('stops a just-created run when automation was disabled concurrently', async () => {
    controls.tryAcquireLease.mockResolvedValue(control());
    status.getCurrent.mockResolvedValue(null);
    loop.start.mockResolvedValue(run());
    controls.recordRunStarted.mockResolvedValue(false);
    loop.stop.mockResolvedValue(run({ status: LoopStatus.STOPPED_BY_USER }));

    await supervisor.runOnce(NOW);

    expect(loop.stop).toHaveBeenCalledWith(RUN_ID);
  });
});

describe('buildRunConfig', () => {
  it('falls back to the exact current time for an unknown timeframe', () => {
    const result = buildRunConfig(control({ timeframe: 'custom' }), NOW);
    expect(result.endDate).toEqual(NOW);
    expect(result.startDate.getTime()).toBeLessThan(result.endDate.getTime());
  });
});
