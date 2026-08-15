import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import type {
  EventEnvelope,
  EventPayloadMap,
  EventSubscription,
  EventTypeValue,
  IEventBus,
} from '@crypto-strategy-lab/shared';

@Injectable()
export class EventBus implements IEventBus {
  private readonly logger = new Logger(EventBus.name);

  constructor(private readonly emitter: EventEmitter2) {}

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
    ): void => {
      try {
        const handling = handler(envelope);
        if (handling) {
          void handling.catch((error: unknown) => {
            this.logSubscriberError(error, envelope);
          });
        }
      } catch (error: unknown) {
        this.logSubscriberError(error, envelope);
      }
    };

    this.emitter.on(eventType, listener);

    let active = true;
    return () => {
      if (!active) {
        return;
      }

      active = false;
      this.emitter.off(eventType, listener);
    };
  }

  unsubscribe(subscription: EventSubscription): void {
    subscription();
  }

  private logSubscriberError<TEventType extends EventTypeValue>(
    error: unknown,
    envelope: EventEnvelope<EventPayloadMap[TEventType], TEventType>,
  ): void {
    this.logger.error({
      message: 'Event subscriber failed',
      eventType: envelope.eventType,
      eventId: envelope.eventId,
      correlationId: envelope.correlationId,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : { message: String(error) },
    });
  }
}
