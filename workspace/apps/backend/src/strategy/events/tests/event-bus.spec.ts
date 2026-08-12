import { EventBusService } from '../event-bus.service';
import { BacktestRequestedEvent } from '../backtest-requested.event';

describe('EventBusService', () => {
  let service: EventBusService;

  beforeEach(() => {
    service = new EventBusService();
  });

  it('should emit and observe BacktestRequestedEvent', (done) => {
    const mockEvent: BacktestRequestedEvent = {
      jobId: 'job_123',
      strategyVersionId: 'ver_123',
      pair: 'BTCUSDT',
      timeframe: '1h',
      startDate: new Date(),
      endDate: new Date(),
      initialCapital: 10000,
      positionSizePercent: 100,
      executedAt: new Date(),
    };

    service.onBacktestRequested().subscribe((event) => {
      expect(event.jobId).toBe('job_123');
      expect(event.pair).toBe('BTCUSDT');
      done();
    });

    service.emitBacktestRequested(mockEvent);
  });
});
