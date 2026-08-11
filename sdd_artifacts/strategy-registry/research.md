# Research: Strategy Registry Plugin System

## Decisions

### D1: Registry In-Memory Key Structure & Collision Strategy
- **Chosen**: Store strategy mapping under both composite key `${strategy.getType()}:${strategy.getName()}` and short name `strategy.getName()`. Before adding any key to `Map<string, IStrategy>`, check if `has(key)` or `has(name)` is true. If either exists, throw `Error(`Strategy collision: strategy '${strategy.getName()}' or key '${key}' is already registered`)`.
- **Rationale**: Mitigates name/type collisions explicitly as required by ADR-0003 without breaking backwards compatibility with lookups by short name or composite key.
- **Alternatives considered**: Silent overwrite (Rejected: violates collision mitigation requirement), Namespace suffix auto-generation (Rejected: hides bugs and creates unpredictable strategy lookups).
- **KB reference**: `kb/ADR/0003-plugin-architecture.md`

### D2: Behavior on Missing Strategy during `analyze()`
- **Chosen**: Throw explicit `Error(`Strategy '${nameOrType}' not found in registry`)`.
- **Rationale**: Backtester and execution callers need to know immediately if a requested strategy fails to resolve.
- **Alternatives considered**: Return `HOLD` signal (Rejected: masks configuration/lookup errors), Return `null` (Rejected: requires additional null checks downstream).
- **KB reference**: `kb/contracts/strategy.yaml`
