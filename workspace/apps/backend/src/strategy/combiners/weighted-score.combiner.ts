import { Signal, ICombiner, SignalAction } from '@crypto-strategy-lab/shared';

export class WeightedScoreCombiner implements ICombiner {
  private readonly weights: Record<string, number>;
  private readonly threshold: number;

  constructor(weights: Record<string, number> = {}, threshold: number = 0.2) {
    this.weights = weights;
    this.threshold = threshold;
  }

  getType(): string {
    return 'WeightedScore';
  }

  getWeights(): Record<string, number> {
    return this.weights;
  }

  combine(signals: Signal[]): Signal {
    if (!signals || signals.length === 0) {
      return {
        action: SignalAction.HOLD,
        confidence: 0,
        metadata: { reason: 'No signals provided' },
      };
    }

    let weightedScoreSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < signals.length; i++) {
      const sig = signals[i];
      // Try to read strategy name from metadata or use default weight 1.0
      const stratName = sig.metadata?.strategyName as string || `strategy_${i}`;
      const weight = this.weights[stratName] ?? 1.0;

      let direction = 0;
      if (sig.action === SignalAction.BUY) direction = 1;
      else if (sig.action === SignalAction.SELL) direction = -1;

      weightedScoreSum += direction * (sig.confidence || 0) * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return { action: SignalAction.HOLD, confidence: 0 };
    }

    const normalizedScore = weightedScoreSum / totalWeight;

    if (normalizedScore > this.threshold) {
      return {
        action: SignalAction.BUY,
        confidence: Math.min(Math.abs(normalizedScore), 1),
        metadata: { score: normalizedScore, totalWeight },
      };
    }

    if (normalizedScore < -this.threshold) {
      return {
        action: SignalAction.SELL,
        confidence: Math.min(Math.abs(normalizedScore), 1),
        metadata: { score: normalizedScore, totalWeight },
      };
    }

    return {
      action: SignalAction.HOLD,
      confidence: 0,
      metadata: { score: normalizedScore, totalWeight, reason: 'Score within threshold window' },
    };
  }
}
