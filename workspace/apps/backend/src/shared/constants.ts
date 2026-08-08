// Shared constants — sourced from kb/contracts/*.yaml
// Owner: Hoang (shared infrastructure)

// Binance WebSocket endpoints
export const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';
export const BINANCE_REST_BASE = 'https://api.binance.com';

// Retry policy — kb/contracts/events.yaml retry_policy
export const RECONNECT_DELAYS_MS = [1000, 4000, 16000];
export const MAX_RECONNECT_ATTEMPTS = 3;

// Job queue defaults — kb/contracts/events.yaml retry_policy
export const JOB_MAX_ATTEMPTS = 3;
export const JOB_BACKOFF_DELAYS_MS = [1000, 4000, 16000];

// Leaderboard
export const LEADERBOARD_TOP_K = 10;
