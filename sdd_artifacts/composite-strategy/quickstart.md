# Quickstart: Composite Strategy & Signal Combiners

## Usage Example

```typescript
import { CompositeStrategy } from './composite/composite.strategy';
import { MajorityVoteCombiner } from './combiners/majority-vote.combiner';
import { WeightedScoreCombiner } from './combiners/weighted-score.combiner';
import { MovingAverageStrategy } from './strategies/moving-average.strategy';
import { RsiStrategy } from './strategies/rsi.strategy';

// 1. Create child strategies
const maStrat = new MovingAverageStrategy(registry);
const rsiStrat = new RsiStrategy(registry);

// 2. Choose a combiner
const combiner = new MajorityVoteCombiner();
// OR: const combiner = new WeightedScoreCombiner({ 'MovingAverage': 1.5, 'RelativeStrengthIndex': 1.0 });

// 3. Create Composite Strategy
const composite = new CompositeStrategy(
  'MA_RSI_Composite',
  [maStrat, rsiStrat],
  combiner,
  registry
);

// 4. Analyze candles
const signal = composite.analyze(candles);
console.log('Combined Decision:', signal.action, signal.confidence);
```
