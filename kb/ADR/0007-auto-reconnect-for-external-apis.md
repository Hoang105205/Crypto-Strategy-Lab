# ADR-0007: Auto-Reconnect for External APIs

## Status
Accepted

## Context
The Crypto Strategy Lab depends on two categories of external APIs:

1. **Binance WebSocket** — the primary real-time data source. The `BinanceAdapter`
   opens a WebSocket connection (`wss://stream.binance.com:9443/ws/<symbol>@kline_<interval>`)
   to receive live candle updates. This connection is long-lived and can drop at any
   time due to network issues, Binance server restarts, or idle-timeout disconnection.

2. **Binance REST API** — used for historical kline fetches and gap-recovery after a
   WebSocket reconnect. REST calls are request-response, so "reconnect" doesn't apply
   the same way — but they can return 429 (rate limited) or 5xx (server error) and need
   retry logic.

3. **Python Sentiment Service** — a local FastAPI process (`localhost:8000`). If it
   crashes or is restarted, the NestJS `SentimentClient` must handle connection refused
   gracefully. However, this case is already covered by ADR-0009 (Process Isolation)
   and Thuận's graceful degradation pattern (`SentimentStrategy` returns `HOLD`). This
   ADR focuses on the Binance WebSocket reconnect strategy.

Spec Section 32.4 (Reliability) asks: "If Binance loses connection, how does the system
handle it? Reconnect? Retry? Does it lose candles?" The answer must be explicit and
demonstrable in the final demo.

Spec Section 23 requires that all loops have a stop condition — no unbounded `while(true)`.
This applies to the reconnect loop as well.

## Decision Drivers
- The system must not lose candle data during a WebSocket disconnect (spec Section 32.4)
- Auto-reconnect must have a bounded stop condition — no unbounded `while(true)` (spec Section 23)
- The frontend must show connection status so users know when data is stale (spec Section 32.7, Observability)
- Reconnect logic must be isolated inside the `BinanceAdapter` — it must not leak into `MarketDataService`, the event bus, or the frontend (ADR-0004, Adapter Pattern)
- Consistency with ADR-0006's retry policy (same backoff sequence: 1s, 4s, 16s) to keep the codebase's retry patterns uniform

## Considered Options
1. **No auto-reconnect** — let the WebSocket drop, require the user to manually
   re-subscribe. The frontend shows "Connection lost."
2. **Unlimited auto-reconnect with fixed delay** — reconnect every 1 second forever
   until the connection is restored.
3. **Bounded auto-reconnect with exponential backoff + gap recovery** — attempt
   reconnection 3 times with increasing delays (1s, 4s, 16s). If successful, fetch
   missed candles via REST API to fill the gap. If all 3 attempts fail, stop and
   notify the user.

## Decision Outcome
Chosen option: **"Bounded auto-reconnect with exponential backoff + gap recovery"**,
because it satisfies the spec's reliability requirement (no lost candles) while
respecting the stop-condition requirement (bounded attempts, no `while(true)`), and
it keeps the user informed throughout.

### How it works

```
WebSocket drops
      │
      ▼
  Attempt 1: wait 1s → reconnect
      │
  ┌───┴───┐ success?
  │ YES   │ NO → wait 4s
  │       │
  │       ▼
  │   Attempt 2: reconnect
  │       │
  │   ┌───┴───┐ success?
  │   │ YES   │ NO → wait 16s
  │   │       │
  │   │       ▼
  │   │   Attempt 3: reconnect
  │   │       │
  │   │   ┌───┴───┐ success?
  │   │   │ YES   │ NO → STOP
  │   │   │       │
  │   │   │       ▼
  │   │   │   status:disconnected (manual retry)
  │   │   │
  └──┴───┴─── ALL SUCCESS PATHS ──┐
                                  │
                                  ▼
                    Fetch missed candles via REST
                    (fetchKlines with startTime = last known candle)
                                  │
                                  ▼
                    status:reconnected
                    Frontend resumes live updates
```

#### Reconnect sequence (inside `BinanceAdapter`)

