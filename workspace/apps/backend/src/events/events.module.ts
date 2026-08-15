// EventsModule — EventEmitter2 wrapper (IEventBus), typed event bus implementation
// Owner: Phuong
// See: kb/modules/event-infrastructure.md, kb/contracts/events.yaml, ADR-0005

import { Module } from '@nestjs/common';
import { IEVENT_BUS } from '../shared/tokens';
import { InMemoryEventBus } from './in-memory-event-bus';

@Module({
  providers: [
    InMemoryEventBus,
    { provide: IEVENT_BUS, useExisting: InMemoryEventBus },
    { provide: 'IEventBus', useExisting: InMemoryEventBus },
  ],
  exports: [IEVENT_BUS, 'IEventBus'],
})
export class EventsModule {}
