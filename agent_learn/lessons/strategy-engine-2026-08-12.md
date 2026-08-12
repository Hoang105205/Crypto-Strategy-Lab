# Lessons Learned: Strategy Engine Fullstack Deliverables

**Date**: 2026-08-12 | **Module**: Strategy Engine (Member B - Huy)

## Key Takeaways

1. **Plugin Architecture (ADR-0003)**:
   - Standalone strategy classes implementing `IStrategy` can self-register via NestJS `OnModuleInit` lifecycle hook, adhering to the Open-Closed Principle.
2. **Native Math vs Third-Party Packages**:
   - Zero-dependency mathematical implementations (`indicators.ts`) provide full reliability and portability across restricted terminal/CI environments without external package issues.
3. **Composite Pattern & Signal Combiners (ADR-0008)**:
   - GoF Composite pattern allows nesting strategies seamlessly. Signal combiners (`MajorityVoteCombiner`, `WeightedScoreCombiner`) convert individual strategy signals into a unified trading decision.
4. **TypeScript Decorator Metadata (TS1272)**:
   - Under `isolatedModules` and `emitDecoratorMetadata`, constructor parameters of `@Injectable()` decorated classes that refer to TypeScript interfaces MUST use `import type` syntax (e.g. `import type { IStrategy }`).
5. **Fullstack Next.js Integration**:
   - Strategy Builder UI components (`StrategyCard`, `ParameterEditor`, `CompositeBuilder`, `TradeTable`) directly bind to NestJS REST Controllers (`GET /api/strategies`, `POST /api/strategies/composite`, `POST /api/strategies/backtest`) with graceful offline fallback simulation.
