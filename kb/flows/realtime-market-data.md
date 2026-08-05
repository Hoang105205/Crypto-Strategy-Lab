# Business Flow: Realtime Market Data

> **Owner**: Hoàng
> **Status**: Draft
> **Last Updated**: 2026-08-05

## 1. Overview
- **Description**: Binance streams live candles into the system and the frontend charts update in real time
- **Primary Actor**: Market Data module (Binance WebSocket trigger)
- **Business Value**: Users see live market data without refreshing
- **Modules Involved**: Market Data, Event Infrastructure, Frontend

## 2. Preconditions
- [TODO: fill during planning phase]

## 3. Flow Steps
1. BinanceAdapter opens WebSocket stream for configured symbols/timeframes — Market Data → Binance via adapter
2. Candle received → MarketDataService caches and publishes `MarketDataUpdated` — Market Data → EventBus
3. WebSocket Gateway relays live candle to connected frontends — Market Data → Frontend
4. Frontend charts re-render with the new candle — Frontend

## 4. Postconditions
- [TODO: fill during planning phase]

## 5. Alternative Paths
### [TODO Path Name]
- [TODO]

## 6. Error & Exception Flows
### WebSocket disconnected
- BinanceAdapter detects drop, auto-reconnects with backoff, frontend shows connection status [TODO: detail]

## 7. Business Rules
- **BR-1**: [TODO]

## 8. Related
- **Contracts**: `kb/contracts/market-data.yaml`, `kb/contracts/events.yaml`
- **ADRs**: ADR-0004, ADR-0007
- **Module files**: `kb/modules/market-data.md`, `kb/modules/event-infrastructure.md`
