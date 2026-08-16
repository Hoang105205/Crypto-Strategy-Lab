import { Injectable } from '@nestjs/common';
import {
  type IStrategyCandidatePort,
  type StrategyCandidateReference,
  StrategyGeneratorType,
} from '@crypto-strategy-lab/shared';
import { SearchEngine } from '../search';
import { StrategyVersioningService } from '../versioning';

export class StrategyCandidateGenerationError extends Error {
  readonly code = 'STRATEGY_GENERATION_FAILED';

  constructor() {
    super('Strategy generator did not produce a candidate');
    this.name = 'StrategyCandidateGenerationError';
  }
}

@Injectable()
export class StrategyCandidatePort implements IStrategyCandidatePort {
  constructor(
    private readonly searchEngine: SearchEngine,
    private readonly versions: StrategyVersioningService,
  ) {}

  async generateCandidate(
    generatorType: StrategyGeneratorType,
  ): Promise<StrategyCandidateReference> {
    const [strategy] = this.searchEngine.generateCandidates(1, generatorType);
    if (!strategy) throw new StrategyCandidateGenerationError();

    const version = await this.versions.createVersion(strategy);
    return {
      strategyVersionId: version.id,
      strategyName: version.name,
    };
  }
}
