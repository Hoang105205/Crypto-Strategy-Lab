# Module: Event Infrastructure

> **Owner**: Member D
> **Status**: Draft
> **Last Updated**: 2026-08-05

## 1. Overview
- **Responsibility**: The system's nervous system — event bus, job queue, leaderboard, search loop orchestration, and dashboard BFF
- **Layer**: Backend
- **Depends on**: `IBacktester`, `IStrategyGenerator` (shared interfaces only)
- **Depended by**: All modules (publish/subscribe), Frontend (dashboard BFF)
- **Contracts**: `kb/contracts/events.yaml`
- **Source files**: `apps/backend/events/`, `queue/`, `leaderboard/`, `loop/`, `dashboard/`
- **Related ADRs**: ADR-0005 (Event-Driven Communication), ADR-0006 (Job Queue + Worker), ADR-0011 (Leaderboard as Observer), ADR-0012 (BullMQ Migration Path)

## 2. Component Architecture

### Components
| Component | Responsibility | Pattern | File(s) |
|-----------|---------------|---------|---------|
| EventBus | EventEmitter2, typed events | Event-Driven | [TODO] |
| JobQueue | Worker pool, retry, dead-letter queue | Job Queue/Worker | [TODO] |
| Leaderboard | Top-K ranking, Observer of BacktestCompleted | Observer | [TODO] |
| LoopController | Search orchestration via events | Orchestrator | [TODO] |
| DashboardService | API composition layer | BFF | [TODO] |

### Component Diagram
[TODO: fill during planning phase]

## 3. Design Patterns

### Event-Driven Architecture
- **Where**: EventBus — modules publish, never call each other
- **Why**: Full decoupling; swap EventEmitter2 → Redis Pub/Sub via config
- **How**: [TODO]
- **Trade-offs**: [TODO]

### Job Queue / Worker
- **Where**: Backtest execution
- **Why**: Long-running backtests must not block the API; scale via workers
- **How**: [TODO]
- **Trade-offs**: [TODO]

### Observer
- **Where**: Leaderboard subscribes to `BacktestCompleted`
- **Why**: Leaderboard reacts without the Strategy Engine knowing it exists
- **How**: [TODO]
- **Trade-offs**: [TODO]

## 4. Internal Data Flow
[TODO: fill during planning phase]

## 5. Sequence Diagrams

### Backtest Request → Completion → Leaderboard Update
[TODO: fill during planning phase]

## 6. Data Model
| Entity | Fields | Relationships |
|--------|--------|---------------|
| LeaderboardEntry | [TODO] | [TODO] |
| SearchLoopRun | [TODO] | [TODO] |

## 7. API Surface
See `kb/contracts/events.yaml`. [TODO: summarize endpoints here]

## 8. Quality Attributes
- **Security**: [TODO]
- **Performance**: Scale 100 → 100k backtests by adding workers [TODO]
- **Error handling**: Retry + dead-letter queue for failed jobs [TODO]

## 9. Testing Strategy
- **Unit tests**: [TODO]
- **Integration tests**: Event flow E2E (publish → worker → observer) [TODO]

## 10. Open Questions / TODOs
- [ ] [unresolved items]
