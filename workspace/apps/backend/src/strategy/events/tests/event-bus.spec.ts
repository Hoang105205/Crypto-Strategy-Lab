import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BacktestSource,
  EventType,
  type BacktestRequestedPayload,
  type EventEnvelope,
} from '@crypto-strategy-lab/shared';
import { EventBus } from '../../../events/event-bus';

describe('EventBus Strategy contract', () => {
  let service: EventBus;

  beforeEach(() => {
    service = new EventBus(new EventEmitter2());
  });

  it('publishes a BacktestRequested envelope to a Strategy subscriber', () => {
    const handler = jest.fn<
      (
        envelope: EventEnvelope<
          BacktestRequestedPayload,
          typeof EventType.BacktestRequested
        >,
      ) => void
    >();
    const payload: BacktestRequestedPayload = {
      jobId: '7f1379f9-a7c8-48cc-8567-81d5b89096d2',
      strategyVersionId: 'c180dd30-59ff-421a-8640-4b662a55ec29',
      pair: 'BTCUSDT',
      timeframe: '1h',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-02T00:00:00.000Z'),
      backtestConfig: {
        initialCapital: 10_000,
        positionSizePercent: 100,
      },
      source: BacktestSource.USER,
      loopRunId: null,
    };

    service.subscribe<typeof EventType.BacktestRequested>(
      EventType.BacktestRequested,
      handler,
    );
    service.publish(
      EventType.BacktestRequested,
      payload,
      '9ad18923-8df4-4306-9464-24cb23f81074',
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: EventType.BacktestRequested,
        eventVersion: 1,
        correlationId: '9ad18923-8df4-4306-9464-24cb23f81074',
        payload,
      }),
    );
  });
});