```typescript
private readonly RECONNECT_DELAYS_MS = [1000, 4000, 16000]; // 3 attempts
private readonly MAX_RECONNECT_ATTEMPTS = 3;

async reconnect(): Promise<void> {
  const lastCandleTime = this.getLastCandleTime(); // before disconnect

  for (let attempt = 0; attempt < this.MAX_RECONNECT_ATTEMPTS; attempt++) {
    await this.delay(this.RECONNECT_DELAYS_MS[attempt]);
    try {
      await this.openWebSocket();
      // Success — recover missed candles
      await this.recoverGap(lastCandleTime);
      this.notifyReconnected();
      return;
    } catch (err) {
      // Attempt failed, continue to next
    }
  }

  // All attempts exhausted — stop and notify
  this.notifyDisconnected();
}
```

#### Gap recovery

After a successful reconnect, the adapter calls `fetchKlines(symbol, timeframe,
{ startTime: lastCandleTime })` via the Binance REST API to fetch any candles that
closed during the disconnect period. These candles are processed through the normal
`onCandle` pipeline — the frontend sees them as `candle:close` events, filling the
gap seamlessly.

#### Frontend notification

The `MarketDataGateway` emits status events on the `market-data:status` WebSocket
channel:

| Event | When | Frontend Action |
|-------|------|-----------------|
| `status:disconnected` | WebSocket drops, reconnect attempt begins | Show "Reconnecting..." indicator |
| `status:reconnected` | Reconnect succeeds + gap recovered | Hide indicator, resume live chart |
| `status:disconnected` (final) | All 3 attempts exhausted | Show "Connection lost — click to retry" |

### Consequences
- Positive: No candle data is lost during transient disconnects — the REST gap recovery
  fills the timeline seamlessly.
- Positive: The reconnect logic is entirely inside `BinanceAdapter` — `MarketDataService`,
  the event bus, and the frontend never know about reconnection mechanics. They only see
  the `onDisconnect` / `onReconnect` callbacks (defined in `IMarketDataAdapter`, see
  `kb/contracts/market-data.yaml`).
- Positive: Uses a bounded 1s/4s/16s reconnect sequence appropriate to external WebSockets. The
  BullMQ backtest job policy is separately defined by ADR-0013 as three attempts with 1s/4s waits —
  the team has one mental model for retry patterns.
- Positive: Bounded — 3 attempts with increasing delays means the worst case is
  1s + 4s + 16s = 21 seconds before giving up. No unbounded loop (spec Section 23).
- Positive: Observable — the frontend always knows the connection state via the
  `market-data:status` WebSocket channel (spec Section 32.7).
- Negative: If Binance is down for longer than 21 seconds, the system gives up and
  requires manual user action. Acceptable — a prolonged outage means Binance itself
  is down, and auto-reconnect cannot help.
- Negative: The REST gap recovery uses API quota — if the disconnect was brief
  (sub-second), the REST call may return no new candles. The adapter handles this
  gracefully (empty result = no gap to fill).
- Risk: If the system clock and Binance's server clock are slightly out of sync,
  the `startTime` in the gap-recovery REST call might miss or duplicate the boundary
  candle. Mitigated by: the `Candle` table has a `@@unique([symbol, timeframe, openTime])`
  constraint (see `kb/modules/market-data.md` Section 6) — duplicate inserts are
  silently deduplicated by Prisma upsert.

## Links
- Relates to ADR-0004 (Adapter Pattern for Data Sources) — the adapter owns reconnection logic
- Relates to ADR-0013 (BullMQ/Redis Backtest Jobs) — separate retry policy; do not reuse WebSocket reconnect delays for jobs
- Relates to ADR-0009 (Sentiment Service as Separate Process) — Python service failure handled separately via graceful degradation, not auto-reconnect
- See also: `kb/contracts/market-data.yaml` (`onDisconnect`, `onReconnect` callbacks in `IMarketDataAdapter`)
- See also: `kb/modules/market-data.md` Section 8 (Quality Attributes — Error handling)
- See also: `kb/flows/realtime-market-data.md` error flow 6a (WebSocket disconnect) and BR-6 (stop condition)
- See also: `kb/GLOSSARY.md` (Auto-Reconnect term)
- Superseded by: none
