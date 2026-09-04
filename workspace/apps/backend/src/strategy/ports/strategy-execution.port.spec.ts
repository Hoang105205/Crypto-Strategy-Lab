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

  it('passes the authenticated user through when resolving a private version', async () => {
    const getVersion = jest.fn(async () => baseVersion);
    const port = createPort({}, getVersion);

    await expect(port.resolveVersion(baseVersion.id, 'user-123')).resolves.toEqual({
      version: baseVersion,
      strategy: executable,
    });
    expect(getVersion).toHaveBeenCalledWith(baseVersion.id, 'user-123');
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
    const versions = {
      [baseVersion.id]: baseVersion,
      [composite.id]: composite,
    };
    const getVersion = jest.fn(async (id: string) => versions[id as keyof typeof versions]);
    const port = createPort(versions, getVersion);

    const resolved = await port.resolveVersion(composite.id, 'user-123');
    expect(resolved?.version).toBe(composite);
    expect(resolved?.strategy.getName()).toBe('CompositeOne');
    expect(resolved?.strategy.getParameters()).toMatchObject({
      combinerType: CombinerType.WEIGHTED_SCORE,
      weights: { MovingAverage: 2 },
    });
    expect(getVersion).toHaveBeenNthCalledWith(1, composite.id, 'user-123');
    expect(getVersion).toHaveBeenNthCalledWith(2, baseVersion.id, 'user-123');
  });
});

function createPort(
  versions: Record<string, StrategyVersion>,
  getVersion = jest.fn(async (id: string) => versions[id]),
) {
  const registry = new StrategyRegistry();
  registry.register(executable);
  return new StrategyExecutionPort(
    { getVersion } as never,
    registry,
  );
}
