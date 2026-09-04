export const RETURN_WEIGHT = 0.5;
export const WIN_RATE_WEIGHT = 0.2;
export const RISK_WEIGHT = 0.3;
export const RETURN_NORMALIZATION_PERCENT = 100;
export const MAX_DRAWDOWN_RISK_FLOOR_PERCENT = 50;
export const SCORE_TIE_DECIMAL_PLACES = 4;

const MIN_NORMALIZED_RETURN = -1;
const MAX_NORMALIZED_RETURN = 1;
const MIN_WIN_RATE = 0;
const MAX_WIN_RATE = 1;

export interface ScoreInput {
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
}

export interface RankingCandidate extends ScoreInput {
  backtestResultId: string;
  score: number;
  executedAt: Date;
}

/** Replaceable pure policy seam used by Leaderboard composition. */
export interface IScoringPolicy {
  calculateScore(input: ScoreInput): number;
  compare(left: RankingCandidate, right: RankingCandidate): number;
}

export class ScoringPolicy implements IScoringPolicy {
  calculateScore(input: ScoreInput): number {
    assertNormalizedWinRate(input.winRate);

    const hasCompletedTrades = input.totalTrades > 0;
    const effectiveReturn = hasCompletedTrades ? input.totalReturn : 0;
    const effectiveWinRate = hasCompletedTrades ? input.winRate : 0;
    const normalizedReturn = clamp(
      effectiveReturn / RETURN_NORMALIZATION_PERCENT,
      MIN_NORMALIZED_RETURN,
      MAX_NORMALIZED_RETURN,
    );
    const riskScore =
      1 -
      Math.min(
        Math.abs(input.maxDrawdown) / MAX_DRAWDOWN_RISK_FLOOR_PERCENT,
        1,
      );

    return (
      RETURN_WEIGHT * normalizedReturn +
      WIN_RATE_WEIGHT * effectiveWinRate +
      RISK_WEIGHT * riskScore
    );
  }

  compare(left: RankingCandidate, right: RankingCandidate): number {
    const scoreOrder = compareDescending(
      roundScore(left.score),
      roundScore(right.score),
    );
    if (scoreOrder !== 0) return scoreOrder;

    const sharpeOrder = compareDescending(left.sharpeRatio, right.sharpeRatio);
    if (sharpeOrder !== 0) return sharpeOrder;

    const drawdownOrder = compareAscending(
      Math.abs(left.maxDrawdown),
      Math.abs(right.maxDrawdown),
    );
    if (drawdownOrder !== 0) return drawdownOrder;

    const executionOrder = compareAscending(
      left.executedAt.getTime(),
      right.executedAt.getTime(),
    );
    if (executionOrder !== 0) return executionOrder;

    return compareTextAscending(left.backtestResultId, right.backtestResultId);
  }
}

function assertNormalizedWinRate(winRate: number): void {
  if (
    !Number.isFinite(winRate) ||
    winRate < MIN_WIN_RATE ||
    winRate > MAX_WIN_RATE
  ) {
    throw new RangeError('winRate must be a finite number in [0,1]');
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundScore(score: number): number {
  return Number(score.toFixed(SCORE_TIE_DECIMAL_PLACES));
}

function compareDescending(left: number, right: number): number {
  if (left > right) return -1;
  if (left < right) return 1;
  return 0;
}

function compareAscending(left: number, right: number): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareTextAscending(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
