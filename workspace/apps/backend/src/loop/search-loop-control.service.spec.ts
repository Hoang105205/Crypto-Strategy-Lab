import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LoopStatus, StrategyGeneratorType } from '@crypto-strategy-lab/shared';
import { LoopStatusService } from './loop-status.service';
import {
  SearchLoopControlRepository,
  type SearchLoopControlState,
} from './search-loop-control.repository';
import { SearchLoopControlService } from './search-loop-control.service';
import { SearchLoopSupervisorService } from './search-loop-supervisor.service';
import { StrategyLoopService } from './strategy-loop.service';

const NOW = new Date('2026-08-28T12:00:00.000Z');
const state = (enabled: boolean): SearchLoopControlState => ({
  id: 'system',
  enabled,
  generatorType: StrategyGeneratorType.RANDOM,
  pair: 'BTCUSDT',
  timeframe: '1h',
  backtestWindowDays: 180,
  backtestConfig: { initialCapital: 10_000, positionSizePercent: 100 },
  maxCandidatesPerRun: 100,
  maxDurationMsPerRun: null,
  stopOnNoImprovementIterations: 50,
  cooldownMs: 30_000,
  failureCount: 0,
  nextRunAt: null,
  lastStartedRunId: null,
  lastError: null,
  leaseOwner: null,
  leaseUntil: null,
  createdAt: NOW,
  updatedAt: NOW,
});

describe('SearchLoopControlService', () => {
  let repository: jest.Mocked<SearchLoopControlRepository>;
  let supervisor: jest.Mocked<SearchLoopSupervisorService>;
  let loop: jest.Mocked<StrategyLoopService>;
  let status: jest.Mocked<LoopStatusService>;
  let service: SearchLoopControlService;

  beforeEach(() => {
    repository = {
      get: jest.fn(),
      enable: jest.fn(),
      configure: jest.fn(),
      disable: jest.fn(),
    } as unknown as jest.Mocked<SearchLoopControlRepository>;
    supervisor = {
      runOnce: jest.fn(),
    } as unknown as jest.Mocked<SearchLoopSupervisorService>;
    loop = {
      stop: jest.fn(),
    } as unknown as jest.Mocked<StrategyLoopService>;
    status = {
      getCurrent: jest.fn(),
    } as unknown as jest.Mocked<LoopStatusService>;
    service = new SearchLoopControlService(
      repository,
      supervisor,
      loop,
      status,
    );
  });

  it('persists enable before asking the supervisor to start', async () => {
    const config = state(true);
    repository.enable.mockResolvedValue(config);
    repository.get.mockResolvedValue(config);

    await service.enable(config);

    expect(repository.enable.mock.invocationCallOrder[0]).toBeLessThan(
      supervisor.runOnce.mock.invocationCallOrder[0],
    );
    expect(repository.get).toHaveBeenCalled();
  });

  it('persists disable before stopping the active run', async () => {
    repository.disable.mockResolvedValue(state(false));
    status.getCurrent.mockResolvedValue({
      id: 'active-run',
      status: LoopStatus.RUNNING,
    } as Awaited<ReturnType<LoopStatusService['getCurrent']>>);
    loop.stop.mockResolvedValue({
      id: 'active-run',
      status: LoopStatus.STOPPED_BY_USER,
    } as Awaited<ReturnType<StrategyLoopService['stop']>>);

    const result = await service.disable();

    expect(result.enabled).toBe(false);
    expect(repository.disable.mock.invocationCallOrder[0]).toBeLessThan(
      loop.stop.mock.invocationCallOrder[0],
    );
  });

  it('keeps disable idempotent when the observed run already became terminal', async () => {
    repository.disable.mockResolvedValue(state(false));
    status.getCurrent.mockResolvedValue({
      id: 'racing-run',
      status: LoopStatus.RUNNING,
    } as Awaited<ReturnType<LoopStatusService['getCurrent']>>);
    loop.stop.mockRejectedValue(
      Object.assign(new Error('already terminal'), {
        code: 'INVALID_LOOP_TRANSITION',
      }),
    );

    await expect(service.disable()).resolves.toMatchObject({ enabled: false });
  });
});
