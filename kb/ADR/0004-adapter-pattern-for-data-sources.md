# ADR-0004: Adapter Pattern for Data Sources

## Status
Accepted

## Context
The spec (Section 4) requires that the frontend and strategy engine never depend directly
on Binance's data format or API structure. The spec explicitly warns against
`Frontend → Binance API` and instead prescribes `Frontend → Market Data Service →
Binance Adapter → Binance`. The spec also states that future adapters (OKXAdapter,
BybitAdapter, CoinbaseAdapter) should be addable without frontend or strategy changes.

Additionally, spec Section 40.3 asks: "How is a new Market Data Provider added — from
Binance to Binance + OKX — does the frontend need to change?" The architecture must
demonstrably answer "no."

## Decision Drivers
- The system must support multiple data providers without modifying existing code
  (spec Section 32.1, Modifiability; Section 40.3, extensibility question)
- Binance's WebSocket API sends raw JSON messages with Binance-specific field names
  (e.g., `k.t` for open time, `k.c` for close price) — these must not leak into the
  strategy engine or frontend
- Different exchanges have different REST endpoints, rate limits, and WebSocket message
  formats — a common interface is needed to normalize them
- Spec Section 44 (Anti-patterns) warns against a "God Service" that does everything —
  the data source concern must be cleanly separated

## Considered Options
1. **Direct Binance API calls everywhere** — each module that needs market data calls
   Binance REST/WebSocket directly with Binance-specific parsing
2. **Adapter Pattern with a shared interface (`IMarketDataAdapter`)** — a single interface
   that all data source adapters implement. `BinanceAdapter` is the first implementation.
   `MarketDataService` depends on the interface, never on `BinanceAdapter` directly.
3. **Repository Pattern** — abstract data access behind a generic repository, with Binance
   as one "data source" implementation

## Decision Outcome
Chosen option: **"Adapter Pattern with `IMarketDataAdapter`"**, because it directly
addresses the spec's requirement that data providers be swappable without frontend or
strategy engine changes, and because it cleanly isolates Binance-specific data formats
behind a normalized `Candle` entity.

### How it works

```typescript
// shared/interfaces/imarket-data-adapter.ts
interface IMarketDataAdapter {
  fetchKlines(symbol: string, timeframe: string, options: { startTime?: Date; endTime?: Date; limit?: number }): Promise<Candle[]>;
  connectStream(symbol: string, timeframe: string): void;
  disconnectStream(symbol: string, timeframe: string): void;
  onCandle(callback: (candle: Candle) => void): void;
  onDisconnect(callback: () => void): void;
  onReconnect(callback: () => void): void;
}
```

`BinanceAdapter` implements this interface. It:
- Calls Binance REST API for historical klines, parses Binance JSON → normalized `Candle`
- Opens Binance WebSocket for real-time streams, parses Binance WS messages → `Candle`
- Handles auto-reconnect with exponential backoff (ADR-0007, W2)
- Respects Binance rate limits

`MarketDataService` depends on `IMarketDataAdapter` (injected via NestJS DI). It:
- Calls `adapter.fetchKlines()` for historical data, applies caching
- Calls `adapter.connectStream()` to start real-time feeds
- Subscribes to `adapter.onCandle()` to receive live updates
- Publishes `MarketDataUpdated` events and relays candles via WebSocket Gateway

To add OKX:
```typescript
// One new file — zero changes to MarketDataService, Strategy Engine, or Frontend
class OKXAdapter implements IMarketDataAdapter { ... }
```
The adapter is registered in the NestJS DI container. `MarketDataService` receives the
new adapter via constructor injection — no code change in the service itself.

### Consequences
- Positive: Adding a new data source = 1 new class + 1 DI registration. Zero changes to
  `MarketDataService`, Strategy Engine, Frontend, or any other module.
- Positive: Binance's raw JSON format (e.g., `k.t`, `k.c`, `k.h`) never leaves the adapter.
  All downstream code works with the normalized `Candle` entity defined in
  `kb/contracts/market-data.yaml`.
- Positive: The adapter is independently testable — mock `IMarketDataAdapter` in unit tests
  for `MarketDataService` without hitting Binance.
- Positive: Directly answers spec Section 40.3 — "adding OKX does not require frontend changes."
- Negative: The adapter must implement all interface methods, even if a particular exchange
  doesn't support all features (e.g., some exchanges don't have WebSocket). Acceptable —
  unsupported methods can throw `NotImplementedError` or return empty results.
- Negative: If the `IMarketDataAdapter` interface needs to change (e.g., add a new method
  for tick-level data), all adapter implementations must be updated. Mitigated by: interface
  changes require a contract update + team notification (Constitution Principle V).

## Links
- Relates to ADR-0002 (Modular Monolith) — the adapter is a module-internal pattern, not a service boundary
- Relates to ADR-0007 (Auto-Reconnect for External APIs) — the adapter owns reconnection logic (W2)
- Relates to ADR-0010 (News Provider Adapter Pattern) — the same pattern is applied to news providers
- See also: `kb/contracts/market-data.yaml` (IMarketDataAdapter interface + Candle entity)
- See also: `kb/modules/market-data.md` (component architecture)
- Superseded by: none
