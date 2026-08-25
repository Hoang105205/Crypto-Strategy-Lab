# Quickstart: News On-Demand Crawl with Anti-Spam Cooldown & Sentiment Distribution Breakdown

## Prerequisites
- Backend running on `http://localhost:3001`
- Frontend running on `http://localhost:3000`
- Python FastAPI sentiment service running on `http://localhost:8000`
- PostgreSQL & Redis running via Docker

## Validation Scenarios

### Scenario 1: On-Demand Crawl Execution
1. Open `http://localhost:3000/news`.
2. Locate and click `[ ⚡ Cào tin mới ]` on the header bar.
3. ✅ Button shows spinner `Đang cào & phân tích...`.
4. ✅ Within 2-3 seconds, toast indicates new articles ingested and the feed refreshes.
5. ✅ Button transitions to disabled state with countdown: `⏱️ Cào lại sau: 01:59`.

### Scenario 2: Cooldown Timer Persistence on Reload (F5)
1. While the countdown timer is active (e.g. at `01:30`), press `F5` / Refresh browser.
2. ✅ The button remains disabled and continues counting down from ~`01:28` without resetting to ready.

### Scenario 3: Backend Rate Limit Cooldown (429 Test)
1. Trigger a crawl: `curl -X POST http://localhost:3001/api/news/crawl` → `200 OK`.
2. Immediately send a second request: `curl -X POST http://localhost:3001/api/news/crawl`.
3. ✅ Returns HTTP 429 with JSON payload containing `retryAfterSeconds`.

### Scenario 4: Sentiment Distribution Breakdown Bar
1. View the top Aggregate Mood Card on `/news`.
2. ✅ Displays the 3-color breakdown bar with accurate percentages (e.g. 🟢 60% Positive | 🟡 30% Neutral | 🔴 10% Negative).
3. Switch timeframes (`1h` / `24h` / `7d`) or Coin tabs (`BTC` / `ETH` / `ALL`).
4. ✅ Breakdown bar and sentiment stats re-calculate and re-render smoothly.
