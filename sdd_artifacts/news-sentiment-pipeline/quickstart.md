# Quickstart: Crypto News & Sentiment Analysis Pipeline

## Prerequisites

1. **Node.js 20+ & npm**: Monorepo package management
2. **Python 3.13+**: Required for FastAPI sentiment micro-service
3. **Docker Desktop / PostgreSQL 16**: Relational database persistence

## Setup & Execution

### 1. Database & Monorepo Setup (Workspace Root)
```bash
# Terminal 1 (workspace/)
npm install
docker-compose up -d

cd apps/backend
npx prisma generate
npx prisma migrate dev --name init
```

### 2. Python Sentiment Micro-Service (Port 8000)
```bash
# Terminal 2 (workspace/apps/sentiment)
python -m pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8000
```

### 3. NestJS Backend & Next.js Frontend (Ports 3001 & 3000)
```bash
# Terminal 1 (workspace/)
npm run dev
```

---

## Validation Scenarios

### Scenario 1: Python Sentiment Health Check
1. Open browser or cURL: `http://localhost:8000/health`
2. ✅ Expected: `{"status": "ok"}`

### Scenario 2: Test Direct Python Sentiment Analysis
```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"Bitcoin price skyrockets after SEC approves all ETF applications\"}"
```
✅ Expected: `{"score": 0.8... , "label": "POSITIVE"}`

### Scenario 3: Test NestJS News API Endpoint
1. Open browser: `http://localhost:3001/api/news?coin=BTC`
2. ✅ Expected: JSON payload with `success: true` and article list containing `crawledAt`, `relatedCoins`, `sentimentScore`, `sentimentLabel`.

### Scenario 4: Test Graceful Degradation (Python Service Down)
1. Stop Python service (`Ctrl + C` in Terminal 2).
2. Fetch NestJS API: `http://localhost:3001/api/news?coin=BTC`
3. ✅ Expected: NestJS does NOT crash. Articles return with fallback `sentimentScore: 0.0` and `sentimentLabel: "NEUTRAL"`, and `NewsSentimentStrategy` emits `HOLD`.
