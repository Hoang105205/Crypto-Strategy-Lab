# Quickstart: Gemini LLM Web Crawler Selector Discovery

## Prerequisites
- Node.js 20+, PostgreSQL running locally.
- (Optional) `GEMINI_API_KEY` set in `.env` or `workspace/apps/backend/.env`.

## Setup
```bash
cd workspace
npm run build --workspace=@crypto-strategy-lab/backend
```

## Validation Scenarios

### Scenario 1: Successful Gemini LLM Selector Discovery (Happy Path)
1. Set `GEMINI_API_KEY=AIzaSy...` in `.env`.
2. Invoke `CrawlerDiscoveryService.discoverSelectors(htmlSample, 'theblock.co', 'https://theblock.co/latest')`.
3. ✅ Expected:
   - Log output: `[GeminiDiscoveryClient] Successfully discovered selectors via Gemini 2.5 Flash for theblock.co`.
   - Returns valid `DiscoveredRule` with custom CSS selectors.

### Scenario 2: Missing GEMINI_API_KEY Fallback
1. Unset `GEMINI_API_KEY` or leave it empty.
2. Invoke `CrawlerDiscoveryService.discoverSelectors(htmlSample, 'theblock.co', 'https://theblock.co/latest')`.
3. ✅ Expected:
   - Log output: `[GeminiDiscoveryClient] GEMINI_API_KEY is not configured. Falling back to Cheerio semantic heuristics.`.
   - Returns valid `DiscoveredRule` without throwing exceptions.

### Scenario 3: Gemini API 429 / Timeout / Network Error Fallback
1. Mock a network failure or 10s timeout on Gemini API endpoint.
2. Invoke `CrawlerDiscoveryService.discoverSelectors(htmlSample, 'theblock.co', 'https://theblock.co/latest')`.
3. ✅ Expected:
   - Log output: `[CrawlerDiscoveryService] Gemini discovery failed: ... Falling back to Cheerio heuristics.`.
   - Returns valid `DiscoveredRule` and saves to PostgreSQL.

### Scenario 4: Self-Healing Trigger on Web Redesign
1. Trigger `CrawlerDiscoveryService.repairSelectors(redesignedHtml, 'theblock.co', 'https://theblock.co/latest')`.
2. ✅ Expected:
   - Updates `CrawlerRule` in PostgreSQL with new selectors and updated `lastDiscoveredAt`.
   - `WebCrawlerProvider` successfully extracts articles using the repaired rule.
