# Analysis Report: strategy-rest-events

**Date**: 2026-08-13
**Scope**: spec.md, plan.md, tasks.md, kb/contracts/strategy.yaml, strategy.controller.ts, strategy-versioning.service.ts
**Overall Health**: 🟡 Warning

## Findings

### [MEDIUM] [F-001]: Route Parameter Mismatch for Strategy Versions
**Category**: contracts-code
**Location**: `kb/contracts/strategy.yaml` vs `apps/backend/src/strategy/controllers/strategy.controller.ts:133`
**Description**: Hợp đồng (contract) yêu cầu endpoint `GET /api/strategies/:id/versions` (list all versions of a strategy type), tuy nhiên trong `strategy.controller.ts`, endpoint được implement là `@Get(':name/versions')`. Sự không đồng nhất này có thể gây lỗi khi Frontend gọi API bằng ID thay vì Name.
**Impact**: Frontend bám theo contract sẽ gọi sai URL và nhận HTTP 404.
**Recommendation**: Đổi route trong controller thành `@Get(':id/versions')` và cập nhật logic lấy dữ liệu tương ứng (nếu `:id` đại diện cho UUID của strategy gốc hoặc strategy type). Hoặc cập nhật lại file `strategy.yaml` nếu team quyết định dùng `:name/versions` là hợp lý hơn.

### [LOW] [F-002]: Hardcoded Mock Data in Backtest Endpoint
**Category**: tasks-code
**Location**: `apps/backend/src/strategy/controllers/strategy.controller.ts:114`
**Description**: Endpoint `GET /api/strategies/backtest/:id` hiện đang trả về dữ liệu mock (cứng) thay vì lấy từ Database.
**Impact**: MVP vẫn hoạt động cho frontend, nhưng không sử dụng được trên thực tế.
**Recommendation**: Ghi chú lại technical debt này để xử lý ngay khi module `database` (Prisma) và Job Queue Worker được hoàn thiện.

## Summary
| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 1 |

## Constitution Compliance
| Principle | Status | Violations |
|-----------|--------|-----------|
| Modular Monolith Boundaries | ✅ | 0 |
| Separation of Concerns | ✅ | 0 |
| Single Source of Truth (Contracts) | ⚠️ | 1 (F-001) |

## Recommended Actions
1. Quyết định xem nên sử dụng `:id/versions` hay `:name/versions` và chạy `/hoang-sdd-converge` để đồng bộ lại source code với tài liệu.
2. Lên kế hoạch tích hợp Prisma Repository cho BacktestResult ở phase kế tiếp.
