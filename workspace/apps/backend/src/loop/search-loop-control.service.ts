import { Injectable } from '@nestjs/common';
import { LoopStatusService } from './loop-status.service';
import {
  SearchLoopControlRepository,
  type SearchLoopAutomationConfig,
  type SearchLoopControlState,
} from './search-loop-control.repository';
import { SearchLoopSupervisorService } from './search-loop-supervisor.service';
import { StrategyLoopService } from './strategy-loop.service';

@Injectable()
export class SearchLoopControlService {
  constructor(
    private readonly repository: SearchLoopControlRepository,
    private readonly supervisor: SearchLoopSupervisorService,
    private readonly loop: StrategyLoopService,
    private readonly status: LoopStatusService,
  ) {}

  get(): Promise<SearchLoopControlState> {
    return this.repository.get();
  }

  async enable(
    config: SearchLoopAutomationConfig,
  ): Promise<SearchLoopControlState> {
    const now = new Date();
    await this.repository.enable(config, now);
    await this.supervisor.runOnce(now);
    return this.repository.get();
  }

  async configure(
    config: SearchLoopAutomationConfig,
  ): Promise<SearchLoopControlState> {
    return this.repository.configure(config);
  }

  async disable(): Promise<SearchLoopControlState> {
    const disabled = await this.repository.disable();
    const active = await this.status.getCurrent();
    if (active) {
      try {
        await this.loop.stop(active.id);
      } catch (error: unknown) {
        if (!isAlreadyTerminal(error)) throw error;
      }
    }
    return disabled;
  }
}

function isAlreadyTerminal(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === 'LOOP_NOT_FOUND' || code === 'INVALID_LOOP_TRANSITION';
}
