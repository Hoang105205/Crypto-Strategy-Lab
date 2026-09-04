// Shared constants — sourced from kb/contracts/*.yaml
// Owner: Hoang (shared infrastructure)

// Binance WebSocket endpoints
export const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';
export const BINANCE_REST_BASE = 'https://api.binance.com';

// Retry policy — kb/contracts/events.yaml retry_policy
export const RECONNECT_DELAYS_MS = [1000, 4000, 16000];
export const MAX_RECONNECT_ATTEMPTS = 3;

// Binance REST rate-limit handling — spec.md §5 (Rate-limit safety)
export const BINANCE_RETRY_AFTER_DEFAULT_MS = 60_000;
export const MAX_REST_RETRIES = 3;

// Market Data cache + pagination — kb/contracts/market-data.yaml
export const EXCHANGE_NAME = 'binance';
export const CANDLE_CACHE_TTL_MS = 60_000;
export const CANDLE_DEFAULT_LIMIT = 500;
export const CANDLE_MAX_LIMIT = 1000;

// Timeframe → interval duration in ms (contract `Timeframe` enum)
export const TIMEFRAME_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

// Job queue defaults — kb/contracts/events.yaml retry_policy
export const JOB_MAX_ATTEMPTS = 3;
export const JOB_BACKOFF_DELAYS_MS = [1000, 4000, 16000];

// Leaderboard
export const LEADERBOARD_TOP_K = 10;
