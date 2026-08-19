# Quickstart: news-sentiment-sync

## Prerequisites
- Backend is running (`npm start` in `apps/backend`).
- Sentiment API is running (`uvicorn app:app` in `apps/sentiment`).
- Frontend is running (`npm run dev` in `apps/frontend`).

## Setup
No special database migrations required. Just apply the code changes and restart the backend.

## Validation Scenarios

### Scenario 1: NewsSentimentStrategy Functional Check
1. Open the UI, select `NewsSentimentStrategy`.
2. Enter valid Date range and Capital.
3. Click `Launch Backtest`.
4. ✅ Expected: The system queues the job, processes it, and returns a table of Trades (assuming there is news sentiment varying enough to trigger BUY/SELL).

### Scenario 2: Synchronous Strategy Integrity
1. Open the UI, select `MacdStrategy` or `MovingAverage`.
2. Click `Launch Backtest`.
3. ✅ Expected: The system still processes the job correctly without errors, proving backwards compatibility.
