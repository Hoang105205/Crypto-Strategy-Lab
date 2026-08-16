import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GATEWAY_OPTIONS } from '@nestjs/websockets/constants';
import {
  EventType,
  LoopStatus,
  RankingCriterion,
  SearchLoopProgressStatus,
  StrategyGeneratorType,
  type EventEnvelope,
  type EventPayloadMap,
  type IEventBus,
  type NormalizedRate,
} from '@crypto-strategy-lab/shared';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EventBus } from '../events/event-bus';
import { MarketDataGateway } from '../market-data/websocket/market-data.gateway';

const LOOP_RUN_ID = '2446ece1-efb0-440f-86e4-01f3c5cc0e15';
const STRATEGY_VERSION_ID = '39c76876-c8ec-451d-ae50-53b5e4a4804c';
const BACKTEST_RESULT_ID = 'f784cab5-f7a3-486f-8166-4d9f13326edc';
const STARTED_AT = new Date('2026-08-16T12:00:00.000Z');
const UPDATED_AT = new Date('2026-08-16T12:05:00.000Z');
const STOPPED_AT = new Date('2026-08-16T12:10:00.000Z');
const ORIGINAL_INFRASTRUCTURE_NAMESPACE =
  process.env.INFRASTRUCTURE_WS_NAMESPACE;

type RelayEventType =
  | typeof EventType.LeaderboardUpdated
  | typeof EventType.SearchLoopStarted
  | typeof EventType.SearchLoopProgress
  | typeof EventType.SearchLoopStopped;

interface SocketServerContract {
  emit(event: string, payload: unknown): unknown;
}

interface SocketClientContract {
  id: string;
}

interface PushGatewayContract {
  server: SocketServerContract;
  onModuleInit(): void | Promise<void>;
  onModuleDestroy(): void | Promise<void>;
  handleConnection(client: SocketClientContract): void;
  handleDisconnect(client: SocketClientContract): void;
}

type PushGatewayConstructor = new (eventBus: IEventBus) => PushGatewayContract;

const relayFixtures = {
  [EventType.LeaderboardUpdated]: {
    updatedAt: UPDATED_AT,
    triggeredByBacktestResultId: BACKTEST_RESULT_ID,
    rankingCriterion: RankingCriterion.SCORE,
    topK: [
      {
        rank: 7,
        strategyVersionId: STRATEGY_VERSION_ID,
        strategyName: 'Moving Average',
        strategyType: 'MA',
        isComposite: false,
        backtestResultId: BACKTEST_RESULT_ID,
        score: 0.72,
        totalReturn: 18,
        winRate: normalizedRate(0.65),
        maxDrawdown: -7,
        sharpeRatio: 1.7,
        totalTrades: 24,
      },
    ],
  },
  [EventType.SearchLoopStarted]: {
    loopRunId: LOOP_RUN_ID,
    config: {
      generatorType: StrategyGeneratorType.RANDOM,
      maxCandidates: 5,
      maxDurationMs: null,
      stopOnNoImprovementIterations: 50,
    },
    startedAt: STARTED_AT,
  },
  [EventType.SearchLoopProgress]: {
    loopRunId: LOOP_RUN_ID,
    iteration: 3,
    testedCandidates: 3,
    currentCandidate: {
      strategyVersionId: STRATEGY_VERSION_ID,
      strategyName: 'Moving Average',
      status: SearchLoopProgressStatus.EVALUATING,
    },
    bestScoreSoFar: 0.72,
    bestStrategyVersionId: STRATEGY_VERSION_ID,
  },
  [EventType.SearchLoopStopped]: {
    loopRunId: LOOP_RUN_ID,
    status: LoopStatus.COMPLETED,
    stopReason: 'max_candidates_reached',
    testedCandidates: 5,
    bestStrategyVersionId: STRATEGY_VERSION_ID,
    bestScore: 0.72,
    startedAt: STARTED_AT,
    stoppedAt: STOPPED_AT,
  },
} satisfies Pick<EventPayloadMap, RelayEventType>;

const relayChannels: Readonly<Record<RelayEventType, string>> = {
  [EventType.LeaderboardUpdated]: 'leaderboard:update',
  [EventType.SearchLoopStarted]: 'loop:started',
  [EventType.SearchLoopProgress]: 'loop:progress',
  [EventType.SearchLoopStopped]: 'loop:stopped',
};

