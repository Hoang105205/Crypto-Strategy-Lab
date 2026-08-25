# Research: News On-Demand Crawl with Anti-Spam Cooldown & Sentiment Distribution Breakdown

## Decisions

### D1: Cooldown State Management (In-Memory Timestamp vs Redis)
- **Chosen**: In-memory timestamp (`lastManualCrawlTimestamp: number`) and Mutex flag (`isCrawling: boolean`) on backend `NewsService`/`NewsController`.
- **Rationale**: For the current Modular Monolith running as a single backend instance, an in-memory timestamp provides instant execution with zero external network overhead or Redis key management.
- **Alternatives considered**: Redis `SET key EX 120 NX` — rejected as over-engineering for a course project monolith (YAGNI principle).
- **KB reference**: `kb/CONSTITUTION.md` Principle IV (Simplicity over cleverness).

### D2: Mutex Lock for Concurrent Crawl Execution
- **Chosen**: Boolean flag `isCrawling` set to `true` at the start of `collectAllNews()` and reset in a `finally` block.
- **Rationale**: Prevents race conditions where two simultaneous triggers (e.g. cron and manual trigger, or two browser tabs) crawl the web at the exact same moment.
- **Error Response**: HTTP `409 Conflict` with `{ error: "Crawl in progress. Please wait for current execution to finish." }`.

### D3: Frontend Countdown Timer Persistence
- **Chosen**: `localStorage` item `news_last_crawl_timestamp` + React `useEffect` interval ticker (1000ms).
- **Rationale**: If the user presses F5 or navigates away and returns to `/news`, the remaining cooldown seconds are calculated dynamically: `Math.max(0, 120 - Math.floor((Date.now() - lastCrawl) / 1000))`. This guarantees the OP.GG-style UX without resetting.

### D4: Sentiment Ratio Calculation Formula
- **Chosen**:
  - `positiveRatio = Number(((positiveCount / total) * 100).toFixed(1))`
  - `neutralRatio = Number(((neutralCount / total) * 100).toFixed(1))`
  - `negativeRatio = Number((100 - positiveRatio - neutralRatio).toFixed(1))` (handles floating point rounding so sum is always exactly 100.0%)
  - For `total === 0`: `positiveRatio: 0, neutralRatio: 100, negativeRatio: 0`.
