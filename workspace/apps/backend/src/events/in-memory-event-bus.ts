import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type {
  EventEnvelope,
  EventPayloadMap,
  EventSubscription,
  EventTypeValue,
  IEventBus,
} from '@crypto-strategy-lab/shared';

/**
 * Process-local event bus used until the event infrastructure adapter is
 * replaced. Keeping it behind IEventBus prevents consumers from depending on
 * the transport implementation.
 */
@Injectable()
export class InMemoryEventBus implements IEventBus {
  private readonly emitter = new EventEmitter();

  publish<TEventType extends EventTypeValue>(
    eventType: TEventType,
    payload: EventPayloadMap[TEventType],
    correlationId = randomUUID(),
  ): void {
    const envelope: EventEnvelope<EventPayloadMap[TEventType], TEventType> = {
      eventId: randomUUID(),
      eventType,
      eventVersion: 1,
      occurredAt: new Date(),
      correlationId,
      payload,
    };

    this.emitter.emit(eventType, envelope);
  }

  subscribe<TEventType extends EventTypeValue>(
    eventType: TEventType,
    handler: (
      envelope: EventEnvelope<EventPayloadMap[TEventType], TEventType>,
    ) => void | Promise<void>,
  ): EventSubscription {
    const listener = (
      envelope: EventEnvelope<EventPayloadMap[TEventType], TEventType>,
    ) => {
      void handler(envelope);
    };

    this.emitter.on(eventType, listener);
    return () => this.emitter.off(eventType, listener);
  }

  unsubscribe(subscription: EventSubscription): void {
    subscription();
  }
}
