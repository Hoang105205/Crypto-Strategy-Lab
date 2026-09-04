# Research: Immutable Strategy Enforcement

## Decisions

### D1: UI Deletion Removal vs Disabled Button
- **Chosen**: Completely remove the "DELETE" button and all delete event handlers from [`StrategyCard`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/components/strategy/StrategyCard.tsx) and [`page.tsx`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/frontend/src/app/strategy/page.tsx).
- **Rationale**: Having a disabled button or a button that pops up an alert saying "Cannot delete" creates visual clutter and user frustration. Removing it completely establishes a clear UI affordance: strategies are permanent, immutable analytical models once registered or composed.
- **Alternatives considered**:
  - *Keep button disabled with tooltip*: Rejected as it implies the user might be able to delete it under certain permissions.
  - *Keep button with confirmation popup that fails*: Rejected as it wastes user clicks and triggers unnecessary API errors.
- **KB reference**: [`kb/ADR/0008-strategy-versioning.md`](file:///d:/DaiHoc/KienTrucPM/kb/ADR/0008-strategy-versioning.md), [`kb/DESIGN.md`](file:///d:/DaiHoc/KienTrucPM/kb/DESIGN.md).

### D2: Backend HTTP DELETE Response Behavior
- **Chosen**: In [`StrategyController.deleteStrategy`](file:///d:/DaiHoc/KienTrucPM/workspace/apps/backend/src/strategy/controllers/strategy.controller.ts), explicitly return HTTP `403 Forbidden` with the error message: `Strategy deletion is permanently prohibited per ADR-0008 (Immutable Snapshots)`.
- **Rationale**: An explicit 403 Forbidden with a clear architectural reason documents the system boundary clearly for any external script or API consumer, distinguishing an architectural restriction from a missing route (404).
- **Alternatives considered**:
  - *Remove route entirely (return 404)*: Less informative for API consumers who might think the URL path changed.
  - *Silently return 200 without deleting*: Dangerous anti-pattern (violates Principle VI: Explicit Over Implicit).
- **KB reference**: [`kb/CONSTITUTION.md`](file:///d:/DaiHoc/KienTrucPM/kb/CONSTITUTION.md) (Principle VI: Explicit Over Implicit).

### D3: In-Place Editing Prevention
- **Chosen**: Parameter Editor functions strictly as a live inspector and runtime override input for backtesting; it never mutates the underlying `StrategyVersion` in the database.
- **Rationale**: Any parameter modification produces a completely new experiment or backtest request rather than overwriting existing version data.
- **KB reference**: [`agent_learn/lessons/remove-update-strategy-api-2026-08-19.md`](file:///d:/DaiHoc/KienTrucPM/agent_learn/lessons/remove-update-strategy-api-2026-08-19.md).