describe('PushGateway realtime contract (T035)', () => {
  let eventBus: jest.Mocked<IEventBus>;
  let server: { emit: jest.Mock };
  let gateway: PushGatewayContract;

  beforeEach(() => {
    delete process.env.INFRASTRUCTURE_WS_NAMESPACE;
    eventBus = {
      publish: jest.fn<IEventBus['publish']>(),
      subscribe: jest
        .fn<IEventBus['subscribe']>()
        .mockImplementation(() => jest.fn()),
      unsubscribe: jest.fn<IEventBus['unsubscribe']>(),
    };
    server = { emit: jest.fn() };
    const PushGateway = loadPushGateway();
    gateway = new PushGateway(eventBus);
    gateway.server = server;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreInfrastructureNamespace();
  });

  it('subscribes exactly once to only the four active Leaderboard/Loop relay events', async () => {
    await gateway.onModuleInit();
    await gateway.onModuleInit();

    const subscribedEventTypes = eventBus.subscribe.mock.calls.map(
      ([eventType]) => eventType,
    );
    expect(subscribedEventTypes).toEqual([
      EventType.LeaderboardUpdated,
      EventType.SearchLoopStarted,
      EventType.SearchLoopProgress,
      EventType.SearchLoopStopped,
    ]);
    expect(subscribedEventTypes).not.toContain(EventType.MarketDataUpdated);
    expect(subscribedEventTypes).not.toContain(EventType.NewsCollected);
  });

  it('relays each Event to the exact server channel with envelope.payload unchanged', async () => {
    await gateway.onModuleInit();

    for (const eventType of relayEventTypes()) {
      const payload = relayFixtures[eventType];
      const handler = subscribedHandler(eventBus, eventType);

      await handler(envelope(eventType, payload));

      expect(server.emit).toHaveBeenLastCalledWith(
        relayChannels[eventType],
        payload,
      );
      expect(server.emit.mock.calls.at(-1)?.[1]).toBe(payload);
      expect(server.emit.mock.calls.at(-1)?.[1]).not.toMatchObject({
        payload,
      });
    }

    expect(server.emit).toHaveBeenCalledTimes(4);
  });

  it('isolates a socket emit failure through the production EventBus and still relays a later event', () => {
    const runtimeBus = new EventBus(new EventEmitter2());
    const PushGateway = loadPushGateway();
    const runtimeGateway = new PushGateway(runtimeBus);
    const socketFailure = new Error('redis://operator:password@private-host');
    const runtimeServer = {
      emit: jest
        .fn<(event: string, payload: unknown) => void>()
        .mockImplementationOnce(() => {
          throw socketFailure;
        })
        .mockImplementation(() => undefined),
    };
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    runtimeGateway.server = runtimeServer;
    void runtimeGateway.onModuleInit();

    expect(() =>
      runtimeBus.publish(
        EventType.LeaderboardUpdated,
        relayFixtures.LeaderboardUpdated,
      ),
    ).not.toThrow();
    expect(() =>
      runtimeBus.publish(
        EventType.SearchLoopStarted,
        relayFixtures.SearchLoopStarted,
      ),
    ).not.toThrow();

    expect(runtimeServer.emit).toHaveBeenNthCalledWith(
      1,
      'leaderboard:update',
      relayFixtures.LeaderboardUpdated,
    );
    expect(runtimeServer.emit).toHaveBeenNthCalledWith(
      2,
      'loop:started',
      relayFixtures.SearchLoopStarted,
    );
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SOCKET_EMIT_FAILED',
        eventType: EventType.LeaderboardUpdated,
      }),
    );
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain(
      socketFailure.message,
    );

    void runtimeGateway.onModuleDestroy();
  });

  it('cleans all four subscription handles once and makes repeated shutdown a no-op', async () => {
    const cleanups = relayEventTypes().map(() => jest.fn());
    cleanups.forEach((cleanup) => {
      eventBus.subscribe.mockReturnValueOnce(cleanup);
    });
    const PushGateway = loadPushGateway();
    gateway = new PushGateway(eventBus);
    gateway.server = server;
    await gateway.onModuleInit();

    await gateway.onModuleDestroy();
    await gateway.onModuleDestroy();

    expect(eventBus.unsubscribe.mock.calls).toHaveLength(4);
    cleanups.forEach((cleanup, index) => {
      expect(eventBus.unsubscribe.mock.calls[index]).toEqual([cleanup]);
    });
  });

  it('continues cleanup when one unsubscribe fails and keeps the failure observable', async () => {
    const cleanups = relayEventTypes().map(() => jest.fn());
    cleanups.forEach((cleanup) => {
      eventBus.subscribe.mockReturnValueOnce(cleanup);
    });
    const cleanupSecret = 'redis://operator:password@cleanup-host';
    eventBus.unsubscribe
      .mockImplementationOnce(() => {
        throw new Error(cleanupSecret);
      })
      .mockImplementation(() => undefined);
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const PushGateway = loadPushGateway();
    gateway = new PushGateway(eventBus);
    gateway.server = server;
    await gateway.onModuleInit();

    await expect(
      Promise.resolve(gateway.onModuleDestroy()),
    ).resolves.toBeUndefined();

    expect(eventBus.unsubscribe.mock.calls).toHaveLength(4);
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SUBSCRIPTION_CLEANUP_FAILED' }),
    );
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain(cleanupSecret);
  });

  it('does not create per-client EventBus subscriptions or server-side connection:status business events', async () => {
    const client = { id: 'infrastructure-client-1' };
    await gateway.onModuleInit();

    gateway.handleConnection(client);
    gateway.handleDisconnect(client);

    expect(eventBus.subscribe.mock.calls).toHaveLength(4);
    expect(eventBus.unsubscribe.mock.calls).toHaveLength(0);
    expect(
      server.emit.mock.calls.some(
        ([channel]) => channel === 'connection:status',
      ),
    ).toBe(false);
  });

  it('uses a dedicated /infrastructure namespace and preserves the existing Market Data namespace/source boundary', () => {
    const PushGateway = loadPushGateway();
    const infrastructureOptions = Reflect.getMetadata(
      GATEWAY_OPTIONS,
      PushGateway,
    ) as { namespace?: string } | undefined;
    const marketDataOptions = Reflect.getMetadata(
      GATEWAY_OPTIONS,
      MarketDataGateway,
    ) as { namespace?: string } | undefined;
    const source = readFileSync(join(__dirname, 'push.gateway.ts'), 'utf8');

    expect(infrastructureOptions?.namespace).toBe('/infrastructure');
    expect(marketDataOptions?.namespace).toBe('market-data');
    expect(PushGateway).not.toBe(MarketDataGateway);
    expect(source).not.toMatch(/MarketDataGateway|market-data:candles/);
    expect(source).not.toMatch(/MarketDataUpdated|NewsCollected/);
    expect(source).not.toMatch(/connection:status/);
  });

  it('selects a custom namespace from INFRASTRUCTURE_WS_NAMESPACE at module load', () => {
    process.env.INFRASTRUCTURE_WS_NAMESPACE = '/course-infrastructure';
    jest.resetModules();

    const PushGateway = loadPushGateway();
    const options = Reflect.getMetadata(GATEWAY_OPTIONS, PushGateway) as
      { namespace?: string } | undefined;

    expect(options?.namespace).toBe('/course-infrastructure');
  });
});

