# Crypto Strategy Lab

Platform for analyzing, combining, and evaluating crypto trading strategies.
**Architecture quality over trading profitability.**

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | NestJS (TypeScript) | 11.x |
| Frontend | Next.js (TypeScript) | 16.x |
| Database | PostgreSQL + Prisma | 16 / 6.x |
| Events | EventEmitter2 (NestJS) | 3.x |
| Backtest Queue | BullMQ + Redis | 5.x / 7.x |
| Sentiment | Python FastAPI + VADER | 0.115+ |
| Monorepo | Turborepo + npm workspaces | 2.x |

## Monorepo Structure

```
crypto-strategy-lab/
├── apps/
│   ├── backend/                    # NestJS modular monolith (port 3001)
│   │   ├── src/
│   │   │   ├── market-data/       # Hoang — Binance adapter, WS gateway, caching
│   │   │   ├── strategy/          # Huy — registry, strategies, composite, backtest, search
│   │   │   ├── news/              # Thuan — providers, sentiment client, sentiment strategy
│   │   │   ├── events/            # Phuong — IEventBus (EventEmitter2 wrapper)
│   │   │   ├── queue/             # Phuong — BullMQ/Redis IJobQueue, worker, dead-letter audit
│   │   │   ├── leaderboard/       # Phuong — top-K ranking (Observer pattern)
│   │   │   ├── loop/              # Phuong — strategy search loop controller
│   │   │   ├── dashboard/         # Phuong — BFF REST + WebSocket gateway
│   │   │   ├── database/          # Shared — PrismaService
│   │   │   ├── shared/            # Hoang — constants, shared utilities
│   │   │   └── prisma/            # schema.prisma
│   ├── frontend/                  # Next.js dashboard (port 3000)
│   │   └── src/
│   │       ├── app/               # App router (dashboard, strategies, leaderboard, news)
│   │       ├── components/        # Chart, strategy, leaderboard, news components
│   │       ├── hooks/             # useWebSocket, useMarketData, useLeaderboard
│   │       └── services/          # REST + WebSocket API clients
│   └── sentiment/                 # Python FastAPI (port 8000)
│       ├── app.py                 # FastAPI entry point
│       ├── analyzer.py            # VADER sentiment analyzer
│       └── requirements.txt       # Python dependencies
├── libs/
│   └── shared/                    # @crypto-strategy-lab/shared — TS types & interfaces
│       └── src/
│           ├── types/             # Candle, Signal, Trade, BacktestResult...
│           ├── interfaces/        # IStrategy, IMarketDataAdapter, IEventBus, IJobQueue...
│           ├── events/            # EventType constants + payload interfaces
│           └── index.ts          # Barrel export
├── kb/                            # Knowledge Base (SDD single source of truth)
│   ├── contracts/                 # YAML contracts (market-data, strategy, news, events)
│   ├── modules/                   # Module architecture docs
│   ├── flows/                     # End-to-end flow docs
│   ├── ADR/                       # Architecture Decision Records (0001-0013)
│   └── ...
├── plans/                         # Project plan & requirement spec
├── docker-compose.yml             # PostgreSQL 16 + Redis 7
├── turbo.json                     # Turborepo task pipeline
├── package.json                   # Root workspace config
└── .env.example                   # Environment template
```

## Team Assignments

| Member | Modules | ADRs |
|--------|---------|------|
| Hoang (Lead) | Market Data, Shared Infrastructure, Database | 0001, 0002, 0004, 0007 |
| Huy | Strategy Engine (registry, composite, backtest, search) | 0003, 0008 |
| Thuan | News & Sentiment (providers, Python service, sentiment strategy) | 0009, 0010 |
| Phuong | Event Infrastructure (bus, BullMQ/Redis queue, leaderboard, loop, dashboard) | 0005, 0006, 0011, 0013 (supersedes 0012) |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure (PostgreSQL + Redis)

```bash
docker-compose up -d
```

Redis is required by the target BullMQ backtest queue. The target Compose configuration enables
AOF persistence so waiting and delayed jobs survive a backend restart.

> Documentation status: BullMQ/Redis is the accepted target architecture. Its source-code and
> Compose rollout is tracked by `../sdd_artifacts/event-infrastructure-dashboard/tasks.md`.

### 3. Set up environment

```bash
cp .env.example .env
# Edit .env with your Binance API keys
```

### 4. Generate Prisma client & run migrations

```bash
cd apps/backend
npx prisma generate
npx prisma migrate dev --name init
cd ../..
```

### 5. Start development servers

```bash
# All services (backend + frontend):
npm run dev

# Sentiment service (separate terminal):
cd apps/sentiment
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Knowledge Base

The `../kb/` directory is the single source of truth for architecture, contracts, and decisions.
See [kb/INDEX.md](../kb/INDEX.md) for navigation.

## License

UNLICENSED — Course project.
