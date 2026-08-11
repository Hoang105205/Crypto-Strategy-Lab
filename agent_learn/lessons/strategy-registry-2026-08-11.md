# Lessons: Strategy Registry Plugin System — 2026-08-11

## What Worked
- Refactored `StrategyRegistry` cleanly in `apps/backend/src/strategy/registry/strategy.registry.ts` while preserving NestJS `@Injectable()` lifecycle.
- Implemented duplicate strategy registration prevention with explicit error throwing, satisfying ADR-0003 collision mitigation.
- Added `analyze(nameOrType, candles)` method delegating directly to registered strategy instance, maintaining Open-Closed Principle (OCP).
- Added comprehensive unit tests in `apps/backend/src/strategy/registry/strategy.registry.spec.ts` covering all quickstart scenarios.
- Exported `StrategyRegistry` from `StrategyModule` for seamless cross-module use.

## What Didn't Work
- Initial `register()` implementation simply overwrote strategies on key collisions instead of checking and throwing errors. Fixed with explicit key/name validation.

## Deviations from Plan
- None. Implementation strictly matches `spec.md`, `plan.md`, and `contracts/`.

## KB Updates Needed
- [x] All relevant KB files (`kb/modules/strategy-engine.md`, `kb/contracts/strategy.yaml`, `kb/ADR/0003-plugin-architecture.md`) are up-to-date and consistent with this implementation.
