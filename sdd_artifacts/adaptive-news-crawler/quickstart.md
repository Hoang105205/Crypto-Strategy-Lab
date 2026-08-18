# Quickstart: `adaptive-news-crawler`

## Verification & Execution Guide

### 1. Run Prisma Database Migration & Generate Client
```bash
cd workspace/apps/backend
npx prisma db push
npx prisma generate
```

### 2. Run All Unit Tests
```bash
cd workspace/apps/backend
npx jest src/news --verbose
```

### 3. Verify TypeScript Compilation & ESLint
```bash
cd workspace/apps/backend
npx tsc --noEmit -p tsconfig.json
```

### 4. Live Smoke Test Scenario
1. Start backend: `npm run start:dev` in `workspace/apps/backend`.
2. Start frontend: `npm run dev` in `workspace/apps/frontend`.
3. Open `http://localhost:3000/news`:
   - Verify articles from both RSS and Web Crawler appear.
   - Verify articles with source `Decrypt Web` are tagged with dynamic coin symbols (or `GENERAL`).
   - Verify VADER sentiment badges (POSITIVE, NEGATIVE, NEUTRAL) render correctly.
