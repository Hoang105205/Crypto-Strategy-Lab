# Research & Design Decisions: Backtest & Search Engine

## 1. Backtester Position Simulation
- Loop through candles chronologically.
- When `SignalAction.BUY` occurs and no open position exists, open LONG position at `candle.close`.
- When `SignalAction.SELL` occurs and an open LONG position exists, close position at `candle.close`, record `Trade` with PnL = $(exitPrice - entryPrice) \times quantity$.
- Force close any open position on the last candle to guarantee clean trade statistics.

## 2. Quantitative Evaluation Formulas
- **Total Return**: $\frac{\sum PnL}{InitialCapital}$
- **Win Rate**: $\frac{\text{Number of trades with } PnL > 0}{\text{Total Trades}}$
- **Max Drawdown**: $\max \left( \frac{Peak Equity - Trough Equity}{Peak Equity} \right)$
- **Profit Factor**: $\frac{\sum \text{Winning PnLs}}{\sum |\text{Losing PnLs}|}$ (or infinity/0 if no losses/wins)
- **Sharpe Ratio**: $\frac{\text{Mean Trade Return}}{\text{StdDev of Trade Returns}} \times \sqrt{252}$ (annualized approximation)

## 3. Strategy Generators
- **RandomGenerator**: Instantiates random combinations of MA, RSI, Bollinger, SR with randomized parameters (periods between 5-50).
- **DomainGuidedGenerator**: Instantiates Composite Strategy combining trend (MA) + momentum (RSI) using `MajorityVoteCombiner` or `WeightedScoreCombiner`.

## 4. Versioning Service
- Generates UUID for each `StrategyVersion` snapshot.
- Maintains snapshot records in memory (or Prisma DB when connected) to guarantee reproducibility.
