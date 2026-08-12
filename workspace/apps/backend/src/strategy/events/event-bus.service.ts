import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { BacktestRequestedEvent } from './backtest-requested.event';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly backtestRequested$ = new Subject<BacktestRequestedEvent>();

  emitBacktestRequested(event: BacktestRequestedEvent): void {
    this.logger.log(`[EventBus] Emitting BacktestRequestedEvent: Job ${event.jobId} for Version ${event.strategyVersionId}`);
    this.backtestRequested$.next(event);
  }

  onBacktestRequested(): Observable<BacktestRequestedEvent> {
    return this.backtestRequested$.asObservable();
  }
}
