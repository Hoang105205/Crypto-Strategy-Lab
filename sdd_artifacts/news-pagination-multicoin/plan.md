# Implementation Plan: News Feed Offset Pagination & Multi-Coin Filter

**Feature**: `news-pagination-multicoin` | **Date**: 2026-08-13 | **Spec**: spec.md

## Summary
Triển khai nâng cấp tính năng Phân trang Offset Pagination (`limit`, `offset`) và Lọc theo 1 hoặc nhiều đồng coin (`coin`, `coins`) cho Module News & Sentiment. Kế hoạch này áp dụng nhất quán từ Hợp đồng Hạt nhân (Kernel Contracts) trong KB (`kb/contracts/news.yaml`), nâng cấp Backend NestJS Service & Controller, cho tới việc hỗ trợ cả 2 dạng giao diện Frontend: nút "📰 More stories" và thanh chuyển trang đánh số `< 1 2 3 ... X >`.

## Technical Context
**Language/Version**: TypeScript 5.0+ (Node.js 18+)  
**Primary Dependencies**: NestJS, Prisma ORM, Next.js 14 App Router, React 18  
**Storage**: PostgreSQL (Prisma ORM)  
**Testing**: Jest unit/integration testing  
**Target Platform**: Monorepo Web Application (`workspace/apps/backend` & `workspace/apps/frontend`)  
**Project Type**: REST API & Fullstack Web Interface  
**Performance Goals**: API response time < 100ms cho truy vấn phân trang tin tức  
**Constraints**: Tuân thủ Điều lệ Dự án (Constitution Article VI: Explicit Over Implicit Contracts)  

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **Art I: Single Source of Truth (KB)** | ✅ PASS | Đã cập nhật KB `kb/contracts/news.yaml`, `kb/modules/news-sentiment.md`, `kb/flows/news-sentiment-pipeline.md` |
| **Art II: Process Isolation** | ✅ PASS | Giữ nguyên cô lập dịch vụ Python VADER ML trên port 8000 |
| **Art III: Fault Tolerance** | ✅ PASS | Graceful fallback neutral (0.0 / HOLD) giữ nguyên khi Python sập |
| **Art VI: Explicit Over Implicit** | ✅ PASS | Hợp đồng API trả về Metadata `pagination` rõ ràng (`total`, `limit`, `offset`, `hasMore`) |

## Architecture Decision
- **Approach**: Mở rộng module `NewsModule` sẵn có trong NestJS Backend và component `NewsFeed` trong Next.js Frontend.
- **Rationale**: Phù hợp với kiến trúc Modular Monolith. `NewsController` và `NewsService` nhận các tham số query mới (`offset`, `coins`), thực thi câu lệnh Prisma ORM `skip`/`take` và `hasSome`/`has`, đồng thời trả về Metadata phân trang chuẩn hóa.
- **Modules affected**: `apps/backend/src/news/`, `apps/frontend/src/components/news/NewsFeed.tsx`
- **E2E flows affected**: `flows/news-sentiment-pipeline.md`

## Source Code Structure

```text
workspace/
├── apps/backend/src/news/
│   ├── news.controller.ts            # Nâng cấp GET /api/news (limit, offset, coin, coins)
│   └── services/news.service.ts      # Prisma count(), findMany({ skip, take, where })
└── apps/frontend/src/components/news/
    └── NewsFeed.tsx                  # Next.js UI hỗ trợ Load More + Numbered Pagination < 1 2 3 ... X >
```
