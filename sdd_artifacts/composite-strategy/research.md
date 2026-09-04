# Research & Design Decisions: Composite Strategy & Signal Combiners

## 1. Majority Vote Algorithm
- Count votes for `BUY`, `SELL`, and `HOLD`.
- If `BUY` count > total / 2, return `BUY`.
- If `SELL` count > total / 2, return `SELL`.
- Otherwise (tie or no strict majority), return `HOLD` with `confidence: 0`.

## 2. Weighted Score Algorithm
- Assign a weight $w_i \ge 0$ to each child strategy $i$.
- Convert action to a direction: `BUY` -> +1, `SELL` -> -1, `HOLD` -> 0.
- For each signal $i$, calculate score contribution: $s_i = \text{direction}_i \times \text{confidence}_i \times w_i$.
- Compute total normalized score: $S = \frac{\sum s_i}{\sum w_i}$.
- Decision thresholds:
  - $S > +0.2 \implies \text{BUY}$ (confidence = $|S|$)
  - $S < -0.2 \implies \text{SELL}$ (confidence = $|S|$)
  - $-0.2 \le S \le +0.2 \implies \text{HOLD}$ (confidence = 0)

## 3. NestJS Integration & Registration
- `CompositeStrategy` can be instantiated dynamically with a list of child strategy names/instances and a chosen `ICombiner`.
- It will also be an `@Injectable()` service registered in `StrategyModule`.
