# HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG TOÀN DIỆN — CRYPTO STRATEGY LAB
> **File tài liệu**: `README.md`  
> **Dự án**: Crypto Strategy Lab (`Hoang105205/Crypto-Strategy-Lab`)  
> **Kiến trúc**: Modular Monolith (NestJS + Next.js + Python FastAPI + Redis + PostgreSQL)  
> **Ngày cập nhật**: 04/09/2026  

---

## 📑 MỤC LỤC

1. [Yêu cầu môi trường (Prerequisites)](#1-yêu-cầu-môi-trường-prerequisites)
2. [Cài đặt & Thiết lập ban đầu (Setup from Scratch)](#2-cài-đặt--thiết-lập-ban-đầu-setup-from-scratch)
   - [Bước 1: Cài đặt Monorepo Dependencies](#bước-1-cài-đặt-monorepo-dependencies)
   - [Bước 2: Cấu hình biến môi trường (.env)](#bước-2-cấu-hình-biến-môi-trường-env)
   - [Bước 3: Khởi chạy hạ tầng Docker (Redis)](#bước-3-khởi-chạy-hạ-tầng-docker-redis)
   - [Bước 4: Cài đặt Python Sentiment Service](#bước-4-cài-đặt-python-sentiment-service)
   - [Bước 5: Khởi tạo Prisma Client & Database](#bước-5-khởi-tạo-prisma-client--database)
3. [Khởi chạy các Services (Running the System)](#3-khởi-chạy-các-services-running-the-system)
   - [Cách 1: Khởi chạy toàn bộ bằng Turborepo (Khuyên dùng)](#cách-1-khởi-chạy-toàn-bộ-bằng-turborepo-khuyên-dùng)
   - [Cách 2: Khởi chạy từng tiến trình riêng biệt (3 Terminals)](#cách-2-khởi-chạy-từng-tiến-trình-riêng-biệt-3-terminals)
4. [Kiểm thử tự động toàn diện (Running Tests)](#4-kiểm-thử-tự-động-toàn-diện-running-tests)
5. [Vận hành Search Loop 24/7 (Loop Controller API)](#5-vận-hành-search-loop-247-loop-controller-api)
6. [Bảng tổng hợp Cổng mạng (Ports), URLs & Health Checks](#6-bảng-tổng-hợp-cổng-mạng-ports-urls--health-checks)
7. [Xử lý sự cố thường gặp (Troubleshooting & FAQ)](#7-xử-lý-sự-cố-thường-gặp-troubleshooting--faq)

---

# 1. YÊU CẦU MÔI TRƯỜNG (PREREQUISITES)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các công cụ sau:

| Công cụ | Phiên bản khuyến nghị | Mục đích sử dụng | Kiểm tra cài đặt |
|---|---|---|---|
| **Node.js** | `>= 20.x` (LTS) | Runtime cho NestJS Backend & Next.js Frontend | `node -v` |
| **npm** | `>= 10.x` | Quản lý Monorepo Workspaces | `npm -v` |
| **Python** | `>= 3.10` / `3.11` / `3.13` | Chạy Sentiment Analysis Service (FastAPI) | `python --version` |
| **Docker & Docker Compose** | Phiên bản mới nhất | Chạy Redis 7 (Hàng đợi BullMQ) & Database | `docker --version` |
| **Git** | Bất kỳ | Quản lý mã nguồn | `git --version` |

---

# 2. CÀI ĐẶT & THIẾT LẬP BAN ĐẦU (SETUP FROM SCRATCH)

Mở Terminal (PowerShell / Command Prompt / Bash) và điều hướng vào thư mục `workspace`:

```powershell
# Điều hướng vào thư mục workspace của dự án
cd workspace
```

---

### Bước 1: Cài đặt Monorepo Dependencies

Dự án sử dụng npm workspaces kết hợp Turborepo. Lệnh sau sẽ tự động cài đặt package cho toàn bộ root, `apps/backend`, `apps/frontend` và `libs/shared`:

```powershell
# Cài đặt toàn bộ packages
npm install
```

---

### Bước 2: Cấu hình biến môi trường (`.env`)

Tạo file `.env` từ file mẫu `.env.example` trong thư mục `workspace`:

```powershell
# Trên Windows PowerShell:
Copy-Item .env.example .env

# Hoặc trên Linux/macOS/Git Bash:
cp .env.example .env
```

Mở file `.env` và cập nhật các thông số cần thiết:
* `DATABASE_URL`: Đường dẫn kết nối PostgreSQL (Supabase hoặc local PostgreSQL).
* `REDIS_HOST=localhost`, `REDIS_PORT=6379`: Kết nối Redis cho BullMQ.
* `GEMINI_API_KEY`: API Key của Google Gemini (để dùng tính năng LLM Crawler Selector Discovery).
* `SENTIMENT_SERVICE_URL=http://localhost:8000`: Kết nối tới Python FastAPI service.

---

### Bước 3: Khởi chạy hạ tầng Docker (Redis)

Khởi động container Redis 7 ở chế độ background:

```powershell
# Khởi chạy Redis container
docker-compose up -d

# Kiểm tra container đang chạy:
docker ps
```
> *Container `csl-redis` sẽ lắng nghe tại cổng `6379`.*

---

### Bước 4: Cài đặt Python Sentiment Service

Mở terminal điều hướng vào `apps/sentiment` và cài đặt dependencies cho Python:

```powershell
# Di chuyển vào thư mục sentiment service
cd apps/sentiment

# Cài đặt thư viện (FastAPI, Uvicorn, VADER Sentiment, NLTK...)
pip install -r requirements.txt

# Quay trở lại thư mục workspace
cd ../..
```

---

### Bước 5: Khởi tạo Prisma Client & Database

Sinh mã nguồn Prisma Client và áp dụng migrations vào Database:

```powershell
# Di chuyển vào backend
cd apps/backend

# Sinh Prisma Client
npx prisma generate

# Đồng bộ Database Schema (Deploy migrations)
npx prisma migrate deploy

# Quay trở lại thư mục workspace
cd ../..
```

---

# 3. KHỞI CHẠY CÁC SERVICES (RUNNING THE SYSTEM)

---

### Khởi chạy từng tiến trình riêng biệt

#### Terminal 1: Backend (NestJS - Port 3001)
```powershell
cd workspace/apps/backend
npm run start:dev
```

#### Terminal 2: Frontend (Next.js - Port 3000)
```powershell
cd workspace/apps/frontend
npm run dev
```

#### Terminal 3: Sentiment Service (Python FastAPI - Port 8000)
```powershell
cd workspace/apps/sentiment
uvicorn app:app --reload --port 8000
```

---

# 4. KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN (RUNNING TESTS)

Hệ thống có **88 test suites** (68 Backend + 20 Frontend) đảm bảo chất lượng kiến trúc.

### 1. Chạy toàn bộ 88 Test Suites (Toàn bộ monorepo):
Tại thư mục `workspace`:
```powershell
npm run test
```

### 2. Chạy riêng Backend Tests (Jest):
```powershell
cd workspace/apps/backend
npm run test

# Chạy test kèm theo bảng thống kê độ phủ (Coverage):
npm run test:cov
```

### 3. Chạy riêng Frontend Tests (React Testing Library / Vitest):
```powershell
cd workspace/apps/frontend
npm run test
```

---

# 5. VẬN HÀNH SEARCH LOOP 24/7 (LOOP CONTROLLER API)

Search Loop có thể tự động chạy 24/7 để tìm kiếm chiến lược tối ưu. Dưới đây là các lệnh PowerShell / cURL để kiểm tra và điều khiển loop:

### 1. Kiểm tra trạng thái Search Loop (Public API):
```powershell
# Xem cấu hình điều khiển loop mong muốn
Invoke-RestMethod -Method Get -Uri "http://localhost:3001/api/loop/control"

# Xem lượt tìm kiếm (Run) đang thực thi hiện tại
Invoke-RestMethod -Method Get -Uri "http://localhost:3001/api/loop/current"
```

### 2. Kích hoạt Search Loop (Bật ON):
```powershell
$body = @{
  generatorType = "DOMAIN_GUIDED" # hoặc "RANDOM"
  pair = "BTCUSDT"
  timeframe = "1h"
  backtestWindowDays = 180
  backtestConfig = @{
    initialCapital = 10000
    positionSizePercent = 100
    commission = 0.001
    slippage = 0.001
  }
  maxCandidatesPerRun = 50
  maxDurationMsPerRun = $null
  stopOnNoImprovementIterations = 20
  cooldownMs = 15000
} | ConvertTo-Json -Depth 4

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3001/api/loop/control/enable" `
  -ContentType "application/json" `
  -Body $body
```

### 3. Tắt Search Loop (Dừng OFF):
```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3001/api/loop/control/disable" `
  -ContentType "application/json"
```

---

# 6. BẢNG TỔNG HỢP CỔNG MẠNG (PORTS), URLS & HEALTH CHECKS

| Thành phần | Công nghệ | Cổng / URL | Mô tả / Kiểm tra |
|---|---|---|---|
| **Frontend UI** | Next.js | `http://localhost:3000` | Giao diện Dashboard, Chart, Strategy Builder, Leaderboard, News |
| **Backend REST API** | NestJS | `http://localhost:3001/api` | API Gateway, Market Data, Search, Leaderboard, Auth |
| **Market Data WS** | Socket.IO / WS | `ws://localhost:3001` | Kênh stream nến và volume realtime từ Binance |
| **Sentiment Service** | FastAPI (Python) | `http://localhost:8000` | Swagger UI tài liệu API tại: `http://localhost:8000/docs` |
| **Job Queue & Cache** | Redis 7 | `localhost:6379` | Hàng đợi BullMQ phân phối jobs cho Backtest Workers |
| **Database** | PostgreSQL | `localhost:5432` / Supabase | Lưu trữ nến, chiến lược, lịch sử thực nghiệm, tin tức |

---

# 7. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING & FAQ)

### 🔴 1. Lỗi cổng (Port) đã bị chiếm dụng (EADDRINUSE 3000 / 3001 / 8000 / 6379)
* **Nguyên nhân**: Tiến trình cũ chưa tắt hoàn toàn.
* **Cách xử lý trên Windows**:
```powershell
# Tìm tiến trình đang chiếm cổng (ví dụ cổng 3001):
netstat -ano | findstr :3001

# Tắt tiến trình bằng PID:
taskkill /PID <PID_NUMBER> /F
```

### 🔴 2. Backend báo lỗi không kết nối được Redis (`ECONNREFUSED 127.0.0.1:6379`)
* **Nguyên nhân**: Container Redis chưa được bật.
* **Cách xử lý**:
```powershell
cd workspace
docker-compose up -d
docker ps
```

### 🔴 3. Lỗi Prisma Client (`PrismaClientInitializationError` hoặc `Cannot find module '@prisma/client'`)
* **Cách xử lý**:
```powershell
cd workspace/apps/backend
npx prisma generate
npx prisma migrate deploy
```

### 🔴 4. Python Sentiment Service báo thiếu thư viện VADER Lexicon
* **Cách xử lý**:
```powershell
python -c "import nltk; nltk.download('vader_lexicon')"
```

---
*Hoàn thành hướng dẫn khởi chạy! Bạn đã sẵn sàng để demo toàn bộ hệ thống.*
