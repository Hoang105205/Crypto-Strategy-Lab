import {
  Inject,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import {
  EventType,
  type EventPayloadMap,
  type EventSubscription,
  type EventTypeValue,
  type IEventBus,
} from '@crypto-strategy-lab/shared';
import type { Server, Socket } from 'socket.io';
import { IEVENT_BUS } from '../shared/tokens';

export const DEFAULT_INFRASTRUCTURE_WS_NAMESPACE = '/infrastructure';

type RelayEventType =
  | typeof EventType.LeaderboardUpdated
  | typeof EventType.SearchLoopStarted
  | typeof EventType.SearchLoopProgress
  | typeof EventType.SearchLoopStopped;

const RELAY_CHANNELS = {
  [EventType.LeaderboardUpdated]: 'leaderboard:update',
  [EventType.SearchLoopStarted]: 'loop:started',
  [EventType.SearchLoopProgress]: 'loop:progress',
  [EventType.SearchLoopStopped]: 'loop:stopped',
} as const satisfies Readonly<Record<RelayEventType, string>>;

const INFRASTRUCTURE_WS_NAMESPACE =
  process.env.INFRASTRUCTURE_WS_NAMESPACE ||
  DEFAULT_INFRASTRUCTURE_WS_NAMESPACE;

@WebSocketGateway({
  namespace: INFRASTRUCTURE_WS_NAMESPACE,
  cors: { origin: true },
})
export class PushGateway
  implements
    OnModuleInit,
    OnModuleDestroy,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PushGateway.name);
  private readonly subscriptions: EventSubscription[] = [];
  private initialized = false;

  constructor(
    @Inject(IEVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  onModuleInit(): void {
    if (this.initialized) return;

    const subscriptions: EventSubscription[] = [];
    try {
      this.subscribeRelay(
        subscriptions,
        EventType.LeaderboardUpdated,
        RELAY_CHANNELS.LeaderboardUpdated,
      );
      this.subscribeRelay(
        subscriptions,
        EventType.SearchLoopStarted,
        RELAY_CHANNELS.SearchLoopStarted,
      );
      this.subscribeRelay(
        subscriptions,
        EventType.SearchLoopProgress,
        RELAY_CHANNELS.SearchLoopProgress,
      );
      this.subscribeRelay(
        subscriptions,
        EventType.SearchLoopStopped,
        RELAY_CHANNELS.SearchLoopStopped,
      );
    } catch (error: unknown) {
      this.cleanupSubscriptions(subscriptions);
      throw error;
    }

    this.subscriptions.push(...subscriptions);
    this.initialized = true;
  }

  onModuleDestroy(): void {
    this.initialized = false;
    this.cleanupSubscriptions(this.subscriptions.splice(0));
  }

  handleConnection(client: Socket): void {
    void client;
  }

  handleDisconnect(client: Socket): void {
    void client;
  }

  private subscribeRelay<TEventType extends RelayEventType>(
    subscriptions: EventSubscription[],
    eventType: TEventType,
    channel: (typeof RELAY_CHANNELS)[TEventType],
  ): void {
    subscriptions.push(
      this.eventBus.subscribe(eventType, (envelope) => {
        this.emitPayload(eventType, channel, envelope.payload);
      }),
    );
  }

  private emitPayload<TEventType extends RelayEventType>(
    eventType: TEventType,
    channel: (typeof RELAY_CHANNELS)[TEventType],
    payload: EventPayloadMap[TEventType],
  ): void {
    try {
      this.server.emit(channel, payload);
    } catch {
      this.logFailure('SOCKET_EMIT_FAILED', eventType);
    }
  }

  private cleanupSubscriptions(subscriptions: EventSubscription[]): void {
    for (const subscription of subscriptions) {
      try {
        this.eventBus.unsubscribe(subscription);
      } catch {
        this.logFailure('SUBSCRIPTION_CLEANUP_FAILED');
      }
    }
  }

  private logFailure(code: string, eventType?: EventTypeValue): void {
    this.logger.error({
      message: 'Infrastructure realtime operation failed',
      code,
      ...(eventType ? { eventType } : {}),
    });
  }
}
