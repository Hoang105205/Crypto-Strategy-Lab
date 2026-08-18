# Contract: Strategy Engine API & Interfaces

Cập nhật so với bản gốc tại `kb/contracts/strategy.yaml`.

## Interfaces

### IStrategy
**Description**: "Core strategy interface — all strategies (single + composite) implement this"
**Methods**:
- **analyze**(candles: Candle[]): Signal
  - Analyze candle data and produce a BUY/SELL/HOLD signal synchronously.
- **analyzeAsync**(candles: Candle[]): Promise<Signal> (Optional)
  - Analyze candle data asynchronously, allowing external API calls (e.g. Sentiment).

### IBacktester
**Description**: "Backtesting execution — simulates a strategy over historical candles"
**Methods**:
- **run**(strategy: IStrategy, candles: Candle[], config: BacktestConfig): Promise<Trade[]>
  - Replay candles, simulate trades based on strategy signals. Updated to return a Promise to support async strategy evaluation.
