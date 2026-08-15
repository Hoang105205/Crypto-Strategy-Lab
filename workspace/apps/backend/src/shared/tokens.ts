// Central NestJS DI tokens for shared TypeScript interfaces.
// Interfaces have no runtime value, so every cross-module port uses an explicit token.
// Owner: Hoang (shared infrastructure)

export const IMARKET_DATA_ADAPTER = Symbol('IMarketDataAdapter');
export const IMARKET_DATA_SERVICE = Symbol('IMarketDataService');
export const IMARKET_DATA_GATEWAY = Symbol('IMarketDataGateway');
export const IEVENT_BUS = Symbol('IEventBus');
export const IJOB_QUEUE = Symbol('IJobQueue');
export const IBACKTESTER = Symbol('IBacktester');
export const IEVALUATOR = Symbol('IEvaluator');
export const ISTRATEGY_GENERATOR = Symbol('IStrategyGenerator');
export const ISTRATEGY_EXECUTION_PORT = Symbol('IStrategyExecutionPort');
export const IBACKTEST_RESULT_PORT = Symbol('IBacktestResultPort');
