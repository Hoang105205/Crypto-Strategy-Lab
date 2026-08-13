# Implementation Plan: Aggregate Mood Score Timeframe Selector

**Feature**: `sentiment-timeframe-selector` | **Date**: 2026-08-13 | **Spec**: spec.md

## Summary
Triển khai bộ chọn mốc thời gian Timeframe Selector (`1h`, `24h`, `7d`) cho thẻ điểm tâm lý gộp (Aggregate Mood Score Card) trên giao diện News Feed (`NewsFeed.tsx`). Nâng cấp này cho phép người dùng tùy chọn khung thời gian phân tích tâm lý thị trường, gửi query param `timeframe` tương ứng tới REST API `GET /api/sentiment/aggregate` và duy trì đồng bộ trạng thái khi lọc theo đồng coin.

## Technical Context
**Language/Version**: TypeScript 5.0+ (Node.js 18+)  
**Primary Dependencies**: Next.js 14 App Router, React 18, NestJS Backend  
**Storage**: PostgreSQL (Prisma ORM)  
**Testing**: Vitest / React Testing Library  
**Target Platform**: Monorepo Web Application (`workspace/apps/frontend` & `workspace/apps/backend`)  
**Project Type**: REST API & Fullstack Web Interface  
**Performance Goals**: Cập nhật chỉ số điểm tâm lý trên UI < 150ms  
**Constraints**: Tuân thủ Điều lệ Dự án (Constitution Article VI: Explicit Over Implicit Contracts)  

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **Art I: Single Source of Truth (KB)** | ✅ PASS | Đã cập nhật KB `kb/contracts/news.yaml`, `kb/modules/news-sentiment.md`, `kb/flows/news-sentiment-pipeline.md` |
| **Art II: Process Isolation** | ✅ PASS | Giữ nguyên cô lập dịch vụ Python VADER ML trên port 8000 |
| **Art III: Fault Tolerance** | ✅ PASS | Graceful fallback neutral (0.0 / HOLD) giữ nguyên khi không có bài báo trong timeframe |
| **Art VI: Explicit Over Implicit** | ✅ PASS | Hợp đồng API `GET /api/sentiment/aggregate` nhận tham số `timeframe` tường minh (`1h` \| `24h` \| `7d`) |

## Architecture Decision
- **Approach**: Mở rộng component `NewsFeed.tsx` trong Next.js Frontend. Thêm state `selectedTimeframe` (`'1h' | '24h' | '7d'`), dựng bộ nút chọn Timeframe Selector pill-buttons bên trong thẻ Aggregate Mood Header, và cập nhật hàm gọi API `fetchNewsData` / `fetchAggregateSentiment`.
- **Rationale**: Phù hợp với kiến trúc Modular Monolith. Backend REST API `/api/sentiment/aggregate` đã hỗ trợ sẵn tham số `timeframe`.
- **Modules affected**: `apps/frontend/src/components/news/NewsFeed.tsx`, `apps/backend/src/news/news.controller.ts`
- **E2E flows affected**: `kb/flows/news-sentiment-pipeline.md`

## Source Code Structure

```text
workspace/
├── apps/frontend/src/components/news/
│   └── NewsFeed.tsx                  # Thêm UI Timeframe Selector pills (1h | 24h | 7d) & state management
└── apps/backend/src/news/
    └── news.controller.ts            # Đảm bảo default timeframe là '24h' nếu không truyền
```
