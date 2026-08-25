# Feature Specification: News On-Demand Crawl with Anti-Spam Cooldown & Sentiment Distribution Breakdown

**Feature**: `news-manual-crawl-breakdown`  
**Created**: 2026-08-25  
**Status**: Ready for Planning  
**Input**: User description: "Nâng cấp News & Sentiment: 1. Bổ sung endpoint POST /api/news/crawl on-demand với cooldown 2 phút (120s) trả về HTTP 429 và mutex lock trả về HTTP 409. 2. Cập nhật GET /api/sentiment/aggregate trả về thêm tỷ lệ phân bố: positiveRatio, neutralRatio, negativeRatio (0-100%). 3. Cập nhật giao diện NewsFeed: Nút 'Cào tin mới' có bộ đếm Cooldown 2 phút (OP.GG style, lưu localStorage chống reset F5) và thanh tỷ lệ 3 màu. 4. Điều chỉnh chu kỳ Cronjob sang 5 phút (*/5 * * * *)."

---

## User Scenarios & Testing

### User Story 1 - On-Demand Manual News Crawl with 2-Minute Anti-Spam Cooldown (Priority: P1)

As a trader or demo evaluator, I want to trigger an immediate news crawl by clicking a button on the UI so that I can see newly ingested crypto news and sentiment scores instantly without waiting for the next scheduled cron cycle. To prevent spamming external news servers and blowing rate limits, the system enforces a 2-minute (120 seconds) cooldown both on the frontend (visual countdown timer) and backend (HTTP 429 Too Many Requests).

**Why this priority**: Essential for live project demonstrations and immediate market news evaluation. Eliminates the awkward 5-minute wait during presentations while strictly guarding against IP bans from news providers.  
**Independent Test**: Click "Cào tin mới", verify articles are ingested and displayed within 2 seconds, verify the button enters a 120s countdown state and rejects subsequent requests until expiry.

**Acceptance Scenarios**:
1. **Given** the user is on the `/news` page and the button is ready (`enabled`), **When** the user clicks "Cào tin mới", **Then** the button shows a loading spinner, calls `POST /api/news/crawl`, ingests new articles, refreshes the feed and sentiment mood, and transitions to a disabled state with countdown: `⏱️ Cào lại sau: 01:59`.
2. **Given** the cooldown timer is actively counting down (e.g. 85s remaining), **When** the user reloads/F5 the browser, **Then** the cooldown resumes from 85s (hydrated from `localStorage`) without resetting to ready.
3. **Given** a direct API caller or bot invokes `POST /api/news/crawl` while cooldown is active, **Then** the backend rejects with HTTP `429 Too Many Requests` and returns `{ error: "Rate limit exceeded. Please wait before crawling again.", retryAfterSeconds: number }`.
4. **Given** a crawl execution is actively in-flight, **When** another request arrives, **Then** the backend rejects with HTTP `409 Conflict` (`{ error: "Crawl in progress. Please wait for current execution to finish." }`).

---

### User Story 2 - Sentiment Distribution Breakdown Bar (Priority: P1)

As a trader, I want to see the exact percentage breakdown of market sentiment (e.g., 58% Positive, 27% Neutral, 15% Negative) for the selected coin and timeframe so that I can quickly assess market polarization and certainty beyond just a single aggregate average score.

**Why this priority**: Transforms the aggregate sentiment card into an intuitive, high-signal financial visual matching modern crypto analytics interfaces.  
**Independent Test**: Query `GET /api/sentiment/aggregate?coin=BTC&timeframe=24h`, assert response includes `positiveRatio`, `neutralRatio`, `negativeRatio`, `positiveCount`, `neutralCount`, `negativeCount` summing to 100%, and verify the UI renders a 3-segment color bar (`#0ecb81` green, `#fcd535` yellow, `#f6465d` red).

**Acceptance Scenarios**:
1. **Given** 10 news articles in the selected timeframe (6 Positive, 3 Neutral, 1 Negative), **When** `GET /api/sentiment/aggregate` is called, **Then** the response returns `positiveRatio: 60`, `neutralRatio: 30`, `negativeRatio: 10`, `articleCount: 10`.
2. **Given** zero articles matching the filter, **When** aggregate sentiment is requested, **Then** the response safely returns `score: 0`, `label: "NEUTRAL"`, `articleCount: 0`, `positiveRatio: 0`, `neutralRatio: 100`, `negativeRatio: 0`.
3. **Given** aggregate sentiment data is loaded on the Frontend, **Then** `NewsFeed.tsx` displays a responsive 3-color breakdown bar with percentage badges and tooltip/labels above the news list.

