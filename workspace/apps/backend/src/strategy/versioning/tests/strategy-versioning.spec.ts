import { StrategyVersioningService } from '../strategy-versioning.service';
import type { IStrategy } from '@crypto-strategy-lab/shared';
import { StrategyType } from '@crypto-strategy-lab/shared';

// Mock PrismaService
const mockPrisma = {
  strategyVersion: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
};

describe('StrategyVersioningService', () => {
  let service: StrategyVersioningService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StrategyVersioningService(mockPrisma as any);
  });

  it('should create and persist an immutable strategy version snapshot', async () => {
    const mockStrategy: jest.Mocked<IStrategy> = {
      getName: jest.fn().mockReturnValue('MyStrategy'),
      getType: jest.fn().mockReturnValue(StrategyType.MA),
      getParameters: jest.fn().mockReturnValue({ period: 14 }),
      analyze: jest.fn(),
    };

    mockPrisma.strategyVersion.findFirst.mockResolvedValue(null); // no previous version
    mockPrisma.strategyVersion.create.mockResolvedValue({
      id: 'uuid-001',
      strategyType: 'MA',
      name: 'MyStrategy',
      version: 1,
      parameters: { period: 14 },
      parentVersionId: null,
      isComposite: false,
      childVersionIds: [],
      combinerType: null,
      combinerWeights: null,
      createdAt: new Date('2026-08-14'),
    });

    const version = await service.createVersion(mockStrategy);
    expect(version.id).toBe('uuid-001');
    expect(version.name).toBe('MyStrategy');
    expect(version.version).toBe(1);
    expect(version.isComposite).toBe(false);
    expect(mockPrisma.strategyVersion.create).toHaveBeenCalledTimes(1);
  });

  it('should retrieve a version by ID with DB fallback', async () => {
    const dbRecord = {
      id: 'uuid-002',
      strategyType: 'RSI',
      name: 'TestRSI',
      version: 2,
      parameters: { period: 14 },
      parentVersionId: null,
      isComposite: false,
      childVersionIds: [],
      combinerType: null,
      combinerWeights: null,
      createdAt: new Date('2026-08-14'),
    };
    mockPrisma.strategyVersion.findUnique.mockResolvedValue(dbRecord);

    const version = await service.getVersion('uuid-002');
    expect(version).toBeDefined();
    expect(version!.name).toBe('TestRSI');
    expect(mockPrisma.strategyVersion.findUnique).toHaveBeenCalledWith({ where: { id: 'uuid-002' } });
  });

  it('should return undefined for non-existent version', async () => {
    mockPrisma.strategyVersion.findUnique.mockResolvedValue(null);

    const version = await service.getVersion('non-existent');
    expect(version).toBeUndefined();
  });

  it('should retrieve all versions by strategy name', async () => {
    mockPrisma.strategyVersion.findMany.mockResolvedValue([
      { id: 'v1', name: 'MA', version: 1, strategyType: 'MA', parameters: {}, isComposite: false, childVersionIds: [], createdAt: new Date() },
      { id: 'v2', name: 'MA', version: 2, strategyType: 'MA', parameters: {}, isComposite: false, childVersionIds: [], createdAt: new Date() },
    ]);

    const versions = await service.getVersionsByName('MA');
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(1);
    expect(versions[1].version).toBe(2);
  });

  it('should compute monotonic version numbers', async () => {
    const mockStrategy: jest.Mocked<IStrategy> = {
      getName: jest.fn().mockReturnValue('MyStrategy'),
      getType: jest.fn().mockReturnValue(StrategyType.MA),
      getParameters: jest.fn().mockReturnValue({ period: 20 }),
      analyze: jest.fn(),
    };

    // Simulate existing version 3
    mockPrisma.strategyVersion.findFirst.mockResolvedValue({ version: 3 });
    mockPrisma.strategyVersion.create.mockResolvedValue({
      id: 'uuid-003',
      strategyType: 'MA',
      name: 'MyStrategy',
      version: 4,
      parameters: { period: 20 },
      parentVersionId: null,
      isComposite: false,
      childVersionIds: [],
      combinerType: null,
      combinerWeights: null,
      createdAt: new Date(),
    });

    const version = await service.createVersion(mockStrategy);
    expect(version.version).toBe(4);
  });
});