function loadPushGateway(): PushGatewayConstructor {
  try {
    const module = jest.requireActual<{
      PushGateway?: PushGatewayConstructor;
    }>('./push.gateway');
    if (!module.PushGateway) {
      throw new Error('PushGateway export is missing');
    }
    return module.PushGateway;
  } catch (error: unknown) {
    throw new Error(
      'T035 RED: T037 must provide push.gateway.ts with the infrastructure relay lifecycle',
      { cause: error },
    );
  }
}

function restoreInfrastructureNamespace(): void {
  if (ORIGINAL_INFRASTRUCTURE_NAMESPACE === undefined) {
    delete process.env.INFRASTRUCTURE_WS_NAMESPACE;
    return;
  }
  process.env.INFRASTRUCTURE_WS_NAMESPACE = ORIGINAL_INFRASTRUCTURE_NAMESPACE;
}

function relayEventTypes(): RelayEventType[] {
  return [
    EventType.LeaderboardUpdated,
    EventType.SearchLoopStarted,
    EventType.SearchLoopProgress,
    EventType.SearchLoopStopped,
  ];
}

function subscribedHandler<TEventType extends RelayEventType>(
  eventBus: jest.Mocked<IEventBus>,
  eventType: TEventType,
): (
  event: EventEnvelope<EventPayloadMap[TEventType], TEventType>,
) => void | Promise<void> {
  const call = eventBus.subscribe.mock.calls.find(
    ([subscribedType]) => subscribedType === eventType,
  );
  if (!call) throw new Error(`Missing subscription for ${eventType}`);
  return call[1];
}

function envelope<TEventType extends RelayEventType>(
  eventType: TEventType,
  payload: EventPayloadMap[TEventType],
): EventEnvelope<EventPayloadMap[TEventType], TEventType> {
  return {
    eventId: 'c976f3de-533c-4fd5-bac5-fc2b17651f10',
    eventType,
    eventVersion: 1,
    occurredAt: UPDATED_AT,
    correlationId: 'cb6768eb-4b0c-48df-93a7-dd7f22dd735a',
    payload,
  };
}

function normalizedRate(value: number): NormalizedRate {
  if (value < 0 || value > 1) {
    throw new RangeError('Normalized rate fixture must be between 0 and 1');
  }
  return value as NormalizedRate;
}
