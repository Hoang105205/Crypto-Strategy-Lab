import type { IStrategy, StrategyVersion } from '@crypto-strategy-lab/shared';
import {
  CombinerType,
  SignalAction,
  StrategyType,
} from '@crypto-strategy-lab/shared';
import { StrategyRegistry } from '../registry/strategy.registry';
import { StrategyExecutionPort } from './strategy-execution.port';

const baseVersion: StrategyVersion = {
  id: 'version-ma',
  strategyType: StrategyType.MA,
  name: 'MovingAverage',
  version: 1,
  parameters: { period: 14 },
  isComposite: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const executable: IStrategy = {
  analyze: () => ({ action: SignalAction.HOLD }),
  getName: () => 'MovingAverage',
  getType: () => StrategyType.MA,
  getParameters: () => ({ period: 14 }),
};

describe('StrategyExecutionPort', () => {
  it('returns null for an unknown immutable version', async () => {
    const port = createPort({});
    await expect(port.resolveVersion('missing')).resolves.toBeNull();
  });

  it('resolves a base snapshot only when its executable parameters match', async () => {
    const port = createPort({ [baseVersion.id]: baseVersion });
    await expect(port.resolveVersion(baseVersion.id)).resolves.toEqual({
      version: baseVersion,
      strategy: executable,
    });
  });

  it('refuses to run a historical snapshot with unsupported parameters', async () => {
    const changed = { ...baseVersion, parameters: { period: 99 } };
    const port = createPort({ [changed.id]: changed });
    await expect(port.resolveVersion(changed.id)).rejects.toMatchObject({
      code: 'STRATEGY_VERSION_UNSUPPORTED',
    });
  });

  it('reconstructs a composite recursively from immutable children and combiner', async () => {
    const composite: StrategyVersion = {
      id: 'version-composite',
      strategyType: StrategyType.COMPOSITE,
      name: 'CompositeOne',
      version: 1,
      parameters: {},
      isComposite: true,
      childVersionIds: [baseVersion.id],
      combinerType: CombinerType.WEIGHTED_SCORE,
      combinerWeights: { MovingAverage: 2 },
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    const port = createPort({
      [baseVersion.id]: baseVersion,
      [composite.id]: composite,
    });

    const resolved = await port.resolveVersion(composite.id);
    expect(resolved?.version).toBe(composite);
    expect(resolved?.strategy.getName()).toBe('CompositeOne');
    expect(resolved?.strategy.getParameters()).toMatchObject({
      combinerType: CombinerType.WEIGHTED_SCORE,
      weights: { MovingAverage: 2 },
    });
  });
});

function createPort(versions: Record<string, StrategyVersion>) {
  const registry = new StrategyRegistry();
  registry.register(executable);
  return new StrategyExecutionPort(
    { getVersion: jest.fn(async (id: string) => versions[id]) } as never,
    registry,
  );
}
