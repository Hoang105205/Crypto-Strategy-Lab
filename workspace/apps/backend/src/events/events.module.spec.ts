import { Logger } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import {
  EventType,
  type BacktestFailedPayload,
  type EventEnvelope,
  type EventPayloadMap,
  type EventSubscription,
  type EventTypeValue,
  type IEventBus,
} from '@crypto-strategy-lab/shared';

import { IEVENT_BUS } from '../shared/tokens';
import { EventsModule } from './events.module';

const CORRELATION_ID = '2660f14b-c12a-4cc1-a33f-a6e48b51ac9a';
const JOB_ID = 'b8257d6b-d9df-47fb-83c1-839b04335e6f';
const STRATEGY_VERSION_ID = '69e1c401-810a-431f-b2d8-d9f732e7f829';

const failedPayload: BacktestFailedPayload = {
  jobId: JOB_ID,
  correlationId: CORRELATION_ID,
  loopRunId: null,
  strategyVersionId: STRATEGY_VERSION_ID,
  error: 'terminal failure',
  attempt: 3,
};

class AlternativeEventBus implements IEventBus {
  readonly publishedEventTypes: EventTypeValue[] = [];

  publish<TEventType extends EventTypeValue>(
    eventType: TEventType,
    _payload: EventPayloadMap[TEventType],
    _correlationId?: string,
  ): void {
    this.publishedEventTypes.push(eventType);
  }

  subscribe<TEventType extends EventTypeValue>(
    _eventType: TEventType,
    _handler: (
      envelope: EventEnvelope<EventPayloadMap[TEventType], TEventType>,
    ) => void | Promise<void>,
  ): EventSubscription {
    return () => undefined;
  }

  unsubscribe(subscription: EventSubscription): void {
    subscription();
  }
}

const createModule = () =>
  Test.createTestingModule({
    imports: [EventEmitterModule.forRoot(), EventsModule],
  }).compile();

describe('EventsModule public IEventBus seam', () => {
  it('boots and resolves IEVENT_BUS', async () => {
    const moduleRef = await createModule();

    try {
      await moduleRef.init();
      const eventBus = moduleRef.get<IEventBus>(IEVENT_BUS);
      expect(eventBus).toBeDefined();
      expect(typeof eventBus.publish).toBe('function');
      expect(typeof eventBus.subscribe).toBe('function');
      expect(typeof eventBus.unsubscribe).toBe('function');
    } finally {
      await moduleRef.close();
    }
  });

  it('publishes and subscribes through IEVENT_BUS only', async () => {
    const moduleRef = await createModule();

    try {
      const eventBus = moduleRef.get<IEventBus>(IEVENT_BUS);
      const received: BacktestFailedPayload[] = [];
      const cleanup = eventBus.subscribe(
        EventType.BacktestFailed,
        ({ payload }) => {
          received.push(payload);
        },
      );

      eventBus.publish(EventType.BacktestFailed, failedPayload, CORRELATION_ID);

      expect(received).toEqual([failedPayload]);
      cleanup();
    } finally {
      await moduleRef.close();
    }
  });

  it('isolates a failing subscriber from the publisher and sibling', async () => {
    const moduleRef = await createModule();
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    try {
      const eventBus = moduleRef.get<IEventBus>(IEVENT_BUS);
      const sibling = jest.fn();
      eventBus.subscribe(EventType.BacktestFailed, () => {
        throw new Error('subscriber failed');
      });
      eventBus.subscribe(EventType.BacktestFailed, sibling);

      expect(() =>
        eventBus.publish(EventType.BacktestFailed, failedPayload),
      ).not.toThrow();
      expect(sibling).toHaveBeenCalledTimes(1);
      expect(loggerError).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.BacktestFailed,
          eventId: expect.any(String),
          correlationId: expect.any(String),
          error: expect.objectContaining({ message: 'subscriber failed' }),
        }),
      );
    } finally {
      loggerError.mockRestore();
      await moduleRef.close();
    }
  });

  it('cleans up deterministically and remains idempotent', async () => {
    const moduleRef = await createModule();

    try {
      const eventBus = moduleRef.get<IEventBus>(IEVENT_BUS);
      const handler = jest.fn();
      const cleanup = eventBus.subscribe(EventType.BacktestFailed, handler);

      cleanup();
      cleanup();
      eventBus.unsubscribe(cleanup);
      eventBus.unsubscribe(cleanup);
      eventBus.publish(EventType.BacktestFailed, failedPayload);

      expect(handler).not.toHaveBeenCalled();
    } finally {
      await moduleRef.close();
    }
  });

  it('allows the adapter to be replaced at the IEVENT_BUS boundary', async () => {
    const alternative = new AlternativeEventBus();
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), EventsModule],
    })
      .overrideProvider(IEVENT_BUS)
      .useValue(alternative)
      .compile();

    try {
      const eventBus = moduleRef.get<IEventBus>(IEVENT_BUS);
      expect(eventBus).toBe(alternative);

      eventBus.publish(EventType.BacktestFailed, failedPayload);
      expect(alternative.publishedEventTypes).toEqual([
        EventType.BacktestFailed,
      ]);
    } finally {
      await moduleRef.close();
    }
  });
});
