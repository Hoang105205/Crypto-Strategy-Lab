# Contract: Typed Event Bus

The canonical payload source remains `kb/contracts/events.yaml`. This artifact records the implementation-facing boundary and reconciliation required by the feature; it does not redefine reduced Event payloads.

## Interface

```ts
interface IEventBus {
  publish<T>(eventType: EventTypeValue, payload: T, correlationId?: string): void;
  subscribe<T>(
    eventType: EventTypeValue,
    handler: (envelope: EventEnvelope<T>) => void | Promise<void>,
  ): EventSubscription;
  unsubscribe(subscription: EventSubscription): void;
}
```

`EventSubscription` is an idempotent cleanup function.

## Event Envelope

| Field | Type | Rules |
|-------|------|-------|
| `eventId` | UUID string | Generated for each publication |
| `eventType` | active Event name | Must exist in `EventType` |
| `eventVersion` | number | `1` for current schemas |
| `occurredAt` | ISO/Date UTC | Generated at publication |
| `correlationId` | UUID string | Preserve supplied value or generate |
| `payload` | event-specific | Exact active contract payload |

## Active Events

| Event | Publisher | Subscribers |
|-------|-----------|-------------|
| `MarketDataUpdated` | Market Data | none in MVP |
| `BacktestRequested` | Strategy Engine (`USER`) or Loop Controller (`SEARCH_LOOP`), after durable enqueue | none in MVP (observational notification) |
| `BacktestCompleted` | Backtest Worker | Strategy Engine, Leaderboard, Loop Controller |
| `BacktestFailed` | Backtest Worker | Strategy Engine, Loop Controller |
| `BacktestDeadLettered` | Job Queue | Loop Controller |
| `LeaderboardUpdated` | Leaderboard | Push Gateway |
| `SearchLoopStarted` | Loop Controller | Push Gateway |
| `SearchLoopProgress` | Loop Controller | Push Gateway |
| `SearchLoopStopped` | Loop Controller | Push Gateway |
| `NewsCollected` | News & Sentiment | none in MVP |

## Delivery Rules

- Publish is fire-and-forget and returns no subscriber result.
- A command requiring acknowledgement MUST use its result-bearing interface. Specifically, producers await `IJobQueue.enqueue` before publishing `BacktestRequested`; the Event never drives enqueue.
- Subscriber failure is caught/logged and cannot escape into publisher/sibling handlers.
- Correlation identity is preserved through `BacktestRequested` → terminal result → Leaderboard/Loop Event chains.
- `BacktestFailed` is terminal-only and has no `willRetry` field.
- Reserved Events remain valid but have no invented subscriber.