---

### User Story 3 - 5-Minute Default Scheduled Cronjob (Priority: P2)

As a background system, `NewsCollectorCron` must periodically run every 5 minutes (`*/5 * * * *`) instead of 15 minutes to maintain fresher market sentiment while operating well within external provider safety thresholds.

**Why this priority**: Keeps background news freshness synchronized with standard short-term trading chart timeframes (5m candles).  
**Independent Test**: Verify `NEWS_COLLECTION_CRON_SCHEDULE` constant is `'*/5 * * * *'` and `NewsCollectorCron` triggers every 5 minutes.

**Acceptance Scenarios**:
1. **Given** the NestJS backend is running, **When** a 5-minute interval elapses, **Then** `NewsCollectorCron` automatically executes `newsService.collectAllNews()` and logs processed counts.

---

## Edge Cases

- **Rapid Multiple Clicks**: Frontend disables the button immediately on first click; backend Mutex lock rejects race conditions with HTTP 409.
- **Backend Restart during Cooldown**: Backend in-memory timestamp resets on restart (safe default for local development); frontend checks server response and gracefully handles 429 if timestamps mismatch.
- **Network Failure during Manual Crawl**: Frontend catches the error, displays an informative toast/alert, and does NOT lock the user in a 2-minute cooldown if the request failed before starting.
- **Empty Ingestion Result**: If no new articles exist on RSS/Web feeds, `POST /api/news/crawl` returns `{ success: true, count: 0, message: "No new articles found. Feeds are up to date." }` and starts the cooldown normally.

---

## Requirements

### Functional Requirements

- **FR-001**: Backend MUST provide endpoint `POST /api/news/crawl` to invoke `NewsService.collectAllNews()` on-demand.
- **FR-002**: Backend MUST enforce a 120-second cooldown between successful manual crawl requests, returning HTTP `429 Too Many Requests` with `retryAfterSeconds` when violated.
- **FR-003**: Backend MUST maintain an execution Mutex flag preventing concurrent crawler runs, returning HTTP `409 Conflict` on collisions.
- **FR-004**: Backend `NewsService.getAggregateSentiment()` MUST calculate and return `positiveCount`, `neutralCount`, `negativeCount`, `positiveRatio`, `neutralRatio`, `negativeRatio` (rounded to 1 decimal place, summing to 100%).
- **FR-005**: Frontend `NewsFeed.tsx` MUST render a primary action button `[ ⚡ Cào tin mới ]` in the header bar.
- **FR-006**: Frontend `NewsFeed.tsx` MUST implement a 120-second visual countdown timer persisted in `localStorage` (`news_last_crawl_timestamp`).
- **FR-007**: Frontend `NewsFeed.tsx` MUST render a 3-segment visual distribution bar showing positive (green), neutral (yellow), and negative (red) percentages.
- **FR-008**: Shared library MUST define `NEWS_COLLECTION_CRON_SCHEDULE = '*/5 * * * *'`.

### Key Entities & Data Contracts

- **ManualCrawlResponse**: `{ success: boolean, count: number, message: string }`
- **AggregateSentiment**: Extended with `positiveRatio: number, neutralRatio: number, negativeRatio: number, positiveCount: number, neutralCount: number, negativeCount: number`.

---

## Success Criteria

- **SC-001**: Clicking "Cào tin mới" initiates a crawl and refreshes the news feed in < 3 seconds without full page reload.
- **SC-002**: After clicking, the button is disabled and displays a real-time ticking countdown (`01:59` down to `00:00`). Refreshing the page (F5) preserves the exact remaining countdown time.
- **SC-003**: Sending repeated POST requests to `/api/news/crawl` via curl/Postman within 120 seconds returns status 429 with correct `retryAfterSeconds`.
- **SC-004**: Sentiment breakdown percentages accurately reflect the proportions of positive, neutral, and negative articles for all selected timeframes (`1h`, `24h`, `7d`).

---

## Assumptions

- Rate limiting is scoped per backend process instance (in-memory timestamp), which is optimal and sufficient for the Modular Monolith architecture.
- 120 seconds cooldown provides the ideal balance between live demo agility and external provider courtesy.

---

## KB Cross-References

- **Modules affected**: `kb/modules/news-sentiment.md`, `kb/contracts/news.yaml`
- **E2E flows affected**: `kb/flows/news-sentiment-pipeline.md`
- **Architecture constraints**: Modular Monolith, Process Isolation (ADR-0009), Provider Adapter (ADR-0010)
- **Constitution gates**: Contract-Driven (Principle II), Extension points demonstrable (Principle III), Simplicity over cleverness (Principle IV)
