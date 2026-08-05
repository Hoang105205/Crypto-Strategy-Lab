# Module: Market Data

> **Owner**: Hoàng
> **Status**: Draft
> **Last Updated**: 2026-08-05

## 1. Overview
- **Responsibility**: Ingest historical + real-time crypto market data from Binance and relay it to the frontend and other modules
- **Layer**: Backend
- **Depends on**: None (foundational)
- **Depended by**: Strategy Engine, Event Infrastructure, Frontend
- **Contracts**: `kb/contracts/market-data.yaml`
- **Source files**: `apps/backend/market-data/`, `shared/`
- **Related ADRs**: ADR-0004 (Adapter Pattern for Data Sources), ADR-0007 (Auto-Reconnect)

## 2. Component Architecture

### Components
| Component | Responsibility | Pattern | File(s) |
|-----------|---------------|---------|---------|
| BinanceAdapter | Historical klines + WebSocket stream, auto-reconnect | Adapter | [TODO] |
| MarketDataService | Caching, rate-limit handling | Facade | [TODO] |
| MarketDataGateway | WebSocket relay of live candles to frontend | Gateway | [TODO] |

### Component Diagram
[TODO: fill during planning phase]

## 3. Design Patterns

### Adapter Pattern — IMarketDataAdapter
- **Where**: BinanceAdapter (OKX adapter = 1 new class, zero changes elsewhere)
- **Why**: Data providers must be swappable
- **How**: [TODO]
- **Trade-offs**: [TODO]

## 4. Internal Data Flow
[TODO: fill during planning phase]

## 5. Sequence Diagrams

### Fetch Historical Candles
[TODO: fill during planning phase]

## 6. Data Model
| Entity | Fields | Relationships |
|--------|--------|---------------|
| [TODO] | [TODO] | [TODO] |

## 7. API Surface
See `kb/contracts/market-data.yaml`. [TODO: summarize endpoints here]

## 8. Quality Attributes
- **Security**: [TODO]
- **Performance**: Binance rate limits — caching + batching [TODO]
- **Error handling**: Auto-reconnect with exponential backoff [TODO]

## 9. Testing Strategy
- **Unit tests**: [TODO]
- **Integration tests**: [TODO]

## 10. Open Questions / TODOs
- [ ] [unresolved items]
