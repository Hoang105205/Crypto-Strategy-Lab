import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  SignalAction,
  StrategyGeneratorType,
  StrategyType,
  type IStrategy,
  type StrategyVersion,
} from '@crypto-strategy-lab/shared';
import { StrategyCandidatePort } from './strategy-candidate.port';

const generated: IStrategy = {
  analyze: () => ({ action: SignalAction.HOLD }),
  getName: () => 'GeneratedCandidate',
  getType: () => StrategyType.MA,
  getParameters: () => ({ period: 20 }),
};

const version: StrategyVersion = {
  id: '69e1c401-810a-431f-b2d8-d9f732e7f829',
  strategyType: StrategyType.MA,
  name: 'GeneratedCandidate',
  version: 1,
  parameters: { period: 20 },
  isComposite: false,
  createdAt: new Date('2026-08-16T03:00:00.000Z'),
};

describe('StrategyCandidatePort', () => {
  let searchEngine: {
    generateCandidates: jest.Mock<
      (count: number, type: StrategyGeneratorType) => IStrategy[]
    >;
  };
  let versions: {
    createVersion: jest.Mock<(strategy: IStrategy) => Promise<StrategyVersion>>;
  };
  let port: StrategyCandidatePort;

  beforeEach(() => {
    searchEngine = {
      generateCandidates: jest.fn<
        (count: number, type: StrategyGeneratorType) => IStrategy[]
      >(() => [generated]),
    };
    versions = {
      createVersion: jest.fn<(strategy: IStrategy) => Promise<StrategyVersion>>(
        () => Promise.resolve(version),
      ),
    };
    port = new StrategyCandidatePort(searchEngine as never, versions as never);
  });

  it.each([StrategyGeneratorType.RANDOM, StrategyGeneratorType.DOMAIN_GUIDED])(
    'selects %s and returns the persisted immutable reference',
    async (type) => {
      await expect(port.generateCandidate(type)).resolves.toEqual({
        strategyVersionId: version.id,
        strategyName: version.name,
      });
      expect(searchEngine.generateCandidates).toHaveBeenCalledWith(1, type);
      expect(versions.createVersion).toHaveBeenCalledWith(generated);
    },
  );

  it('fails without inventing an ID when generation returns no candidate', async () => {
    searchEngine.generateCandidates.mockReturnValue([]);

    await expect(
      port.generateCandidate(StrategyGeneratorType.RANDOM),
    ).rejects.toMatchObject({ code: 'STRATEGY_GENERATION_FAILED' });
    expect(versions.createVersion).not.toHaveBeenCalled();
  });
});
