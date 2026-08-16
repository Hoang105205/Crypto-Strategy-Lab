import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';

const TARGET_FILE = join(__dirname, 'scoring-policy.ts');
const TARGET_MODULE = join(__dirname, 'scoring-policy');
const TARGET_EXISTS = existsSync(TARGET_FILE);

interface ScoreInput {
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
}

interface RankingCandidate extends ScoreInput {
  backtestResultId: string;
  score: number;
  executedAt: Date;
}

interface ScoringPolicyApi {
  calculateScore(input: ScoreInput): number;
  compare(left: RankingCandidate, right: RankingCandidate): number;
}

type ScoringPolicyConstructor = new () => ScoringPolicyApi;

const loadTarget = (): ScoringPolicyConstructor => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const target = require(TARGET_MODULE) as {
    ScoringPolicy?: ScoringPolicyConstructor;
  };
  if (typeof target.ScoringPolicy !== 'function') {
    throw new Error(
      'T021 RED: scoring-policy.ts must export ScoringPolicy with calculateScore() and compare().',
    );
  }
  return target.ScoringPolicy;
};

const metrics = (overrides: Partial<ScoreInput> = {}): ScoreInput => ({
  totalReturn: 20,
  winRate: 0.6,
  maxDrawdown: -10,
  sharpeRatio: 1.2,
  totalTrades: 10,
  ...overrides,
});

const candidate = (
  overrides: Partial<RankingCandidate> = {},
): RankingCandidate => ({
  ...metrics(),
  backtestResultId: 'result-b',
  score: 0.5,
  executedAt: new Date('2026-08-15T02:00:00.000Z'),
  ...overrides,
});

describe('ScoringPolicy contract (T021)', () => {
  it('has the production scoring target required by T023', () => {
    if (!TARGET_EXISTS) {
      throw new Error(
        'T021 RED: ScoringPolicy is not implemented yet. ' +
          'T023 must add src/leaderboard/scoring-policy.ts; this is not an import-path failure.',
      );
    }
    expect(loadTarget()).toBeDefined();
  });

  const describeWithTarget = TARGET_EXISTS ? describe : describe.skip;

  describeWithTarget('default score formula', () => {
    const Policy = TARGET_EXISTS
      ? loadTarget()
      : (class {} as ScoringPolicyConstructor);
    const policy = new Policy();

    it('uses the exact weighted formula for normalized return, win rate, and risk', () => {
      expect(policy.calculateScore(metrics())).toBeCloseTo(0.46, 10);
    });

    it('clamps returns above 100 percent before weighting', () => {
      expect(
        policy.calculateScore(
          metrics({ totalReturn: 250, winRate: 0, maxDrawdown: -50 }),
        ),
      ).toBeCloseTo(0.5, 10);
    });

    it('clamps returns below negative 100 percent before weighting', () => {
      expect(
        policy.calculateScore(
          metrics({ totalReturn: -250, winRate: 0, maxDrawdown: -50 }),
        ),
      ).toBeCloseTo(-0.5, 10);
    });

    it('floors risk score at zero for drawdowns of 50 percent or worse', () => {
      const atLimit = policy.calculateScore(
        metrics({ totalReturn: 0, winRate: 0, maxDrawdown: -50 }),
      );
      const beyondLimit = policy.calculateScore(
        metrics({ totalReturn: 0, winRate: 0, maxDrawdown: -85 }),
      );
      expect(atLimit).toBe(0);
      expect(beyondLimit).toBe(0);
    });

    it('accepts both inclusive win-rate boundaries', () => {
      expect(
        policy.calculateScore(
          metrics({ totalReturn: 0, winRate: 0, maxDrawdown: 0 }),
        ),
      ).toBeCloseTo(0.3, 10);
      expect(
        policy.calculateScore(
          metrics({ totalReturn: 0, winRate: 1, maxDrawdown: 0 }),
        ),
      ).toBeCloseTo(0.5, 10);
    });

    it('normalizes return and win rate to zero when no trade completed', () => {
      expect(
        policy.calculateScore(
          metrics({
            totalReturn: 90,
            winRate: 0.95,
            maxDrawdown: -10,
            totalTrades: 0,
          }),
        ),
      ).toBeCloseTo(0.24, 10);
    });
  });

  describeWithTarget('deterministic canonical comparison', () => {
    const Policy = TARGET_EXISTS
      ? loadTarget()
      : (class {} as ScoringPolicyConstructor);
    const policy = new Policy();

    it('treats scores equal at four decimal places as a tie', () => {
      const higherRawScore = candidate({ score: 0.500_041, sharpeRatio: 1 });
      const higherSharpe = candidate({
        backtestResultId: 'result-a',
        score: 0.500_039,
        sharpeRatio: 2,
      });
      expect(policy.compare(higherRawScore, higherSharpe)).toBeGreaterThan(0);
    });

    it('uses higher Sharpe ratio as the first tie-break', () => {
      const lower = candidate({ sharpeRatio: 1 });
      const higher = candidate({
        backtestResultId: 'result-a',
        sharpeRatio: 2,
      });
      expect(policy.compare(higher, lower)).toBeLessThan(0);
    });

    it('uses less severe max drawdown as the second tie-break', () => {
      const severe = candidate({ maxDrawdown: -20, sharpeRatio: 1 });
      const lessSevere = candidate({
        backtestResultId: 'result-a',
        maxDrawdown: -10,
        sharpeRatio: 1,
      });
      expect(policy.compare(lessSevere, severe)).toBeLessThan(0);
    });

    it('uses earlier execution as the third tie-break', () => {
      const later = candidate({
        executedAt: new Date('2026-08-15T03:00:00.000Z'),
      });
      const earlier = candidate({
        backtestResultId: 'result-a',
        executedAt: new Date('2026-08-15T01:00:00.000Z'),
      });
      expect(policy.compare(earlier, later)).toBeLessThan(0);
    });

    it('uses backtest result identity as a final stable fallback', () => {
      const a = candidate({ backtestResultId: 'result-a' });
      const b = candidate({ backtestResultId: 'result-b' });
      expect(policy.compare(a, b)).toBeLessThan(0);
      expect(policy.compare(b, a)).toBeGreaterThan(0);
      expect(policy.compare(a, a)).toBe(0);
    });
  });
});
