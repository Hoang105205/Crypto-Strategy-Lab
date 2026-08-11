// Market Data Frontend — constants
// Owner: Hoang
// See: sdd_artifacts/market-data-frontend/plan.md Phase 0, research.md D5

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const WS_NAMESPACE = '/market-data';

export const TIMEFRAMES = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '1d',
] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

export const DEFAULT_PAIR = 'BTCUSDT';

export const DEFAULT_GRID_TIMEFRAMES: Timeframe[] = ['5m', '15m', '1h', '4h'];

export const CANDLE_LIMIT = 500;

export const WS_EVENTS = {
  candleUpdate: 'candle:update',
  candleClose: 'candle:close',
  statusConnected: 'status:connected',
  statusDisconnected: 'status:disconnected',
  statusReconnected: 'status:reconnected',
} as const;

export const COLORS = {
  canvasDark: '#0b0e11',
  surfaceCard: '#1e2329',
  surfaceElevated: '#2b3139',
  primary: '#fcd535',
  primaryActive: '#f0b90b',
  body: '#eaecef',
  muted: '#707a8a',
  mutedStrong: '#929aa5',
  tradingUp: '#0ecb81',
  tradingDown: '#f6465d',
  info: '#3b82f6',
  hairlineDark: '#2b3139',
} as const;

export const INDICATOR_PERIODS = {
  sma: 20,
  bollingerPeriod: 20,
  bollingerStdDev: 2,
  srLookback: 50,
} as const;
