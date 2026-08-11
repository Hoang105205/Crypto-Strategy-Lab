# Quickstart: Market Data Frontend

## Prerequisites

- Node.js 22+ and npm
- Backend running (`workspace/apps/backend` — `npm run start:dev` on port 3001)
- Backend `.env` configured with Supabase `DATABASE_URL`
- Prisma migrated + seeded (5 trading pairs)

## Setup

```powershell
# From workspace root
cd "f:\Software Architecture\project\workspace\apps\frontend"

# Ensure env is set (create .env if missing)
# NEXT_PUBLIC_API_URL=http://localhost:3001

# Install deps (if not already)
npm install

# Start dev server
npm run dev
# → http://localhost:3000
```

## Validation Scenarios

### Scenario 1: Dashboard loads with live candles
1. Start backend: `cd ../backend && npm run start:dev`
2. Start frontend: `cd ../frontend && npm run dev`
3. Open `http://localhost:3000`
4. ✅ Expected: A 2×2 grid of candlestick charts renders within 2 seconds, each showing BTCUSDT at a different timeframe (5m, 15m, 1h, 4h)
5. ✅ Expected: Candles update in real time (watch the rightmost bar change)
6. ✅ Expected: StatusIndicator shows "Connected" with a green dot

### Scenario 2: Change trading pair
1. On the dashboard, select "ETH/USDT" from the PairSelector
2. ✅ Expected: All 4 charts switch to ETHUSDT data
3. ✅ Expected: No errors in console or on screen

### Scenario 3: Change timeframe on one panel
1. On chart panel #2, change timeframe from 15m to 1m
2. ✅ Expected: Only panel #2 changes to 1m data
3. ✅ Expected: Panels #1, #3, #4 remain unchanged

### Scenario 4: Connection status
1. Stop the backend (Ctrl+C)
2. ✅ Expected: StatusIndicator shows "Reconnecting..." with a yellow icon
3. ✅ Expected: Last candle data stays visible (no blank chart)
4. Restart the backend
5. ✅ Expected: StatusIndicator returns to "Connected"

### Scenario 5: Invalid pair handling
1. (If PairSelector only shows active pairs, this is covered by the backend's 400 response)
2. ✅ Expected: Chart panel shows "Invalid symbol or timeframe" error and reverts

### Scenario 6: Responsive layout
1. Resize browser to < 768px width
2. ✅ Expected: Grid collapses to 1 column (charts stacked vertically)
3. Resize to 768–1023px
4. ✅ Expected: Grid shows 2 columns

### Scenario 7: Subscription cleanup
1. Open the dashboard (4 subscriptions active)
2. Check backend subscriptions: `GET http://localhost:3001/api/market-data/subscriptions`
3. ✅ Expected: 4 subscriptions with `subscriberCount: 1` each (or shared)
4. Navigate to `/strategies` (different page)
5. Check again: `GET http://localhost:3001/api/market-data/subscriptions`
6. ✅ Expected: 0 active subscriptions (all cleaned up)
