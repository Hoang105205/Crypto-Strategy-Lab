import { Signal, ICombiner, SignalAction } from '@crypto-strategy-lab/shared';

export class MajorityVoteCombiner implements ICombiner {
  getType(): string {
    return 'MajorityVote';
  }
  combine(signals: Signal[]): Signal {
    if (!signals || signals.length === 0) {
      return {
        action: SignalAction.HOLD,
        confidence: 0,
        metadata: { reason: 'No signals provided' },
      };
    }

    let buyCount = 0;
    let sellCount = 0;
    let holdCount = 0;
    let buyConfidenceSum = 0;
    let sellConfidenceSum = 0;

    for (const sig of signals) {
      if (sig.action === SignalAction.BUY) {
        buyCount++;
        buyConfidenceSum += sig.confidence || 0;
      } else if (sig.action === SignalAction.SELL) {
        sellCount++;
        sellConfidenceSum += sig.confidence || 0;
      } else {
        holdCount++;
      }
    }

    const half = signals.length / 2;

    if (buyCount > half) {
      return {
        action: SignalAction.BUY,
        confidence: buyConfidenceSum / buyCount,
        metadata: { buyCount, sellCount, holdCount, total: signals.length },
      };
    }

    if (sellCount > half) {
      return {
        action: SignalAction.SELL,
        confidence: sellConfidenceSum / sellCount,
        metadata: { buyCount, sellCount, holdCount, total: signals.length },
      };
    }

    return {
      action: SignalAction.HOLD,
      confidence: 0,
      metadata: { buyCount, sellCount, holdCount, total: signals.length, reason: 'No majority' },
    };
  }
}
