import { StrategyVersioningService } from '../strategy-versioning.service';
import type { IStrategy } from '@crypto-strategy-lab/shared';
import { StrategyType } from '@crypto-strategy-lab/shared';

describe('StrategyVersioningService', () => {
  let service: StrategyVersioningService;

  beforeEach(() => {
    service = new StrategyVersioningService();
  });

  it('should create and retrieve immutable strategy version snapshot', () => {
    const mockStrategy: jest.Mocked<IStrategy> = {
      getName: jest.fn().mockReturnValue('MyStrategy'),
      getType: jest.fn().mockReturnValue(StrategyType.MA),
      getParameters: jest.fn().mockReturnValue({ period: 14 }),
      analyze: jest.fn(),
    };

    const version = service.createVersion(mockStrategy);
    expect(version.id).toBeDefined();
    expect(version.name).toBe('MyStrategy');
    expect(version.version).toBe(1);

    const retrieved = service.getVersion(version.id);
    expect(retrieved).toEqual(version);
  });
});
