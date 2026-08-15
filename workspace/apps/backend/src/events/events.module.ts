// EventsModule — EventEmitter2 wrapper (IEventBus), typed event bus implementation
// Owner: Phuong
// See: kb/modules/event-infrastructure.md, kb/contracts/events.yaml, ADR-0005

import { Module } from '@nestjs/common';
import { IEVENT_BUS } from '../shared/tokens';
import { EventBus } from './event-bus';

@Module({
  providers: [EventBus, { provide: IEVENT_BUS, useExisting: EventBus }],
  exports: [IEVENT_BUS],
})
export class EventsModule {}
