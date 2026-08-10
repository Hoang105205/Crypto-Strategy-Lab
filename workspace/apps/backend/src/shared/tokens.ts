// NestJS DI tokens for the TypeScript interfaces defined in @crypto-strategy-lab/shared.
// TS interfaces have no runtime value, so DI requires explicit tokens (Constitution VI — explicit over implicit).
// Owner: Hoang (shared infrastructure)
//
// NOTE: IEVENT_BUS token convention is an open question with Phuong (EventsModule owner).
// MarketDataService injects it optionally until EventsModule provides it (spec.md §9).

export const IMARKET_DATA_ADAPTER = Symbol('IMarketDataAdapter');
export const IMARKET_DATA_SERVICE = Symbol('IMarketDataService');
export const IMARKET_DATA_GATEWAY = Symbol('IMarketDataGateway');
export const IEVENT_BUS = Symbol('IEventBus');
