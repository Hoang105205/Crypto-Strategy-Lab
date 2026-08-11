# note.md — Release Checklist for `market-data-frontend`

> **Owner**: Hoang | **Feature**: market-data-frontend (tasks #8–#13)
> **Status**: Implemented 2026-08-10. tsc clean, ESLint 0 errors, `next build` compiles. Manual smoke test pending (requires running backend + frontend together).

## 1. Environment

- [x] `apps/frontend/.env` created with `NEXT_PUBLIC_API_URL=http://localhost:3001`.
- [x] Tailwind CSS v4 configured (`postcss.config.mjs` + `@import "tailwindcss"` + `@theme` in `globals.css`).
- [x] Fonts: Inter + JetBrains Mono via `next/font/google` in `layout.tsx`.

## 2. Build verification

- [x] `npx tsc --noEmit` — clean (0 errors).
- [x] `npx eslint "src/**/*.ts" "src/**/*.tsx"` — 0 errors, 1 warning (stub component unused props — cosmetic).
- [x] `npx next build` — compiled successfully.

## 3. Manual smoke test (before PR)

Run backend (`cd apps/backend && npm run start:dev`) + frontend (`cd apps/frontend && npm run dev`), then verify:

- [ ] `http://localhost:3000` loads — 2×2 grid of candlestick charts renders.
- [ ] Charts show real BTCUSDT candles (historical data from Binance via backend).
- [ ] Candles update in real time (watch the rightmost bar).
- [ ] StatusIndicator shows "Connected".
- [ ] PairSelector switches all 4 charts to ETHUSDT.
- [ ] Per-panel TimeframeSelector changes only that panel.
- [ ] Overlays: toggle MA/BOLL/S/R on a chart — lines appear/disappear.
- [ ] Navigate to `/strategies` → subscriptions cleaned up (check `GET /api/market-data/subscriptions`).

## 4. Known limitations

- **TradeMarkers** — stub only (returns `null`). Real implementation deferred to W3 when Phương's trade data pipeline is ready.
- **No frontend tests** — Vitest not configured (research.md D2 decision). Backend's 36/36 unit tests cover the contract; frontend relies on manual smoke.
- **Nav shell** — `top-nav-dark` not implemented. Belongs to Phương's frontend shell task.
- **8/4 dashboard split** — full-width grid for W2. The 8/4 split (grid + side rail) needs LoopStatusPanel which is Phương's task.
- **Chart height** — fixed at 400px. Could be made responsive in a future iteration.

## 5. Files created/modified

| File | Action |
|---|---|
| `src/app/globals.css` | Modified — added `@theme` with DESIGN.md color/font tokens |
| `src/app/layout.tsx` | Modified — Inter + JetBrains Mono fonts, dark theme body |
| `src/app/page.tsx` | Rewritten — dashboard with PairSelector + StatusIndicator + MultiTimeframeGrid |
| `src/lib/constants.ts` | Created — API_BASE_URL, TIMEFRAMES, COLORS, WS_EVENTS |
| `src/lib/indicators.ts` | Created — SMA, Bollinger Bands, Support/Resistance |
| `src/services/api-client.ts` | Created — typed fetch wrappers for 5 REST endpoints |
| `src/services/socket-client.ts` | Created — socket.io singleton |
| `src/hooks/use-websocket.ts` | Created — connection status hook |
| `src/hooks/use-market-data.ts` | Created — per-panel data hook (fetch + subscribe + cleanup) |
| `src/components/chart/candlestick-chart.tsx` | Created — lightweight-charts v5 wrapper |
| `src/components/chart/multi-timeframe-grid.tsx` | Created — 2×2 grid |
| `src/components/chart/chart-overlay.tsx` | Created — MA/Bollinger/SR toggle + LineSeries |
| `src/components/chart/trade-markers.tsx` | Created — stub (W3 deferred) |
| `src/components/pair-selector.tsx` | Created — global pair dropdown |
| `src/components/timeframe-selector.tsx` | Created — per-panel timeframe dropdown |
| `src/components/status-indicator.tsx` | Created — text + icon status |
| `.env` | Created — NEXT_PUBLIC_API_URL |
