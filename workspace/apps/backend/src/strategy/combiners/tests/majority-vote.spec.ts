import { MajorityVoteCombiner } from '../majority-vote.combiner';
import { SignalAction, Signal } from '@crypto-strategy-lab/shared';

describe('MajorityVoteCombiner', () => {
  let combiner: MajorityVoteCombiner;

  beforeEach(() => {
    combiner = new MajorityVoteCombiner();
  });

  it('should return HOLD if no signals provided', () => {
    const res = combiner.combine([]);
    expect(res.action).toBe(SignalAction.HOLD);
  });

  it('should return BUY when BUY has strict majority', () => {
    const signals: Signal[] = [
      { action: SignalAction.BUY, confidence: 0.8 },
      { action: SignalAction.BUY, confidence: 0.6 },
      { action: SignalAction.SELL, confidence: 0.9 },
    ];
    const res = combiner.combine(signals);
    expect(res.action).toBe(SignalAction.BUY);
    expect(res.confidence).toBe(0.7); // Average of 0.8 & 0.6
  });

  it('should return SELL when SELL has strict majority', () => {
    const signals: Signal[] = [
      { action: SignalAction.SELL, confidence: 0.8 },
      { action: SignalAction.SELL, confidence: 0.9 },
      { action: SignalAction.HOLD, confidence: 0.0 },
    ];
    const res = combiner.combine(signals);
    expect(res.action).toBe(SignalAction.SELL);
  });

  it('should return HOLD when there is no majority (tie)', () => {
    const signals: Signal[] = [
      { action: SignalAction.BUY, confidence: 0.8 },
      { action: SignalAction.SELL, confidence: 0.8 },
      { action: SignalAction.HOLD, confidence: 0.0 },
    ];
    const res = combiner.combine(signals);
    expect(res.action).toBe(SignalAction.HOLD);
    expect(res.confidence).toBe(0);
  });
});
