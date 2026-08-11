# Research & Design Decisions: Base Technical Strategies

## Third-Party Libraries

**Decision**: Use `technicalindicators` npm package vs. custom mathematical implementation.
**Rationale**: 
1. **Accuracy**: The `technicalindicators` package is widely tested and handles edge cases in calculations (e.g., EMA smoothing factor initializations, floating-point precision for standard deviations in Bollinger Bands).
2. **Speed to Deliver**: Reduces boilerplate code significantly.
3. **Simplicity Over Cleverness (Constitution Art IV)**: We don't need to reinvent the wheel for basic math.

## Plugin Lifecycle Registration

**Decision**: How to register strategies into `StrategyRegistry` without modifying `registry.ts` directly.
**Rationale**: 
In NestJS, we can inject the `StrategyRegistry` into the strategy classes, and use the `OnModuleInit` lifecycle hook to self-register. 

Example approach:
```typescript
@Injectable()
export class MovingAverageStrategy implements IStrategy, OnModuleInit {
    constructor(private readonly registry: StrategyRegistry) {}
    
    onModuleInit() {
        this.registry.register(this);
    }
    
    // ... IStrategy implementation ...
}
```
This keeps strategies decoupled. They just need to be provided in `StrategyModule`.

## Support/Resistance Strategy Algorithm

**Challenge**: MA, RSI, and Bollinger Bands have standard mathematical definitions. "Support/Resistance" is more subjective and requires pivot point detection.
**Decision**: We will implement a simplified pivot-point-based S/R logic. 
- Identify recent local minimums (Support) and local maximums (Resistance) using a lookback window (e.g., 5 candles).
- Generate `BUY` when price touches a support level and the candle closes above it (bounce).
- Generate `SELL` when price breaks below a support level, or touches a resistance level and closes below it.
- **Simplification**: To keep it deterministic and aligned with the `analyze` signature, we will use a rolling window to dynamically calculate these levels on each `analyze` call.
