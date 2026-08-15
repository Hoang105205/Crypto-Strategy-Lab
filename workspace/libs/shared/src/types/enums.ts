// Enums — sourced from kb/contracts/*.yaml
// Do not modify without updating the corresponding contract file.

export enum Timeframe {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',
  H2 = '2h',
  H4 = '4h',
  D1 = '1d',
}

export enum CandleStatus {
  FORMING = 'FORMING',
  CLOSED = 'CLOSED',
}

export enum StrategyType {
  MA = 'MA',
  RSI = 'RSI',
  BOLLINGER = 'Bollinger',
  SR = 'SR',
  SENTIMENT = 'Sentiment',
  COMPOSITE = 'Composite',
}

export enum SignalAction {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
}

export enum CombinerType {
  MAJORITY_VOTE = 'MajorityVote',
  WEIGHTED_SCORE = 'WeightedScore',
}

export enum JobStatusValue {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

export enum JobType {
  BACKTEST = 'BACKTEST',
}

export enum BacktestSource {
  USER = 'USER',
  SEARCH_LOOP = 'SEARCH_LOOP',
}

export enum LoopStatus {
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  STOPPED_BY_USER = 'STOPPED_BY_USER',
  FAILED = 'FAILED',
}

export enum RankingCriterion {
  SCORE = 'score',
  TOTAL_RETURN = 'totalReturn',
  WIN_RATE = 'winRate',
  MAX_DRAWDOWN = 'maxDrawdown',
  SHARPE_RATIO = 'sharpeRatio',
}

export enum StrategyGeneratorType {
  RANDOM = 'RANDOM',
  DOMAIN_GUIDED = 'DOMAIN_GUIDED',
}

export enum SearchLoopCandidateStatus {
  GENERATING = 'GENERATING',
  BACKTESTING = 'BACKTESTING',
  EVALUATED = 'EVALUATED',
  FAILED = 'FAILED',
}

export enum SearchLoopProgressStatus {
  GENERATING = 'GENERATING',
  BACKTESTING = 'BACKTESTING',
  EVALUATING = 'EVALUATING',
}

export enum SentimentLabel {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
  NEUTRAL = 'NEUTRAL',
}
