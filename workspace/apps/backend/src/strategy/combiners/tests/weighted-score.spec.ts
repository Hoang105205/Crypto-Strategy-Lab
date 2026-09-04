import { WeightedScoreCombiner } from '../weighted-score.combiner';
import { SignalAction, Signal } from '@crypto-strategy-lab/shared';

describe('WeightedScoreCombiner', () => {
  it('should return BUY when weighted score exceeds threshold', () => {
    const combiner = new WeightedScoreCombiner({ 'StratA': 2.0, 'StratB': 1.0 }, 0.2);
    const signals: Signal[] = [
      { action: SignalAction.BUY, confidence: 0.8, metadata: { strategyName: 'StratA' } },
      { action: SignalAction.SELL, confidence: 0.5, metadata: { strategyName: 'StratB' } },
    ];
    // Score = (+1 * 0.8 * 2.0 + -1 * 0.5 * 1.0) / 3.0 = (1.6 - 0.5) / 3.0 = 1.1 / 3 = +0.366 > 0.2
    const res = combiner.combine(signals);
    expect(res.action).toBe(SignalAction.BUY);
    expect(res.confidence).toBeGreaterThan(0.2);
  });

  it('should return SELL when weighted score drops below negative threshold', () => {
    const combiner = new WeightedScoreCombiner({ 'StratA': 1.0, 'StratB': 3.0 }, 0.2);
    const signals: Signal[] = [
      { action: SignalAction.BUY, confidence: 0.5, metadata: { strategyName: 'StratA' } },
      { action: SignalAction.SELL, confidence: 0.9, metadata: { strategyName: 'StratB' } },
    ];
    // Score = (+1 * 0.5 * 1.0 + -1 * 0.9 * 3.0) / 4.0 = (0.5 - 2.7) / 4.0 = -2.2 / 4 = -0.55 < -0.2
    const res = combiner.combine(signals);
    expect(res.action).toBe(SignalAction.SELL);
  });

  it('should return HOLD when score is within threshold window', () => {
    const combiner = new WeightedScoreCombiner({}, 0.2);
    const signals: Signal[] = [
      { action: SignalAction.BUY, confidence: 0.5, metadata: { strategyName: 'StratA' } },
      { action: SignalAction.SELL, confidence: 0.5, metadata: { strategyName: 'StratB' } },
    ];
    // Score = (+0.5 - 0.5) / 2 = 0
    const res = combiner.combine(signals);
    expect(res.action).toBe(SignalAction.HOLD);
  });
});
