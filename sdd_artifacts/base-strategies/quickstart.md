# Quickstart: Base Technical Strategies

This guide helps you understand how the 4 core technical strategies (MA, RSI, Bollinger Bands, Support/Resistance) integrate with the `StrategyEngine` module.

## 1. Overview
The 4 strategies are implemented as NestJS providers in `apps/backend/src/strategy/strategies/`. They automatically register themselves into the `StrategyRegistry` upon application startup.

## 2. Using the Strategies

Once the `StrategyModule` is imported into your application, you can retrieve any of the base strategies via the `StrategyRegistry`:

```typescript
import { Injectable } from '@nestjs/common';
import { StrategyRegistry } from '../registry/strategy.registry';
import { StrategyType, Candle } from '@crypto-strategy-lab/shared';

@Injectable()
export class BacktestEngine {
  constructor(private readonly registry: StrategyRegistry) {}

  public runTest(candles: Candle[]) {
    // Get the MA strategy
    const maStrategy = this.registry.get(StrategyType.MA);
    
    // Analyze candles and get a signal
    const signal = maStrategy.analyze(candles);
    
    if (signal.action === 'BUY') {
      console.log('MA Strategy says BUY with confidence:', signal.confidence);
    }
  }
}
```

## 3. Configuration & Parameters
Each strategy comes with default parameters but provides a `getParameters()` method:
- **MA**: Default period = 14
- **RSI**: Default period = 14
- **Bollinger Bands**: Default period = 20, Standard Deviation = 2
- **Support/Resistance**: Default lookback period = 5

In future updates, these parameters will be dynamic per instance, but currently, they return their static/default configuration.

## 4. Dependencies
Make sure `technicalindicators` is installed in the workspace (we will install it during the implementation phase):
```bash
npm install technicalindicators
```
