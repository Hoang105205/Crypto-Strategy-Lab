import { StrategyController } from '../strategy.controller';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { StrategyVersioningService } from '../../versioning/strategy-versioning.service';
import { EventBusService } from '../../events/event-bus.service';
import { MovingAverageStrategy } from '../../strategies/moving-average.strategy';
import { RsiStrategy } from '../../strategies/rsi.strategy';
import { CombinerType } from '@crypto-strategy-lab/shared';

describe('StrategyController', () => {
  let controller: StrategyController;
  let registry: StrategyRegistry;
  let versioning: StrategyVersioningService;
  let eventBus: EventBusService;

  beforeEach(() => {
    registry = new StrategyRegistry();
    versioning = new StrategyVersioningService();
    eventBus = new EventBusService();

    // Register basic strategies
    const ma = new MovingAverageStrategy(registry);
    const rsi = new RsiStrategy(registry);
    ma.onModuleInit();
    rsi.onModuleInit();

    controller = new StrategyController(registry, versioning, eventBus);
  });

  it('GET /api/strategies should return all registered strategies', () => {
    const result = controller.getAllStrategies();
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some((s) => s.name === 'MovingAverage')).toBe(true);
  });

  it('POST /api/strategies/composite should register a composite strategy', () => {
    const res = controller.createComposite({
      name: 'TestComposite',
      childStrategyNames: ['MovingAverage', 'RelativeStrengthIndex'],
      combinerType: CombinerType.MAJORITY_VOTE,
    });

    expect(res.strategy.name).toBe('TestComposite');
    expect(registry.get('TestComposite')).toBeDefined();
  });

  it('POST /api/strategies/backtest should emit BacktestRequested event and return QUEUED', (done) => {
    eventBus.onBacktestRequested().subscribe((event) => {
      expect(event.jobId).toBeDefined();
      expect(event.pair).toBe('BTCUSDT');
      done();
    });

    const res = controller.requestBacktest({
      strategyName: 'MovingAverage',
      pair: 'BTCUSDT',
      timeframe: '1h',
      startDate: new Date(),
      endDate: new Date(),
    });

    expect(res.status).toBe('QUEUED');
  });
  it('GET /api/strategies/:id should return a strategy version', () => {
    // Create a composite to generate a version
    const res = controller.createComposite({
      name: 'TestVersionById',
      childStrategyNames: ['MovingAverage'],
      combinerType: CombinerType.MAJORITY_VOTE,
    });
    
    const versionId = res.strategy.versionId;
    const version = controller.getStrategyById(versionId);
    
    expect(version).toBeDefined();
    expect(version.id).toBe(versionId);
    expect(version.name).toBe('TestVersionById');
  });

  it('GET /api/strategies/:name/versions should return an array of versions', () => {
    const versions = controller.getStrategyVersions('MovingAverage');
    // MovingAverage might not have versions if not created via createVersion yet.
    // Let's create one explicitly by requesting a backtest which creates a version.
    controller.requestBacktest({
      strategyName: 'MovingAverage',
      pair: 'BTCUSDT',
      timeframe: '1h',
      startDate: new Date(),
      endDate: new Date(),
    });
    const updatedVersions = controller.getStrategyVersions('MovingAverage');
    expect(Array.isArray(updatedVersions)).toBe(true);
    expect(updatedVersions.length).toBeGreaterThan(0);
    expect(updatedVersions[0].name).toBe('MovingAverage');
  });

  it('GET /api/strategies/backtest/:id should return a mock backtest result', () => {
    const mockId = 'mock_id_123';
    const result = controller.getBacktestResult(mockId);
    
    expect(result).toBeDefined();
    expect(result.id).toBe(mockId);
    expect(result.totalReturn).toBeDefined();
    expect(result.winRate).toBeDefined();
  });
});
