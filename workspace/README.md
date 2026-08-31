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

## Search Loop chạy tự động 24/7

Search Loop là tiến trình chung của toàn hệ thống. Khi trạng thái mong muốn là `ON`, backend liên tục tạo các lượt tìm kiếm có giới hạn; sau khi một lượt kết thúc, supervisor sẽ tạo lượt tiếp theo. Trạng thái `ON/OFF` được lưu trong PostgreSQL nên không mất khi backend khởi động lại.

### 1. Chạy migration

```bash
cd apps/backend
npx prisma migrate deploy
cd ../..
```

### 2. Cấu hình trạng thái khởi tạo và operator

Thêm vào file `.env`:

```ini
# Chỉ dùng đúng một lần khi DB chưa có SearchLoopControl.
# Đặt true nếu muốn hệ thống tự chạy ngay trên database mới.
SEARCH_LOOP_DEFAULT_ENABLED=true

# UUID của các Supabase user được phép điều khiển Search Loop.
# Nhiều UUID được phân cách bằng dấu phẩy.
SEARCH_LOOP_OPERATOR_USER_IDS=1d3f9f46-5f13-4c8f-9ae2-6c386fbf4b13
```

Có thể lấy UUID tại **Supabase Dashboard → Authentication → Users → User UID**. Sau khi thay đổi danh sách operator, cần khởi động lại backend.

Quy tắc ưu tiên trạng thái:

```text
DB chưa có SearchLoopControl  → tạo row theo SEARCH_LOOP_DEFAULT_ENABLED
DB đã có SearchLoopControl    → dùng trạng thái ON/OFF trong DB
```

Vì vậy, `SEARCH_LOOP_DEFAULT_ENABLED=true` không bật lại loop nếu operator đã chủ động tắt và DB đang lưu `enabled=false`. Muốn bật lại, operator phải gọi API `control/enable`.

Nếu `SEARCH_LOOP_OPERATOR_USER_IDS` bị bỏ trống, các API đọc trạng thái vẫn hoạt động nhưng toàn bộ API thay đổi Search Loop sẽ bị chặn. Anonymous nhận `401 Unauthorized`; user đã đăng nhập nhưng không nằm trong danh sách nhận `403 Forbidden`.

### 3. Bật Search Loop bằng API

Bước này không cần thiết nếu database mới đã được seed với `SEARCH_LOOP_DEFAULT_ENABLED=true`. Với database đang lưu `OFF`, dùng access token của một operator để bật lại:

```powershell
$token = "<Supabase access token của operator>"
$body = @{
  generatorType = "RANDOM"
  pair = "BTCUSDT"
  timeframe = "1h"
  backtestWindowDays = 180
  backtestConfig = @{
    initialCapital = 10000
    positionSizePercent = 100
    commission = 0.001
    slippage = 0.001
  }
  maxCandidatesPerRun = 100
  maxDurationMsPerRun = $null
  stopOnNoImprovementIterations = 50
  cooldownMs = 30000
} | ConvertTo-Json -Depth 4

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3001/api/loop/control/enable" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $body
```

### API vận hành

| Method | Endpoint | Quyền | Ý nghĩa |
|--------|----------|-------|---------|
| `GET` | `/api/loop/control` | Public | Xem desired state, retry và lease |
| `GET` | `/api/loop/current` | Public | Xem lượt tìm kiếm đang chạy |
| `POST` | `/api/loop/control/enable` | Operator | Lưu `ON` và cấu hình cho các lượt tiếp theo |
| `POST` | `/api/loop/control/disable` | Operator | Lưu `OFF` và dừng lượt đang chạy |
| `PUT` | `/api/loop/control/config` | Operator | Cập nhật cấu hình mà không đổi `ON/OFF` |
| `POST` | `/api/loop/start` | Operator | Khởi động thủ công một lượt |
| `POST` | `/api/loop/:loopRunId/pause` | Operator | Tạm dừng một lượt |
| `POST` | `/api/loop/:loopRunId/resume` | Operator | Tiếp tục một lượt |
| `POST` | `/api/loop/:loopRunId/stop` | Operator | Dừng một lượt |

> Nút **Live updates** trên frontend chỉ bật/tắt cập nhật realtime của leaderboard. Nó không bật, tắt hoặc khởi động lại Search Loop.

## Knowledge Base

The `../kb/` directory is the single source of truth for architecture, contracts, and decisions.
See [kb/INDEX.md](../kb/INDEX.md) for navigation.

## License

UNLICENSED — Course project.
