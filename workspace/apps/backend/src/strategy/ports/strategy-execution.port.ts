import { Injectable } from '@nestjs/common';
import type {
  IStrategy,
  IStrategyExecutionPort,
  StrategyExecutionResult,
  StrategyVersion,
} from '@crypto-strategy-lab/shared';
import { CombinerType, StrategyType } from '@crypto-strategy-lab/shared';
import { MajorityVoteCombiner } from '../combiners/majority-vote.combiner';
import { WeightedScoreCombiner } from '../combiners/weighted-score.combiner';
import { CompositeStrategy } from '../composite/composite.strategy';
import { StrategyRegistry } from '../registry/strategy.registry';
import { StrategyVersioningService } from '../versioning';
import { StrategyPortError } from './strategy-port.error';

@Injectable()
export class StrategyExecutionPort implements IStrategyExecutionPort {
  constructor(
    private readonly versions: StrategyVersioningService,
    private readonly registry: StrategyRegistry,
  ) {}

  async resolveVersion(
    strategyVersionId: string,
  ): Promise<StrategyExecutionResult<IStrategy> | null> {
    return this.resolve(strategyVersionId, new Set<string>());
  }

  private async resolve(
    id: string,
    ancestors: Set<string>,
  ): Promise<StrategyExecutionResult<IStrategy> | null> {
    const version = await this.versions.getVersion(id);
    if (!version) return null;

    if (ancestors.has(id)) {
      throw this.unsupported(version, 'contains a cyclic child-version graph');
    }

    if (!version.isComposite) {
      return { version, strategy: this.resolveRegistered(version) };
    }

    const nextAncestors = new Set(ancestors).add(id);
    const children: IStrategy[] = [];
    for (const childId of version.childVersionIds ?? []) {
      const child = await this.resolve(childId, nextAncestors);
      if (!child) {
        throw this.unsupported(version, `references missing child version '${childId}'`);
      }
      children.push(child.strategy);
    }

    if (children.length === 0) {
      throw this.unsupported(version, 'has no executable child versions');
    }

    const combiner =
      version.combinerType === CombinerType.WEIGHTED_SCORE
        ? new WeightedScoreCombiner(version.combinerWeights ?? {})
        : version.combinerType === CombinerType.MAJORITY_VOTE
          ? new MajorityVoteCombiner()
          : null;
    if (!combiner) {
      throw this.unsupported(version, `uses unknown combiner '${version.combinerType}'`);
    }

    return {
      version,
      strategy: new CompositeStrategy(version.name, children, combiner),
    };
  }

  private resolveRegistered(version: StrategyVersion): IStrategy {
    if (version.strategyType === StrategyType.COMPOSITE) {
      throw this.unsupported(version, 'is marked non-composite with Composite type');
    }

    const strategy =
      this.registry.get(`${version.strategyType}:${version.name}`) ??
      this.registry.get(version.name);
    if (!strategy || strategy.getType() !== version.strategyType) {
      throw this.unsupported(version, 'has no registered executable plugin');
    }

    if (canonical(strategy.getParameters()) !== canonical(version.parameters)) {
      throw this.unsupported(
        version,
        'parameters do not match the registered immutable plugin',
      );
    }
    return strategy;
  }

  private unsupported(version: StrategyVersion, reason: string): StrategyPortError {
    return new StrategyPortError(
      'STRATEGY_VERSION_UNSUPPORTED',
      `StrategyVersion '${version.id}' ${reason}`,
    );
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
